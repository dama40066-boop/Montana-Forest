// #07 PHYSICS - Engine-Owned Rigid Body Dynamics, Numerical Integration, Buoyancy & Forces
import { Vec3, Quat, clamp, lerp, EPS, quatRotateVector } from '../math';
import { Entity, TransformComponent } from '../ecs';
import {
  RigidBody,
  SphereCollider,
  CapsuleCollider,
  AABBCollider,
  OBB,
  ColliderComponent,
  WaterVolume,
  Contact,
  AABB
} from './Colliders';

export class PhysicsWorld {
  public gravity: Vec3 = new Vec3(0, -9.81, 0);
  public bodies: RigidBody[] = [];
  public staticBodies: RigidBody[] = [];
  public bodyMap: Map<number, RigidBody> = new Map();
  public water: WaterVolume = new WaterVolume(new Vec3(15, 0, -35), 65, 32, 0.75);

  // Statistics
  public stats = {
    contacts: 0,
    bodies: 0,
    sleeping: 0,
    physicsMs: 0
  };

  add(body: RigidBody): RigidBody {
    if (!this.bodies.includes(body)) {
      this.bodies.push(body);
      this.bodyMap.set(body.id, body);
    }
    return body;
  }

  addStatic(entity: Entity, collider: ColliderComponent): RigidBody {
    const b = new RigidBody(entity, { mass: 0 });
    entity.add('collider', collider);
    this.staticBodies.push(b);
    this.bodyMap.set(b.id, b);
    return b;
  }

  remove(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
    const sidx = this.staticBodies.indexOf(body);
    if (sidx !== -1) this.staticBodies.splice(sidx, 1);
    this.bodyMap.delete(body.id);
  }

  step(dt: number, heightSampleFn: (x: number, z: number) => number, timeSeconds: number): void {
    const t0 = performance.now();
    let contactCount = 0;

    // 1. Accumulate Environmental Forces (Wind, Buoyancy, Gravity)
    for (const b of this.bodies) {
      if (!b.active || b.sleeping) continue;
      const tr = b.entity.get<TransformComponent>('transform');
      if (!tr) continue;

      // Save previous position
      b.previousPosition.copy(tr.position);

      // Gravity
      b.forceAccumulator.add(this.gravity.clone().scale(b.mass));

      // Buoyancy
      const depth = this.water.depthAt(tr.position, timeSeconds);
      if (depth > 0) {
        b.waterState = depth > 1.2 ? 'SUBMERGED' : 'PARTIAL';
        const submerged = clamp(depth / 1.5, 0, 1);
        b.submergedFraction = submerged;
        const buoyancyForce = 9.81 * b.mass * 1.35 * submerged;
        b.applyForce(new Vec3(0, buoyancyForce, 0));

        // Water drag
        const v = b.velocity;
        b.applyForce(v.clone().scale(-4.5 * submerged * b.mass));
      } else {
        b.waterState = 'AIR';
        b.submergedFraction = 0;
      }

      // Linear integration
      const accel = b.forceAccumulator.clone().scale(b.inverseMass);
      b.velocity.add(accel.scale(dt));

      // Air damping
      b.velocity.scale(Math.exp(-0.05 * dt));

      // Velocity clamp
      if (b.velocity.length > 50) {
        b.velocity.normalize().scale(50);
      }

      // Update position
      tr.position.add(b.velocity.clone().scale(dt));
      b.clearAccumulators();
    }

    // 2. Terrain Collision & Response
    for (const b of this.bodies) {
      if (!b.active || b.sleeping) continue;
      const tr = b.entity.get<TransformComponent>('transform');
      const collider = b.entity.get<ColliderComponent>('collider');
      if (!tr || !collider) continue;

      const p = tr.position;
      let bottomY = p.y;
      if (collider instanceof SphereCollider) {
        bottomY = p.y - collider.radius;
      } else if (collider instanceof CapsuleCollider) {
        bottomY = p.y; // base of capsule
      }

      const terrH = heightSampleFn(p.x, p.z);
      const eps = 0.25;
      const dx = (heightSampleFn(p.x + eps, p.z) - heightSampleFn(p.x - eps, p.z)) / (2 * eps);
      const dz = (heightSampleFn(p.x, p.z + eps) - heightSampleFn(p.x, p.z - eps)) / (2 * eps);
      const normal = new Vec3(-dx, 1, -dz).normalize();
      const slope = Math.acos(clamp(Vec3.dot(normal, new Vec3(0, 1, 0)), -1, 1));

      b.groundNormal.copy(normal);
      b.slopeAngle = slope;

      if (bottomY < terrH) {
        const penetration = terrH - bottomY;
        tr.position.y += penetration;
        contactCount++;

        // Normal velocity
        const vn = Vec3.dot(b.velocity, normal);
        if (vn < 0) {
          b.velocity.sub(normal.clone().scale(vn * (1 + b.restitution)));
        }

        // Friction
        const vt = b.velocity.clone().sub(normal.clone().scale(Vec3.dot(b.velocity, normal)));
        if (vt.length > EPS) {
          b.velocity.sub(vt.scale(clamp(b.friction * 4 * dt, 0, 1)));
        }

        b.grounded = slope < Math.PI * 0.35; // walkable slope <= 63 deg
      } else {
        b.grounded = bottomY <= terrH + 0.08;
      }
    }

    // 3. Dynamic vs Dynamic and Dynamic vs Static Collisions (Multi-Iteration Hard Solver)
    const allBodies = this.bodies.concat(this.staticBodies);
    const solverIterations = 4;

    for (let iter = 0; iter < solverIterations; iter++) {
      for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i];
        if (!a.active) continue;
        const trA = a.entity.get<TransformComponent>('transform');
        const colA = a.entity.get<ColliderComponent>('collider');
        if (!trA || !colA) continue;

        for (let j = 0; j < allBodies.length; j++) {
          const b = allBodies[j];
          if (a === b) continue;
          if (!b.active || (a.inverseMass === 0 && b.inverseMass === 0)) continue;
          const trB = b.entity.get<TransformComponent>('transform');
          const colB = b.entity.get<ColliderComponent>('collider');
          if (!trB || !colB) continue;

          // Collision check
          const contact = this.testCollision(trA.position, colA, trB.position, colB);
          if (contact.hit && contact.penetration > 0.0001) {
            contactCount++;
            const totalInv = a.inverseMass + b.inverseMass;
            if (totalInv > EPS) {
              // Positional separation (100% separation factor)
              // contact.normal points from A to B
              const push = contact.normal.clone().scale((contact.penetration * 1.0) / totalInv);
              if (a.inverseMass > 0) trA.position.sub(push.clone().scale(a.inverseMass));
              if (b.inverseMass > 0) trB.position.add(push.clone().scale(b.inverseMass));

              // Velocity resolution: cancel velocity going into the surface
              const relVel = Vec3.sub(b.velocity, a.velocity);
              const vn = Vec3.dot(relVel, contact.normal);
              if (vn < 0) {
                const e = Math.min(a.restitution, b.restitution);
                const jImp = -(1 + e) * vn / totalInv;
                const impulse = contact.normal.clone().scale(jImp);
                if (a.inverseMass > 0) a.velocity.sub(impulse.clone().scale(a.inverseMass));
                if (b.inverseMass > 0) b.velocity.add(impulse.clone().scale(b.inverseMass));
              }
            }
          }
        }
      }
    }

    this.stats.contacts = contactCount;
    this.stats.bodies = this.bodies.length;
    this.stats.sleeping = this.bodies.filter(b => b.sleeping).length;
    this.stats.physicsMs = performance.now() - t0;
  }

  private testCollision(posA: Vec3, colA: ColliderComponent, posB: Vec3, colB: ColliderComponent): Contact {
    const contact = new Contact();

    // Sphere vs Sphere
    if (colA instanceof SphereCollider && colB instanceof SphereCollider) {
      const delta = Vec3.sub(posB, posA);
      const dist = delta.length;
      const radiusSum = colA.radius + colB.radius;
      if (dist < radiusSum) {
        contact.hit = true;
        contact.penetration = radiusSum - dist;
        contact.normal = dist > EPS ? delta.normalize() : new Vec3(0, 1, 0); // Points from A to B
        contact.point = posA.clone().add(contact.normal.clone().scale(colA.radius));
      }
      return contact;
    }

    // Capsule vs AABB (Player / NPC vs Building / Wall / House)
    if (colA instanceof CapsuleCollider && colB instanceof AABBCollider) {
      const seg = colA.segment(posA);
      const segBottom = seg[0];
      const segTop = seg[1];

      // Find closest point on capsule's vertical segment to the box center Y
      const clampedY = clamp(posB.y, segBottom.y, segTop.y);
      const testPoint = new Vec3(posA.x, clampedY, posA.z);

      // Find closest point on the AABB box to this segment point
      const minX = posB.x - colB.half.x;
      const maxX = posB.x + colB.half.x;
      const minY = posB.y - colB.half.y;
      const maxY = posB.y + colB.half.y;
      const minZ = posB.z - colB.half.z;
      const maxZ = posB.z + colB.half.z;

      const closestOnBox = new Vec3(
        clamp(testPoint.x, minX, maxX),
        clamp(testPoint.y, minY, maxY),
        clamp(testPoint.z, minZ, maxZ)
      );

      // Vector from testPoint (A) to closest point on Box (B)
      const deltaAtoB = Vec3.sub(closestOnBox, testPoint);
      const dist = deltaAtoB.length;

      // Case 1: Point is outside the box, within capsule radius
      if (dist > EPS && dist < colA.radius) {
        contact.hit = true;
        contact.penetration = colA.radius - dist;
        contact.normal = deltaAtoB.normalize(); // Points from A to B
        contact.point = closestOnBox;
        return contact;
      }

      // Case 2: Point is INSIDE or on edge of AABB (Penetration / Tunneling Recovery)
      if (dist <= EPS) {
        const dMinX = Math.max(0.001, testPoint.x - minX); // Distance to left face (Push A left (-X) => normal A->B is (+1, 0, 0))
        const dMaxX = Math.max(0.001, maxX - testPoint.x); // Distance to right face (Push A right (+X) => normal A->B is (-1, 0, 0))
        const dMinY = Math.max(0.001, testPoint.y - minY);
        const dMaxY = Math.max(0.001, maxY - testPoint.y);
        const dMinZ = Math.max(0.001, testPoint.z - minZ);
        const dMaxZ = Math.max(0.001, maxZ - testPoint.z);

        let minPen = dMinX;
        let normalAtoB = new Vec3(1, 0, 0);

        if (dMaxX < minPen) {
          minPen = dMaxX;
          normalAtoB = new Vec3(-1, 0, 0);
        }
        if (dMinZ < minPen) {
          minPen = dMinZ;
          normalAtoB = new Vec3(0, 0, 1);
        }
        if (dMaxZ < minPen) {
          minPen = dMaxZ;
          normalAtoB = new Vec3(0, 0, -1);
        }
        if (dMinY < minPen) {
          minPen = dMinY;
          normalAtoB = new Vec3(0, 1, 0);
        }
        if (dMaxY < minPen) {
          minPen = dMaxY;
          normalAtoB = new Vec3(0, -1, 0);
        }

        contact.hit = true;
        contact.penetration = minPen + colA.radius;
        contact.normal = normalAtoB; // Points from A to B
        contact.point = closestOnBox;
        return contact;
      }

      return contact;
    }

    // AABB vs Capsule (Symmetric)
    if (colA instanceof AABBCollider && colB instanceof CapsuleCollider) {
      const c = this.testCollision(posB, colB, posA, colA);
      if (c.hit) {
        c.normal.scale(-1);
      }
      return c;
    }

    // Capsule vs Capsule (e.g. Player vs NPC)
    if (colA instanceof CapsuleCollider && colB instanceof CapsuleCollider) {
      const distXZ = Math.hypot(posA.x - posB.x, posA.z - posB.z);
      const radSum = colA.radius + colB.radius;
      const overlapY = (posA.y < posB.y + colB.height) && (posA.y + colA.height > posB.y);
      if (distXZ < radSum && overlapY) {
        contact.hit = true;
        contact.penetration = radSum - distXZ;
        const normXZ = new Vec3(posB.x - posA.x, 0, posB.z - posA.z);
        contact.normal = normXZ.length > EPS ? normXZ.normalize() : new Vec3(1, 0, 0);
        contact.point = Vec3.lerp(posA, posB, 0.5);
      }
      return contact;
    }

    // Sphere vs AABB (e.g. Arrow / Physics Rock vs Building)
    if (colA instanceof SphereCollider && colB instanceof AABBCollider) {
      const closest = new Vec3(
        clamp(posA.x, posB.x - colB.half.x, posB.x + colB.half.x),
        clamp(posA.y, posB.y - colB.half.y, posB.y + colB.half.y),
        clamp(posA.z, posB.z - colB.half.z, posB.z + colB.half.z)
      );
      const deltaAtoB = Vec3.sub(closest, posA);
      const dist = deltaAtoB.length;
      if (dist < colA.radius && dist > EPS) {
        contact.hit = true;
        contact.penetration = colA.radius - dist;
        contact.normal = deltaAtoB.normalize(); // Points from A to B
        contact.point = closest;
      } else if (dist <= EPS) {
        contact.hit = true;
        contact.penetration = colA.radius + 0.2;
        contact.normal = new Vec3(0, 1, 0); // Points from A to B (Up)
        contact.point = closest;
      }
      return contact;
    }

    // AABB vs Sphere (Symmetric)
    if (colA instanceof AABBCollider && colB instanceof SphereCollider) {
      const c = this.testCollision(posB, colB, posA, colA);
      if (c.hit) {
        c.normal.scale(-1);
      }
      return c;
    }

    // Capsule vs Sphere
    if (colA instanceof CapsuleCollider && colB instanceof SphereCollider) {
      const seg = colA.segment(posA);
      const delta = Vec3.sub(posB, seg[0]);
      const dist = delta.length;
      const radSum = colA.radius + colB.radius;
      if (dist < radSum) {
        contact.hit = true;
        contact.penetration = radSum - dist;
        contact.normal = dist > EPS ? delta.normalize() : new Vec3(0, 1, 0);
        contact.point = posA.clone().add(contact.normal.clone().scale(colA.radius));
      }
      return contact;
    }

    // Sphere vs Capsule (Symmetric)
    if (colA instanceof SphereCollider && colB instanceof CapsuleCollider) {
      const c = this.testCollision(posB, colB, posA, colA);
      if (c.hit) {
        c.normal.scale(-1);
      }
      return c;
    }

    return contact;
  }

  // Fast Raycast for line-of-sight and projectile targeting
  raycast(origin: Vec3, direction: Vec3, maxDistance: number, heightSampleFn: (x: number, z: number) => number): { hit: boolean; point: Vec3; normal: Vec3; distance: number; entity?: Entity } | null {
    const dir = direction.clone().normalize();
    let t = 0;
    const step = 0.5;

    while (t < maxDistance) {
      const current = origin.clone().add(dir.clone().scale(t));
      const terrH = heightSampleFn(current.x, current.z);

      if (current.y <= terrH) {
        return {
          hit: true,
          point: current,
          normal: new Vec3(0, 1, 0),
          distance: t
        };
      }

      // Check entities
      for (const b of this.bodies.concat(this.staticBodies)) {
        const tr = b.entity.get<TransformComponent>('transform');
        const col = b.entity.get<ColliderComponent>('collider');
        if (!tr || !col) continue;

        if (col instanceof SphereCollider) {
          if (Vec3.distance(current, tr.position) <= col.radius) {
            return {
              hit: true,
              point: current,
              normal: Vec3.sub(current, tr.position).normalize(),
              distance: t,
              entity: b.entity
            };
          }
        } else if (col instanceof CapsuleCollider) {
          const dXZ = Math.hypot(current.x - tr.position.x, current.z - tr.position.z);
          if (dXZ <= col.radius && current.y >= tr.position.y && current.y <= tr.position.y + col.height) {
            return {
              hit: true,
              point: current,
              normal: new Vec3(current.x - tr.position.x, 0, current.z - tr.position.z).normalize(),
              distance: t,
              entity: b.entity
            };
          }
        }
      }

      t += step;
    }

    return null;
  }
}
