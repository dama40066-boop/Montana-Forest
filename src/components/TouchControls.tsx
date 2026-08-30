// #09 PLAYER & CONTROLS - Modern Dual-Touch Analog Joystick, Aim Pad & Action Triggers
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Crosshair, ArrowUp, Zap, Shield, Sparkles, ChevronUp, UserCheck, Eye, RotateCcw, Target, Swords } from 'lucide-react';
import { PlayerStance } from '../types/game';
import { QUICK_WEAPON_SLOTS, getWeaponDef } from '../engine/gameplay/WeaponsRegistry';

interface Props {
  onMoveVector: (vx: number, vz: number, isSprint: boolean) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onJump: () => void;
  onAttack: () => void;
  onInteract: () => void;
  onToggleStance: (stance: PlayerStance) => void;
  onSwitchWeapon: (weaponId: string) => void;
  onToggleAim: () => void;
  onReload: () => void;
  equippedWeapon: string;
  isAiming: boolean;
  isReloading: boolean;
  currentStance: PlayerStance;
  canInteract: boolean;
  interactionPrompt?: string;
  autoSprintEnabled?: boolean;
}

export const TouchControls: React.FC<Props> = ({
  onMoveVector,
  onLookDelta,
  onJump,
  onAttack,
  onInteract,
  onToggleStance,
  onSwitchWeapon,
  onToggleAim,
  onReload,
  equippedWeapon,
  isAiming,
  isReloading,
  currentStance,
  canInteract,
  interactionPrompt,
  autoSprintEnabled = true
}) => {
  // Joystick Touch State
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });

  // Look Surface Touch State
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Auto sprint tracker
  const forwardHoldTime = useRef<number>(0);

  // Left Joystick Touch Handlers
  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joyTouchId.current = touch.identifier;

    if (joystickRef.current) {
      const rect = joystickRef.current.getBoundingClientRect();
      joyCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
    setJoystickActive(true);
    handleJoyMove(e);
  };

  const handleJoyMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (joyTouchId.current === null) return;
    let touch: Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return;

    const maxRadius = 46;
    const dx = touch.clientX - joyCenter.current.x;
    const dy = touch.clientY - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
    const ny = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

    setStickPos({
      x: nx * maxRadius,
      y: ny * maxRadius
    });

    const moveX = nx;
    const moveZ = -ny; // Invert Y so up is positive forward

    // Auto Sprint when pushed forward > 85%
    const isPushingForward = moveZ > 0.85;
    const isSprint = autoSprintEnabled && isPushingForward;

    onMoveVector(moveX, moveZ, isSprint);
  }, [autoSprintEnabled, onMoveVector]);

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setJoystickActive(false);
        setStickPos({ x: 0, y: 0 });
        forwardHoldTime.current = 0;
        onMoveVector(0, 0, false);
        break;
      }
    }
  };

  // Right Look Surface Handlers
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (lookTouchId.current === null) return;
    let touch: Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return;

    const dx = touch.clientX - lastLookPos.current.x;
    const dy = touch.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };

    // Apply smooth look delta
    onLookDelta(dx, dy);
  }, [onLookDelta]);

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  const currentWDef = getWeaponDef(equippedWeapon);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none md:hidden flex flex-col justify-end p-3 pb-4">
      {/* Main Touch Interaction Zone */}
      <div className="w-full flex justify-between items-end relative pb-2">
        {/* LEFT: Virtual Floating Analog Joystick */}
        <div
          ref={joystickRef}
          onTouchStart={handleJoyStart}
          onTouchMove={handleJoyMove}
          onTouchEnd={handleJoyEnd}
          onTouchCancel={handleJoyEnd}
          className="pointer-events-auto w-32 h-32 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center relative touch-none shadow-2xl"
        >
          {/* Inner stick cap */}
          <div
            className={`w-12 h-12 rounded-full border border-amber-400/60 shadow-lg flex items-center justify-center transition-transform duration-75 ${
              joystickActive ? 'bg-amber-600/80 scale-105' : 'bg-stone-800/80'
            }`}
            style={{
              transform: `translate(${stickPos.x}px, ${stickPos.y}px)`
            }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-amber-200/90" />
          </div>
        </div>

        {/* CENTER: Floating Mobile Quick Weapon Hotbar */}
        <div className="pointer-events-auto flex flex-col items-center gap-1 z-10 max-w-[45%]">
          <div className="flex items-center gap-1 bg-stone-950/80 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-stone-800 shadow-2xl overflow-x-auto max-w-full">
            {QUICK_WEAPON_SLOTS.map((slot) => {
              const isEquipped = equippedWeapon === slot.id;
              return (
                <button
                  key={slot.id}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    onSwitchWeapon(slot.id);
                  }}
                  className={`px-2 py-1 rounded-xl text-[10px] font-mono font-bold whitespace-nowrap transition ${
                    isEquipped
                      ? 'bg-amber-500 text-stone-950 border border-amber-200 shadow scale-105'
                      : 'bg-stone-900/90 text-stone-300 border border-stone-800'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER RIGHT: Look / Swipe Surface */}
        <div
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookEnd}
          className="absolute inset-y-0 right-0 w-2/3 pointer-events-auto touch-none"
        />

        {/* RIGHT: Modern Gameplay Action Buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-3 z-10">
          {/* Contextual Interact Button (E) */}
          {canInteract && (
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                onInteract();
              }}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-2xl border-2 border-amber-300 animate-pulse active:scale-95 transition"
            >
              <Sparkles className="w-4 h-4 text-stone-950" />
              {interactionPrompt || 'Interact [E]'}
            </button>
          )}

          {/* Combat Quick Controls Row (ADS & Reload) */}
          <div className="flex items-center gap-2.5">
            {/* ADS Aim Toggle Button */}
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                onToggleAim();
              }}
              className={`w-12 h-12 rounded-full backdrop-blur-md border font-mono font-bold flex items-center justify-center shadow-lg transition active:scale-95 ${
                isAiming
                  ? 'bg-amber-500 text-stone-950 border-amber-300 ring-2 ring-amber-400'
                  : 'bg-stone-900/80 text-stone-200 border-stone-700'
              }`}
              title="Aim Down Sights (ADS)"
            >
              <Target className="w-5 h-5" />
            </button>

            {/* Reload Button */}
            {currentWDef.type !== 'melee' && (
              <button
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onReload();
                }}
                className={`w-12 h-12 rounded-full bg-stone-900/80 active:bg-amber-700 backdrop-blur-md border border-stone-700 text-stone-200 flex items-center justify-center shadow-lg active:scale-95 transition ${
                  isReloading ? 'animate-spin border-amber-400 text-amber-400' : ''
                }`}
                title="Reload [R]"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Movement & Trigger Row */}
          <div className="flex items-center gap-3">
            {/* Stance Toggle (Crouch / Prone / Stand) */}
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                const nextStance: PlayerStance =
                  currentStance === 'STANDING' ? 'CROUCH' : currentStance === 'CROUCH' ? 'PRONE' : 'STANDING';
                onToggleStance(nextStance);
              }}
              className="w-12 h-12 rounded-full bg-stone-900/80 active:bg-amber-700 backdrop-blur-md border border-stone-700 text-stone-200 text-xs font-mono font-bold flex items-center justify-center shadow-lg"
            >
              {currentStance === 'STANDING' ? 'STND' : currentStance === 'CROUCH' ? 'CRCH' : 'PRON'}
            </button>

            {/* Jump Button */}
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="w-14 h-14 rounded-full bg-stone-800/80 active:bg-amber-600 backdrop-blur-md border border-stone-600 text-white flex items-center justify-center shadow-xl font-bold"
            >
              <ArrowUp className="w-6 h-6" />
            </button>

            {/* Primary Attack / Fire Weapon Button */}
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                onAttack();
              }}
              className="w-16 h-16 rounded-full bg-red-600/90 active:bg-red-500 backdrop-blur-md border-2 border-red-400 text-white flex items-center justify-center shadow-2xl active:scale-95 transition"
            >
              {currentWDef.type === 'melee' ? (
                <Swords className="w-8 h-8" />
              ) : (
                <Crosshair className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
