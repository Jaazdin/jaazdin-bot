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
const MAX_ATTEMPTS = 100;

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
  if (grandTotal < MIN_TOTAL) return 'total';
  const [i0, i1] = getTopTwoIndices(rolls);
  if (rolls[i0].total + rolls[i1].total < MIN_TOP_TWO) return 'topTwo';
  return true;
}

async function execute(interaction: ChatInputCommandInteraction) {
  type FullRerollAttempt = { totals: number[]; grandTotal: number };
  type TopTwoRerollAttempt = { prevRolls: [number, number]; prevSum: number };

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
        const prev0 = rolls[i0].total;
        const prev1 = rolls[i1].total;
        topTwoRerollHistory.push({ prevRolls: [prev0, prev1], prevSum: prev0 + prev1 });
        rolls[i0] = rollFormula('4d6dl1');
        rolls[i1] = rollFormula('4d6dl1');
        console.log(rolls[i0].formattedResults, rolls[i1].formattedResults);
        grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
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
        historyLines.push(`  #${i}  [${totalsStr}] = ${gt} ❌`);
      }
      const finalTotals = rolls.map((r) => String(r.total).padStart(2)).join(', ');
      historyLines.push(`  #${fullRerollHistory.length}  [${finalTotals}] = ${grandTotal} ✅`);
    }
    if (topTwoRerollHistory.length > 0) {
      if (historyLines.length > 0) historyLines.push('');
      const [fi0, fi1] = getTopTwoIndices(rolls);
      historyLines.push(`Top-2 rerolls (slots ${fi0 + 1} & ${fi1 + 1}, top 2 < ${MIN_TOP_TWO}):`);
      for (let i = 0; i < topTwoRerollHistory.length; i++) {
        const { prevRolls, prevSum } = topTwoRerollHistory[i];
        historyLines.push(`  #${i}  [${prevRolls[0]}, ${prevRolls[1]}] = ${prevSum} ❌`);
      }
      const finalSum = rolls[fi0].total + rolls[fi1].total;
      const finalValid = finalSum >= MIN_TOP_TWO;
      historyLines.push(
        `  #${topTwoRerollHistory.length}  [${rolls[fi0].total}, ${rolls[fi1].total}] = ${finalSum} ${finalValid ? '✅' : '❌'}`
      );
    }

    const embed = new EmbedBuilder()
      .setTitle('🎲 Character Stat Rolls')
      .setDescription('Rolling `4d6dl1` x 6')
      .setColor(0x3498db)
      .addFields(rollFields);

    if (historyLines.length > 0) {
      const raw = historyLines.join('\n');
      const MAX_CHARS = 900; // leave room for code block markers
      let historyValue: string;
      if (raw.length <= MAX_CHARS) {
        historyValue = `\`\`\`\n${raw}\n\`\`\``;
      } else {
        // Show first 5 and last 3 lines with a truncation notice
        const lines = historyLines;
        const head = lines.slice(0, 5);
        const tail = lines.slice(-3);
        const omitted = lines.length - head.length - tail.length;
        const truncated = [...head, `  ... ${omitted} more attempts ...`, ...tail].join('\n');
        historyValue = `\`\`\`\n${truncated}\n\`\`\``;
      }
      embed.addFields({
        name: '📜 Roll History',
        value: historyValue,
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
