import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { checkUserRole } from '~/helpers';
import { CommandData, Roles } from '~/types';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const commandData: CommandData = {
  name: 'resetdb',
  description: 'Resets the database',
  category: 'utility',
  options: [
    {
      name: 'drop',
      description: 'Drop tables if they exist',
      type: 'boolean',
      required: true,
    },
    {
      name: 'seed',
      description: 'Seed the database with default data',
      type: 'boolean',
      required: true,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const hasRole = checkUserRole(interaction, Roles.BOT_DEV);
  if (!hasRole) {
    await interaction.reply('You do not have permission to use this command');
    return;
  }

  const dropTables = interaction.options.getBoolean('drop');
  const seedTables = interaction.options.getBoolean('seed');

  const modelsPath = path.join(__dirname, '../../db', 'models');

  const modelFiles = (await readdir(modelsPath)).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of modelFiles) {
    const filePath = path.join(modelsPath, file);
    const fileUrl = new URL(`file://${filePath}`).href;
    const model = await import(fileUrl);
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
    const keys = Object.keys(model).filter((key) => key !== 'seed');
    for (const key of keys) {
      if (dropTables && model[key].sync) {
        await model[key].sync({ force: dropTables ?? false });
      }
    }

    if (seedTables) {
      try {
        if (model.seed) {
          await model.seed();
        }
      } catch (error) {
        console.error(`Error seeding ${file}:`, error);
      }
    }
  }
  await interaction.editReply('DB Reset Complete');
}

export { commandData, execute };
