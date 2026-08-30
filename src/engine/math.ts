// #00 CORE & #01 CONFIG - Mathematical Foundations, Vector3, Quaternions & Numerical Helpers
export const EPS = 1e-6;
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}
  set(x: number, y: number): this {
    this.x = x; this.y = y; return this;
  }
  clone(): Vec2 { return new Vec2(this.x, this.y); }
  add(v: Vec2): this { this.x += v.x; this.y += v.y; return this; }
  sub(v: Vec2): this { this.x -= v.x; this.y -= v.y; return this; }
  scale(s: number): this { this.x *= s; this.y *= s; return this; }
  get length(): number { return Math.hypot(this.x, this.y); }
}

export class Vec3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z; return this;
  }
  copy(v: Vec3): this {
    this.x = v.x; this.y = v.y; this.z = v.z; return this;
  }
  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }
  add(v: Vec3): this { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v: Vec3): this { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  scale(s: number): this { this.x *= s; this.y *= s; this.z *= s; return this; }
  normalize(): this {
    const len = this.length || 1;
    return this.scale(1 / len);
  }
  get length(): number { return Math.hypot(this.x, this.y, this.z); }
  get lengthSquared(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }

  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }
  toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
  static fromArray(arr: [number, number, number]): Vec3 { return new Vec3(arr[0], arr[1], arr[2]); }

  static dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
  static cross(a: Vec3, b: Vec3, out = new Vec3()): Vec3 {
    return out.set(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  static sub(a: Vec3, b: Vec3, out = new Vec3()): Vec3 {
    return out.set(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  static add(a: Vec3, b: Vec3, out = new Vec3()): Vec3 {
    return out.set(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  static distance(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  static lerp(a: Vec3, b: Vec3, t: number, out = new Vec3()): Vec3 {
    return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }
}

export class Quat {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0, public w: number = 1) {}
  set(x: number, y: number, z: number, w: number): this {
    this.x = x; this.y = y; this.z = z; this.w = w; return this;
  }
  normalize(): this {
    const len = Math.hypot(this.x, this.y, this.z, this.w) || 1;
    this.x /= len; this.y /= len; this.z /= len; this.w /= len;
    return this;
  }
  static axisAngle(axis: Vec3, angle: number): Quat {
    const s = Math.sin(angle * 0.5);
    return new Quat(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle * 0.5)).normalize();
  }
  static multiply(a: Quat, b: Quat, o = new Quat()): Quat {
    o.x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
    o.y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
    o.z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
    o.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    return o.normalize();
  }
}

export function quatRotateVector(q: Quat, v: Vec3, out = new Vec3()): Vec3 {
  const qv = new Quat(v.x, v.y, v.z, 0);
  const qi = new Quat(-q.x, -q.y, -q.z, q.w);
  const r = Quat.multiply(Quat.multiply(q, qv, new Quat()), qi, new Quat());
  return out.set(r.x, r.y, r.z);
}

export function quatRotateInv(q: Quat, v: Vec3, out = new Vec3()): Vec3 {
  const qi = new Quat(-q.x, -q.y, -q.z, q.w);
  return quatRotateVector(qi, v, out);
}
