const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

// Store participants in memory or within the giveaway object
function addParticipant(messageId, userId) {
  const giveaway = db.getGiveaway(messageId);
  if (!giveaway) return false;

  let participants = [];
  try {
    participants = JSON.parse(giveaway.requirements || '[]'); // Use requirements field or serialize dynamically
  } catch (e) {}

  if (participants.includes(userId)) {
    // Remove if already entered (toggle)
    participants = participants.filter(id => id !== userId);
    giveaway.requirements = JSON.stringify(participants);
    db.saveGiveaway(giveaway);
    return 'removed';
  }

  participants.push(userId);
  giveaway.requirements = JSON.stringify(participants);
  db.saveGiveaway(giveaway);
  return 'added';
}

async function endGiveaway(client, giveaway) {
  const guild = client.guilds.cache.get(giveaway.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(giveaway.channel_id);
  if (!channel) return;

  try {
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    
    let participants = [];
    try {
      participants = JSON.parse(giveaway.requirements || '[]');
    } catch (e) {}

    const winners = [];
    const count = Math.min(giveaway.winner_count, participants.length);

    // Roll winners
    if (participants.length > 0) {
      const pool = [...participants];
      for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(index, 1)[0]);
      }
    }

    giveaway.ended = 1;
    giveaway.winners = JSON.stringify(winners);
    db.saveGiveaway(giveaway);

    if (message) {
      await message.edit({
        ...v2(createContainer({
          title: `🎁 GIVEAWAY ENDED: ${giveaway.prize}`,
          description: `**Winners:** ${winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'No participants.'}\n**Hosted By:** <@${giveaway.host_id}>`,
          color: '#ff4757',
          footer: false
        }))
      }).catch(() => {});
    }

    if (winners.length > 0) {
      channel.send(`🎉 Congratulations to the winner(s) of **${giveaway.prize}**: ${winners.map(w => `<@${w}>`).join(', ')}!`);
    } else {
      channel.send(`😭 Nobody entered the giveaway for **${giveaway.prize}**.`);
    }
  } catch (err) {
    logger.error(`Error ending giveaway ${giveaway.message_id}: ${err.message}`);
  }
}

async function rerollGiveaway(client, giveaway) {
  const guild = client.guilds.cache.get(giveaway.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(giveaway.channel_id);
  if (!channel) return;

  let participants = [];
  try {
    participants = JSON.parse(giveaway.requirements || '[]');
  } catch (e) {}

  const winners = [];
  const count = Math.min(giveaway.winner_count, participants.length);

  if (participants.length > 0) {
    const pool = [...participants];
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(index, 1)[0]);
    }
  }

  giveaway.winners = JSON.stringify(winners);
  db.saveGiveaway(giveaway);

  if (winners.length > 0) {
    channel.send(`🎉 **REROLL:** Congratulations to the new winners of **${giveaway.prize}**: ${winners.map(w => `<@${w}>`).join(', ')}!`);
  } else {
    channel.send(`😭 Reroll failed. No participants found.`);
  }
}

// Start interval checks (runs every 15 seconds)
function startScheduler(client) {
  setInterval(async () => {
    const active = db.getActiveGiveaways();
    const now = Date.now();
    for (const g of active) {
      if (now >= g.end_time) {
        await endGiveaway(client, g);
      }
    }
  }, 15000);
}

module.exports = {
  addParticipant,
  endGiveaway,
  rerollGiveaway,
  startScheduler
};
