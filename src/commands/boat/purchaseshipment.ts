import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Boat, Shipment } from '~/db/models/Boat';
import {
  boatNameAutocomplete,
  formatNames,
  itemNameAutocomplete,
  replyWithUserMention,
  updateBoatEmbed,
} from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'purchaseshipment',
  description: 'Purchase a shipment item from a boat (subtracts 1 from quantity)',
  category: 'boats',
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
  const shipment = await Shipment.findOne({
    where: { boatId: boat.id, itemName },
  });

  if (!shipment) {
    await interaction.reply({
      content: `⚠️ **Shipment Not Found**\n\nNo shipment found for boat **${formatNames(boatName)}** with item **${formatNames(itemName)}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  if (shipment.quantity <= 0) {
    await interaction.reply({
      content: `❌ **Sold Out**\n\n**${formatNames(itemName)}** on **${formatNames(boatName)}** is sold out.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  // Sold-out items are kept at 0 so they still show as sold out in the boat's post
  shipment.quantity -= 1;
  await shipment.save();
  const soldOut = shipment.quantity === 0;

  const embed = new EmbedBuilder()
    .setTitle('💰 Purchase Complete!')
    .setDescription(`Purchased **${formatNames(itemName)}** from **${formatNames(boatName)}**.`)
    .setColor(0x4caf50)
    .addFields(
      { name: 'Price', value: `${shipment.price} gp`, inline: true },
      { name: 'Remaining', value: soldOut ? '⚠️ Sold out!' : `📦 ${shipment.quantity}`, inline: true }
    );

  await replyWithUserMention(interaction, [embed]);

  // Update the boat's weekly post after replying, since editing Discord messages can be slow
  await updateBoatEmbed(boatName);
}

// Autocomplete for boat name and item name
async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name === 'boat') {
    await boatNameAutocomplete(interaction, {
      runningOnly: true,
      inTown: true,
    }); // Only running boats
  } else if (focusedOption.name === 'item') {
    await itemNameAutocomplete(interaction, { inStockOnly: true }); // Sold-out items can't be purchased
  }
}

export { execute, commandData, autocomplete };
