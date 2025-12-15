import { AutocompleteInteraction, ChatInputCommandInteraction, Colors, EmbedBuilder, MessageFlags } from 'discord.js';
import { checkUserRole, getCommandFiles } from '~/helpers';
import { Roles, CommandData, CommandFile } from '~/types';

const commandData: CommandData = {
  name: 'help',
  description: 'Get information about commands',
  category: 'utility',
  options: [
    {
      name: 'command',
      type: 'string',
      description: 'The command to get help for',
      autocomplete: true,
    },
  ],
};

const commands: CommandData[] = [];

const categoryEmojis: { [key: string]: string } = {
  boats: '🚢',
  items: '🎲',
  religion: '⛪',
  farming: '🌱',
  fun: '🎭',
  jobs: '💰',
  timer: '⏰',
  utility: '🛠️',
  announcement: '📢',
};

async function getCommandData(): Promise<CommandData[]> {
  const commandsData: CommandData[] = [];
  const commandFiles = await getCommandFiles();

  for (const filePath of commandFiles) {
    try {
      const command = (await import(filePath)) as CommandFile;

      if (!command) {
        console.log(`[WARNING] The command at ${filePath} does not export a valid command.`);
        continue;
      }
      if (!command.commandData) {
        console.log(`[WARNING] The command at ${filePath} is missing a required "commandData" property.`);
        continue;
      }

      commandsData.push(command.commandData);
    } catch (error) {
      console.error(`Error loading command from ${filePath}:`, error);
    }
  }
  return commandsData;
}

function getUserRoles(interaction: ChatInputCommandInteraction | AutocompleteInteraction): Roles[] {
  const userRoles: Roles[] = [];

  // Check each role
  if (checkUserRole(interaction, Roles.BOT_DEV)) userRoles.push(Roles.BOT_DEV);
  if (checkUserRole(interaction, Roles.GM)) userRoles.push(Roles.GM);
  if (checkUserRole(interaction, Roles.DM)) userRoles.push(Roles.DM);
  if (checkUserRole(interaction, Roles.PLAYER)) userRoles.push(Roles.PLAYER);

  return userRoles;
}

function canUseCommand(command: CommandData, userRoles: Roles[]): boolean {
  if (Array.isArray(command.requiredRole)) {
    return command.requiredRole.some((role) => userRoles.includes(role));
  }

  return command.requiredRole ? userRoles.includes(command.requiredRole) : true;
}

async function autocomplete(interaction: AutocompleteInteraction) {
  let focusedValue = interaction.options.getFocused();
  if (commands.length == 0) {
    // await loadCommands();
    const commandsData = await getCommandData();
    commands.push(...commandsData);
  }
  if (focusedValue.startsWith('/')) {
    // Remove leading slash for matching
    focusedValue = focusedValue.slice(1);
  }
  const userRoles = getUserRoles(interaction);
  const userCommands = commands.filter((cmd) => canUseCommand(cmd, userRoles) /*&& cmd.args*/);
  const filtered = userCommands.filter((cmd) => cmd.name.startsWith(focusedValue));
  await interaction.respond(filtered.map((cmd) => ({ name: `/${cmd.name}`, value: cmd.name })).slice(0, 25));
}

async function executeSubhelp(interaction: ChatInputCommandInteraction, command: string) {
  const userCommands = commands.filter((cmd) => canUseCommand(cmd, getUserRoles(interaction)));
  if (userCommands.length === 0) {
    await interaction.reply({
      content: '❌ No commands are available for your current role.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const commandData = userCommands.find((cmd) => cmd.name === command);
  if (!commandData) {
    await interaction.reply({ content: `❌ Command \`${command}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  let optionsString = (commandData.options || [])
    .map((option) => {
      return `\`${option.name}\` (${option.type})${option.required ? ' [required]' : ''}${option.description ? ` - ${option.description}` : ''}`;
    })
    .join('\n');
  if (optionsString === '') {
    optionsString = 'No options available for this command.';
  }

  const embed = new EmbedBuilder()
    .setTitle(`🤖 Help: /${commandData.name}`)
    .setColor(Colors.Gold)
    .setDescription(commandData.description);

  // Handle options that might exceed field limit
  if (optionsString.length > 1024) {
    const options = commandData.options || [];
    let currentField = '';
    let fieldCount = 1;
    const embeds = [embed];

    for (const option of options) {
      const optionLine = `\`${option.name}\` (${option.type})${option.required ? ' [required]' : ''}${option.description ? ` - ${option.description}` : ''}\n`;

      if (currentField.length + optionLine.length > 1024) {
        // Add current field to current embed
        embeds[embeds.length - 1].addFields({
          name: `Options ${fieldCount > 1 ? `(${fieldCount})` : ''}`,
          value: currentField,
        });

        // Create new embed if we have more options
        if (options.indexOf(option) < options.length - 1) {
          const newEmbed = new EmbedBuilder()
            .setTitle(`🤖 Help: /${commandData.name} (continued)`)
            .setColor(Colors.Gold);
          embeds.push(newEmbed);
        }

        currentField = optionLine;
        fieldCount++;
      } else {
        currentField += optionLine;
      }
    }

    // Add the last field
    if (currentField.trim()) {
      embeds[embeds.length - 1].addFields({
        name: `Options ${fieldCount > 1 ? `(continued)` : ''}`,
        value: currentField,
      });
    }

    await interaction.reply({ embeds: embeds, flags: MessageFlags.Ephemeral });
  } else {
    embed.addFields({ name: 'Options', value: optionsString });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function execute(interaction: ChatInputCommandInteraction) {
  if (commands.length == 0) {
    // await loadCommands();
    const commandsData = await getCommandData();
    commands.push(...commandsData);
  }
  const command = interaction.options.getString('command');
  if (command) {
    await executeSubhelp(interaction, command);
    return;
  }

  const userCommands = commands.filter((cmd) => canUseCommand(cmd, getUserRoles(interaction)));
  if (userCommands.length === 0) {
    await interaction.reply({
      content: '❌ No commands are available for your current role.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Group commands by category
  const commandsByCategory: { [key: string]: CommandData[] } = {};
  userCommands.forEach((cmd) => {
    if (!commandsByCategory[cmd.category]) {
      commandsByCategory[cmd.category] = [];
    }
    commandsByCategory[cmd.category].push(cmd);
  });

  const embeds: EmbedBuilder[] = [];
  let currentEmbed = new EmbedBuilder()
    .setTitle('🤖 Jaazdin Bot Commands')
    .setColor(Colors.Gold)
    .setDescription(`Here are all **${userCommands.length}** commands you can use:`);

  // Process each category
  for (const [category, cmds] of Object.entries(commandsByCategory)) {
    const commandList = cmds
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cmd) => {
        const aliases = cmd.alias 
          ? `, ${Array.isArray(cmd.alias) ? cmd.alias.map(a => `/${a}`).join(', ') : `/${cmd.alias}`}` 
          : '';
        const cmdLine = `\`/${cmd.name}${aliases}\` - ${cmd.description}`;
        return cmdLine;
      })
      .join('\n');

    const fieldName = `${categoryEmojis[category]} ${category.charAt(0).toUpperCase() + category.slice(1)} (${cmds.length})`;

    // Check if adding this field would exceed limits
    const currentFields = currentEmbed.data.fields || [];
    if (currentFields.length >= 25 || commandList.length > 1024) {
      // Start a new embed
      embeds.push(currentEmbed);
      currentEmbed = new EmbedBuilder().setTitle('🤖 Jaazdin Bot Commands (continued)').setColor(Colors.Gold);
    }

    // If a single category exceeds field limit, split it
    if (commandList.length > 1024) {
      let currentFieldValue = '';
      let partNumber = 1;

      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const aliases = cmd.alias 
          ? `, ${Array.isArray(cmd.alias) ? cmd.alias.map(a => `/${a}`).join(', ') : `/${cmd.alias}`}` 
          : '';
        const cmdLine = `\`/${cmd.name}${aliases}\` - ${cmd.description}`;

        if (currentFieldValue.length + cmdLine.length > 1024) {
          currentEmbed.addFields({
            name: `${fieldName} ${partNumber > 1 ? `(Part ${partNumber})` : ''}`,
            value: currentFieldValue,
            inline: false,
          });

          if (cmds.indexOf(cmd) < cmds.length - 1) {
            embeds.push(currentEmbed);
            currentEmbed = new EmbedBuilder().setTitle('🤖 Jaazdin Bot Commands (continued)').setColor(Colors.Gold);
          }

          currentFieldValue = cmdLine;
          partNumber++;
        } else {
          currentFieldValue += cmdLine;
        }
      }

      if (currentFieldValue.trim()) {
        currentEmbed.addFields({
          name: `${fieldName} ${partNumber > 1 ? `(Part ${partNumber})` : ''}`,
          value: currentFieldValue,
          inline: false,
        });
      }
    } else {
      currentEmbed.addFields({
        name: fieldName,
        value: commandList,
        inline: false,
      });
    }
  }

  // Add the last embed if it has content
  if ((currentEmbed.data.fields && currentEmbed.data.fields.length > 0) || embeds.length === 0) {
    embeds.push(currentEmbed);
  }

  // Add footer to the last embed
  embeds[embeds.length - 1].setFooter({
    text: `Total commands available: ${userCommands.length}`,
  });

  await interaction.reply({ embeds: embeds, flags: MessageFlags.Ephemeral });
}

export { execute, commandData, autocomplete };
