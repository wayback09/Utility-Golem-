const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (message.author?.bot || !message.guild) return;

    const guildId = message.guild.id;
    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');
      if (!events.messageDelete) return;

      const logChannel = message.guild.channels.cache.get(settings.logging_channel);
      if (logChannel) {
        logChannel.send({
          ...v2(createContainer({
            guildId,
            title: "Message Deleted",
            description: `**Author:** ${message.author} (${message.author.id})\n**Channel:** ${message.channel}\n\n**Content:**\n${message.content || "*No text content (likely an embed or attachment)*"}`,
            color: '#ff4757',
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
