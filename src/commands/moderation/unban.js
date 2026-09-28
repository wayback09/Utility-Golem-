const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user from the server')
    .addStringOption(option => option.setName('userid').setDescription('The ID of the user to unban').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const userId = interaction.options.getString('userid');

    try {
      await interaction.guild.members.unban(userId);
      return interaction.reply({
        ...v2(createContainer({
          title: "User Unbanned",
          description: `Successfully unbanned user ID: **${userId}**.`,
          color: '#2ed573',
          footer: false
        }))
      });
    } catch (error) {
      return interaction.reply({ content: "Failed to unban user. Make sure the ID is correct and they are banned.", flags: 64 });
    }
  }
};
