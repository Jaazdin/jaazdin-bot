import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Seed } from '~/db/models/Seed';
import { createItemEmbed, randomInt, rarityChoices } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'generateseeds',
  description: 'Generate a random seed by rarity',
  category: 'items',
  requiredRole: [Roles.GM, Roles.DM],
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the seed',
      required: true,
      choices: rarityChoices,
    },
  ],
};

async function getRandomSeedByRarity(rarity: string): Promise<Seed | null> {
  const items = await Seed.findAll({
    where: { rarity },
  });
  if (items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex].dataValues;
}

async function execute(interaction: ChatInputCommandInteraction) {

  const rarity = interaction.options.getString('rarity', true);

  const seed = await getRandomSeedByRarity(rarity);
  if (!seed) {
    await interaction.reply({
      content: `No seeds found for rarity: ${rarity}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const price = randomInt(seed.price_min, seed.price_max);

  const embed = createItemEmbed(
    `Random Seed (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
    seed.name,
    [{ name: 'Price', value: `${price} gp` }],
    0x2ecc71
  );

  await interaction.reply({ embeds: [embed] });
}

export { execute, commandData, getRandomSeedByRarity };
