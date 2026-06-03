import { EmbedBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Timer } from '~/db/models/Timer';
import { formatNames } from '~/helpers';
import { CommandData, SortedTimers, TimerType, typeColors, typeIcons } from '~/types';

const commandData: CommandData = {
  name: 'showtimers',
  description: 'Display active timers',
  category: 'timer',
  options: [
    {
      name: 'all',
      type: 'boolean',
      description: 'Show all timers or just your own',
    },
  ],
};

function sortTimersByTypeAndUser(timers: Timer[]): SortedTimers {
  const sorted: SortedTimers = {
    plant: {},
    building: {},
    item: {},
    other: {},
    complete: {},
  };

  for (const timer of timers) {
    if (timer.weeks_remaining <= 0) {
      sorted.complete[timer.user] = sorted.complete[timer.user] || [];
      sorted.complete[timer.user].push(timer.dataValues);
    } else {
      sorted[timer.type][timer.user] = sorted[timer.type][timer.user] || [];
      sorted[timer.type][timer.user].push(timer.dataValues);
    }
  }

  return sorted;
}

/**
 * Safely truncate a string to a maximum length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  console.warn(`Truncating string from ${str.length} to ${maxLength} characters.`);
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Calculate the total character count of an embed
 */
function getEmbedCharacterCount(embed: EmbedBuilder): number {
  const data = embed.data;
  let count = 0;

  if (data.title) count += data.title.length;
  if (data.description) count += data.description.length;
  if (data.footer?.text) count += data.footer.text.length;
  if (data.author?.name) count += data.author.name.length;
  if (data.fields) {
    for (const field of data.fields) {
      count += field.name.length + field.value.length;
    }
  }

  return count;
}

/**
 * Chunk an array into smaller arrays of a specified size
 * @param array The array to chunk
 * @param chunkSize The maximum size of each chunk
 * @returns An array of chunked arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Ensure embeds meet Discord's character limit (6000 chars total per message)
 * Maximum 10 embeds per message
 */
function enforceMessageLimits(embeds: EmbedBuilder[]): EmbedBuilder[][] {
  const messages: EmbedBuilder[][] = [];
  let currentMessage: EmbedBuilder[] = [];
  let currentCharCount = 0;

  for (const embed of embeds) {
    const embedCharCount = getEmbedCharacterCount(embed);

    // Check if adding this embed would exceed limits
    const wouldExceedCharLimit = currentCharCount + embedCharCount > 6000;
    const wouldExceedEmbedLimit = currentMessage.length >= 10;

    if (wouldExceedCharLimit || wouldExceedEmbedLimit) {
      // Start a new message
      if (currentMessage.length > 0) {
        messages.push(currentMessage);
      }
      currentMessage = [embed];
      currentCharCount = embedCharCount;
    } else {
      currentMessage.push(embed);
      currentCharCount += embedCharCount;
    }
  }

  // Add the last message if it has embeds
  if (currentMessage.length > 0) {
    messages.push(currentMessage);
  }

  return messages;
}

export function createTimerEmbed(sortedTimers: SortedTimers, showComplete: boolean): EmbedBuilder[][] {
  const allEmbeds: EmbedBuilder[] = [];

  // Handle completed timers
  if (showComplete && sortedTimers.complete && Object.keys(sortedTimers.complete).length > 0) {
    // Group completed timers by type
    const completedTimersByType: {
      [key in TimerType]?: Timer['dataValues'][];
    } = {};

    for (const [userId, timers] of Object.entries(sortedTimers.complete)) {
      for (const timer of timers) {
        if (!completedTimersByType[timer.type]) {
          completedTimersByType[timer.type] = [];
        }
        completedTimersByType[timer.type]!.push({ ...timer, user: userId });
      }
    }

    // Create completed embeds with chunking
    for (const type of ['plant', 'building', 'item', 'other'] as TimerType[]) {
      const timers = completedTimersByType[type];
      if (timers && timers.length > 0) {
        // Split into chunks of 25 fields (Discord's limit)
        const chunks = chunkArray(timers, 25);

        // Create multiple embeds if needed
        chunks.forEach((chunk, index) => {
          const titleText = `${typeIcons[type]} Completed ${formatNames(type)}s${chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''}`;

          const embed = new EmbedBuilder()
            .setTitle(truncateString(titleText, 256))
            .setColor(typeColors[type])
            .setTimestamp()
            .addFields(
              chunk.map((timer) => {
                const characterName = formatNames(timer.character);
                const timerName = formatNames(timer.name);
                const fieldName = `${characterName}'s ${timerName}`;
                const fieldValue = `Player: <@${timer.user}>${timer.repeatable ? ' (Repeating)' : ''}`;

                return {
                  name: truncateString(fieldName, 256),
                  value: truncateString(fieldValue, 1024),
                  inline: true,
                };
              })
            );
          allEmbeds.push(embed);
        });
      }
    }
  }

  // Handle active timers (not complete)
  for (const type of ['plant', 'building', 'item', 'other'] as TimerType[]) {
    const typeTimers = sortedTimers[type];
    if (typeTimers && Object.keys(typeTimers).length > 0) {
      const allTimersForType = [];

      for (const [userId, timers] of Object.entries(typeTimers)) {
        for (const timer of timers) {
          allTimersForType.push({ ...timer, user: userId });
        }
      }

      if (allTimersForType.length > 0) {
        // Split into chunks of 25 fields (Discord's limit)
        const chunks = chunkArray(allTimersForType, 25);

        // Create multiple embeds if needed
        chunks.forEach((chunk, index) => {
          const titleText = `${typeIcons[type]} Active ${formatNames(type)}s${chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''}`;

          const embed = new EmbedBuilder()
            .setTitle(truncateString(titleText, 256))
            .setColor(typeColors[type])
            .setTimestamp()
            .addFields(
              chunk.map((timer) => {
                const characterName = formatNames(timer.character);
                const timerName = formatNames(timer.name);
                const fieldName = `${characterName}'s ${timerName}`;
                const fieldValue = `Player: <@${timer.user}>\nWeeks remaining: ${timer.weeks_remaining}`;

                return {
                  name: truncateString(fieldName, 256),
                  value: truncateString(fieldValue, 1024),
                  inline: true,
                };
              })
            );
          allEmbeds.push(embed);
        });
      }
    }
  }

  // Enforce 6000 character limit and 10 embeds per message
  return enforceMessageLimits(allEmbeds);
}

async function execute(interaction: ChatInputCommandInteraction) {
  const showAll = interaction.options.getBoolean('all') ?? false;
  const userId = interaction.user.id;

  const timers = await Timer.findAll({
    where: showAll ? {} : { user: userId },
  });

  const sortedTimers = sortTimersByTypeAndUser(timers);
  const embedMessages = createTimerEmbed(sortedTimers, false);

  if (embedMessages.length === 0 || embedMessages[0].length === 0) {
    return interaction.reply({
      content: 'No timers found.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Send the first message as a reply
  await interaction.reply({
    embeds: embedMessages[0],
    flags: MessageFlags.Ephemeral,
  });

  // Send additional messages as follow-ups if needed
  for (let i = 1; i < embedMessages.length; i++) {
    await interaction.followUp({
      embeds: embedMessages[i],
      flags: MessageFlags.Ephemeral,
    });
  }
}

export { execute, commandData, sortTimersByTypeAndUser };
