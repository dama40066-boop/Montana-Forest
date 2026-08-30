import React from 'react';
import { PlayerStats } from '../types/game';
import { NPCAgentData } from '../engine/ai/NPCBrain';
import { AnimalEntityData } from '../types/game';
import { getWeaponDef, QUICK_WEAPON_SLOTS } from '../engine/gameplay/WeaponsRegistry';
import { Minimap3D } from './Minimap3D';
import {
  Heart,
  Zap,
  Clock,
  Package,
  Scroll,
  ShieldAlert,
  Settings,
  Crosshair,
  Users,
  CheckCircle2,
  Droplets
} from 'lucide-react';

interface Props {
  player: PlayerStats;
  playerPos: [number, number, number];
  playerYaw: number;
  npcs: NPCAgentData[];
  animals: AnimalEntityData[];
  gameTimeSeconds: number;
  gameDay: number;
  stealthNoise: number;
  toastMessage: string;
  targetedNPC: NPCAgentData | null;
  targetedAnimal: AnimalEntityData | null;
  isNearWantedBoard: boolean;
  isNearCampfire: boolean;
  onlineCount: number;
  totalVisitors: number;
  isAutoSaved?: boolean;
  onOpenInventory: () => void;
  onOpenWantedBoard: () => void;
  onOpenSettings: () => void;
  onSwitchWeapon?: (weaponId: string) => void;
}

export const GameHUD: React.FC<Props> = ({
  player,
  playerPos,
  playerYaw,
  npcs,
  animals,
  gameTimeSeconds,
  gameDay,
  stealthNoise,
  toastMessage,
  targetedNPC,
  targetedAnimal,
  isNearWantedBoard,
  isNearCampfire,
  onlineCount,
  totalVisitors,
  isAutoSaved,
  onOpenInventory,
  onOpenWantedBoard,
  onOpenSettings,
  onSwitchWeapon
}) => {
  const totalHours = gameTimeSeconds / 3600;
  const hours = Math.floor(totalHours % 24);
  const minutes = Math.floor((gameTimeSeconds % 3600) / 60);
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  const currentWeaponDef = getWeaponDef(player.equippedWeapon);
  const curMag = player.magAmmo ? (player.magAmmo[player.equippedWeapon] ?? 0) : player.arrows;
  const reserveItem = player.inventory.find((i) => i.id === currentWeaponDef.ammoId);
  const reserveCount = reserveItem ? reserveItem.count : (player.equippedWeapon === 'bow_pine' ? player.arrows : 0);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-5 select-none font-sans text-stone-100">
      {/* Top Header: Left Vitals + Real Visitor Counter, Right Minimap + Settings */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Live Online Counter & Sleek Vitals */}
        <div className="flex flex-col gap-2 pointer-events-auto max-w-[280px]">
          {/* Server-Verified Real Visitors & Online Count */}
          <div className="flex items-center gap-2.5 bg-stone-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-stone-800 shadow-xl text-xs font-mono">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {onlineCount} Online
            </span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-300">
              {totalVisitors} Visitors
            </span>
          </div>

          {/* Player Vitals Card */}
          <div className="bg-stone-950/85 backdrop-blur-md p-3 rounded-xl border border-stone-800/80 shadow-xl space-y-2">
            {/* Health Bar */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-red-300">
                <span className="flex items-center gap-1 font-bold">
                  <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /> HP
                </span>
                <span className="font-bold">{Math.round(player.hp)} / {player.maxHp}</span>
              </div>
              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-red-950/60">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-150"
                  style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-amber-300">
                <span className="flex items-center gap-1 font-bold">
                  <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> STAMINA
                </span>
                <span className="font-bold">{Math.round(player.stamina)} / {player.maxStamina}</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden border border-amber-950/60">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-150"
                  style={{ width: `${(player.stamina / player.maxStamina) * 100}%` }}
                />
              </div>
            </div>

            {/* Oxygen / Diving Bar (Visible when in water or diving) */}
            {(player.isSwimming || player.oxygen < 99) && (
              <div className="animate-in fade-in">
                <div className="flex justify-between text-xs font-mono mb-1 text-cyan-300">
                  <span className="flex items-center gap-1 font-bold">
                    <Droplets className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
                    {player.isUnderwater ? 'DIVING OXYGEN' : 'BREATH'}
                  </span>
                  <span className="font-bold">{Math.round(player.oxygen)}%</span>
                </div>
                <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden border border-cyan-950/60">
                  <div
                    className={`h-full transition-all duration-150 ${
                      player.oxygen < 25 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-cyan-600 to-blue-400'
                    }`}
                    style={{ width: `${player.oxygen}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quick Status Badges */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-mono border-t border-stone-800/80 text-stone-400">
              <span className="flex items-center gap-1 text-stone-300">
                <Clock className="w-3 h-3 text-amber-400" /> Day {gameDay} • {timeStr}
              </span>
              <span className="text-amber-400 font-bold">
                🪙 {player.gold}g
              </span>
            </div>
          </div>

          {/* Wanted Bounty Alert if active */}
          {player.wantedLevel > 0 && (
            <div className="bg-red-950/90 border border-red-700/80 px-3 py-1.5 rounded-xl text-xs font-mono text-amber-300 flex items-center justify-between animate-pulse shadow-lg">
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <ShieldAlert className="w-4 h-4" /> WANTED
              </span>
              <span className="text-amber-400 font-bold tracking-wider">
                {'★'.repeat(player.wantedLevel)}
              </span>
              <span className="text-[11px] text-red-200">({player.bountyOnHead}g)</span>
            </div>
          )}
        </div>

        {/* Top-Right: Topographic Minimap, Quick Actions & Settings */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2">
            {isAutoSaved && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/70 border border-emerald-700/50 rounded-lg text-[11px] font-mono text-emerald-300 animate-fade-in shadow">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto-Saved
              </div>
            )}
            <button
              onClick={onOpenInventory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-950/80 hover:bg-stone-800 backdrop-blur-md rounded-xl border border-stone-800 text-xs font-semibold text-stone-200 transition shadow"
              title="Backpack & Store [I]"
            >
              <Package className="w-4 h-4 text-amber-400" /> Bag & Store [I]
            </button>
            <button
              onClick={onOpenWantedBoard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-950/80 hover:bg-stone-800 backdrop-blur-md rounded-xl border border-stone-800 text-xs font-semibold text-stone-200 transition shadow"
              title="Wanted Board"
            >
              <Scroll className="w-4 h-4 text-amber-400" /> Bounties
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1.5 bg-stone-950/80 hover:bg-stone-800 backdrop-blur-md rounded-xl border border-stone-800 text-stone-200 transition shadow"
              title="Game Settings [ESC]"
            >
              <Settings className="w-4 h-4 text-stone-300" />
            </button>
          </div>

          {/* Top-Right Real-Time 3D Minimap */}
          <div className="shadow-2xl rounded-2xl overflow-hidden border border-stone-800/80 bg-stone-950/80">
            <Minimap3D
              playerPos={playerPos}
              playerYaw={playerYaw}
              npcs={npcs}
              animals={animals}
            />
          </div>
        </div>
      </div>

      {/* Center Screen: ADS Reticle & Dynamic Context Prompts */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Dynamic ADS Reticle */}
        {player.isAiming ? (
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute w-full h-[1.5px] bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            <div className="absolute h-full w-[1.5px] bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            <div className="w-2 h-2 rounded-full border border-amber-300" />
          </div>
        ) : (
          <div className="w-3 h-3 border border-white/60 rounded-full flex items-center justify-center opacity-75">
            <div className="w-1 h-1 bg-amber-400 rounded-full" />
          </div>
        )}

        {/* Dynamic Context Prompt */}
        <div className="mt-12 flex flex-col items-center gap-2">
          {targetedNPC && targetedNPC.hp > 0 && (
            <div className="bg-stone-950/90 backdrop-blur-md px-5 py-2 rounded-2xl border border-amber-500/60 text-xs text-amber-200 font-mono shadow-2xl flex items-center gap-3 ring-1 ring-amber-500/20 animate-in fade-in">
              <span className="bg-amber-600 text-stone-950 px-2 py-0.5 rounded-md font-bold font-mono shadow-sm">
                [E] TALK
              </span>
              <span className="font-serif font-bold text-amber-300 text-sm">{targetedNPC.name}</span>
              <span className="text-stone-400 text-[11px]">({targetedNPC.occupation})</span>
            </div>
          )}

          {targetedAnimal && !targetedAnimal.harvested && (
            <div className="bg-stone-950/90 backdrop-blur-md px-5 py-2 rounded-2xl border border-emerald-500/60 text-xs text-emerald-200 font-mono shadow-2xl flex items-center gap-3 ring-1 ring-emerald-500/20 animate-in fade-in">
              <span className="bg-emerald-600 text-stone-950 px-2 py-0.5 rounded-md font-bold font-mono">
                [E] HARVEST
              </span>
              <span>{targetedAnimal.name} Carcass (Meat & Pelt)</span>
            </div>
          )}

          {isNearWantedBoard && (
            <div className="bg-stone-950/90 backdrop-blur-md px-5 py-2 rounded-2xl border border-amber-500/60 text-xs text-amber-200 font-mono shadow-2xl flex items-center gap-3 ring-1 ring-amber-500/20 animate-in fade-in">
              <span className="bg-amber-600 text-stone-950 px-2 py-0.5 rounded-md font-bold font-mono">
                [E] INSPECT
              </span>
              <span className="font-serif">Wanted Posters & Bounties</span>
            </div>
          )}

          {isNearCampfire && (
            <div className="bg-stone-950/90 backdrop-blur-md px-5 py-2 rounded-2xl border border-orange-500/60 text-xs text-orange-200 font-mono shadow-2xl flex items-center gap-3 ring-1 ring-orange-500/20 animate-in fade-in">
              <span className="bg-orange-600 text-stone-950 px-2 py-0.5 rounded-md font-bold font-mono">
                [I] CRAFT
              </span>
              <span>Near Campfire • Cook Venison & Brew Tonics</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Area: Centered Weapon Hotbar & Ammo Indicator */}
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-stone-950/90 backdrop-blur-md px-5 py-1.5 rounded-full border border-amber-500/30 text-xs text-stone-200 font-mono shadow-xl text-center max-w-md animate-in fade-in">
            {toastMessage}
          </div>
        )}

        {/* Unified Weapon Slots Hotbar (Desktop & Tablet) */}
        <div className="hidden md:flex items-center gap-2 bg-stone-950/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-stone-800/80 shadow-2xl">
          {QUICK_WEAPON_SLOTS.map((slot) => {
            const isEquipped = player.equippedWeapon === slot.id;
            return (
              <button
                key={slot.id}
                onClick={() => onSwitchWeapon && onSwitchWeapon(slot.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition ${
                  isEquipped
                    ? 'bg-amber-600 text-stone-950 border border-amber-300 shadow-lg scale-105'
                    : 'bg-stone-900/80 text-stone-300 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                <span className="text-[10px] opacity-75 font-mono">[{slot.key}]</span>
                <span>{slot.label}</span>
              </button>
            );
          })}

          {/* Active Ammo / Stance Divider */}
          <div className="h-6 w-[1px] bg-stone-800 mx-1" />

          {/* Active Weapon Ammo Counter */}
          <div className="flex items-center gap-2 px-2 text-xs font-mono">
            {currentWeaponDef.type !== 'melee' ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-amber-300">{curMag}</span>
                <span className="text-stone-500 text-[11px]">/ {currentWeaponDef.magSize}</span>
                <span className="text-stone-400 text-[10px]">({reserveCount} Res)</span>
              </div>
            ) : (
              <span className="text-stone-300 font-bold text-[11px]">MELEE READY</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
