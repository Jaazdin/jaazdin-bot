import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { LastWeeklyRunTime } from '~/db/models/LastWeeklyRunTime';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'unpauseweekly',
  description: 'Pauses weekly tasks',
  category: 'utility',
};

async function execute(interaction: ChatInputCommandInteraction) {
  const lastRun = await LastWeeklyRunTime.findOne();
  if (!lastRun) {
    await interaction.reply({ content: 'No weekly tasks have been scheduled yet.', flags: MessageFlags.Ephemeral });
    throw new Error('LastWeeklyRunTime record not found.');
  }
  if (!lastRun.dataValues.paused) {
    await interaction.reply({
      content: 'Weekly tasks are not paused.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await LastWeeklyRunTime.update({ paused: false }, { where: { id: lastRun.dataValues.id } });
  await interaction.reply({
    content: 'Weekly tasks have been unpaused.',
  });
}

export { commandData, execute };
