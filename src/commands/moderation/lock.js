const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Locks the current text channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });

      return interaction.reply({
        ...v2(createContainer({
          title: "Channel Locked",
          description: `This channel has been locked by a moderator.`,
          color: '#ff4757',
          footer: false
        }))
      });
    } catch (err) {
      return interaction.reply({ content: `Failed to lock channel: ${err.message}`, flags: 64 });
    }
  }
};
