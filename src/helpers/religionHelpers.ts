import { AutocompleteInteraction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Domain, Religion } from '~/db/models/Religion';
import { formatNames } from './helpers';

/**
 * Find a religion by name, with error handling
 */
export async function findReligionByName(
  interaction: ChatInputCommandInteraction,
  name: string
): Promise<Religion | null> {
  const religion = await Religion.findOne({
    where: { name: name.toLowerCase() },
  });

  if (!religion) {
    await interaction.reply({
      content: `Religion "${formatNames(name)}" not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return religion;
}

/**
 * Check if a religion name already exists
 */
export async function checkReligionExists(interaction: ChatInputCommandInteraction, name: string): Promise<boolean> {
  const existingReligion = await Religion.findOne({
    where: { name: name.toLowerCase() },
  });

  if (existingReligion) {
    await interaction.reply({
      content: `A religion with the name "${formatNames(name)}" already exists.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

/**
 * Religion autocomplete helper
 */
export async function religionAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const religions = await Religion.findAll();

  const filtered = religions.filter((religion) => religion.dataValues.name.toLowerCase().startsWith(focusedValue));

  await interaction.respond(
    filtered
      .slice(0, 25)
      .map((religion) => ({
        name: formatNames(religion.dataValues.name),
        value: religion.dataValues.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

/**
 * Domain autocomplete helper
 */
export async function domainAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const domains = await Domain.findAll();

  const filtered = domains.filter((domain) => domain.dataValues.name.toLowerCase().startsWith(focusedValue));

  await interaction.respond(
    filtered
      .slice(0, 25)
      .map((domain) => ({
        name: formatNames(domain.dataValues.name),
        value: domain.dataValues.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

/**
 * Combined autocomplete for religion commands
 */
export async function religionCommandAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true).name;

  switch (focusedOption) {
    case 'name':
    case 'oldname':
      await religionAutocomplete(interaction);
      break;
    case 'domain':
      await domainAutocomplete(interaction);
      break;
    default:
      await interaction.respond([]);
  }
}
