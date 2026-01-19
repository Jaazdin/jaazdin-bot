import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { CommandData } from '~/types';

type FormulaComponent = {
  type: 'dice' | 'operator' | 'flat';
  value: string;
};

type ParsedDieComponent = {
  numDice: string;
  dieSize: string;
  modifiers: RollModifier[];
};

type RollResult = {
  value: number;
  initialRoll?: boolean;
  modifier?: 'drop' | 'explode' | 'update';
};

type RollModifier = {
  type: 'r' | 'rr' | 'k' | 'kh' | 'kl' | 'd' | 'dl' | 'dh' | 'x' | 'xo' | 'min' | 'max';
  value: number;
  comparison: '<' | '<=' | '>' | '>=' | '=';
};

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

const ModifierPriority = ['r', 'rr', 'k', 'kh', 'kl', 'd', 'dl', 'dh', 'x', 'xo', 'min', 'max'];

function splitFormulaComponents(formula: string): FormulaComponent[] {
  const cleanFormula = formula.replace(/\s+/g, '');
  const componentPattern = /(\d*d\d+(?:(?:rr|r|xo|x|kh|kl|k|dl|dh|d|min|max)(?:>=|<=|>|<|=)?\d*)*|[+\-*/()]|\d+)/g;
  const componentMatch = cleanFormula.match(componentPattern);

  if (!componentMatch) {
    throw new Error(`Invalid formula: No valid components found in "${formula}"`);
  }

  const matchedText = componentMatch.join('');
  if (matchedText !== cleanFormula) {
    let invalidStart = 0;
    for (let i = 0; i < cleanFormula.length; i++) {
      if (i >= matchedText.length || cleanFormula[i] !== matchedText[i]) {
        invalidStart = i;
        break;
      }
    }

    const invalidChar = cleanFormula[invalidStart];
    throw new Error(
      `Invalid character "${invalidChar}" at position ${invalidStart + 1} in formula "${formula}"\n` +
        `Valid characters: dice (d20), operators (+, -, *, /, (, )), numbers, and modifiers (r, rr, x, xo, k, kh, kl, d, dl, dh, min, max)`
    );
  }

  const components: FormulaComponent[] = componentMatch.map((component) => {
    if (component.includes('d')) {
      return { type: 'dice', value: component };
    } else if (['+', '-', '*', '/', '(', ')'].includes(component)) {
      return { type: 'operator', value: component };
    } else {
      return { type: 'flat', value: component };
    }
  });

  return components;
}

function parseDiceComponent(component: string): ParsedDieComponent {
  const baseDicePattern = /(\d*)d(\d+)/;
  const baseDiceMatch = baseDicePattern.exec(component);

  if (!baseDiceMatch) {
    throw new Error(`Invalid dice component: ${component}`);
  }

  const numDice = baseDiceMatch[1] || '1';
  const dieSize = baseDiceMatch[2];
  const afterDiceIndex = baseDiceMatch.index! + baseDiceMatch[0].length;
  const modifierSection = component.substring(afterDiceIndex);
  const modifierPattern = /(rr|r|xo|x|kh|kl|k|dl|dh|d|min|max)(>=|<=|>|<|=)?(\d*)/g;
  const modifiers: RollModifier[] = [];

  let modifierMatch;
  while ((modifierMatch = modifierPattern.exec(modifierSection)) !== null) {
    const modifierType = modifierMatch[1] as RollModifier['type'];
    const comparison = modifierMatch[2] as RollModifier['comparison'];
    const valueStr = modifierMatch[3];

    let value: number;
    if (valueStr === '' && ['kh', 'dh', 'kl', 'dl'].includes(modifierType)) {
      value = 1;
    } else if (valueStr === '') {
      throw new Error(`Modifier "${modifierType}" requires a numeric value.`);
    } else {
      value = parseInt(valueStr);
    }

    modifiers.push({
      type: modifierType,
      comparison: comparison,
      value: value,
    });
  }

  return { numDice, dieSize, modifiers };
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function compareValues(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '=':
    case '==':
      return value === threshold;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

function processRerolls(
  rollsArray: RollResult[],
  rerollMods: RollModifier[],
  dieSize: number,
  recursionDepth: number
): void {
  if (rerollMods.length === 0) return;

  const MAX_ITERATIONS = 100;
  const MAX_RECURSION_DEPTH = 10;

  if (recursionDepth > MAX_RECURSION_DEPTH) {
    throw new Error(`Max recursion depth reached for rerolls on d${dieSize}`);
  }

  const mod = rerollMods[0];
  const { comparison, value: threshold } = mod;

  if (isNaN(threshold) || threshold < 1 || threshold > dieSize) {
    throw new Error(`Invalid reroll threshold: ${threshold} for d${dieSize}`);
  }

  let iterations = 0;
  for (let i = 0; i < rollsArray.length && iterations < MAX_ITERATIONS; i++) {
    iterations++;
    const rollValue = rollsArray[i].value;

    if (!compareValues(rollValue, comparison, threshold)) {
      continue;
    }

    const newRoll = rollDie(dieSize);
    rollsArray.splice(i + 1, 0, { value: newRoll });
    rollsArray[i].modifier = 'drop';
    i++; // Move index to account for the newly added roll

    if (mod.type === 'r') {
      break; // Single reroll only
    }

    // Recursive reroll for 'rr' type
    if (compareValues(newRoll, comparison, threshold)) {
      const recursiveRolls = evaluateModifiers([{ value: newRoll }], [mod], dieSize, recursionDepth + 1);
      rollsArray.push(...recursiveRolls);
    }
    break;
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error(`Max iterations reached for rerolls on d${dieSize}`);
  }
}

function processKeepDrop(rollsArray: RollResult[], keepDropMods: RollModifier[]): void {
  if (keepDropMods.length === 0) return;

  const mod = keepDropMods[0];
  const count = mod.value;
  const activeRolls = rollsArray.filter((roll) => roll.modifier !== 'drop');

  if (count >= activeRolls.length) {
    throw new Error(`Keep/Drop count ${count} exceeds number of active rolls ${activeRolls.length}`);
  }

  let sortedRolls: RollResult[];
  let rollsToMark: RollResult[];

  switch (mod.type) {
    case 'k':
    case 'kh':
      // Keep highest - drop the rest
      sortedRolls = [...activeRolls].sort((a, b) => b.value - a.value);
      rollsToMark = sortedRolls.slice(count);
      break;

    case 'kl':
      // Keep lowest - drop the rest
      sortedRolls = [...activeRolls].sort((a, b) => a.value - b.value);
      rollsToMark = sortedRolls.slice(count);
      break;

    case 'd':
    case 'dl':
      // Drop lowest
      sortedRolls = [...activeRolls].sort((a, b) => a.value - b.value);
      rollsToMark = sortedRolls.slice(0, count);
      break;

    case 'dh':
      // Drop highest
      sortedRolls = [...activeRolls].sort((a, b) => b.value - a.value);
      rollsToMark = sortedRolls.slice(0, count);
      break;

    default:
      return;
  }

  // Mark the selected rolls as dropped
  for (const rollToMark of rollsToMark) {
    const index = rollsArray.findIndex((roll) => roll === rollToMark);
    if (index !== -1) {
      rollsArray[index].modifier = 'drop';
    }
  }
}

function processMinMax(rollsArray: RollResult[], minMaxMods: RollModifier[]): void {
  if (minMaxMods.length === 0) return;

  const mod = minMaxMods[0];
  const threshold = mod.value;

  for (let i = 0; i < rollsArray.length; i++) {
    const roll = rollsArray[i];
    if (roll.modifier === 'drop') continue;

    let shouldAddNewRoll = false;
    let newValue = roll.value;

    switch (mod.type) {
      case 'min':
        if (roll.value < threshold) {
          newValue = threshold;
          shouldAddNewRoll = true;
        }
        break;
      case 'max':
        if (roll.value > threshold) {
          newValue = threshold;
          shouldAddNewRoll = true;
        }
        break;
    }

    if (shouldAddNewRoll) {
      // Mark the original roll as updated
      roll.modifier = 'update';

      // Add the new roll directly after the original
      rollsArray.splice(i + 1, 0, { value: newValue });

      // Skip the newly added roll in the next iteration
      i++;
    }
  }
}

function processExplodes(
  rollsArray: RollResult[],
  explodeMods: RollModifier[],
  dieSize: number,
  recursionDepth: number
): void {
  if (explodeMods.length === 0) return;

  const MAX_ITERATIONS = 100;
  const MAX_RECURSION_DEPTH = 10;

  if (recursionDepth > MAX_RECURSION_DEPTH) {
    throw new Error(`Max recursion depth reached for explodes on d${dieSize}`);
  }

  const mod = explodeMods[0];
  const { comparison, value: threshold } = mod;

  let iterations = 0;
  for (let i = 0; i < rollsArray.length && iterations < MAX_ITERATIONS; i++) {
    iterations++;
    const roll = rollsArray[i];

    if (roll.modifier === 'drop') continue;
    if (!compareValues(roll.value, comparison, threshold)) continue;

    // Mark the original roll as exploded
    roll.modifier = 'explode';

    if (mod.type === 'xo') {
      // Explode once only - add one new roll and stop
      const newRoll = rollDie(dieSize);
      rollsArray.splice(i + 1, 0, { value: newRoll });
      i++; // Move index to account for the newly added roll
      continue;
    }

    // For 'x' type - handle explosion chain iteratively
    let currentRoll = roll.value;
    let explosionCount = 0;
    const MAX_EXPLOSIONS = 20; // Prevent infinite explosion chains

    while (compareValues(currentRoll, comparison, threshold) && explosionCount < MAX_EXPLOSIONS) {
      const newRoll = rollDie(dieSize);
      rollsArray.splice(i + 1, 0, { value: newRoll });
      i++; // Move index to account for the newly added roll
      currentRoll = newRoll;
      explosionCount++;

      // If the new roll also explodes, mark it as exploded
      if (compareValues(newRoll, comparison, threshold)) {
        rollsArray[i].modifier = 'explode';
      }
    }

    if (explosionCount >= MAX_EXPLOSIONS) {
      throw new Error(`Max explosion chain reached for d${dieSize}`);
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error(`Max iterations reached for explodes on d${dieSize}`);
  }
}

function evaluateModifiers(
  rollsArray: RollResult[],
  modifiers: RollModifier[],
  dieSize: number,
  recursionDepth: number = 0
): RollResult[] {
  // Group modifiers by type for cleaner processing
  const rerollMods = modifiers.filter((mod) => ['r', 'rr'].includes(mod.type));
  const keepDropMods = modifiers.filter((mod) => ['k', 'kh', 'kl', 'd', 'dl', 'dh'].includes(mod.type));
  const minMaxMods = modifiers.filter((mod) => ['min', 'max'].includes(mod.type));
  const explodeMods = modifiers.filter((mod) => ['x', 'xo'].includes(mod.type));

  // Process modifiers in order
  processRerolls(rollsArray, rerollMods, dieSize, recursionDepth);
  processKeepDrop(rollsArray, keepDropMods);
  processMinMax(rollsArray, minMaxMods);
  processExplodes(rollsArray, explodeMods, dieSize, recursionDepth);

  return rollsArray;
}

function validateModifiers(modifiers: RollModifier[], dieSize: number) {
  const modifierGroups = {
    keepDrop: modifiers.filter((mod) => ['k', 'kh', 'kl', 'd', 'dl', 'dh'].includes(mod.type)),
    minMax: modifiers.filter((mod) => ['min', 'max'].includes(mod.type)),
    reroll: modifiers.filter((mod) => ['r', 'rr'].includes(mod.type)),
    explode: modifiers.filter((mod) => ['x', 'xo'].includes(mod.type)),
  };

  // Check for conflicting modifiers
  Object.entries(modifierGroups).forEach(([groupName, group]) => {
    if (group.length > 1) {
      const conflictingTypes = group.map((mod) => mod.type).join(', ');
      throw new Error(`Conflicting ${groupName} modifiers: ${conflictingTypes}. Only one per group is allowed.`);
    }
  });

  // Validate modifier values
  for (const mod of modifiers) {
    const { type, value } = mod;

    if (['r', 'rr'].includes(type)) {
      if (isNaN(value) || value < 1 || value > dieSize) {
        throw new Error(`Invalid reroll threshold: ${value} for d${dieSize}`);
      }
      if (!mod.comparison) {
        mod.comparison = '='; // Default comparison for rerolls
      }
    }

    if (['k', 'kh', 'kl', 'd', 'dl', 'dh'].includes(type) && (isNaN(value) || value < 1)) {
      mod.value = 1; // Default to 1 if invalid
    }

    if (['min', 'max'].includes(type)) {
      if (isNaN(value) || value < 1 || value > dieSize) {
        throw new Error(`Invalid ${type} value: ${value} for d${dieSize}`);
      }
      if (!mod.comparison) {
        mod.comparison = '='; // Default comparison for min/max
      }
    }

    if (['x', 'xo'].includes(type)) {
      if (isNaN(value) || value < 1 || value > dieSize) {
        throw new Error(`Invalid explode threshold: ${value} for d${dieSize}`);
      }
      if (!mod.comparison) {
        mod.comparison = '='; // Default comparison for explode
      }
    }
  }
}

function evaluateDiceComponent(component: string): RollResult[] {
  const parsed = parseDiceComponent(component);
  if (!parsed) {
    throw new Error(`Failed to parse dice component: ${component}`);
  }

  const { numDice, dieSize, modifiers } = parsed;
  const dieSizeNum = parseInt(dieSize);
  const numDiceInt = parseInt(numDice);

  // Validation
  if (isNaN(dieSizeNum) || dieSizeNum <= 0) {
    throw new Error(`Invalid die size: d${dieSize}`);
  }
  if (dieSizeNum > 1000) {
    throw new Error(`Die size too large: d${dieSize}. Maximum allowed is d1000.`);
  }
  if (isNaN(numDiceInt) || numDiceInt <= 0) {
    throw new Error(`Invalid number of dice: ${numDice}`);
  }

  validateModifiers(modifiers, dieSizeNum);

  // Sort modifiers by priority
  modifiers.sort((a, b) => ModifierPriority.indexOf(a.type) - ModifierPriority.indexOf(b.type));

  // Generate initial rolls
  const rolls: RollResult[] = [];
  for (let i = 0; i < numDiceInt; i++) {
    rolls.push({ value: rollDie(dieSizeNum), initialRoll: true });
  }

  // Apply modifiers and return results
  return evaluateModifiers(rolls, modifiers, dieSizeNum);
}

function formatRollResults(results: RollResult[], diceComponent: string): string {
  const formattedRolls: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const roll = results[i];
    const value = roll.value.toString();

    if (roll.modifier === 'drop') {
      formattedRolls.push(`~~${value}~~`); // Strikethrough for dropped rolls
    } else if (roll.modifier === 'explode') {
      // Collect all explosions that follow this exploded roll
      const explosionChain = [value];
      let j = i + 1;

      // Look ahead to collect all consecutive explosion results
      while (j < results.length) {
        const nextRoll = results[j];
        // Check if this is a roll that resulted from the explosion
        if (!nextRoll.modifier || nextRoll.modifier === 'explode') {
          explosionChain.push(nextRoll.value.toString());
          j++;
          // If this roll also exploded, continue the chain
          if (nextRoll.modifier === 'explode') {
            continue;
          } else {
            // This was the final roll in the explosion chain
            break;
          }
        } else {
          break;
        }
      }

      // Format the explosion chain: **BASE** + **explosion1** + **explosion2** + ... + finalRoll
      const formattedChain: string[] = [];

      for (let k = 0; k < explosionChain.length; k++) {
        const rollValue = explosionChain[k];
        if (k === explosionChain.length - 1) {
          // Final roll in chain - not bold
          formattedChain.push(rollValue);
        } else {
          // All exploded rolls should be bold
          formattedChain.push(`**${rollValue}**`);
        }
      }

      formattedRolls.push(formattedChain.join(' + '));

      // Skip all the rolls we've already processed
      i = j - 1;
    } else if (roll.modifier === 'update') {
      // Look ahead to get the next roll's value
      const nextRoll = i + 1 < results.length ? results[i + 1] : null;
      const nextValue = nextRoll ? nextRoll.value.toString() : '?';
      formattedRolls.push(`~~${value}~~ → ${nextValue}`);
      i++; // Skip the next roll since we've already processed it
    } else {
      formattedRolls.push(value); // Normal roll
    }
  }

  return `${diceComponent}: [${formattedRolls.join(', ')}]`;
}

function formatAllComponents(
  parsedComponents: Array<RollResult | FormulaComponent>,
  originalComponents: FormulaComponent[]
): string {
  let result = '';
  let rollIndex = 0;

  for (const comp of originalComponents) {
    if (comp.type === 'dice') {
      // Find all RollResults that belong to this dice component
      const diceRolls: RollResult[] = [];

      // Count how many dice this component should have produced
      const parsed = parseDiceComponent(comp.value);
      const numDice = parseInt(parsed.numDice);

      // Extract the rolls for this dice component
      while (rollIndex < parsedComponents.length && diceRolls.length < numDice) {
        const item = parsedComponents[rollIndex];
        if ('value' in item && typeof item.value === 'number') {
          diceRolls.push(item as RollResult);
        }
        rollIndex++;
      }

      // Add any exploded rolls that belong to this component
      while (rollIndex < parsedComponents.length) {
        const item = parsedComponents[rollIndex];
        if ('value' in item && typeof item.value === 'number' && !('type' in item)) {
          diceRolls.push(item as RollResult);
          rollIndex++;
        } else {
          break;
        }
      }

      result += formatRollResults(diceRolls, comp.value);
    } else {
      result += ` ${comp.value} `;
    }
  }

  return result.trim();
}

function calculateDiceTotal(results: RollResult[]): number {
  return results
    .filter((roll) => roll.modifier !== 'drop' && roll.modifier !== 'update')
    .reduce((sum, roll) => sum + roll.value, 0);
}

function evaluateFormula(parsedComponents: Array<RollResult | FormulaComponent>): number {
  // Convert the mixed array into a mathematical expression
  const expressionParts: string[] = [];
  let i = 0;

  while (i < parsedComponents.length) {
    const component = parsedComponents[i];

    if ('type' in component) {
      // This is a FormulaComponent
      if (component.type === 'operator' || component.type === 'flat') {
        expressionParts.push(component.value);
      }
      i++;
    } else {
      // This is a RollResult - collect all consecutive RollResults as one dice group
      const diceGroup: RollResult[] = [];

      while (i < parsedComponents.length) {
        const item = parsedComponents[i];
        if ('value' in item && typeof item.value === 'number' && !('type' in item)) {
          diceGroup.push(item as RollResult);
          i++;
        } else {
          break;
        }
      }

      // Calculate the total for this dice group
      const diceTotal = calculateDiceTotal(diceGroup);
      expressionParts.push(diceTotal.toString());
    }
  }

  // Join the expression and evaluate it safely
  const expression = expressionParts.join(' ');
  return evaluateExpression(expression);
}

function evaluateExpression(expression: string): number {
  // Simple and safe expression evaluator
  // Only allows numbers, +, -, *, /, (, )
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

  if (sanitized !== expression) {
    throw new Error(`Invalid characters in expression: ${expression}`);
  }

  try {
    // Use Function constructor for safe evaluation (no access to scope)
    const result = new Function(`"use strict"; return (${sanitized})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error(`Expression evaluation resulted in invalid number: ${result}`);
    }

    return Math.round(result * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    throw new Error(
      `Failed to evaluate expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function execute(interaction: ChatInputCommandInteraction) {
  const formula = interaction.options.getString('formula', true).toLowerCase();

  if (!/^[1-9]\d*|d/.test(formula)) {
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
    const components = splitFormulaComponents(formula);
    const parsedComponents: Array<RollResult | FormulaComponent> = [];

    for (const comp of components) {
      if (comp.type === 'dice') {
        const results = evaluateDiceComponent(comp.value);
        parsedComponents.push(...results);
      } else {
        parsedComponents.push(comp);
      }
    }

    // Calculate the final total
    const total = evaluateFormula(parsedComponents);

    // Format the roll results
    const formattedResults = formatAllComponents(parsedComponents, components);

    // Determine embed color based on result
    let color = 0x3498db; // Default blue
    if (total >= 20) {
      color = 0x2ecc71; // Green for high rolls
    } else if (total <= 5) {
      color = 0xe74c3c; // Red for low rolls
    } else if (total >= 15) {
      color = 0xf39c12; // Orange for good rolls
    }

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
