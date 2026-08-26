const { Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const logger = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const guildId = interaction.guildId;
      
      // Module check
      if (guildId && command.module) {
        if (!db.isModuleEnabled(guildId, command.module)) {
          return interaction.reply({
            embeds: [createEmbed({
              title: "Module Disabled",
              description: `The **${command.module}** module is disabled on this server. An administrator can enable it via settings.`,
              color: '#ff4757'
            })],
            flags: 64
          });
        }
      }

      // Check command channel restrictions via guild settings (supports multi-guild, merged config + DB)
      try {
        const db = require('../database/db');
        const guildSettings = db.getGuildSettings(interaction.guildId);
        const cmdChannels = guildSettings.commandChannels || {};
        if (cmdChannels[command.data.name]) {
          const allowedChannels = cmdChannels[command.data.name];

          // If the array is empty, it means no restriction (allowed everywhere)
          // If it has IDs, check if the current channel is one of them
          if (allowedChannels.length > 0) {
            const stringChannels = allowedChannels.map(id => String(id).trim());
            if (!stringChannels.includes(interaction.channelId)) {
              const channelsList = stringChannels.map(id => `<#${id}>`).join(', ');
              return interaction.reply({
                content: `This command can only be used in the following channel(s): ${channelsList}`,
                flags: 64
              });
            }
          }
        }
      } catch (e) {
        logger.error(`Error reading config.json for channel restrictions: ${e.message}`);
      }

      // Check Command Cooldowns
      const { cooldowns } = client;
      if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
      }
      const now = Date.now();
      const timestamps = cooldowns.get(command.data.name);
      const defaultCooldownDuration = 3;
      const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

      if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expirationTime) {
          const expiredTimestamp = Math.round(expirationTime / 1000);
          return interaction.reply({
            content: `Please wait, you are on a cooldown for \`/${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
            flags: 64
          });
        }
      }
      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing command ${command.data.name}: ${error.message}`);
        const errorEmbed = createEmbed({
          title: "Command Error",
          description: "An error occurred while executing this command. Please contact the administrator.",
          color: '#ff4757'
        });
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
      }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      // Pass button & select menu interactions to dynamic handlers in the modules
      const customId = interaction.customId;

      // Tickets handling
      if (customId.startsWith('ticket_')) {
        const ticketModule = require('../modules/tickets/ticketsHandler');
        return ticketModule.handleInteraction(interaction);
      }

      // Suggestions handling
      if (customId.startsWith('suggest_')) {
        const suggestionModule = require('../modules/suggestions/suggestionsHandler');
        return suggestionModule.handleInteraction(interaction);
      }

      // Roles handling (Verification & Self-assign roles)
      if (customId.startsWith('role_') || customId.startsWith('verify_')) {
        const roleModule = require('../modules/roles/rolesHandler');
        return roleModule.handleInteraction(interaction);
      }

      // Giveaways handling
      if (customId === 'giveaway_enter') {
        const giveawayManager = require('../modules/giveaways/giveawayManager');
        const result = giveawayManager.addParticipant(interaction.message.id, interaction.user.id);
        if (result === 'added') {
          return interaction.reply({ content: "You have entered the giveaway! 🎉", flags: 64 });
        } else if (result === 'removed') {
          return interaction.reply({ content: "You have left the giveaway.", flags: 64 });
        } else {
          return interaction.reply({ content: "This giveaway is no longer active.", flags: 64 });
        }
      }

      // Puzzle submissions handling
      if (customId.startsWith('puzzle_approve_') || customId.startsWith('puzzle_reject_')) {
        const puzzleModule = require('../modules/forms/puzzleHandler');
        return puzzleModule.handleInteraction(interaction);
      }
    }
  }
};
