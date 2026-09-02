import { SpatialAudioEngine } from './SpatialAudio';
import { SurfaceAudioManager, SurfaceType, SurfaceFootstepConfig } from './SurfaceAudioManager';
import { WorldGenerator } from '../world/World';

export { SpatialAudioEngine, SurfaceAudioManager };
export type { SurfaceType, SurfaceFootstepConfig };

export class SoundEngine {
  public spatial: SpatialAudioEngine;
  public surfaceAudio: SurfaceAudioManager;

  constructor(world: WorldGenerator) {
    this.spatial = new SpatialAudioEngine();
    this.surfaceAudio = new SurfaceAudioManager(world);
  }

  public async start(): Promise<void> {
    await this.spatial.start();
    const ctx = this.spatial.getAudioContext();
    const sfx = this.spatial.getSfxGain();
    if (ctx && sfx) {
      this.surfaceAudio.init(ctx, sfx);
    }
  }

  public setMasterVolume(val: number): void {
    this.spatial.setMasterVolume(val);
  }
}
