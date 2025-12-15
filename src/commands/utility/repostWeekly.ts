import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { checkUserRole } from '~/helpers';
import { CommandData, Roles } from '~/types';
import { executeWeeklyTasks } from '~/weeklies/weekly';

const commandData: CommandData = {
  name: 'repostweekly',
  description: 'Repost the weekly downtime message',
  category: 'utility',
};

async function execute(interaction: ChatInputCommandInteraction) {
  if (!checkUserRole(interaction, [Roles.GM, Roles.BOT_DEV])) {
    await interaction.reply({
      content: `You do not have permission to use this command.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  try {
    const result = await executeWeeklyTasks(true);
    if (result === 2) {
      await interaction.reply({
        content: `Weekly tasks are currently paused. Cannot repost until unpaused.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    } else if (result === 1) {
      await interaction.reply({
        content: `Failed to repost weekly tasks. No tasks found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      content: `Weekly tasks have been reposted.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('Error reposting weekly tasks:', error);
    await interaction.reply({
      content: `An error occurred while reposting weekly tasks.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

export { commandData, execute };
