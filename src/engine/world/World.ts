import { Vec3, clamp } from '../math';

export function hash2(x: number, z: number, seed: number = 91731): number {
  let n = (Math.floor(x) * 374761393 + Math.floor(z) * 668265263 + seed * 1447) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

export class WorldGenerator {
  public seed: number = 91731;
  public readonly waterHeight: number = 0.72;

  // Master height generation: Smooth leveled town plateau + Flathead Lake basin + Natural Mountain Ridges
  height(x: number, z: number): number {
    // 1. Dedicated Leveled Town Plateau around (x: 24, z: 20)
    const townCenterX = 24;
    const townCenterZ = 20;
    const townDist = Math.hypot(x - townCenterX, z - townCenterZ);
    const townRadiusInner = 36;
    const townRadiusOuter = 58;
    const targetTownHeight = 2.85;

    // 2. Elongated Lake Basin (NW to SE orientation)
    // Lake center around (15, -45), rotated along 45 degrees
    const u = (x - 15) * 0.7071 + (z - (-45)) * 0.7071;
    const v = -(x - 15) * 0.7071 + (z - (-45)) * 0.7071;

    // Elliptical lake radius: length ~110, width ~55
    const lakeNormDist = Math.hypot(u / 95, v / 48);
    let lakeDepression = 0;
    if (lakeNormDist < 1.25) {
      lakeDepression = Math.pow(Math.max(0, 1 - lakeNormDist / 1.25), 1.7) * 12.0;
    }

    // Kings Point / Peninsula protrusion into the lake on the west
    const peninsulaDist = Math.hypot(x - (-22), z - (-32));
    let peninsulaBump = 0;
    if (peninsulaDist < 22) {
      peninsulaBump = Math.max(0, 1 - peninsulaDist / 22) * 4.2;
    }

    // Wooded Island in southern lake
    const islandDist = Math.hypot(x - 30, z - (-65));
    let islandBump = 0;
    if (islandDist < 18) {
      islandBump = Math.max(0, 1 - islandDist / 18) * 3.6;
    }

    // 3. Gentle Rolling Foothills & Distant Majestic Mountains
    const h1 = Math.sin(x * 0.024) * 2.8 + Math.cos(z * 0.022) * 2.4;
    const h2 = Math.sin((x + z) * 0.012) * 4.2 + Math.cos((x - z) * 0.014) * 3.0;

    // Distant Mountain ridges in East (x > 45), North (z > 45), and Northwest
    const eastRidge = x > 35 ? Math.pow((x - 35) * 0.06, 1.6) * 6.5 : 0;
    const northRidge = z > 35 ? Math.pow((z - 35) * 0.06, 1.6) * 5.8 : 0;
    const westMountains = x < -45 ? Math.pow((-45 - x) * 0.06, 1.5) * 6.2 : 0;
    const southHills = z < -85 ? Math.pow((-85 - z) * 0.05, 1.5) * 7.0 : 0;

    // Mountain Creek cutting down to the lake
    const creekBed = Math.exp(-Math.pow(z - (-18 + x * 0.3), 2) / 12) * (x > 15 ? 1.6 : 0);

    const naturalHeight = (h1 + h2 + eastRidge + northRidge + westMountains + southHills + peninsulaBump + islandBump + 2.5) - lakeDepression - creekBed;

    // 4. Smooth Town Flattening Blend (Hermite Smoothstep)
    if (townDist < townRadiusInner) {
      return targetTownHeight;
    } else if (townDist < townRadiusOuter) {
      const t = (townDist - townRadiusInner) / (townRadiusOuter - townRadiusInner);
      const smoothT = t * t * (3 - 2 * t);
      return targetTownHeight * (1 - smoothT) + naturalHeight * smoothT;
    }

    return naturalHeight;
  }

  // Surface texture / biome classification
  surfaceType(x: number, z: number, y?: number): 'grass' | 'mud' | 'dirt' | 'rock' | 'wood' | 'water' | 'snow' {
    const townDist = Math.hypot(x - 24, z - 20);
    const h = this.height(x, z);
    const checkY = typeof y === 'number' ? y : h;

    if (checkY <= this.waterHeight + 0.38) return 'water';

    // Timber dock
    if (Math.abs(x - 12) <= 3.2 && z >= -22 && z <= -6) return 'wood';

    // High elevation snow peaks & mountain ridges
    if (h >= 9.2 || (z > 38 && h > 6.8) || (x > 38 && h > 7.0) || (x < -42 && h > 7.0)) {
      return 'snow';
    }

    // Dirt road / Campsite
    if ((townDist < 42 && Math.abs(z - 20) < 4.2) || Math.hypot(x - (-6), z - 2) < 7.0) {
      return 'dirt';
    }

    if (townDist < 28) return 'grass';
    if (h > 11.5) return 'rock';
    return 'grass';
  }
}

export interface BuildingDef {
  name: string;
  type: 'sheriff' | 'tavern' | 'shop' | 'lodge' | 'cabin' | 'hideout' | 'dock' | 'mill';
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: [number, number, number];
  roofColor: [number, number, number];
}

export const VILLAGE_BUILDINGS: BuildingDef[] = [
  { name: "Sheriff's Office & Jail", type: 'sheriff', x: 22, z: 12, w: 8, d: 7, h: 3.5, color: [0.35, 0.25, 0.18], roofColor: [0.22, 0.14, 0.1] },
  { name: 'Lakeside Hearth Tavern', type: 'tavern', x: 25, z: 26, w: 12, d: 9, h: 4.2, color: [0.42, 0.18, 0.12], roofColor: [0.18, 0.12, 0.08] },
  { name: 'Lakeside Trading Post', type: 'shop', x: 10, z: 18, w: 7, d: 6, h: 3.2, color: [0.38, 0.28, 0.2], roofColor: [0.25, 0.18, 0.12] },
  { name: "Hunter's Guild Lodge", type: 'lodge', x: 38, z: 18, w: 9, d: 7, h: 3.6, color: [0.28, 0.32, 0.22], roofColor: [0.15, 0.2, 0.12] },
  { name: "Woodcutter's Sawmill", type: 'mill', x: 35, z: 36, w: 7, d: 6, h: 3.0, color: [0.3, 0.22, 0.15], roofColor: [0.2, 0.15, 0.1] },
  { name: 'Lake Timber Dock & Pier', type: 'dock', x: 12, z: -14, w: 5, d: 14, h: 1.2, color: [0.28, 0.2, 0.12], roofColor: [0.25, 0.18, 0.1] },
  { name: 'Kings Point Cabin', type: 'cabin', x: -20, z: -25, w: 6, d: 5, h: 2.8, color: [0.32, 0.24, 0.16], roofColor: [0.2, 0.14, 0.1] },
  { name: 'Bandit Ridge Hideout', type: 'hideout', x: -42, z: 32, w: 7, d: 6, h: 2.9, color: [0.2, 0.2, 0.2], roofColor: [0.12, 0.12, 0.12] }
];

export interface TreeData {
  x: number;
  y: number;
  z: number;
  scale: number;
}

export function generatePineForest(world: WorldGenerator): TreeData[] {
  const trees: TreeData[] = [];
  const minX = -150, maxX = 150, minZ = -150, maxZ = 150;
  const step = 5.8;

  for (let x = minX; x <= maxX; x += step) {
    for (let z = minZ; z <= maxZ; z += step) {
      // Noise jitter
      const r1 = hash2(x, z, 101);
      const r2 = hash2(z, x, 202);
      const wx = x + (r1 - 0.5) * step * 0.92;
      const wz = z + (r2 - 0.5) * step * 0.92;

      const wy = world.height(wx, wz);
      // Avoid deep water
      if (wy <= 0.85) continue;

      // Avoid village center and road
      const distToVillage = Math.hypot(wx - 24, wz - 20);
      if (distToVillage < 28) continue;

      // Avoid dock
      const distToDock = Math.hypot(wx - 12, wz - (-14));
      if (distToDock < 14) continue;

      // Avoid main street axis
      if (distToVillage < 45 && Math.abs(wz - 20) < 4.5) continue;

      const scale = 0.85 + r1 * 0.8;
      trees.push({ x: wx, y: wy, z: wz, scale });
    }
  }

  return trees;
}
