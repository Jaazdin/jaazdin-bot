import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Weapon } from '~/db/models/Weapon';
import { createItemEmbed, calculateMetalItemPrice, randomInt, rarityChoices } from '~/helpers';
import { CommandData, Roles } from '~/types';
import { getRandomMetalByRarity } from './generatemetal';

const commandData: CommandData = {
  name: 'generateweapon',
  description: 'Generate a random weapon with a random valid metal by rarity',
  category: 'items',
  requiredRole: [Roles.GM, Roles.DM],
  options: [
    {
      name: 'rarity',
      type: 'string',
      description: 'Rarity of the metal',
      required: true,
      choices: rarityChoices,
    },
  ],
};

async function generateRandomWeaponWithMetalByRarity(rarity: string) {
  const metal = await getRandomMetalByRarity(rarity);
  if (!metal) return null;
  const allWeapons = await Weapon.findAll();
  const validWeapons = allWeapons.filter((weapon) => {
    return !weapon.invalidMetals || !weapon.invalidMetals.includes(metal.name);
  });
  const weapon = validWeapons[Math.floor(Math.random() * validWeapons.length)];
  return { weapon, metal };
}

async function execute(interaction: ChatInputCommandInteraction) {
  const rarity = interaction.options.getString('rarity', true);

  const result = await generateRandomWeaponWithMetalByRarity(rarity);
  if (!result) {
    await interaction.reply({
      content: `No valid weapon/metal combination found for rarity: ${rarity}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { weapon, metal } = result;
  const price = calculateMetalItemPrice(weapon, randomInt(metal.price_min, metal.price_max));

  const embed = createItemEmbed(
    `Random Weapon (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
    `${metal.name} ${weapon.name}`,
    [
      { name: 'Metal', value: metal.name },
      { name: 'Price', value: `${price} gp` },
    ],
    0xaaaaaa
  );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export { execute, commandData, generateRandomWeaponWithMetalByRarity };
