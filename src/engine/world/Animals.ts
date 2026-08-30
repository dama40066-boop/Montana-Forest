// #10 CHARACTER & #04 WORLD - Fauna, Wildlife Sensory Loop, Grazing & Hunting Mechanics
import { Vec3, clamp } from '../math';
import { AnimalEntityData } from '../../types/game';
import { WorldGenerator } from './World';

export class AnimalSystem {
  public animals: AnimalEntityData[] = [];
  private nextId = 1;

  initAnimals(world: WorldGenerator): void {
    this.animals = [];

    // 4 Deer / Stags near north-west forest and lake shore
    this.spawnAnimal('DEER', 'Stag', -20, 10, world);
    this.spawnAnimal('DEER', 'Doe', -35, -15, world);
    this.spawnAnimal('DEER', 'Forest Stag', 10, -20, world);
    this.spawnAnimal('DEER', 'Young Deer', 45, -10, world);

    // 2 Wolves in rocky ridge
    this.spawnAnimal('WOLF', 'Timber Wolf', -55, -40, world);
    this.spawnAnimal('WOLF', 'Grey Wolf', -65, -30, world);

    // 2 Wild Boars in southern muddy thicket
    this.spawnAnimal('BOAR', 'Tusked Boar', 15, 55, world);
    this.spawnAnimal('BOAR', 'Wild Boar', -15, 60, world);

    // 1 Rare Grizzly Bear in mountain cave
    this.spawnAnimal('BEAR', 'Grizzly Bear', 65, 45, world);

    // 3 Rabbits around village borders
    this.spawnAnimal('RABBIT', 'Forest Hare', 5, 5, world);
    this.spawnAnimal('RABBIT', 'Snowshoe Hare', 35, 10, world);
    this.spawnAnimal('RABBIT', 'Field Rabbit', 18, 38, world);
  }

  private spawnAnimal(
    species: AnimalEntityData['species'],
    name: string,
    x: number,
    z: number,
    world: WorldGenerator
  ): void {
    const maxHp = species === 'BEAR' ? 250 : species === 'BOAR' ? 90 : species === 'WOLF' ? 70 : species === 'DEER' ? 50 : 20;
    const speed = species === 'RABBIT' ? 5.5 : species === 'DEER' ? 6.2 : species === 'WOLF' ? 6.8 : species === 'BOAR' ? 4.5 : 4.0;
    const meatYield = species === 'BEAR' ? 5 : species === 'BOAR' ? 3 : species === 'DEER' ? 4 : species === 'WOLF' ? 2 : 1;
    const peltType = `${species.toLowerCase()}_pelt`;

    this.animals.push({
      id: this.nextId++,
      species,
      name,
      hp: maxHp,
      maxHp,
      speed,
      state: 'GRAZING',
      fleeTarget: [x, world.height(x, z), z],
      meatYield,
      peltType,
      harvested: false
    });
  }

  update(dt: number, playerPos: Vec3, isPlayerNoisy: boolean, world: WorldGenerator): void {
    for (const animal of this.animals) {
      if (animal.hp <= 0) {
        animal.state = 'DEAD';
        continue;
      }

      const [ax, , az] = animal.fleeTarget || [0, 0, 0];
      const distToPlayer = Math.hypot(ax - playerPos.x, az - playerPos.z);

      // Detection radius depends on species and noise
      const detectionRadius = isPlayerNoisy ? 35 : (animal.species === 'DEER' || animal.species === 'RABBIT' ? 18 : 12);

      if (distToPlayer < detectionRadius && animal.state !== 'FLEEING' && animal.state !== 'ATTACKING') {
        if (animal.species === 'WOLF' || animal.species === 'BEAR') {
          // Predators attack if too close
          if (distToPlayer < 10) {
            animal.state = 'ATTACKING';
            animal.attackTarget = 'player';
          } else {
            animal.state = 'ALERT';
          }
        } else {
          // Prey flees immediately
          animal.state = 'FLEEING';
        }
      }

      if (animal.state === 'FLEEING') {
        // Move directly away from player
        const awayX = ax - playerPos.x;
        const awayZ = az - playerPos.z;
        const len = Math.hypot(awayX, awayZ) || 1;
        const nx = ax + (awayX / len) * animal.speed * dt;
        const nz = az + (awayZ / len) * animal.speed * dt;
        const ny = world.height(nx, nz);
        animal.fleeTarget = [nx, ny, nz];

        if (distToPlayer > 45) {
          animal.state = 'GRAZING';
        }
      } else if (animal.state === 'ATTACKING') {
        // Move towards player
        const toX = playerPos.x - ax;
        const toZ = playerPos.z - az;
        const len = Math.hypot(toX, toZ) || 1;
        const nx = ax + (toX / len) * animal.speed * dt;
        const nz = az + (toZ / len) * animal.speed * dt;
        const ny = world.height(nx, nz);
        animal.fleeTarget = [nx, ny, nz];
      } else if (animal.state === 'GRAZING') {
        // Gentle random wandering
        if (Math.random() < 0.02) {
          const rx = ax + (Math.random() - 0.5) * 6;
          const rz = az + (Math.random() - 0.5) * 6;
          animal.fleeTarget = [rx, world.height(rx, rz), rz];
        }
      }
    }
  }

  damageAnimal(id: number, amount: number): { dead: boolean; animal?: AnimalEntityData } {
    const animal = this.animals.find(a => a.id === id);
    if (!animal || animal.hp <= 0) return { dead: false };

    animal.hp = Math.max(0, animal.hp - amount);
    if (animal.hp <= 0) {
      animal.state = 'DEAD';
      return { dead: true, animal };
    } else {
      animal.state = (animal.species === 'WOLF' || animal.species === 'BEAR') ? 'ATTACKING' : 'FLEEING';
      return { dead: false, animal };
    }
  }
}
