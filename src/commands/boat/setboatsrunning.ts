import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Boat } from '~/db/models/Boat';
import { updateBoatEmbed } from '~/helpers';
import { CommandData, Roles } from '~/types';
import { Op } from 'sequelize';

const commandData: CommandData = {
  name: 'setboatsrunning',
  description: 'Set all boats to running or not, with optional exceptions',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    {
      name: 'running',
      type: 'boolean',
      description: 'Set boats to running (true) or not running (false)',
      required: true,
    },
    {
      name: 'exceptions',
      type: 'string',
      description: 'Comma-separated boat names to leave unchanged (optional)',
    },
  ],
};

//TODO: for boats names use autocomplete to suggest existing boat names

async function execute(interaction: ChatInputCommandInteraction) {
  const running = interaction.options.getBoolean('running', true);
  const exceptionsRaw = interaction.options.getString('exceptions');
  let exceptions: string[] = [];

  if (exceptionsRaw) {
    exceptions = exceptionsRaw
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  }
  const where = exceptions.length > 0 ? { boatName: { [Op.notIn]: exceptions } } : {};

  // Remember which boats actually change so only their posts need updating
  const changedBoats = await Boat.findAll({ where: { ...where, isRunning: { [Op.ne]: running } } });

  // Update all boats except those in exceptions
  const [affected] = await Boat.update({ isRunning: running }, { where });

  await interaction.reply({
    content: `Set ${affected} boat(s) to ${running ? 'running' : 'not running'}${exceptions.length ? ` (except: ${exceptions.join(', ')})` : ''}.`,
    flags: MessageFlags.Ephemeral,
  });

  // One at a time, so boats heading to sea join a single summary instead of each posting one
  for (const boat of changedBoats) {
    await updateBoatEmbed(boat.boatName);
  }
}

export { execute, commandData };
