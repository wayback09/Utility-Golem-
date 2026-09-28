const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel, client) {
    if (!oldChannel.guild) return;

    const guildId = oldChannel.guild.id;
    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');
      if (!events.channelChange) return;

      const logChannel = oldChannel.guild.channels.cache.get(settings.logging_channel);
      if (!logChannel) return;

      const fields = [];
      if (oldChannel.name !== newChannel.name) {
        fields.push({ name: "Name Changed", value: `\`${oldChannel.name}\` ➔ \`${newChannel.name}\`` });
      }
      if (oldChannel.topic !== newChannel.topic) {
        fields.push({ name: "Topic Changed", value: `\`${oldChannel.topic || "None"}\` ➔ \`${newChannel.topic || "None"}\`` });
      }

      if (fields.length > 0) {
        logChannel.send({
          ...v2(createContainer({
            guildId,
            title: "Channel Updated",
            description: `Channel: ${newChannel}\nID: ${newChannel.id}`,
            fields: fields,
            color: '#ffa502',
            footer: false
          }))
        }).catch(() => {});
      }
    } catch (err) {}
  }
};
