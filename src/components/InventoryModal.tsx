import React, { useState } from 'react';
import { InventoryItem, PlayerStats } from '../types/game';
import { CRAFTING_RECIPES, CraftingRecipe } from '../engine/gameplay/InventoryEconomy';
import {
  Package,
  Zap,
  Heart,
  Hammer,
  X,
  Trash2,
  Scale,
  Sword,
  ShoppingCart,
  Coins,
  CheckCircle2,
  ChevronRight,
  Utensils,
  Droplets
} from 'lucide-react';

interface StoreProduct {
  id: string;
  name: string;
  category: InventoryItem['category'];
  price: number;
  count: number;
  description: string;
  icon: string;
  stats?: InventoryItem['stats'];
}

export const GENERAL_STORE_CATALOG: StoreProduct[] = [
  {
    id: 'ammo_rifle',
    name: '.30-30 Repeater Rounds (x12)',
    category: 'ammo',
    price: 24,
    count: 12,
    description: 'High-velocity brass cartridges for Winchester repeating rifles.',
    icon: 'Zap'
  },
  {
    id: 'ammo_revolver',
    name: '.45 Colt Revolver Cartridges (x12)',
    category: 'ammo',
    price: 18,
    count: 12,
    description: 'Heavy lead bullets delivering high stopping power at close range.',
    icon: 'Crosshair'
  },
  {
    id: 'ammo_shotgun',
    name: '12-Gauge Buckshot Shells (x8)',
    category: 'ammo',
    price: 26,
    count: 8,
    description: 'Heavy multi-pellet spread shells for close quarters combat.',
    icon: 'Zap'
  },
  {
    id: 'ammo_arrow',
    name: 'Flinthead Hunting Arrows (x10)',
    category: 'ammo',
    price: 14,
    count: 10,
    description: 'Fletched cedar arrows with hand-carved obsidian heads.',
    icon: 'Compass'
  },
  {
    id: 'canteen_water',
    name: 'Mountain Spring Water Canteen',
    category: 'consumable',
    price: 8,
    count: 1,
    description: 'Clean mountain spring water. Quenches 45 Thirst and restores 15 Stamina.',
    icon: 'Droplets',
    stats: { thirst: 45, stamina: 15 }
  },
  {
    id: 'tonic_snakebite',
    name: 'Snakebite Miracle Tonic',
    category: 'consumable',
    price: 32,
    count: 1,
    description: 'Purified herbal elixir that restores 45 Health & cures poisons.',
    icon: 'Heart',
    stats: { heal: 45, stamina: 30 }
  },
  {
    id: 'tonic_bandage',
    name: 'Frontier Medical Bandage',
    category: 'consumable',
    price: 16,
    count: 1,
    description: 'Sterilized linen wrap soaked in witch hazel. Restores 35 Health.',
    icon: 'Heart',
    stats: { heal: 35 }
  },
  {
    id: 'roasted_venison',
    name: 'Campfire Roast Venison',
    category: 'consumable',
    price: 12,
    count: 1,
    description: 'Smoked deer meat seasoned with mountain sage. Satiates 45 Hunger, restores 25 HP & 30 Stamina.',
    icon: 'Coffee',
    stats: { hunger: 45, heal: 25, stamina: 30 }
  },
  {
    id: 'pioneer_stew',
    name: 'Hearty Pioneer Stew',
    category: 'consumable',
    price: 24,
    count: 1,
    description: 'Slow-simmered rich frontier stew. Satiates 75 Hunger, 40 Thirst & restores 50 HP.',
    icon: 'Coffee',
    stats: { hunger: 75, thirst: 40, heal: 50, stamina: 40 }
  },
  {
    id: 'knife_hunter',
    name: 'Frontier Bowie Knife',
    category: 'weapon',
    price: 50,
    count: 1,
    description: 'Forged carbon-steel blade with elk antler grip. Silent and deadly.',
    icon: 'Sword',
    stats: { damage: 32 }
  },
  {
    id: 'shotgun_double',
    name: 'Double-Barrel Coach Shotgun',
    category: 'weapon',
    price: 140,
    count: 1,
    description: 'Break-action 12-gauge shotgun capable of firing devastating dual spreads.',
    icon: 'Crosshair',
    stats: { damage: 72 }
  }
];

interface Props {
  player: PlayerStats;
  onClose: () => void;
  onUseItem: (item: InventoryItem) => void;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  onBuyItem?: (product: StoreProduct) => void;
  onSellItem?: (item: InventoryItem) => void;
  onEquipItem?: (item: InventoryItem) => void;
  onDropItem?: (item: InventoryItem) => void;
}

export const InventoryModal: React.FC<Props> = ({
  player,
  onClose,
  onUseItem,
  onCraftRecipe,
  onBuyItem,
  onSellItem,
  onEquipItem,
  onDropItem
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'crafting' | 'shop'>('items');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(() => {
    return player.inventory.length > 0 ? player.inventory[0] : null;
  });

  const getItemWeight = (item: InventoryItem): number => {
    switch (item.category) {
      case 'weapon': return 3.2;
      case 'ammo': return 0.05 * item.count;
      case 'consumable': return 0.4 * item.count;
      case 'material': return 0.6 * item.count;
      case 'valuable': return 1.2 * item.count;
      default: return 0.2 * item.count;
    }
  };

  const totalWeight = player.inventory.reduce((sum, i) => sum + getItemWeight(i), 0);
  const maxCapacity = 45.0;

  const filteredItems = player.inventory.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl h-[92vh] max-h-[92dvh] bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Responsive Modal Header */}
        <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 bg-stone-950 border-b border-stone-800 gap-2">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('items')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'items'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Backpack</span>
            </button>

            <button
              onClick={() => setActiveTab('crafting')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'crafting'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Crafting</span>
            </button>

            <button
              onClick={() => setActiveTab('shop')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'shop'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Store</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Weight Bar (Hidden on ultra-narrow) */}
            <div className="hidden xs:flex items-center gap-1.5 text-[11px] sm:text-xs font-mono">
              <Scale className="w-3.5 h-3.5 text-stone-400" />
              <div className="w-14 sm:w-20 h-1.5 sm:h-2 bg-stone-800 rounded-full overflow-hidden border border-stone-700">
                <div
                  className={`h-full ${
                    totalWeight > maxCapacity ? 'bg-red-500' : totalWeight > maxCapacity * 0.8 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (totalWeight / maxCapacity) * 100)}%` }}
                />
              </div>
              <span className={totalWeight > maxCapacity ? 'text-red-400 font-bold' : 'text-stone-300'}>
                {totalWeight.toFixed(1)}kg
              </span>
            </div>

            {/* Gold Badge */}
            <div className="bg-amber-950/60 border border-amber-600/40 px-2 sm:px-3 py-1 rounded-lg text-amber-300 font-mono text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-inner">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{player.gold}g</span>
            </div>

            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition active:scale-95"
              title="Close [ESC / I]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'items' && (
          <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-5 gap-3 sm:gap-4">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 text-[11px] sm:text-xs no-scrollbar">
              {['all', 'weapon', 'ammo', 'consumable', 'material', 'valuable'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-mono capitalize whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                      : 'bg-stone-800/80 border border-stone-700 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden gap-3 sm:gap-5">
              {/* Inventory Grid */}
              <div className="md:col-span-2 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-stone-500 font-mono text-xs">
                    No items in this category.
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isEquipped = player.equippedWeapon === item.id;
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col justify-between h-20 sm:h-24 ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                            : 'bg-stone-950/60 border-stone-800 hover:border-stone-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[11px] sm:text-xs font-semibold text-stone-200 truncate">{item.name}</span>
                          {isEquipped ? (
                            <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1 rounded font-mono whitespace-nowrap">
                              EQUIP
                            </span>
                          ) : (
                            <span className="text-[10px] bg-stone-800 px-1 py-0.5 rounded text-stone-300 font-mono">
                              x{item.count}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400 font-mono">
                          <span className="capitalize">{item.category}</span>
                          <span className="text-amber-400 font-bold">{item.value}g</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Item Details Panel */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-inner overflow-y-auto">
                {selectedItem ? (
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-amber-300 font-serif mb-1">
                      {selectedItem.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-stone-400 uppercase tracking-wider mb-2 font-mono">
                      <span>{selectedItem.category}</span>
                      <span>•</span>
                      <span className="text-amber-400">{selectedItem.value}g</span>
                      <span>•</span>
                      <span>{getItemWeight(selectedItem).toFixed(2)}kg</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-stone-300 leading-relaxed mb-3">
                      {selectedItem.description}
                    </p>

                    {/* Stats Box */}
                    <div className="space-y-1.5 mb-3 text-[11px] sm:text-xs font-mono bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
                      {selectedItem.stats?.damage && (
                        <div className="flex items-center gap-1.5 text-red-400">
                          <Sword className="w-3.5 h-3.5" /> Damage: +{selectedItem.stats.damage}
                        </div>
                      )}
                      {selectedItem.stats?.heal && (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Heart className="w-3.5 h-3.5" /> Heals: +{selectedItem.stats.heal} HP
                        </div>
                      )}
                      {selectedItem.stats?.stamina && (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <Zap className="w-3.5 h-3.5" /> Stamina: +{selectedItem.stats.stamina}
                        </div>
                      )}
                      {selectedItem.stats?.hunger && (
                        <div className="flex items-center gap-1.5 text-orange-400">
                          <Utensils className="w-3.5 h-3.5" /> Hunger: +{selectedItem.stats.hunger}
                        </div>
                      )}
                      {selectedItem.stats?.thirst && (
                        <div className="flex items-center gap-1.5 text-cyan-400">
                          <Droplets className="w-3.5 h-3.5" /> Thirst: +{selectedItem.stats.thirst}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 italic py-4">Select an item in your bag to inspect.</div>
                )}

                {/* Actions */}
                {selectedItem && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-800">
                    {selectedItem.category === 'consumable' && (
                      <button
                        onClick={() => onUseItem(selectedItem)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs rounded-lg transition shadow active:scale-95"
                      >
                        Consume / Apply Item
                      </button>
                    )}

                    {selectedItem.category === 'weapon' && onEquipItem && (
                      <button
                        onClick={() => onEquipItem(selectedItem)}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition shadow active:scale-95"
                      >
                        {player.equippedWeapon === selectedItem.id ? 'Unequip Weapon' : 'Equip Weapon'}
                      </button>
                    )}

                    {onDropItem && (
                      <button
                        onClick={() => onDropItem(selectedItem)}
                        className="w-full py-1.5 bg-stone-800 hover:bg-red-950 hover:text-red-300 text-stone-400 text-xs rounded-lg transition flex items-center justify-center gap-1.5 font-mono active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Drop onto Ground
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Crafting Tab */}
        {activeTab === 'crafting' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 content-start">
            {CRAFTING_RECIPES.map((r) => {
              const canCraft = r.ingredients.every((ing) => {
                const item = player.inventory.find((i) => i.id === ing.itemId);
                return item && item.count >= ing.count;
              });

              return (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition"
                >
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                      <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> {r.name}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-stone-400 mb-2.5">{r.resultItem.description}</p>

                    <div className="text-[11px] space-y-1 mb-3 font-mono bg-stone-900/40 p-2 sm:p-2.5 rounded-lg border border-stone-800/80">
                      <span className="text-stone-400 block font-sans font-semibold mb-0.5">Ingredients:</span>
                      {r.ingredients.map((ing) => {
                        const invCount = player.inventory.find((i) => i.id === ing.itemId)?.count || 0;
                        const hasEnough = invCount >= ing.count;
                        return (
                          <div
                            key={ing.itemId}
                            className={`flex justify-between ${
                              hasEnough ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            <span>{ing.name}</span>
                            <span>
                              {invCount} / {ing.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    disabled={!canCraft}
                    onClick={() => onCraftRecipe(r)}
                    className={`w-full py-2 text-xs font-bold rounded-lg transition active:scale-95 ${
                      canCraft
                        ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow'
                        : 'bg-stone-800 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    Craft Item
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Shop / Trading Post Tab */}
        {activeTab === 'shop' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden p-3 sm:p-5 gap-3 sm:gap-5">
            {/* Catalog Grid */}
            <div className="md:col-span-2 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
              {GENERAL_STORE_CATALOG.map((prod) => {
                const canAfford = player.gold >= prod.price;
                return (
                  <div
                    key={prod.id}
                    className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 flex flex-col justify-between hover:border-amber-500/40 transition gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold text-stone-200">{prod.name}</span>
                        <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/40">
                          {prod.price}g
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 mt-1 leading-relaxed">{prod.description}</p>
                    </div>

                    <button
                      disabled={!canAfford}
                      onClick={() => onBuyItem && onBuyItem(prod)}
                      className={`w-full py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        canAfford
                          ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow'
                          : 'bg-stone-800 text-stone-600 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Buy ({prod.price}g)
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Sell Backpack Items for Gold */}
            <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-inner">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-300 font-serif mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" /> Sell Goods
                </h3>
                <p className="text-[10px] sm:text-[11px] text-stone-400 mb-2">
                  Sell pelts, meat, or loot to earn gold.
                </p>

                <div className="space-y-1.5 max-h-[35vh] sm:max-h-[42vh] overflow-y-auto pr-1">
                  {player.inventory.map((item) => (
                    <div
                      key={`sell_${item.id}`}
                      className="p-2 rounded-lg bg-stone-900/70 border border-stone-800 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-stone-200 truncate text-[11px]">{item.name}</div>
                        <div className="text-[9px] text-stone-400 font-mono">
                          x{item.count} • {item.value}g ea
                        </div>
                      </div>
                      <button
                        onClick={() => onSellItem && onSellItem(item)}
                        className="px-2 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-stone-950 font-bold text-[10px] sm:text-xs rounded transition shadow active:scale-95 whitespace-nowrap"
                      >
                        Sell (+{item.value}g)
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 sm:pt-3 border-t border-stone-800 text-[10px] sm:text-[11px] text-stone-400 font-mono text-center">
                Gold: <span className="text-amber-400 font-bold">{player.gold}g</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
