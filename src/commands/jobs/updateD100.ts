import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { db } from '~/db/db';
import { Job, JobTier } from '~/db/models/Job';
import { formatNames, jobNameAutocomplete } from '~/helpers';
import { CommandData, Roles } from '~/types';

interface JobTierData {
  bonus: string;
  roll: { min: number; max: number };
}

const commandData: CommandData = {
  name: 'updated100',
  description: 'Updates job d100 tables in the database from the d100 table files',
  category: 'jobs',
  requiredRole: [Roles.GM, Roles.BOT_DEV],
  options: [
    {
      name: 'job_name',
      type: 'string',
      description: 'The job to update. Leave blank to update every job',
      required: false,
      autocomplete: true,
    },
  ],
};

// Replaces each existing job's tiers with the current contents of its d100 table file.
// Jobs whose file has no matching row in the database are reported as missing (use /addjob for those).
async function updateTiers(job?: string) {
  const d100TablesDir = `${import.meta.dir}/../../d100tables`;
  const d100Jobs = await Array.fromAsync(new Bun.Glob('*.json').scan(d100TablesDir));
  const updated: string[] = [];
  const missing: string[] = [];

  for (const file of d100Jobs) {
    let jobName = file.split('.')[0].toLowerCase();
    jobName = jobName.replace('-', ' ');
    if (job && jobName !== job.toLowerCase()) continue;

    const dbJob = await Job.findOne({ where: { name: jobName } });
    if (!dbJob) {
      missing.push(jobName);
      continue;
    }

    // Read the file directly rather than import() so edits are picked up without a restart
    const jobJson: JobTierData[] = await Bun.file(`${d100TablesDir}/${file}`).json();
    const jobId = dbJob.getDataValue('id');
    await db.transaction(async (transaction) => {
      await JobTier.destroy({ where: { job_id: jobId }, transaction });
      await JobTier.bulkCreate(
        jobJson.map((tier) => ({
          job_id: jobId,
          bonus: tier.bonus,
          roll_min: tier.roll.min,
          roll_max: tier.roll.max,
        })),
        { transaction }
      );
    });
    updated.push(jobName);
  }

  return { updated, missing };
}

async function execute(interaction: ChatInputCommandInteraction) {
  const jobName = interaction.options.getString('job_name');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { updated, missing } = await updateTiers(jobName ?? undefined);

    if (jobName && updated.length === 0) {
      await interaction.editReply(
        missing.length > 0
          ? `Job "${formatNames(jobName)}" is not in the database. Use /addjob to add it.`
          : `No d100 table file found for "${formatNames(jobName)}".`
      );
      return;
    }

    let content =
      updated.length > 0 ? `Updated d100 table for: ${updated.map(formatNames).join(', ')}` : 'No jobs were updated.';
    if (missing.length > 0) {
      content += `\n\nNot in the database (use /addjob): ${missing.map(formatNames).join(', ')}`;
    }
    await interaction.editReply(content);
  } catch (error) {
    console.error('Error updating d100 tables:', error);
    await interaction.editReply(
      `Failed to update d100 tables: ${error instanceof Error ? error.message : 'Unknown Error'}`
    );
  }
}

async function autocomplete(interaction: AutocompleteInteraction) {
  await jobNameAutocomplete(interaction);
}

export { execute, autocomplete, commandData };
