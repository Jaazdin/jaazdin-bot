import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Meal } from '~/db/models/Meal';
import { createItemEmbed, randomInt, rarityChoices } from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'generatefood',
  description: 'Generate a random meal by rarity',
  category: 'items',
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the meal',
      required: true,
      choices: rarityChoices,
    },
  ],
};

async function getRandomMealByRarity(rarity: string): Promise<Meal | null> {
  const meals = await Meal.findAll({ where: { rarity } });
  if (!meals || meals.length === 0) return null;
  return meals[Math.floor(Math.random() * meals.length)];
}

async function execute(interaction: ChatInputCommandInteraction) {
  const rarity = interaction.options.getString('rarity', true);

  const meal = await getRandomMealByRarity(rarity);
  if (!meal) {
    await interaction.reply({
      content: `No meals found for rarity: ${rarity}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const price = randomInt(meal.price_min, meal.price_max);

  const embed = createItemEmbed(
    `Random Meal (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
    meal.name,
    [{ name: 'Price', value: `${price} gp` }],
    0x27ae60
  );

  await interaction.reply({ embeds: [embed] });
}

export { execute, commandData, getRandomMealByRarity };
