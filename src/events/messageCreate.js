const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const automod = require('../modules/automod/automodHandler');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // 0. Commands-only channels: delete normal chat messages (supports multi-guild)
    try {
      const settingsForCmdOnly = db.getGuildSettings(message.guild.id);
      const cmdOnlyChannels = (settingsForCmdOnly.commandOnlyChannels || []).map(id => String(id).trim());
      if (cmdOnlyChannels.length > 0 && cmdOnlyChannels.includes(message.channelId)) {
        const prefix = (db.getGuildSettings(message.guild.id) || {}).prefix || 'g!';
        const isCommand = message.content.trim().startsWith(prefix);
        if (!isCommand) {
          await message.delete().catch(() => {});
          const hint = await message.channel.send("This channel is for commands only — chat messages are deleted here.").catch(() => null);
          if (hint) setTimeout(() => hint.delete().catch(() => {}), 4000);
        }
      }
    } catch (e) {
      // Ignore config read errors
    }

    // 1. Run Automod Check
    const triggered = await automod.handleAutomod(message);
    if (triggered) return;

    const guildId = message.guild.id;
    const settings = db.getGuildSettings(guildId);
    const prefix = settings.prefix || "g!";

    // 2. Leveling Module
    if (db.isModuleEnabled(guildId, 'leveling')) {
      const userLevel = db.getUserLevel(guildId, message.author.id);
      const now = Date.now();
      const cooldownMs = (settings.levelingCooldown || 60) * 1000;
      
      if (now - userLevel.last_message_time > cooldownMs) {
        const xpGained = Math.floor(Math.random() * 10) + 15; // 15 to 25 XP
        let newXp = userLevel.xp + xpGained;
        let newLevel = userLevel.level;
        
        // XP Formula: Level * 100 + 100
        let xpNeeded = (newLevel * 100) + 100;
        let leveledUp = false;
        
        while (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel++;
          xpNeeded = (newLevel * 100) + 100;
          leveledUp = true;
        }

        db.saveUserLevel(guildId, message.author.id, newXp, newLevel, now);

        if (leveledUp) {
          // Check for rewards
          const rewards = db.getLevelRewards(guildId);
          const roleId = rewards[newLevel];
          let rewardText = "";
          
          if (roleId) {
            const role = message.guild.roles.cache.get(roleId);
            if (role) {
              const member = message.guild.members.cache.get(message.author.id);
              if (member) {
                await member.roles.add(role).catch(() => {});
                rewardText = ` and unlocked the **${role.name}** role`;
              }
            }
          }

          const embed = createEmbed({
            title: "Level Up!",
            description: `Congratulations ${message.author}! You have reached **Level ${newLevel}**${rewardText}!`,
            color: '#2ed573'
          });

          let targetChannel = null;
          try {
            // DB authoritative — file fallback for already-installed servers
            let levelUpChannelId = settings.levelUpChannel || '';
            if (!levelUpChannelId) {
              const guildCfg = db.getGuildConfig(guildId);
              levelUpChannelId = (guildCfg.channels && guildCfg.channels.levelUp) || '';
            }
            if (levelUpChannelId && levelUpChannelId.trim() !== '') {
              const fetchedChannel = message.guild.channels.cache.get(levelUpChannelId.trim());
              if (fetchedChannel) targetChannel = fetchedChannel;
            }
          } catch (e) {
            // Ignore config read errors
          }

          // Only send if a dedicated channel is configured
          if (targetChannel) {
            targetChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    }

    // 3. Custom Commands Check
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      const customCmds = db.getCustomCommands(guildId);
      if (customCmds[commandName]) {
        const cmd = customCmds[commandName];

        // Permission check
        const allowedRoles = Array.isArray(cmd.allowed_roles) ? cmd.allowed_roles : [];
        const allowedUsers = Array.isArray(cmd.allowed_users) ? cmd.allowed_users : [];
        const requiredPermission = cmd.required_permission;

        const hasRestrictions = allowedRoles.length > 0 || allowedUsers.length > 0 || !!requiredPermission;

        if (hasRestrictions) {
          const member = message.member;
          const isOwner = message.guild.ownerId === message.author.id;
          const isAdmin = member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator);

          let isAllowed = isOwner || isAdmin;

          if (!isAllowed) {
            if (allowedUsers.includes(message.author.id)) {
              isAllowed = true;
            }
            if (!isAllowed && member && member.roles && member.roles.cache) {
              if (member.roles.cache.some(r => allowedRoles.includes(r.id))) {
                isAllowed = true;
              }
            }
            if (!isAllowed && requiredPermission && member && member.permissions) {
              const permBit = PermissionFlagsBits[requiredPermission];
              if (permBit && member.permissions.has(permBit)) {
                isAllowed = true;
              }
            }
          }

          if (!isAllowed) {
            const warningMsg = await message.reply(`❌ You do not have permission to use the custom command \`${prefix}${commandName}\`.`).catch(() => null);
            if (warningMsg) {
              setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
            }
            return;
          }
        }

        let response = cmd.response;
        
        // Parse basic variables
        response = response
          .replace(/{user}/g, message.author.toString())
          .replace(/{username}/g, message.author.username)
          .replace(/{server}/g, message.guild.name)
          .replace(/{membercount}/g, message.guild.memberCount);

        if (cmd.is_embed === 1 || cmd.is_embed === true || cmd.is_embed === '1') {
          return message.reply({
            embeds: [createEmbed({
              description: response
            })]
          });
        } else {
          return message.reply(response);
        }
      }
    }
  }
};
