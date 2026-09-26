import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Shipment } from '~/db/models/Boat';
import {
  boatNameAutocomplete,
  findBoatByName,
  itemNameAutocomplete,
  parseChangeString,
  updateBoatEmbed,
} from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'updateshipment',
  description: 'Update a shipment item for a boat (by boat and item name)',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    {
      name: 'boat',
      type: 'string',
      description: 'Boat name',
      required: true,
      autocomplete: true,
    },
    {
      name: 'item',
      type: 'string',
      description: 'Item name',
      required: true,
      autocomplete: true,
    },
    { name: 'type', type: 'string', description: 'New item type' },
    { name: 'price', type: 'integer', description: 'New item price (gp)' },
    {
      name: 'quantity',
      type: 'string',
      description: 'New quantity (+x, -x, =x). Setting it to 0 removes the item',
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('boat', true);
  const itemName = interaction.options.getString('item', true);
  const itemType = interaction.options.getString('type');
  const price = interaction.options.getInteger('price');
  const quantityRaw = interaction.options.getString('quantity');

  if (itemType === null && price === null && quantityRaw === null) {
    await interaction.reply({
      content: 'No updates provided. Please specify at least one field to update.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const boat = await findBoatByName(interaction, boatName);
  if (!boat) {
    return;
  }

  const shipment = await Shipment.findOne({ where: { boatId: boat.id, itemName } });
  if (!shipment) {
    await interaction.reply({
      content: `No shipment found for boat **${boatName}** with item **${itemName}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (quantityRaw !== null) {
    const quantity = await parseChangeString(quantityRaw, shipment.quantity, 'quantity', 0, null, interaction);
    if (quantity === null) return;

    // If quantity is zero, delete the shipment
    if (quantity === 0) {
      await shipment.destroy();

      await interaction.reply({
        content: `Shipment for **${itemName}** on boat **${boatName}** has been deleted (quantity set to 0).`,
        flags: MessageFlags.Ephemeral,
      });

      // Update the boat's weekly post after replying, since editing Discord messages can be slow
      await updateBoatEmbed(boatName);
      return;
    }
    shipment.quantity = quantity;
  }

  if (price !== null) shipment.price = price;
  if (itemType !== null) shipment.type = itemType;

  try {
    await shipment.save();

    await interaction.reply({
      content: `Shipment for **${itemName}** on boat **${boatName}** updated successfully.`,
      flags: MessageFlags.Ephemeral,
    });

    // Update the boat's weekly post after replying, since editing Discord messages can be slow
    await updateBoatEmbed(boatName);
  } catch (error) {
    await interaction.reply({
      content: `Failed to update shipment: ${error}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Autocomplete for boat name and item name
async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'boat') {
    await boatNameAutocomplete(interaction, { runningOnly: true });
  } else if (focusedOption.name === 'item') {
    // Includes sold-out items so they can be restocked
    await itemNameAutocomplete(interaction);
  }
}

export { execute, commandData, autocomplete };
