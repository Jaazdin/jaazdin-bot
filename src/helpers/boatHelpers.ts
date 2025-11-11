import { AutocompleteInteraction, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Boat, Shipment } from '~/db/models/Boat';
import { formatNames, randomInt } from './helpers';

// Import additional models for shipment generation
import { generateRandomWeaponWithMetalByRarity } from '~/commands/itemGeneration/generateweapon';
import { generateRandomArmorWithMetalByRarity } from '~/commands/itemGeneration/generatearmor';
import { getRandomPetByRarityAndType } from '~/commands/itemGeneration/generatepet';
import { getRandomReagentByRarity, getRandomReagentByRarityAndType } from '~/commands/itemGeneration/generatereagent';
import { getRandomMetalByRarity, getRandomMetalByRarityExcludingPlanes } from '~/commands/itemGeneration/generatemetal';
import { getRandomMealByRarity } from '~/commands/itemGeneration/generatefood';
import { getRandomPotionByRarity } from '~/commands/itemGeneration/generatepotion';
import { getRandomPoisonByRarity } from '~/commands/itemGeneration/generatepoison';
import { getRandomSeedByRarity } from '~/commands/itemGeneration/generateseeds';
import { getRandomMagicItemByTable } from '~/commands/itemGeneration/generatemagicitem';

/**
 * Find a boat by name, with error handling
 */
export async function findBoatByName(interaction: ChatInputCommandInteraction, name: string): Promise<Boat | null> {
  const boat = await Boat.findOne({ where: { boatName: name } });

  if (!boat) {
    await interaction.reply({
      content: `⚠️ **Boat Not Found**\n\nNo boat named "${formatNames(name)}" exists in the system.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return boat;
}

/**
 * Boat name autocomplete helper
 */
export async function boatNameAutocomplete(
  interaction: AutocompleteInteraction,
  options: { runningOnly?: boolean; inTown?: boolean } = {}
): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const whereClause = {
    ...(options.runningOnly && { isRunning: true }),
    ...(options.inTown && { isInTown: true }),
  };
  const boats = await Boat.findAll({
    attributes: ['boatName'],
    where: whereClause,
  });

  const filtered = boats
    .map((boat) => boat.boatName)
    .filter((name) => name.toLowerCase().startsWith(focusedValue))
    .slice(0, 25)
    .map((name) => ({
      name: formatNames(name),
      value: name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  await interaction.respond(filtered);
}

export async function itemNameAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const boatName = interaction.options.getString('boat');
  if (!boatName) {
    await interaction.respond([]);
    return;
  }

  // Find the boat by name to get its ID
  const boat = await Boat.findOne({ where: { boatName } });
  if (!boat) {
    await interaction.respond([]);
    return;
  }

  // Find shipments by boatId
  const shipments = await Shipment.findAll({
    where: { boatId: boat.id },
    attributes: ['itemName'],
  });

  const choices = shipments
    .map((shipment) => shipment.itemName)
    .filter((itemName) => itemName.toLowerCase().includes(interaction.options.getFocused(true).value.toLowerCase()))
    .slice(0, 25)
    .map((itemName) => ({ name: formatNames(itemName), value: itemName }));

  await interaction.respond(choices);
}

export const tableToGenerateChoices = [
  { name: 'Metal Trading', value: 'metals' },
  { name: 'Weapons & Armor', value: 'weaponry' },
  { name: 'Exotic Creatures', value: 'pets' },
  { name: 'Fine Cuisine', value: 'meals' },
  { name: 'Potions & Poisons', value: 'poisonsPotions' },
  { name: 'Magic Items', value: 'magicItems' },
  { name: 'Seeds & Plants', value: 'plants' },
  { name: 'Magical Reagents', value: 'reagents' },
  { name: 'Otherworldly Materials', value: 'otherworld' },
  { name: 'Contraband Goods', value: 'smuggle' },
];

// Rarity/type range constants for concise mapping
const PET_RARITY_RANGES = [
  { min: 1, max: 5, value: 'Common' },
  { min: 6, max: 10, value: 'Uncommon' },
  { min: 11, max: 15, value: 'Rare' },
  { min: 16, max: 18, value: 'Very Rare' },
  { min: 19, max: 20, value: 'Legendary' },
];
const PET_TYPE_RANGES = [
  { min: 1, max: 8, value: 'Beast' },
  { min: 9, max: 13, value: 'Monstrosity' },
  { min: 14, max: 17, value: 'Aberration' },
  { min: 18, max: 19, value: 'Ooze' },
  { min: 20, max: 20, value: 'Dragon' },
];
const REAGENT_RARITY_RANGES = [
  { min: 1, max: 3, value: 'Common' },
  { min: 4, max: 12, value: 'Uncommon' },
  { min: 13, max: 15, value: 'Rare' },
  { min: 16, max: 19, value: 'Very Rare' },
  { min: 20, max: 20, value: 'Legendary' },
];
/**
 * Create a standard item generation embed
 */
export function createItemEmbed(
  title: string,
  itemName: string,
  additionalFields: Array<{ name: string; value: string }> = [],
  color: number = 0x2e86c1
) {
  let description = `**Item:** ${itemName}`;

  for (const field of additionalFields) {
    description += `\n**${field.name}:** ${field.value}`;
  }

  return {
    title,
    description,
    color,
  };
}

// Type definitions for shipment generation
export type ShipmentItem = { itemName: string; price: number; quantity: number; type: string };
type MetalPriceCache = { [metalName: string]: number };

export function getTypeArray(counts: { [rarity: string]: number }): string[] {
  const result: string[] = [];
  for (const [rarity, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      result.push(rarity);
    }
  }
  return result;
}

export function upgradeByCategoryOrder(
  base: string,
  roll: number,
  stepMap: { [roll: number]: number },
  order: string[]
): string {
  const idx = order.indexOf(base);
  if (idx === -1) return base;
  const step = stepMap[roll] || 0;
  return order[Math.min(idx + step, order.length - 1)];
}

export function typeFromInclusiveRanges(
  roll: number,
  ranges: { min: number; max: number; value: string }[],
  fallback: string
): string {
  for (const range of ranges) {
    if (roll >= range.min && roll <= range.max) return range.value;
  }
  return fallback;
}

/**
 * Add an item to the result array or increment its quantity if it already exists.
 */
function addOrIncrementItem(result: ShipmentItem[], itemName: string, price: number, type: string) {
  const existing = result.find((item) => item.itemName === itemName);
  if (existing) existing.quantity += 1;
  else result.push({ itemName, price, quantity: 1, type });
}

/**
 * Generate shipment items based on boat's table configuration
 */
export async function generateShipmentItems(boat: Boat): Promise<ShipmentItem[]> {
  switch (boat.tableToGenerate) {
    case 'metals': {
      const result: ShipmentItem[] = [];
      // Use helper to get base rarities
      let rarities = getTypeArray({ Uncommon: 5, Rare: 3 });
      const rarityOrder = ['Uncommon', 'Rare', 'Very Rare', 'Legendary'];
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 6);
        return upgradeByCategoryOrder(base, roll, { 5: 1, 6: 2 }, rarityOrder);
      });
      for (const rarity of rarities) {
        const metal = await getRandomMetalByRarity(rarity);
        if (metal) addOrIncrementItem(result, metal.name, randomInt(metal.price_min, metal.price_max), 'metal');
      }
      return result;
    }
    case 'weaponry': {
      const result: ShipmentItem[] = [];
      let rarities = Array(4).fill('Uncommon');
      const rarityOrder = ['Uncommon', 'Rare', 'Very Rare'];
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 4);
        return upgradeByCategoryOrder(base, roll, { 3: 1, 4: 2 }, rarityOrder);
      });
      const metalsInUse: MetalPriceCache = {};
      for (let i = 0; i < 4; i++) {
        const rarity = rarities[i];
        if (i < 2) {
          const combo = await generateRandomWeaponWithMetalByRarity(rarity);
          if (!combo) continue;
          const { weapon, metal } = combo;
          if (!(metal.name in metalsInUse)) metalsInUse[metal.name] = randomInt(metal.price_min, metal.price_max);
          const itemName = `${metal.name} ${weapon.name}`;
          const price = calculateMetalItemPrice(weapon, metalsInUse[metal.name]);
          addOrIncrementItem(result, itemName, price, 'weapon');
        } else {
          const combo = await generateRandomArmorWithMetalByRarity(rarity);
          if (!combo) continue;
          const { armor, metal } = combo;
          if (!(metal.name in metalsInUse)) metalsInUse[metal.name] = randomInt(metal.price_min, metal.price_max);
          const itemName = `${metal.name} ${armor.name}`;
          const price = calculateMetalItemPrice(armor, metalsInUse[metal.name]);
          addOrIncrementItem(result, itemName, price, 'armor');
        }
      }
      return result;
    }
    case 'pets': {
      const result: ShipmentItem[] = [];
      // Use helper to get base rarities
      const rarities = Array(5)
        .fill(0)
        .map(() => typeFromInclusiveRanges(randomInt(1, 20), PET_RARITY_RANGES, 'Common'));
      for (const rarity of rarities) {
        let pet = null,
          type: string;
        do {
          type = typeFromInclusiveRanges(randomInt(1, 20), PET_TYPE_RANGES, 'Beast');
          pet = await getRandomPetByRarityAndType(rarity, type);
        } while (!pet);
        addOrIncrementItem(result, pet.name, randomInt(pet.price_min, pet.price_max), 'pet');
      }
      return result;
    }
    case 'meals': {
      const result: ShipmentItem[] = [];
      let rarities = getTypeArray({ Common: 4, Uncommon: 4, Rare: 4 });
      const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Very Rare'];
      // Use unified upgrade helper with stepMap: roll 4 = +1 step
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 4);
        return upgradeByCategoryOrder(base, roll, { 4: 1 }, rarityOrder);
      });
      for (const rarity of rarities) {
        const meal = await getRandomMealByRarity(rarity);
        if (meal) addOrIncrementItem(result, meal.name, randomInt(meal.price_min, meal.price_max), 'meal');
      }
      return result;
    }
    case 'poisonsPotions': {
      const result: ShipmentItem[] = [];
      // Potions
      let potionRarities = getTypeArray({ Uncommon: 3, Rare: 2 });
      const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
      potionRarities = potionRarities.map((base) => {
        const roll = randomInt(1, 4);
        return upgradeByCategoryOrder(base, roll, [4], rarityOrder);
      });
      for (const rarity of potionRarities) {
        const potion = await getRandomPotionByRarity(rarity);
        if (potion) addOrIncrementItem(result, potion.name, randomInt(potion.price_min, potion.price_max), 'potion');
      }
      // Poisons
      let poisonRarities = getTypeArray({ Uncommon: 2, Rare: 2 });
      poisonRarities = poisonRarities.map((base) => {
        const roll = randomInt(1, 4);
        return upgradeByCategoryOrder(base, roll, [4], rarityOrder);
      });
      for (const rarity of poisonRarities) {
        const poison = await getRandomPoisonByRarity(rarity);
        if (poison) addOrIncrementItem(result, poison.name, randomInt(poison.price_min, poison.price_max), 'poison');
      }
      return result;
    }
    case 'magicItems': {
      const result: ShipmentItem[] = [];
      const tableOrder = ['A', 'B', 'C', 'D'];
      for (let i = 0; i < 8; i++) {
        const baseIdx = i < 5 ? 0 : 1;
        const roll = randomInt(1, 6);
        const table = upgradeByCategoryOrder(tableOrder[baseIdx], roll, { 5: 1, 6: 2 }, tableOrder);
        const item = await getRandomMagicItemByTable(table);
        if (item) addOrIncrementItem(result, item.name, randomInt(item.price_min, item.price_max), 'magic item');
      }
      return result;
    }
    case 'plants': {
      const result: ShipmentItem[] = [];
      let rarities = getTypeArray({ Common: 2, Uncommon: 2, Rare: 2 });
      const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
      // Use unified upgrade helper: roll 3 = +1 step, roll 4 = +2 steps
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 4);
        return upgradeByCategoryOrder(base, roll, { 3: 1, 4: 2 }, rarityOrder);
      });
      for (const rarity of rarities) {
        const seed = await getRandomSeedByRarity(rarity);
        if (seed) addOrIncrementItem(result, seed.name, randomInt(seed.price_min, seed.price_max), 'seed');
      }
      return result;
    }
    case 'reagents': {
      const result: ShipmentItem[] = [];
      const types = [
        'Aberration',
        'Fiend',
        'Celestial',
        'Giant',
        'Construct',
        'Monstrosity',
        'Dragon',
        'Ooze',
        'Elemental',
        'Plant',
        'Fey',
        'Undead',
      ];
      // Use helper to get base rarities
      const rarities = Array(4)
        .fill(0)
        .map(() => typeFromInclusiveRanges(randomInt(1, 20), REAGENT_RARITY_RANGES, 'Common'));
      for (const rarity of rarities) {
        const type = types[randomInt(0, types.length - 1)];
        const reagent = await getRandomReagentByRarityAndType(rarity, type);
        if (reagent)
          addOrIncrementItem(result, reagent.name, randomInt(reagent.price_min, reagent.price_max), 'reagent');
      }
      return result;
    }
    case 'otherworld': {
      const result: ShipmentItem[] = [];
      // Use helper to get base rarities
      let rarities = Array(3).fill('Uncommon');
      const rarityOrder = ['Uncommon', 'Rare', 'Very Rare'];
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 6);
        return upgradeByCategoryOrder(base, roll, { 5: 1, 6: 2 }, rarityOrder);
      });
      for (const rarity of rarities) {
        const metal = await getRandomMetalByRarityExcludingPlanes(rarity, 'Material');
        if (metal) addOrIncrementItem(result, metal.name, randomInt(metal.price_min, metal.price_max), 'metal');
      }
      // Reagents Generation. 
      const types = [
        'Aberration',
        'Fiend',
        'Celestial',
        'Giant',
        'Construct',
        'Monstrosity',
        'Dragon',
        'Ooze',
        'Elemental',
        'Plant',
        'Fey',
        'Undead',
      ];
      const reagents = Array(3)
        .fill(0)
        .map(() => typeFromInclusiveRanges(randomInt(1, 20), REAGENT_RARITY_RANGES, 'Common'));
      for (const rarity of reagents) {
        const type = types[randomInt(0, types.length - 1)];
        const reagent = await getRandomReagentByRarityAndType(rarity, type);
        if (reagent)
          addOrIncrementItem(result, reagent.name, randomInt(reagent.price_min, reagent.price_max), 'reagent');
      }
      return result;
    }
    case 'smuggle': {
      const result: ShipmentItem[] = [];
      // Use helper to get base rarities
      let rarities = Array(4).fill('Uncommon');
      const rarityOrder = ['Uncommon', 'Rare', 'Very Rare'];
      rarities = rarities.map((base) => {
        const roll = randomInt(1, 6);
        return upgradeByCategoryOrder(base, roll, { 5: 1, 6: 2 }, rarityOrder);
      });
      for (let i = 0; i < 4; i++) {
        const rarity = rarities[i];
        const typeRoll = randomInt(1, 8);
        if (typeRoll === 1) {
          const metal = await getRandomMetalByRarity(rarity);
          if (metal) addOrIncrementItem(result, metal.name, randomInt(metal.price_min, metal.price_max), 'metal');
        } else if (typeRoll === 2) {
          const combo = await generateRandomWeaponWithMetalByRarity(rarity);
          if (combo) {
            const { weapon, metal } = combo;
            const metalPrice = randomInt(metal.price_min, metal.price_max);
            const price = calculateMetalItemPrice(weapon, metalPrice);
            const itemName = `${metal.name} ${weapon.name}`;
            addOrIncrementItem(result, itemName, price, 'weapon');
          }
        } else if (typeRoll === 3) {
          const meal = await getRandomMealByRarity(rarity);
          if (meal) addOrIncrementItem(result, meal.name, randomInt(meal.price_min, meal.price_max), 'meal');
        } else if (typeRoll === 4) {
          const potion = await getRandomPotionByRarity(rarity);
          if (potion) addOrIncrementItem(result, potion.name, randomInt(potion.price_min, potion.price_max), 'potion');
        } else if (typeRoll === 5) {
          const poison = await getRandomPoisonByRarity(rarity);
          if (poison) addOrIncrementItem(result, poison.name, randomInt(poison.price_min, poison.price_max), 'poison');
        } else if (typeRoll === 6) {
          const reagent = await getRandomReagentByRarity(rarity);
          if (reagent)
            addOrIncrementItem(result, reagent.name, randomInt(reagent.price_min, reagent.price_max), 'reagent');
        } else if (typeRoll === 7) {
          const seed = await getRandomSeedByRarity(rarity);
          if (seed) addOrIncrementItem(result, seed.name, randomInt(seed.price_min, seed.price_max), 'seed');
        } else if (typeRoll === 8) {
          const tableOrder = ['A', 'B', 'C'];
          const rarityRoll = randomInt(1, 6);
          const table = upgradeByCategoryOrder('A', rarityRoll, { 5: 1, 6: 2 }, tableOrder);
          const item = await getRandomMagicItemByTable(table);
          if (item) addOrIncrementItem(result, item.name, randomInt(item.price_min, item.price_max), 'magic item');
        }
      }
      return result;
    }
    default:
      return [];
  }
}

export async function boatInTownEmbedBuilder(boat: Boat) {
  let desc = `⏰ **Weeks Left:** ${boat.weeksLeft}\n\n`;

  if (boat.jobsAffected && Array.isArray(boat.jobsAffected) && boat.jobsAffected.length > 0) {
    desc += `💰 **${boat.jobsAffected.join(', ')}** have their gp wage die amount +1.\n\n`;
  } else {
    desc += `💰 **No Jobs Bonuses from ${boat.boatName}**\n\n`;
  }
  if (boat.isTier2 && boat.tier2Ability) desc += `⭐ ${boat.tier2Ability}\n`;

  let fields: { name: string; value: string }[] = [];
  if (boat.tableToGenerate && boat.tableToGenerate !== 'NA') {
    desc += `### ${boatTableDescriptions[boat.tableToGenerate]}:\n\n`;
    const shipments = await Shipment.findAll({ where: { boatId: boat.id } });
    fields = shipments.map((s) => ({
      name: `${s.itemName} (${s.type})`,
      value: `💵 Price: ${s.price} gp\n📦 Remaining Stock: ${s.quantity}`,
      inline: true,
    }));
    if (fields.length === 0) {
      fields.push({ name: '❌ Sold Out', value: '🔄 Check back next time.' });
    }
  }

  // If there are more than 25 fields, split them into multiple embeds
  if (fields.length > 25) {
    const embeds: EmbedBuilder[] = [];
    const chunks = [];

    // Split fields into chunks of 25
    for (let i = 0; i < fields.length; i += 25) {
      chunks.push(fields.slice(i, i + 25));
    }

    // Create embeds for each chunk
    chunks.forEach((chunk, index) => {
      const embed = new EmbedBuilder().setColor(0x2e86c1).setFields(chunk);

      if (index === 0) {
        // First embed gets the title and description
        embed.setTitle(`⛵ ${boat.boatName}`).setDescription(desc);
      } else {
        // Subsequent embeds get continuation title
        embed.setTitle(`⛵ ${boat.boatName} (continued ${index + 1})`);
      }

      embeds.push(embed);
    });

    return embeds;
  }

  // If 25 or fewer fields, return single embed as before
  return new EmbedBuilder().setTitle(`⛵ ${boat.boatName}`).setDescription(desc).setColor(0x2e86c1).setFields(fields);
}

export const boatTableDescriptions: { [key: string]: string } = {
  metals: 'Metal Trading',
  weaponry: 'Weapons & Armor',
  pets: 'Exotic Creatures',
  meals: 'Fine Cuisine',
  poisonsPotions: 'Potions & Poisons',
  magicItems: 'Magic Items',
  plants: 'Seeds & Plants',
  reagents: 'Magical Reagents',
  otherworld: 'Otherworldly Materials',
  smuggle: 'Contraband Goods',
};

export async function boatAtSeaEmbedBuilder(boat: Boat) {
  let desc = `**Weeks Left:** ${boat.weeksLeft}\n`;

  if (boat.jobsAffected && Array.isArray(boat.jobsAffected) && boat.jobsAffected.length > 0) {
    desc += `${boat.jobsAffected.join(', ')} have their gp wage die amount +1.\n\n`;
  }

  if (boat.isTier2 && boat.tier2Ability) desc += `**Tier 2 Ability:** ${boat.tier2Ability}\n\n`;
  desc += `*Shipment Type:* ${boat.tableToGenerate ? boatTableDescriptions[boat.tableToGenerate] : 'None'}`;
  return new EmbedBuilder().setTitle(boat.boatName).setDescription(desc).setColor(0x2e86c1);
}

/**
 * Create a comprehensive boat status embed description
 */
export async function createBoatStatusDescription(boat: Boat): Promise<string> {
  let description = formatBoatInfo(boat);

  // Add shipment type description
  const tableDesc = boatTableDescriptions[boat.tableToGenerate] || 'Unknown';
  description += `**Shipment Type:** ${tableDesc}\n\n`;

  // Add actual shipment info if in town
  if (boat.isInTown && boat.tableToGenerate && boat.tableToGenerate !== 'NA') {
    const shipmentInfo = await formatShipmentInfo(boat.id);
    description += shipmentInfo;
  } else if (!boat.isInTown) {
    description += '*Boat is at sea - no shipments available*';
  } else {
    description += '*No shipments generated*';
  }

  return description;
}

/**
 * Calculate price for a metal-based item (weapons, armor)
 */
export function calculateMetalItemPrice(item: { plates: number; price: number }, metalPrice: number): number {
  return Math.round((metalPrice * item.plates + item.price) * 1.33);
}

/**
 * Format boat information for consistent display across commands
 */
export function formatBoatInfo(boat: Boat): string {
  let info = `**${formatNames(boat.boatName)}**\n`;

  // Basic status
  info += `**Status:** ${boat.isRunning ? 'Running' : 'Stopped'}\n`;
  info += `**Location:** ${boat.isInTown ? 'In Town' : 'At Sea'}\n`;
  info += `**Weeks Left:** ${boat.weeksLeft}\n`;

  // Destination info
  if (boat.city && boat.country) {
    info += `**Destination:** ${formatNames(boat.city)}, ${formatNames(boat.country)}\n`;
  }

  // Timing info
  info += `**Travel Time:** ${boat.waitTime} weeks\n`;
  info += `**Time in Town:** ${boat.timeInTown} weeks\n`;

  // Job benefits
  if (boat.jobsAffected && Array.isArray(boat.jobsAffected) && boat.jobsAffected.length > 0) {
    const jobNames = boat.jobsAffected.map((job) => formatNames(job)).join(', ');
    info += `**Job Benefits:** ${jobNames} get +1 gp wage die\n`;
  }

  // Tier 2 info
  if (boat.isTier2) {
    info += `**Tier 2 Boat:** Yes\n`;
    if (boat.tier2Ability) {
      info += `**Tier 2 Ability:** ${boat.tier2Ability}\n`;
    }
  }

  return info;
}

/**
 * Format shipment information for display
 */
export async function formatShipmentInfo(boatId: number): Promise<string> {
  const shipments = await Shipment.findAll({ where: { boatId } });

  if (shipments.length === 0) {
    return 'No active shipments';
  }

  const shipmentList = shipments.map((s) => `• ${formatNames(s.itemName)} (x${s.quantity}) — ${s.price} gp`).join('\n');

  return `**Active Shipments:**\n${shipmentList}`;
}

/**
 * Update a boat's Discord embed with current information
 */
export async function updateBoatEmbed(boatName: string): Promise<boolean> {
  const { client } = await import('~/index');

  if (!client.isReady()) {
    console.warn('Discord client not ready for embed update');
    return false;
  }

  const boat = await Boat.findOne({ where: { boatName } });
  if (!boat || !boat.messageId) {
    return false;
  }

  const CHANNEL_ID = process.env.BOT_CHANNEL_ID;
  if (!CHANNEL_ID) {
    console.error('BOT_CHANNEL_ID is not defined');
    return false;
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.warn('Target channel is not a text channel');
      return false;
    }

    // Fetch the message
    const message = await channel.messages.fetch(boat.messageId);
    if (!message) {
      console.warn(`Message ${boat.messageId} not found for boat ${boatName}`);
      // Clear the messageId since the message no longer exists
      boat.messageId = null;
      await boat.save();
      return false;
    }

    // Create updated embed
    const { EmbedBuilder } = await import('discord.js');
    const boatInfo = formatBoatInfo(boat);
    const shipmentInfo = await formatShipmentInfo(boat.id);
    const tableDescription = boatTableDescriptions[boat.tableToGenerate] || 'Unknown';

    let desc = boatInfo;
    if (tableDescription) {
      desc += `\n**Table:** ${tableDescription}`;
    }
    if (shipmentInfo) {
      desc += `\n\n${shipmentInfo}`;
    }

    const updatedEmbed = new EmbedBuilder().setTitle(boat.boatName).setDescription(desc).setColor(0x2e86c1);

    // Update the message
    await message.edit({ embeds: [updatedEmbed] });
    console.log(`Updated embed for boat: ${boatName}`);
    return true;
  } catch (error) {
    console.error(`Failed to update boat embed for ${boatName}:`, error);
    // If the message is not found or can't be edited, clear the messageId
    if (error instanceof Error && error.message.includes('Unknown Message')) {
      boat.messageId = null;
      await boat.save();
    }
    return false;
  }
}
