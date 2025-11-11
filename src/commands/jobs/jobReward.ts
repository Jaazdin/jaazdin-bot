import { ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Op } from 'sequelize';
import { Boat } from '~/db/models/Boat';
import { Job, JobTier } from '~/db/models/Job';
import { formatNames, jobNameAutocomplete, replyWithUserMention } from '~/helpers';
import { CommandData } from '~/types';

// Helper function to convert job name from database format to boat format
function convertJobNameForBoats(jobName: string): string {
  // Convert from database format (lowercase) to boat format (title case)
  return jobName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const commandData: CommandData = {
  name: 'jobreward',
  description: 'Figure out what job reward you received',
  category: 'jobs',
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'The name of the job you are working',
      required: true,
      autocomplete: true,
    },
    {
      name: 'tier',
      type: 'integer',
      description: 'Enter the current tier you are at',
      required: true,
      minValue: 3,
    },
    {
      name: 'roll',
      type: 'integer',
      description: 'Enter the roll on the die (not including bonuses)',
      required: true,
      minValue: 1,
      maxValue: 100,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const jobName = interaction.options.getString('name');
  const tier = interaction.options.getInteger('tier');
  const roll = interaction.options.getInteger('roll');

  if (!jobName || !tier || !roll) {
    await interaction.reply('Please provide all required fields');
    return;
  }

  const jobData = await Job.findOne({ where: { name: jobName.toLowerCase() } });

  if (!jobData) {
    await interaction.reply('Job not found');
    return;
  }

  let modifiedRoll = tier > 3 ? roll + (Math.min(tier, 7) - 3) * 10 : roll;

  // Convert job name to match the format used in boat jobsAffected (capitalize words)
  const capitalizedJobName = convertJobNameForBoats(jobName);

  // Use SQLite's json_each to check if the job matches any element in jobsAffected array
  const effectiveBoats = await Boat.findAll({
    where: {
      isInTown: true,
      isRunning: true,
      jobsAffected: { [Op.contains]: [capitalizedJobName] },
    },
  });
  for (const boat of effectiveBoats) {
    modifiedRoll += boat.isTier2 ? 15 : 10;
  }

  const rolledTier = await JobTier.findOne({
    where: {
      job_id: jobData.getDataValue('id'),
      roll_min: { [Op.lte]: modifiedRoll },
      roll_max: { [Op.gte]: modifiedRoll },
    },
  });

  if (!rolledTier) {
    await interaction.reply('Invalid roll for this job');
    return;
  }

  // string of all the boats that affected the roll
  const boatNames = effectiveBoats.map((boat) => boat.boatName).join(', ');

  const title = `${formatNames(jobData.getDataValue('name'))} Tier ${tier}, Roll: ${roll}, Final Roll: ${modifiedRoll}`;
  const message = `${rolledTier.getDataValue('bonus')} ${boatNames ? `\n\n**Boats affecting the roll:**\n${boatNames}` : ''}`;

  // Generate a random color for the embed
  const randomColor = Math.floor(Math.random() * 0xffffff);
  await replyWithUserMention(interaction, [
    new EmbedBuilder().setTitle(title).setDescription(message).setColor(randomColor),
  ]);
}

async function autocomplete(interaction: AutocompleteInteraction) {
  await jobNameAutocomplete(interaction);
}

export { execute, commandData, autocomplete };
