import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { LastWeeklyRunTime } from '~/db/models/LastWeeklyRunTime';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'pauseweekly',
  description: 'Pauses weekly tasks',
  category: 'utility',
  requiredRole: Roles.GM,
};

async function execute(interaction: ChatInputCommandInteraction) {
  const lastRun = await LastWeeklyRunTime.findOne();
  if (!lastRun) {
    await interaction.reply({ content: 'No weekly tasks have been scheduled yet.', flags: MessageFlags.Ephemeral });
    throw new Error('LastWeeklyRunTime record not found.');
  }
  if (lastRun.dataValues.paused) {
    await interaction.reply({
      content: 'Weekly tasks are already paused.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await LastWeeklyRunTime.update({ paused: true }, { where: { id: lastRun.dataValues.id } });
  await interaction.reply({
    content: 'Weekly tasks have been paused.',
  });
}

export { commandData, execute };
