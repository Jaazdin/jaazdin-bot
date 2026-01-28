import { ChatInputCommandInteraction } from 'discord.js';

import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'getwage',
  description: 'Calculate your wage formula',
  category: 'jobs',
  options: [
    { name: 'tier', type: 'integer', description: 'The tier of the job (1-30)', required: true },
    {
      name: 'die',
      type: 'string',
      description: 'The wage die (d4, d6, d8, d10, d12)',
      required: true,
      choices: ['d4', 'd6', 'd8', 'd10', 'd12'].map((die) => ({ name: die, value: die })),
    },
    {
      name: 'skill_bonus',
      type: 'integer',
      description: 'The associated skill bonus (Athletics, WIS, Instrument, etc.)',
      required: true,
      minValue: -4,
      maxValue: 30,
    },
    {
      name: 'has_proficiency',
      type: 'boolean',
      description: 'Whether you have the associated proficiency',
      required: true,
    },
    {
      name: 'item_bonus',
      type: 'integer',
      description: 'The item bonus (+1 tools, luckstone, etc)',
      minValue: 1,
    },
    { name: 'flat_bonus', type: 'string', description: 'The flat bonus (Boats, festivals, etc)' },
  ],
};

function generateMultipliedBonusString(
  skillBonusString: string,
  itemBonusString: string,
  tierBonusString: string,
  toolProfMultiplier: number
) {
  if (!skillBonusString && !itemBonusString && !tierBonusString) return '';
  const skillItemTierString = `${skillBonusString}${itemBonusString}${tierBonusString}`.trim();
  if (toolProfMultiplier > 1) {
    return `+ (${skillItemTierString}) * ${toolProfMultiplier} (Proficiency) `;
  }
  return `+ ${skillItemTierString} `;
}

async function execute(interaction: ChatInputCommandInteraction) {
  const tier = interaction.options.getInteger('tier', true);
  const die = interaction.options.getString('die', true);
  const skillBonus = interaction.options.getInteger('skill_bonus') || 0;
  const itemBonus = interaction.options.getInteger('item_bonus') || 0;
  const flatBonus = interaction.options.getString('flat_bonus') || '';
  const hasToolProf = interaction.options.getBoolean('has_proficiency') || false;

  const tierBonus = Math.max(0, tier - 7);
  const toolProfMultiplier = tier >= 5 && hasToolProf ? 2 : 1;
  const totalBonus = (skillBonus + itemBonus + tierBonus) * toolProfMultiplier;

  const dieString = `${tier}${die} (Tier)`;
  const skillBonusString = skillBonus > 0 ? `${skillBonus} (Skill) ` : ''; // No plus sign here, handled in generateMultipliedBonusString
  const itemBonusString = itemBonus > 0 ? `+ ${itemBonus} (Item) ` : '';
  const tierBonusString = tierBonus > 0 ? `+ ${tierBonus} (Tier Bonus) ` : '';
  // const flatBonusString = flatBonus > 0 ? `+ ${flatBonus} (Flat Bonus)` : '';

  const multipliedBonusString = generateMultipliedBonusString(
    skillBonusString,
    itemBonusString,
    tierBonusString,
    toolProfMultiplier
  );

  const cleanedFlatBonus = flatBonus.startsWith('+') ? flatBonus.slice(1).trim() : flatBonus;

  const totalBonusString =
    `${multipliedBonusString}${cleanedFlatBonus ? `+ ${cleanedFlatBonus} (Flat Bonus)` : ''}`.trim();

  const wageFormula = `${tier}${die}${totalBonus > 0 ? ` + ${totalBonus}` : ''}${cleanedFlatBonus ? ` + ${cleanedFlatBonus}` : ''}`;

  await interaction.reply({
    embeds: [
      {
        title: 'Wage Calculation',
        description: `Your wage formula is: \`\`\`!r ${wageFormula}\`\`\``,
        fields: [
          { name: 'Breakdown', value: `${dieString} ${totalBonusString || 'No bonuses applied'}`, inline: false },
        ],
        color: 0x00ff00,
      },
    ],
  });
}

export { execute, commandData };
