// #02 ENGINE - Authoritative Entity-Component-System (ECS) Architecture
import { Vec3, Quat } from './math';

export class Component {}

let nextEntityId = 1;

export class Entity {
  public id: number;
  public components: Map<string, unknown> = new Map();
  public enabled: boolean = true;

  constructor(public name: string) {
    this.id = nextEntityId++;
  }

  add<T>(type: string, value: T): T {
    this.components.set(type, value);
    return value;
  }

  get<T>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  has(type: string): boolean {
    return this.components.has(type);
  }

  remove(type: string): void {
    this.components.delete(type);
  }
}

export class TransformComponent extends Component {
  public position: Vec3 = new Vec3();
  public previous: Vec3 = new Vec3();
  public rotation: Quat = new Quat();
  public scale: Vec3 = new Vec3(1, 1, 1);
}

export class RenderComponent extends Component {
  constructor(
    public materialId: string = 'default',
    public visible: boolean = true,
    public castShadow: boolean = true
  ) {
    super();
  }
  public meshHandle: unknown = null;
}

export class ECS {
  public entities: Entity[] = [];

  create(name: string): Entity {
    const e = new Entity(name);
    this.entities.push(e);
    return e;
  }

  remove(e: Entity): void {
    const idx = this.entities.indexOf(e);
    if (idx !== -1) {
      this.entities.splice(idx, 1);
    }
  }

  query(...types: string[]): Entity[] {
    return this.entities.filter(e => e.enabled && types.every(t => e.has(t)));
  }

  clear(): void {
    this.entities.length = 0;
  }
}
