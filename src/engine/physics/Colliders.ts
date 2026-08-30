// #08 COLLISION & #07 PHYSICS - Colliders & Rigid Bodies
import { Vec3, Quat, clamp, lerp, EPS, quatRotateVector, quatRotateInv } from '../math';
import { Component, Entity, TransformComponent } from '../ecs';

export class AABB {
  constructor(
    public min: Vec3 = new Vec3(Infinity, Infinity, Infinity),
    public max: Vec3 = new Vec3(-Infinity, -Infinity, -Infinity)
  ) {}

  set(min: Vec3, max: Vec3): this {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }

  expandByPoint(p: Vec3): this {
    this.min.x = Math.min(this.min.x, p.x);
    this.min.y = Math.min(this.min.y, p.y);
    this.min.z = Math.min(this.min.z, p.z);
    this.max.x = Math.max(this.max.x, p.x);
    this.max.y = Math.max(this.max.y, p.y);
    this.max.z = Math.max(this.max.z, p.z);
    return this;
  }

  overlaps(b: AABB): boolean {
    return (
      this.min.x <= b.max.x && this.max.x >= b.min.x &&
      this.min.y <= b.max.y && this.max.y >= b.min.y &&
      this.min.z <= b.max.z && this.max.z >= b.min.z
    );
  }
}

export abstract class ColliderComponent extends Component {
  abstract bounds(pos: Vec3, rot?: Quat): AABB;
}

export class SphereCollider extends ColliderComponent {
  constructor(public radius: number = 0.5) {
    super();
    this.radius = Math.max(EPS, radius);
  }
  bounds(p: Vec3): AABB {
    return new AABB(
      new Vec3(p.x - this.radius, p.y - this.radius, p.z - this.radius),
      new Vec3(p.x + this.radius, p.y + this.radius, p.z + this.radius)
    );
  }
}

export class CapsuleCollider extends ColliderComponent {
  constructor(public radius: number = 0.38, public height: number = 1.75) {
    super();
    this.radius = Math.max(EPS, radius);
    this.height = Math.max(radius * 2, height);
  }
  segment(p: Vec3): [Vec3, Vec3] {
    const a = p.clone();
    a.y += this.radius;
    const b = p.clone();
    b.y += this.height - this.radius;
    return [a, b];
  }
  bounds(p: Vec3): AABB {
    return new AABB(
      new Vec3(p.x - this.radius, p.y, p.z - this.radius),
      new Vec3(p.x + this.radius, p.y + this.height, p.z + this.radius)
    );
  }
}

export class AABBCollider extends ColliderComponent {
  public half: Vec3;
  constructor(hxOrW: number | Vec3 = 0.5, hyOrH: number = 0.5, hzOrD: number = 0.5) {
    super();
    if (hxOrW instanceof Vec3) {
      this.half = hxOrW.clone();
    } else {
      this.half = new Vec3(hxOrW / 2, hyOrH / 2, hzOrD / 2);
    }
  }
  bounds(p: Vec3): AABB {
    return new AABB(
      new Vec3(p.x - this.half.x, p.y - this.half.y, p.z - this.half.z),
      new Vec3(p.x + this.half.x, p.y + this.half.y, p.z + this.half.z)
    );
  }
}

export class OBB extends ColliderComponent {
  constructor(public half: Vec3 = new Vec3(0.5, 0.5, 0.5)) {
    super();
  }
  axes(rot: Quat): [Vec3, Vec3, Vec3] {
    return [
      quatRotateVector(rot, new Vec3(1, 0, 0)).normalize(),
      quatRotateVector(rot, new Vec3(0, 1, 0)).normalize(),
      quatRotateVector(rot, new Vec3(0, 0, 1)).normalize()
    ];
  }
  bounds(p: Vec3, rot: Quat = new Quat()): AABB {
    const ax = this.axes(rot);
    const ex = Math.abs(ax[0].x) * this.half.x + Math.abs(ax[1].x) * this.half.y + Math.abs(ax[2].x) * this.half.z;
    const ey = Math.abs(ax[0].y) * this.half.x + Math.abs(ax[1].y) * this.half.y + Math.abs(ax[2].y) * this.half.z;
    const ez = Math.abs(ax[0].z) * this.half.x + Math.abs(ax[1].z) * this.half.y + Math.abs(ax[2].z) * this.half.z;
    return new AABB(
      new Vec3(p.x - ex, p.y - ey, p.z - ez),
      new Vec3(p.x + ex, p.y + ey, p.z + ez)
    );
  }
}

export class WaterVolume {
  constructor(
    public center: Vec3 = new Vec3(15, 0, -35),
    public radiusX: number = 65,
    public radiusZ: number = 32,
    public y: number = 0.75
  ) {}

  surfaceY(x: number, z: number, time: number = 0): number {
    return this.y + 0.06 * Math.sin((x + z) * 0.18 + time * 1.6);
  }

  contains(x: number, z: number): boolean {
    const u = (x - this.center.x) * 0.7071 + (z - this.center.z) * 0.7071;
    const v = -(x - this.center.x) * 0.7071 + (z - this.center.z) * 0.7071;
    return Math.hypot(u / this.radiusX, v / this.radiusZ) <= 1.05;
  }

  depthAt(p: Vec3, time: number = 0): number {
    return this.contains(p.x, p.z) ? Math.max(0, this.surfaceY(p.x, p.z, time) - p.y) : 0;
  }
}

export class Contact {
  public hit: boolean = false;
  public normal: Vec3 = new Vec3(0, 1, 0);
  public penetration: number = 0;
  public point: Vec3 = new Vec3();
}

export class RigidBody {
  public id: number;
  public mass: number;
  public inverseMass: number;
  public velocity: Vec3 = new Vec3();
  public angularVelocity: Vec3 = new Vec3();
  public forceAccumulator: Vec3 = new Vec3();
  public previousPosition: Vec3 = new Vec3();
  public active: boolean = true;
  public grounded: boolean = false;
  public groundNormal: Vec3 = new Vec3(0, 1, 0);
  public slopeAngle: number = 0;
  public waterState: 'AIR' | 'PARTIAL' | 'SUBMERGED' = 'AIR';
  public submergedFraction: number = 0;
  public sleeping: boolean = false;
  public sleepTimer: number = 0;
  public ccd: boolean = false;
  public restitution: number = 0.1;
  public friction: number = 0.5;

  constructor(public entity: Entity, opts: { mass?: number; ccd?: boolean; restitution?: number; friction?: number } = {}) {
    this.id = entity.id;
    this.mass = Math.max(0, opts.mass ?? 1);
    this.inverseMass = this.mass > EPS ? 1 / this.mass : 0;
    this.ccd = !!opts.ccd;
    this.restitution = opts.restitution ?? 0.1;
    this.friction = opts.friction ?? 0.5;
  }

  applyForce(f: Vec3): void {
    if (this.inverseMass === 0) return;
    this.forceAccumulator.add(f);
    this.wake();
  }

  applyImpulse(impulse: Vec3): void {
    if (this.inverseMass === 0) return;
    this.velocity.add(impulse.clone().scale(this.inverseMass));
    this.wake();
  }

  wake(): void {
    this.sleeping = false;
    this.sleepTimer = 0;
  }

  clearAccumulators(): void {
    this.forceAccumulator.set(0, 0, 0);
  }
}
