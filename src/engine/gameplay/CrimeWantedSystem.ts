// #09 PLAYER & #23 SECURITY - Crime Reporting, Witness Line-of-Sight, Bounty Contracts & Jail Penalties
import { Vec3, clamp } from '../math';
import {
  BountyContract,
  CrimeRecord,
  CrimeType,
  PlayerStats,
  Vec3Tuple
} from '../../types/game';
import { NPCAgentData } from '../ai/NPCBrain';

export class CrimeWantedSystem {
  public wantedLevel: number = 0; // 0 to 5
  public bountyOnHead: number = 0;
  public crimes: CrimeRecord[] = [];
  public availableContracts: BountyContract[] = [];
  public activeContracts: BountyContract[] = [];

  initContracts(): void {
    this.availableContracts = [
      {
        id: 'contract_silas',
        targetName: 'Silas Blackwood',
        targetType: 'OUTLAW',
        title: 'Wanted: Silas Blackwood (Bandit Chief)',
        description: 'Wanted dead or alive for armed robbery, poaching, and threatening town merchants. Last spotted near the southern rock shelter.',
        rewardGold: 150,
        rewardReputation: 25,
        locationName: 'Bandit Camp Hideout',
        locationPos: [-45, 0, 35],
        dangerLevel: 'HIGH',
        completed: false,
        claimed: false
      },
      {
        id: 'contract_bear',
        targetName: 'Grizzly Bear',
        targetType: 'BEAST',
        title: 'Bounty: The Mountain Grizzly',
        description: 'A massive injured grizzly bear has been mauling cattle and hunting parties in the high peaks. Neutralize it safely.',
        rewardGold: 100,
        rewardReputation: 20,
        locationName: 'High Mountain Pass',
        locationPos: [65, 0, 45],
        dangerLevel: 'DEADLY',
        completed: false,
        claimed: false
      },
      {
        id: 'contract_wolf',
        targetName: 'Timber Wolf',
        targetType: 'BEAST',
        title: 'Cull: Rogue Timber Wolves',
        description: 'A pack of aggressive wolves has established territory near the eastern ridge. Eliminate the alpha timber wolf.',
        rewardGold: 60,
        rewardReputation: 15,
        locationName: 'North-West Timber Ridge',
        locationPos: [-55, 0, -40],
        dangerLevel: 'MEDIUM',
        completed: false,
        claimed: false
      },
      {
        id: 'contract_poacher',
        targetName: 'Rogue Poacher',
        targetType: 'POACHER',
        title: 'Wanted: Illegal Forest Poacher',
        description: 'Trapping rare game in the sacred pines reserve. Apprehend or eliminate the trespasser.',
        rewardGold: 80,
        rewardReputation: 15,
        locationName: 'Pine Basin Thick',
        locationPos: [-25, 0, -10],
        dangerLevel: 'MEDIUM',
        completed: false,
        claimed: false
      }
    ];
  }

  commitCrime(
    type: CrimeType,
    location: Vec3Tuple,
    time: number,
    victimName: string | undefined,
    witnesses: NPCAgentData[],
    player: PlayerStats
  ): { crime: CrimeRecord; newWantedLevel: number } {
    const witnessNames: string[] = [];

    for (const w of witnesses) {
      if (w.name !== victimName && w.hp > 0) {
        witnessNames.push(w.name);
        // Add memory to witness
        w.memories.push({
          id: `crime_${Date.now()}_${Math.random()}`,
          event: `WITNESSED_${type}`,
          location,
          time,
          importance: 0.9,
          confidence: 1,
          participants: ['player', victimName || 'unknown'],
          details: { crimeType: type }
        });

        // Lower relationship trust with player
        const rel = w.relationships.get('player');
        if (rel) {
          rel.trust = Math.max(0, rel.trust - 0.4);
          rel.fear = Math.min(1, rel.fear + 0.5);
          rel.anger = Math.min(1, rel.anger + 0.6);
        }
      }
    }

    const bountyScale: Record<CrimeType, number> = {
      THEFT: 30,
      TRESPASSING: 15,
      POACHING: 40,
      ASSAULT: 60,
      MURDER: 200,
      RESISTING_ARREST: 75
    };

    const bountyInc = bountyScale[type] || 25;
    player.bountyOnHead += bountyInc;

    // Calculate wanted level (0 to 5)
    if (player.bountyOnHead >= 300) player.wantedLevel = 5;
    else if (player.bountyOnHead >= 180) player.wantedLevel = 4;
    else if (player.bountyOnHead >= 100) player.wantedLevel = 3;
    else if (player.bountyOnHead >= 50) player.wantedLevel = 2;
    else if (player.bountyOnHead > 0) player.wantedLevel = 1;
    else player.wantedLevel = 0;

    // Faction reputation impact
    player.reputation.townsfolk = clamp(player.reputation.townsfolk - (type === 'MURDER' ? 50 : 15), -100, 100);
    player.reputation.huntersGuild = clamp(player.reputation.huntersGuild - (type === 'POACHING' ? 35 : 5), -100, 100);
    if (type === 'ASSAULT' || type === 'MURDER') {
      player.reputation.outlaws = clamp(player.reputation.outlaws + 15, -100, 100); // Outlaws respect ruthlessness
    }

    const record: CrimeRecord = {
      id: `crime_${Date.now()}`,
      type,
      location,
      time,
      victim: victimName,
      witnesses: witnessNames,
      reported: witnessNames.length > 0,
      bountyIncrease: bountyInc
    };

    player.crimesCommitted.unshift(record);
    this.crimes.unshift(record);

    return { crime: record, newWantedLevel: player.wantedLevel };
  }

  payBounty(player: PlayerStats): boolean {
    if (player.gold >= player.bountyOnHead) {
      player.gold -= player.bountyOnHead;
      player.bountyOnHead = 0;
      player.wantedLevel = 0;
      return true;
    }
    return false;
  }
}
