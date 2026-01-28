import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { Job, seed } from '~/db/models/Job';
import { formatNames } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'addjob',
  description: 'Adds a new job to the database',
  category: 'jobs',
  requiredRole: [Roles.GM, Roles.BOT_DEV], // Optional, remove if not needed. Can also be an array of Roles
  options: [
    // Define command options here. If none, remove options property.
    {
      name: 'job_name',
      type: 'string',
      description: 'The name of the job to add',
      required: true,
      autocomplete: true,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  // Command execution logic here
  const jobName = interaction.options.getString('job_name', true);
  await seed(jobName);
  await interaction.reply({ content: `Job "${jobName}" has been added to the database.`, ephemeral: true });
}

// Remove if not needed
async function autocomplete(interaction: AutocompleteInteraction) {
  // Autocomplete logic here
  const exclude = (await Job.findAll()).map((job) => job.getDataValue('name'));
  //   await jobNameAutocomplete(interaction, { include: [], exclude });
  const d100TablesDir = `${import.meta.dir}/../../d100tables`;
  const d100JobFiles = await Array.fromAsync(new Bun.Glob('*.json').scan(d100TablesDir));
  const d100Jobs = d100JobFiles.map((file) => {
    return file.replace('.json', '').toLocaleLowerCase();
  });
  console.log('D100 Jobs for autocomplete:', d100Jobs);
  console.log('Exclude list for autocomplete:', exclude);
  await interaction.respond(
    d100Jobs
      .filter(
        (job) => job.toLowerCase().startsWith(interaction.options.getFocused().toLowerCase()) && !exclude.includes(job)
      )
      .slice(0, 25)
      .map((job) => ({
        name: formatNames(job),
        value: job,
      }))
  );
}

// Other exports can be exported here rather then inline
export { execute, autocomplete, commandData };
