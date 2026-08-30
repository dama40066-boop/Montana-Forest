// #03 RENDERING & #06 WATER - Babylon.js WebGL/WebGPU Rendering Adapter, PBR Materials & Shaders
import * as BABYLON from '@babylonjs/core';
import { Vec3, Quat, clamp, lerp } from '../math';
import { WorldGenerator, VILLAGE_BUILDINGS, TreeData } from '../world/World';
import { AnimalEntityData } from '../../types/game';
import { NPCAgentData } from '../ai/NPCBrain';
import { PBRTextureGenerator, PBRTextureSet } from './PBRTextureGenerator';
import { PBRAssetLoader } from './PBRAssetLoader';

export type QualityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface HumanoidRig {
  root: BABYLON.TransformNode;
  torso: BABYLON.Mesh;
  headNode: BABYLON.TransformNode;
  head: BABYLON.Mesh;
  hat?: BABYLON.TransformNode;
  leftArm: BABYLON.TransformNode;
  rightArm: BABYLON.TransformNode;
  leftLeg: BABYLON.TransformNode;
  rightLeg: BABYLON.TransformNode;
  leftEye: BABYLON.Mesh;
  rightEye: BABYLON.Mesh;
  walkPhase: number;
  baseTorsoY: number;
  blinkTimer: number;
}

export interface AnimalMeshEntry {
  root: BABYLON.TransformNode;
  body: BABYLON.Mesh;
  head: BABYLON.Mesh;
  legs: BABYLON.Mesh[];
  walkPhase: number;
}

export class BabylonRenderBackend {
  public engine: BABYLON.Engine | null = null;
  public scene: BABYLON.Scene | null = null;
  public camera: BABYLON.UniversalCamera | null = null;
  public sun: BABYLON.DirectionalLight | null = null;
  public hemi: BABYLON.HemisphericLight | null = null;
  public shadowGenerator: BABYLON.ShadowGenerator | null = null;
  public waterMesh: BABYLON.Mesh | null = null;

  // Asset Loader System for PBR Normal (Bump) & ORM Texture Maps
  public assetLoader: PBRAssetLoader | null = null;

  // Quality Level & Capability Detection
  public quality: QualityLevel = 'HIGH';

  // Visual Entity Registries
  public npcRigs: Map<number, HumanoidRig> = new Map();
  public playerRig: HumanoidRig | null = null;
  public animalMeshes: Map<number, AnimalMeshEntry> = new Map();
  public arrowMeshes: BABYLON.Mesh[] = [];

  // Weapon Viewmodel & FX Systems
  public weaponViewModelRoot: BABYLON.TransformNode | null = null;
  public weaponMeshes: Map<string, BABYLON.TransformNode> = new Map();
  public muzzleFlashLight: BABYLON.PointLight | null = null;
  public muzzleFlashMesh: BABYLON.Mesh | null = null;
  public muzzleFlashTimer: number = 0;
  public activeTracers: { mesh: BABYLON.LinesMesh; age: number; maxAge: number }[] = [];
  public targetStands: { root: BABYLON.TransformNode; pos: [number, number, number]; radius: number }[] = [];

  // Dynamic Point Lights with Flame Flicker Simulation
  public lanternLights: { light: BABYLON.PointLight; baseIntensity: number; flickerSeed: number }[] = [];
  public windowMaterials: BABYLON.PBRMaterial[] = [];

  // Materials
  private materials: Record<string, BABYLON.PBRMaterial> = {};
  private textureSets: Record<string, PBRTextureSet> = {};

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Detect hardware tier
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    if (isMobile) {
      this.quality = 'LOW';
    } else if (cores >= 8) {
      this.quality = 'ULTRA';
    } else if (cores >= 4) {
      this.quality = 'HIGH';
    } else {
      this.quality = 'MEDIUM';
    }

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: this.quality !== 'LOW'
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.08, 0.12, 0.1, 1.0);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = this.quality === 'LOW' ? 0.005 : 0.0035;

    // Create First Person Camera
    this.camera = new BABYLON.UniversalCamera('FPVCamera', new BABYLON.Vector3(0, 5, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = this.quality === 'LOW' ? 350 : 650;
    this.camera.fov = Math.PI / 3;
    this.scene.activeCamera = this.camera;

    // Initialize PBR Asset Loader pipeline and preload all environment texture maps (Bump/Normal, ORM, Albedo)
    this.assetLoader = new PBRAssetLoader(this.scene, this.quality);
    await this.initMaterials();
    this.initLighting();
    this.initWeaponViewModels();

    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  private initWeaponViewModels(): void {
    if (!this.scene || !this.camera) return;

    this.weaponViewModelRoot = new BABYLON.TransformNode('WeaponViewModelRoot', this.scene);
    this.weaponViewModelRoot.parent = this.camera;
    this.weaponViewModelRoot.position.set(0.24, -0.22, 0.48);

    const matWood = this.materials.building_wood || this.materials.bark_pine;
    const matIron = this.materials.iron_metal || this.materials.stone_rock;
    const matBrass = this.materials.stone_rock;

    // 1. Winchester Lever-Action Rifle (Repeating Carbine)
    const rifleNode = new BABYLON.TransformNode('vm_rifle', this.scene);
    rifleNode.parent = this.weaponViewModelRoot;

    // Wooden stock & receiver
    const rifleStock = BABYLON.MeshBuilder.CreateBox('rifle_stock', { width: 0.05, height: 0.12, depth: 0.55 }, this.scene);
    rifleStock.parent = rifleNode;
    rifleStock.position.set(0, -0.04, -0.15);
    rifleStock.material = matWood;

    // Steel barrel
    const rifleBarrel = BABYLON.MeshBuilder.CreateCylinder('rifle_barrel', { height: 0.85, diameter: 0.032 }, this.scene);
    rifleBarrel.parent = rifleNode;
    rifleBarrel.position.set(0, 0.02, 0.35);
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.material = matIron;

    // Magazine tube beneath barrel
    const rifleMagTube = BABYLON.MeshBuilder.CreateCylinder('rifle_mag_tube', { height: 0.75, diameter: 0.024 }, this.scene);
    rifleMagTube.parent = rifleNode;
    rifleMagTube.position.set(0, -0.012, 0.3);
    rifleMagTube.rotation.x = Math.PI / 2;
    rifleMagTube.material = matIron;

    // Lever loop
    const leverLoop = BABYLON.MeshBuilder.CreateTorus('rifle_lever', { diameter: 0.08, thickness: 0.015 }, this.scene);
    leverLoop.parent = rifleNode;
    leverLoop.position.set(0, -0.09, 0.02);
    leverLoop.rotation.y = Math.PI / 2;
    leverLoop.material = matIron;

    // Front bead sight
    const rifleSight = BABYLON.MeshBuilder.CreateSphere('rifle_sight', { diameter: 0.012 }, this.scene);
    rifleSight.parent = rifleNode;
    rifleSight.position.set(0, 0.042, 0.75);
    rifleSight.material = matBrass;

    this.weaponMeshes.set('rifle_repeater', rifleNode);

    // 2. Colt .45 Peacemaker Revolver
    const revolverNode = new BABYLON.TransformNode('vm_revolver', this.scene);
    revolverNode.parent = this.weaponViewModelRoot;

    const revGrip = BABYLON.MeshBuilder.CreateBox('rev_grip', { width: 0.04, height: 0.12, depth: 0.07 }, this.scene);
    revGrip.parent = revolverNode;
    revGrip.position.set(0, -0.07, -0.08);
    revGrip.rotation.x = -0.3;
    revGrip.material = matWood;

    const revCylinder = BABYLON.MeshBuilder.CreateCylinder('rev_cyl', { height: 0.08, diameter: 0.055 }, this.scene);
    revCylinder.parent = revolverNode;
    revCylinder.position.set(0, 0, 0.02);
    revCylinder.rotation.x = Math.PI / 2;
    revCylinder.material = matIron;

    const revBarrel = BABYLON.MeshBuilder.CreateCylinder('rev_barrel', { height: 0.35, diameter: 0.03 }, this.scene);
    revBarrel.parent = revolverNode;
    revBarrel.position.set(0, 0.015, 0.22);
    revBarrel.rotation.x = Math.PI / 2;
    revBarrel.material = matIron;

    this.weaponMeshes.set('revolver_colt', revolverNode);

    // 3. Double-Barrel Shotgun
    const shotgunNode = new BABYLON.TransformNode('vm_shotgun', this.scene);
    shotgunNode.parent = this.weaponViewModelRoot;

    const sgStock = BABYLON.MeshBuilder.CreateBox('sg_stock', { width: 0.06, height: 0.13, depth: 0.45 }, this.scene);
    sgStock.parent = shotgunNode;
    sgStock.position.set(0, -0.04, -0.16);
    sgStock.material = matWood;

    const sgBarrel1 = BABYLON.MeshBuilder.CreateCylinder('sg_barrel_1', { height: 0.72, diameter: 0.038 }, this.scene);
    sgBarrel1.parent = shotgunNode;
    sgBarrel1.position.set(-0.02, 0.02, 0.32);
    sgBarrel1.rotation.x = Math.PI / 2;
    sgBarrel1.material = matIron;

    const sgBarrel2 = BABYLON.MeshBuilder.CreateCylinder('sg_barrel_2', { height: 0.72, diameter: 0.038 }, this.scene);
    sgBarrel2.parent = shotgunNode;
    sgBarrel2.position.set(0.02, 0.02, 0.32);
    sgBarrel2.rotation.x = Math.PI / 2;
    sgBarrel2.material = matIron;

    this.weaponMeshes.set('shotgun_double', shotgunNode);

    // 4. Pine Recurve Bow
    const bowNode = new BABYLON.TransformNode('vm_bow', this.scene);
    bowNode.parent = this.weaponViewModelRoot;

    const bowCurve = BABYLON.MeshBuilder.CreateTorus('bow_arc', { diameter: 0.7, thickness: 0.03, tessellation: 20 }, this.scene);
    bowCurve.parent = bowNode;
    bowCurve.position.set(0, 0, 0.18);
    bowCurve.rotation.y = Math.PI / 2;
    bowCurve.scaling.set(0.4, 1.2, 0.5);
    bowCurve.material = matWood;

    const bowString = BABYLON.MeshBuilder.CreateCylinder('bow_string', { height: 0.75, diameter: 0.006 }, this.scene);
    bowString.parent = bowNode;
    bowString.position.set(0, 0, 0.05);
    bowString.material = matIron;

    this.weaponMeshes.set('bow_pine', bowNode);

    // 5. Frontier Bowie Knife
    const knifeNode = new BABYLON.TransformNode('vm_knife', this.scene);
    knifeNode.parent = this.weaponViewModelRoot;

    const knifeHandle = BABYLON.MeshBuilder.CreateCylinder('knife_h', { height: 0.16, diameter: 0.03 }, this.scene);
    knifeHandle.parent = knifeNode;
    knifeHandle.position.set(0, -0.06, 0);
    knifeHandle.material = matWood;

    const knifeGuard = BABYLON.MeshBuilder.CreateBox('knife_g', { width: 0.08, height: 0.015, depth: 0.04 }, this.scene);
    knifeGuard.parent = knifeNode;
    knifeGuard.position.set(0, 0.02, 0);
    knifeGuard.material = matBrass;

    const knifeBlade = BABYLON.MeshBuilder.CreateBox('knife_b', { width: 0.012, height: 0.28, depth: 0.045 }, this.scene);
    knifeBlade.parent = knifeNode;
    knifeBlade.position.set(0, 0.16, 0.01);
    knifeBlade.material = matIron;

    this.weaponMeshes.set('knife_hunter', knifeNode);

    // Muzzle Flash Light & Orange Burst
    this.muzzleFlashLight = new BABYLON.PointLight('MuzzleLight', new BABYLON.Vector3(0, 0.04, 0.8), this.scene);
    this.muzzleFlashLight.parent = this.weaponViewModelRoot;
    this.muzzleFlashLight.intensity = 0;
    this.muzzleFlashLight.range = 14;
    this.muzzleFlashLight.diffuse = new BABYLON.Color3(1.0, 0.75, 0.25);

    this.muzzleFlashMesh = BABYLON.MeshBuilder.CreateDisc('MuzzleFlashDisc', { radius: 0.22 }, this.scene);
    this.muzzleFlashMesh.parent = this.weaponViewModelRoot;
    this.muzzleFlashMesh.position.set(0, 0.03, 0.82);
    this.muzzleFlashMesh.isVisible = false;
    const flashMat = new BABYLON.StandardMaterial('flashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1.0, 0.85, 0.35);
    flashMat.disableLighting = true;
    this.muzzleFlashMesh.material = flashMat;
  }

  public setQuality(level: QualityLevel): void {
    this.quality = level;
    if (this.assetLoader) {
      this.assetLoader.setQuality(level);
    }
    if (!this.scene || !this.camera) return;

    if (level === 'LOW') {
      this.scene.shadowsEnabled = false;
      this.camera.maxZ = 300;
    } else if (level === 'MEDIUM') {
      this.scene.shadowsEnabled = true;
      this.camera.maxZ = 450;
      if (this.shadowGenerator) this.shadowGenerator.mapSize = 512;
    } else if (level === 'HIGH') {
      this.scene.shadowsEnabled = true;
      this.camera.maxZ = 650;
      if (this.shadowGenerator) this.shadowGenerator.mapSize = 1024;
    } else if (level === 'ULTRA') {
      this.scene.shadowsEnabled = true;
      this.camera.maxZ = 850;
      if (this.shadowGenerator) this.shadowGenerator.mapSize = 2048;
    }
  }

  private async initMaterials(): Promise<void> {
    if (!this.scene || !this.assetLoader) return;

    // 1. Load All Environment PBR Texture Maps (Normal Maps, ORM Packed Maps, Albedo) via Asset Loader
    const envMaterials = await this.assetLoader.loadAllEnvironmentMaterials();
    this.materials = { ...envMaterials };

    // 2. Fallback/standard PBR helper for actors, wildlife & props
    const createBasicPBR = (name: string, color: [number, number, number], roughness: number, metallic: number = 0, alpha: number = 1) => {
      const mat = new BABYLON.PBRMaterial(name, this.scene!);
      mat.albedoColor = new BABYLON.Color3(...color);
      mat.roughness = roughness;
      mat.metallic = metallic;
      mat.alpha = alpha;
      this.materials[name] = mat;
      return mat;
    };

    createBasicPBR('skin', [0.65, 0.42, 0.32], 0.5);
    createBasicPBR('cloth_player', [0.15, 0.2, 0.24], 0.75);
    createBasicPBR('cloth_sheriff', [0.22, 0.25, 0.18], 0.7);
    createBasicPBR('cloth_hunter', [0.32, 0.26, 0.15], 0.8);
    createBasicPBR('cloth_outlaw', [0.25, 0.12, 0.12], 0.85);
    createBasicPBR('cloth_civilian', [0.35, 0.3, 0.25], 0.8);

    // High-fidelity Alpine Water Material
    const waterMat = createBasicPBR('water', [0.06, 0.26, 0.32], 0.05, 0.12, 0.88);
    waterMat.subSurface.isRefractionEnabled = true;
    waterMat.subSurface.indexOfRefraction = 1.333;
    waterMat.directIntensity = 1.4;
    waterMat.specularIntensity = 1.8;

    createBasicPBR('deer_pelt', [0.45, 0.28, 0.14], 0.85);
    createBasicPBR('wolf_pelt', [0.35, 0.35, 0.36], 0.9);
    createBasicPBR('bear_pelt', [0.18, 0.12, 0.08], 0.95);
    createBasicPBR('arrow_wood', [0.55, 0.45, 0.3], 0.6);
  }

  private initLighting(): void {
    if (!this.scene) return;

    this.sun = new BABYLON.DirectionalLight('Sun', new BABYLON.Vector3(-0.4, -0.9, 0.3), this.scene);
    this.sun.intensity = 1.8;

    this.hemi = new BABYLON.HemisphericLight('Hemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    this.hemi.intensity = 0.6;
    this.hemi.groundColor = new BABYLON.Color3(0.08, 0.07, 0.06);

    try {
      const shadowRes = this.quality === 'ULTRA' ? 2048 : this.quality === 'HIGH' ? 1024 : 512;
      this.shadowGenerator = new BABYLON.ShadowGenerator(shadowRes, this.sun);
      this.shadowGenerator.usePoissonSampling = true;
      this.shadowGenerator.bias = 0.001;
    } catch {
      // Fallback if shadows unsupported
    }
  }

  buildWorldMesh(world: WorldGenerator, trees: TreeData[]): void {
    if (!this.scene) return;

    // 1. Terrain Grid (190x190 units, 80 subdivisions)
    const size = 190;
    const subdivisions = this.quality === 'LOW' ? 50 : 80;
    const terrain = BABYLON.MeshBuilder.CreateGround('TerrainMesh', {
      width: size,
      height: size,
      subdivisions
    }, this.scene);

    const positions = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        positions[i + 1] = world.height(x, z);
      }
      terrain.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      const normals: number[] = [];
      BABYLON.VertexData.ComputeNormals(positions, terrain.getIndices()!, normals);
      terrain.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    }

    terrain.material = this.materials.terrain_grass;
    terrain.receiveShadows = true;

    // 2. Mud Road Ribbon Mesh (Traversing Village center with glossy wet puddle PBR material)
    const roadPoints: BABYLON.Vector3[] = [];
    for (let rx = -20; rx <= 55; rx += 2.5) {
      const rz = Math.sin(rx * 0.03) * 6 + 16;
      const ry = world.height(rx, rz) + 0.04;
      roadPoints.push(new BABYLON.Vector3(rx, ry, rz));
    }

    // Build curved road ribbon using tube/ribbon
    const roadPaths: BABYLON.Vector3[][] = [[], []];
    for (let i = 0; i < roadPoints.length; i++) {
      const p = roadPoints[i];
      const nextP = roadPoints[Math.min(roadPoints.length - 1, i + 1)];
      const dir = nextP.subtract(p).normalize();
      const norm = new BABYLON.Vector3(-dir.z, 0, dir.x).normalize();
      const halfWidth = 2.4;

      const pLeft = p.add(norm.scale(halfWidth));
      const pRight = p.subtract(norm.scale(halfWidth));
      pLeft.y = world.height(pLeft.x, pLeft.z) + 0.04;
      pRight.y = world.height(pRight.x, pRight.z) + 0.04;

      roadPaths[0].push(pLeft);
      roadPaths[1].push(pRight);
    }

    const roadMesh = BABYLON.MeshBuilder.CreateRibbon('VillageRoadMud', {
      pathArray: roadPaths,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, this.scene);
    roadMesh.material = this.materials.mud_soil;
    roadMesh.receiveShadows = true;

    // 3. Lake Shoreline Mud/Sand Bank Ring
    const shorelinePoints: BABYLON.Vector3[][] = [[], []];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const u = Math.cos(theta) * 64;
      const v = Math.sin(theta) * 31;
      // Rotate 45 deg
      const x = 15 + (u * 0.7071 - v * 0.7071);
      const z = -35 + (u * 0.7071 + v * 0.7071);
      const y = world.height(x, z) + 0.03;

      const uOut = Math.cos(theta) * 68;
      const vOut = Math.sin(theta) * 35;
      const xOut = 15 + (uOut * 0.7071 - vOut * 0.7071);
      const zOut = -35 + (uOut * 0.7071 + vOut * 0.7071);
      const yOut = world.height(xOut, zOut) + 0.03;

      shorelinePoints[0].push(new BABYLON.Vector3(x, y, z));
      shorelinePoints[1].push(new BABYLON.Vector3(xOut, yOut, zOut));
    }

    const shorelineMesh = BABYLON.MeshBuilder.CreateRibbon('ShorelineMud', {
      pathArray: shorelinePoints,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, this.scene);
    shorelineMesh.material = this.materials.mud_soil;
    shorelineMesh.receiveShadows = true;

    // 4. Lake Water Mesh (Flathead Lake Elongated Ellipse Basin at 15, -35)
    this.waterMesh = BABYLON.MeshBuilder.CreateDisc('LakeWater', {
      radius: 65,
      tessellation: this.quality === 'LOW' ? 32 : 64
    }, this.scene);
    this.waterMesh.position.set(15, 0.72, -35);
    this.waterMesh.rotation.x = Math.PI / 2;
    this.waterMesh.rotation.z = Math.PI / 4; // 45 deg tilt for NW to SE elongation
    this.waterMesh.scaling.x = 1.15;
    this.waterMesh.scaling.y = 0.62;
    this.waterMesh.material = this.materials.water;

    // 5. High-Fidelity 3-Tier Pine Trees with Bark PBR & Layered Canopies
    const trunkBase = BABYLON.MeshBuilder.CreateCylinder('TrunkBase', { height: 4.2, diameterBottom: 0.42, diameterTop: 0.28 }, this.scene);
    trunkBase.material = this.materials.bark_pine;
    trunkBase.isVisible = false;

    const crownTier1 = BABYLON.MeshBuilder.CreateCylinder('CrownTier1', { height: 2.2, diameterTop: 0.4, diameterBottom: 3.2, tessellation: 7 }, this.scene);
    crownTier1.material = this.materials.needle_pine;
    crownTier1.isVisible = false;

    const crownTier2 = BABYLON.MeshBuilder.CreateCylinder('CrownTier2', { height: 2.0, diameterTop: 0.2, diameterBottom: 2.4, tessellation: 7 }, this.scene);
    crownTier2.material = this.materials.needle_pine;
    crownTier2.isVisible = false;

    const crownTier3 = BABYLON.MeshBuilder.CreateCylinder('CrownTier3', { height: 1.8, diameterTop: 0.04, diameterBottom: 1.6, tessellation: 7 }, this.scene);
    crownTier3.material = this.materials.needle_pine;
    crownTier3.isVisible = false;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const s = t.scale;

      const trunk = trunkBase.createInstance(`trunk_${i}`);
      trunk.position.set(t.x, t.y + (4.2 * s) / 2, t.z);
      trunk.scaling.set(s, s, s);

      const c1 = crownTier1.createInstance(`crown1_${i}`);
      c1.position.set(t.x, t.y + 2.4 * s, t.z);
      c1.scaling.set(s, s, s);

      const c2 = crownTier2.createInstance(`crown2_${i}`);
      c2.position.set(t.x, t.y + 3.6 * s, t.z);
      c2.scaling.set(s * 0.95, s * 0.95, s * 0.95);

      const c3 = crownTier3.createInstance(`crown3_${i}`);
      c3.position.set(t.x, t.y + 4.8 * s, t.z);
      c3.scaling.set(s * 0.9, s * 0.9, s * 0.9);

      if (this.shadowGenerator && i % 3 === 0 && this.quality !== 'LOW') {
        this.shadowGenerator.addShadowCaster(c1);
        this.shadowGenerator.addShadowCaster(c2);
      }
    }

    // 6. Natural Stone Boulders & Rock Outcroppings (Showcasing Stone PBR specular & normal relief)
    const rockLocations = [
      { x: 32, z: 2, scale: 2.4, rotY: 0.4 },
      { x: 42, z: 28, scale: 3.2, rotY: 1.2 },
      { x: -14, z: -18, scale: 2.0, rotY: 0.8 },
      { x: -35, z: 15, scale: 3.5, rotY: 2.1 },
      { x: 2, z: -48, scale: 2.8, rotY: 1.5 },
      { x: 48, z: 42, scale: 4.0, rotY: 0.2 },
      { x: -28, z: -35, scale: 2.2, rotY: 2.7 }
    ];

    const boulderBase = BABYLON.MeshBuilder.CreatePolyhedron('BoulderBase', {
      type: 1, // Icosahedron with rugged faceted relief
      size: 1.0
    }, this.scene);
    boulderBase.material = this.materials.stone_rock;
    boulderBase.isVisible = false;

    for (let i = 0; i < rockLocations.length; i++) {
      const r = rockLocations[i];
      const ry = world.height(r.x, r.z) + r.scale * 0.4;
      const rock = boulderBase.createInstance(`rock_boulder_${i}`);
      rock.position.set(r.x, ry, r.z);
      rock.scaling.set(r.scale * 1.2, r.scale * 0.85, r.scale);
      rock.rotation.set(0.3, r.rotY, 0.2);
      rock.receiveShadows = true;

      if (this.shadowGenerator && this.quality !== 'LOW') {
        this.shadowGenerator.addShadowCaster(rock);
      }
    }

    // 7. Village Buildings with Porches, Glowing Glass Windows, Doors & Lanterns
    this.lanternLights = [];
    this.windowMaterials = [];

    for (const b of VILLAGE_BUILDINGS) {
      const root = new BABYLON.TransformNode(`building_${b.name}`, this.scene);
      const by = world.height(b.x, b.z);
      root.position.set(b.x, by, b.z);

      if (b.type === 'dock') {
        // Flat timber dock planks extending into lake with weathered wood PBR
        const dockMesh = BABYLON.MeshBuilder.CreateBox(`${b.name}_planks`, { width: b.w, height: 0.3, depth: b.d }, this.scene);
        dockMesh.parent = root;
        dockMesh.position.y = 0.85;
        dockMesh.material = this.materials.dock_wood;

        // Timber pilings supporting dock in lake bed
        for (let pz = -b.d / 2 + 1.5; pz <= b.d / 2 - 1.5; pz += 3.5) {
          const postL = BABYLON.MeshBuilder.CreateCylinder(`dock_post_${pz}_L`, { height: 2.2, diameter: 0.28 }, this.scene);
          postL.parent = root;
          postL.position.set(-b.w / 2 + 0.3, 0.0, pz);
          postL.material = this.materials.dock_wood;

          const postR = BABYLON.MeshBuilder.CreateCylinder(`dock_post_${pz}_R`, { height: 2.2, diameter: 0.28 }, this.scene);
          postR.parent = root;
          postR.position.set(b.w / 2 - 0.3, 0.0, pz);
          postR.material = this.materials.dock_wood;
        }

        // Dock Hanging Lantern at the end of the pier
        const dockLanternMesh = BABYLON.MeshBuilder.CreateBox('dock_lantern', { width: 0.3, height: 0.45, depth: 0.3 }, this.scene);
        dockLanternMesh.parent = root;
        dockLanternMesh.position.set(0, 1.8, b.d / 2 - 0.8);
        dockLanternMesh.material = this.materials.iron_metal || this.materials.stone_rock;

        if (this.quality !== 'LOW') {
          const dLight = new BABYLON.PointLight(`light_dock`, new BABYLON.Vector3(b.x, by + 1.8, b.z + b.d / 2 - 0.8), this.scene);
          dLight.diffuse = new BABYLON.Color3(1.0, 0.72, 0.35);
          dLight.specular = new BABYLON.Color3(1.0, 0.8, 0.4);
          dLight.range = 14;
          dLight.intensity = 1.2;
          this.lanternLights.push({ light: dLight, baseIntensity: 1.2, flickerSeed: Math.random() * 100 });
        }
        continue;
      }

      // Stone Foundation Plinth beneath buildings
      const foundationH = 0.6;
      const foundation = BABYLON.MeshBuilder.CreateBox(`${b.name}_foundation`, {
        width: b.w + 0.3,
        height: foundationH,
        depth: b.d + 0.3
      }, this.scene);
      foundation.parent = root;
      foundation.position.y = foundationH / 2;
      foundation.material = this.materials.stone_rock;

      // Building Walls (Stone for Hideout, Timber Wood for village buildings)
      const isStoneFortress = b.type === 'hideout';
      const wallMat = isStoneFortress ? this.materials.stone_rock : this.materials.building_wood;

      const wall = BABYLON.MeshBuilder.CreateBox(`${b.name}_walls`, { width: b.w, height: b.h, depth: b.d }, this.scene);
      wall.parent = root;
      wall.position.y = foundationH + b.h / 2;
      wall.material = wallMat;

      // Front Covered Porch / Veranda (for Tavern, Sheriff, Shop, Lodge)
      if (b.type === 'tavern' || b.type === 'sheriff' || b.type === 'shop' || b.type === 'lodge') {
        const porchDepth = 2.2;
        const porchDeck = BABYLON.MeshBuilder.CreateBox(`${b.name}_porch_deck`, {
          width: b.w + 0.2,
          height: 0.25,
          depth: porchDepth
        }, this.scene);
        porchDeck.parent = root;
        porchDeck.position.set(0, foundationH - 0.1, -b.d / 2 - porchDepth / 2);
        porchDeck.material = this.materials.dock_wood || this.materials.building_wood;

        // Porch Support Timber Columns
        for (const colX of [-b.w / 2 + 0.3, b.w / 2 - 0.3]) {
          const col = BABYLON.MeshBuilder.CreateCylinder(`${b.name}_porch_col_${colX}`, { height: b.h * 0.85, diameter: 0.22 }, this.scene);
          col.parent = root;
          col.position.set(colX, foundationH + (b.h * 0.85) / 2, -b.d / 2 - porchDepth + 0.2);
          col.material = this.materials.building_wood;
        }

        // Porch Overhang Roof
        const porchRoof = BABYLON.MeshBuilder.CreateBox(`${b.name}_porch_roof`, {
          width: b.w + 0.4,
          height: 0.18,
          depth: porchDepth + 0.4
        }, this.scene);
        porchRoof.parent = root;
        porchRoof.position.set(0, foundationH + b.h * 0.88, -b.d / 2 - porchDepth / 2);
        porchRoof.rotation.x = 0.08;
        porchRoof.material = this.materials.building_roof;

        // Porch Lantern
        const lanternMesh = BABYLON.MeshBuilder.CreateBox(`${b.name}_lantern`, { width: 0.25, height: 0.4, depth: 0.25 }, this.scene);
        lanternMesh.parent = root;
        lanternMesh.position.set(0, foundationH + b.h * 0.78, -b.d / 2 - porchDepth * 0.6);
        lanternMesh.material = this.materials.iron_metal || this.materials.stone_rock;

        if (this.quality !== 'LOW') {
          const pLight = new BABYLON.PointLight(`light_${b.name}`, new BABYLON.Vector3(b.x, by + foundationH + b.h * 0.75, b.z - b.d / 2 - porchDepth * 0.6), this.scene);
          pLight.diffuse = new BABYLON.Color3(1.0, 0.75, 0.38);
          pLight.specular = new BABYLON.Color3(1.0, 0.85, 0.45);
          pLight.range = 16;
          pLight.intensity = b.type === 'tavern' ? 1.6 : 1.2;
          this.lanternLights.push({ light: pLight, baseIntensity: pLight.intensity, flickerSeed: Math.random() * 100 });
        }
      }

      // Wooden Door with Iron Handle
      const doorMesh = BABYLON.MeshBuilder.CreateBox(`${b.name}_door`, { width: 1.2, height: 2.1, depth: 0.12 }, this.scene);
      doorMesh.parent = root;
      doorMesh.position.set(0, foundationH + 1.05, -b.d / 2 - 0.02);
      doorMesh.material = this.materials.building_wood;

      const handleMesh = BABYLON.MeshBuilder.CreateSphere(`${b.name}_handle`, { diameter: 0.12 }, this.scene);
      handleMesh.parent = doorMesh;
      handleMesh.position.set(0.42, 0.0, -0.08);
      handleMesh.material = this.materials.iron_metal || this.materials.stone_rock;

      // Multi-Pane Glowing Windows
      const winMat = this.materials.window_glass;
      if (winMat) {
        this.windowMaterials.push(winMat);
      }

      const windowPositions = [
        { x: -b.w / 3, y: foundationH + 1.6, z: -b.d / 2 - 0.02, rotY: 0 },
        { x: b.w / 3, y: foundationH + 1.6, z: -b.d / 2 - 0.02, rotY: 0 },
        { x: -b.w / 2 - 0.02, y: foundationH + 1.6, z: 0, rotY: Math.PI / 2 },
        { x: b.w / 2 + 0.02, y: foundationH + 1.6, z: 0, rotY: Math.PI / 2 }
      ];

      for (let wIdx = 0; wIdx < windowPositions.length; wIdx++) {
        const wp = windowPositions[wIdx];
        const win = BABYLON.MeshBuilder.CreatePlane(`${b.name}_win_${wIdx}`, { width: 1.1, height: 1.3 }, this.scene);
        win.parent = root;
        win.position.set(wp.x, wp.y, wp.z);
        win.rotation.y = wp.rotY;
        win.material = winMat || this.materials.stone_rock;
      }

      // Stone Fireplace Chimney on Tavern, Sheriff & Lodge
      if (b.type === 'tavern' || b.type === 'sheriff' || b.type === 'lodge') {
        const chimney = BABYLON.MeshBuilder.CreateBox(`${b.name}_chimney`, { width: 1.2, height: b.h + 1.8, depth: 1.2 }, this.scene);
        chimney.parent = root;
        chimney.position.set(b.w / 2 - 0.2, (b.h + 1.8) / 2, 0);
        chimney.material = this.materials.stone_rock;
        if (this.shadowGenerator && this.quality !== 'LOW') {
          this.shadowGenerator.addShadowCaster(chimney);
        }
      }

      // Shingle Roof
      const roof = BABYLON.MeshBuilder.CreateCylinder(`${b.name}_roof`, {
        diameter: b.w * 1.25,
        height: b.d * 1.05,
        tessellation: 4
      }, this.scene);
      roof.parent = root;
      roof.rotation.z = Math.PI / 2;
      roof.scaling.y = 0.45;
      roof.position.y = foundationH + b.h + 0.8;
      roof.material = this.materials.building_roof;

      if (this.shadowGenerator && this.quality !== 'LOW') {
        this.shadowGenerator.addShadowCaster(wall);
        this.shadowGenerator.addShadowCaster(roof);
        this.shadowGenerator.addShadowCaster(foundation);
      }
    }

    // 8. Campfire Pits (Village Gathering & Bandit Ridge)
    const campfireLocations = [
      { x: 18, z: 22, name: 'village_campfire' },
      { x: -44, z: 30, name: 'bandit_campfire' }
    ];

    for (const cp of campfireLocations) {
      const cy = world.height(cp.x, cp.z);
      const cpRoot = new BABYLON.TransformNode(cp.name, this.scene);
      cpRoot.position.set(cp.x, cy, cp.z);

      // Stone ring around fire pit
      const ring = BABYLON.MeshBuilder.CreateTorus(`${cp.name}_stones`, { diameter: 1.6, thickness: 0.28, tessellation: 12 }, this.scene);
      ring.parent = cpRoot;
      ring.position.y = 0.12;
      ring.material = this.materials.stone_rock;

      // Charred firewood logs in campfire center
      for (let l = 0; l < 4; l++) {
        const log = BABYLON.MeshBuilder.CreateCylinder(`${cp.name}_log_${l}`, { height: 1.2, diameter: 0.18 }, this.scene);
        log.parent = cpRoot;
        log.position.y = 0.2;
        log.rotation.set(0.2, (l * Math.PI) / 2 + 0.3, 0.4);
        log.material = this.materials.bark_pine || this.materials.building_wood;
      }

      // Campfire warm flickering Point Light
      if (this.quality !== 'LOW') {
        const cLight = new BABYLON.PointLight(`light_${cp.name}`, new BABYLON.Vector3(cp.x, cy + 0.6, cp.z), this.scene);
        cLight.diffuse = new BABYLON.Color3(1.0, 0.55, 0.15);
        cLight.specular = new BABYLON.Color3(1.0, 0.65, 0.25);
        cLight.range = 18;
        cLight.intensity = 2.0;
        this.lanternLights.push({ light: cLight, baseIntensity: 2.0, flickerSeed: Math.random() * 100 });
      }
    }

    // 9. Environmental Village Props (Crates, Barrels, Woodcutter Log Piles)
    const propConfigs = [
      { x: 9, z: 15, type: 'crate_stack' },
      { x: 23, z: 32, type: 'barrels' },
      { x: 37, z: 38, type: 'timber_pile' },
      { x: 14, z: -10, type: 'dock_crates' }
    ];

    for (let pIdx = 0; pIdx < propConfigs.length; pIdx++) {
      const p = propConfigs[pIdx];
      const py = world.height(p.x, p.z);
      const propRoot = new BABYLON.TransformNode(`prop_${pIdx}`, this.scene);
      propRoot.position.set(p.x, py, p.z);

      if (p.type === 'crate_stack' || p.type === 'dock_crates') {
        const crate1 = BABYLON.MeshBuilder.CreateBox(`crate_${pIdx}_1`, { size: 0.9 }, this.scene);
        crate1.parent = propRoot;
        crate1.position.set(0, 0.45, 0);
        crate1.material = this.materials.building_wood;

        const crate2 = BABYLON.MeshBuilder.CreateBox(`crate_${pIdx}_2`, { size: 0.75 }, this.scene);
        crate2.parent = propRoot;
        crate2.position.set(0.15, 1.25, 0.1);
        crate2.rotation.y = 0.35;
        crate2.material = this.materials.building_wood;
      } else if (p.type === 'barrels') {
        const barrel1 = BABYLON.MeshBuilder.CreateCylinder(`barrel_${pIdx}_1`, { height: 1.1, diameter: 0.7 }, this.scene);
        barrel1.parent = propRoot;
        barrel1.position.set(-0.4, 0.55, 0);
        barrel1.material = this.materials.building_wood;

        const barrel2 = BABYLON.MeshBuilder.CreateCylinder(`barrel_${pIdx}_2`, { height: 1.1, diameter: 0.7 }, this.scene);
        barrel2.parent = propRoot;
        barrel2.position.set(0.4, 0.55, 0.2);
        barrel2.material = this.materials.building_wood;
      } else if (p.type === 'timber_pile') {
        for (let t = 0; t < 5; t++) {
          const timber = BABYLON.MeshBuilder.CreateCylinder(`timber_${pIdx}_${t}`, { height: 3.2, diameter: 0.35 }, this.scene);
          timber.parent = propRoot;
          timber.rotation.z = Math.PI / 2;
          timber.rotation.y = 0.1 * t;
          timber.position.set(0, 0.2 + (t % 2) * 0.35, (t - 2) * 0.4);
          timber.material = this.materials.bark_pine || this.materials.building_wood;
        }
      }
    }

    // 10. Target Practice Shooting Range (Archery & Firearms Bullseyes)
    this.targetStands = [];
    const targetConfigs = [
      { x: 38, z: 24, name: 'target_lodge_1' },
      { x: 44, z: 28, name: 'target_lodge_2' },
      { x: -14, z: 22, name: 'target_west_1' }
    ];

    for (const tc of targetConfigs) {
      const ty = world.height(tc.x, tc.z);
      const tRoot = new BABYLON.TransformNode(tc.name, this.scene);
      tRoot.position.set(tc.x, ty, tc.z);

      // Wooden tripod legs
      const leg1 = BABYLON.MeshBuilder.CreateCylinder(`${tc.name}_leg1`, { height: 2.2, diameter: 0.12 }, this.scene);
      leg1.parent = tRoot;
      leg1.position.set(-0.35, 1.0, -0.2);
      leg1.rotation.z = -0.2;
      leg1.material = this.materials.building_wood;

      const leg2 = BABYLON.MeshBuilder.CreateCylinder(`${tc.name}_leg2`, { height: 2.2, diameter: 0.12 }, this.scene);
      leg2.parent = tRoot;
      leg2.position.set(0.35, 1.0, -0.2);
      leg2.rotation.z = 0.2;
      leg2.material = this.materials.building_wood;

      const leg3 = BABYLON.MeshBuilder.CreateCylinder(`${tc.name}_leg3`, { height: 2.2, diameter: 0.12 }, this.scene);
      leg3.parent = tRoot;
      leg3.position.set(0, 1.0, 0.35);
      leg3.rotation.x = -0.25;
      leg3.material = this.materials.building_wood;

      // Straw circular backing disc
      const targetDisc = BABYLON.MeshBuilder.CreateCylinder(`${tc.name}_disc`, { height: 0.18, diameter: 1.4 }, this.scene);
      targetDisc.parent = tRoot;
      targetDisc.position.set(0, 1.5, 0);
      targetDisc.rotation.x = Math.PI / 2;
      targetDisc.material = this.materials.building_wood;

      // Concentric Bullseye rings
      const ringOuter = BABYLON.MeshBuilder.CreateDisc(`${tc.name}_outer`, { radius: 0.65 }, this.scene);
      ringOuter.parent = targetDisc;
      ringOuter.position.y = 0.1;
      ringOuter.material = this.materials.cloth_player || this.materials.stone_rock;

      const ringInner = BABYLON.MeshBuilder.CreateDisc(`${tc.name}_inner`, { radius: 0.25 }, this.scene);
      ringInner.parent = targetDisc;
      ringInner.position.y = 0.11;
      ringInner.material = this.materials.cloth_outlaw || this.materials.stone_rock;

      this.targetStands.push({
        root: tRoot,
        pos: [tc.x, ty + 1.5, tc.z],
        radius: 0.7
      });
    }
  }

  createHumanoidRig(id: number, name: string, clothType: string, isPlayer: boolean): HumanoidRig {
    if (!this.scene) throw new Error('Scene not initialized');

    const root = new BABYLON.TransformNode(`human_${name}_${id}`, this.scene);

    const matCloth = this.materials[clothType] || this.materials.cloth_civilian;
    const matSkin = this.materials.skin;

    // Torso & Vest
    const torso = BABYLON.MeshBuilder.CreateBox('torso', { width: 0.58, height: 0.82, depth: 0.32 }, this.scene);
    torso.parent = root;
    torso.position.y = 1.25;
    torso.material = matCloth;

    // Head Neck & Pivot
    const headNode = new BABYLON.TransformNode('headNode', this.scene);
    headNode.parent = root;
    headNode.position.y = 1.78;

    const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.42, segments: 12 }, this.scene);
    head.parent = headNode;
    head.position.y = 0;
    head.material = matSkin;

    // Eyes
    const leftEye = BABYLON.MeshBuilder.CreateSphere('eyeL', { diameter: 0.06 }, this.scene);
    leftEye.parent = headNode;
    leftEye.position.set(-0.08, 0.02, 0.2);
    leftEye.material = matSkin;

    const rightEye = leftEye.clone('eyeR');
    rightEye.parent = headNode;
    rightEye.position.x = 0.08;

    // Western Cowboy Hat (Creased Crown + Wide Curved Brim + Leather Band)
    let hatNode: BABYLON.TransformNode | undefined;
    if (!isPlayer) {
      hatNode = new BABYLON.TransformNode('cowboy_hat', this.scene);
      hatNode.parent = headNode;
      hatNode.position.set(0, 0.2, 0);

      // Hat Brim
      const hatBrim = BABYLON.MeshBuilder.CreateCylinder('hat_brim', {
        height: 0.04,
        diameter: 0.88,
        tessellation: 16
      }, this.scene);
      hatBrim.parent = hatNode;
      hatBrim.scaling.z = 1.12;
      hatBrim.material = this.materials.building_wood || matCloth;

      // Hat Crown
      const hatCrown = BABYLON.MeshBuilder.CreateBox('hat_crown', {
        width: 0.38,
        height: 0.28,
        depth: 0.42
      }, this.scene);
      hatCrown.parent = hatNode;
      hatCrown.position.y = 0.14;
      hatCrown.material = this.materials.building_wood || matCloth;

      // Hat Leather Band
      const hatBand = BABYLON.MeshBuilder.CreateBox('hat_band', {
        width: 0.39,
        height: 0.06,
        depth: 0.43
      }, this.scene);
      hatBand.parent = hatNode;
      hatBand.position.y = 0.04;
      hatBand.material = this.materials.iron_metal || matCloth;
    }

    // Shoulder & Arm Hierarchical Pivots (Pivot sits at the shoulder joint, arm mesh extends downwards)
    const createArm = (name: string, shoulderX: number) => {
      const shoulderPivot = new BABYLON.TransformNode(`${name}_pivot`, this.scene!);
      shoulderPivot.parent = root;
      shoulderPivot.position.set(shoulderX, 1.58, 0);

      const armMesh = BABYLON.MeshBuilder.CreateCapsule(`${name}_mesh`, {
        height: 0.72,
        radius: 0.1
      }, this.scene!);
      armMesh.parent = shoulderPivot;
      armMesh.position.set(0, -0.32, 0); // Offset down from shoulder joint
      armMesh.material = matCloth;

      // Hand
      const hand = BABYLON.MeshBuilder.CreateSphere(`${name}_hand`, { diameter: 0.14 }, this.scene!);
      hand.parent = shoulderPivot;
      hand.position.set(0, -0.66, 0);
      hand.material = matSkin;

      return shoulderPivot;
    };

    // Hip & Leg Hierarchical Pivots (Pivot sits at the hip joint, leg mesh extends downwards)
    const createLeg = (name: string, hipX: number) => {
      const hipPivot = new BABYLON.TransformNode(`${name}_pivot`, this.scene!);
      hipPivot.parent = root;
      hipPivot.position.set(hipX, 0.88, 0);

      const legMesh = BABYLON.MeshBuilder.CreateCapsule(`${name}_mesh`, {
        height: 0.84,
        radius: 0.11
      }, this.scene!);
      legMesh.parent = hipPivot;
      legMesh.position.set(0, -0.38, 0); // Offset down from hip joint
      legMesh.material = matCloth;

      // Boot
      const boot = BABYLON.MeshBuilder.CreateBox(`${name}_boot`, {
        width: 0.16,
        height: 0.14,
        depth: 0.28
      }, this.scene!);
      boot.parent = hipPivot;
      boot.position.set(0, -0.78, 0.05);
      boot.material = this.materials.dock_wood || this.materials.building_wood;

      return hipPivot;
    };

    const leftArm = createArm('armL', -0.38);
    const rightArm = createArm('armR', 0.38);
    const leftLeg = createLeg('legL', -0.16);
    const rightLeg = createLeg('legR', 0.16);

    const rig: HumanoidRig = {
      root,
      torso,
      headNode,
      head,
      hat: hatNode,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftEye,
      rightEye,
      walkPhase: 0,
      baseTorsoY: 1.25,
      blinkTimer: Math.random() * 4 + 2
    };

    if (isPlayer) {
      this.playerRig = rig;
      // In first person, hide head & eyes to prevent camera clipping
      head.isVisible = false;
      leftEye.isVisible = false;
      rightEye.isVisible = false;
    } else {
      this.npcRigs.set(id, rig);
    }

    if (this.shadowGenerator && this.quality !== 'LOW') {
      this.shadowGenerator.addShadowCaster(torso);
    }

    return rig;
  }

  updateLightingTime(gameHour: number, isUnderwater: boolean = false): void {
    if (!this.sun || !this.hemi || !this.scene) return;

    if (isUnderwater) {
      // Atmospheric Murky Lake Underwater Caustics & Dense Turquoise Fog
      this.scene.clearColor = new BABYLON.Color4(0.03, 0.15, 0.22, 1.0);
      this.scene.fogColor = new BABYLON.Color3(0.04, 0.2, 0.28);
      this.scene.fogDensity = 0.045;
      this.sun.intensity = 0.45;
      this.hemi.intensity = 0.35;
      return;
    }

    this.scene.fogDensity = this.quality === 'LOW' ? 0.005 : 0.0035;

    // Solar angle according to 24h clock (sunrise 6am, noon 12pm, sunset 8pm)
    const sunAngle = ((gameHour - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    this.sun.direction.set(-sunX, -Math.max(0.06, sunY), 0.35).normalize();

    const isDay = sunY > 0;
    const daylight = clamp(sunY * 1.6, 0.04, 1.0);
    const isSunsetOrDawn = Math.abs(sunY) < 0.25;

    // Sun & Ambient intensities
    this.sun.intensity = isDay ? daylight * 2.0 : 0.08;
    this.hemi.intensity = 0.22 + daylight * 0.48;

    // Sun & Sky color transitions (Dawn rose/gold, Midday bright blue, Dusk fiery orange, Night deep cosmic navy)
    let skyR = 0.04, skyG = 0.06, skyB = 0.12;
    if (gameHour >= 5 && gameHour < 8) {
      // Dawn / Sunrise
      const t = (gameHour - 5) / 3;
      skyR = lerp(0.08, 0.58, t);
      skyG = lerp(0.1, 0.42, t);
      skyB = lerp(0.2, 0.48, t);
      this.sun.diffuse = new BABYLON.Color3(1.0, 0.82, 0.62);
    } else if (gameHour >= 8 && gameHour < 17) {
      // Midday Clear Sky
      skyR = 0.42;
      skyG = 0.58;
      skyB = 0.72;
      this.sun.diffuse = new BABYLON.Color3(1.0, 0.98, 0.92);
    } else if (gameHour >= 17 && gameHour < 21) {
      // Sunset / Golden Hour / Twilight
      const t = (gameHour - 17) / 4;
      skyR = lerp(0.55, 0.08, t);
      skyG = lerp(0.35, 0.06, t);
      skyB = lerp(0.25, 0.18, t);
      this.sun.diffuse = new BABYLON.Color3(1.0, 0.65, 0.35);
    } else {
      // Night / Deep Navy Moonlight
      skyR = 0.03;
      skyG = 0.04;
      skyB = 0.1;
      this.sun.diffuse = new BABYLON.Color3(0.5, 0.6, 0.85);
    }

    this.scene.clearColor = new BABYLON.Color4(skyR, skyG, skyB, 1.0);
    this.scene.fogColor = new BABYLON.Color3(skyR * 0.85, skyG * 0.85, skyB * 0.85);

    // Dynamic Lantern & Campfire Point Lights Flame Flicker Simulation
    const now = Date.now() * 0.005;
    for (let i = 0; i < this.lanternLights.length; i++) {
      const entry = this.lanternLights[i];
      const s = entry.flickerSeed;
      const flicker =
        Math.sin(now * 3.2 + s) * 0.12 +
        Math.sin(now * 7.4 + s * 2) * 0.08 +
        Math.sin(now * 15.1 + s * 3) * 0.05;

      // Lanterns are more prominent at night/dusk
      const timeFactor = daylight < 0.6 ? 1.3 : 0.85;
      entry.light.intensity = Math.max(0.2, entry.baseIntensity * timeFactor * (1.0 + flicker));
    }

    // Dynamic Emissive Window Glass Night Glow
    const nightGlow = clamp((1.0 - daylight) * 1.5, 0, 1.0);
    for (const winMat of this.windowMaterials) {
      winMat.emissiveColor = new BABYLON.Color3(0.95 * nightGlow, 0.72 * nightGlow, 0.32 * nightGlow);
    }

    // Realistic Water Surface Wave Height & Glint Oscillation
    if (this.waterMesh) {
      this.waterMesh.position.y = 0.72 + Math.sin(Date.now() * 0.0018) * 0.035;
    }
  }

  updateCamera(pos: Vec3, yaw: number, pitch: number, crouched: boolean, targetFov: number = Math.PI / 3): void {
    if (!this.camera) return;
    const eyeY = crouched ? pos.y + 1.15 : pos.y + 1.65;
    this.camera.position.set(pos.x, eyeY, pos.z);
    this.camera.rotation.set(pitch, yaw, 0);

    // Smooth FOV interpolation for Aim Down Sights (ADS)
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.22);
  }

  updateWeaponViewmodel(
    weaponId: string,
    isAiming: boolean,
    recoilKick: number,
    isMoving: boolean,
    dt: number
  ): void {
    if (!this.weaponViewModelRoot) return;

    // Toggle active weapon model
    this.weaponMeshes.forEach((node, id) => {
      node.setEnabled(id === weaponId);
    });

    // Determine target viewmodel position and rotation
    let targetX = 0.24;
    let targetY = -0.22;
    let targetZ = 0.48;
    let targetRotX = 0;
    let targetRotY = 0;

    if (isAiming) {
      // Centered ADS alignment with sights
      if (weaponId === 'rifle_repeater') {
        targetX = 0.0;
        targetY = -0.138;
        targetZ = 0.38;
      } else if (weaponId === 'revolver_colt') {
        targetX = 0.0;
        targetY = -0.155;
        targetZ = 0.36;
      } else if (weaponId === 'shotgun_double') {
        targetX = 0.0;
        targetY = -0.145;
        targetZ = 0.38;
      } else if (weaponId === 'bow_pine') {
        targetX = -0.06;
        targetY = -0.12;
        targetZ = 0.34;
      } else {
        targetX = 0.08;
        targetY = -0.16;
        targetZ = 0.36;
      }
    } else {
      // Natural walking sway/bobbing
      const time = Date.now() * 0.007;
      if (isMoving) {
        targetX += Math.sin(time) * 0.02;
        targetY += Math.abs(Math.cos(time)) * 0.015;
      }
    }

    // Apply recoil displacement (kicks back in Z and tilts up in X)
    targetZ -= recoilKick * 0.15;
    targetY += recoilKick * 0.04;
    targetRotX -= recoilKick * 0.25;

    // Smooth interpolation to target transform
    this.weaponViewModelRoot.position.x = lerp(this.weaponViewModelRoot.position.x, targetX, 0.25);
    this.weaponViewModelRoot.position.y = lerp(this.weaponViewModelRoot.position.y, targetY, 0.25);
    this.weaponViewModelRoot.position.z = lerp(this.weaponViewModelRoot.position.z, targetZ, 0.25);

    this.weaponViewModelRoot.rotation.x = lerp(this.weaponViewModelRoot.rotation.x, targetRotX, 0.3);
    this.weaponViewModelRoot.rotation.y = lerp(this.weaponViewModelRoot.rotation.y, targetRotY, 0.3);

    // Muzzle Flash Decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashLight) {
        this.muzzleFlashLight.intensity = Math.max(0, this.muzzleFlashTimer * 35.0);
      }
      if (this.muzzleFlashMesh && this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.isVisible = false;
      }
    }

    // Update active bullet tracers
    this.updateTracers(dt);
  }

  triggerMuzzleFlash(): void {
    this.muzzleFlashTimer = 0.06;
    if (this.muzzleFlashLight) {
      this.muzzleFlashLight.intensity = 3.5;
    }
    if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.isVisible = true;
      this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    }
  }

  addBulletTracer(from: [number, number, number], to: [number, number, number]): void {
    if (!this.scene) return;
    const startVec = new BABYLON.Vector3(...from);
    const endVec = new BABYLON.Vector3(...to);

    const lines = BABYLON.MeshBuilder.CreateLines(
      `tracer_${Date.now()}_${Math.random()}`,
      { points: [startVec, endVec] },
      this.scene
    );
    lines.color = new BABYLON.Color3(1.0, 0.85, 0.35);

    this.activeTracers.push({
      mesh: lines,
      age: 0,
      maxAge: 0.12
    });
  }

  private updateTracers(dt: number): void {
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.age += dt;
      if (tracer.age >= tracer.maxAge) {
        tracer.mesh.dispose();
        this.activeTracers.splice(i, 1);
      }
    }
  }

  animateNPCs(agents: NPCAgentData[], dt: number): void {
    for (const agent of agents) {
      const rig = this.npcRigs.get(agent.id);
      if (!rig) continue;

      if (agent.hp <= 0) {
        // Lay down if dead
        rig.root.rotation.x = Math.PI / 2;
        rig.root.position.set(agent.position[0], agent.position[1] + 0.2, agent.position[2]);
        continue;
      }

      rig.root.position.set(agent.position[0], agent.position[1], agent.position[2]);

      // Rotation towards heading
      const angle = Math.atan2(agent.heading[0], agent.heading[2]);
      rig.root.rotation.y = angle;

      const isSwimming = agent.state === 'SWIMMING';
      const isMoving = agent.state === 'WALKING' || agent.state === 'RUNNING' || agent.state === 'FLEEING' || agent.state === 'ATTACKING' || isSwimming;
      const strideSpeed = agent.state === 'RUNNING' || agent.state === 'FLEEING' ? 9 : isSwimming ? 3.2 : 4.5;

      if (isSwimming) {
        // Swimming breaststroke / flutter kick posture
        rig.root.rotation.x = Math.PI * 0.35;
        rig.walkPhase += dt * strideSpeed;
        const armStroke = Math.sin(rig.walkPhase) * 0.8;
        rig.leftArm.rotation.x = armStroke;
        rig.rightArm.rotation.x = -armStroke;
        rig.leftLeg.rotation.x = Math.sin(rig.walkPhase * 2) * 0.3;
        rig.rightLeg.rotation.x = -Math.sin(rig.walkPhase * 2) * 0.3;
      } else if (isMoving) {
        rig.root.rotation.x = 0;
        rig.walkPhase += dt * strideSpeed;
        const swing = Math.sin(rig.walkPhase) * 0.45;
        rig.leftLeg.rotation.x = -swing;
        rig.rightLeg.rotation.x = swing;
        rig.leftArm.rotation.x = swing * 0.7;
        rig.rightArm.rotation.x = -swing * 0.7;
      } else {
        rig.root.rotation.x = 0;
        rig.leftLeg.rotation.x = lerp(rig.leftLeg.rotation.x, 0, 0.1);
        rig.rightLeg.rotation.x = lerp(rig.rightLeg.rotation.x, 0, 0.1);
        rig.leftArm.rotation.x = lerp(rig.leftArm.rotation.x, 0, 0.1);
        rig.rightArm.rotation.x = lerp(rig.rightArm.rotation.x, 0, 0.1);
      }

      // Procedural breathing & weight shifting
      rig.torso.scaling.z = 1.0 + Math.sin(Date.now() * 0.003 + agent.id) * 0.03;

      // Eye blinking
      rig.blinkTimer -= dt;
      if (rig.blinkTimer <= 0) {
        rig.leftEye.scaling.y = 0.1;
        rig.rightEye.scaling.y = 0.1;
        if (rig.blinkTimer < -0.15) {
          rig.leftEye.scaling.y = 1.0;
          rig.rightEye.scaling.y = 1.0;
          rig.blinkTimer = Math.random() * 4 + 2.5;
        }
      }
    }
  }

  render(): void {
    this.scene?.render();
  }
}
