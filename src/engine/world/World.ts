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

  // Master height generation: Flathead Lake inspired elongated basin (NW to SE), bays, shoreline, ridges
  height(x: number, z: number): number {
    // 1. Elongated Lake Basin (NW to SE orientation: rotated coordinates)
    // Lake center around (15, -35), rotated along 45 degrees
    const u = (x - 15) * 0.7071 + (z - (-35)) * 0.7071;
    const v = -(x - 15) * 0.7071 + (z - (-35)) * 0.7071;

    // Elliptical lake radius: length ~75, width ~38
    const lakeNormDist = Math.hypot(u / 65, v / 32);
    let lakeDepression = 0;
    if (lakeNormDist < 1.1) {
      lakeDepression = Math.pow(Math.max(0, 1 - lakeNormDist / 1.1), 1.8) * 11.5;
    }

    // Kings Point / Peninsula protrusion into the lake on the west
    const peninsulaDist = Math.hypot(x - (-22), z - (-28));
    let peninsulaBump = 0;
    if (peninsulaDist < 18) {
      peninsulaBump = Math.max(0, 1 - peninsulaDist / 18) * 4.5;
    }

    // Wooded Island in southern lake
    const islandDist = Math.hypot(x - 30, z - (-55));
    let islandBump = 0;
    if (islandDist < 14) {
      islandBump = Math.max(0, 1 - islandDist / 14) * 3.8;
    }

    // 2. Rolling Foothills and Pine Ridges (higher on East/North)
    const h1 = Math.sin(x * 0.032) * 3.2 + Math.cos(z * 0.028) * 2.6;
    const h2 = Math.sin((x + z) * 0.015) * 4.8 + Math.cos((x - z) * 0.018) * 3.2;

    // Mountain ridges in East (x > 35) and North (z > 35)
    const eastRidge = x > 30 ? Math.pow((x - 30) * 0.08, 1.6) * 4.5 : 0;
    const northRidge = z > 30 ? Math.pow((z - 30) * 0.08, 1.5) * 3.8 : 0;

    // 3. Lakeside Shoreline and Village Plateau (x: 10..35, z: 5..30)
    const villageRoad = Math.exp(-Math.pow(z - Math.sin(x * 0.03) * 6 - 16, 2) / 24);
    const shorelineGrad = Math.exp(-Math.pow(lakeNormDist - 1.0, 2) / 0.08);

    // Mountain Creek cutting down to the lake
    const creekBed = Math.exp(-Math.pow(z - (-10 + x * 0.35), 2) / 8) * (x > 10 ? 1.8 : 0);

    const rawH = (h1 + h2 + eastRidge + northRidge + peninsulaBump + islandBump) * (1 - villageRoad * 0.5) - lakeDepression - creekBed;

    return rawH;
  }

  // Surface texture / biome classification
  surfaceType(x: number, z: number): 'grass' | 'mud' | 'rock' | 'wood' | 'water' {
    const u = (x - 15) * 0.7071 + (z - (-35)) * 0.7071;
    const v = -(x - 15) * 0.7071 + (z - (-35)) * 0.7071;
    const lakeNormDist = Math.hypot(u / 65, v / 32);

    const h = this.height(x, z);
    if (h <= 0.75) return 'water';
    if (lakeNormDist >= 0.95 && lakeNormDist < 1.15 && h < 2.5) return 'mud'; // sandy beach/mud
    if (Math.abs(z - Math.sin(x * 0.03) * 6 - 16) < 3.2) return 'mud'; // village road
    if (h > 14) return 'rock';
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
  const minX = -95, maxX = 95, minZ = -95, maxZ = 95;
  const step = 5.5;

  for (let x = minX; x <= maxX; x += step) {
    for (let z = minZ; z <= maxZ; z += step) {
      // Noise jitter
      const r1 = hash2(x, z, 101);
      const r2 = hash2(z, x, 202);
      const wx = x + (r1 - 0.5) * step * 0.95;
      const wz = z + (r2 - 0.5) * step * 0.95;

      const wy = world.height(wx, wz);
      // Avoid deep water
      if (wy <= 0.8) continue;

      // Avoid village center and road
      const distToVillage = Math.hypot(wx - 22, wz - 18);
      if (distToVillage < 22) continue;

      // Avoid dock
      const distToDock = Math.hypot(wx - 12, wz - (-14));
      if (distToDock < 10) continue;

      // Avoid road line
      if (Math.abs(wz - Math.sin(wx * 0.03) * 6 - 16) < 4.0) continue;

      const scale = 0.8 + r1 * 0.75;
      trees.push({ x: wx, y: wy, z: wz, scale });
    }
  }

  return trees;
}
