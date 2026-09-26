import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Shipment } from '~/db/models/Boat';
import { boatNameAutocomplete, findBoatByName, formatNames, updateBoatEmbed } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'addshipment',
  description: 'Add a new shipment item to a boat',
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
    { name: 'item', type: 'string', description: 'Item name', required: true },
    { name: 'type', type: 'string', description: 'Item type', required: true },
    {
      name: 'price',
      type: 'integer',
      description: 'Item price (gp)',
      required: true,
    },
    {
      name: 'quantity',
      type: 'integer',
      description: 'Quantity',
      required: true,
      minValue: 1,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('boat', true);
  const itemName = interaction.options.getString('item', true);
  const itemType = interaction.options.getString('type', true);
  const price = interaction.options.getInteger('price', true);
  const quantity = interaction.options.getInteger('quantity', true);

  const boat = await findBoatByName(interaction, boatName);
  if (!boat) {
    return;
  }

  // Purchases look items up by name, so a second row with the same name would never be reachable
  const existing = await Shipment.findOne({ where: { boatId: boat.id, itemName } });
  if (existing) {
    await interaction.reply({
      content: `**${formatNames(itemName)}** is already on **${formatNames(boatName)}** (quantity ${existing.quantity}). Use \`/updateshipment\` to change it.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await Shipment.create({
      boatId: boat.id,
      itemName,
      price,
      quantity,
      type: itemType,
    });

    const embed = new EmbedBuilder()
      .setTitle(`✅ Shipment Added to ${formatNames(boatName)}`)
      .setDescription(`Added **${formatNames(itemName)}** (x${quantity}, ${price}gp each)`)
      .setColor(0x00ff00);

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });

    // Update the boat's weekly post after replying, since editing Discord messages can be slow
    await updateBoatEmbed(boatName);
  } catch (error) {
    await interaction.reply({
      content: `Failed to add shipment: ${error}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Autocomplete for boat name
async function autocomplete(interaction: AutocompleteInteraction) {
  await boatNameAutocomplete(interaction, { runningOnly: true, inTown: true }); // Only running boats
}

export { execute, commandData, autocomplete };
