import { Vec3 } from '../math';

export interface InteractionTarget {
  id: string;
  type: 'NPC' | 'BOUNTY_BOARD' | 'CHEST' | 'DOOR' | 'CAMPFIRE' | 'SHOP_COUNTER' | 'HORSE' | 'ANIMAL_CARCASS';
  name: string;
  position: Vec3;
  interactionPrompt: string; // e.g. "Talk to Sheriff", "Inspect Bounty Board", "Skin Carcass"
  maxRange: number;
  data?: any;
}

export class InteractionSystem {
  private registeredTargets: Map<string, InteractionTarget> = new Map();
  public activeTarget: InteractionTarget | null = null;
  public interactionCooldown: number = 0;

  public register(target: InteractionTarget): void {
    this.registeredTargets.set(target.id, target);
  }

  public unregister(targetId: string): void {
    this.registeredTargets.delete(targetId);
  }

  public clear(): void {
    this.registeredTargets.clear();
    this.activeTarget = null;
  }

  /**
   * Scans for closest interactive object aligned with player crosshair/view cone.
   */
  public update(playerPos: Vec3, playerYaw: number, playerPitch: number, dt: number): InteractionTarget | null {
    if (this.interactionCooldown > 0) {
      this.interactionCooldown -= dt;
    }

    let closest: InteractionTarget | null = null;
    let closestScore = -Infinity;

    // View direction vector from yaw/pitch
    const forwardX = -Math.sin(playerYaw) * Math.cos(playerPitch);
    const forwardY = Math.sin(playerPitch);
    const forwardZ = -Math.cos(playerYaw) * Math.cos(playerPitch);

    for (const target of this.registeredTargets.values()) {
      const dx = target.position.x - playerPos.x;
      const dy = target.position.y - playerPos.y;
      const dz = target.position.z - playerPos.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist > target.maxRange) continue;

      // Normalize direction to target
      const dirX = dx / (dist || 1);
      const dirY = dy / (dist || 1);
      const dirZ = dz / (dist || 1);

      // Dot product to check angular alignment with player crosshair
      const dot = forwardX * dirX + forwardY * dirY + forwardZ * dirZ;

      // Must be roughly in front of player (FOV cone > 45 deg)
      if (dot < 0.65) continue;

      // Score prioritizes alignment and proximity
      const score = (dot * 2.0) - (dist / target.maxRange);
      if (score > closestScore) {
        closestScore = score;
        closest = target;
      }
    }

    this.activeTarget = closest;
    return closest;
  }

  public triggerInteraction(): InteractionTarget | null {
    if (this.interactionCooldown > 0 || !this.activeTarget) return null;
    this.interactionCooldown = 0.35; // Debounce
    return this.activeTarget;
  }
}
