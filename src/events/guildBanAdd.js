const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban, client) {
    const guildId = ban.guild.id;
    
    // Track moderation log
    db.addModLog(guildId, ban.user.id, client.user.id, 'BAN', ban.reason || 'Auto logged ban');

    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');
      if (!events.ban) return;

      const logChannel = ban.guild.channels.cache.get(settings.logging_channel);
      if (logChannel) {
        logChannel.send({
          ...v2(createContainer({
            guildId,
            title: "User Banned",
            description: `**User:** ${ban.user} (${ban.user.tag})\n**ID:** ${ban.user.id}\n**Reason:** ${ban.reason || "No reason provided"}`,
            color: '#ff4757',
            thumbnail: ban.user.displayAvatarURL({ extension: 'png', size: 256 }),
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
