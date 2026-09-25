import { ChatInputCommandInteraction } from 'discord.js';
import { Announcement } from '~/db/models/Announcement';
import { postAnnouncements } from '~/helpers/announcementHelpers';
import { CommandData } from '~/types/command';
import { Roles } from '~/types/roles';

const commandData: CommandData = {
  name: 'showannouncements',
  description: 'Show existing announcements',
  category: 'announcement',
  requiredRole: Roles.GM,
};

async function execute(interaction: ChatInputCommandInteraction) {
  const annoucements = await Announcement.findAll();
  if (!annoucements || annoucements.length === 0) {
    interaction.reply({
      content: 'No announcements found.',
      ephemeral: true,
    });
    return;
  }
  postAnnouncements(annoucements, interaction);
}

export { commandData, execute };
