import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Poison } from '~/db/models/Poison';
import { createItemEmbed, randomInt, rarityChoices } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'generatepoison',
  description: 'Generate a random poison by rarity',
  category: 'items',
  requiredRole: [Roles.GM, Roles.DM],
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the poison',
      required: true,
      choices: rarityChoices,
    },
  ],
};

async function getRandomPoisonByRarity(rarity: string): Promise<Poison | null> {
  const poisons = await Poison.findAll({ where: { rarity } });
  if (!poisons || poisons.length === 0) return null;
  return poisons[Math.floor(Math.random() * poisons.length)];
}

async function execute(interaction: ChatInputCommandInteraction) {

  const rarity = interaction.options.getString('rarity', true);

  // const poison = await getRandomItemByRarity<Poison>('~/db/models/Poison', rarity);
  const poison = await getRandomPoisonByRarity(rarity);
  if (!poison) {
    await interaction.reply({
      content: `No poisons found for rarity: ${rarity}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const price = randomInt(poison.price_min, poison.price_max);

  const embed = createItemEmbed(
    `Random Poison (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
    poison.name,
    [{ name: 'Price', value: `${price} gp` }],
    0x8e44ad
  );

  await interaction.reply({ embeds: [embed] });
}

export { execute, commandData, getRandomPoisonByRarity };
