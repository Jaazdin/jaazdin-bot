import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Metal } from '~/db/models/Metal';
import { Op } from 'sequelize';
import { createItemEmbed, randomInt, rarityChoices } from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'generatemetal',
  description: 'Generate a random metal by rarity',
  category: 'items',
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the metal',
      required: true,
      choices: rarityChoices,
    },
  ],
};

async function getRandomMetalByRarity(rarity: string): Promise<Metal | null> {
  const metals = await Metal.findAll({ where: { rarity } });
  if (!metals || metals.length === 0) return null;
  return metals[Math.floor(Math.random() * metals.length)];
}

async function execute(interaction: ChatInputCommandInteraction) {
  const rarity = interaction.options.getString('rarity', true);

  const metal = await getRandomMetalByRarity(rarity);
  if (!metal) {
    await interaction.reply({
      content: `No metals found for rarity: ${rarity}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const price = randomInt(metal.price_min, metal.price_max);

  const embed = createItemEmbed(
    `Random Metal (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
    metal.name,
    [{ name: 'Price', value: `${price} gp` }],
    0xb2bec3
  );

  await interaction.reply({ embeds: [embed] });
}

// Utility function: get a random metal by rarity, excluding certain planes
async function getRandomMetalByRarityExcludingPlanes(rarity: string, excludedPlane: string) {
  // Assumes Metal model has a 'plane' property
  const validMetals = await Metal.findAll({
    where: {
      rarity,
      plane: { [Op.ne]: excludedPlane },
    },
  });
  if (validMetals.length === 0) return null;
  return validMetals[Math.floor(Math.random() * validMetals.length)];
}

export { execute, commandData, getRandomMetalByRarity, getRandomMetalByRarityExcludingPlanes };
