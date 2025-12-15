// src/index.ts
import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  MessageFlags,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import dotenv from 'dotenv';
import { CommandFile, CommandData } from './types';
import setupWeeklyTasks from './weeklies/weekly';
import { db } from './db/db'; // Import your Sequelize instance
import { buildCommand, checkUserRole, getCommandFiles, setupModalInteractionHandler } from './helpers';

interface ClientCommandData {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
  commandData: CommandData;
}

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, ClientCommandData>;
  }
}

// Load environment variables from .env file
dotenv.config();
const token = process.env.DISCORD_TOKEN;

// New Client Instance
export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) {
      console.error(`No autocomplete handler found for command ${interaction.commandName}`);
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
      const errorMessage = {
        content: 'There was an error while executing this command!',
        MessageFlags: MessageFlags.Ephemeral,
      };
      await interaction.respond([{ name: errorMessage.content, value: 'error' }]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (command.commandData.requiredRole && !checkUserRole(interaction, command.commandData.requiredRole)) {
      await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorMessage = {
      content: 'There was an error while executing this command!',
      MessageFlags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(
    `Ready! Logged in as ${readyClient.user.tag} in ${process.env.NODE_ENV == 'production' ? 'production' : 'development'} mode`
  );
  setupWeeklyTasks();
});

async function loadCommands() {
  client.commands = new Collection<string, ClientCommandData>();
  const commandFiles = await getCommandFiles();
  for (const file of commandFiles) {
    if (file.endsWith('-bak.ts')) continue; // Skip backup files
    const fileUrl = new URL(`file://${file}`).href;
    const { execute, autocomplete, commandData } = (await import(fileUrl)) as CommandFile;
    if (!execute) {
      console.log(`[WARNING] The command at ${file} is missing a required "execute" function.`);
      continue;
    }
    const dataArray = buildCommand(commandData);
    for (const data of dataArray) {
      client.commands.set(data.name, { execute, autocomplete, commandData });
    }
  }
}

// Wrap startup in an async function
async function startBot() {
  try {
    await db.authenticate(); // Wait for DB connection
    console.log('Database connection established successfully.');
    await loadCommands();
    await client.login(token); // Only login after DB is ready
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1); // Exit if DB connection fails
  }
}

setupModalInteractionHandler(client);

startBot();
