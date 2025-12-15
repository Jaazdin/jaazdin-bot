import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Reagent } from '~/db/models/Reagent';
import { createItemEmbed, creatureTypeChoices, randomInt, rarityChoices } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'generatereagent',
  description: 'Generate a random reagent by rarity and creature type',
  category: 'items',
  requiredRole: [Roles.GM, Roles.DM],
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the reagent',
      required: true,
      choices: rarityChoices,
    },
    {
      name: 'creaturetype',
      type: 'string',
      description: 'Creature type of the reagent',
      required: true,
      choices: creatureTypeChoices,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {

  const rarity = interaction.options.getString('rarity', true);
  const creatureType = interaction.options.getString('creaturetype', true);

  const reagentChosen = await getRandomReagentByRarityAndType(rarity, creatureType);
  if (!reagentChosen) {
    await interaction.reply({
      content: `No reagents found for rarity "${rarity}" and creature type "${creatureType}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const price = randomInt(reagentChosen.price_min, reagentChosen.price_max);

  const embed = createItemEmbed(
    `Random Reagent (${rarity.charAt(0).toUpperCase() + rarity.slice(1)}, ${creatureType.charAt(0).toUpperCase() + creatureType.slice(1)})`,
    reagentChosen.name,
    [{ name: 'Price', value: `${price} gp` }],
    0x16a085
  );

  await interaction.reply({ embeds: [embed] });
}

// Utility function for use in other scripts
async function getRandomReagentByRarityAndType(rarity: string, creatureType: string) {
  const validReagents = await Reagent.findAll({ where: { rarity, type: creatureType } });
  if (validReagents.length === 0) return null;
  return validReagents[Math.floor(Math.random() * validReagents.length)];
}

// New helper: get a random reagent by rarity, regardless of type
async function getRandomReagentByRarity(rarity: string) {
  const validReagents = await Reagent.findAll({ where: { rarity } });
  if (validReagents.length === 0) return null;
  return validReagents[Math.floor(Math.random() * validReagents.length)];
}

export { execute, commandData, getRandomReagentByRarityAndType, getRandomReagentByRarity };
