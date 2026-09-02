// #03 RENDERING - Procedural PBR Texture Map Generator (Albedo, Tangent-Space Normal, ORM Metallic/Roughness/AO)
import * as BABYLON from '@babylonjs/core';

export interface PBRTextureSet {
  albedo: BABYLON.RawTexture;
  normal: BABYLON.RawTexture;
  orm: BABYLON.RawTexture; // Red: AO, Green: Roughness, Blue: Metallic
}

// Deterministic fast pseudo-random noise & gradient helpers
function hash2d(x: number, y: number, seed: number = 1337): number {
  let n = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + seed * 1447) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number = 1337): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Cubic Hermite spline
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const n00 = hash2d(ix, iy, seed);
  const n10 = hash2d(ix + 1, iy, seed);
  const n01 = hash2d(ix, iy + 1, seed);
  const n11 = hash2d(ix + 1, iy + 1, seed);

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

function fbm(x: number, y: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0, seed: number = 1337): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += smoothNoise(x * frequency, y * frequency, seed + i * 31) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue;
}

// Voronoi Cellular Noise for stone fractures and mud clods
function voronoi(x: number, y: number, seed: number = 1337): { dist1: number; dist2: number; cellId: number } {
  const ix = Math.floor(x);
  const iy = Math.floor(y);

  let minDist1 = 999.0;
  let minDist2 = 999.0;
  let closestCellId = 0;

  for (let gOffset_y = -1; gOffset_y <= 1; gOffset_y++) {
    for (let gOffset_x = -1; gOffset_x <= 1; gOffset_x++) {
      const neighborX = ix + gOffset_x;
      const neighborY = iy + gOffset_y;

      const px = neighborX + hash2d(neighborX, neighborY, seed);
      const py = neighborY + hash2d(neighborX, neighborY, seed + 99);

      const dx = px - x;
      const dy = py - y;
      const dist = Math.hypot(dx, dy);

      if (dist < minDist1) {
        minDist2 = minDist1;
        minDist1 = dist;
        closestCellId = hash2d(neighborX, neighborY, seed + 123);
      } else if (dist < minDist2) {
        minDist2 = dist;
      }
    }
  }

  return { dist1: minDist1, dist2: minDist2, cellId: closestCellId };
}

// Convert a scalar heightmap into a tangent-space normal map using 3x3 Sobel filtering
function heightToNormalMap(
  heights: Float32Array,
  width: number,
  height: number,
  strength: number = 2.5
): Uint8Array {
  const normals = new Uint8Array(width * height * 4);

  const getH = (x: number, y: number) => {
    const wx = (x + width) % width;
    const wy = (y + height) % height;
    return heights[wy * width + wx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 3x3 Sobel operator for smooth gradient estimation
      const tl = getH(x - 1, y - 1);
      const t  = getH(x,     y - 1);
      const tr = getH(x + 1, y - 1);
      const l  = getH(x - 1, y);
      const r  = getH(x + 1, y);
      const bl = getH(x - 1, y + 1);
      const b  = getH(x,     y + 1);
      const br = getH(x + 1, y + 1);

      // dx = (tr + 2*r + br) - (tl + 2*l + bl)
      const dX = ((tr + 2 * r + br) - (tl + 2 * l + bl)) * strength;
      // dy = (bl + 2*b + br) - (tl + 2*t + tr)
      const dY = ((bl + 2 * b + br) - (tl + 2 * t + tr)) * strength;

      // Normal vector in tangent space: (-dX, -dY, 1.0)
      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;

      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * width + x) * 4;
      normals[idx + 0] = Math.round((nx * 0.5 + 0.5) * 255); // R = X
      normals[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255); // G = Y (OpenGL convention)
      normals[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255); // B = Z
      normals[idx + 3] = 255; // Alpha
    }
  }

  return normals;
}

export class PBRTextureGenerator {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Nano Banana Pro Ultra-Fidelity Timber & Cedar Wood Generator
   * Features: Micro-fibrous wood grain, knot rings, aged varnish patina, bevelled plank joints, high dynamic range normals & satin sheen
   */
  generateNanoBananaProWoodPBR(size: number = 512, plankCount: number = 6): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Plank edge divisions with beveling
        const plankPos = (v * plankCount) % 1.0;
        const plankEdgeDist = Math.min(plankPos, 1.0 - plankPos);
        const isPlankSeam = plankEdgeDist < (2.0 / size);
        const seamFactor = Math.max(0, 1.0 - plankEdgeDist / 0.04);

        // High-octave wood grain fibers & turbulence
        const baseGrain = fbm(u * 32.0 + fbm(u * 6.0, v * 0.8, 3, 0.5, 2.0, 311) * 3.5, v * 2.0, 5, 0.55, 2.3, 108);
        const microFiber = smoothNoise(u * 128.0, v * 8.0, 421) * 0.18;

        // Multi-knot whorls with radial grain distortion
        const k1 = Math.hypot((u - 0.28) * 3.2, (v - 0.35) * 8.0);
        const k2 = Math.hypot((u - 0.72) * 2.8, (v - 0.82) * 9.0);
        const knot1 = Math.sin(k1 * 40.0) * Math.exp(-k1 * 4.2);
        const knot2 = Math.sin(k2 * 36.0) * Math.exp(-k2 * 3.8);

        const composite = baseGrain * 0.65 + microFiber + knot1 * 0.28 + knot2 * 0.22;

        // Warm aged cedar & golden walnut albedo
        const baseR = 158 + composite * 55 - seamFactor * 65;
        const baseG = 104 + composite * 40 - seamFactor * 52;
        const baseB = 62 + composite * 26 - seamFactor * 42;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(baseR)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
        albedoData[idx + 3] = 255;

        // High dynamic range height
        let h = composite * 0.5 - seamFactor * 0.9;
        if (isPlankSeam) h -= 0.8;
        heightMap[hIdx] = h;

        // Nano Banana Pro ORM: Satin polished varnish with deep crevice AO
        const ao = Math.round(Math.max(25, (1.0 - seamFactor * 0.85 - (1.0 - composite) * 0.2) * 255));
        const roughness = Math.round(Math.max(60, Math.min(235, (0.52 + (1.0 - composite) * 0.28 + seamFactor * 0.15) * 255)));
        const metallic = Math.round(Math.min(20, knot1 > 0 ? knot1 * 30 : 0)); // Subtle amber resin sheen

        ormData[idx + 0] = ao;
        ormData[idx + 1] = roughness;
        ormData[idx + 2] = metallic;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 3.6);
    return this.createTextureSet('nano_pro_wood', albedoData, normalData, ormData, size, size);
  }

  /**
   * Nano Banana Pro Ultra-Fidelity Mountain Granite & Slate
   */
  generateNanoBananaProStonePBR(size: number = 512): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        const v1 = voronoi(u * 7.0, v * 7.0, 619);
        const fractureBorder = Math.max(0, 1.0 - (v1.dist2 - v1.dist1) * 8.0);

        const macroCrags = fbm(u * 5.0, v * 5.0, 6, 0.52, 2.1, 882);
        const microPitted = smoothNoise(u * 64.0, v * 64.0, 314) * 0.2;
        const quartzVein = Math.exp(-Math.pow(Math.sin((u + v * 0.8) * 12.0 + macroCrags * 2.5), 2) / 0.03) * 0.5;
        const mossPatch = Math.max(0, smoothNoise(u * 4.0, v * 4.0, 999) - 0.65) * 2.5;

        const rockH = macroCrags * 0.65 + v1.dist1 * 0.35 - fractureBorder * 0.7 + quartzVein * 0.35;
        heightMap[hIdx] = rockH;

        // Rich slate, quartz & alpine moss hues
        let r = 115 + macroCrags * 50 - fractureBorder * 45 + quartzVein * 85 - mossPatch * 30;
        let g = 118 + macroCrags * 48 - fractureBorder * 45 + quartzVein * 85 + mossPatch * 25;
        let b = 125 + macroCrags * 55 - fractureBorder * 45 + quartzVein * 90 - mossPatch * 35;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        albedoData[idx + 3] = 255;

        const ao = Math.round(Math.max(20, (1.0 - fractureBorder * 0.85) * 255));
        const roughness = Math.round(Math.max(50, Math.min(245, (0.68 - quartzVein * 0.4 + microPitted * 0.15 + mossPatch * 0.18) * 255)));
        const metallic = Math.round(Math.min(65, quartzVein * 95)); // Crystalline quartz reflection

        ormData[idx + 0] = ao;
        ormData[idx + 1] = roughness;
        ormData[idx + 2] = metallic;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 4.8);
    return this.createTextureSet('nano_pro_stone', albedoData, normalData, ormData, size, size);
  }

  /**
   * Nano Banana Pro Swirling Damascus & Blued Gunmetal PBR
   */
  generateNanoBananaProDamascusMetalPBR(size: number = 512): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Swirling Damascus folded steel pattern
        const swirl = Math.sin(u * 28.0 + Math.sin(v * 16.0 + u * 8.0) * 4.0 + fbm(u * 8.0, v * 8.0, 4, 0.5, 2.0, 771) * 3.0);
        const microScratches = smoothNoise(u * 128.0, v * 4.0, 902) * 0.12;
        const brassFiligree = Math.exp(-Math.pow(Math.sin((u * 4.0 + v * 4.0) * Math.PI * 2.0), 2) / 0.05) * 0.4;

        const h = swirl * 0.3 + microScratches + brassFiligree * 0.2;
        heightMap[hIdx] = h;

        // Gunmetal blued steel with brass gold filigree highlights
        let r = 42 + swirl * 20 + brassFiligree * 160;
        let g = 44 + swirl * 20 + brassFiligree * 125;
        let b = 54 + swirl * 25 + brassFiligree * 35;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        albedoData[idx + 3] = 255;

        // Ultra high metallic with silky smooth anisotropic roughness
        ormData[idx + 0] = 240; // High AO
        ormData[idx + 1] = Math.round(Math.max(40, Math.min(180, (0.24 + (1.0 - swirl) * 0.15 + microScratches * 0.3) * 255)));
        ormData[idx + 2] = Math.round(245); // Highly Metallic steel/brass
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.6);
    return this.createTextureSet('nano_pro_damascus', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a realistic PBR Timber Wood Texture Set
   * - Albedo: Warm natural lumber color with wood rings, elongated fibers, plank seams, and subtle grain variations
   * - Normal: Micro-groove ridges along timber grain, knot rings, and bevelled plank joins
   * - ORM: Roughness ~0.60-0.85 (smoother on planar lumber, rougher in fissures), Metallic = 0.0, AO = deep crevices
   */
  generateWoodPlankPBR(size: number = 256, plankCount: number = 4): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Plank separation lines
        const plankPos = (v * plankCount) % 1.0;
        const plankEdgeDist = Math.min(plankPos, 1.0 - plankPos);
        const isPlankSeam = plankEdgeDist < (2.2 / size);
        const seamFactor = Math.max(0, 1.0 - plankEdgeDist / 0.05);

        // Elongated longitudinal wood grain
        const grainNoise = fbm(u * 18.0 + fbm(u * 4.0, v * 0.5, 2, 0.5, 2.0, 101) * 2.5, v * 1.5, 4, 0.55, 2.2, 503);
        const microFiber = smoothNoise(u * 64.0, v * 4.0, 777) * 0.25;

        // Wood Knot ring distortion
        const knotDist = Math.hypot((u - 0.42) * 2.5, (v - 0.65) * 6.0);
        const knotRing = Math.sin(knotDist * 32.0) * Math.exp(-knotDist * 3.5);

        const compositeWood = grainNoise * 0.7 + microFiber + knotRing * 0.35;

        // Albedo Color calculation (Warm golden oak/pine lumber)
        const baseR = 145 + compositeWood * 65 - seamFactor * 55;
        const baseG = 95 + compositeWood * 45 - seamFactor * 45;
        const baseB = 55 + compositeWood * 25 - seamFactor * 35;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(baseR)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
        albedoData[idx + 3] = 255;

        // Height Map for Normal Calculation
        let h = compositeWood * 0.4 - seamFactor * 0.8;
        if (isPlankSeam) h -= 0.6;
        heightMap[hIdx] = h;

        // ORM: Red = AO, Green = Roughness, Blue = Metallic
        const ao = Math.round(Math.max(30, (1.0 - seamFactor * 0.7 - (1.0 - compositeWood) * 0.25) * 255));
        const roughness = Math.round((0.62 + (1.0 - compositeWood) * 0.25 + seamFactor * 0.12) * 255); // 0.62 to 0.87
        const metallic = 0; // Pure organic dielectric wood

        ormData[idx + 0] = ao;
        ormData[idx + 1] = roughness;
        ormData[idx + 2] = metallic;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 3.2);

    return this.createTextureSet('wood_plank', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a rugged Alpine Stone / Rock PBR Texture Set
   * - Albedo: Chiseled mountain granite & slate, quartz specks, mineral veins, dark basalt fissures
   * - Normal: Sharp faceted Voronoi rock fractures, craggy surface relief, high micro-roughness
   * - ORM: Roughness ~0.45-0.78 (facets catch sharp directional sunlight), Metallic = ~0.04-0.10 (quartz/mica mineral sheen), AO = deep fracture occlusion
   */
  generateStoneRockPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Voronoi rock facet fractures
        const v1 = voronoi(u * 5.5, v * 5.5, 912);
        const fractureBorder = Math.max(0, 1.0 - (v1.dist2 - v1.dist1) * 6.5);

        // Multi-octave rock crag noise
        const macroCrags = fbm(u * 3.5, v * 3.5, 5, 0.52, 2.1, 441);
        const microPitted = smoothNoise(u * 32.0, v * 32.0, 888) * 0.22;
        const quartzVein = Math.exp(-Math.pow(Math.sin((u + v * 0.7) * 8.0 + macroCrags * 2.0), 2) / 0.04) * 0.45;

        const rockHeight = macroCrags * 0.7 + v1.dist1 * 0.4 - fractureBorder * 0.6 + quartzVein * 0.3;
        heightMap[hIdx] = rockHeight;

        // Slate / Granite Albedo
        const base = 110 + macroCrags * 60 - fractureBorder * 50 + quartzVein * 80;
        const rTone = base + (v1.cellId % 20) - 10;
        const gTone = base + 3 + (v1.cellId % 15) - 7;
        const bTone = base + 8 + (v1.cellId % 25) - 12;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(rTone)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(gTone)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(bTone)));
        albedoData[idx + 3] = 255;

        // ORM: Red = AO, Green = Roughness, Blue = Metallic
        const ao = Math.round(Math.max(25, (1.0 - fractureBorder * 0.8) * 255));
        // Smooth quartz veins have lower roughness (0.42), dry craggy slate is ~0.75
        const roughness = Math.round(Math.max(80, Math.min(240, (0.72 - quartzVein * 0.32 + microPitted * 0.15) * 255)));
        // Mica/Quartz crystalline flecks give a touch of metallic reflectance (0.05 - 0.12)
        const metallic = Math.round(Math.min(35, quartzVein * 65));

        ormData[idx + 0] = ao;
        ormData[idx + 1] = roughness;
        ormData[idx + 2] = metallic;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 4.2);

    return this.createTextureSet('stone_rock', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Wet Mud & Damp Soil PBR Texture Set
   * - Albedo: Dark organic loam, damp silt, saturated mud puddles, pebbles
   * - Normal: Soft undulating mud clods, foot tread depressions, smooth glossy puddles
   * - ORM: High-contrast roughness! Wet puddle hollows have very low roughness (~0.18-0.30) giving glassy specular reflections, dry clod peaks are rough (~0.88), Metallic = 0.0, AO = organic depth
   */
  generateMudSoilPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Mud clods and depression hollows
        const soilNoise = fbm(u * 4.5, v * 4.5, 4, 0.55, 2.0, 723);
        const puddleHollow = fbm(u * 2.2, v * 2.2, 3, 0.5, 2.0, 319);
        const pebbleNoise = smoothNoise(u * 28.0, v * 28.0, 991);
        const hasPebble = pebbleNoise > 0.82 ? (pebbleNoise - 0.82) * 5.0 : 0;

        // Is this coordinate a wet depression puddle?
        const wetness = Math.max(0, Math.min(1, (0.55 - puddleHollow) * 3.5));

        const mudHeight = soilNoise * 0.6 + hasPebble * 0.4 - wetness * 0.35;
        heightMap[hIdx] = mudHeight;

        // Dark rich soil albedo (darker when saturated with moisture)
        const moistureDarken = 1.0 - wetness * 0.35;
        const baseR = (75 + soilNoise * 35 + hasPebble * 40) * moistureDarken;
        const baseG = (52 + soilNoise * 25 + hasPebble * 35) * moistureDarken;
        const baseB = (35 + soilNoise * 18 + hasPebble * 30) * moistureDarken;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(baseR)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
        albedoData[idx + 3] = 255;

        // ORM: Red = AO, Green = Roughness, Blue = Metallic
        const ao = Math.round(Math.max(40, (0.8 + mudHeight * 0.2) * 255));
        // Wet mud is ultra-glossy (roughness 0.18), dry mud clods are rough (0.88)
        const roughnessVal = (1.0 - wetness) * 0.88 + wetness * 0.18;
        const roughness = Math.round(Math.max(45, Math.min(245, roughnessVal * 255)));
        const metallic = 0; // Pure dielectric water/mud

        ormData[idx + 0] = ao;
        ormData[idx + 1] = roughness;
        ormData[idx + 2] = metallic;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.8);

    return this.createTextureSet('mud_soil', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Rough Pine Tree Bark PBR Texture Set
   */
  generatePineBarkPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Deep vertical ridges and fibrous bark grooves
        const ridge = fbm(u * 12.0, v * 2.0, 4, 0.6, 2.0, 281);
        const micro = smoothNoise(u * 40.0, v * 12.0, 617) * 0.3;
        const barkHeight = ridge * 0.8 + micro * 0.2;
        heightMap[hIdx] = barkHeight;

        // Deep warm reddish brown bark tones
        const r = 55 + barkHeight * 45;
        const g = 32 + barkHeight * 26;
        const b = 18 + barkHeight * 15;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        albedoData[idx + 3] = 255;

        ormData[idx + 0] = Math.round((0.6 + barkHeight * 0.4) * 255); // AO
        ormData[idx + 1] = Math.round(0.92 * 255); // Very rough
        ormData[idx + 2] = 0; // Metallic = 0
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 4.5);
    return this.createTextureSet('bark_pine', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Mountain Grass / Meadow PBR Texture Set
   */
  generateGrassPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        const bladeNoise = fbm(u * 16.0, v * 16.0, 4, 0.55, 2.0, 604);
        const meadowVar = smoothNoise(u * 3.0, v * 3.0, 112);
        heightMap[hIdx] = bladeNoise * 0.5;

        const r = 38 + bladeNoise * 30 + meadowVar * 20;
        const g = 68 + bladeNoise * 50 + meadowVar * 35;
        const b = 24 + bladeNoise * 18 + meadowVar * 15;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        albedoData[idx + 3] = 255;

        ormData[idx + 0] = Math.round((0.85 + bladeNoise * 0.15) * 255);
        ormData[idx + 1] = Math.round(0.85 * 255); // Organic vegetation roughness
        ormData[idx + 2] = 0;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.2);
    return this.createTextureSet('grass_meadow', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Cedar / Slate Shingle Roof PBR Texture Set
   */
  generateRoofShinglesPBR(size: number = 256, tileRows: number = 8): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        const row = Math.floor(v * tileRows);
        const rowV = (v * tileRows) % 1.0;
        // Stagger every other row
        const colU = (u * 6.0 + (row % 2 === 0 ? 0.5 : 0)) % 1.0;
        const isColEdge = Math.min(colU, 1.0 - colU) < 0.06;

        // Overlapping slope for roof shingle
        const shingleSlope = rowV;
        let shingleH = shingleSlope * 0.7;
        if (isColEdge) shingleH -= 0.3;

        heightMap[hIdx] = shingleH;

        const tileTone = 60 + shingleH * 40 - (isColEdge ? 25 : 0);
        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(tileTone * 1.1)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(tileTone * 0.9)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(tileTone * 0.75)));
        albedoData[idx + 3] = 255;

        ormData[idx + 0] = Math.round((0.7 + shingleH * 0.3) * 255);
        ormData[idx + 1] = Math.round(0.70 * 255);
        ormData[idx + 2] = 0;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 3.8);
    return this.createTextureSet('roof_shingles', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Pine Needles / Conifer Canopy PBR Texture Set
   */
  generatePineNeedlesPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Multi-scale organic pine needle & twig pattern (seamless planar/cylindrical tiling)
        const needleNoise1 = fbm(u * 24.0, v * 24.0, 4, 0.6, 2.0, 401);
        const needleNoise2 = fbm(u * 48.0 + 3.14, v * 48.0 + 1.61, 3, 0.5, 2.0, 808);
        const branchStructure = smoothNoise(u * 6.0, v * 6.0, 912);

        const needleH = Math.max(0, Math.min(1, needleNoise1 * 0.65 + needleNoise2 * 0.35));
        heightMap[hIdx] = needleH;

        // Rich authentic alpine pine hues (deep evergreen with subtle sunlit tips)
        const shadowFactor = 0.55 + branchStructure * 0.45;
        const baseG = (28 + needleH * 55 + branchStructure * 20) * shadowFactor;
        const baseR = (16 + needleH * 22 + branchStructure * 12) * shadowFactor;
        const baseB = (14 + needleH * 20 + branchStructure * 10) * shadowFactor;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(baseR)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
        albedoData[idx + 3] = 255;

        // ORM: Red = AO, Green = Roughness (waxy needles ~0.7), Blue = Metallic (0)
        ormData[idx + 0] = Math.round((0.6 + needleH * 0.4) * 255);
        ormData[idx + 1] = Math.round(0.72 * 255);
        ormData[idx + 2] = 0;
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.4);
    return this.createTextureSet('needle_pine', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Mountain Cliff Escarpment PBR Texture Set
   */
  generateCliffRockPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        const strata = fbm(u * 2.0, v * 14.0, 4, 0.5, 2.0, 931);
        const crags = voronoi(u * 4.0, v * 4.0, 773);
        const cliffH = strata * 0.6 + crags.dist1 * 0.4;
        heightMap[hIdx] = cliffH;

        const tone = 85 + cliffH * 55;
        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(tone * 1.05)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(tone * 1.0)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(tone * 0.95)));
        albedoData[idx + 3] = 255;

        ormData[idx + 0] = Math.round((0.7 + cliffH * 0.3) * 255);
        ormData[idx + 1] = Math.round(0.78 * 255);
        ormData[idx + 2] = Math.round(0.04 * 255);
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 4.0);
    return this.createTextureSet('cliff_rock', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Weathered Cobblestone PBR Texture Set (Village road & plazas)
   */
  generateCobblestonePBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * 8.0;
        const v = (y / size) * 8.0;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        const vData = voronoi(u, v, 331);
        const cellDist = vData.dist1;
        const cellEdge = vData.dist2 - vData.dist1;

        // Rounded cobblestone hump with mortar groove depression
        const stoneHump = Math.sin(Math.min(1.0, cellEdge * 3.5) * Math.PI * 0.5);
        const fineNoise = fbm(u * 4.0, v * 4.0, 3, 0.5, 2.0, 552) * 0.15;
        const h = stoneHump * 0.85 + fineNoise;
        heightMap[hIdx] = h;

        // Color modulation per individual cobblestone
        const cellHue = (vData.cellId % 20) / 20;
        const baseGrey = 110 + cellHue * 35;
        const isMortar = cellEdge < 0.12;

        const r = isMortar ? 75 : baseGrey + fineNoise * 30;
        const g = isMortar ? 70 : baseGrey * 0.96 + fineNoise * 25;
        const b = isMortar ? 65 : baseGrey * 0.92 + fineNoise * 20;

        albedoData[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
        albedoData[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        albedoData[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        albedoData[idx + 3] = 255;

        // ORM: Red=AO (deep mortar shadows), Green=Roughness, Blue=Metallic
        ormData[idx + 0] = Math.round((isMortar ? 0.35 : 0.75 + stoneHump * 0.25) * 255);
        ormData[idx + 1] = Math.round((isMortar ? 0.92 : 0.6 + (1 - stoneHump) * 0.25) * 255);
        ormData[idx + 2] = Math.round(0.02 * 255);
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 3.8);
    return this.createTextureSet('cobblestone', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Hand-Forged Iron & Dark Metal PBR Texture Set
   */
  generateIronMetalPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Micro hammer marks & forged grain
        const hammer = fbm(u * 12.0, v * 12.0, 3, 0.6, 2.0, 419) * 0.4;
        const scratches = smoothNoise(u * 32.0, v * 2.0, 102) * 0.15;
        const h = hammer + scratches;
        heightMap[hIdx] = h;

        const tone = 38 + h * 30;
        albedoData[idx + 0] = Math.round(tone * 1.02);
        albedoData[idx + 1] = Math.round(tone * 1.0);
        albedoData[idx + 2] = Math.round(tone * 1.04);
        albedoData[idx + 3] = 255;

        // High metallic, low-to-medium roughness for realistic metal specular gleam
        ormData[idx + 0] = Math.round((0.85 + h * 0.15) * 255);
        ormData[idx + 1] = Math.round((0.32 + scratches * 0.3) * 255);
        ormData[idx + 2] = Math.round(0.92 * 255); // Highly Metallic
        ormData[idx + 3] = 255;
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.2);
    return this.createTextureSet('iron_metal', albedoData, normalData, ormData, size, size);
  }

  /**
   * Generates a Hand-blown Glass Window Pane PBR Texture Set
   */
  generateWindowGlassPBR(size: number = 256): PBRTextureSet {
    const albedoData = new Uint8Array(size * size * 4);
    const ormData = new Uint8Array(size * size * 4);
    const heightMap = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const idx = (y * size + x) * 4;
        const hIdx = y * size + x;

        // Wooden lattice window mullion frame (2x3 pane grid)
        const frameX = Math.abs(Math.sin(u * Math.PI * 2));
        const frameY = Math.abs(Math.sin(v * Math.PI * 3));
        const isFrame = (frameX < 0.08 && (u > 0.04 && u < 0.96)) || (frameY < 0.08 && (v > 0.04 && v < 0.96)) || u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96;

        const glassWaviness = smoothNoise(u * 6.0, v * 6.0, 887) * 0.1;
        heightMap[hIdx] = isFrame ? 0.8 : glassWaviness;

        if (isFrame) {
          // Dark timber wood frame
          albedoData[idx + 0] = 52;
          albedoData[idx + 1] = 36;
          albedoData[idx + 2] = 24;
          albedoData[idx + 3] = 255;

          ormData[idx + 0] = 200;
          ormData[idx + 1] = 210;
          ormData[idx + 2] = 0;
          ormData[idx + 3] = 255;
        } else {
          // Warm amber glowing window glass with high gloss
          albedoData[idx + 0] = 220;
          albedoData[idx + 1] = 165;
          albedoData[idx + 2] = 95;
          albedoData[idx + 3] = 220;

          ormData[idx + 0] = 255;
          ormData[idx + 1] = 35; // Smooth glossy glass
          ormData[idx + 2] = 15;
          ormData[idx + 3] = 255;
        }
      }
    }

    const normalData = heightToNormalMap(heightMap, size, size, 2.0);
    return this.createTextureSet('window_glass', albedoData, normalData, ormData, size, size);
  }

  /**
   * Helper to build BABYLON.RawTexture objects with mipmapping, trilinear filtering & wrapping
   */
  public createTextureSet(
    name: string,
    albedoBuf: Uint8Array,
    normalBuf: Uint8Array,
    ormBuf: Uint8Array,
    width: number,
    height: number
  ): PBRTextureSet {
    const albedo = BABYLON.RawTexture.CreateRGBATexture(
      albedoBuf,
      width,
      height,
      this.scene,
      true,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );
    albedo.name = `${name}_albedo`;
    albedo.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    albedo.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    const normal = BABYLON.RawTexture.CreateRGBATexture(
      normalBuf,
      width,
      height,
      this.scene,
      true,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );
    normal.name = `${name}_normal`;
    normal.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    normal.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    const orm = BABYLON.RawTexture.CreateRGBATexture(
      ormBuf,
      width,
      height,
      this.scene,
      true,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );
    orm.name = `${name}_orm`;
    orm.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    orm.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    return { albedo, normal, orm };
  }
}
