import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Religion } from '~/db/models/Religion';
import { formatNames, replyWithUserMention } from '~/helpers';
import { showReligion } from './showReligion';
import { CommandData } from '~/types';

const commandData: CommandData = {
  name: 'showallreligions',
  description: 'Shows all active religions',
  category: 'religion',
};

async function execute(interaction: ChatInputCommandInteraction) {
  const allMessages = await showAllReligions();
  await replyWithUserMention(interaction, allMessages, true);
}

async function showAllReligions(): Promise<EmbedBuilder[]> {
  const religions = await Religion.findAll({
    order: [['follower_count', 'DESC']],
  });
  const embeds: EmbedBuilder[] = [];
  if (religions.length === 0) {
    // 🪦 Tombstone emoji for no religions
    embeds.push(
      new EmbedBuilder().setTitle('🪦 Gods are Dead').setDescription('No religions found.').setColor('#000000')
    );
  } else {
    // 👑 Crown emoji for dominant religion
    const dominantReligion = religions[0];
    const dominantEmbed = await showReligion(dominantReligion);
    dominantEmbed.setTitle(`👑 ${dominantEmbed.data.title || ''}`);
    embeds.push(dominantEmbed);

    // Other religions as fields, handling Discord's 25-field limit per embed
    if (religions.length > 1) {
      const otherReligions = religions.slice(1);
      const fields = otherReligions.map((religion) => ({
        name: `${formatNames(religion.dataValues.name)}`,
        value: `${religion.dataValues.follower_count} followers`,
        inline: false,
      }));

      // Discord allows max 25 fields per embed
      for (let i = 0; i < fields.length; i += 25) {
        const listEmbed = new EmbedBuilder()
          .setTitle(
            i === 0 ? '🙏 Other Religions' : `🙏 Other Religions (cont. ${i + 1}-${Math.min(i + 25, fields.length)})`
          )
          .setColor('#00BFFF')
          .addFields(fields.slice(i, i + 25));
        embeds.push(listEmbed);
      }
    }
  }
  return embeds;
}

export { execute, commandData, showAllReligions };
