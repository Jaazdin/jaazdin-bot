import { Timer } from '~/db/models/Timer';
import { SortedTimers } from '~/types';
import { client } from '..';
import { TextChannel, MessageCreateOptions, EmbedBuilder } from 'discord.js';
import { createTimerEmbed } from '~/commands/timer/showTimer';

async function update() {
  await Timer.destroy({
    where: {
      weeks_remaining: 0,
    },
  });
  const timers: Timer[] = await Timer.findAll({
    order: ['user', 'character', 'weeks_remaining'],
  });
  for (const timer of timers) {
    timer.weeks_remaining -= 1;
    if (timer.weeks_remaining <= 0 && timer.repeatable) {
      Timer.create({
        name: timer.name,
        type: timer.type,
        user: timer.user,
        character: timer.character,
        repeatable: timer.repeatable,
        weeks_remaining: timer.repeat_weeks as number,
        repeat_weeks: timer.repeat_weeks as number,
      });
    }
    await timer.save();
  }
}

async function postMessages(messages: EmbedBuilder[][], usersWithCompletedTimers: Set<string>) {
  const CHANNEL_ID = process.env.BOT_CHANNEL_ID;
  if (!CHANNEL_ID) {
    throw new Error('Channel ID not set in environment variables');
  }

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) {
    throw new Error('Channel not found');
  }
  if (!(channel instanceof TextChannel)) {
    throw new Error('Channel is not a text channel');
  }
  let messageContent = '';
  if (usersWithCompletedTimers.size > 0 && process.env.NODE_ENV === 'production') {
    const userMentions = Array.from(usersWithCompletedTimers)
      .map((userId) => `<@${userId}>`)
      .join(' ');
    messageContent = `🎉 The following players have completed timers: ${userMentions}`;
  } else if (usersWithCompletedTimers.size > 0) {
    messageContent = `🎉 The following players have completed timers: ${Array.from(usersWithCompletedTimers).join(
      ', '
    )} (No pings in development mode)`;
  }

  messages.forEach(async (embeds, messageIndex) => {
    if (embeds.length == 0) {
      return;
    }
    for (let i = 0; i < embeds.length; i += 10) {
      const messageOptions: MessageCreateOptions = {
        embeds: embeds.slice(i, i + 10),
      };

      // Add the ping message to the first batch of embeds
      if (messageIndex === 0 && messageContent) {
        messageOptions.content = messageContent;
      }

      await channel.send(messageOptions);
      messageContent = '';
    }
    // Clear messageContent after the first send to avoid duplicate pings
  });
}

async function post() {
  const timers = await Timer.findAll({
    order: ['user', 'character', 'weeks_remaining'],
  });
  const sortedTimers: SortedTimers = {
    building: {},
    plant: {},
    item: {},
    other: {},
    complete: {},
  };
  for (const timer of timers) {
    if (timer.weeks_remaining <= 0) {
      sortedTimers.complete[timer.user] = sortedTimers.complete[timer.user] || [];
      sortedTimers.complete[timer.user].push(timer.dataValues);
      continue;
    }
    sortedTimers[timer.type][timer.user] = sortedTimers[timer.type][timer.user] || [];
    sortedTimers[timer.type][timer.user].push(timer.dataValues);
  }
  const allEmbedMessages = createTimerEmbed(sortedTimers, true);
  const usersWithCompletedTimers = new Set<string>(); // Track users with completed timers

  // Handle completed timers
  if (sortedTimers.complete && Object.keys(sortedTimers.complete).length > 0) {
    // Add users with completed timers to the set
    for (const userId of Object.keys(sortedTimers.complete)) {
      usersWithCompletedTimers.add(userId);
    }
  }

  // Create ping message for users with completed timers

  // Send message with pings and embeds
  await postMessages(allEmbedMessages, usersWithCompletedTimers);
}

const order = 1;

export { update, post, order };
