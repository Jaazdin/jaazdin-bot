import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Boat, Shipment } from '~/db/models/Boat';
import { createBoatStatusDescription, tableToGenerateChoices, generateShipmentItems } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'addboat',
  description: 'Add a new boat to the database',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    { name: 'name', type: 'string', description: 'Boat name', required: true },
    { name: 'waittime', type: 'integer', description: 'Weeks at sea', required: true },
    { name: 'timeintown', type: 'integer', description: 'Weeks in town', required: true },
    { name: 'city', type: 'string', description: 'City of origin' },
    { name: 'country', type: 'string', description: 'Country of origin' },
    { name: 'tier2ability', type: 'string', description: 'Tier 2 ability description' },
    {
      name: 'table',
      type: 'string',
      description: 'What type of loot the boat will generate',
      required: false,
      choices: tableToGenerateChoices,
    },
    { name: 'istier2', type: 'boolean', description: 'Is this a tier 2 boat? (default false)' },
    { name: 'isrunning', type: 'boolean', description: 'Is this boat running? (default true)' },
    {
      name: 'weeksleft',
      type: 'integer',
      description: 'Weeks left (default furthest from town or in town for longest time)',
    },
    { name: 'isintown', type: 'boolean', description: 'Is the boat in town? (default false)' },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('name', true);
  const city = interaction.options.getString('city', false);
  const country = interaction.options.getString('country', false);
  const waitTime = interaction.options.getInteger('waittime', true);
  const timeInTown = interaction.options.getInteger('timeintown', true);

  // No jobs initially - use /boat-add-job to add jobs after creation
  const jobsAffected: string[] = [];

  const tier2Ability = interaction.options.getString('tier2ability') ?? '';
  const tableToGenerate = interaction.options.getString('table') ?? '';
  const isTier2 = interaction.options.getBoolean('istier2') ?? false;
  const isRunning = interaction.options.getBoolean('isrunning') ?? true;
  const isInTown = interaction.options.getBoolean('isintown') ?? false;
  let weeksLeft = interaction.options.getInteger('weeksleft');
  if (weeksLeft === null) {
    if (isInTown) {
      weeksLeft = isTier2 ? timeInTown + 1 : timeInTown;
    } else {
      weeksLeft = isTier2 ? waitTime - 1 : waitTime;
    }
  }

  try {
    const [boat, created] = await Boat.findOrCreate({
      where: { boatName },
      defaults: {
        city,
        country,
        waitTime,
        timeInTown,
        jobsAffected,
        tier2Ability,
        tableToGenerate,
        isTier2,
        isRunning,
        weeksLeft,
        isInTown,
      },
    });

    if (!created) {
      await interaction.reply({ content: `A boat named "${boatName}" already exists.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // If the boat is in town and has a table to generate, create a shipment
    if (boat.isInTown && boat.tableToGenerate && boat.tableToGenerate !== 'NA') {
      // Remove any existing shipments for this boat (shouldn't be any, but for safety)
      await Shipment.destroy({ where: { boatId: boat.id } });
      const goods = await generateShipmentItems(boat);
      for (const item of goods) {
        await Shipment.create({
          boatId: boat.id,
          itemName: item.itemName,
          price: item.price,
          quantity: item.quantity,
          type: item.type,
        });
      }
    }

    // Create detailed response with boat information
    const description = await createBoatStatusDescription(boat);
    const embed = new EmbedBuilder()
      .setTitle('✅ Boat Added Successfully')
      .setDescription(description)
      .setColor(0x00ff00)
      .addFields([
        {
          name: '📋 Next Steps',
          value: 'Use `/boat-add-job` to assign jobs to this boat.\nUse `/showboats` to view boat details.',
          inline: false,
        },
      ]);

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `Failed to add boat: ${error}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export { execute, commandData };
