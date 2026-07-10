import { EmbedBuilder, Colors } from 'discord.js';
import { Announcement } from '~/db/models/Announcement';

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
