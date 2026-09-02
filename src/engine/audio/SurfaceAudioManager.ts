import { Vec3, clamp } from '../math';
import { WorldGenerator, VILLAGE_BUILDINGS } from '../world/World';
import { PlayerStance } from '../../types/game';

export type SurfaceType = 'wood' | 'dirt' | 'snow' | 'water' | 'rock' | 'grass';

export interface SurfaceFootstepConfig {
  surface: SurfaceType;
  intensity: number; // 0.1 to 1.0 based on speed / stance
  isLanding?: boolean; // True for jump/fall landing impact
  isRightFoot?: boolean; // Alternating stereo separation
}

export class SurfaceAudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;

  // Stride cadence tracking
  private accumulatedStride: number = 0;
  private isRightFootStep: boolean = false;
  private wasGrounded: boolean = true;
  private airTime: number = 0;
  private currentSurface: SurfaceType = 'grass';

  constructor(private world: WorldGenerator) {}

  public init(audioCtx: AudioContext, destinationGain: GainNode): void {
    this.ctx = audioCtx;
    this.sfxGain = destinationGain;
  }

  public getCurrentSurface(): SurfaceType {
    return this.currentSurface;
  }

  /**
   * Performs multi-tier surface detection based on world coordinate, elevation, terrain biome, water level,
   * and structural wood footprints (porches, building interiors, dock, sawmill).
   */
  public detectSurface(pos: Vec3, isUnderwater: boolean = false): SurfaceType {
    const { x, y, z } = pos;

    // 1. Water Surface Check (underwater, wading in lake, creek, or shallow water)
    if (isUnderwater || y <= this.world.waterHeight + 0.38) {
      this.currentSurface = 'water';
      return 'water';
    }

    // Creek bed water channel check
    const creekBedY = Math.exp(-Math.pow(z - (-18 + x * 0.3), 2) / 12) * (x > 15 ? 1.6 : 0);
    if (creekBedY > 0.8 && y <= this.world.height(x, z) + 0.3) {
      this.currentSurface = 'water';
      return 'water';
    }

    // 2. Wood Surfaces (Buildings, Cabins, Porches, Dock/Pier, Sawmill)
    // Lake Timber Dock & Pier (x: 12, z: -14, w: 5, d: 14)
    if (Math.abs(x - 12) <= 3.2 && z >= -22 && z <= -6) {
      this.currentSurface = 'wood';
      return 'wood';
    }

    // Check all village buildings and their front porch platforms
    for (const b of VILLAGE_BUILDINGS) {
      const halfW = b.w / 2 + 0.4;
      const halfD = b.d / 2 + 0.4;
      const bY = this.world.height(b.x, b.z);

      // Building interior floor
      if (Math.abs(x - b.x) <= halfW && Math.abs(z - b.z) <= halfD && y >= bY - 0.2 && y <= bY + b.h + 0.5) {
        this.currentSurface = 'wood';
        return 'wood';
      }

      // Porch deck (extends in front of building)
      const porchDepth = 2.4;
      const porchCenterZ = b.z - b.d / 2 - porchDepth / 2;
      if (
        Math.abs(x - b.x) <= halfW &&
        Math.abs(z - porchCenterZ) <= porchDepth / 2 + 0.2 &&
        y >= bY - 0.2 &&
        y <= bY + 1.2
      ) {
        this.currentSurface = 'wood';
        return 'wood';
      }
    }

    // Kings Point Cabin & Ridge Hideout timber decks
    if (Math.hypot(x - (-20), z - (-25)) < 4.5 || Math.hypot(x - (-42), z - 32) < 5.0) {
      this.currentSurface = 'wood';
      return 'wood';
    }

    // 3. Snow Surface Check (High-altitude frosty peaks, snowcap mountain ridges, northern wilderness)
    const terrainHeight = this.world.height(x, z);
    const isNorthSnowRidge = z > 38 && terrainHeight > 6.8;
    const isEastSnowRidge = x > 38 && terrainHeight > 7.0;
    const isWestSnowMountain = x < -42 && terrainHeight > 7.0;
    const isHighAltitudeSnow = terrainHeight >= 9.2;

    if (isHighAltitudeSnow || isNorthSnowRidge || isEastSnowRidge || isWestSnowMountain) {
      this.currentSurface = 'snow';
      return 'snow';
    }

    // 4. Dirt / Mud Road Surfaces (Town center main street, trading post paths, campfire clearing)
    const townDist = Math.hypot(x - 24, z - 20);
    const isMainStreet = townDist < 42 && Math.abs(z - 20) < 4.2;
    const isCampfireClearing = Math.hypot(x - (-6), z - 2) < 7.0;
    const isShootingRangeDirt = Math.hypot(x - 3, z - 4) < 8.5;
    const isMuddyShoreline = terrainHeight > this.world.waterHeight && terrainHeight <= this.world.waterHeight + 0.65;

    if (isMainStreet || isCampfireClearing || isShootingRangeDirt || isMuddyShoreline) {
      this.currentSurface = 'dirt';
      return 'dirt';
    }

    // 5. Rock / Stone Surface Check (Boulder crags, mountain scree slopes, quarry)
    const rockClusters = [
      { x: 32, z: 2, r: 4.0 },
      { x: 42, z: 28, r: 4.5 },
      { x: -14, z: -18, r: 3.5 },
      { x: -35, z: 15, r: 4.8 },
      { x: 2, z: -48, r: 4.2 },
      { x: 48, z: 42, r: 5.5 },
      { x: -28, z: -35, r: 3.8 }
    ];
    for (const rock of rockClusters) {
      if (Math.hypot(x - rock.x, z - rock.z) <= rock.r) {
        this.currentSurface = 'rock';
        return 'rock';
      }
    }

    if (terrainHeight > 11.5) {
      this.currentSurface = 'rock';
      return 'rock';
    }

    // 6. Default: Prairie Grassland / Forest Pine Turf
    this.currentSurface = 'grass';
    return 'grass';
  }

  /**
   * Updates footstep cadence based on real player movement speed, stance, and jump landings.
   */
  public update(
    pos: Vec3,
    velocity: Vec3,
    isGrounded: boolean,
    stance: PlayerStance | 'STAND' | 'CROUCH' | 'PRONE',
    dt: number,
    isUnderwater: boolean = false
  ): void {
    const surface = this.detectSurface(pos, isUnderwater);
    const horizSpeed = Math.hypot(velocity.x, velocity.z);

    // Jump Landing Detection
    if (isGrounded && !this.wasGrounded && this.airTime > 0.18) {
      // Heavier landing impact sound
      const fallImpact = clamp(Math.abs(velocity.y) / 6.0, 0.4, 1.2);
      this.playLandingSound(surface, fallImpact);
      this.accumulatedStride = 0;
      this.airTime = 0;
    }

    if (!isGrounded) {
      this.airTime += dt;
      this.wasGrounded = false;
      return;
    }

    this.wasGrounded = true;
    this.airTime = 0;

    // Minimum threshold for movement footsteps
    if (horizSpeed < 0.35) {
      this.accumulatedStride = 0;
      return;
    }

    // Calculate stride step distance threshold
    // Sprint (speed > 5.5): ~1.85m | Walk: ~1.4m | Crouch: ~1.0m
    const isSprint = horizSpeed > 5.5;
    const isCrouch = stance === 'CROUCH';
    const stepInterval = isSprint ? 1.85 : isCrouch ? 1.05 : 1.42;

    this.accumulatedStride += horizSpeed * dt;

    if (this.accumulatedStride >= stepInterval) {
      this.accumulatedStride -= stepInterval;
      this.isRightFootStep = !this.isRightFootStep;

      const intensity = isCrouch ? 0.35 : isSprint ? 1.0 : 0.68;
      this.playFootstepSound({
        surface,
        intensity,
        isRightFoot: this.isRightFootStep
      });
    }
  }

  /**
   * Synthesizes rich, tactile, material-specific acoustic footsteps.
   */
  public playFootstepSound(config: SurfaceFootstepConfig): void {
    if (!this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const { surface, intensity, isRightFoot = false } = config;
    const now = this.ctx.currentTime;
    const panOffset = isRightFoot ? 0.12 : -0.12;
    const pitchDetune = isRightFoot ? 1.03 : 0.97;

    // Stereo Panner for organic binaural footstep separation
    let panner: StereoPannerNode | null = null;
    try {
      if (this.ctx.createStereoPanner) {
        panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panOffset, now);
        panner.connect(this.sfxGain);
      }
    } catch {}

    const targetOutput: AudioNode = panner || this.sfxGain;

    switch (surface) {
      case 'wood':
        this.synthesizeWoodFootstep(now, intensity, pitchDetune, targetOutput);
        break;
      case 'dirt':
        this.synthesizeDirtFootstep(now, intensity, pitchDetune, targetOutput);
        break;
      case 'snow':
        this.synthesizeSnowFootstep(now, intensity, pitchDetune, targetOutput);
        break;
      case 'water':
        this.synthesizeWaterFootstep(now, intensity, pitchDetune, targetOutput);
        break;
      case 'rock':
        this.synthesizeRockFootstep(now, intensity, pitchDetune, targetOutput);
        break;
      case 'grass':
      default:
        this.synthesizeGrassFootstep(now, intensity, pitchDetune, targetOutput);
        break;
    }
  }

  /**
   * Heavy landing thud when falling from heights onto specific terrain.
   */
  public playLandingSound(surface: SurfaceType, impactFactor: number = 0.8): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Trigger dual-foot heavy step sequence with micro-delay
    this.playFootstepSound({ surface, intensity: impactFactor * 1.15, isRightFoot: false, isLanding: true });
    window.setTimeout(() => {
      this.playFootstepSound({ surface, intensity: impactFactor * 0.9, isRightFoot: true, isLanding: true });
    }, 45);

    // Deep sub-impact thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.18);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.12 * impactFactor, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.24);
  }

  /**
   * WOOD: Resonant timber plank clack + hollow acoustic board thud + subtle creak.
   */
  private synthesizeWoodFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. High transient boot heel contact tap
    const tapOsc = this.ctx.createOscillator();
    const tapGain = this.ctx.createGain();
    tapOsc.type = 'triangle';
    tapOsc.frequency.setValueAtTime(320 * pitchMod, now);
    tapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

    tapGain.gain.setValueAtTime(0.001, now);
    tapGain.gain.linearRampToValueAtTime(0.14 * intensity, now + 0.004);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    tapOsc.connect(tapGain);
    tapGain.connect(out);
    tapOsc.start(now);
    tapOsc.stop(now + 0.07);

    // 2. Hollow wooden board cavity resonance
    const boardOsc = this.ctx.createOscillator();
    const boardFilter = this.ctx.createBiquadFilter();
    const boardGain = this.ctx.createGain();

    boardOsc.type = 'square';
    boardOsc.frequency.setValueAtTime(145 * pitchMod + (Math.random() * 10 - 5), now);
    boardOsc.frequency.exponentialRampToValueAtTime(52, now + 0.09);

    boardFilter.type = 'bandpass';
    boardFilter.frequency.setValueAtTime(280, now);
    boardFilter.Q.setValueAtTime(4.0, now);

    boardGain.gain.setValueAtTime(0.001, now);
    boardGain.gain.linearRampToValueAtTime(0.085 * intensity, now + 0.008);
    boardGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    boardOsc.connect(boardFilter);
    boardFilter.connect(boardGain);
    boardGain.connect(out);
    boardOsc.start(now);
    boardOsc.stop(now + 0.12);

    // 3. Occasional subtle timber floor creak (15% chance)
    if (Math.random() < 0.18) {
      const creakOsc = this.ctx.createOscillator();
      const creakGain = this.ctx.createGain();
      creakOsc.type = 'sawtooth';
      creakOsc.frequency.setValueAtTime(540, now + 0.02);
      creakOsc.frequency.linearRampToValueAtTime(620, now + 0.06);
      creakOsc.frequency.linearRampToValueAtTime(460, now + 0.1);

      creakGain.gain.setValueAtTime(0.0001, now + 0.02);
      creakGain.gain.linearRampToValueAtTime(0.02 * intensity, now + 0.04);
      creakGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      creakOsc.connect(creakGain);
      creakGain.connect(out);
      creakOsc.start(now + 0.02);
      creakOsc.stop(now + 0.13);
    }
  }

  /**
   * DIRT / MUD: Crunchy gravel scuff with filtered soil noise + low-mid earth displacement.
   */
  private synthesizeDirtFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. Gritty gravel/dirt friction noise burst
    const noiseLength = this.ctx.sampleRate * 0.09;
    const noiseBuffer = this.ctx.createBuffer(1, noiseLength, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1100 * pitchMod, now);
    noiseFilter.Q.setValueAtTime(1.8, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12 * intensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(out);
    noiseSrc.start(now);

    // 2. Earthy body step impact
    const earthOsc = this.ctx.createOscillator();
    const earthGain = this.ctx.createGain();
    earthOsc.type = 'triangle';
    earthOsc.frequency.setValueAtTime(115 * pitchMod, now);
    earthOsc.frequency.exponentialRampToValueAtTime(38, now + 0.07);

    earthGain.gain.setValueAtTime(0.001, now);
    earthGain.gain.linearRampToValueAtTime(0.09 * intensity, now + 0.005);
    earthGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    earthOsc.connect(earthGain);
    earthGain.connect(out);
    earthOsc.start(now);
    earthOsc.stop(now + 0.09);
  }

  /**
   * SNOW: Distinctive crisp powder compression crunch + dual-band frosty high-shelf.
   */
  private synthesizeSnowFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. High-frequency crisp crystalline snow crunch
    const snowLen = this.ctx.sampleRate * 0.12;
    const snowBuffer = this.ctx.createBuffer(1, snowLen, this.ctx.sampleRate);
    const data = snowBuffer.getChannelData(0);
    for (let i = 0; i < snowLen; i++) {
      // Modulated crunch texture
      const env = Math.exp(-i / (this.ctx.sampleRate * 0.035));
      const crunchMod = Math.sin(i * 0.08) > 0 ? 1.0 : 0.4;
      data[i] = (Math.random() * 2 - 1) * env * crunchMod;
    }
    const snowSrc = this.ctx.createBufferSource();
    snowSrc.buffer = snowBuffer;

    const highFilter = this.ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.setValueAtTime(2200 * pitchMod, now);

    const snowGain = this.ctx.createGain();
    snowGain.gain.setValueAtTime(0.11 * intensity, now);
    snowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    snowSrc.connect(highFilter);
    highFilter.connect(snowGain);
    snowGain.connect(out);
    snowSrc.start(now);

    // 2. Muffled powder compression under boot sole
    const powderOsc = this.ctx.createOscillator();
    const powderFilter = this.ctx.createBiquadFilter();
    const powderGain = this.ctx.createGain();

    powderOsc.type = 'triangle';
    powderOsc.frequency.setValueAtTime(160 * pitchMod, now);
    powderOsc.frequency.exponentialRampToValueAtTime(65, now + 0.08);

    powderFilter.type = 'lowpass';
    powderFilter.frequency.setValueAtTime(420, now);

    powderGain.gain.setValueAtTime(0.001, now);
    powderGain.gain.linearRampToValueAtTime(0.07 * intensity, now + 0.01);
    powderGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    powderOsc.connect(powderFilter);
    powderFilter.connect(powderGain);
    powderGain.connect(out);
    powderOsc.start(now);
    powderOsc.stop(now + 0.1);
  }

  /**
   * WATER: Fluid splash & slosh with rising droplet bubble harmonics and liquid displacement.
   */
  private synthesizeWaterFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. Water displacement harmonic sweep
    const waterOsc = this.ctx.createOscillator();
    const waterGain = this.ctx.createGain();
    waterOsc.type = 'sine';
    waterOsc.frequency.setValueAtTime(140 * pitchMod, now);
    waterOsc.frequency.linearRampToValueAtTime(290 * pitchMod, now + 0.04);
    waterOsc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    waterGain.gain.setValueAtTime(0.001, now);
    waterGain.gain.linearRampToValueAtTime(0.13 * intensity, now + 0.015);
    waterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    waterOsc.connect(waterGain);
    waterGain.connect(out);
    waterOsc.start(now);
    waterOsc.stop(now + 0.15);

    // 2. Splash droplet scatter noise
    const splashLen = this.ctx.sampleRate * 0.14;
    const splashBuffer = this.ctx.createBuffer(1, splashLen, this.ctx.sampleRate);
    const data = splashBuffer.getChannelData(0);
    for (let i = 0; i < splashLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }
    const splashSrc = this.ctx.createBufferSource();
    splashSrc.buffer = splashBuffer;

    const splashFilter = this.ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(1800 * pitchMod, now);
    splashFilter.Q.setValueAtTime(2.2, now);

    const splashGain = this.ctx.createGain();
    splashGain.gain.setValueAtTime(0.09 * intensity, now);
    splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    splashSrc.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(out);
    splashSrc.start(now);
  }

  /**
   * ROCK: Sharp, hard mineral impact tap + solid unyielding stone body.
   */
  private synthesizeRockFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. High transient mineral click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(420 * pitchMod, now);
    clickOsc.frequency.exponentialRampToValueAtTime(110, now + 0.04);

    clickGain.gain.setValueAtTime(0.001, now);
    clickGain.gain.linearRampToValueAtTime(0.12 * intensity, now + 0.003);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(out);
    clickOsc.start(now);
    clickOsc.stop(now + 0.06);

    // 2. Solid granite core body
    const stoneOsc = this.ctx.createOscillator();
    const stoneGain = this.ctx.createGain();
    stoneOsc.type = 'sine';
    stoneOsc.frequency.setValueAtTime(210 * pitchMod, now);
    stoneOsc.frequency.exponentialRampToValueAtTime(70, now + 0.07);

    stoneGain.gain.setValueAtTime(0.001, now);
    stoneGain.gain.linearRampToValueAtTime(0.08 * intensity, now + 0.006);
    stoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    stoneOsc.connect(stoneGain);
    stoneGain.connect(out);
    stoneOsc.start(now);
    stoneOsc.stop(now + 0.09);
  }

  /**
   * GRASS: Soft leafy rustle + muffled organic turf compression.
   */
  private synthesizeGrassFootstep(now: number, intensity: number, pitchMod: number, out: AudioNode): void {
    if (!this.ctx) return;

    // 1. Flora rustle noise
    const rustleLen = this.ctx.sampleRate * 0.08;
    const rustleBuffer = this.ctx.createBuffer(1, rustleLen, this.ctx.sampleRate);
    const data = rustleBuffer.getChannelData(0);
    for (let i = 0; i < rustleLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
    }
    const rustleSrc = this.ctx.createBufferSource();
    rustleSrc.buffer = rustleBuffer;

    const rustleFilter = this.ctx.createBiquadFilter();
    rustleFilter.type = 'bandpass';
    rustleFilter.frequency.setValueAtTime(1400 * pitchMod, now);
    rustleFilter.Q.setValueAtTime(1.5, now);

    const rustleGain = this.ctx.createGain();
    rustleGain.gain.setValueAtTime(0.07 * intensity, now);
    rustleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    rustleSrc.connect(rustleFilter);
    rustleFilter.connect(rustleGain);
    rustleGain.connect(out);
    rustleSrc.start(now);

    // 2. Soft turf cushion
    const grassOsc = this.ctx.createOscillator();
    const grassGain = this.ctx.createGain();
    grassOsc.type = 'triangle';
    grassOsc.frequency.setValueAtTime(125 * pitchMod, now);
    grassOsc.frequency.exponentialRampToValueAtTime(45, now + 0.06);

    grassGain.gain.setValueAtTime(0.001, now);
    grassGain.gain.linearRampToValueAtTime(0.06 * intensity, now + 0.005);
    grassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    grassOsc.connect(grassGain);
    grassGain.connect(out);
    grassOsc.start(now);
    grassOsc.stop(now + 0.08);
  }
}
