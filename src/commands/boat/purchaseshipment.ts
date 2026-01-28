import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Boat, Shipment } from '~/db/models/Boat';
import { boatNameAutocomplete, formatNames, itemNameAutocomplete, updateBoatEmbed } from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'purchaseshipment',
  description: 'Purchase a shipment item from a boat (subtracts 1 from quantity, deletes if zero)',
  category: 'boats',
  options: [
    { name: 'boat', type: 'string', description: 'Boat name', required: true, autocomplete: true },
    { name: 'item', type: 'string', description: 'Item name', required: true, autocomplete: true },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('boat', true);
  const itemName = interaction.options.getString('item', true);

  // Find the boat first
  const boat = await Boat.findOne({ where: { boatName } });
  if (!boat) {
    await interaction.reply({
      content: `⚠️ **Boat Not Found**\n\nNo boat found with name **${formatNames(boatName)}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  // Use boatId to find shipment
  const shipment = await Shipment.findOne({ where: { boatId: boat.id, itemName } });

  if (!shipment) {
    await interaction.reply({
      content: `⚠️ **Shipment Not Found**\n\nNo shipment found for boat **${formatNames(boatName)}** with item **${formatNames(itemName)}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  const price = shipment.price;

  if (shipment.quantity <= 1) {
    await shipment.destroy();

    // Update the boat's Discord embed if it exists
    await updateBoatEmbed(boatName);

    await interaction.reply({
      content: `💰 **Purchase Complete!**\n\nYou purchased the last **${formatNames(itemName)}** from **${formatNames(boatName)}** for **${price} gp**.\n\n⚠️ This item is now sold out!`,
      //flags: MessageFlags.Ephemeral,
    });
    return;
  }

  shipment.quantity -= 1;
  await shipment.save();

  // Update the boat's Discord embed if it exists
  await updateBoatEmbed(boatName);

  await interaction.reply({
    content: `💰 **Purchase Complete!**\n\nYou purchased **${formatNames(itemName)}** from **${formatNames(boatName)}** for **${price} gp**.\n\n📦 Remaining quantity: **${shipment.quantity}**`,
    //flags: MessageFlags.Ephemeral,
  });
}

// Autocomplete for boat name and item name
async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name === 'boat') {
    await boatNameAutocomplete(interaction, { runningOnly: true, inTown: true }); // Only running boats
  } else if (focusedOption.name === 'item') {
    await itemNameAutocomplete(interaction);
  }
}

export { execute, commandData, autocomplete };
