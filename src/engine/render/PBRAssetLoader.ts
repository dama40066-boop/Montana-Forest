// #03 RENDERING - PBR Asset Loader & Texture Map Packing Pipeline
// Handles asynchronous loading of Normal maps (bump textures), ORM packed maps (Occlusion, Roughness, Metallic),
// Albedo maps, channel-packing, GPU caching, and procedural fallback generation for environment meshes.

import * as BABYLON from '@babylonjs/core';
import { PBRTextureGenerator, PBRTextureSet } from './PBRTextureGenerator';
import { QualityLevel } from './BabylonBackend';

export interface PBRMapSourceConfig {
  albedoUrl?: string;
  normalUrl?: string;
  ormUrl?: string;
  aoUrl?: string;
  roughnessUrl?: string;
  metallicUrl?: string;
  generatorKey?: 'wood' | 'stone' | 'mud' | 'bark' | 'grass' | 'roof' | 'needle' | 'cliff' | 'cobblestone' | 'iron' | 'glass';
  uScale?: number;
  vScale?: number;
  bumpLevel?: number;
  directIntensity?: number;
  environmentIntensity?: number;
  specularIntensity?: number;
  emissiveColor?: [number, number, number];
  albedoColor?: [number, number, number];
  subsurface?: {
    isRefractionEnabled?: boolean;
    indexOfRefraction?: number;
  };
}

export interface EnvironmentAssetManifest {
  [assetKey: string]: PBRMapSourceConfig;
}

export class PBRAssetLoader {
  private scene: BABYLON.Scene;
  private texGenerator: PBRTextureGenerator;
  private textureCache: Map<string, PBRTextureSet> = new Map();
  private materialCache: Map<string, BABYLON.PBRMaterial> = new Map();
  private quality: QualityLevel = 'HIGH';

  // Standard environment asset definitions
  public manifest: EnvironmentAssetManifest = {
    terrain_grass: {
      generatorKey: 'grass',
      uScale: 28,
      vScale: 28,
      bumpLevel: 0.9,
      directIntensity: 1.1,
      environmentIntensity: 0.75
    },
    mud_soil: {
      generatorKey: 'mud',
      uScale: 6,
      vScale: 6,
      bumpLevel: 1.4,
      directIntensity: 1.35,
      specularIntensity: 1.6
    },
    stone_rock: {
      generatorKey: 'stone',
      uScale: 4,
      vScale: 4,
      bumpLevel: 1.6,
      directIntensity: 1.3,
      specularIntensity: 1.2
    },
    cobblestone_road: {
      generatorKey: 'cobblestone',
      uScale: 8,
      vScale: 8,
      bumpLevel: 1.5,
      directIntensity: 1.3,
      specularIntensity: 1.1
    },
    building_wood: {
      generatorKey: 'wood',
      uScale: 3,
      vScale: 3,
      bumpLevel: 1.2,
      directIntensity: 1.2,
      specularIntensity: 0.85
    },
    dock_wood: {
      generatorKey: 'wood',
      uScale: 2,
      vScale: 6,
      bumpLevel: 1.3,
      albedoColor: [0.85, 0.85, 0.82],
      specularIntensity: 0.95
    },
    bark_pine: {
      generatorKey: 'bark',
      uScale: 1,
      vScale: 4,
      bumpLevel: 1.5,
      directIntensity: 1.15
    },
    needle_pine: {
      generatorKey: 'needle',
      uScale: 2,
      vScale: 2,
      bumpLevel: 1.2,
      directIntensity: 1.25
    },
    building_roof: {
      generatorKey: 'roof',
      uScale: 4,
      vScale: 4,
      bumpLevel: 1.4,
      directIntensity: 1.2
    },
    cliff_rock: {
      generatorKey: 'cliff',
      uScale: 6,
      vScale: 6,
      bumpLevel: 1.8,
      directIntensity: 1.3,
      specularIntensity: 1.1
    },
    iron_metal: {
      generatorKey: 'iron',
      uScale: 2,
      vScale: 2,
      bumpLevel: 1.1,
      directIntensity: 1.4,
      specularIntensity: 1.8
    },
    window_glass: {
      generatorKey: 'glass',
      uScale: 1,
      vScale: 1,
      bumpLevel: 0.8,
      directIntensity: 1.2,
      specularIntensity: 2.2,
      emissiveColor: [0.95, 0.72, 0.35]
    }
  };

  constructor(scene: BABYLON.Scene, quality: QualityLevel = 'HIGH') {
    this.scene = scene;
    this.quality = quality;
    this.texGenerator = new PBRTextureGenerator(scene);
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  /**
   * Pack separate AO (R), Roughness (G), and Metallic (B) image buffers into a unified ORM map
   */
  public packORMChannels(
    aoData: Uint8Array | null,
    roughnessData: Uint8Array | null,
    metallicData: Uint8Array | null,
    width: number,
    height: number,
    defaultAo: number = 255,
    defaultRoughness: number = 200,
    defaultMetallic: number = 0
  ): Uint8Array {
    const size = width * height;
    const orm = new Uint8Array(size * 4);

    for (let i = 0; i < size; i++) {
      const px = i * 4;
      // Red: Ambient Occlusion
      orm[px + 0] = aoData ? aoData[px] : defaultAo;
      // Green: Roughness
      orm[px + 1] = roughnessData ? roughnessData[px] : defaultRoughness;
      // Blue: Metallic
      orm[px + 2] = metallicData ? metallicData[px] : defaultMetallic;
      // Alpha: Opaque 255
      orm[px + 3] = 255;
    }

    return orm;
  }

  /**
   * Helper to load an external image from URL or DataURL and extract its pixel buffer
   */
  private loadImagePixels(url: string, targetWidth: number, targetHeight: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          resolve(new Uint8Array(imgData.data.buffer));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   * Loads or generates a full PBR Texture Set (Albedo, Normal Bump, ORM) for a specific asset key
   */
  public async loadPBRTextureSet(assetKey: string, config?: PBRMapSourceConfig): Promise<PBRTextureSet> {
    if (this.textureCache.has(assetKey)) {
      return this.textureCache.get(assetKey)!;
    }

    const cfg = config || this.manifest[assetKey] || {};
    const res = this.quality === 'LOW' ? 128 : this.quality === 'ULTRA' ? 512 : 256;

    let albedoRaw: BABYLON.RawTexture | null = null;
    let normalRaw: BABYLON.RawTexture | null = null;
    let ormRaw: BABYLON.RawTexture | null = null;

    // Check if external URLs are specified
    if (cfg.albedoUrl || cfg.normalUrl || cfg.ormUrl || cfg.aoUrl || cfg.roughnessUrl || cfg.metallicUrl) {
      try {
        const [albedoPix, normalPix, ormPix, aoPix, roughPix, metalPix] = await Promise.all([
          cfg.albedoUrl ? this.loadImagePixels(cfg.albedoUrl, res, res) : Promise.resolve(null),
          cfg.normalUrl ? this.loadImagePixels(cfg.normalUrl, res, res) : Promise.resolve(null),
          cfg.ormUrl ? this.loadImagePixels(cfg.ormUrl, res, res) : Promise.resolve(null),
          cfg.aoUrl ? this.loadImagePixels(cfg.aoUrl, res, res) : Promise.resolve(null),
          cfg.roughnessUrl ? this.loadImagePixels(cfg.roughnessUrl, res, res) : Promise.resolve(null),
          cfg.metallicUrl ? this.loadImagePixels(cfg.metallicUrl, res, res) : Promise.resolve(null)
        ]);

        if (albedoPix && normalPix && (ormPix || (aoPix && roughPix))) {
          const finalOrm = ormPix || this.packORMChannels(aoPix, roughPix, metalPix, res, res);
          const texSet = this.texGenerator.createTextureSet(assetKey, albedoPix, normalPix, finalOrm, res, res);
          this.textureCache.set(assetKey, texSet);
          return texSet;
        }
      } catch (err) {
        console.warn(`[PBRAssetLoader] Failed to load external PBR textures for ${assetKey}, using procedural synthesis fallback.`, err);
      }
    }

    // Procedural generation fallback using deterministic PBR map generator
    let texSet: PBRTextureSet;
    const key = cfg.generatorKey || assetKey;

    switch (key) {
      case 'wood':
      case 'building_wood':
      case 'dock_wood':
        texSet = this.texGenerator.generateWoodPlankPBR(res, 4);
        break;
      case 'stone':
      case 'stone_rock':
        texSet = this.texGenerator.generateStoneRockPBR(res);
        break;
      case 'mud':
      case 'mud_soil':
        texSet = this.texGenerator.generateMudSoilPBR(res);
        break;
      case 'bark':
      case 'bark_pine':
        texSet = this.texGenerator.generatePineBarkPBR(res);
        break;
      case 'grass':
      case 'terrain_grass':
        texSet = this.texGenerator.generateGrassPBR(res);
        break;
      case 'roof':
      case 'building_roof':
        texSet = this.texGenerator.generateRoofShinglesPBR(res, 6);
        break;
      case 'needle':
      case 'needle_pine':
        texSet = this.texGenerator.generatePineNeedlesPBR(res);
        break;
      case 'cliff':
      case 'cliff_rock':
        texSet = this.texGenerator.generateCliffRockPBR(res);
        break;
      case 'cobblestone':
      case 'cobblestone_road':
        texSet = this.texGenerator.generateCobblestonePBR(res);
        break;
      case 'iron':
      case 'iron_metal':
        texSet = this.texGenerator.generateIronMetalPBR(res);
        break;
      case 'glass':
      case 'window_glass':
        texSet = this.texGenerator.generateWindowGlassPBR(res);
        break;
      default:
        texSet = this.texGenerator.generateStoneRockPBR(res);
        break;
    }

    this.textureCache.set(assetKey, texSet);
    return texSet;
  }

  /**
   * Creates a configured BABYLON.PBRMaterial instance hooked up to the PBR texture set
   */
  public createPBRMaterial(name: string, config: PBRMapSourceConfig, texSet: PBRTextureSet): BABYLON.PBRMaterial {
    const mat = new BABYLON.PBRMaterial(name, this.scene);

    // 1. Albedo / BaseColor Map
    const albedo = texSet.albedo.clone();
    albedo.uScale = config.uScale ?? 1;
    albedo.vScale = config.vScale ?? 1;
    albedo.anisotropicFilteringLevel = this.quality === 'ULTRA' ? 16 : this.quality === 'HIGH' ? 8 : 4;
    mat.albedoTexture = albedo;

    if (config.albedoColor) {
      mat.albedoColor = new BABYLON.Color3(...config.albedoColor);
    }

    if (config.emissiveColor) {
      mat.emissiveColor = new BABYLON.Color3(...config.emissiveColor);
    }

    // 2. Normal / Bump Map (Tangent-Space)
    const normal = texSet.normal.clone();
    normal.uScale = config.uScale ?? 1;
    normal.vScale = config.vScale ?? 1;
    normal.anisotropicFilteringLevel = this.quality === 'ULTRA' ? 16 : this.quality === 'HIGH' ? 8 : 4;
    mat.bumpTexture = normal;
    mat.bumpTexture.level = config.bumpLevel ?? 1.0;

    // 3. ORM Packed Texture (Occlusion: Red, Roughness: Green, Metallic: Blue)
    const orm = texSet.orm.clone();
    orm.uScale = config.uScale ?? 1;
    orm.vScale = config.vScale ?? 1;
    orm.anisotropicFilteringLevel = this.quality === 'ULTRA' ? 16 : this.quality === 'HIGH' ? 8 : 4;
    mat.metallicTexture = orm;

    // Wire up ORM channel decoding
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useMetallnessFromMetallicTextureBlue = true;
    mat.useAmbientOcclusionFromMetallicTextureRed = true;
    mat.ambientTexture = orm;

    // 4. Physical Lighting Responses
    mat.directIntensity = config.directIntensity ?? 1.25;
    mat.environmentIntensity = config.environmentIntensity ?? 0.85;
    mat.specularIntensity = config.specularIntensity ?? 1.0;

    // 5. Optional Subsurface / Refraction
    if (config.subsurface) {
      if (config.subsurface.isRefractionEnabled) {
        mat.subSurface.isRefractionEnabled = true;
        mat.subSurface.indexOfRefraction = config.subsurface.indexOfRefraction ?? 1.333;
      }
    }

    this.materialCache.set(name, mat);
    return mat;
  }

  /**
   * Preload and construct all environment materials in one batch
   */
  public async loadAllEnvironmentMaterials(): Promise<Record<string, BABYLON.PBRMaterial>> {
    const materials: Record<string, BABYLON.PBRMaterial> = {};

    const keys = Object.keys(this.manifest);
    for (const key of keys) {
      const cfg = this.manifest[key];
      const texSet = await this.loadPBRTextureSet(key, cfg);
      materials[key] = this.createPBRMaterial(key, cfg, texSet);
    }

    return materials;
  }

  /**
   * Helper to retrieve or look up a cached material
   */
  public getMaterial(name: string): BABYLON.PBRMaterial | undefined {
    return this.materialCache.get(name);
  }

  /**
   * Apply an environment PBR material to a target mesh
   */
  public applyToMesh(mesh: BABYLON.AbstractMesh, materialKey: string): void {
    const mat = this.materialCache.get(materialKey);
    if (mat) {
      mesh.material = mat;
    }
  }

  /**
   * Cleanup memory and GPU textures
   */
  public dispose(): void {
    for (const [, texSet] of this.textureCache) {
      texSet.albedo.dispose();
      texSet.normal.dispose();
      texSet.orm.dispose();
    }
    this.textureCache.clear();

    for (const [, mat] of this.materialCache) {
      mat.dispose(true, true);
    }
    this.materialCache.clear();
  }
}
