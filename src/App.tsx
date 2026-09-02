import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MasterEngine } from './engine/MasterEngine';
import { GameHUD } from './components/GameHUD';
import { WantedPosterModal } from './components/WantedPosterModal';
import { DialogueModal } from './components/DialogueModal';
import { InventoryModal } from './components/InventoryModal';
import { CrimeLogModal } from './components/CrimeLogModal';
import { AiInspectorModal } from './components/AiInspectorModal';
import { SettingsModal, GameSettings, DEFAULT_SETTINGS, loadSavedSettings } from './components/SettingsModal';
import { TouchControls } from './components/TouchControls';
import { OrientationLockPrompt } from './components/OrientationLockPrompt';
import { BountyContract, InventoryItem, PlayerStance } from './types/game';
import { CraftingRecipe, DialogueNode } from './engine/gameplay/InventoryEconomy';
import { useResponsive } from './hooks/useResponsive';
import { uniquePlayerCounter } from './services/uniquePlayerCounter';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MasterEngine | null>(null);
  const responsive = useResponsive();

  const [activeModal, setActiveModal] = useState<
    'none' | 'wanted' | 'dialogue' | 'inventory' | 'crime' | 'ai' | 'settings'
  >('none');

  const [settings, setSettings] = useState<GameSettings>(() => loadSavedSettings());
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [totalVisitors, setTotalVisitors] = useState<number>(1);
  const [uniquePlayers, setUniquePlayers] = useState<number>(1);
  const [isAutoSaved, setIsAutoSaved] = useState<boolean>(false);
  const [bypassOrientationLock, setBypassOrientationLock] = useState<boolean>(false);
  const [isEngineReady, setIsEngineReady] = useState<boolean>(false);
  const [engineInitError, setEngineInitError] = useState<string | null>(null);

  // React state mirroring engine state for reactive UI updates
  const [, setTick] = useState(0);

  // 1. Initialize privacy-friendly Firestore unique player counter
  useEffect(() => {
    const cleanup = uniquePlayerCounter.initialize((state) => {
      if (typeof state.totalUniquePlayers === 'number') {
        setUniquePlayers(state.totalUniquePlayers);
      }
    });

    return () => cleanup();
  }, []);

  // Generate or retrieve persistent local visitor ID for server sessions safely
  const visitorIdRef = useRef<string>((() => {
    try {
      let id = localStorage.getItem('vp_visitor_id');
      if (!id) {
        id = 'vis_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        localStorage.setItem('vp_visitor_id', id);
      }
      return id;
    } catch {
      return 'vis_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    }
  })());

  // 2. Real-time visitor ping to Express / Google Cloud backend
  useEffect(() => {
    const vId = visitorIdRef.current;

    const pingServer = async () => {
      try {
        const res = await fetch('/api/visitors/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: vId })
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
          if (typeof data.totalVisitors === 'number') setTotalVisitors(data.totalVisitors);
        }
      } catch {
        // Fallback offline values if server is booting
      }
    };

    pingServer();
    const interval = setInterval(pingServer, 15000);
    return () => clearInterval(interval);
  }, []);

  // 3. Initialize MasterEngine and 3D Game Loop
  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;

    let syncInterval: NodeJS.Timeout | null = null;
    const engine = new MasterEngine();
    engineRef.current = engine;

    engine
      .initialize(canvasRef.current)
      .then(() => {
        engine.applySettings(settings);
        setIsEngineReady(true);

        // Periodic UI state sync (10 times a sec)
        syncInterval = setInterval(() => {
          setTick((t) => t + 1);

          // Check if engine triggered dialogue opening
          if (engine.activeDialogue && activeModal !== 'dialogue') {
            setActiveModal('dialogue');
          }
        }, 100);
      })
      .catch((err) => {
        console.error('MasterEngine failed to initialize:', err);
        setEngineInitError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      engine.running = false;
    };
  }, []);

  const engine = engineRef.current;

  // 3. Automatic Background Save System (Runs every 20 seconds silently)
  useEffect(() => {
    const autoSaveTimer = setInterval(async () => {
      if (!engineRef.current || !engineRef.current.playerEntity) return;
      const eng = engineRef.current;
      const tr = eng.playerEntity.get<{ position: { toArray: () => [number, number, number] } }>('transform');
      if (!tr) return;

      try {
        await eng.saves.saveGame({
          version: 3,
          timestamp: Date.now(),
          gameTimeSeconds: eng.gameTimeSeconds,
          gameDay: eng.gameDay,
          player: {
            stats: eng.playerStats,
            pos: tr.position.toArray(),
            yaw: eng.playerYaw,
            pitch: eng.playerPitch
          },
          npcs: eng.ai.agents.map((a) => ({
            id: a.id,
            name: a.name,
            hp: a.hp,
            pos: a.position,
            gold: a.gold,
            needs: a.needs,
            emotions: a.emotions,
            state: a.state,
            goal: a.currentGoal,
            memories: a.memories
          }))
        });

        setIsAutoSaved(true);
        setTimeout(() => setIsAutoSaved(false), 2400);
      } catch {}
    }, 20000);

    return () => clearInterval(autoSaveTimer);
  }, []);

  // Settings change
  const handleUpdateSettings = useCallback((newSettings: GameSettings) => {
    setSettings(newSettings);
    if (engineRef.current) {
      engineRef.current.applySettings(newSettings);
    }
  }, []);

  // Modal Action Handlers
  const handleClaimReward = (contract: BountyContract) => {
    if (!engine) return;
    contract.claimed = true;
    engine.playerStats.gold += contract.rewardGold;
    engine.playerStats.reputation.huntersGuild += contract.rewardReputation;
    engine.playerStats.reputation.townsfolk += Math.floor(contract.rewardReputation * 0.8);
    engine.audio.playArrowImpact(false);
    engine.setToast(`Reward Collected: +${contract.rewardGold} Gold & +${contract.rewardReputation} Rep!`);
    setTick((t) => t + 1);
  };

  const handleUseItem = (item: InventoryItem) => {
    if (!engine) return;
    if (item.stats?.heal) {
      engine.playerStats.hp = Math.min(engine.playerStats.maxHp, engine.playerStats.hp + item.stats.heal);
    }
    if (item.stats?.stamina) {
      engine.playerStats.stamina = Math.min(
        engine.playerStats.maxStamina,
        engine.playerStats.stamina + item.stats.stamina
      );
    }
    if (item.stats?.hunger) {
      engine.playerStats.hunger = Math.min(
        engine.playerStats.maxHunger,
        engine.playerStats.hunger + item.stats.hunger
      );
      if (engine.playerStats.hunger > 0) {
        engine.playerStats.isStarving = false;
      }
    }
    if (item.stats?.thirst) {
      engine.playerStats.thirst = Math.min(
        engine.playerStats.maxThirst,
        engine.playerStats.thirst + item.stats.thirst
      );
      if (engine.playerStats.thirst > 0) {
        engine.playerStats.isDehydrated = false;
      }
    }

    item.count--;
    if (item.count <= 0) {
      const idx = engine.playerStats.inventory.indexOf(item);
      if (idx !== -1) engine.playerStats.inventory.splice(idx, 1);
    }

    engine.audio.playFootstep('wood', 0.8);
    engine.setToast(`Consumed ${item.name}!`);
    setTick((t) => t + 1);
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    if (!engine) return;
    // Deduct materials
    for (const ing of recipe.ingredients) {
      const invItem = engine.playerStats.inventory.find((i) => i.id === ing.itemId);
      if (invItem) {
        invItem.count -= ing.count;
        if (invItem.count <= 0) {
          const idx = engine.playerStats.inventory.indexOf(invItem);
          if (idx !== -1) engine.playerStats.inventory.splice(idx, 1);
        }
      }
    }

    // Add crafted result
    engine.addItemToInventory(recipe.resultItem);
    engine.audio.playArrowImpact(false);
    engine.setToast(`Crafted ${recipe.name}!`);
    setTick((t) => t + 1);
  };

  const handleBuyStoreProduct = (prod: { id: string; name: string; category: InventoryItem['category']; price: number; count: number; description: string; icon: string; stats?: InventoryItem['stats'] }) => {
    if (!engine) return;
    if (engine.playerStats.gold < prod.price) {
      engine.audio.playEmptyClick();
      engine.setToast('Insufficient gold to purchase this item!');
      return;
    }

    engine.playerStats.gold -= prod.price;
    const invItem: InventoryItem = {
      id: prod.id,
      name: prod.name,
      category: prod.category,
      count: prod.count,
      value: Math.floor(prod.price * 0.6),
      description: prod.description,
      icon: prod.icon,
      stats: prod.stats
    };

    engine.addItemToInventory(invItem);
    engine.audio.playArrowImpact(false);
    engine.setToast(`Purchased ${prod.name} for ${prod.price} Gold!`);
    setTick((t) => t + 1);
  };

  const handleSellBackpackItem = (item: InventoryItem) => {
    if (!engine) return;
    const sellValue = item.value || 5;
    engine.playerStats.gold += sellValue;
    item.count--;
    if (item.count <= 0) {
      const idx = engine.playerStats.inventory.indexOf(item);
      if (idx !== -1) engine.playerStats.inventory.splice(idx, 1);
    }
    engine.audio.playArrowImpact(false);
    engine.setToast(`Sold 1x ${item.name} for +${sellValue} Gold!`);
    setTick((t) => t + 1);
  };

  const handleEquipWeapon = (item: InventoryItem) => {
    if (!engine) return;
    if (engine.playerStats.equippedWeapon === item.id) {
      engine.playerStats.equippedWeapon = null;
      engine.setToast(`Unequipped ${item.name}`);
    } else {
      engine.playerStats.equippedWeapon = item.id;
      engine.setToast(`Equipped ${item.name}!`);
    }
    setTick((t) => t + 1);
  };

  const handleDropItem = (item: InventoryItem) => {
    if (!engine) return;
    item.count--;
    if (item.count <= 0) {
      const idx = engine.playerStats.inventory.indexOf(item);
      if (idx !== -1) engine.playerStats.inventory.splice(idx, 1);
    }
    engine.setToast(`Dropped ${item.name} onto ground.`);
    setTick((t) => t + 1);
  };

  const handleDialogueOption = (option: DialogueNode['options'][0]) => {
    if (!engine) return;
    if (option.action === 'trade') {
      setActiveModal('inventory');
      engine.activeDialogue = null;
    } else if (option.action === 'contracts') {
      setActiveModal('wanted');
      engine.activeDialogue = null;
    } else if (option.action === 'bribe') {
      const paid = engine.crime.payBounty(engine.playerStats);
      if (paid) {
        engine.setToast('Bounty paid in full! You are no longer wanted.');
      } else {
        engine.setToast('Insufficient gold to clear your bounty.');
      }
      setActiveModal('none');
      engine.activeDialogue = null;
    } else if (option.action === 'surrender') {
      engine.playerStats.bountyOnHead = 0;
      engine.playerStats.wantedLevel = 0;
      engine.playerStats.gold = Math.max(0, engine.playerStats.gold - 50);
      engine.setToast('Served short jail custody. Criminal slate cleared.');
      setActiveModal('none');
      engine.activeDialogue = null;
    } else if (option.reply) {
      if (engine.activeDialogue) {
        engine.activeDialogue.node.speakerText = option.reply;
        setTick((t) => t + 1);
      }
    } else {
      setActiveModal('none');
      engine.activeDialogue = null;
    }
  };

  const canInteract = Boolean(
    (engine?.targetedNPC && engine.targetedNPC.hp > 0) ||
    (engine?.targetedAnimal && !engine.targetedAnimal.harvested) ||
    engine?.isNearWantedBoard ||
    engine?.isNearCampfire ||
    engine?.isNearWaterSource
  );

  const interactionPrompt = engine?.targetedAnimal && !engine.targetedAnimal.harvested
    ? `Harvest ${engine.targetedAnimal.name}`
    : engine?.targetedNPC && engine.targetedNPC.hp > 0
    ? `Talk to ${engine.targetedNPC.name}`
    : engine?.isNearWantedBoard
    ? 'Wanted Board'
    : engine?.isNearCampfire
    ? 'Campfire'
    : engine?.isNearWaterSource
    ? 'Drink Spring Water'
    : undefined;

  const shouldShowOrientationLock =
    responsive.isPortrait &&
    (responsive.hasTouch || responsive.isMobile || responsive.isTablet) &&
    !bypassOrientationLock;

  return (
    <div className="relative w-screen h-screen min-h-[100dvh] max-h-[100dvh] overflow-hidden bg-stone-950 select-none font-sans">
      {/* Forced Landscape Orientation Overlay for Mobile Devices */}
      {shouldShowOrientationLock && (
        <OrientationLockPrompt
          onRequestLandscape={responsive.requestLandscape}
          onBypass={() => setBypassOrientationLock(true)}
        />
      )}

      {/* Loading Overlay while Babylon Engine & 3D Pine Valley Generates */}
      {!isEngineReady && !engineInitError && (
        <div className="absolute inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-100">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-950/40 border border-amber-600/40 flex items-center justify-center shadow-2xl animate-pulse">
              <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-serif font-bold text-amber-200 tracking-wider mb-2">
            VANISHING PINES
          </h2>
          <p className="text-xs text-stone-400 font-mono tracking-wide max-w-xs">
            جاري تحميل عالم فلاتهيد والغابات والفيزياء...
          </p>
        </div>
      )}

      {/* Engine Init Error Fallback */}
      {engineInitError && (
        <div className="absolute inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-100">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-600/40 flex items-center justify-center mb-4 text-red-400 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-serif font-bold text-amber-200 mb-2">
            Frontier Engine Initializing Notice
          </h2>
          <p className="text-xs text-stone-400 max-w-sm mb-4">
            {engineInitError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-stone-950 font-bold rounded-xl text-xs font-mono"
          >
            إعادة المحاولة • Retry
          </button>
        </div>
      )}

      {/* 3D WebGL / WebGPU Viewport */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block outline-none cursor-crosshair"
        tabIndex={0}
        onClick={() => {
          if (engine) engine.audio.unlockAudio();
        }}
      />

      {/* Heads Up Display */}
      {engine && (
        <GameHUD
          player={engine.playerStats}
          playerPos={
            engine.playerEntity?.get<{ position: { x: number; y: number; z: number } }>('transform')
              ? [
                  engine.playerEntity.get<{ position: { x: number; y: number; z: number } }>('transform')!.position.x,
                  engine.playerEntity.get<{ position: { x: number; y: number; z: number } }>('transform')!.position.y,
                  engine.playerEntity.get<{ position: { x: number; y: number; z: number } }>('transform')!.position.z
                ]
              : [0, 0, 0]
          }
          playerYaw={engine.playerYaw}
          currentSurface={engine.surfaceAudio?.getCurrentSurface()}
          npcs={engine.ai.agents}
          animals={engine.animals.animals}
          gameTimeSeconds={engine.gameTimeSeconds}
          gameDay={engine.gameDay}
          stealthNoise={engine.stealthNoise}
          toastMessage={engine.toastMessage}
          targetedNPC={engine.targetedNPC}
          targetedAnimal={engine.animals.animals.find(a => a.hp <= 0 && !a.harvested) || engine.targetedAnimal}
          isNearWantedBoard={engine.isNearWantedBoard}
          isNearCampfire={engine.isNearCampfire}
          isNearWaterSource={engine.isNearWaterSource}
          onlineCount={onlineCount}
          totalVisitors={totalVisitors}
          uniquePlayers={uniquePlayers}
          isAutoSaved={isAutoSaved}
          isFullscreen={responsive.isFullscreen}
          activeInputMode={responsive.activeInputMode}
          onToggleInputMode={() =>
            responsive.setControlModeOverride(responsive.activeInputMode === 'pc' ? 'mobile' : 'pc')
          }
          onToggleFullscreen={responsive.toggleFullscreen}
          onOpenInventory={() => setActiveModal('inventory')}
          onOpenWantedBoard={() => setActiveModal('wanted')}
          onOpenSettings={() => setActiveModal('settings')}
          onOpenCrimeLog={() => setActiveModal('crime')}
          onOpenAiInspector={() => setActiveModal('ai')}
          onSwitchWeapon={(weaponId) => {
            engine.switchWeapon(weaponId);
            setTick((t) => t + 1);
          }}
        />
      )}

      {/* Mobile & Touch Dual-Stick Touch Controls (Shown only in Mobile/Touch input mode) */}
      {engine && responsive.activeInputMode === 'mobile' && (
        <TouchControls
          onMoveVector={(vx, vz, isSprint) => {
            engine.setMobileInput(vx, vz, isSprint);
          }}
          onLookDelta={(dx, dy) => {
            engine.applyLookDelta(dx, dy);
          }}
          onJump={() => {
            engine.triggerJump();
          }}
          onAttack={() => {
            engine.fireWeapon();
            setTick((t) => t + 1);
          }}
          onInteract={() => {
            engine.handleInteract();
          }}
          onToggleStance={(stance: PlayerStance) => {
            engine.setStance(stance);
          }}
          onSwitchWeapon={(weaponId) => {
            engine.switchWeapon(weaponId);
            setTick((t) => t + 1);
          }}
          onToggleAim={() => {
            engine.toggleAim();
            setTick((t) => t + 1);
          }}
          onReload={() => {
            engine.reloadWeapon();
            setTick((t) => t + 1);
          }}
          equippedWeapon={engine.playerStats.equippedWeapon || 'rifle_repeater'}
          isAiming={!!engine.playerStats.isAiming}
          isReloading={!!engine.playerStats.isReloading}
          currentStance={engine.playerStats.stance}
          canInteract={canInteract}
          interactionPrompt={interactionPrompt}
          autoSprintEnabled={settings.autoSprint}
        />
      )}

      {/* Interactive Modals */}
      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          currentSettings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'wanted' && engine && (
        <WantedPosterModal
          contracts={engine.crime.availableContracts}
          onClose={() => setActiveModal('none')}
          onClaimReward={handleClaimReward}
        />
      )}

      {activeModal === 'dialogue' && engine?.activeDialogue && (
        <DialogueModal
          agent={engine.activeDialogue.agent}
          dialogueNode={engine.activeDialogue.node}
          onOptionSelect={handleDialogueOption}
          onClose={() => {
            setActiveModal('none');
            engine.activeDialogue = null;
          }}
        />
      )}

      {activeModal === 'inventory' && engine && (
        <InventoryModal
          player={engine.playerStats}
          onClose={() => setActiveModal('none')}
          onUseItem={handleUseItem}
          onCraftRecipe={handleCraftRecipe}
          onBuyItem={handleBuyStoreProduct}
          onSellItem={handleSellBackpackItem}
          onEquipItem={handleEquipWeapon}
          onDropItem={handleDropItem}
        />
      )}

      {activeModal === 'crime' && engine && (
        <CrimeLogModal
          player={engine.playerStats}
          onClose={() => setActiveModal('none')}
          onPayBounty={() => {
            const paid = engine.crime.payBounty(engine.playerStats);
            if (paid) engine.setToast('Bounty paid in full!');
            else engine.setToast('Insufficient gold to clear bounty!');
          }}
        />
      )}

      {activeModal === 'ai' && engine && (
        <AiInspectorModal agents={engine.ai.agents} onClose={() => setActiveModal('none')} />
      )}
    </div>
  );
}
