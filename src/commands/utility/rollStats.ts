import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { rollFormula, postToGist } from '~/helpers';
import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: 'rollstats',
  alias: 'randchar',
  description: 'Roll stats for a new character',
  category: 'utility',
};

const MIN_TOTAL = 65;
const MIN_TOP_TWO = 31;
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
  type FullRollSnapshot = { totals: number[]; grandTotal: number };
  type TopTwoRerollAttempt = {
    slots: [number, number];
    before: [number, number];
    after: [number, number];
    afterSum: number;
    grandTotalAfter: number;
  };
  type PhaseTwoStartSnapshot = {
    slots: [number, number];
    values: [number, number];
    topTwoSum: number;
    grandTotal: number;
  };

  try {
    let rolls = Array.from({ length: 6 }, () => rollFormula('4d6dl1'));
    let grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
    let fullRerolls = 0;
    let topTwoRerolls = 0;
    const fullRerollHistory: FullRollSnapshot[] = [{ totals: rolls.map((r) => r.total), grandTotal }];
    const topTwoRerollHistory: TopTwoRerollAttempt[] = [];
    let phaseTwoStartSnapshot: PhaseTwoStartSnapshot | null = null;

    // Phase 1: reroll all six until total meets threshold.
    while (grandTotal < MIN_TOTAL && fullRerolls < MAX_ATTEMPTS) {
      rolls = Array.from({ length: 6 }, () => rollFormula('4d6dl1'));
      grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
      fullRerolls++;
      fullRerollHistory.push({ totals: rolls.map((r) => r.total), grandTotal });
    }

    // Phase 2: after reaching total threshold, lock the initial top-two slots and reroll only them until their sum passes.
    if (grandTotal >= MIN_TOTAL) {
      const [startI0, startI1] = getTopTwoIndices(rolls);
      phaseTwoStartSnapshot = {
        slots: [startI0, startI1],
        values: [rolls[startI0].total, rolls[startI1].total],
        topTwoSum: rolls[startI0].total + rolls[startI1].total,
        grandTotal,
      };

      while (rolls[startI0].total + rolls[startI1].total < MIN_TOP_TWO && topTwoRerolls < MAX_ATTEMPTS) {
        const before: [number, number] = [rolls[startI0].total, rolls[startI1].total];
        rolls[startI0] = rollFormula('4d6dl1');
        rolls[startI1] = rollFormula('4d6dl1');
        grandTotal = rolls.reduce((sum, r) => sum + r.total, 0);
        const after: [number, number] = [rolls[startI0].total, rolls[startI1].total];

        topTwoRerolls++;
        topTwoRerollHistory.push({
          slots: [startI0, startI1],
          before,
          after,
          afterSum: after[0] + after[1],
          grandTotalAfter: grandTotal,
        });
      }
    }

    const finalValidation = isValidStatRoll({ rolls, grandTotal });

    const rollFields = rolls.map((r, i) => ({
      name: `Roll ${i + 1} — **${r.total}**`,
      value: r.formattedResults,
      inline: false,
    }));

    const historyLines: string[] = [];
    historyLines.push(`Rules: top-2 >= ${MIN_TOP_TWO}, total >= ${MIN_TOTAL}`);
    historyLines.push('');
    historyLines.push('Phase 1 - Full rerolls until sum >= ' + MIN_TOTAL);
    for (let i = 0; i < fullRerollHistory.length; i++) {
      const { totals, grandTotal: gt } = fullRerollHistory[i];
      const totalsStr = totals.map((t) => String(t).padStart(2)).join(', ');
      const status = gt >= MIN_TOTAL ? 'PASS' : 'FAIL';
      const label = i === 0 ? 'Initial ' : `Reroll ${i}`;
      historyLines.push(`  ${label.padEnd(8)} [${totalsStr}]  total=${String(gt).padStart(2)} ${status}`);
    }

    if (fullRerollHistory[fullRerollHistory.length - 1].grandTotal < MIN_TOTAL) {
      historyLines.push(`  Stopped after ${MAX_ATTEMPTS} full rerolls without reaching total >= ${MIN_TOTAL}.`);
    }

    if (fullRerollHistory[fullRerollHistory.length - 1].grandTotal >= MIN_TOTAL) {
      historyLines.push('');
      historyLines.push(`Phase 2 - Reroll top-two until their sum is >= ${MIN_TOP_TWO}`);

      if (phaseTwoStartSnapshot) {
        const initialTopTwoPass = phaseTwoStartSnapshot.topTwoSum >= MIN_TOP_TWO;
        historyLines.push(
          `  Initial  slots ${phaseTwoStartSnapshot.slots[0] + 1} & ${phaseTwoStartSnapshot.slots[1] + 1}: [${phaseTwoStartSnapshot.values[0]}, ${phaseTwoStartSnapshot.values[1]}]  top2=${phaseTwoStartSnapshot.topTwoSum} total=${phaseTwoStartSnapshot.grandTotal} ${initialTopTwoPass ? 'PASS' : 'FAIL'}`
        );
      }

      for (let i = 0; i < topTwoRerollHistory.length; i++) {
        const attempt = topTwoRerollHistory[i];
        const pass = attempt.afterSum >= MIN_TOP_TWO;
        historyLines.push(
          `  Reroll ${i + 1} slots ${attempt.slots[0] + 1} & ${attempt.slots[1] + 1}: [${attempt.before[0]}, ${attempt.before[1]}] -> [${attempt.after[0]}, ${attempt.after[1]}]  top2=${attempt.afterSum} total=${attempt.grandTotalAfter} ${pass ? 'PASS' : 'FAIL'}`
        );
      }

      if (topTwoRerolls >= MAX_ATTEMPTS && finalValidation !== true) {
        historyLines.push(`  Stopped after ${MAX_ATTEMPTS} top-two rerolls before meeting top-two check.`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🎲 Character Stat Rolls')
      .setDescription('Rolling `4d6dl1` x 6')
      .setColor(0x3498db)
      .addFields(rollFields);

    if (historyLines.length > 0) {
      const raw = historyLines.join('\n');
      const date = new Date().toISOString().slice(0, 10);
      const username = interaction.user.username;
      const gistUrl = await postToGist(raw, {
        description: `Stat Roll History — ${username} (${date})`,
        filename: `roll-history-${username}-${date}.txt`,
      });
      let historyValue: string;
      if (gistUrl) {
        historyValue = `[View full roll history](${gistUrl})`;
      } else {
        // Gist unavailable — fall back to truncation
        const MAX_CHARS = 900;
        if (raw.length <= MAX_CHARS) {
          historyValue = `\`\`\`\n${raw}\n\`\`\``;
        } else {
          const head = historyLines.slice(0, 5);
          const tail = historyLines.slice(-3);
          const omitted = historyLines.length - head.length - tail.length;
          const truncated = [...head, `  ... ${omitted} more attempts ...`, ...tail].join('\n');
          historyValue = `\`\`\`\n${truncated}\n\`\`\``;
        }
      }
      embed.addFields({
        name: '📜 Roll History',
        value: historyValue,
        inline: false,
      });
    }

    const [f0, f1] = getTopTwoIndices(rolls);
    const finalTopTwo = rolls[f0].total + rolls[f1].total;
    const statusText =
      finalValidation === true
        ? '✅ Valid roll set'
        : `❌ Invalid (${finalValidation === 'total' ? `total < ${MIN_TOTAL}` : `top-2 < ${MIN_TOP_TWO}`})`;

    embed
      .addFields({
        name: '🎯 Grand Total',
        value: `**${grandTotal}**`,
        inline: true,
      })
      .addFields({
        name: '🏆 Top 2 Total',
        value: `**${finalTopTwo}**`,
        inline: true,
      })
      .addFields({ name: '📌 Result', value: statusText, inline: false })
      .setTimestamp();

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
