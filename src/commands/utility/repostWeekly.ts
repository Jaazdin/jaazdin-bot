import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { CommandData, Roles } from '~/types';
import { executeWeeklyTasks } from '~/weeklies/weekly';

const commandData: CommandData = {
  name: 'repostweekly',
  description: 'Repost the weekly downtime message',
  category: 'utility',
  requiredRole: [Roles.GM, Roles.BOT_DEV],
};

async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await executeWeeklyTasks(true);
    if (result === 2) {
      await interaction.editReply({
        content: `Weekly tasks are currently paused. Cannot repost until unpaused.`,
      });
      return;
    } else if (result === 1) {
      await interaction.editReply({
        content: `Failed to repost weekly tasks. No tasks found.`,
      });
      return;
    }
    await interaction.editReply({
      content: `Weekly tasks have been reposted.`,
    });
  } catch (error) {
    console.error('Error reposting weekly tasks:', error);
    await interaction.editReply({
      content: `An error occurred while reposting weekly tasks.`,
    });
    return;
  }
}

export { commandData, execute };
