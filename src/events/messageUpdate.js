const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (oldMessage.author?.bot || !oldMessage.guild) return;
    if (oldMessage.content === newMessage.content) return; // Ignore pin updates or embed updates

    const guildId = oldMessage.guild.id;
    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');
      if (!events.messageEdit) return;

      const logChannel = oldMessage.guild.channels.cache.get(settings.logging_channel);
      if (logChannel) {
        logChannel.send({
          ...v2(createContainer({
            guildId,
            title: "Message Edited",
            description: `**Author:** ${oldMessage.author} (${oldMessage.author.id})\n**Channel:** ${oldMessage.channel}\n[Jump to Message](${newMessage.url})`,
            fields: [
              { name: "Before", value: (oldMessage.content || "*No content*").slice(0, 1000) },
              { name: "After", value: (newMessage.content || "*No content*").slice(0, 1000) }
            ],
            color: '#ffa502',
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
