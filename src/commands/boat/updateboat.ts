import { ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { TIMER_MAX_LENGTH } from '~/constants';
import { Boat, Shipment } from '~/db/models/Boat';
import {
  findBoatByName,
  boatNameAutocomplete,
  generateShipmentItems,
  boatAtSeaEmbedBuilder,
  tableToGenerateChoices,
  parseChangeString,
} from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'updateboat',
  description: 'Update properties of an existing boat',
  category: 'boats',
  requiredRole: Roles.GM,
  options: [
    { name: 'name', type: 'string', description: 'Boat name (required)', required: true, autocomplete: true },
    { name: 'city', type: 'string', description: 'City of origin' },
    { name: 'country', type: 'string', description: 'Country of origin' },
    { name: 'waittime', type: 'integer', description: 'Weeks at sea' },
    { name: 'timeintown', type: 'integer', description: 'Weeks in town' },
    { name: 'tier2ability', type: 'string', description: 'Tier 2 ability description' },
    {
      name: 'table',
      type: 'string',
      description: 'What type of loot the boat will generate',
      choices: tableToGenerateChoices,
    },
    { name: 'istier2', type: 'boolean', description: 'Is this a tier 2 boat?' },
    { name: 'isrunning', type: 'boolean', description: 'Is this boat running?' },
    { name: 'weeksleft', type: 'string', description: 'Weeks left (use +x, -x, =x)' },
    { name: 'isintown', type: 'boolean', description: 'Is the boat in town?' },
  ],
};

function buildBoatUpdatesFromOptions(
  interaction: ChatInputCommandInteraction,
  existingBoat?: Boat
): { updates: Record<string, unknown>; error?: string } {
  const updates: Record<string, unknown> = {};

  // Helper function to add non-null values to updates
  const addIfNotNull = (key: string, value: unknown) => {
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
  // Handle weeksLeft as a string change system
  const weeksLeftRaw = interaction.options.getString('weeksleft');
  if (weeksLeftRaw !== null && existingBoat) {
    // Use parseChangeString to compute new weeksLeft
    // This is synchronous in buildBoatUpdatesFromOptions, so we use a sync fallback
    // (parseChangeString is async, but we can't await here; handle in execute if needed)
    updates.weeksLeft = undefined; // Mark for later update in execute
  } else {
    addIfNotNull('weeksLeft', interaction.options.getInteger('weeksleft'));
  }

  // Boolean fields
  addIfNotNull('isTier2', interaction.options.getBoolean('istier2'));
  addIfNotNull('isRunning', interaction.options.getBoolean('isrunning'));
  addIfNotNull('isInTown', interaction.options.getBoolean('isintown'));

  // Auto-calculate weeksLeft if not explicitly set,
  // and only if relevant fields that affect weeksLeft were changed
  if (
    updates.weeksLeft === undefined &&
    (updates.waitTime !== undefined ||
      updates.timeInTown !== undefined ||
      updates.isTier2 !== undefined ||
      updates.isInTown !== undefined)
  ) {
    // Calculate weeksLeft based on boat state and timing values
    const waitTime = interaction.options.getInteger('waittime') ?? existingBoat?.waitTime;
    const timeInTown = interaction.options.getInteger('timeintown') ?? existingBoat?.timeInTown;
    const isTier2 = interaction.options.getBoolean('istier2') ?? existingBoat?.isTier2 ?? false;
    const isInTown = interaction.options.getBoolean('isintown') ?? existingBoat?.isInTown ?? false;

    const timeToUse = isInTown ? timeInTown : waitTime;

    if (timeToUse !== null && timeToUse !== undefined) {
      if (isInTown) {
        // Boat in town: use timeInTown (+ 1 for tier 2)
        updates.weeksLeft = isTier2 ? timeToUse + 1 : timeToUse;
      } else {
        // Boat at sea: use waitTime (- 1 for tier 2)
        updates.weeksLeft = isTier2 ? timeToUse - 1 : timeToUse;
      }
    }
  }

  return { updates };
}

async function handleShipmentUpdate(boat: Boat, updates: Partial<Boat>): Promise<void> {
  // If tableToGenerate was changed in the updates, use the new value
  const newTableToGenerate = updates.tableToGenerate !== undefined ? updates.tableToGenerate : boat.tableToGenerate;
  const newIsInTown = updates.isInTown !== undefined ? updates.isInTown : boat.isInTown;

  const shouldHaveShipmentAfterUpdate = newIsInTown && newTableToGenerate && newTableToGenerate !== 'NA';

  if (shouldHaveShipmentAfterUpdate) {
    // Remove old shipments for this boat
    await Shipment.destroy({ where: { boatId: boat.id } });

    // Generate new shipment if the boat should have one
    const goods = await generateShipmentItems({
      ...boat.dataValues,
      ...updates,
      tableToGenerate: newTableToGenerate,
      isInTown: newIsInTown,
    } as Boat);

    // Insert new shipment items
    for (const item of goods) {
      await Shipment.create({
        boatId: boat.id,
        itemName: item.itemName,
        price: item.price,
        quantity: item.quantity,
        type: item.type,
      });
    }
  } else {
    // Remove shipments if boat should not have them
    await Shipment.destroy({ where: { boatId: boat.id } });
  }
}

async function execute(interaction: ChatInputCommandInteraction) {
  const boatName = interaction.options.getString('name', true);

  // Use helper to find boat with error handling
  const boat = await findBoatByName(interaction, boatName);
  if (!boat) {
    return;
  }

  // Build update object using helper
  const { updates, error } = buildBoatUpdatesFromOptions(interaction, boat);
  if (error) {
    await interaction.reply({
      content: error,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // If weeksLeft is to be updated using the string system, do it here
  const weeksLeftRaw = interaction.options.getString('weeksleft');
  if (weeksLeftRaw !== null) {
    const newWeeksLeft = await parseChangeString(
      weeksLeftRaw,
      boat.weeksLeft,
      'weeks left',
      0,
      TIMER_MAX_LENGTH,
      interaction
    );
    if (newWeeksLeft === null) return;
    updates.weeksLeft = newWeeksLeft;
  }

  try {
    // Update the boat
    await boat.update(updates);

    // Handle shipment generation/removal based on the updates
    await handleShipmentUpdate(boat, updates);

    const embed = await boatAtSeaEmbedBuilder(boat);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    await interaction.reply({ content: `Failed to update boat: ${error}`, flags: MessageFlags.Ephemeral });
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
