const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'channelCreate',
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
            title: "Channel Created",
            description: `Name: **${channel.name}**\nType: **${channel.type}**\nID: ${channel.id}`,
            color: '#2ed573',
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
