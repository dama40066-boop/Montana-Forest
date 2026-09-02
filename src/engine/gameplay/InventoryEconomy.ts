// #11 INVENTORY & #12 ITEMS - Dynamic Economy, Item Catalog, Crafting Recipes & Dynamic Dialogue Tree
import { InventoryItem, PlayerStats, BountyContract } from '../../types/game';
import { NPCAgentData } from '../ai/NPCBrain';

export const INITIAL_PLAYER_INVENTORY: InventoryItem[] = [
  {
    id: 'bow_pine',
    name: 'Pine Recurve Bow',
    category: 'weapon',
    count: 1,
    value: 45,
    description: 'A flexible recurve bow carved from cured pine wood. Silent and effective at range.',
    icon: 'Crosshair',
    stats: { damage: 40 }
  },
  {
    id: 'rifle_repeater',
    name: 'Winchester .30-30 Carbine',
    category: 'weapon',
    count: 1,
    value: 120,
    description: 'Lever-action repeating rifle with high stopping power and long range.',
    icon: 'Crosshair',
    stats: { damage: 75 }
  },
  {
    id: 'revolver_colt',
    name: 'Colt .45 Peacemaker',
    category: 'weapon',
    count: 1,
    value: 80,
    description: 'Six-cylinder single action revolver. Quick to draw and fire.',
    icon: 'Zap',
    stats: { damage: 55 }
  },
  {
    id: 'shotgun_double',
    name: 'Double-Barrel 12G Shotgun',
    category: 'weapon',
    count: 1,
    value: 95,
    description: 'Double-barrel coach gun firing heavy buckshot pellets.',
    icon: 'Shield',
    stats: { damage: 128 }
  },
  {
    id: 'knife_hunter',
    name: 'Frontier Bowie Knife',
    category: 'weapon',
    count: 1,
    value: 25,
    description: 'Sturdy carbon steel blade for skinning carcasses and melee defense.',
    icon: 'Shield',
    stats: { damage: 32 }
  },
  {
    id: 'arrow_hunting',
    name: 'Flinthead Hunting Arrow',
    category: 'ammo',
    count: 24,
    value: 2,
    description: 'Sharp flint arrowheads fletched with goose feathers.',
    icon: 'Navigation'
  },
  {
    id: 'ammo_rifle',
    name: '.30-30 Rifle Cartridge',
    category: 'ammo',
    count: 36,
    value: 4,
    description: 'Brass cased high-velocity rifle cartridges.',
    icon: 'Crosshair'
  },
  {
    id: 'ammo_revolver',
    name: '.45 LC Revolver Round',
    category: 'ammo',
    count: 42,
    value: 3,
    description: 'Heavy lead bullets for six-shooter revolvers.',
    icon: 'Zap'
  },
  {
    id: 'ammo_shotgun',
    name: '12G Buckshot Shell',
    category: 'ammo',
    count: 20,
    value: 5,
    description: 'Red plastic shell packed with heavy lead buckshot.',
    icon: 'Shield'
  },
  {
    id: 'bandage_herbal',
    name: 'Herbal Linen Bandage',
    category: 'consumable',
    count: 4,
    value: 10,
    description: 'Clean linen wrapped with soothing comfrey and yarrow herbs. Restores 40 Health.',
    icon: 'Heart',
    stats: { heal: 40 }
  },
  {
    id: 'canteen_water',
    name: 'Spring Water Canteen',
    category: 'consumable',
    count: 3,
    value: 8,
    description: 'Fresh, ice-cold mountain spring water. Quenches 45 Thirst and restores 15 Stamina.',
    icon: 'Droplets',
    stats: { thirst: 45, stamina: 15 }
  },
  {
    id: 'cooked_venison',
    name: 'Smoked Venison Steak',
    category: 'consumable',
    count: 3,
    value: 12,
    description: 'Tender venison smoked over pine embers. Satiates 45 Hunger, restores 25 Health and 30 Stamina.',
    icon: 'Coffee',
    stats: { hunger: 45, heal: 25, stamina: 30 }
  },
  {
    id: 'wild_berries',
    name: 'Wild Alpine Berries',
    category: 'consumable',
    count: 5,
    value: 4,
    description: 'Sweet gathered blackberries & huckleberries. Satiates 15 Hunger & quenches 15 Thirst.',
    icon: 'Apple',
    stats: { hunger: 15, thirst: 15, heal: 5 }
  }
];

export interface CraftingRecipe {
  id: string;
  name: string;
  resultItem: InventoryItem;
  ingredients: { itemId: string; name: string; count: number }[];
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_arrows',
    name: 'Craft 5x Hunting Arrows',
    resultItem: {
      id: 'arrow_hunting',
      name: 'Flinthead Hunting Arrow',
      category: 'ammo',
      count: 5,
      value: 2,
      description: 'Handcrafted hunting arrows.',
      icon: 'Navigation'
    },
    ingredients: [
      { itemId: 'wood_timber', name: 'Wood Timber', count: 1 }
    ]
  },
  {
    id: 'craft_bandage',
    name: 'Linen Bandage',
    resultItem: {
      id: 'bandage_herbal',
      name: 'Herbal Linen Bandage',
      category: 'consumable',
      count: 1,
      value: 10,
      description: 'Restores 40 Health.',
      icon: 'Heart',
      stats: { heal: 40 }
    },
    ingredients: [
      { itemId: 'herb_yarrow', name: 'Forest Herbs', count: 2 }
    ]
  },
  {
    id: 'cook_meat',
    name: 'Campfire Roast Meat',
    resultItem: {
      id: 'cooked_venison',
      name: 'Smoked Venison Steak',
      category: 'consumable',
      count: 1,
      value: 12,
      description: 'Satiates 45 Hunger, restores 25 Health and 30 Stamina.',
      icon: 'Coffee',
      stats: { hunger: 45, heal: 25, stamina: 30 }
    },
    ingredients: [
      { itemId: 'raw_meat', name: 'Raw Carcass Meat', count: 1 }
    ]
  },
  {
    id: 'cook_stew',
    name: 'Hearty Pioneer Stew',
    resultItem: {
      id: 'pioneer_stew',
      name: 'Hearty Pioneer Stew',
      category: 'consumable',
      count: 1,
      value: 24,
      description: 'Slow-simmered stew with venison, roots and spring water. Satiates 75 Hunger, 40 Thirst & restores 50 HP.',
      icon: 'Coffee',
      stats: { hunger: 75, thirst: 40, heal: 50, stamina: 40 }
    },
    ingredients: [
      { itemId: 'raw_meat', name: 'Raw Carcass Meat', count: 1 },
      { itemId: 'herb_yarrow', name: 'Forest Herbs', count: 1 }
    ]
  }
];

export interface DialogueNode {
  speakerText: string;
  options: {
    label: string;
    action?: 'trade' | 'contracts' | 'bribe' | 'surrender' | 'rumors' | 'close';
    reply?: string;
  }[];
}

export function generateDialogue(
  agent: NPCAgentData,
  player: PlayerStats
): DialogueNode {
  const rel = agent.relationships.get('player');
  const isWanted = player.wantedLevel > 0;
  const isHostile = agent.emotions.label === 'HOSTILE' || player.wantedLevel >= 4;

  if (agent.occupation === 'Town Sheriff') {
    if (isWanted) {
      return {
        speakerText: `Halt, citizen! There is a ${player.bountyOnHead} gold bounty on your head in Vanishing Pines. Will you pay your lawful debt to the town or answer to iron?`,
        options: [
          {
            label: `[Pay Bounty] Hand over ${player.bountyOnHead} Gold coins.`,
            action: 'bribe',
            reply: 'Your record is cleared with the town constabulary. Walk carefully from now on.'
          },
          {
            label: `[Surrender] Yield without resistance.`,
            action: 'surrender',
            reply: 'You are placed under temporary custody. Your fines are settled.'
          },
          {
            label: `I will not be held by anyone. [Close]`,
            action: 'close'
          }
        ]
      };
    } else {
      return {
        speakerText: `Welcome to Vanishing Pines. I keep the peace along the timber roads. Report any poachers, bandits, or strange occurrences directly to me.`,
        options: [
          {
            label: 'Inspect Town Bounty Board and Wanted Writs.',
            action: 'contracts',
            reply: 'Check the official wanted posters posted on our board.'
          },
          {
            label: 'Have you heard any rumors regarding outlaws?',
            action: 'rumors',
            reply: 'Silas Blackwood is camped in the rocky hills to the south. Keep your bow strung if you venture out there.'
          },
          {
            label: 'Safe travels, Sheriff. [Leave]',
            action: 'close'
          }
        ]
      };
    }
  }

  if (agent.occupation === 'Master Hunter') {
    return {
      speakerText: `Greetings, hunter. The wind carries scent of heavy game near the lake basin. Keep low to the grass and mind your noise if you stalk the stags.`,
      options: [
        {
          label: 'View Hunting & Outlaw Bounties.',
          action: 'contracts',
          reply: 'Here are the contracts sanctioned by the Hunter\'s Guild.'
        },
        {
          label: 'I have pelts and game to sell. [Trade]',
          action: 'trade'
        },
        {
          label: 'Any advice for tracking animals in the pines?',
          action: 'rumors',
          reply: 'Crouch in tall grass to muffle your footsteps. If a stag raises its head in alert, freeze in place.'
        },
        {
          label: 'Good hunting. [Leave]',
          action: 'close'
        }
      ]
    };
  }

  if (agent.occupation === 'General Merchant') {
    return {
      speakerText: `Fine day for trade! I buy harvested timber, cured pelts, and rare herbs, and sell arrows, supplies, and tools.`,
      options: [
        {
          label: 'Open Trade Goods & Supplies. [Trade]',
          action: 'trade'
        },
        {
          label: 'What goods are in highest demand?',
          action: 'rumors',
          reply: 'Venison and bear pelts fetch the finest coin in the valley right now.'
        },
        {
          label: 'Farewell, Tobin. [Leave]',
          action: 'close'
        }
      ]
    };
  }

  if (agent.occupation === 'Tavern Host') {
    return {
      speakerText: `Pull up a stool by the fire at Pines Hearth! Hot stew and cool ale for weary travelers. What brings you to our valley?`,
      options: [
        {
          label: 'What rumors have travelers brought into the tavern?',
          action: 'rumors',
          reply: 'Folks say shadows move among the high pines at dusk, and Silas\'s bandit crew has been raiding supply wagons near the gorge.'
        },
        {
          label: 'I would like to purchase food and drink. [Trade]',
          action: 'trade'
        },
        {
          label: 'Thank you Maeve, enjoy the evening. [Leave]',
          action: 'close'
        }
      ]
    };
  }

  // Generic Townsfolk / Outlaw
  return {
    speakerText: agent.isWantedTarget
      ? `You walked into the wrong camp, stranger. Draw steel or turn back into the woods!`
      : `Good day. Peace is hard-won in these woods. Mind your step along the lake trails.`,
    options: [
      {
        label: 'What can you tell me about this region?',
        action: 'rumors',
        reply: 'The village stays quiet as long as we watch out for wild beasts and outlaws.'
      },
      {
        label: 'Take care. [Leave]',
        action: 'close'
      }
    ]
  };
}
