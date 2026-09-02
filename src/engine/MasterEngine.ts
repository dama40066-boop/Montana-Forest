import { Vec3, Vec2, clamp, lerp } from './math';
import { ECS, Entity, TransformComponent, RenderComponent } from './ecs';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { RigidBody, CapsuleCollider, SphereCollider, AABBCollider } from './physics/Colliders';
import { WorldGenerator, generatePineForest, TreeData, VILLAGE_BUILDINGS } from './world/World';
import { AnimalSystem } from './world/Animals';
import { NPCAISystem, NPCAgentData } from './ai/NPCBrain';
import { CrimeWantedSystem } from './gameplay/CrimeWantedSystem';
import { INITIAL_PLAYER_INVENTORY, generateDialogue, DialogueNode, CRAFTING_RECIPES } from './gameplay/InventoryEconomy';
import { WEAPON_DEFINITIONS, getWeaponDef, QUICK_WEAPON_SLOTS } from './gameplay/WeaponsRegistry';
import { SpatialAudioEngine } from './audio/SpatialAudio';
import { SurfaceAudioManager } from './audio/SurfaceAudioManager';
import { SaveSystem } from './save/SaveSystem';
import { BabylonRenderBackend } from './render/BabylonBackend';
import { PlayerStats, BountyContract, InventoryItem, AnimalEntityData, PlayerStance, WeaponDefinition } from '../types/game';
import { GameSettings, DEFAULT_SETTINGS } from '../components/SettingsModal';

export interface ArrowProjectile {
  pos: Vec3;
  vel: Vec3;
  age: number;
  damage: number;
}

export class MasterEngine {
  public ecs: ECS = new ECS();
  public physics: PhysicsWorld = new PhysicsWorld();
  public world: WorldGenerator = new WorldGenerator();
  public animals: AnimalSystem = new AnimalSystem();
  public ai: NPCAISystem = new NPCAISystem();
  public crime: CrimeWantedSystem = new CrimeWantedSystem();
  public audio: SpatialAudioEngine = new SpatialAudioEngine();
  public surfaceAudio: SurfaceAudioManager = new SurfaceAudioManager(this.world);
  public saves: SaveSystem = new SaveSystem();
  public renderBackend: BabylonRenderBackend = new BabylonRenderBackend();

  // Engine Settings
  public settings: GameSettings = { ...DEFAULT_SETTINGS };

  // Engine Time & Clocks
  public gameTimeSeconds: number = 7.5 * 3600; // Start at 7:30 AM
  public gameDay: number = 1;
  public timeScale: number = 45; // 1 real sec = 45 in-game sec

  // Fixed Physics Timestep Loop
  public fixedDt: number = 1 / 120;
  private accumulator: number = 0;
  private lastTime: number = performance.now();
  public running: boolean = false;
  public isPaused: boolean = false;

  // Weapon Cooldown & Reload Timers
  private fireCooldownTimer: number = 0;
  private reloadDurationTimer: number = 0;
  private currentReloadTotal: number = 0;

  // Player State
  public playerEntity: Entity | null = null;
  public playerBody: RigidBody | null = null;
  public playerYaw: number = 0;
  public playerPitch: number = 0;
  public lastRecordedYaw: number = 0;
  public lastRecordedPitch: number = 0;
  public playerStats: PlayerStats = {
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 100,
    maxHunger: 100,
    thirst: 100,
    maxThirst: 100,
    isStarving: false,
    isDehydrated: false,
    gold: 50,
    reputation: {
      townsfolk: 10,
      huntersGuild: 15,
      outlaws: 0,
      forestWardens: 20
    },
    wantedLevel: 0,
    bountyOnHead: 0,
    crimesCommitted: [],
    activeContracts: [],
    inventory: [...INITIAL_PLAYER_INVENTORY],
    equippedWeapon: 'rifle_repeater',
    magAmmo: {
      bow_pine: 1,
      rifle_repeater: 6,
      revolver_colt: 6,
      shotgun_double: 2,
      knife_hunter: 1
    },
    isAiming: false,
    isReloading: false,
    reloadProgress: 0,
    recoilKick: 0,
    arrows: 24,
    stance: 'STANDING',
    oxygen: 100,
    maxOxygen: 100,
    isSwimming: false,
    isUnderwater: false
  };

  // Stealth & Noise
  public stealthNoise: number = 0;
  public stealthVisibility: number = 1.0;

  // Projectiles
  public activeArrows: ArrowProjectile[] = [];

  // Interaction State
  public targetedNPC: NPCAgentData | null = null;
  public targetedAnimal: AnimalEntityData | null = null;
  public isNearWantedBoard: boolean = false;
  public isNearCampfire: boolean = false;
  public isNearWaterSource: boolean = false;
  private survivalWarningTimer: number = 0;

  // UI Dialog / Modal States
  public activeDialogue: { agent: NPCAgentData; node: DialogueNode } | null = null;
  public toastMessage: string = 'Welcome to Vanishing Pines • Explore Flathead Valley';

  // Input states
  public keys: Set<string> = new Set();
  public mouseLook: Vec2 = new Vec2();

  // Mobile Input States
  private mobileMoveVector: Vec2 = new Vec2(0, 0);
  private mobileIsSprint: boolean = false;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    await this.renderBackend.initialize(canvas);
    await this.saves.open();

    // 1. Generate Pine Trees & Forest
    const trees = generatePineForest(this.world);
    this.renderBackend.buildWorldMesh(this.world, trees);

    // 2. Add Tree Trunk Static Physics Colliders (prevent player clipping through tree trunks)
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const treeEnt = this.ecs.create(`Tree_${i}`);
      const tTr = treeEnt.add('transform', new TransformComponent());
      tTr.position.set(t.x, t.y, t.z);
      // Trunk collider with 0.35m radius and 5m height
      this.physics.addStatic(treeEnt, new CapsuleCollider(0.35, 5.0));
    }

    // 3. Initialize Animals & NPCs
    this.animals.initAnimals(this.world);
    this.ai.initAgents(this.world);
    this.crime.initContracts();

    for (const animal of this.animals.animals) {
      this.renderBackend.createAnimalRig(animal.id, animal.species, animal.name);
    }

    // 4. Create Player Entity & Physics Capsule
    this.playerEntity = this.ecs.create('Player');
    const tr = this.playerEntity.add('transform', new TransformComponent());
    tr.position.set(0, this.world.height(0, 0) + 1.2, 4);

    this.playerBody = new RigidBody(this.playerEntity, {
      mass: 75,
      ccd: true,
      restitution: 0.02,
      friction: 0.85
    });
    this.playerEntity.add('collider', new CapsuleCollider(0.38, 1.75));
    this.playerEntity.add('rigidbody', this.playerBody);
    this.physics.add(this.playerBody);

    // 5. Create Visual Mesh for Player & NPCs in RenderBackend
    this.renderBackend.createHumanoidRig(0, 'Player', 'cloth_player', true);
    for (const npc of this.ai.agents) {
      const clothType = npc.occupation === 'Town Sheriff' ? 'cloth_sheriff' : npc.occupation === 'Master Hunter' ? 'cloth_hunter' : npc.isWantedTarget ? 'cloth_outlaw' : 'cloth_civilian';
      this.renderBackend.createHumanoidRig(npc.id, npc.name, clothType, false);
    }

    // 6. Add Comprehensive Static Building & World Structure Colliders (100% Anti-Penetration)
    for (const b of VILLAGE_BUILDINGS) {
      if (b.type === 'dock') {
        // Dock walkable surface collider
        const dockEnt = this.ecs.create(`Dock_${b.name}`);
        const dTr = dockEnt.add('transform', new TransformComponent());
        dTr.position.set(b.x, this.world.height(b.x, b.z) + 0.45, b.z);
        this.physics.addStatic(dockEnt, new AABBCollider(b.w, 0.4, b.d));
        continue;
      }

      // Main Building Core Solid Box (Extended height from foundation to roof peak)
      const bEnt = this.ecs.create(`Building_${b.name}`);
      const bTr = bEnt.add('transform', new TransformComponent());
      const totalBuildingH = b.h + 3.5;
      bTr.position.set(b.x, this.world.height(b.x, b.z) + totalBuildingH / 2, b.z);
      this.physics.addStatic(bEnt, new AABBCollider(b.w, totalBuildingH, b.d));

      // Front Porch Structure for Saloon, Sheriff, General Store, Lodge
      if (b.type === 'tavern' || b.type === 'sheriff' || b.type === 'shop' || b.type === 'lodge') {
        const porchDepth = 2.2;
        const bY = this.world.height(b.x, b.z);
        // Porch Deck Floor (walkable platform at foundation height matching 3D visual mesh)
        const porchFloor = this.ecs.create(`PorchDeck_${b.name}`);
        const pfTr = porchFloor.add('transform', new TransformComponent());
        pfTr.position.set(b.x, bY + 0.35, b.z - b.d / 2 - porchDepth / 2);
        this.physics.addStatic(porchFloor, new AABBCollider(b.w + 0.2, 0.5, porchDepth));

        // Left & Right Porch Support Pillar Colliders
        const postLeft = this.ecs.create(`PorchPostL_${b.name}`);
        const plTr = postLeft.add('transform', new TransformComponent());
        plTr.position.set(b.x - b.w / 2 + 0.3, bY + 1.5, b.z - b.d / 2 - porchDepth + 0.2);
        this.physics.addStatic(postLeft, new CapsuleCollider(0.22, 3.2));

        const postRight = this.ecs.create(`PorchPostR_${b.name}`);
        const prTr = postRight.add('transform', new TransformComponent());
        prTr.position.set(b.x + b.w / 2 - 0.3, bY + 1.5, b.z - b.d / 2 - porchDepth + 0.2);
        this.physics.addStatic(postRight, new CapsuleCollider(0.22, 3.2));
      }
    }

    // Static Boulder Rock Colliders
    const rockPositions = [
      { x: 32, z: 2, scale: 2.4 },
      { x: 42, z: 28, scale: 3.2 },
      { x: -14, z: -18, scale: 2.0 },
      { x: -35, z: 15, scale: 3.5 },
      { x: 2, z: -48, scale: 2.8 },
      { x: 48, z: 42, scale: 4.0 },
      { x: -28, z: -35, scale: 2.2 }
    ];
    for (let ri = 0; ri < rockPositions.length; ri++) {
      const r = rockPositions[ri];
      const rEnt = this.ecs.create(`RockBoulder_${ri}`);
      const rTr = rEnt.add('transform', new TransformComponent());
      rTr.position.set(r.x, this.world.height(r.x, r.z) + r.scale * 0.4, r.z);
      this.physics.addStatic(rEnt, new SphereCollider(r.scale * 0.85));
    }

    // Static Colliders for Campfire, Shooting Range and Frontier Props
    const campfireEnt = this.ecs.create('Campfire_Collider');
    const cfTr = campfireEnt.add('transform', new TransformComponent());
    cfTr.position.set(-6, this.world.height(-6, 2) + 0.4, 2);
    this.physics.addStatic(campfireEnt, new CapsuleCollider(0.85, 0.8));

    const wantedBoardEnt = this.ecs.create('WantedBoard_Collider');
    const wbTr = wantedBoardEnt.add('transform', new TransformComponent());
    wbTr.position.set(3, this.world.height(3, 4) + 1.2, 4);
    this.physics.addStatic(wantedBoardEnt, new AABBCollider(1.8, 2.4, 0.4));

    this.running = true;
    this.bindInputs(canvas);
    this.startLoop();
  }

  public applySettings(settings?: Partial<GameSettings>): void {
    const safeSettings: GameSettings = { ...DEFAULT_SETTINGS, ...this.settings, ...(settings || {}) };
    this.settings = safeSettings;
    if (this.renderBackend) {
      if (safeSettings.quality) {
        this.renderBackend.setQuality(safeSettings.quality);
      }
      if (this.renderBackend.camera && typeof safeSettings.fov === 'number') {
        this.renderBackend.camera.fov = (safeSettings.fov * Math.PI) / 180;
      }
    }
    if (this.audio) {
      if (typeof safeSettings.masterVolume === 'number') this.audio.setMasterVolume(safeSettings.masterVolume);
      if (typeof safeSettings.musicVolume === 'number') this.audio.setMusicVolume(safeSettings.musicVolume);
      if (typeof safeSettings.sfxVolume === 'number') this.audio.setSfxVolume(safeSettings.sfxVolume);
      if (typeof safeSettings.ambientVolume === 'number') this.audio.setAmbientVolume(safeSettings.ambientVolume);
    }
  }

  // Mobile Controller API
  public setMobileInput(vx: number, vz: number, isSprint: boolean): void {
    this.mobileMoveVector.set(vx, vz);
    this.mobileIsSprint = isSprint;
  }

  public applyLookDelta(dx: number, dy: number): void {
    const sens = this.settings.touchSensitivity * 0.0032;
    const invertFactor = this.settings.invertY ? -1 : 1;
    this.playerYaw += dx * sens;
    this.playerPitch = clamp(this.playerPitch + dy * sens * invertFactor, -1.45, 1.45);
  }

  public triggerJump(): void {
    if (this.playerBody && this.playerBody.grounded && this.playerStats.stamina >= 15) {
      if (this.playerEntity) {
        const tr = this.playerEntity.get<TransformComponent>('transform');
        if (tr) {
          const surface = this.surfaceAudio.detectSurface(tr.position, this.playerStats.isUnderwater);
          this.surfaceAudio.playFootstepSound({ surface, intensity: 0.85 });
        }
      }
      this.playerBody.applyImpulse(new Vec3(0, 5.4 * this.playerBody.mass, 0));
      this.playerStats.stamina -= 15;
      this.playerBody.grounded = false;
    }
  }

  public setStance(stance: PlayerStance): void {
    this.playerStats.stance = stance;
  }

  private bindInputs(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.handleInteract();
      if (e.code === 'KeyR') this.reloadWeapon();
      if (e.code === 'Digit1') this.switchWeapon('bow_pine');
      if (e.code === 'Digit2') this.switchWeapon('rifle_repeater');
      if (e.code === 'Digit3') this.switchWeapon('revolver_colt');
      if (e.code === 'Digit4') this.switchWeapon('shotgun_double');
      if (e.code === 'Digit5') this.switchWeapon('knife_hunter');

      if (e.code === 'KeyC') {
        this.playerStats.stance = this.playerStats.stance === 'CROUCH' ? 'STANDING' : 'CROUCH';
      }
      if (e.code === 'KeyZ') {
        this.playerStats.stance = this.playerStats.stance === 'PRONE' ? 'STANDING' : 'PRONE';
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        const sens = this.settings.mouseSensitivity * (this.playerStats.isAiming ? 0.0012 : 0.0022);
        const invert = this.settings.invertY ? -1 : 1;
        this.mouseLook.x += e.movementX * (sens / 0.0022);
        this.mouseLook.y += e.movementY * (sens / 0.0022) * invert;
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        this.audio.start();
      } else if (e.button === 0) {
        this.fireWeapon();
      } else if (e.button === 2) {
        this.toggleAim(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.toggleAim(false);
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private startLoop(): void {
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (!this.isPaused) {
        // Update in-game clock
        this.gameTimeSeconds += dt * this.timeScale;
        while (this.gameTimeSeconds >= 86400) {
          this.gameTimeSeconds -= 86400;
          this.gameDay++;
        }

        this.accumulator += dt;
        while (this.accumulator >= this.fixedDt) {
          this.fixedUpdate(this.fixedDt);
          this.accumulator -= this.fixedDt;
        }

        this.update(dt);
      }

      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private fixedUpdate(dt: number): void {
    if (!this.playerEntity || !this.playerBody) return;

    const tr = this.playerEntity.get<TransformComponent>('transform');
    if (!tr) return;

    // 1. Process First Person Mouse Look
    const sens = this.settings.mouseSensitivity * 0.0022;
    this.playerYaw += this.mouseLook.x * sens;
    this.playerPitch = clamp(this.playerPitch + this.mouseLook.y * sens, -1.45, 1.45);
    this.mouseLook.set(0, 0);

    // 2. Process Movement Input (Combining Keyboard & Mobile Virtual Joystick)
    let keyForward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let keyStrafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);

    // Combine with mobile virtual stick if active
    let forward = keyForward !== 0 ? keyForward : this.mobileMoveVector.y;
    let strafe = keyStrafe !== 0 ? keyStrafe : this.mobileMoveVector.x;

    const isRunning =
      ((this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mobileIsSprint) &&
        this.playerStats.stamina > 10);

    const rawLen = Math.hypot(forward, strafe);
    const len = rawLen > 1 ? rawLen : 1;

    // Check Water Depth & Swimming/Diving State
    const waterSurfaceY = this.world.waterHeight;
    const playerFootY = tr.position.y;
    const isPlayerInWater = playerFootY < waterSurfaceY + 0.2;
    const waterDepth = Math.max(0, waterSurfaceY - playerFootY);
    const isDeepWater = waterDepth > 0.8;

    this.playerStats.isSwimming = isPlayerInWater;

    // Camera height calculation for underwater head submersion
    const cameraEyeY = this.playerStats.stance === 'CROUCH' ? tr.position.y + 1.15 : tr.position.y + 1.65;
    const isCameraUnderwater = cameraEyeY < waterSurfaceY - 0.05;
    this.playerStats.isUnderwater = isCameraUnderwater;

    // Oxygen & Breath Simulation
    if (isCameraUnderwater) {
      // Deplete breath oxygen while diving underwater
      this.playerStats.oxygen = Math.max(0, this.playerStats.oxygen - dt * 6.5);
      if (this.playerStats.oxygen <= 0) {
        // Drowning damage
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dt * 10.0);
        this.setToast('⚠️ DROWNING! Surface immediately for oxygen!');
      }
    } else {
      // Restore oxygen when breathing above water
      if (this.playerStats.oxygen < 100) {
        this.playerStats.oxygen = Math.min(100, this.playerStats.oxygen + dt * 35.0);
      }
    }

    // Hunger & Thirst Decay Simulation
    const isSprinting = isRunning && (forward !== 0 || strafe !== 0);
    const hungerDecayRate = isSprinting ? 0.22 : isPlayerInWater ? 0.20 : 0.10;
    const thirstDecayRate = isSprinting ? 0.38 : isPlayerInWater ? 0.24 : 0.18;

    this.playerStats.hunger = Math.max(0, this.playerStats.hunger - hungerDecayRate * dt);
    this.playerStats.thirst = Math.max(0, this.playerStats.thirst - thirstDecayRate * dt);

    this.playerStats.isStarving = this.playerStats.hunger <= 0;
    this.playerStats.isDehydrated = this.playerStats.thirst <= 0;

    // Starvation & Dehydration Health Penalties
    if (this.playerStats.isStarving) {
      this.playerStats.hp = Math.max(0, this.playerStats.hp - dt * 1.2);
    }
    if (this.playerStats.isDehydrated) {
      this.playerStats.hp = Math.max(0, this.playerStats.hp - dt * 2.2);
    }

    // Periodic survival warnings
    this.survivalWarningTimer += dt;
    if (this.survivalWarningTimer > 35) {
      if (this.playerStats.isStarving && this.playerStats.isDehydrated) {
        this.setToast('⚠️ CRITICAL: Starving & Dehydrated! Consume food & water immediately!');
        this.survivalWarningTimer = 0;
      } else if (this.playerStats.isDehydrated) {
        this.setToast('⚠️ DEHYDRATION: You are dying of thirst! Drink water or find a stream!');
        this.survivalWarningTimer = 0;
      } else if (this.playerStats.isStarving) {
        this.setToast('⚠️ STARVATION: You are starving! Eat meat, stew or berries to survive.');
        this.survivalWarningTimer = 0;
      }
    }

    let targetSpeed = 4.2;
    if (isDeepWater) {
      targetSpeed = isRunning ? 4.8 : 3.0;
    } else if (this.playerStats.stance === 'CROUCH') {
      targetSpeed = 2.2;
    } else if (this.playerStats.stance === 'PRONE') {
      targetSpeed = 1.2;
    } else if (isSprinting) {
      targetSpeed = 7.4;
      this.playerStats.stamina = Math.max(0, this.playerStats.stamina - dt * 14);
    } else {
      // Stamina recovery: halted by dehydration, throttled and capped to 35 by starvation
      if (!this.playerStats.isDehydrated) {
        const maxRecoverableStamina = this.playerStats.isStarving ? 35 : this.playerStats.maxStamina;
        const regenRate = this.playerStats.isStarving ? 5.0 : 12.0;
        if (this.playerStats.stamina < maxRecoverableStamina) {
          this.playerStats.stamina = Math.min(maxRecoverableStamina, this.playerStats.stamina + dt * regenRate);
        }
      }
    }

    // Movement speed penalty for severe dehydration
    if (this.playerStats.isDehydrated) {
      targetSpeed *= 0.72;
    }

    const fx = Math.sin(this.playerYaw);
    const fz = Math.cos(this.playerYaw);
    const rx = Math.cos(this.playerYaw);
    const rz = -Math.sin(this.playerYaw);

    let desiredVelX = rawLen > 0 ? ((fx * forward + rx * strafe) / len) * targetSpeed : 0;
    let desiredVelZ = rawLen > 0 ? ((fz * forward + rz * strafe) / len) * targetSpeed : 0;

    // In deep water, calculate 3D gaze diving vector (Diving down when looking down, surfacing when looking up)
    let desiredVelY = 0;
    if (isDeepWater) {
      if (forward > 0) {
        // Swim along view pitch
        desiredVelY = -Math.sin(this.playerPitch) * targetSpeed * forward;
      }
      // Crouch in water to dive down actively
      if (this.playerStats.stance === 'CROUCH') {
        desiredVelY -= 2.5;
      }
      // Jump in water to surface rapidly
      if (this.keys.has('Space')) {
        desiredVelY += 3.8;
      }
    }

    // Physical acceleration
    const curVelX = this.playerBody.velocity.x;
    const curVelZ = this.playerBody.velocity.z;
    const accelX = (desiredVelX - curVelX) * 18;
    const accelZ = (desiredVelZ - curVelZ) * 18;

    let forceY = 0;
    if (isDeepWater && desiredVelY !== 0) {
      const curVelY = this.playerBody.velocity.y;
      forceY = (desiredVelY - curVelY) * 12 * this.playerBody.mass;
    }

    this.playerBody.applyForce(new Vec3(accelX * this.playerBody.mass, forceY, accelZ * this.playerBody.mass));

    // Jump from Keyboard when grounded
    if (this.keys.has('Space') && !isDeepWater) {
      this.triggerJump();
    }

    // 3. Step Authoritative Physics Engine
    this.physics.step(dt, (x, z) => this.world.height(x, z), this.gameTimeSeconds);

    // 4. Update Wildlife and NPC AI
    const pPos = tr.position;
    this.stealthNoise = (this.playerBody.velocity.length / 7.4) * (this.playerStats.stance === 'CROUCH' ? 0.3 : 1.0);
    this.animals.update(dt, pPos, this.stealthNoise > 0.4, this.world);
    this.ai.update(
      dt,
      this.gameTimeSeconds / 3600,
      this.gameTimeSeconds,
      pPos,
      this.playerStats.wantedLevel,
      this.world
    );

    // 4.5. Process NPC Attacks on Player
    for (const agent of this.ai.agents) {
      if (agent.state === 'ATTACKING') {
        const dist = Math.hypot(agent.position[0] - pPos.x, agent.position[2] - pPos.z);
        if (dist < 22 && this.playerStats.hp > 0) {
          agent.attackTimer = (agent.attackTimer || 0) + dt;
          if (agent.attackTimer > 1.8) {
            agent.attackTimer = 0;
            // Line of sight check
            const toPlayer = new Vec3(pPos.x - agent.position[0], (pPos.y + 0.8) - (this.world.height(agent.position[0], agent.position[2]) + 1.2), pPos.z - agent.position[2]);
            const pDist = toPlayer.length;
            const dir = toPlayer.normalize();
            
            const hit = this.physics.raycast(
              new Vec3(agent.position[0], this.world.height(agent.position[0], agent.position[2]) + 1.2, agent.position[2]),
              dir,
              pDist,
              (x, z) => this.world.height(x, z)
            );
            
            // If we didn't hit terrain before reaching the player, deal damage
            if (!hit || hit.distance >= pDist - 1.0) {
              this.playerStats.hp = Math.max(0, this.playerStats.hp - 15);
              this.setToast(`Shot by ${agent.name}!`);
              this.audio.playRevolverShot();
              
              this.renderBackend.addBulletTracer(
                [agent.position[0], this.world.height(agent.position[0], agent.position[2]) + 1.2, agent.position[2]],
                [pPos.x, pPos.y + 1, pPos.z]
              );
            }
          }
        }
      }
    }

    // 5. Update Arrow Physics Projectiles
    this.updateArrowProjectiles(dt);
  }

  // Mobile Virtual Joystick & Touch State
  public onMoveVector(vec: Vec2, isSprint: boolean): void {
    this.mobileMoveVector = vec;
    this.mobileIsSprint = isSprint;
  }

  public onLookDelta(dx: number, dy: number): void {
    const sens = this.settings.mouseSensitivity * (this.playerStats.isAiming ? 0.001 : 0.0018);
    const invert = this.settings.invertY ? -1 : 1;
    this.playerYaw += dx * sens;
    this.playerPitch = clamp(this.playerPitch + dy * sens * invert, -1.45, 1.45);
  }

  // Weapon Switch System
  public switchWeapon(weaponId: string): void {
    const wDef = getWeaponDef(weaponId);
    if (!wDef) return;

    this.playerStats.equippedWeapon = weaponId;
    this.playerStats.isReloading = false;
    this.playerStats.reloadProgress = 0;
    this.reloadDurationTimer = 0;
    this.audio.playReloadSound('holster');
    this.setToast(`Equipped: ${wDef.name} (${wDef.description})`);
  }

  // Aim Down Sights (ADS) Mode
  public toggleAim(explicitAim?: boolean): void {
    const nextAim = explicitAim !== undefined ? explicitAim : !this.playerStats.isAiming;
    if (this.playerStats.isAiming !== nextAim) {
      this.playerStats.isAiming = nextAim;
      if (nextAim) {
        this.audio.playAimBreath();
      }
    }
  }

  // Reload Current Weapon
  public reloadWeapon(): void {
    const wId = this.playerStats.equippedWeapon;
    const wDef = getWeaponDef(wId);
    if (wDef.type === 'melee') return;

    const curMag = this.playerStats.magAmmo[wId] || 0;
    if (curMag >= wDef.magSize) {
      this.setToast(`${wDef.name} magazine is already full (${curMag}/${wDef.magSize})`);
      return;
    }

    // Check reserve ammo in inventory
    const ammoItem = this.playerStats.inventory.find((i) => i.id === wDef.ammoId);
    if (!ammoItem || ammoItem.count <= 0) {
      this.setToast(`No ${wDef.ammoName} in inventory!`);
      return;
    }

    if (this.playerStats.isReloading) return;

    this.playerStats.isReloading = true;
    this.reloadDurationTimer = wDef.reloadTime;
    this.currentReloadTotal = wDef.reloadTime;
    this.playerStats.reloadProgress = 0;
    this.audio.playReloadSound(wDef.type);
    this.setToast(`Reloading ${wDef.name}...`);
  }

  // Unified Fire Weapon Handler
  public fireWeapon(): void {
    if (!this.playerEntity) return;
    if (this.fireCooldownTimer > 0) return;

    const wId = this.playerStats.equippedWeapon;
    const wDef = getWeaponDef(wId);

    // 1. Melee Knife Combat
    if (wDef.type === 'melee') {
      if (this.playerStats.stamina < 8) {
        this.setToast('Too exhausted to strike! Catch your breath.');
        return;
      }
      this.playerStats.stamina -= 8;
      this.fireCooldownTimer = wDef.fireRate;
      this.playerStats.recoilKick = 0.4;
      this.audio.playKnifeSlash();

      const tr = this.playerEntity.get<TransformComponent>('transform');
      if (!tr) return;
      const pPos = tr.position;

      const forward = new Vec3(
        Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
        -Math.sin(this.playerPitch),
        Math.cos(this.playerYaw) * Math.cos(this.playerPitch)
      ).normalize();

      // Check melee strike on Wildlife & NPCs
      for (const animal of this.animals.animals) {
        if (animal.hp <= 0 || !animal.fleeTarget) continue;
        const [ax, ay, az] = animal.fleeTarget;
        const d = Math.hypot(ax - pPos.x, az - pPos.z);
        if (d < 2.4 && Math.abs(ay - pPos.y) < 1.8) {
          animal.hp = Math.max(0, animal.hp - wDef.damage);
          this.audio.playArrowImpact(true);
          this.setToast(`Slashing strike hit ${animal.name}! (HP: ${animal.hp}/${animal.maxHp})`);
          if (animal.hp <= 0) this.checkContractCompletion(animal.species);
          return;
        }
      }

      for (const npc of this.ai.agents) {
        if (npc.hp <= 0) continue;
        const [nx, ny, nz] = npc.position;
        const d = Math.hypot(nx - pPos.x, nz - pPos.z);
        if (d < 2.2 && Math.abs(ny - pPos.y) < 2.0) {
          npc.hp = Math.max(0, npc.hp - wDef.damage);
          this.audio.playArrowImpact(true);
          if (npc.isWantedTarget) {
            this.setToast(`Struck Silas with Bowie Knife! (HP: ${npc.hp}/${npc.maxHp})`);
            if (npc.hp <= 0) {
              npc.state = 'DEAD';
              this.checkContractCompletion('OUTLAW');
            }
          } else {
            const crimeType = npc.hp <= 0 ? 'MURDER' : 'ASSAULT';
            this.crime.commitCrime(crimeType, [nx, ny, nz], this.gameTimeSeconds, npc.name, this.ai.agents, this.playerStats);
            this.audio.playCrimeAlarm();
            this.setToast(`CRIME: ${crimeType}! Wanted Level: ${this.playerStats.wantedLevel} ★`);
          }
          return;
        }
      }
      return;
    }

    // 2. Bow Combat
    if (wDef.type === 'bow') {
      this.shootBow();
      this.fireCooldownTimer = wDef.fireRate;
      return;
    }

    // 3. Firearms Combat (Rifle, Revolver, Shotgun)
    const curMag = this.playerStats.magAmmo[wId] || 0;
    if (curMag <= 0) {
      this.audio.playEmptyClick();
      this.reloadWeapon();
      return;
    }

    // Consume round from magazine
    this.playerStats.magAmmo[wId] = curMag - 1;
    this.fireCooldownTimer = wDef.fireRate;
    this.playerStats.recoilKick = 1.0;

    // Apply pitch kick to camera
    const kickAmount = this.playerStats.isAiming ? wDef.recoil * 0.45 : wDef.recoil;
    this.playerPitch = clamp(this.playerPitch + kickAmount * 0.35, -1.45, 1.45);

    // Audio and Muzzle Flash
    if (wDef.type === 'rifle') this.audio.playRifleShot();
    else if (wDef.type === 'revolver') this.audio.playRevolverShot();
    else if (wDef.type === 'shotgun') this.audio.playShotgunBlast();

    this.renderBackend.triggerMuzzleFlash();

    // Fire Raycasts / Pellets
    const pellets = wDef.pelletCount || 1;
    const tr = this.playerEntity.get<TransformComponent>('transform');
    if (!tr) return;

    const eyePos = tr.position.clone().add(new Vec3(0, this.playerStats.stance === 'CROUCH' ? 1.15 : 1.65, 0));

    for (let p = 0; p < pellets; p++) {
      let spreadX = 0;
      let spreadY = 0;
      if (wDef.type === 'shotgun') {
        spreadX = (Math.random() - 0.5) * 0.08;
        spreadY = (Math.random() - 0.5) * 0.08;
      } else if (!this.playerStats.isAiming) {
        spreadX = (Math.random() - 0.5) * 0.025;
        spreadY = (Math.random() - 0.5) * 0.025;
      }

      const rayDir = new Vec3(
        Math.sin(this.playerYaw + spreadX) * Math.cos(this.playerPitch + spreadY),
        -Math.sin(this.playerPitch + spreadY),
        Math.cos(this.playerYaw + spreadX) * Math.cos(this.playerPitch + spreadY)
      ).normalize();

      this.processBulletRay(eyePos, rayDir, wDef);
    }
  }

  private processBulletRay(origin: Vec3, dir: Vec3, wDef: WeaponDefinition): void {
    const maxRange = wDef.range;
    let hitDist = maxRange;
    let hitType: 'target' | 'npc' | 'animal' | 'terrain' = 'terrain';
    let hitPos = origin.clone().add(dir.clone().scale(maxRange));

    // 1. Check Target Practice Range Stands
    for (const ts of this.renderBackend.targetStands) {
      const [tx, ty, tz] = ts.pos;
      const toTarget = new Vec3(tx - origin.x, ty - origin.y, tz - origin.z);
      const proj = toTarget.dot(dir);
      if (proj > 0 && proj < hitDist) {
        const closestPoint = origin.clone().add(dir.clone().scale(proj));
        const distFromCenter = Math.hypot(closestPoint.x - tx, closestPoint.y - ty, closestPoint.z - tz);
        if (distFromCenter < ts.radius) {
          hitDist = proj;
          hitPos = closestPoint;
          hitType = 'target';
          const score = distFromCenter < 0.25 ? 100 : distFromCenter < 0.5 ? 50 : 25;
          const scoreLabel = score === 100 ? 'BULLSEYE!' : score === 50 ? 'INNER RING!' : 'TARGET HIT!';
          this.audio.playArrowImpact(false);
          this.setToast(`${scoreLabel} +${score} Practice Points [${distFromCenter.toFixed(2)}m from center]`);
        }
      }
    }

    // 2. Check Wildlife
    for (const animal of this.animals.animals) {
      if (animal.hp <= 0 || !animal.fleeTarget) continue;
      const [ax, ay, az] = animal.fleeTarget;
      const toAnimal = new Vec3(ax - origin.x, (ay + 0.8) - origin.y, az - origin.z);
      const proj = toAnimal.dot(dir);
      if (proj > 0 && proj < hitDist) {
        const closestPoint = origin.clone().add(dir.clone().scale(proj));
        const distToBody = Math.hypot(closestPoint.x - ax, closestPoint.y - (ay + 0.8), closestPoint.z - az);
        if (distToBody < 1.1) {
          hitDist = proj;
          hitPos = closestPoint;
          hitType = 'animal';
          animal.hp = Math.max(0, animal.hp - wDef.damage);
          this.audio.playArrowImpact(true);
          if (animal.hp <= 0) {
            this.setToast(`Felled ${animal.name} with ${wDef.name}! Approach to harvest.`);
            this.checkContractCompletion(animal.species);
          } else {
            this.setToast(`Struck ${animal.name}! (HP: ${animal.hp}/${animal.maxHp})`);
          }
          break;
        }
      }
    }

    // 3. Check NPCs / Outlaws
    for (const npc of this.ai.agents) {
      if (npc.hp <= 0) continue;
      const [nx, ny, nz] = npc.position;
      const toNpc = new Vec3(nx - origin.x, (ny + 1.1) - origin.y, nz - origin.z);
      const proj = toNpc.dot(dir);
      if (proj > 0 && proj < hitDist) {
        const closestPoint = origin.clone().add(dir.clone().scale(proj));
        const distToBody = Math.hypot(closestPoint.x - nx, closestPoint.y - (ny + 1.1), closestPoint.z - nz);
        if (distToBody < 0.75) {
          hitDist = proj;
          hitPos = closestPoint;
          hitType = 'npc';
          npc.hp = Math.max(0, npc.hp - wDef.damage);
          this.audio.playArrowImpact(true);

          if (npc.isWantedTarget) {
            if (npc.hp <= 0) {
              npc.state = 'DEAD';
              this.setToast(`Silas Blackwood neutralized with ${wDef.name}! Collect your bounty at the Sheriff.`);
              this.checkContractCompletion('OUTLAW');
            } else {
              npc.state = 'ATTACKING';
              this.setToast(`Struck Outlaw Silas! (HP: ${npc.hp}/${npc.maxHp})`);
            }
          } else {
            const crimeType = npc.hp <= 0 ? 'MURDER' : 'ASSAULT';
            this.crime.commitCrime(crimeType, [nx, ny, nz], this.gameTimeSeconds, npc.name, this.ai.agents, this.playerStats);
            this.audio.playCrimeAlarm();
            this.setToast(`CRIME: ${crimeType}! Wanted Level: ${this.playerStats.wantedLevel} ★`);
          }
          break;
        }
      }
    }

    // Add bullet tracer line
    this.renderBackend.addBulletTracer(
      [origin.x, origin.y, origin.z],
      [hitPos.x, hitPos.y, hitPos.z]
    );
  }

  private update(dt: number): void {
    if (!this.playerEntity) return;
    const tr = this.playerEntity.get<TransformComponent>('transform');
    if (!tr) return;

    // Tick Weapon Timers
    if (this.fireCooldownTimer > 0) {
      this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - dt);
    }
    if (this.playerStats.recoilKick > 0) {
      this.playerStats.recoilKick = Math.max(0, this.playerStats.recoilKick - dt * 4.0);
    }

    // Tick Reloading Progress
    if (this.playerStats.isReloading) {
      this.reloadDurationTimer -= dt;
      this.playerStats.reloadProgress = 1.0 - Math.max(0, this.reloadDurationTimer / this.currentReloadTotal);

      if (this.reloadDurationTimer <= 0) {
        this.finishReload();
      }
    }

    // Check interaction targets
    this.checkInteractionTargets(tr.position);

    // Dynamic surface-aware footstep audio manager (wood, dirt, snow, water, rock, grass)
    const audioCtx = this.audio.getAudioContext();
    const sfxGain = this.audio.getSfxGain();
    if (audioCtx && sfxGain) {
      this.surfaceAudio.init(audioCtx, sfxGain);
    }

    if (this.playerBody) {
      this.surfaceAudio.update(
        tr.position,
        this.playerBody.velocity,
        this.playerBody.grounded,
        this.playerStats.stance,
        dt,
        this.playerStats.isUnderwater
      );
    }
  }

  private finishReload(): void {
    const wId = this.playerStats.equippedWeapon;
    const wDef = getWeaponDef(wId);
    this.playerStats.isReloading = false;
    this.playerStats.reloadProgress = 0;

    const curMag = this.playerStats.magAmmo[wId] || 0;
    const needed = wDef.magSize - curMag;
    if (needed <= 0) return;

    const ammoItem = this.playerStats.inventory.find((i) => i.id === wDef.ammoId);
    if (!ammoItem || ammoItem.count <= 0) return;

    const toLoad = Math.min(needed, ammoItem.count);
    ammoItem.count -= toLoad;
    this.playerStats.magAmmo[wId] = curMag + toLoad;

    // Legacy arrows count sync
    if (wId === 'bow_pine') {
      this.playerStats.arrows = ammoItem.count;
    }

    this.setToast(`Reloaded ${wDef.name} (${this.playerStats.magAmmo[wId]}/${wDef.magSize})`);
  }

  private render(): void {
    if (!this.playerEntity) return;
    const tr = this.playerEntity.get<TransformComponent>('transform');
    if (!tr) return;

    const hour = (this.gameTimeSeconds / 3600) % 24;
    const wDef = getWeaponDef(this.playerStats.equippedWeapon);
    const targetFov = this.playerStats.isAiming ? (wDef.zoomFov * Math.PI) / 180 : Math.PI / 3;
    const isMoving = this.playerBody ? this.playerBody.velocity.length > 0.4 : false;

    const deltaYaw = this.playerYaw - (this.lastRecordedYaw || this.playerYaw);
    const deltaPitch = this.playerPitch - (this.lastRecordedPitch || this.playerPitch);
    this.lastRecordedYaw = this.playerYaw;
    this.lastRecordedPitch = this.playerPitch;

    this.renderBackend.updateLightingTime(hour, this.playerStats.isUnderwater);
    this.renderBackend.updateCamera(
      tr.position,
      this.playerYaw,
      this.playerPitch,
      this.playerStats.stance === 'CROUCH',
      targetFov,
      isMoving,
      0.016
    );
    this.renderBackend.updateWeaponViewmodel(
      this.playerStats.equippedWeapon,
      this.playerStats.isAiming,
      this.playerStats.recoilKick,
      isMoving,
      0.016,
      deltaYaw * 40,
      deltaPitch * 40
    );
    this.renderBackend.animateNPCs(this.ai.agents, 0.016);
    this.renderBackend.animateAnimals(this.animals.animals, 0.016);
    this.renderBackend.render();
  }

  // Shooting Bow with Realistic Ballistic Drop & Physics Collision
  public shootBow(): void {
    if (this.playerStats.arrows <= 0 || !this.playerEntity) {
      this.setToast('No hunting arrows left! Craft more or buy from Tobin.');
      return;
    }

    const tr = this.playerEntity.get<TransformComponent>('transform');
    if (!tr) return;

    this.playerStats.arrows--;
    this.audio.playBowRelease();

    const forward = new Vec3(
      Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
      -Math.sin(this.playerPitch),
      Math.cos(this.playerYaw) * Math.cos(this.playerPitch)
    ).normalize();

    const arrowSpeed = 48.0;
    const arrowPos = tr.position.clone().add(new Vec3(0, 1.45, 0)).add(forward.clone().scale(0.8));
    const arrowVel = forward.scale(arrowSpeed);

    this.activeArrows.push({
      pos: arrowPos,
      vel: arrowVel,
      age: 0,
      damage: 42
    });

    this.setToast(`Shot arrow! (${this.playerStats.arrows} remaining)`);
  }

  private updateArrowProjectiles(dt: number): void {
    for (let i = this.activeArrows.length - 1; i >= 0; i--) {
      const arrow = this.activeArrows[i];
      arrow.age += dt;

      // Ballistic Gravity
      arrow.vel.y -= 9.81 * dt;
      arrow.pos.add(arrow.vel.clone().scale(dt));

      // Terrain collision
      const terrH = this.world.height(arrow.pos.x, arrow.pos.z);
      if (arrow.pos.y <= terrH) {
        this.audio.playArrowImpact(false);
        this.activeArrows.splice(i, 1);
        continue;
      }

      // Wildlife collision check
      let hitEntity = false;
      for (const animal of this.animals.animals) {
        if (animal.hp <= 0) continue;
        const [ax, ay, az] = animal.fleeTarget ? [arrow.pos.x, arrow.pos.y, arrow.pos.z] : [0, 0, 0];
        const dist = Math.hypot(arrow.pos.x - ax, arrow.pos.z - az);
        if (dist < 1.4 && Math.abs(arrow.pos.y - ay) < 1.6) {
          hitEntity = true;
          this.audio.playArrowImpact(true);
          animal.hp = Math.max(0, animal.hp - arrow.damage);
          if (animal.hp <= 0) {
            this.setToast(`Felled ${animal.name}! Approach to harvest meat & pelt.`);
            this.checkContractCompletion(animal.species);
          } else {
            this.setToast(`Hit ${animal.name}! (HP: ${animal.hp}/${animal.maxHp})`);
          }
          this.activeArrows.splice(i, 1);
          break;
        }
      }
      if (hitEntity) continue;

      // NPC collision check
      for (const npc of this.ai.agents) {
        if (npc.hp <= 0) continue;
        const [nx, ny, nz] = npc.position;
        if (Math.hypot(arrow.pos.x - nx, arrow.pos.z - nz) < 0.8 && Math.abs(arrow.pos.y - ny) < 2.0) {
          this.audio.playArrowImpact(true);
          npc.hp = Math.max(0, npc.hp - arrow.damage);

          if (npc.isWantedTarget) {
            // Legal bounty target
            if (npc.hp <= 0) {
              npc.state = 'DEAD';
              this.setToast(`Target Silas Blackwood eliminated! Claim your reward at the Sheriff's office.`);
              this.checkContractCompletion('OUTLAW');
            } else {
              npc.state = 'ATTACKING';
              this.setToast(`Struck target Silas! (HP: ${npc.hp}/${npc.maxHp})`);
            }
          } else {
            // Assaulting or Murdering Innocent NPC
            const crimeType = npc.hp <= 0 ? 'MURDER' : 'ASSAULT';
            this.crime.commitCrime(
              crimeType,
              [arrow.pos.x, arrow.pos.y, arrow.pos.z],
              this.gameTimeSeconds,
              npc.name,
              this.ai.agents,
              this.playerStats
            );
            this.audio.playCrimeAlarm();
            this.setToast(`CRIME: ${crimeType}! Wanted Level: ${this.playerStats.wantedLevel} ★`);
          }

          this.activeArrows.splice(i, 1);
          break;
        }
      }

      if (arrow.age > 4.0) {
        this.activeArrows.splice(i, 1);
      }
    }
  }

  private checkContractCompletion(typeOrSpecies: string): void {
    for (const contract of this.crime.availableContracts) {
      if (!contract.completed) {
        if (contract.targetType === 'OUTLAW' && typeOrSpecies === 'OUTLAW') {
          contract.completed = true;
        } else if (contract.targetType === 'BEAST' && (typeOrSpecies === 'BEAR' || typeOrSpecies === 'WOLF')) {
          contract.completed = true;
        }
      }
    }
  }

  private checkInteractionTargets(playerPos: Vec3): void {
    // Check NPC interaction
    let nearestNPC: NPCAgentData | null = null;
    let minDist = 3.5;
    for (const npc of this.ai.agents) {
      const d = Math.hypot(npc.position[0] - playerPos.x, npc.position[2] - playerPos.z);
      if (d < minDist) {
        minDist = d;
        nearestNPC = npc;
      }
    }
    this.targetedNPC = nearestNPC;

    // Check Animal carcass harvesting
    let nearestDeadAnimal: AnimalEntityData | null = null;
    let minAnimalDist = 3.0;
    for (const animal of this.animals.animals) {
      if (animal.hp <= 0 && !animal.harvested && animal.fleeTarget) {
        const [ax, , az] = animal.fleeTarget;
        const d = Math.hypot(ax - playerPos.x, az - playerPos.z);
        if (d < minAnimalDist) {
          minAnimalDist = d;
          nearestDeadAnimal = animal;
        }
      }
    }
    this.targetedAnimal = nearestDeadAnimal;

    // Check Wanted Board at Sheriff Office (24, 12)
    this.isNearWantedBoard = Math.hypot(24 - playerPos.x, 12 - playerPos.z) < 4.5;
    // Check Campfire near tavern (26, 28)
    this.isNearCampfire = Math.hypot(26 - playerPos.x, 28 - playerPos.z) < 4.0;

    // Check Water Source (in water, shoreline, river, or town well at 18, 22)
    const isAtTownWell = Math.hypot(18 - playerPos.x, 22 - playerPos.z) < 3.5;
    const isNearNaturalWater = playerPos.y < this.world.waterHeight + 1.2 && this.world.height(playerPos.x, playerPos.z) < this.world.waterHeight + 0.8;
    this.isNearWaterSource = isAtTownWell || isNearNaturalWater || this.playerStats.isSwimming;
  }

  public handleInteract(): void {
    if (this.targetedAnimal && !this.targetedAnimal.harvested) {
      // Harvest Carcass
      this.targetedAnimal.harvested = true;
      const meatItem: InventoryItem = {
        id: 'raw_meat',
        name: `${this.targetedAnimal.species} Raw Meat`,
        category: 'material',
        count: this.targetedAnimal.meatYield,
        value: 6,
        description: 'Fresh game meat. Can be roasted over a campfire.',
        icon: 'Coffee'
      };
      const peltItem: InventoryItem = {
        id: this.targetedAnimal.peltType,
        name: `${this.targetedAnimal.species} Fur Pelt`,
        category: 'valuable',
        count: 1,
        value: 20,
        description: 'Pristine animal hide. Valued by traders.',
        icon: 'Shield'
      };

      this.addItemToInventory(meatItem);
      this.addItemToInventory(peltItem);
      this.setToast(`Harvested ${this.targetedAnimal.meatYield}x Meat & 1x ${peltItem.name}!`);
      return;
    }

    if (this.targetedNPC && this.targetedNPC.hp > 0) {
      // Open dynamic dialogue
      const node = generateDialogue(this.targetedNPC, this.playerStats);
      this.activeDialogue = { agent: this.targetedNPC, node };
      return;
    }

    // Interact with campfire to roast meat if held
    if (this.isNearCampfire) {
      const rawMeat = this.playerStats.inventory.find((i) => i.id === 'raw_meat');
      if (rawMeat && rawMeat.count > 0) {
        rawMeat.count--;
        if (rawMeat.count <= 0) {
          const idx = this.playerStats.inventory.indexOf(rawMeat);
          if (idx !== -1) this.playerStats.inventory.splice(idx, 1);
        }
        const cookedItem: InventoryItem = {
          id: 'cooked_venison',
          name: 'Smoked Venison Steak',
          category: 'consumable',
          count: 1,
          value: 12,
          description: 'Satiates 45 Hunger, restores 25 Health and 30 Stamina.',
          icon: 'Coffee',
          stats: { hunger: 45, heal: 25, stamina: 30 }
        };
        this.addItemToInventory(cookedItem);
        this.setToast('🔥 Roasted meat over campfire! Added Smoked Venison Steak to backpack.');
        return;
      }
    }

    // Drink fresh water if near a water source / well / lake
    if (this.isNearWaterSource) {
      this.playerStats.thirst = Math.min(this.playerStats.maxThirst, this.playerStats.thirst + 45);
      this.playerStats.stamina = Math.min(this.playerStats.maxStamina, this.playerStats.stamina + 15);
      this.playerStats.isDehydrated = false;
      this.audio.playFootstep('water', 0.8);
      this.setToast('💧 Drank clean spring water (+45 Thirst, +15 Stamina)!');
      return;
    }
  }

  public addItemToInventory(item: InventoryItem): void {
    const existing = this.playerStats.inventory.find((i) => i.id === item.id);
    if (existing) {
      existing.count += item.count;
    } else {
      this.playerStats.inventory.push({ ...item });
    }
  }

  public setToast(msg: string): void {
    this.toastMessage = msg;
  }
}
