import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { buildCommand, getCommandFiles } from './commandHelpers';
import dotenv from 'dotenv';
import { CommandFile } from '~/types';

dotenv.config();

async function deployCommands() {
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  const token = process.env.DISCORD_TOKEN;

  if (!clientId) throw new Error('Missing CLIENT_ID in environment variables');
  if (!guildId) throw new Error('Missing GUILD_ID in environment variables');
  if (!token) throw new Error('Missing DISCORD_TOKEN in environment variables');

  const commandFiles = await getCommandFiles();
  const commandPromises = commandFiles.map(async (filePath) => {
    const command = (await import(filePath)) as CommandFile;

    if (!command) {
      console.log(`[WARNING] The command at ${filePath} does not export a valid command.`);
      return [];
    }
    if (!command.execute) {
      console.log(`[WARNING] The command at ${filePath} is missing a required "execute" function.`);
      return [];
    }
    if (!command.commandData) {
      console.log(`[WARNING] The command at ${filePath} is missing a required "commandData" property.`);
      return [];
    }
    const commandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    // Now push the main command
    // commandsToRegister.push(command.data.toJSON());
    const data = buildCommand(command.commandData);
    for (const cmd of data) {
      commandsToRegister.push(cmd.toJSON());
    }
    return commandsToRegister;
  });

  const commandArrays = await Promise.all(commandPromises);
  const builtCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = commandArrays.flat();

  const rest = new REST().setToken(token);

  console.log(`Started refreshing ${builtCommands.length} application (/) commands.`);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: builtCommands,
  });

  console.log(`Successfully reloaded ${builtCommands.length} application (/) commands.`);
}

try {
  await deployCommands();
} catch (error) {
  console.error('Error deploying commands:', error);
}
