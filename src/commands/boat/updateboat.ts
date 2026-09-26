import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { TIMER_MAX_LENGTH } from '~/constants';
import { db } from '~/db/db';
import { Boat, Shipment } from '~/db/models/Boat';
import {
  findBoatByName,
  boatNameAutocomplete,
  generateShipmentItems,
  boatAtSeaEmbedBuilder,
  tableToGenerateChoices,
  parseChangeString,
  updateBoatEmbed,
} from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'updateboat',
  description: 'Update properties of an existing boat',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'Boat name (required)',
      required: true,
      autocomplete: true,
    },
    { name: 'city', type: 'string', description: 'City of origin' },
    { name: 'country', type: 'string', description: 'Country of origin' },
    { name: 'waittime', type: 'integer', description: 'Weeks at sea' },
    { name: 'timeintown', type: 'integer', description: 'Weeks in town' },
    {
      name: 'tier2ability',
      type: 'string',
      description: 'Tier 2 ability description',
    },
    {
      name: 'table',
      type: 'string',
      description: 'What type of loot the boat will generate',
      choices: tableToGenerateChoices,
    },
    { name: 'istier2', type: 'boolean', description: 'Is this a tier 2 boat?' },
    {
      name: 'isrunning',
      type: 'boolean',
      description: 'Is this boat running?',
    },
    {
      name: 'weeksleft',
      type: 'string',
      description: 'Weeks left (use +x, -x, =x)',
    },
    { name: 'isintown', type: 'boolean', description: 'Is the boat in town?' },
  ],
};

function buildBoatUpdatesFromOptions(interaction: ChatInputCommandInteraction, boat: Boat): Partial<Boat> {
  const updates: Partial<Boat> = {};

  // Helper function to add non-null values to updates
  const addIfNotNull = <K extends keyof Boat>(key: K, value: Boat[K] | null) => {
    if (value !== null) updates[key] = value;
  };

  // String fields
  addIfNotNull('city', interaction.options.getString('city'));
  addIfNotNull('country', interaction.options.getString('country'));
  addIfNotNull('tier2Ability', interaction.options.getString('tier2ability'));
  addIfNotNull('tableToGenerate', interaction.options.getString('table'));

  // Integer fields
  addIfNotNull('waitTime', interaction.options.getInteger('waittime'));
  addIfNotNull('timeInTown', interaction.options.getInteger('timeintown'));

  // Boolean fields
  addIfNotNull('isTier2', interaction.options.getBoolean('istier2'));
  addIfNotNull('isRunning', interaction.options.getBoolean('isrunning'));
  addIfNotNull('isInTown', interaction.options.getBoolean('isintown'));

  // Moving between town and sea restarts the countdown for the new location,
  // matching the weekly rollover (tier 2 boats spend one less week at sea and one more in town)
  if (updates.isInTown !== undefined && updates.isInTown !== boat.isInTown) {
    const isTier2 = updates.isTier2 ?? boat.isTier2 ?? false;
    updates.weeksLeft = updates.isInTown
      ? (updates.timeInTown ?? boat.timeInTown) + (isTier2 ? 1 : 0)
      : (updates.waitTime ?? boat.waitTime) - (isTier2 ? 1 : 0);
  }

  return updates;
}

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('name', true);

  // Validate everything that can reply with an error before deferring
  const boat = await findBoatByName(interaction, boatName);
  if (!boat) {
    return;
  }

  const updates = buildBoatUpdatesFromOptions(interaction, boat);

  // An explicit weeksleft (+x, -x, =x) overrides any recalculated value
  const weeksLeftRaw = interaction.options.getString('weeksleft');
  if (weeksLeftRaw !== null) {
    const newWeeksLeft = await parseChangeString(
      weeksLeftRaw,
      updates.weeksLeft ?? boat.weeksLeft,
      'weeks left',
      0,
      TIMER_MAX_LENGTH,
      interaction
    );
    if (newWeeksLeft === null) return;
    updates.weeksLeft = newWeeksLeft;
  }

  // Shipment generation can take longer than Discord's 3 second reply window
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const newTableToGenerate = updates.tableToGenerate ?? boat.tableToGenerate;
    const newIsInTown = updates.isInTown ?? boat.isInTown;
    const shouldHaveShipment = newIsInTown && !!newTableToGenerate && newTableToGenerate !== 'NA';

    // Only reroll the shipment when the table changes or the boat arrives in town,
    // so unrelated edits don't wipe the current stock
    const needsNewShipment =
      shouldHaveShipment && (newTableToGenerate !== boat.tableToGenerate || (newIsInTown && !boat.isInTown));

    const goods = needsNewShipment ? await generateShipmentItems({ ...boat.dataValues, ...updates } as Boat) : null;

    await db.transaction(async (transaction) => {
      await boat.update(updates, { transaction });

      if (!shouldHaveShipment || goods) {
        await Shipment.destroy({ where: { boatId: boat.id }, transaction });
      }
      if (goods) {
        await Shipment.bulkCreate(
          goods.map((item) => ({
            boatId: boat.id,
            itemName: item.itemName,
            price: item.price,
            quantity: item.quantity,
            type: item.type,
          })),
          { transaction }
        );
      }
    });

    await updateBoatEmbed(boat.boatName);

    const embed = await boatAtSeaEmbedBuilder(boat);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: `Failed to update boat: ${error}` });
  }
}

// Autocomplete for boat name and table options
async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'name') {
    await boatNameAutocomplete(interaction);
  }
}

export { execute, commandData, autocomplete };
