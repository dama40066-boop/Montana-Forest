import { Vec3 } from '../math';
import { NPCAgentData } from './NPCBrain';

export interface BountyTarget {
  id: string;
  name: string;
  lastKnownPos: Vec3;
  crimeRating: number; // Wanted level 1-5
  isHostile: boolean;
}

export type HunterTactics = 'TRACKING' | 'STALKING' | 'AMBUSH' | 'ENGAGING' | 'TAKING_COVER' | 'RETREAT';

export class BountyHunterAI {
  public tacticsState: HunterTactics = 'TRACKING';
  public currentTarget: BountyTarget | null = null;
  public searchRadius: number = 80;
  public combatDistanceMin: number = 6;
  public combatDistanceMax: number = 22;
  public reactionTimer: number = 0;
  public ambushWaypoint: Vec3 | null = null;
  public accuracyMod: number = 0.85;

  constructor(public agentId: string, public hunterRank: 'DEPUTY' | 'VETERAN_HUNTER' | 'MARSHAL' = 'VETERAN_HUNTER') {
    if (hunterRank === 'MARSHAL') {
      this.searchRadius = 120;
      this.accuracyMod = 0.95;
    } else if (hunterRank === 'DEPUTY') {
      this.searchRadius = 60;
      this.accuracyMod = 0.75;
    }
  }

  /**
   * Evaluates tactical environment and decides action cycle against player or criminal targets.
   */
  public updateTactics(
    hunterAgent: NPCAgentData,
    targetPos: Vec3,
    targetWantedStars: number,
    hasLineOfSight: boolean,
    dt: number
  ): {
    desiredHeading: Vec3;
    wantsToShoot: boolean;
    recommendedState: 'WALKING' | 'RUNNING' | 'ATTACKING' | 'IDLE';
    dialogueShout?: string;
  } {
    const hunterPos = new Vec3(hunterAgent.position[0], hunterAgent.position[1], hunterAgent.position[2]);
    const distToTarget = Math.hypot(targetPos.x - hunterPos.x, targetPos.z - hunterPos.z);

    // If target has no crimes or bounty, stand down
    if (targetWantedStars <= 0) {
      this.tacticsState = 'TRACKING';
      return {
        desiredHeading: new Vec3(hunterAgent.heading[0], 0, hunterAgent.heading[2]),
        wantsToShoot: false,
        recommendedState: 'WALKING'
      };
    }

    const dirToTarget = new Vec3(
      (targetPos.x - hunterPos.x) / (distToTarget || 1),
      0,
      (targetPos.z - hunterPos.z) / (distToTarget || 1)
    );

    this.reactionTimer += dt;

    // Tactical State Machine
    if (distToTarget > this.searchRadius) {
      this.tacticsState = 'TRACKING';
      return {
        desiredHeading: dirToTarget,
        wantsToShoot: false,
        recommendedState: 'WALKING'
      };
    }

    if (distToTarget > this.combatDistanceMax) {
      this.tacticsState = 'STALKING';
      return {
        desiredHeading: dirToTarget,
        wantsToShoot: false,
        recommendedState: 'RUNNING',
        dialogueShout: this.reactionTimer > 4 ? "There's the fugitive! Close in!" : undefined
      };
    }

    if (distToTarget < this.combatDistanceMin) {
      // Backpedal to maintain ideal rifle/revolver range
      this.tacticsState = 'ENGAGING';
      const backpedalDir = new Vec3(-dirToTarget.x, 0, -dirToTarget.z);
      return {
        desiredHeading: backpedalDir,
        wantsToShoot: hasLineOfSight,
        recommendedState: 'RUNNING',
        dialogueShout: "Drop your iron and surrender to the Law!"
      };
    }

    // Optimal combat engagement window
    this.tacticsState = 'ENGAGING';
    return {
      desiredHeading: dirToTarget,
      wantsToShoot: hasLineOfSight,
      recommendedState: 'ATTACKING',
      dialogueShout: Math.random() < 0.05 ? "Wanted Dead or Alive!" : undefined
    };
  }
}
