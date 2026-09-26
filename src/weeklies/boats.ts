import { Op } from 'sequelize';
import { Boat, Shipment } from '~/db/models/Boat';
import { TextChannel } from 'discord.js';
import { client } from '~/index';
// Import helper functions from boatHelpers
import { buildBoatPostEmbeds, generateShipmentItems } from '~/helpers';
import { createBoatEmbed } from '~/commands/boat/showboats';

async function update() {
  // 1. Advance all running boats by 1 week
  await Boat.update(
    {
      weeksLeft: (Boat.sequelize as import('sequelize').Sequelize).literal('weeks_left - 1'),
    },
    { where: { isRunning: true } }
  );

  // 2. Update boats that reached 0 weeks
  const boatsToUpdate = await Boat.findAll({
    where: {
      isRunning: true,
      weeksLeft: { [Op.lte]: 0 },
    },
  });

  for (const boat of boatsToUpdate) {
    if (boat.isInTown) {
      // Boat is leaving town
      if (boat.isTier2) {
        boat.weeksLeft = boat.waitTime - 1;
      } else {
        boat.weeksLeft = boat.waitTime;
      }
      boat.isInTown = false;
      await boat.save();

      // Remove all shipments for this boat
      await Shipment.destroy({ where: { boatId: boat.id } });
    } else {
      // Boat is arriving in town
      if (boat.isTier2) {
        boat.weeksLeft = boat.timeInTown + 1;
      } else {
        boat.weeksLeft = boat.timeInTown;
      }
      boat.isInTown = true;
      await boat.save();

      // Generate shipment if needed
      if (boat.tableToGenerate && boat.tableToGenerate !== 'NA') {
        // Remove any old shipments for this boat (just in case)
        await Shipment.destroy({ where: { boatId: boat.id } });

        const goods = await generateShipmentItems(boat);
        // Insert each item as a row in the Shipment table
        for (const item of goods) {
          await Shipment.create({
            boatId: boat.id,
            itemName: item.itemName,
            price: item.price,
            quantity: item.quantity,
            type: item.type,
          });
        }
      }
    }
  }
}

async function post() {
  const CHANNEL_ID = process.env.BOT_CHANNEL_ID;
  if (!CHANNEL_ID) {
    console.error('BOT_CHANNEL_ID is not defined');
    return;
  }
  if (!client.isReady()) {
    console.warn('Discord client not ready.');
    return;
  }

  const runningBoats = await Boat.findAll({
    where: { isRunning: true },
    order: [['weeksLeft', 'ASC']],
  });
  if (runningBoats.length === 0) {
    return;
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel instanceof TextChannel) {
      // Forget last week's messages so edits only ever target this week's post
      await Boat.update({ messageId: null }, { where: { messageId: { [Op.ne]: null } } });

      // Each boat in town gets its own message so updateBoatEmbed can edit it later
      for (const boat of runningBoats.filter((b) => b.isInTown)) {
        const message = await channel.send({ embeds: await buildBoatPostEmbeds(boat) });
        boat.messageId = message.id;
        await boat.save();
      }

      // Boats at sea share one summary message
      const atSeaEmbeds = await createBoatEmbed(runningBoats.filter((b) => !b.isInTown));
      if (atSeaEmbeds.length > 0) {
        await channel.send({ embeds: atSeaEmbeds });
      }
      console.log('Boat update sent to Discord.');
    } else {
      console.warn('Target channel is not a text channel.');
    }
  } catch (error) {
    console.error('Failed to send boat update:', error);
  }
}

const order = 2;

export { update, post, order };
