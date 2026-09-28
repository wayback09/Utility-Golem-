const { SlashCommandBuilder, PermissionFlagsBits, Routes } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used inside a server.', flags: 64 });
    }

    const user   = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id)        return interaction.reply({ content: 'You cannot ban yourself.', flags: 64 });
    if (user.id === interaction.client.user.id) return interaction.reply({ content: 'I cannot ban myself.', flags: 64 });

    await interaction.deferReply();

    try {
      // Use REST API directly — no guild object or cache needed
      await interaction.client.rest.put(
        Routes.guildBan(interaction.guildId, user.id),
        {
          body: { delete_message_days: 0 },
          reason: `${interaction.user.tag}: ${reason}`
        }
      );

      // Log the action
      try { db.addModLog(interaction.guildId, user.id, interaction.user.id, 'BAN', reason); } catch (_) {}

      return interaction.editReply({
        ...v2(createContainer({
          title: '🔨 User Banned',
          description: `Successfully banned **${user.tag}**\n**Reason:** ${reason}`,
          color: '#ff4757',
          thumbnail: user.displayAvatarURL({ extension: 'png', size: 256 }),
          footer: false
        }))
      });
    } catch (err) {
      const msg = err.status === 403 ? "I don't have permission to ban this user."
                : err.status === 404 ? "That user was not found in this server."
                : `Ban failed: \`${err.message}\``;

      return interaction.editReply({
        ...v2(createContainer({ title: 'Ban Failed', description: msg, color: '#ff4757', footer: false })),
      });
    }
  }
};
