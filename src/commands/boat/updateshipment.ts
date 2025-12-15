import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Boat, Shipment } from '~/db/models/Boat';
import { parseChangeString, updateBoatEmbed } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'updateshipment',
  description: 'Update a shipment item for a boat (by boat and item name)',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    { name: 'boat', type: 'string', description: 'Boat name', required: true, autocomplete: true },
    { name: 'item', type: 'string', description: 'Item name', required: true, autocomplete: true },
    { name: 'type', type: 'string', description: 'Item type', required: true, autocomplete: true },
    { name: 'price', type: 'integer', description: 'New item price (gp)' },
    { name: 'quantity', type: 'string', description: 'New quantity (+x, -x, =x' },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {

  const boatName = interaction.options.getString('boat', true);
  const itemName = interaction.options.getString('item', true);
  const itemType = interaction.options.getString('type');
  const price = interaction.options.getInteger('price');
  const quantityRaw = interaction.options.getString('quantity');

  const shipment = await Shipment.findOne({ where: { boatName, itemName } });
  if (!shipment) {
    await interaction.reply({
      content: `No shipment found for boat **${boatName}** with item **${itemName}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const quantity = await parseChangeString(quantityRaw, shipment.quantity, 'quantity', 0, null, interaction);
  if (quantity === null) return;

  // If quantity is zero or less, delete the shipment
  if (quantity !== null && quantity <= 0) {
    await shipment.destroy();

    // Update the boat's Discord embed if it exists
    await updateBoatEmbed(boatName);

    await interaction.reply({
      content: `Shipment for **${itemName}** on boat **${boatName}** has been deleted (quantity set to ${quantity}).`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (price !== null) shipment.price = price;
  if (quantity !== null) shipment.quantity = quantity;
  if (itemType !== null) shipment.type = itemType;

  if (price === null && quantity === null && itemType === null) {
    await interaction.reply({
      content: 'No updates provided. Please specify at least one field to update.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await shipment.save();

    // Update the boat's Discord embed if it exists
    await updateBoatEmbed(boatName);

    await interaction.reply({
      content: `Shipment for **${itemName}** on boat **${boatName}** updated successfully.`,
      flags: MessageFlags.Ephemeral,
    });
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
    const focused = focusedOption.value.toLowerCase();
    const boats = await Boat.findAll({
      attributes: ['boatName'],
      where: { isRunning: true },
    });
    const filtered = boats
      .map((b) => b.boatName)
      .filter((name) => name.toLowerCase().startsWith(focused))
      .slice(0, 25)
      .map((name) => ({ name, value: name }));
    await interaction.respond(filtered);
  } else if (focusedOption.name === 'item') {
    // Autocomplete for item names based on selected boat
    const boatName = interaction.options.getString('boat');
    if (!boatName) {
      await interaction.respond([]);
      return;
    }
    const focused = focusedOption.value.toLowerCase();
    const shipments = await Shipment.findAll({
      where: { boatName },
      attributes: ['itemName'],
    });
    const filtered = shipments
      .map((s) => s.itemName)
      .filter((name) => name.toLowerCase().startsWith(focused))
      .slice(0, 25)
      .map((name) => ({ name, value: name }));
    await interaction.respond(filtered);
  }
}

export { execute, commandData, autocomplete };
