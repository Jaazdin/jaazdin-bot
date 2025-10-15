import { ChatInputCommandInteraction } from 'discord.js';
import { Timer } from '~/db/models/Timer';
import { checkUserRole, formatNames } from '~/helpers';
import { CommandData, Roles, TimerType } from '~/types';
import { TIMER_MAX_LENGTH } from '~/constants';

const NAME_MAX_LENGTH = 100;
const CHAR_MAX_LENGTH = 15;

const commandData: CommandData = {
  name: 'addtimer',
  description: 'will create a new timer',
  category: 'timer',
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'The name of the timer.',
      required: true,
      maxLength: NAME_MAX_LENGTH,
    },
    {
      name: 'weeks',
      type: 'integer',
      description: 'The amount of weeks before the timer ends (max 1 year)',
      required: true,
      minValue: 1,
      maxValue: TIMER_MAX_LENGTH,
    },
    {
      name: 'type',
      type: 'string',
      description: 'The type of the timer.',
      required: true,
      choices: [
        { name: 'Building', value: 'building' },
        { name: 'Plant', value: 'plant' },
        { name: 'Item', value: 'item' },
        { name: 'Other', value: 'other' },
      ],
    },
    {
      name: 'character',
      type: 'string',
      description: 'The character associated with the timer',
      required: true,
      maxLength: CHAR_MAX_LENGTH,
    },
    {
      name: 'repeatable',
      type: 'boolean',
      description: 'Whether the timer is repeatable',
    },
    {
      name: 'player',
      type: 'user',
      description: '(GM ONLY) The discord id of the player, leave blank if yourself',
    },
  ],
};

const ICON_MAP: Record<string, string> = {
  building: '🏗️',
  plant: '🌱',
  item: '📦',
  other: '🔧',
};

async function execute(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name')?.toLowerCase();
  const weeks = interaction.options.getInteger('weeks');
  const type = interaction.options.getString('type')?.toLowerCase();
  const discordId = (interaction.options.getUser('player') || interaction.user).id;
  const char = interaction.options.getString('character')?.toLowerCase();
  const repeatable = interaction.options.getBoolean('repeatable') || false;
  //todo check to see if timer name doesn't already exist.

  if (!name || !weeks || !type || !char) {
    return interaction.reply('Please provide all required fields.');
  }

  if (!Object.values(TimerType).includes(type as TimerType)) {
    return interaction.reply('Invalid timer type provided.');
  }

  if (type == TimerType.complete) {
    return interaction.reply('You cannot create a timer of type "complete".');
  }

  if (!(checkUserRole(interaction, Roles.GM) && interaction.user.id !== discordId)) {
    // If the user is not a GM, they can only set timers for themselves
    if (discordId !== interaction.user.id) {
      return interaction.reply('You can only set timers for yourself unless you are a GM.');
    }
  }

  // Handle character limits
  if (name.length > NAME_MAX_LENGTH) {
    return interaction.reply(`Timer name must be ${NAME_MAX_LENGTH} characters or less.`);
  }
  if (char.length > CHAR_MAX_LENGTH) {
    return interaction.reply(`Character name must be ${CHAR_MAX_LENGTH} characters or less.`);
  }

  await Timer.create({
    name: name,
    type: type as TimerType,
    weeks_remaining: weeks,
    user: discordId,
    character: char,
    repeatable: repeatable,
    repeat_weeks: repeatable ? weeks : undefined,
  });

  await interaction.reply({
    embeds: [
      {
        title: '⏳ Timer Added',
        color: 0x4caf50,
        fields: [
          { name: 'Name', value: formatNames(name), inline: true },
          { name: 'Type', value: `${ICON_MAP[type]} ${formatNames(type)}`, inline: true },
          { name: 'Duration', value: `🕒 ${weeks} week(s)`, inline: true },
          { name: 'Character', value: formatNames(char), inline: true },
          { name: 'Player', value: `<@${discordId}>`, inline: true },
          { name: 'Repeatable', value: repeatable ? 'Yes' : 'No', inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Timer successfully created!' },
      },
    ],
  });
}

export { execute, commandData };
