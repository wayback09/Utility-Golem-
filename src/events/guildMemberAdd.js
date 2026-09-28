const { AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const { createContainer, V2_FLAGS, v2 } = require('../utils/embedBuilder');
const { generateWelcomeCard } = require('../utils/imageBuilder');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guildId = member.guild.id;
    const settings = db.getGuildSettings(guildId);

    // 1. Welcome Message
    const welcomeEnabled = settings.welcome_enabled === 1 || settings.welcome_enabled === true;
    if (db.isModuleEnabled(guildId, 'welcome') && welcomeEnabled && settings.welcome_channel) {
      const channel = member.guild.channels.cache.get(settings.welcome_channel);
      if (channel) {
        let msg = settings.welcome_message || "Welcome {user} to {server}!";
        msg = msg
          // Plain-text name linked to the profile — renders identically on every
          // device (embed mentions only resolve for users the viewer has cached)
          .replace(/{user}/g, `[${member.displayName}](https://discord.com/users/${member.id})`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount);

        // Strip bare raw user IDs ("Welcome 123456789...") so they render as a name
        // (but not IDs inside the profile link — those must stay inside the URL)
        msg = msg.replace(new RegExp(`(?<!<@)(?<![0-9/])${member.id}`, 'g'), member.user.username);

        try {
          const imgBuffer = await generateWelcomeCard(member);
          const attachment = new AttachmentBuilder(imgBuffer, { name: 'welcome.png' });
          // Components V2: gallery items referencing attachments REQUIRE the V2 flag
          // (sending a type-12 Media Gallery without it is rejected by the API).
          const container = createContainer({
            guildId,
            title: `Welcome to ${member.guild.name}!`,
            description: `${msg}\nYou are member #${member.guild.memberCount.toLocaleString()}`,
            image: 'attachment://welcome.png',
            imageDescription: `Welcome card for ${member.user.username}`,
          });
          channel.send({ files: [attachment], components: [container], flags: V2_FLAGS }).catch(err => {
            logger.error(`Welcome message failed to send: ${err.message}`);
          });
        } catch (err) {
          logger.error(`Welcome image generation failed: ${err.message}`);
          // V2 fallback (no canvas): text + avatar thumbnail in a Section, no attachment needed.
          const container = createContainer({
            guildId,
            title: `Welcome to ${member.guild.name}!`,
            description: msg,
            thumbnail: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            thumbnailDescription: `${member.user.username}'s avatar`,
          });
          channel.send({ components: [container], flags: V2_FLAGS }).catch(err => {
            logger.error(`Welcome message failed to send: ${err.message}`);
          });
        }
      }
    }

    // 2. Auto Role Assignment
    if (db.isModuleEnabled(guildId, 'welcome') && settings.autorole_enabled === 1 && settings.autoroles) {
      try {
        const roles = JSON.parse(settings.autoroles);
        for (const roleId of roles) {
          const role = member.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role).catch(err => {
              logger.error(`AutoRole addition failed for ${role.name}: ${err.message}`);
            });
          }
        }
      } catch (err) {
        logger.error(`Failed parsing autoroles for guild ${guildId}: ${err.message}`);
      }
    }

    // 3. Member Join Log
    if (db.isModuleEnabled(guildId, 'logging') && settings.logging_enabled === 1 && settings.logging_channel) {
      try {
        const events = JSON.parse(settings.log_events || '{}');
        if (events.memberJoin) {
          const logChannel = member.guild.channels.cache.get(settings.logging_channel);
          if (logChannel) {
            logChannel.send({
              ...v2(createContainer({
                guildId,
                title: "Member Joined",
                description: `${member.user} (${member.user.tag}) has joined the server.\nID: ${member.user.id}`,
                color: '#2ed573',
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
