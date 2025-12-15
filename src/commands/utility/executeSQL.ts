import { db } from '~/db/db';
import { ChatInputCommandInteraction } from 'discord.js';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'sql',
  description: 'Execute a SQL query on the database',
  category: 'utility',
  requiredRole: Roles.BOT_DEV,
  options: [
    {
      name: 'query',
      type: 'string',
      description: 'The SQL query to execute',
      required: true,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);

  try {
    const [results] = await db.query(query);
    // const [results, metadata] = await db.query("SELECT * from Ingredient");
    console.log('Query results:', results);
    await interaction.reply('Query executed successfully: ' + JSON.stringify(results));
  } catch (e) {
    console.error('Error executing query:', e);
    await interaction.reply('Error executing query');
  }
}

export { execute, commandData };

export default {
  execute,
};
