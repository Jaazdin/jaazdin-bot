import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { TIMER_MAX_LENGTH } from '~/constants';
import { Timer } from '~/db/models/Timer';
import { checkUserRole, formatNames, parseChangeString } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'gmupdatetimer',
  description: 'Updates the remaining weeks on a timer',
  category: 'timer',
  options: [
    {
      name: 'player',
      type: 'user',
      description: 'The discord user who owns the timer, leave blank if yourself',
      required: true,
    },
    {
      name: 'timer',
      type: 'string',
      description: 'The name of the timer to update.',
      required: true,
      autocomplete: true,
    },
    {
      name: 'change',
      type: 'string',
      description: 'Number of weeks to add, subtract, or set equal to (+x, -x, =x)',
      required: true,
    },
  ],
};

async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);
  const player = (interaction.options.get('player')?.value as string) || interaction.user.id;

  if (focusedOption.name === 'timer') {
    // Find all timers for the selected user
    const timers = await Timer.findAll({
      where: { user: player },
      limit: 25,
    });

    // Filter by what the user is typing
    const value = focusedOption.value?.toLowerCase() || '';
    const choices = timers
      .filter((t) => t.name.toLowerCase().includes(value) && t.id !== undefined)
      .map((t) => {
        let displayName = `${formatNames(t.name)} (${formatNames(t.character)}, ${t.weeks_remaining} weeks left)`;
        if (displayName.length > 100) {
          displayName = displayName.slice(0, 97) + '...';
        }
        return {
          name: displayName,
          value: (t.id as number).toString(),
        };
      });
    await interaction.respond(choices);
  }
}

async function execute(interaction: ChatInputCommandInteraction) {
  const timerIdString = interaction.options.getString('timer');
  const change = interaction.options.getString('change');
  const discordId = (interaction.options.getUser('player') || interaction.user).id;

  if (!timerIdString || change === null) {
    return interaction.reply('Please provide both the timer and the change in weeks.');
  }

  const timerId = parseInt(timerIdString, 10);

  if (isNaN(timerId)) {
    return interaction.reply('Failed to find timer.');
  }

  // Only GMs can update timers for others
  if (!checkUserRole(interaction, Roles.GM)) {
    if (discordId !== interaction.user.id) {
      return interaction.reply('This is a GM command. Use /updatetimer to update your own timers.');
    }
  }

  const timer = await Timer.findOne({
    where: {
      id: timerId,
      user: discordId,
    },
  });

  if (!timer) {
    return interaction.reply(`Failed to find timer.`);
  }

  const newWeeks = await parseChangeString(change, timer.weeks_remaining, 'change', 0, TIMER_MAX_LENGTH, interaction);
  if (newWeeks === null) return;
  timer.weeks_remaining = newWeeks;
  await timer.save();

  await interaction.reply({
    embeds: [
      {
        title: '⏳ Timer Updated',
        color: 0xff9800,
        fields: [
          { name: 'Name', value: formatNames(timer.name), inline: true },
          { name: 'Character', value: formatNames(timer.character), inline: true },
          { name: 'Player', value: `<@${discordId}>`, inline: true },
          { name: 'Weeks Remaining', value: `🕒 ${timer.weeks_remaining} week(s)`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Timer successfully updated!' },
      },
    ],
  });
}

export { execute, commandData, autocomplete };
