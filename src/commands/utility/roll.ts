import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { rollFormula } from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'roll',
  alias: 'r',
  description: 'Rolls a dice formula',
  category: 'utility',
  options: [
    {
      name: 'formula',
      description: 'The formula to roll. Check foundry roll docs for information',
      type: 'string',
      required: true,
    },
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  const formula = interaction.options.getString('formula', true).toLowerCase();

  if (!/^([1-9]\d*|d)/.test(formula)) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Invalid Formula')
      .setDescription("Formula must start with an integer greater than 0 or 'd'.")
      .setColor(0xe74c3c)
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const { total, formattedResults } = rollFormula(formula);

    const color = 0x3498db;

    const embed = new EmbedBuilder()
      .setTitle('🎲 Dice Roll Results')
      .setColor(color)
      .addFields(
        {
          name: '📝 Formula',
          value: `\`${formula}\``,
          inline: true,
        },
        {
          name: '🎲 Roll Details',
          value: formattedResults,
          inline: false,
        }
      );

    embed.addFields({
      name: '🎯 Total',
      value: `**${total}**`,
      inline: true,
    });

    embed.setTimestamp();

    await interaction.reply({
      embeds: [embed],
      // flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Parsing Formula')
      .setDescription(`\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``)
      .setColor(0xe74c3c)
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }
}

export { execute, commandData };
