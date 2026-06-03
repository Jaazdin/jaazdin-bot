import { AutocompleteInteraction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Domain, Religion } from '~/db/models/Religion';
import { checkReligionExists, religionCommandAutocomplete, replyWithUserMention } from '~/helpers';
import { showReligion } from './showReligion';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'addreligion',
  description: 'Will add a religion from the active religions',
  category: 'religion',
  options: [
    {
      name: 'name',
      type: 'string',
      description: 'The name of the religion.',
      required: true,
    },
    {
      name: 'domain',
      type: 'string',
      description: 'The domain of the religion',
      required: true,
      autocomplete: true,
    },
    {
      name: 'follower_count',
      type: 'integer',
      description: 'The number of followers of the religion (default 0)',
      minValue: 0,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name')?.toLowerCase() as string;
  const domain = interaction.options.getString('domain')?.toLowerCase() as string;
  const followers = interaction.options.getInteger('follower_count') ?? 0;

  // Check if religion name already exists using helper
  if (await checkReligionExists(interaction, name)) {
    return;
  }

  const domainData = await Domain.findOne({
    where: { name: domain.toLowerCase() },
  });
  if (!domainData) {
    await interaction.reply({
      content: `Domain "${domain}" not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedReligion = await Religion.create({
    name: name,
    domain_id: domainData.dataValues.id,
    follower_count: followers,
  });

  const message = await showReligion(selectedReligion);

  await replyWithUserMention(interaction, [message]);
}

async function autocomplete(interaction: AutocompleteInteraction) {
  await religionCommandAutocomplete(interaction);
}

export { execute, commandData, autocomplete };
