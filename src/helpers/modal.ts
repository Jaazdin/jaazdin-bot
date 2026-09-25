import { Client, Events, Interaction } from 'discord.js';
// Import your modal handlers
import { handleAddAnnouncementModal } from '~/commands/announcement/addannouncement';
import { handleEditAnnouncementModal } from '~/commands/announcement/editannouncement';

export function setupModalInteractionHandler(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isModalSubmit()) return;

    try {
      // Route to appropriate handler based on customId
      if (interaction.customId.startsWith('addannouncement-modal|')) {
        await handleAddAnnouncementModal(interaction);
      }
      if (interaction.customId.startsWith('editannouncement-modal|')) {
        await handleEditAnnouncementModal(interaction);
      }
      // Add other modal handlers here
    } catch (error) {
      console.error('Error handling modal submit:', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing your submission.',
          ephemeral: true,
        });
      }
    }
  });
}
