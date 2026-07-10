import { showAnnouncement } from '~/helpers';
import { Announcement } from '~/db/models/Announcement';
import { client } from '~/index';
import { TextChannel } from 'discord.js';

const CHANNEL_ID = process.env.BOT_CHANNEL_ID;

async function update() {
  // Find all announcements
  const announcements = await Announcement.findAll();

  for (const announcement of announcements) {
    if (!announcement.weeks) {
      continue; // Skip if weeks is undefined or null
    }
    if (announcement.weeks <= 0) {
      await announcement.destroy();
    } else {
      announcement.weeks -= 1;
      await announcement.save();
    }
  }
}

async function post() {
  if (!CHANNEL_ID) {
    console.error('BOT_CHANNEL_ID is not defined');
    return;
  }

  // Get all announcements
  const announcements = await Announcement.findAll();
  const embeds = announcements.map((a) => showAnnouncement(a));

  if (!client.isReady()) {
    console.warn('Client is not ready yet. Delaying message send.');
    return;
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel instanceof TextChannel) {
      // Discord allows up to 10 embeds per message
      for (let i = 0; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
      }
    } else {
      console.log('Target channel is not a text channel or not found.');
    }
  } catch (error) {
    console.error('Failed to send announcement update:', error);
  }
}

const order = 9999; // announcements should always be last

export { update, post, order };
