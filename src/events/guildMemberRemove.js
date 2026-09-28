const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const guildId = member.guild.id;
    const settings = db.getGuildSettings(guildId);

    // 1. Goodbye Message
    const goodbyeEnabled = settings.goodbye_enabled === 1 || settings.goodbye_enabled === true;
    if (db.isModuleEnabled(guildId, 'welcome') && goodbyeEnabled && settings.goodbye_channel) {
      const channel = member.guild.channels.cache.get(settings.goodbye_channel);
      if (channel) {
        let msg = settings.goodbye_message || "{username} has left the server.";
        msg = msg
          .replace(/{user}/g, `[${member.displayName}](https://discord.com/users/${member.id})`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount);

        // Strip bare raw user IDs ("Goodbye 1234567890") so they don't show as raw numbers
        msg = msg.replace(new RegExp(`(?<!<@)(?<![0-9/])${member.id}`, 'g'), member.user.username);

        channel.send({
          ...v2(createContainer({
            guildId,
            title: `Goodbye!`,
            description: msg,
            thumbnail: member.user.displayAvatarURL({ extension: 'png', size: 256 })
          }))
        }).catch(err => {
          logger.error(`Goodbye message failed to send: ${err.message}`);
        });
      }
    }

    // 2. Member Leave Log
    if (db.isModuleEnabled(guildId, 'logging') && settings.logging_enabled === 1 && settings.logging_channel) {
      try {
        const events = JSON.parse(settings.log_events || '{}');
        if (events.memberLeave) {
          const logChannel = member.guild.channels.cache.get(settings.logging_channel);
          if (logChannel) {
            logChannel.send({
              ...v2(createContainer({
                guildId,
                title: "Member Left",
                description: `${member.user} (${member.user.tag}) has left the server.\nID: ${member.user.id}`,
                color: '#ff4757',
                thumbnail: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                footer: false
              }))
            }).catch(() => {});
          }
        }
      } catch (err) {}
    }
  }
};
