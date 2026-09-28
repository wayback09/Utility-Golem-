const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    if (!channel.guild) return;

    const guildId = channel.guild.id;
    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');
      if (!events.channelChange) return;

      const logChannel = channel.guild.channels.cache.get(settings.logging_channel);
      if (logChannel) {
        logChannel.send({
          ...v2(createContainer({
            guildId,
            title: "Channel Deleted",
            description: `Name: **${channel.name}**\nID: ${channel.id}`,
            color: '#ff4757',
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
