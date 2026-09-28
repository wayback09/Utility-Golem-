const { SlashCommandBuilder, PermissionFlagsBits, Routes } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Removes a timeout from a member')
    .addUserOption(opt => opt.setName('user').setDescription('The user to untimeout').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used inside a server.', flags: 64 });
    }

    const user = interaction.options.getUser('user');

    if (user.id === interaction.user.id)        return interaction.reply({ content: 'You cannot untimeout yourself.', flags: 64 });
    if (user.id === interaction.client.user.id) return interaction.reply({ content: 'I cannot untimeout myself.', flags: 64 });

    await interaction.deferReply();

    try {
      // Use REST API directly
      await interaction.client.rest.patch(
        Routes.guildMember(interaction.guildId, user.id),
        {
          body: { communication_disabled_until: null },
          reason: `Untimeout by ${interaction.user.tag}`
        }
      );

      // Log the action
      try { db.addModLog(interaction.guildId, user.id, interaction.user.id, 'UNTIMEOUT', 'Manual untimeout'); } catch (_) {}

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
                    title: "User Untimed Out",
                    description: `**User:** <@${user.id}> (${user.tag})\n**Moderator:** ${interaction.user}`,
                    color: '#2ed573',
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
          title: '✅ User Untimed Out',
          description: `Successfully removed timeout for **${user.tag}**.`,
          color: '#2ed573',
          thumbnail: user.displayAvatarURL({ extension: 'png', size: 256 }),
          footer: false
        }))
      });
    } catch (err) {
      const msg = err.status === 403 ? "I don't have permission to untimeout this user."
                : err.status === 404 ? "That user was not found in this server."
                : `Untimeout failed: \`${err.message}\``;

      return interaction.editReply({
        ...v2(createContainer({ title: 'Untimeout Failed', description: msg, color: '#ff4757', footer: false })),
      });
    }
  }
};
