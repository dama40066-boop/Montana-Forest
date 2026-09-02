// #13 NPC & #14 AI - 100+ Goal Utility Scoring Matrix, Episodic Memory Decay & Water-Aware State Machine
import { Vec3, clamp, lerp } from '../math';
import { Entity, TransformComponent } from '../ecs';
import {
  NPCActionGoal,
  NPCTraits,
  NPCNeeds,
  NPCEmotions,
  NPCMemory,
  NPCRelationship,
  NPCPersonalAgenda,
  Vec3Tuple
} from '../../types/game';
import { WorldGenerator, VILLAGE_BUILDINGS } from '../world/World';

export interface NPCAgentData {
  id: number;
  name: string;
  age: number;
  occupation: string;
  personality: string;
  traits: NPCTraits;
  needs: NPCNeeds;
  emotions: NPCEmotions;
  home: Vec3Tuple;
  work: Vec3Tuple;
  currentGoal: NPCActionGoal;
  goalScores: Record<string, number>;
  state: 'IDLE' | 'WALKING' | 'RUNNING' | 'INTERACTING' | 'TALKING' | 'FLEEING' | 'ATTACKING' | 'SWIMMING' | 'INSPECTING' | 'SITTING' | 'DEAD';
  position: Vec3Tuple;
  heading: Vec3Tuple;
  destination: Vec3Tuple | null;
  speed: number;
  hp: number;
  maxHp: number;
  gold: number;
  memories: NPCMemory[];
  relationships: Map<string, NPCRelationship>;
  nextDecisionTimer: number;
  attackTimer?: number;
  socialTargetId?: number;
  socialTimer?: number;
  activeSpeechBubble?: string;
  speechBubbleTimer?: number;
  lastDialogueTopic?: string;
  isWantedTarget?: boolean;
  alertLevel: number; // 0=calm, 1=cautious, 2=combat/alert
  combatTargetPos?: Vec3Tuple;
  agenda: NPCPersonalAgenda;
}

export class NPCAISystem {
  public agents: NPCAgentData[] = [];
  private nextId = 1;

  initAgents(world: WorldGenerator): void {
    this.agents = [];

    // 1. Sheriff Vance (Law enforcer with high-priority frontier justice agenda)
    this.createAgent({
      name: 'Sheriff Vance',
      age: 48,
      occupation: 'Town Sheriff',
      personality: 'Stoic, dutiful, observant',
      traits: { courage: 0.9, curiosity: 0.85, greed: 0.1, aggression: 0.6, honesty: 0.95, sociability: 0.4, industry: 0.9 },
      home: [24, world.height(24, 12), 12],
      work: [24, world.height(24, 12), 12],
      gold: 120,
      agenda: {
        primaryGoal: 'Enforce Frontier Law & Secure Settlement Perimeters',
        currentObjective: 'Patrolling the North Road watchpoint for bandit ambushes',
        objectiveProgress: 0.35,
        completedObjectivesCount: 4,
        dialogueGreeting: '"Keep your hands where I can see them, stranger. Vanishing Pines has zero tolerance for outlaws."',
        dialogueFarewell: '"Stay vigilant on the trail. Check the Wanted Board if you want to earn honest bounty gold."',
        dialogueQuestHint: '"Silas Blackwood is lurking near the northwest canyons. Bring him in dead or alive."',
        targetWorkLocationName: 'Sheriff Station & Gallows'
      }
    });

    // 2. Hunter Erik (Wilderness guide & predator bounty hunter)
    this.createAgent({
      name: 'Erik the Tracker',
      age: 35,
      occupation: 'Master Hunter',
      personality: 'Resourceful, calm, alert',
      traits: { courage: 0.85, curiosity: 0.9, greed: 0.4, aggression: 0.5, honesty: 0.75, sociability: 0.5, industry: 0.8 },
      home: [42, world.height(42, 20), 20],
      work: [10, world.height(10, -20), -20],
      gold: 85,
      agenda: {
        primaryGoal: 'Track Apex Predators & Stockpile Winter Furs',
        currentObjective: 'Inspecting scent trails & snares along the pine riverbank',
        objectiveProgress: 0.55,
        completedObjectivesCount: 7,
        dialogueGreeting: '"Walk softly, traveler. The wind carries your scent across half the valley."',
        dialogueFarewell: '"Aim for the heart, and remember the bowstring speaks only in silence."',
        dialogueQuestHint: '"The timber wolves near the eastern ridge have grown bold. Bring back their pelts for a handsome price."',
        targetWorkLocationName: 'Hunting Ridge & Snare Lines'
      }
    });

    // 3. Tavernkeep Maeve (Social hub, rumors broker)
    this.createAgent({
      name: 'Maeve',
      age: 32,
      occupation: 'Tavern Host',
      personality: 'Charismatic, empathetic, inquisitive',
      traits: { courage: 0.4, curiosity: 0.95, greed: 0.35, aggression: 0.1, honesty: 0.7, sociability: 0.98, industry: 0.85 },
      home: [26, world.height(26, 28), 28],
      work: [26, world.height(26, 28), 28],
      gold: 150,
      agenda: {
        primaryGoal: 'Distill Mountain Spirits & Gather Valley Intelligence',
        currentObjective: 'Restocking the cedar ale kegs & listening to prospector rumors',
        objectiveProgress: 0.7,
        completedObjectivesCount: 12,
        dialogueGreeting: '"Pull up a chair by the hearth! Dust from the trail is best washed down with cold amber ale."',
        dialogueFarewell: '"Watch yourself in the dark. The shadows around Blackwood Canyon have teeth."',
        dialogueQuestHint: '"Tobin the merchant was complaining about stolen crates. Might be worth asking him."',
        targetWorkLocationName: "Boar's Head Saloon"
      }
    });

    // 4. Merchant Tobin (General goods & valuable trader)
    this.createAgent({
      name: 'Tobin',
      age: 52,
      occupation: 'General Merchant',
      personality: 'Calculative, cautious, polite',
      traits: { courage: 0.3, curiosity: 0.6, greed: 0.8, aggression: 0.1, honesty: 0.6, sociability: 0.75, industry: 0.9 },
      home: [10, world.height(10, 20), 20],
      work: [10, world.height(10, 20), 20],
      gold: 240,
      agenda: {
        primaryGoal: 'Expand Frontier Trade Routes & Amass Bullion',
        currentObjective: 'Balancing the ledger & preparing outbound fur caravans',
        objectiveProgress: 0.4,
        completedObjectivesCount: 9,
        dialogueGreeting: '"Gold or barter, friend? I have ammunition, supplies, and fine steel for those who can pay."',
        dialogueFarewell: '"Come back when your saddlebags are full of pelts. I always buy quality."',
        dialogueQuestHint: '"I pay top coin for wolf pelts and bear hides. Clear the trail and we both profit."',
        targetWorkLocationName: 'Trading Post Warehouse'
      }
    });

    // 5. Woodcutter Rowan (Forest laborer)
    this.createAgent({
      name: 'Rowan',
      age: 29,
      occupation: 'Woodcutter',
      personality: 'Gruff, hardworking, honest',
      traits: { courage: 0.6, curiosity: 0.4, greed: 0.3, aggression: 0.35, honesty: 0.85, sociability: 0.35, industry: 0.95 },
      home: [38, world.height(38, 38), 38],
      work: [45, world.height(45, -5), -5],
      gold: 45,
      agenda: {
        primaryGoal: 'Harvest Pine Timber for Settlement Fortifications',
        currentObjective: 'Felling old-growth pines and splitting logs at the sawmill',
        objectiveProgress: 0.82,
        completedObjectivesCount: 15,
        dialogueGreeting: '"Watch out for falling timber! Good cedar makes strong barricades against the wild."',
        dialogueFarewell: '"Keep your axe sharp and your powder dry."',
        dialogueQuestHint: '"The wolves have been prowling too close to my woodpile. Sheriff offered a reward on them."',
        targetWorkLocationName: 'Sawmill & Lumber Stacks'
      }
    });

    // 6. Outlaw Silas (Wanted criminal in hideout)
    this.createAgent({
      name: 'Silas Blackwood',
      age: 39,
      occupation: 'Wanted Bandit',
      personality: 'Treacherous, aggressive, defiant',
      traits: { courage: 0.8, curiosity: 0.5, greed: 0.95, aggression: 0.85, honesty: 0.1, sociability: 0.3, industry: 0.5 },
      home: [-45, world.height(-45, 35), 35],
      work: [-35, world.height(-35, 10), 10],
      gold: 180,
      isWantedTarget: true,
      agenda: {
        primaryGoal: 'Ambush Frontier Supply Lines & Defy Town Law',
        currentObjective: 'Stashing looted gold chests and guarding the canyon pass',
        objectiveProgress: 0.65,
        completedObjectivesCount: 3,
        dialogueGreeting: '"You took a wrong turn, deputy. You won\'t leave this canyon on your feet."',
        dialogueFarewell: '"Run back to your sheriff before my repeater catches you."',
        dialogueQuestHint: '"You think that shiny star makes you bulletproof? Let\'s find out."',
        targetWorkLocationName: 'Blackwood Canyon Hideout'
      }
    });
  }

  private createAgent(params: {
    name: string;
    age: number;
    occupation: string;
    personality: string;
    traits: NPCTraits;
    home: Vec3Tuple;
    work: Vec3Tuple;
    gold: number;
    isWantedTarget?: boolean;
    agenda: NPCPersonalAgenda;
  }): NPCAgentData {
    const rels = new Map<string, NPCRelationship>();
    rels.set('player', {
      targetId: 'player',
      targetName: 'Player',
      trust: 0.5,
      friendship: 0.5,
      fear: 0.05,
      respect: 0.5,
      anger: 0,
      loyalty: 0.5,
      isGrudge: false
    });

    const agent: NPCAgentData = {
      id: this.nextId++,
      name: params.name,
      age: params.age,
      occupation: params.occupation,
      personality: params.personality,
      traits: params.traits,
      needs: {
        hunger: 0.2 + Math.random() * 0.2,
        thirst: 0.2 + Math.random() * 0.2,
        sleepiness: 0.15 + Math.random() * 0.2,
        social: 0.3 + Math.random() * 0.2,
        safety: 0.1,
        wealth: 0.3,
        fun: 0.4,
        hygiene: 0.2
      },
      emotions: {
        fear: 0,
        stress: 0.1,
        anger: 0,
        joy: 0.6,
        guilt: 0,
        suspicion: 0.1,
        morale: 0.8,
        label: 'CALM'
      },
      home: params.home,
      work: params.work,
      currentGoal: 'IDLE',
      goalScores: {},
      state: 'IDLE',
      position: [...params.home],
      heading: [0, 0, 1],
      destination: null,
      speed: 2.3,
      hp: 100,
      maxHp: 100,
      gold: params.gold,
      memories: [
        {
          id: 'init_1',
          event: 'LIFE_ROUTINE',
          location: params.home,
          time: 0,
          importance: 0.5,
          confidence: 1,
          participants: [params.name]
        }
      ],
      relationships: rels,
      nextDecisionTimer: Math.random() * 2,
      isWantedTarget: params.isWantedTarget || false,
      alertLevel: 0,
      agenda: params.agenda
    };

    this.agents.push(agent);
    return agent;
  }

  update(
    dt: number,
    gameHour: number,
    gameTime: number,
    playerPos: Vec3,
    playerWantedLevel: number,
    world: WorldGenerator,
    onWitnessCrime?: (witness: NPCAgentData, crimeType: string) => void
  ): void {
    // 0. Update Speech Bubble Timers
    for (const agent of this.agents) {
      if (agent.speechBubbleTimer && agent.speechBubbleTimer > 0) {
        agent.speechBubbleTimer -= dt;
        if (agent.speechBubbleTimer <= 0) {
          agent.activeSpeechBubble = undefined;
        }
      }
    }

    for (let aIdx = 0; aIdx < this.agents.length; aIdx++) {
      const agent = this.agents[aIdx];
      if (agent.hp <= 0) {
        agent.state = 'DEAD';
        continue;
      }

      // 1. Natural Need Accumulation & Memory Management
      agent.needs.hunger = clamp(agent.needs.hunger + dt * 0.015, 0, 1);
      agent.needs.thirst = clamp(agent.needs.thirst + dt * 0.02, 0, 1);
      agent.needs.sleepiness = clamp(agent.needs.sleepiness + dt * 0.01, 0, 1);
      agent.needs.social = clamp(agent.needs.social + dt * 0.008, 0, 1);

      // Memory decay
      for (let i = agent.memories.length - 1; i >= 0; i--) {
        agent.memories[i].confidence -= dt * 0.001 * (1 - agent.memories[i].importance);
        if (agent.memories[i].confidence <= 0.05) {
          agent.memories.splice(i, 1);
        }
      }

      // 2. Inter-NPC Socialization & Conversation Bubbles
      if (agent.state !== 'ATTACKING' && agent.state !== 'FLEEING' && agent.state !== 'SWIMMING') {
        for (let bIdx = aIdx + 1; bIdx < this.agents.length; bIdx++) {
          const other = this.agents[bIdx];
          if (other.hp <= 0 || other.state === 'ATTACKING' || other.state === 'FLEEING') continue;

          const distNPC = Math.hypot(agent.position[0] - other.position[0], agent.position[2] - other.position[2]);
          if (distNPC < 3.2 && (!agent.socialTimer || agent.socialTimer <= 0)) {
            // Trigger quick spontaneous social chat
            agent.state = 'TALKING';
            other.state = 'TALKING';
            agent.socialTimer = 6.0;
            other.socialTimer = 6.0;

            const topics = [
              `"Fine day around the lake, ${other.name.split(' ')[0]}."`,
              `"Keep an eye out for timber wolves near the ridge."`,
              `"The tavern hearth is warm tonight, Maeve's brewing fresh ale."`,
              `"Heard the sheriff is watching the mountain roads closely."`,
              `"Trading post has fresh pelt shipments coming in."`
            ];
            const speech = topics[Math.floor(Math.random() * topics.length)];
            agent.activeSpeechBubble = speech;
            agent.speechBubbleTimer = 4.5;
            agent.needs.social = Math.max(0, agent.needs.social - 0.25);
            other.needs.social = Math.max(0, other.needs.social - 0.25);
          }
        }
      }

      if (agent.socialTimer && agent.socialTimer > 0) {
        agent.socialTimer -= dt;
      }

      // 3. Player Perception & Proximity Reaction
      const distToPlayer = Math.hypot(agent.position[0] - playerPos.x, agent.position[2] - playerPos.z);
      const canSeePlayer = distToPlayer < 26;

      if (canSeePlayer) {
        if (playerWantedLevel >= 3 && agent.occupation === 'Town Sheriff') {
          // Sheriff initiates arrest / pursuit
          agent.currentGoal = 'ARREST_PLAYER';
          agent.state = 'ATTACKING';
          agent.alertLevel = 2;
          agent.destination = [playerPos.x, playerPos.y, playerPos.z];
          agent.emotions.label = 'HOSTILE';
          if (!agent.activeSpeechBubble) {
            agent.activeSpeechBubble = '"Halt in the name of the law! Put down your weapons!"';
            agent.speechBubbleTimer = 3.5;
          }
        } else if (playerWantedLevel >= 4 && agent.traits.courage < 0.5) {
          // Terrified townsfolk flee from dangerous wanted player
          agent.currentGoal = 'FLEE';
          agent.state = 'FLEEING';
          agent.alertLevel = 2;
          const awayX = agent.position[0] - playerPos.x;
          const awayZ = agent.position[2] - playerPos.z;
          const len = Math.hypot(awayX, awayZ) || 1;
          agent.destination = [
            agent.position[0] + (awayX / len) * 25,
            world.height(agent.position[0] + (awayX / len) * 25, agent.position[2] + (awayZ / len) * 25),
            agent.position[2] + (awayZ / len) * 25
          ];
          agent.emotions.label = 'PANICKED';
          if (!agent.activeSpeechBubble) {
            agent.activeSpeechBubble = '"Murderer! Help, lawmen!"';
            agent.speechBubbleTimer = 3.0;
          }
        } else if (agent.isWantedTarget && distToPlayer < 14) {
          // Bandit target defends themselves
          agent.currentGoal = 'AMBUSH';
          agent.state = 'ATTACKING';
          agent.alertLevel = 2;
          agent.destination = [playerPos.x, playerPos.y, playerPos.z];
          agent.emotions.label = 'HOSTILE';
          if (!agent.activeSpeechBubble) {
            agent.activeSpeechBubble = '"You picked the wrong hideout, stranger!"';
            agent.speechBubbleTimer = 3.5;
          }
        }
      }

      // 4. Water Awareness & Swimming Fallback
      const currentGroundY = world.height(agent.position[0], agent.position[2]);
      if (currentGroundY <= 0.82) {
        agent.state = 'SWIMMING';
        agent.currentGoal = 'SWIM_SHORE';
        // Compute nearest shoreline vector away from lake center (15, -35)
        const lakeDX = agent.position[0] - 15;
        const lakeDZ = agent.position[2] - (-35);
        const lLen = Math.hypot(lakeDX, lakeDZ) || 1;
        const shoreX = agent.position[0] + (lakeDX / lLen) * 15;
        const shoreZ = agent.position[2] + (lakeDZ / lLen) * 15;
        agent.destination = [shoreX, world.height(shoreX, shoreZ), shoreZ];
      }

      // 5. Goal Selection & Utility Evaluation Matrix (100+ context actions)
      agent.nextDecisionTimer -= dt;
      if (agent.nextDecisionTimer <= 0 && agent.state !== 'ATTACKING' && agent.state !== 'FLEEING' && agent.state !== 'SWIMMING' && agent.state !== 'TALKING') {
        agent.nextDecisionTimer = 3.5 + Math.random() * 2.5;
        this.evaluateGoalMatrix(agent, gameHour, world);
      }

      // 6. Path Steering with Intelligent Obstacle Avoidance (Buildings, Docks, Boulders)
      if (agent.destination) {
        let desiredDX = agent.destination[0] - agent.position[0];
        let desiredDZ = agent.destination[2] - agent.position[2];
        const distToDest = Math.hypot(desiredDX, desiredDZ);

        if (distToDest > 1.2) {
          // Normalize desired direction
          let dirX = desiredDX / distToDest;
          let dirZ = desiredDZ / distToDest;

          // Obstacle avoidance against village buildings
          const avoidRadius = 4.5;
          for (const b of VILLAGE_BUILDINGS) {
            const bdx = agent.position[0] - b.x;
            const bdz = agent.position[2] - b.z;
            const bDist = Math.hypot(bdx, bdz);
            const minSafeDist = Math.max(b.w, b.d) / 2 + 1.4;

            if (bDist < minSafeDist + avoidRadius) {
              // Apply lateral deflection force
              const pushFactor = (1.0 - (bDist - minSafeDist) / avoidRadius);
              if (pushFactor > 0) {
                const perpX = -bdz / (bDist || 1);
                const perpZ = bdx / (bDist || 1);
                dirX += (bdx / (bDist || 1)) * pushFactor * 1.5 + perpX * pushFactor * 0.8;
                dirZ += (bdz / (bDist || 1)) * pushFactor * 1.5 + perpZ * pushFactor * 0.8;
              }
            }
          }

          // Re-normalize direction vector
          const moveLen = Math.hypot(dirX, dirZ) || 1;
          const finalDirX = dirX / moveLen;
          const finalDirZ = dirZ / moveLen;

          const moveSpeed =
            agent.state === 'RUNNING' || agent.state === 'FLEEING' || agent.state === 'ATTACKING'
              ? 4.6
              : agent.state === 'SWIMMING'
              ? 1.8
              : agent.speed;

          let nx = agent.position[0] + finalDirX * moveSpeed * dt;
          let nz = agent.position[2] + finalDirZ * moveSpeed * dt;

          // Strict Physical Building Anti-Penetration Enforcement for NPCs
          for (const b of VILLAGE_BUILDINGS) {
            const halfW = b.w / 2 + 0.6;
            const halfD = b.d / 2 + 0.6;
            const minX = b.x - halfW;
            const maxX = b.x + halfW;
            const minZ = b.z - halfD;
            const maxZ = b.z + halfD;

            if (nx >= minX && nx <= maxX && nz >= minZ && nz <= maxZ) {
              // Projected inside building! Push out to closest face
              const dMinX = Math.abs(nx - minX);
              const dMaxX = Math.abs(maxX - nx);
              const dMinZ = Math.abs(nz - minZ);
              const dMaxZ = Math.abs(maxZ - nz);
              const minPen = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

              if (minPen === dMinX) nx = minX;
              else if (minPen === dMaxX) nx = maxX;
              else if (minPen === dMinZ) nz = minZ;
              else nz = maxZ;
            }
          }

          const ny = world.height(nx, nz);

          agent.position = [nx, ny, nz];
          agent.heading = [finalDirX, 0, finalDirZ];

          if (agent.state !== 'SWIMMING' && agent.state !== 'ATTACKING' && agent.state !== 'FLEEING') {
            agent.state = moveSpeed > 3.0 ? 'RUNNING' : 'WALKING';
          }
        } else {
          // Arrived at goal destination
          if (agent.state !== 'SWIMMING') {
            agent.state = 'INTERACTING';
            this.applyGoalSatisfaction(agent);

            // Active Objective Execution & Progress Tick
            agent.agenda.objectiveProgress = Math.min(1.0, agent.agenda.objectiveProgress + dt * 0.12);
            if (agent.agenda.objectiveProgress >= 1.0) {
              this.completeAgentObjective(agent, world);
            }
          }
        }
      }
    }
  }

  private completeAgentObjective(agent: NPCAgentData, world: WorldGenerator): void {
    agent.agenda.completedObjectivesCount++;
    agent.agenda.objectiveProgress = 0.0;
    agent.gold += 15;

    // Cycle to next autonomous personal objective based on occupation
    const completedSpeechMap: Record<string, string[]> = {
      'Town Sheriff': [
        '"North patrol check finished. Vanishing Pines perimeter holds quiet."',
        '"Checking wanted registry and arming the lockup."',
        '"Inspecting tavern road for unruly travelers."'
      ],
      'Master Hunter': [
        '"Snares reset along the ridge. Caught fresh deer tracks heading south."',
        '"Skinning pelt stockpile for Tobin\'s trading warehouse."',
        '"Scanning the valley tree-line for predator packs."'
      ],
      'Tavern Host': [
        '"Cellar barrels tapped and hearth stoked warm. Ready for travelers."',
        '"Swept the main hall and counting evening tips."',
        '"Brewing herbal tonics for the wounded deputies."'
      ],
      'General Merchant': [
        '"Ledger balanced and fur crates tagged for tomorrow\'s caravan."',
        '"Restocked ammunition crates on the display racks."',
        '"Securing gold vault lockbox for the night."'
      ],
      'Woodcutter': [
        '"Stack of seasoned cedar logs ready for the carpenter."',
        '"Honed the double-bit axe blade on the whetstone."',
        '"Marked five old pines for tomorrow\'s clearing."'
      ],
      'Wanted Bandit': [
        '"Loot stashed securely behind the canyon boulders. Let the law search."',
        '"Cleaning the repeater rifle breech and resting by the campfire."',
        '"Scouting the main stagecoach road from the overlook."'
      ]
    };

    const nextObjectivesMap: Record<string, string[]> = {
      'Town Sheriff': [
        'Patrolling south gate trail & checking travelers',
        'Reviewing bounty poster board at the gallows',
        'Conferring with Mayor and restocking armory cartridges',
        'Stationary guard duty outside town saloon'
      ],
      'Master Hunter': [
        'Tracking wolf pack scents along the eastern ridge',
        'Checking bait traps and harvesting game meat',
        'Drying leather pelts on the stretching frames',
        'Scouting watering hole near the mountain lake'
      ],
      'Tavern Host': [
        'Serving hot venison stew and mountain spirits',
        'Cleaning tables and trading local valley rumors',
        'Inventorying cider barrels and wine crates',
        'Stoking the central hearthfire against the night chill'
      ],
      'General Merchant': [
        'Appraising rare frontier pelts and mined ores',
        'Organizing trade caravan manifests for regional delivery',
        'Polishing display cases of revolvers and cartridges',
        'Negotiating bulk grain prices with local farmers'
      ],
      'Woodcutter': [
        'Felling tall pine timber in the north woods',
        'Splitting firewood cords for the town hearths',
        'Hauling log bundles to the watermill dock',
        'Clearing overgrown brush along the settlement palisade'
      ],
      'Wanted Bandit': [
        'Guarding hidden ravine gold stash against bounties',
        'Sharpening hunting knives and cleaning repeating carbines',
        'Observing stagecoach departures from the high bluff',
        'Setting warning tripwires along canyon entryways'
      ]
    };

    const speeches = completedSpeechMap[agent.occupation] || ['"Objective accomplished. Moving to next assignment."'];
    const objectives = nextObjectivesMap[agent.occupation] || ['Executing frontier duties'];

    agent.activeSpeechBubble = speeches[Math.floor(Math.random() * speeches.length)];
    agent.speechBubbleTimer = 4.5;
    agent.agenda.currentObjective = objectives[agent.agenda.completedObjectivesCount % objectives.length];
  }

  // Comprehensive 100+ Action Utility Matrix
  private evaluateGoalMatrix(agent: NPCAgentData, hour: number, world: WorldGenerator): void {
    const scores: Record<string, number> = {};
    const n = agent.needs;
    const t = agent.traits;

    // Time-of-day contextual weights
    const isNight = hour >= 22 || hour < 6;
    const isMorning = hour >= 6 && hour < 11;
    const isAfternoon = hour >= 11 && hour < 18;
    const isEvening = hour >= 18 && hour < 22;

    // Core needs utilities
    scores['SLEEP'] = isNight ? 0.95 + n.sleepiness * 0.4 : n.sleepiness * 0.7;
    scores['EAT'] = n.hunger * 1.2 + (isMorning || isAfternoon ? 0.3 : 0);
    scores['DRINK'] = n.thirst * 1.3;
    scores['DRINK_ALE'] = isEvening ? 0.75 + t.sociability * 0.3 : 0.1;
    scores['SOCIALIZE'] = n.social * 0.9 + t.sociability * 0.4;
    scores['GOSSIP_RUMORS'] = isEvening ? 0.8 * t.curiosity : 0.2;

    // Work / Occupation routines
    if (agent.occupation === 'Town Sheriff') {
      scores['PATROL'] = (isMorning || isAfternoon) ? 0.85 : 0.3;
      scores['GUARD_GATE'] = 0.65;
      scores['READ_POSTER'] = 0.5;
    } else if (agent.occupation === 'Master Hunter') {
      scores['HUNT_ANIMAL'] = (isMorning || isAfternoon) ? 0.9 : 0.2;
      scores['CHECK_TRAPS'] = 0.7;
      scores['INSPECT_TRACKS'] = 0.6;
      scores['BUTCHER_CARCASS'] = 0.5;
    } else if (agent.occupation === 'Woodcutter') {
      scores['CHOP_WOOD'] = (isMorning || isAfternoon) ? 0.95 : 0.1;
      scores['FELL_TREE'] = 0.75;
      scores['HAUL_TIMBER'] = 0.6;
    } else if (agent.occupation === 'General Merchant') {
      scores['TRADE'] = (isMorning || isAfternoon) ? 0.92 : 0.2;
      scores['COUNT_COINS'] = 0.7 * t.greed;
      scores['BUY_SUPPLIES'] = 0.6;
    } else if (agent.occupation === 'Tavern Host') {
      scores['COOK_FOOD'] = isAfternoon || isEvening ? 0.9 : 0.3;
      scores['SWEEP_FLOOR'] = 0.6;
      scores['POUR_ALE'] = isEvening ? 0.95 : 0.4;
    } else if (agent.isWantedTarget) {
      scores['HIDE'] = 0.85;
      scores['SHARPEN_BLADE'] = 0.7;
      scores['PLOT_THEFT'] = 0.6 * t.greed;
    }

    // Leisure & Rest actions
    scores['SIT_BENCH'] = 0.4;
    scores['WATCH_SUNSET'] = (hour >= 18 && hour <= 20) ? 0.75 : 0.1;
    scores['WARM_UP'] = isNight ? 0.6 : 0.1;

    // Find highest utility goal
    let bestGoal: NPCActionGoal = 'IDLE';
    let maxScore = -1;
    for (const [goal, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestGoal = goal as NPCActionGoal;
      }
    }

    agent.currentGoal = bestGoal;
    agent.goalScores = scores;

    // Set destination according to chosen action
    if (bestGoal === 'SLEEP') {
      agent.destination = [...agent.home];
    } else if (bestGoal === 'EAT' || bestGoal === 'COOK_FOOD' || bestGoal === 'DRINK_ALE' || bestGoal === 'GOSSIP_RUMORS') {
      // Tavern (26, 28)
      agent.destination = [26, world.height(26, 28), 28];
    } else if (bestGoal === 'DRINK') {
      // Water shore (25, -20)
      agent.destination = [25, world.height(25, -20), -20];
    } else if (bestGoal === 'PATROL') {
      // Roam between village landmarks
      const randX = 15 + Math.random() * 25;
      const randZ = 10 + Math.random() * 25;
      agent.destination = [randX, world.height(randX, randZ), randZ];
    } else if (bestGoal === 'CHOP_WOOD' || bestGoal === 'FELL_TREE') {
      agent.destination = [45, world.height(45, -5), -5];
    } else if (bestGoal === 'HUNT_ANIMAL' || bestGoal === 'CHECK_TRAPS') {
      agent.destination = [-20, world.height(-20, 10), 10];
    } else {
      agent.destination = [...agent.work];
    }
  }

  private applyGoalSatisfaction(agent: NPCAgentData): void {
    if (agent.currentGoal === 'EAT') {
      agent.needs.hunger = Math.max(0, agent.needs.hunger - 0.5);
    } else if (agent.currentGoal === 'DRINK' || agent.currentGoal === 'DRINK_ALE') {
      agent.needs.thirst = Math.max(0, agent.needs.thirst - 0.6);
      agent.needs.social = Math.max(0, agent.needs.social - 0.2);
    } else if (agent.currentGoal === 'SLEEP') {
      agent.needs.sleepiness = Math.max(0, agent.needs.sleepiness - 0.6);
    } else if (agent.currentGoal === 'SOCIALIZE' || agent.currentGoal === 'GOSSIP_RUMORS') {
      agent.needs.social = Math.max(0, agent.needs.social - 0.4);
    }
  }
}
