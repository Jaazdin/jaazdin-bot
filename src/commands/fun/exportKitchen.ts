import { ChatInputCommandInteraction } from 'discord.js';
import { Ingredient } from '~/db/models/Ingredient';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'exportkitchen',
  description: 'Save the kitchen to a JSON file',
  category: 'fun',
  requiredRole: [Roles.GM, Roles.BOT_DEV],
};

async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const ingredients: Ingredient[] = (await Ingredient.findAll()).map((ingredient) => ingredient.toJSON());

    // ingredients.forEach((ingredient) => {
    //     delete ingredient.id;
    //     delete ingredient.updatedAt;
    //     delete ingredient.createdAt;
    // });

    const filePath = resolve('./ingredients.json');
    await writeFile(filePath, JSON.stringify(ingredients, null, 2));

    await interaction.editReply('Kitchen has been exported to ingredients.json');
  } catch (error) {
    console.error('Error in kitchen.ts:', error);
    await interaction.editReply('An error occurred while fetching the kitchen');
  }
}

export { execute, commandData };
