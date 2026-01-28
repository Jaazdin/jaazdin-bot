import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Pet } from '~/db/models/Pet';
import { Op } from 'sequelize';
import { createItemEmbed, creatureTypeChoices, randomInt, rarityChoices } from '~/helpers';
import { CommandData, Roles } from '~/types';

// Rarity boundaries by CR
const RARITY_BOUNDS = [
  { name: 'Common', min: 0, max: 1 },
  { name: 'Uncommon', min: 2, max: 5 },
  { name: 'Rare', min: 6, max: 8 },
  { name: 'Very Rare', min: 9, max: 11 },
  { name: 'Legendary', min: 12, max: 13 },
];

const commandData: CommandData = {
  name: 'generatepet',
  description: 'Generate a random pet by rarity and creature type',
  category: 'items',
  requiredRole: [Roles.GM, Roles.DM],
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the pet',
      required: true,
      choices: rarityChoices,
    },
    {
      name: 'creaturetype',
      type: 'string',
      description: 'Creature type of the pet',
      required: true,
      choices: creatureTypeChoices,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const rarity = interaction.options.getString('rarity', true);
  const creatureType = interaction.options.getString('creaturetype', true);

  const pet = await getRandomPetByRarityAndType(rarity, creatureType);
  if (!pet) {
    await interaction.reply({
      content: `No pets found for rarity "${rarity}" and creature type "${creatureType}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const price = randomInt(pet.price_min, pet.price_max);

  const embed = createItemEmbed(
    `Random Pet (${rarity}, ${creatureType.charAt(0).toUpperCase() + creatureType.slice(1)})`,
    pet.name,
    [
      { name: 'CR', value: pet.cr.toString() },
      { name: 'Creature Type', value: pet.type },
      { name: 'Price', value: `${price} gp` },
    ],
    0x3498db
  );

  await interaction.reply({ embeds: [embed] });
}

// Utility function for use in other scripts
async function getRandomPetByRarityAndType(rarity: string, creatureType: string) {
  const bounds = RARITY_BOUNDS.find((r) => r.name.toLowerCase() === rarity.toLowerCase());
  if (!bounds) return null;

  const validPets = await Pet.findAll({
    where: {
      type: creatureType,
      cr: { [Op.gte]: bounds.min, [Op.lte]: bounds.max },
    },
  });

  if (validPets.length === 0) return null;
  return validPets[Math.floor(Math.random() * validPets.length)];
}

export { execute, commandData, getRandomPetByRarityAndType };
