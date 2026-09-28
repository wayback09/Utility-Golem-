const { SlashCommandBuilder, PermissionFlagsBits, Routes } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeouts a member')
    .addUserOption(opt => opt.setName('user').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Timeout duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used inside a server.', flags: 64 });
    }

    const user     = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason   = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id)        return interaction.reply({ content: 'You cannot timeout yourself.', flags: 64 });
    if (user.id === interaction.client.user.id) return interaction.reply({ content: 'I cannot timeout myself.', flags: 64 });

    const timeoutUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();

    await interaction.deferReply();

    try {
      // Use REST API directly
      await interaction.client.rest.patch(
        Routes.guildMember(interaction.guildId, user.id),
        {
          body: { communication_disabled_until: timeoutUntil },
          reason: `${interaction.user.tag}: ${reason}`
        }
      );

      // Log the action
      try { db.addModLog(interaction.guildId, user.id, interaction.user.id, 'TIMEOUT', `${duration}m: ${reason}`); } catch (_) {}

      // Optional: Log to channel
      try {
        const guild = await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
        if (guild) {
          const settings = db.getGuildSettings(guild.id);
          if (settings.logging_enabled === 1 && settings.logging_channel) {
            const events = JSON.parse(settings.log_events || '{}');
            if (events.timeout) {
              const logChannel = await guild.channels.fetch(settings.logging_channel).catch(() => null);
              if (logChannel) {
                logChannel.send({
                  ...v2(createContainer({
                    title: "User Timed Out",
                    description: `**User:** <@${user.id}> (${user.tag})\n**Moderator:** ${interaction.user}\n**Duration:** ${duration} minutes\n**Reason:** ${reason}`,
                    color: '#f39c12',
                    footer: false
                  }))
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {}

      return interaction.editReply({
        ...v2(createContainer({
          title: '⏳ User Timed Out',
          description: `Successfully timed out **${user.tag}** for ${duration} minutes.\n**Reason:** ${reason}`,
          color: '#f39c12',
          thumbnail: user.displayAvatarURL({ extension: 'png', size: 256 }),
          footer: false
        }))
      });
    } catch (err) {
      const msg = err.status === 403 ? "I don't have permission to timeout this user (their role might be higher)."
                : err.status === 404 ? "That user was not found in this server."
                : `Timeout failed: \`${err.message}\``;

      return interaction.editReply({
        ...v2(createContainer({ title: 'Timeout Failed', description: msg, color: '#ff4757', footer: false })),
      });
    }
  }
};
