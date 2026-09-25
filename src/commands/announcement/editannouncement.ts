import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Announcement } from '~/db/models/Announcement';
import { CommandData, Roles } from '~/types';

const CHANNEL_ID = process.env.BOT_CHANNEL_ID;

const commandData: CommandData = {
  name: 'editannouncement',
  description: 'Edit an existing announcement',
  category: 'announcement',
  requiredRole: Roles.GM,
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'Name of the announcement to edit',
      required: true,
      autocomplete: true,
    },
  ],
};

async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused();
  const announcements = await Announcement.findAll();
  const filtered = announcements.filter((a) => a.name.toLowerCase().includes(focusedValue.toLowerCase()));
  await interaction.respond(
    filtered.slice(0, 25).map((a) => ({ name: `${a.name} (${a.message.slice(0, 25)}...)`, value: String(a.id) }))
  );
}

async function execute(interaction: ChatInputCommandInteraction) {
  const id = parseInt(interaction.options.getString('name') as string, 10);

  // Find announcement
  const announcement = await Announcement.findOne({ where: { id } });
  if (!announcement) {
    await interaction.reply({
      content: 'Could not find the specified announcement.',
      ephemeral: true,
    });
    return;
  }
  const post_now = interaction.options.getBoolean('post_now') ?? false;

  // Show modal for input
  const modal = new ModalBuilder()
    .setCustomId(`editannouncement-modal|${id}`) // Pass weeks and post_now in customId
    .setTitle('Edit Announcement');

  const nameInput = new TextInputBuilder()
    .setCustomId('announcement-name')
    .setLabel('Announcement Name')
    .setValue(announcement.name)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId('announcement-message')
    .setLabel('Announcement Message')
    .setValue(announcement.message)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput)
  );

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction: Interaction) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('editannouncement-modal|')) return;

  const id = parseInt(interaction.customId.split('|')[1], 10);
  const announcement = await Announcement.findOne({ where: { id } });
  if (!announcement) {
    await interaction.reply({
      content: 'Could not find the specified announcement.',
      ephemeral: true,
    });
    return;
  }

  const name = interaction.fields.getTextInputValue('announcement-name');
  const message = interaction.fields.getTextInputValue('announcement-message');

  // Update announcement
  announcement.name = name;
  announcement.message = message;
  await announcement.save();

  await interaction.reply({
    content: 'Announcement updated successfully.',
    ephemeral: true,
  });
}

export { commandData, execute, autocomplete, handleModalSubmit as handleEditAnnouncementModal };
