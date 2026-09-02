export type Vec3Tuple = [number, number, number];

export type PlayerStance = 'STANDING' | 'CROUCH' | 'PRONE';

export type WeaponType = 'bow' | 'rifle' | 'revolver' | 'shotgun' | 'melee';

export interface WeaponDefinition {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  magSize: number;
  reloadTime: number; // in seconds
  fireRate: number; // minimum seconds between shots
  range: number; // max effective range in meters
  ammoId: string; // id in inventory for ammo
  ammoName: string;
  recoil: number;
  zoomFov: number; // in degrees for ADS
  pelletCount?: number; // for shotgun spread
  icon: string;
  description: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  hunger: number; // 0 to 100
  maxHunger: number; // 100
  thirst: number; // 0 to 100
  maxThirst: number; // 100
  isStarving: boolean;
  isDehydrated: boolean;
  gold: number;
  reputation: {
    townsfolk: number;
    huntersGuild: number;
    outlaws: number;
    forestWardens: number;
  };
  wantedLevel: number; // 0 to 5
  bountyOnHead: number;
  crimesCommitted: CrimeRecord[];
  activeContracts: BountyContract[];
  inventory: InventoryItem[];
  equippedWeapon: string; // weapon id
  magAmmo: Record<string, number>; // current loaded ammo in weapon magazine
  isAiming: boolean; // ADS active
  isReloading: boolean;
  reloadProgress: number; // 0.0 to 1.0
  recoilKick: number;
  arrows: number; // legacy backward compatibility
  stance: PlayerStance;
  oxygen: number; // 0 to 100 breath level for diving
  maxOxygen: number;
  isSwimming: boolean;
  isUnderwater: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'weapon' | 'ammo' | 'consumable' | 'material' | 'valuable' | 'contract';
  count: number;
  value: number;
  description: string;
  icon: string;
  stats?: {
    damage?: number;
    heal?: number;
    stamina?: number;
    durability?: number;
    hunger?: number;
    thirst?: number;
  };
}

export type CrimeType = 'THEFT' | 'TRESPASSING' | 'POACHING' | 'ASSAULT' | 'MURDER' | 'RESISTING_ARREST';

export interface CrimeRecord {
  id: string;
  type: CrimeType;
  location: Vec3Tuple;
  time: number;
  victim?: string;
  witnesses: string[];
  reported: boolean;
  bountyIncrease: number;
}

export interface BountyContract {
  id: string;
  targetName: string;
  targetType: 'OUTLAW' | 'BEAST' | 'POACHER' | 'THIEF';
  title: string;
  description: string;
  rewardGold: number;
  rewardReputation: number;
  locationName: string;
  locationPos: Vec3Tuple;
  dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'DEADLY';
  completed: boolean;
  claimed: boolean;
}

export type NPCActionGoal =
  | 'IDLE'
  | 'WORK'
  | 'EAT'
  | 'SLEEP'
  | 'DRINK'
  | 'SOCIALIZE'
  | 'HUNT_ANIMAL'
  | 'INVESTIGATE'
  | 'FLEE'
  | 'HIDE'
  | 'HELP'
  | 'WARN'
  | 'SEARCH'
  | 'TRAVEL'
  | 'PROTECT'
  | 'STEAL'
  | 'REPORT_CRIME'
  | 'SEEK_REVENGE'
  | 'FIND_TARGET'
  | 'AVOID_DANGER'
  | 'RESCUE'
  | 'REST'
  | 'TRADE'
  | 'GATHER_RESOURCES'
  | 'PATROL'
  | 'ARREST_PLAYER'
  | 'BUTCHER_CARCASS'
  | 'CHOP_WOOD'
  | 'FORAGE_HERBS'
  | 'COOK_FOOD'
  | 'DRINK_ALE'
  | 'GOSSIP_RUMORS'
  | 'SURRENDER'
  | 'AMBUSH'
  | 'SET_CAMPFIRE'
  | 'TEND_WOUNDS'
  | 'GUARD_GATE'
  | 'BRIBE'
  | 'FISH'
  | 'PRAY'
  | 'COLLECT_BOUNTY'
  | 'STALK_PREY'
  | 'CALL_REINFORCEMENTS'
  | 'INSPECT_TRACKS'
  | 'SWIM_SHORE'
  | 'WARM_UP'
  | 'OBSERVE_STARS'
  | 'SHARPEN_BLADE'
  | 'TEND_GARDEN'
  | 'SWEEP_FLOOR'
  | 'READ_POSTER'
  | 'CRAFT_ARROW'
  | 'DRINK_WELL'
  | 'WASH_FACE'
  | 'FEED_DOG'
  | 'SELL_PELTS'
  | 'BUY_SUPPLIES'
  | 'BOAST_FEATS'
  | 'WHISPER_SECRET'
  | 'GAMBLE'
  | 'PLAY_FLUTE'
  | 'SIT_BENCH'
  | 'WATCH_SUNSET'
  | 'CHECK_TRAPS'
  | 'FELL_TREE'
  | 'HAUL_TIMBER'
  | 'CARVE_WOOD'
  | 'FETCH_WATER'
  | 'LIGHT_LANTERN'
  | 'EXTINGUISH_FIRE'
  | 'COUNT_COINS'
  | 'HIDE_LOOT'
  | 'CONFRONT_SUSPECT'
  | 'BEG_MERCY'
  | 'TAUNT_ENEMY'
  | 'BANDAGE_ALLY'
  | 'SOUND_ALARM'
  | 'LOCK_DOOR'
  | 'PEEK_WINDOW'
  | 'FOLLOW_LEADER'
  | 'SCAVENGE'
  | 'BURY_CORPSE'
  | 'HONOR_FALLEN'
  | 'DANCE_TAVERN'
  | 'BREW_POTION'
  | 'REPAIR_ROOF'
  | 'BUILD_FENCE'
  | 'SMOKE_PIPE'
  | 'TELL_TALE'
  | 'ARGUE'
  | 'MAKE_AMENDS'
  | 'PLOT_THEFT'
  | 'BLACKMAIL'
  | 'PAY_FINE'
  | 'SERVE_JAIL'
  | 'ESCAPE_CELL'
  | 'MEDITATE'
  | 'PRACTICE_ARCHERY'
  | 'DUEL_PRACTICE'
  | 'TRACK_SCENT'
  | 'STALK_PLAYER'
  | 'REST_BY_LAKE';

export interface NPCTraits {
  courage: number;     // 0=coward, 1=hero
  curiosity: number;   // 0=indifferent, 1=detective
  greed: number;       // 0=altruist, 1=mercenary
  aggression: number;  // 0=pacifist, 1=bloodthirsty
  honesty: number;     // 0=deceitful, 1=saintly
  sociability: number; // 0=hermit, 1=chatterbox
  industry: number;    // 0=slacker, 1=workaholic
}

export interface NPCNeeds {
  hunger: number;     // 0=full, 1=starving
  thirst: number;     // 0=quenched, 1=parched
  sleepiness: number; // 0=energetic, 1=exhausted
  social: number;     // 0=satisfied, 1=lonely
  safety: number;     // 0=safe, 1=endangered
  wealth: number;     // 0=rich, 1=broke
  fun: number;        // 0=entertained, 1=bored
  hygiene: number;    // 0=clean, 1=filthy
}

export interface NPCEmotions {
  fear: number;
  stress: number;
  anger: number;
  joy: number;
  guilt: number;
  suspicion: number;
  morale: number;
  label: 'CALM' | 'AFRAID' | 'PANICKED' | 'ANGRY' | 'SUSPICIOUS' | 'JOYFUL' | 'EXHAUSTED' | 'HOSTILE';
}

export interface NPCMemory {
  id: string;
  event: string;
  location: Vec3Tuple;
  time: number;
  importance: number;
  confidence: number;
  participants: string[];
  details?: Record<string, unknown>;
}

export interface NPCRelationship {
  targetId: string;
  targetName: string;
  trust: number;
  friendship: number;
  fear: number;
  respect: number;
  anger: number;
  loyalty: number;
  isGrudge: boolean;
}

export interface NPCPersonalAgenda {
  primaryGoal: string;
  currentObjective: string;
  objectiveProgress: number; // 0.0 to 1.0 (0% to 100%)
  completedObjectivesCount: number;
  dialogueGreeting: string;
  dialogueFarewell: string;
  dialogueQuestHint: string;
  targetWorkLocationName: string;
}

export interface AnimalEntityData {
  id: number;
  species: 'DEER' | 'WOLF' | 'BOAR' | 'BEAR' | 'RABBIT';
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  state: 'GRAZING' | 'ALERT' | 'FLEEING' | 'STALKING' | 'ATTACKING' | 'DRINKING' | 'DEAD';
  fleeTarget?: Vec3Tuple;
  attackTarget?: string;
  meatYield: number;
  peltType: string;
  harvested: boolean;
}
