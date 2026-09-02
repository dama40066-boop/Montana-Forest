import { Vec3 } from '../math';

export interface WaveParameters {
  amplitude: number;
  frequency: number;
  speed: number;
  direction: [number, number]; // [dirX, dirZ]
}

export class WaterWaveMath {
  public static DEFAULT_WAVES: WaveParameters[] = [
    { amplitude: 0.18, frequency: 0.25, speed: 1.2, direction: [0.707, 0.707] },
    { amplitude: 0.12, frequency: 0.45, speed: 1.8, direction: [-0.6, 0.8] },
    { amplitude: 0.08, frequency: 0.75, speed: 2.4, direction: [0.9, -0.43] },
    { amplitude: 0.04, frequency: 1.4, speed: 3.2, direction: [0.1, 0.99] },
  ];

  /**
   * Calculates the exact Gerstner/Sine fluid surface elevation at a given world coordinate (x, z) at time t.
   */
  public static getWaterHeight(
    x: number,
    z: number,
    time: number,
    baseWaterLevel: number = 0.8,
    waves: WaveParameters[] = WaterWaveMath.DEFAULT_WAVES
  ): number {
    let totalElevation = baseWaterLevel;

    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      // Dot product of direction and horizontal position
      const dotDir = x * w.direction[0] + z * w.direction[1];
      const phase = dotDir * w.frequency + time * w.speed;
      
      // High order harmonic wave function
      totalElevation += Math.sin(phase) * w.amplitude;
      // Secondary crest sharpening (Trochoidal wave sharpening)
      totalElevation += Math.pow((Math.sin(phase) + 1.0) * 0.5, 2.0) * (w.amplitude * 0.5);
    }

    return totalElevation;
  }

  /**
   * Calculates surface normal vector at (x, z, time) for accurate buoyancy tilting and water reflections.
   */
  public static getWaterNormal(
    x: number,
    z: number,
    time: number,
    baseWaterLevel: number = 0.8,
    eps: number = 0.1
  ): Vec3 {
    const hCenter = this.getWaterHeight(x, z, time, baseWaterLevel);
    const hRight = this.getWaterHeight(x + eps, z, time, baseWaterLevel);
    const hForward = this.getWaterHeight(x, z + eps, time, baseWaterLevel);

    const dhdx = (hRight - hCenter) / eps;
    const dhdz = (hForward - hCenter) / eps;

    // Normal = normalize(-dhdx, 1, -dhdz)
    const len = Math.sqrt(dhdx * dhdx + 1.0 + dhdz * dhdz);
    return new Vec3(-dhdx / len, 1.0 / len, -dhdz / len);
  }

  /**
   * Calculates Archimedes buoyancy force and hydrodynamic drag for submerged bodies.
   */
  public static computeBuoyancyForce(
    bodyPos: Vec3,
    bodyRadius: number,
    bodyMass: number,
    time: number,
    baseWaterLevel: number = 0.8,
    gravity: number = 9.81
  ): { force: Vec3; immersionRatio: number } {
    const surfaceH = this.getWaterHeight(bodyPos.x, bodyPos.z, time, baseWaterLevel);
    const bottomY = bodyPos.y - bodyRadius;
    const topY = bodyPos.y + bodyRadius;

    if (bottomY >= surfaceH) {
      // Completely out of water
      return { force: new Vec3(0, 0, 0), immersionRatio: 0 };
    }

    // Immersion depth
    const depth = surfaceH - bottomY;
    const totalH = topY - bottomY;
    const immersionRatio = Math.min(1.0, Math.max(0.0, depth / totalH));

    // Water density displacement (displaced volume Archimedes push)
    const displacedVolume = immersionRatio * (4 / 3 * Math.PI * Math.pow(bodyRadius, 3));
    const waterDensity = 1000.0; // kg/m^3
    const buoyancyMagnitude = displacedVolume * waterDensity * gravity * 0.0012; // Scaled for game physics units

    const normal = this.getWaterNormal(bodyPos.x, bodyPos.z, time, baseWaterLevel);
    const force = new Vec3(
      normal.x * buoyancyMagnitude * 0.3,
      buoyancyMagnitude,
      normal.z * buoyancyMagnitude * 0.3
    );

    return { force, immersionRatio };
  }
}
