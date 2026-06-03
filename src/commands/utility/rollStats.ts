import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { rollFormula } from '~/helpers';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'rollstats',
  alias: 'randchar',
  description: 'Roll stats for a new character',
  category: 'utility',
};

const MIN_TOTAL = 0;
const MIN_TOP_TWO = 30;
const MAX_ATTEMPTS = 20;

type StatRolls = ReturnType<typeof rollFormula>[];

type ValidStatRollOptions = {
  rolls: StatRolls;
  grandTotal: number;
};

type InvalidStatRollReason = 'total' | 'topTwo';

function getTopTwoIndices(rolls: StatRolls): [number, number] {
  const sorted = rolls.map((r, i) => ({ total: r.total, index: i })).sort((a, b) => b.total - a.total);
  return [sorted[0].index, sorted[1].index];
}

function isValidStatRoll({ rolls, grandTotal }: ValidStatRollOptions): InvalidStatRollReason | true {
  // return grandTotal >= MIN_TOTAL;
  if (grandTotal < MIN_TOTAL) return 'total';
  const [i0, i1] = getTopTwoIndices(rolls);
  if (rolls[i0].total + rolls[i1].total < MIN_TOP_TWO) return 'topTwo';
  return true;
}

async function execute(interaction: ChatInputCommandInteraction) {
  type FullRerollAttempt = { totals: number[]; grandTotal: number };
  type TopTwoRerollAttempt = { newRolls: [number, number]; newSum: number };

  try {
    let rolls = Array.from({ length: 6 }, () => rollFormula('4d6dl1'));
    let grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
    let fullRerolls = 0;
    let topTwoRerolls = 0;
    const fullRerollHistory: FullRerollAttempt[] = [];
    const topTwoRerollHistory: TopTwoRerollAttempt[] = [];
    let validationResult = isValidStatRoll({ rolls, grandTotal });

    while (validationResult !== true && (fullRerolls < MAX_ATTEMPTS || topTwoRerolls < MAX_ATTEMPTS)) {
      if (validationResult === 'total' && fullRerolls < MAX_ATTEMPTS) {
        fullRerollHistory.push({ totals: rolls.map((r) => r.total), grandTotal });
        rolls = Array.from({ length: 6 }, () => rollFormula('4d6dl1'));
        grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
        fullRerolls++;
      } else if (validationResult === 'topTwo' && topTwoRerolls < MAX_ATTEMPTS) {
        const [i0, i1] = getTopTwoIndices(rolls);
        rolls[i0] = rollFormula('4d6dl1');
        rolls[i1] = rollFormula('4d6dl1');
        const to0 = rolls[i0].total;
        const to1 = rolls[i1].total;
        grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
        topTwoRerollHistory.push({ newRolls: [to0, to1], newSum: to0 + to1 });
        topTwoRerolls++;
      } else {
        break;
      }
      validationResult = isValidStatRoll({ rolls, grandTotal });
    }

    const rollFields = rolls.map((r, i) => ({
      name: `Roll ${i + 1} — **${r.total}**`,
      value: r.formattedResults,
      inline: false,
    }));

    const historyLines: string[] = [];
    if (fullRerollHistory.length > 0) {
      historyLines.push(`Full rerolls (total < ${MIN_TOTAL}):`);
      for (let i = 0; i < fullRerollHistory.length; i++) {
        const { totals, grandTotal: gt } = fullRerollHistory[i];
        const totalsStr = totals.map((t) => String(t).padStart(2)).join(', ');
        historyLines.push(`  #${i + 1}  [${totalsStr}] = ${gt} ❌`);
      }
      const finalTotals = rolls.map((r) => String(r.total).padStart(2)).join(', ');
      historyLines.push(`  #${fullRerollHistory.length + 1}  [${finalTotals}] = ${grandTotal} ✅`);
    }
    if (topTwoRerollHistory.length > 0) {
      if (historyLines.length > 0) historyLines.push('');
      const [i0, i1] = getTopTwoIndices(rolls);
      historyLines.push(`Top-2 rerolls (slots ${i0 + 1} & ${i1 + 1}, top 2 < ${MIN_TOP_TWO}):`);
      for (let i = 0; i < topTwoRerollHistory.length; i++) {
        const { newRolls, newSum } = topTwoRerollHistory[i];
        const valid = newSum >= MIN_TOP_TWO;
        historyLines.push(`  #${i + 1}  [${newRolls[0]}, ${newRolls[1]}] = ${newSum} ${valid ? '✅' : '❌'}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🎲 Character Stat Rolls')
      .setDescription('Rolling `4d6dl1` x 6')
      .setColor(0x3498db)
      .addFields(rollFields);

    if (historyLines.length > 0) {
      embed.addFields({
        name: '📜 Roll History',
        value: `\`\`\`\n${historyLines.join('\n')}\n\`\`\``,
        inline: false,
      });
    }

    embed.addFields({ name: '🎯 Grand Total', value: `**${grandTotal}**`, inline: false }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Rolling Stats')
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
