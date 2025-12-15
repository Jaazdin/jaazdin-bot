import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'restart',
  description: 'Restarts the bot process',
  category: 'utility',
  requiredRole: [Roles.BOT_DEV, Roles.GM],
};

async function execute(interaction: ChatInputCommandInteraction) {
  console.log('Restart command invoked by', interaction.user.tag);
  await interaction.reply({
    content: 'Restarting...',
    flags: MessageFlags.Ephemeral,
  });
  process.exit(0);
}

const help: CommandData = {
  name: 'restart',
  description: 'Restarts the bot process',
  requiredRole: Roles.BOT_DEV,
  category: 'utility',
};

export { commandData, execute, help };
