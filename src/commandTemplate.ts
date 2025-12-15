import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

import { CommandData, Roles } from '~/types';

const commandData: CommandData = {
  name: '',
  alias: '', // Optional, can also be an array of strings
  description: '',
  category: '',
  requiredRole: Roles.GM, // Optional, remove if not needed. Can also be an array of Roles
  options: [
    // Define command options here. If none, remove options property.
  ],
};

async function execute(interaction: ChatInputCommandInteraction) {
  // Command execution logic here
}

// Remove if not needed
async function autocomplete(interaction: AutocompleteInteraction) {
  // Autocomplete logic here
}

// Other exports can be exported here rather then inline
export { execute, autocomplete, commandData };
