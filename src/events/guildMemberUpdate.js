const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const guildId = oldMember.guild.id;
    if (!db.isModuleEnabled(guildId, 'logging')) return;

    const settings = db.getGuildSettings(guildId);
    if (settings.logging_enabled !== 1 || !settings.logging_channel) return;

    const logChannel = oldMember.guild.channels.cache.get(settings.logging_channel);
    if (!logChannel) return;

    try {
      const events = JSON.parse(settings.log_events || '{}');

      // 1. Role Changes
      if (events.roleChange) {
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
          const fields = [];
          if (addedRoles.size > 0) {
            fields.push({ name: "Roles Added", value: addedRoles.map(r => r.name).join(', ') });
          }
          if (removedRoles.size > 0) {
            fields.push({ name: "Roles Removed", value: removedRoles.map(r => r.name).join(', ') });
          }

          logChannel.send({
            ...v2(createContainer({
              guildId,
              title: "Member Roles Updated",
              description: `User: ${newMember.user} (${newMember.user.id})`,
              fields: fields,
              color: '#3498db',
              footer: false
            }))
          }).catch(() => {});
        }
      }

      // 2. Timeout Changes
      if (events.timeout) {
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (oldTimeout !== newTimeout) {
          if (newTimeout && newTimeout > Date.now()) {
            // Member was timed out
            logChannel.send({
              ...v2(createContainer({
                guildId,
                title: "Member Timed Out",
                description: `User: ${newMember.user} (${newMember.user.id})\nTimed out until: <t:${Math.round(newTimeout / 1000)}:F>`,
                color: '#ff4757',
                footer: false
              }))
            }).catch(() => {});
          } else if (oldTimeout && (!newTimeout || newTimeout <= Date.now())) {
            // Timeout removed
            logChannel.send({
              ...v2(createContainer({
                guildId,
                title: "Member Timeout Removed",
                description: `User: ${newMember.user} (${newMember.user.id})`,
                color: '#2ed573',
                footer: false
              }))
            }).catch(() => {});
          }
        }
      }
    } catch (err) {}
  }
};
