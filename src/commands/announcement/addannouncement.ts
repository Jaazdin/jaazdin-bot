import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Interaction,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { Announcement } from '~/db/models/Announcement';
import { showAnnouncement } from '~/helpers';
import { CommandData, Roles } from '~/types';

const CHANNEL_ID = process.env.BOT_CHANNEL_ID;

const commandData: CommandData = {
  name: 'addannouncement',
  description: 'Make a new announcement',
  category: 'announcement',
  requiredRole: Roles.GM,
  options: [
    { name: 'weeks', type: 'integer', description: 'Weeks remaining (min 1)', required: true, minValue: 1 },
    { name: 'post_now', type: 'boolean', description: 'Post announcement immediately' },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  // Get weeks and post_now from command
  const weeks = interaction.options.getInteger('weeks', true);
  const post_now = interaction.options.getBoolean('post_now') ?? false;

  // Show modal for input
  const modal = new ModalBuilder()
    .setCustomId(`addannouncement-modal|${weeks}|${post_now}`)
    .setTitle('Add Announcement');

  const nameInput = new TextInputBuilder()
    .setCustomId('announcement-name')
    .setLabel('Announcement Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId('announcement-message')
    .setLabel('Announcement Message')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput)
  );

  await interaction.showModal(modal);
}

// Modal submit handler
async function handleModalSubmit(interaction: Interaction) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('addannouncement-modal|')) return;

  const name = interaction.fields.getTextInputValue('announcement-name');
  const message = interaction.fields.getTextInputValue('announcement-message');

  // Extract weeks and post_now from customId
  // Format: addannouncement-modal|<weeks>|<post_now>
  const customIdParts = interaction.customId.split('|');
  const weeks = Number(customIdParts[1]);
  const post_now = customIdParts[2] === 'true';

  const announcement = await Announcement.create({ name, message, weeks });
  // Show embed
  const embed = showAnnouncement(announcement);
  await interaction.reply({
    content: `Announcement created.${post_now ? ' It will be posted immediately.' : ''}`,
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });

  if (post_now) {
    if (!CHANNEL_ID) {
      console.error('BOT_CHANNEL_ID is not defined');
      return;
    }

    // Post the announcement immediately
    try {
      const channel = await interaction.client.channels.fetch(CHANNEL_ID);
      if (channel instanceof TextChannel) {
        announcement.weeks = announcement.weeks - 1;
        await announcement.save();
        const embed = showAnnouncement(announcement);
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Failed to send announcement:', error);
    }
  }
}

export { execute, commandData, handleModalSubmit as handleAnnouncementModal };
