import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Announcement } from '~/db/models/Announcement';
import { confirmAction, formatNames } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'destroyannouncement',
  description: 'Delete an announcement from the database',
  category: 'announcement',
  requiredRole: Roles.GM,
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'Name of the announcement to delete',
      required: true,
      autocomplete: true,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const id = parseInt(interaction.options.getString('name') as string, 10);

  // Find announcement
  const announcement = await Announcement.findOne({ where: { id } });
  if (!announcement) {
    await interaction.reply({
      content: 'Could not find the specified announcement.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const truncatedMessage =
    announcement.message.length > 600 ? `${announcement.message.slice(0, 597)}...` : announcement.message;

  const confirmFields = [
      {
        name: 'Announcement Name',
        value: formatNames(announcement.name),
        inline: true,
      },
      {
        name: 'Message',
        value: truncatedMessage,
        inline: false,
      },
    ]

  if (announcement.weeks) {
    confirmFields.splice(1, 0,{
        name: 'Weeks Remaining',
        value: `${announcement.weeks}`,
        inline: true,
      });
  }

  const confirm = await confirmAction({
    interaction,
    title: 'Destroy Announcement',
    description: `Are you sure you want to destroy ${formatNames(announcement.name)}?`,
    confirmButtonText: 'Destroy',
    cancelButtonText: 'Cancel',
    fields: confirmFields,
    confirmEmbed: [
      {
        title: '✅ Announcement Destroyed',
        description: `The announcement ${formatNames(announcement.name)} has been destroyed.`,
        color: 0x4caf50, // Green
        timestamp: new Date().toISOString(),
      },
    ],
  });

  if (!confirm) {
    return;
  }

  // Proceed with destruction
  await announcement.destroy();
}

async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused();
  const announcements = await Announcement.findAll();
  const filtered = announcements.filter((a) => a.name.toLowerCase().includes(focusedValue.toLowerCase()));
  await interaction.respond(
    filtered.slice(0, 25).map((a) => ({ name: `${a.name} (${a.message.slice(0, 25)}...)`, value: String(a.id) })),
  );
}

export { execute, commandData, autocomplete };
