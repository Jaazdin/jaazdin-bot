import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { CommandData, Roles } from '~/types';
import { executeWeeklyTasks } from '~/weeklies/weekly';

const commandData: CommandData = {
  name: 'triggerweeklies',
  description: 'Triggers the weekly tasks',
  category: 'utility',
  requiredRole: Roles.GM,
};

async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const result = await executeWeeklyTasks();
    if (result === 2) {
      await interaction.reply({
        content: `Weekly tasks are currently paused. Cannot trigger until unpaused.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    } else if (result === 1) {
      await interaction.reply({
        content: `Failed to trigger weekly tasks. No tasks found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      content: `Weekly tasks have been triggered.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('Error triggering weekly tasks:', error);
    await interaction.reply({
      content: `An error occurred while triggering weekly tasks.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

export { commandData, execute };
