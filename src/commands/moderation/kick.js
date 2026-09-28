const { SlashCommandBuilder, PermissionFlagsBits, Routes } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for kicking'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used inside a server.', flags: 64 });
    }

    const user   = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id)        return interaction.reply({ content: 'You cannot kick yourself.', flags: 64 });
    if (user.id === interaction.client.user.id) return interaction.reply({ content: 'I cannot kick myself.', flags: 64 });

    await interaction.deferReply();

    try {
      // Use REST API directly to bypass caching issues
      await interaction.client.rest.delete(
        Routes.guildMember(interaction.guildId, user.id),
        {
          reason: `${interaction.user.tag}: ${reason}`
        }
      );

      // Log the action
      try { db.addModLog(interaction.guildId, user.id, interaction.user.id, 'KICK', reason); } catch (_) {}

      // Optional: Log to channel if we can fetch the guild and settings
      try {
        const guild = await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
        if (guild) {
          const settings = db.getGuildSettings(guild.id);
          if (settings.logging_enabled === 1 && settings.logging_channel) {
            const events = JSON.parse(settings.log_events || '{}');
            if (events.kick) {
              const logChannel = await guild.channels.fetch(settings.logging_channel).catch(() => null);
              if (logChannel) {
                logChannel.send({
                  ...v2(createContainer({
                    title: "User Kicked",
                    description: `**User:** <@${user.id}> (${user.tag})\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`,
                    color: '#ff4757',
                    footer: false
                  }))
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        // Ignore logging errors to ensure the reply still goes through
      }

      return interaction.editReply({
        ...v2(createContainer({
          title: '👢 User Kicked',
          description: `Successfully kicked **${user.tag}**\n**Reason:** ${reason}`,
          color: '#ff4757',
          thumbnail: user.displayAvatarURL({ extension: 'png', size: 256 }),
          footer: false
        }))
      });
    } catch (err) {
      const msg = err.status === 403 ? "I don't have permission to kick this user (their role might be higher)."
                : err.status === 404 ? "That user was not found in this server."
                : `Kick failed: \`${err.message}\``;

      return interaction.editReply({
        ...v2(createContainer({ title: 'Kick Failed', description: msg, color: '#ff4757', footer: false })),
      });
    }
  }
};
