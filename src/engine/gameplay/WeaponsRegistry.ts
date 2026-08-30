// #10 WEAPON SYSTEM - Frontier Arsenal, Ballistics, Ammo Types & Aim Down Sights (ADS)
import { WeaponDefinition, InventoryItem } from '../../types/game';

export const WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  bow_pine: {
    id: 'bow_pine',
    name: 'Pine Recurve Bow',
    type: 'bow',
    damage: 40,
    magSize: 1,
    reloadTime: 1.1,
    fireRate: 0.9,
    range: 65,
    ammoId: 'arrow_hunting',
    ammoName: 'Hunting Arrows',
    recoil: 0.04,
    zoomFov: 48,
    icon: 'Crosshair',
    description: 'Silent and lethal at medium range. Arrows arc with gravity.'
  },
  rifle_repeater: {
    id: 'rifle_repeater',
    name: 'Winchester .30-30 Carbine',
    type: 'rifle',
    damage: 75,
    magSize: 6,
    reloadTime: 2.2,
    fireRate: 0.8,
    range: 120,
    ammoId: 'ammo_rifle',
    ammoName: '.30-30 Cartridges',
    recoil: 0.14,
    zoomFov: 36,
    icon: 'Crosshair',
    description: 'High velocity lever-action repeating rifle. Pinpoint precision when aiming.'
  },
  revolver_colt: {
    id: 'revolver_colt',
    name: 'Colt .45 Peacemaker',
    type: 'revolver',
    damage: 55,
    magSize: 6,
    reloadTime: 2.0,
    fireRate: 0.45,
    range: 48,
    ammoId: 'ammo_revolver',
    ammoName: '.45 LC Rounds',
    recoil: 0.18,
    zoomFov: 52,
    icon: 'Zap',
    description: 'The classic single-action six-shooter. Rapid fire and reliable stopping power.'
  },
  shotgun_double: {
    id: 'shotgun_double',
    name: 'Double-Barrel 12G Shotgun',
    type: 'shotgun',
    damage: 16, // per pellet x 8 pellets = 128 max
    pelletCount: 8,
    magSize: 2,
    reloadTime: 2.4,
    fireRate: 0.4,
    range: 28,
    ammoId: 'ammo_shotgun',
    ammoName: '12G Buckshot Shells',
    recoil: 0.28,
    zoomFov: 55,
    icon: 'Shield',
    description: 'Devastating double-barrel coach gun. Spreads deadly buckshot at close quarters.'
  },
  knife_hunter: {
    id: 'knife_hunter',
    name: 'Frontier Bowie Knife',
    type: 'melee',
    damage: 32,
    magSize: 1,
    reloadTime: 0.1,
    fireRate: 0.5,
    range: 2.4,
    ammoId: '',
    ammoName: '',
    recoil: 0.02,
    zoomFov: 65,
    icon: 'Shield',
    description: 'Carbon-steel hunting blade for silent stealth strikes and carcass skinning.'
  }
};

export interface QuickWeaponSlot {
  id: string;
  key: string;
  label: string;
}

export const QUICK_WEAPON_SLOTS: QuickWeaponSlot[] = [
  { id: 'bow_pine', key: '1', label: 'Bow' },
  { id: 'rifle_repeater', key: '2', label: 'Winchester' },
  { id: 'revolver_colt', key: '3', label: 'Colt .45' },
  { id: 'shotgun_double', key: '4', label: 'Shotgun' },
  { id: 'knife_hunter', key: '5', label: 'Knife' }
];

export function getWeaponDef(weaponId: string): WeaponDefinition {
  return WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS['bow_pine'];
}
