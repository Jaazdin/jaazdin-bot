import { EmbedBuilder, Colors, TextChannel, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { Announcement } from '~/db/models/Announcement';
import { client } from '~/index';

/**
 * Create an embed for an announcement
 * @param announcement An Announcement instance
 */

export function showAnnouncement(announcement: Announcement) {
  // Emojis: 📢 for title, ⏳ for weeks
  const title = `📢 ${announcement.name}`;
  const description = `${announcement.message}
\n${announcement.weeks ? `⏳ **Weeks Remaining:** ${announcement.weeks + 1}` : ''}`;
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(Colors.Orange);
}

const CHANNEL_ID = process.env.BOT_CHANNEL_ID;

export async function postAnnouncements(announcements: Announcement[], interaction?: ChatInputCommandInteraction) {
  // Get all announcements
  const embeds = announcements.map((a) => showAnnouncement(a));

  // Ephemeral messages can only be sent as interaction replies, not as plain channel messages
  if (interaction) {
    try {
      for (let i = 0; i < embeds.length; i += 10) {
        const payload = { embeds: embeds.slice(i, i + 10), flags: [MessageFlags.Ephemeral] as const };
        if (i === 0) {
          await interaction.reply(payload);
        } else {
          await interaction.followUp(payload);
        }
      }
    } catch (error) {
      console.error('Failed to send announcement update:', error);
    }
    return;
  }

  if (!CHANNEL_ID) {
    console.error('Channel is not defined');
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
