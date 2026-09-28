const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Displays warnings for a user or clears them')
    .addSubcommand(sub => 
      sub.setName('list')
         .setDescription('Lists all warnings for a user')
         .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('clear')
         .setDescription('Clears all warnings for a user')
         .addUserOption(opt => opt.setName('user').setDescription('The user to clear').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;

    if (subcommand === 'list') {
      const warnings = db.getWarnings(guildId, user.id);
      
      if (warnings.length === 0) {
        return interaction.reply({
          ...v2(createContainer({
            title: `Warnings for ${user.tag}`,
            description: `${user} has no warnings.`,
            color: '#2ed573',
            footer: false
          }))
        });
      }

      const warningFields = warnings.map((warn, i) => ({
        name: `Warning #${i + 1} (ID: ${warn.id})`,
        value: `**Reason:** ${warn.reason}\n**Moderator:** <@${warn.moderator_id}>\n**Date:** <t:${Math.round(warn.timestamp / 1000)}:F>`,
        inline: false
      }));

      return interaction.reply({
        ...v2(createContainer({
          title: `Warnings for ${user.tag} (${warnings.length})`,
          fields: warningFields,
          color: '#ffa502',
          footer: false
        }))
      });
    }

    if (subcommand === 'clear') {
      const clearedCount = db.clearWarnings(guildId, user.id);
      db.addModLog(guildId, user.id, interaction.user.id, 'CLEAR_WARNINGS', `Cleared ${clearedCount} warnings`);
      
      return interaction.reply({
        ...v2(createContainer({
          title: "Warnings Cleared",
          description: `Successfully cleared **${clearedCount} warnings** for **${user.tag}**.`,
          color: '#2ed573',
          footer: false
        }))
      });
    }
  }
};
