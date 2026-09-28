const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'suggestions',
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion or configure suggestion settings')
    .addSubcommand(sub =>
      sub.setName('submit')
         .setDescription('Submit a suggestion to the server suggestion box')
         .addStringOption(opt => opt.setName('content').setDescription('Your suggestion').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('config')
         .setDescription('Configure suggestion channel')
         .addChannelOption(opt => opt.setName('channel').setDescription('The suggestion channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const settings = db.getGuildSettings(guildId);

    if (subcommand === 'config') {
      // Admin check
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "You need Administrator permissions to run this config.", flags: 64 });
      }

      const channel = interaction.options.getChannel('channel');
      db.updateGuildSettings(guildId, 'suggestion_channel', channel.id);
      db.updateGuildSettings(guildId, 'suggestion_enabled', 1);

      return interaction.reply({ content: `Suggestions channel has been set to ${channel}.` });
    }

    if (subcommand === 'submit') {
      if (settings.suggestion_enabled !== 1 || !settings.suggestion_channel) {
        return interaction.reply({ content: "The suggestion system is currently disabled on this server.", flags: 64 });
      }

      const content = interaction.options.getString('content');
      const targetChannel = interaction.guild.channels.cache.get(settings.suggestion_channel);
      
      if (!targetChannel) {
        return interaction.reply({ content: "Suggestion channel not found or misconfigured.", flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      // Build voting buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest_upvote').setLabel('Upvote').setStyle(ButtonStyle.Success).setEmoji('👍'),
        new ButtonBuilder().setCustomId('suggest_downvote').setLabel('Downvote').setStyle(ButtonStyle.Danger).setEmoji('👎'),
        new ButtonBuilder().setCustomId('suggest_approve').setLabel('Approve').setStyle(ButtonStyle.Primary).setEmoji('✅'),
        new ButtonBuilder().setCustomId('suggest_deny').setLabel('Deny').setStyle(ButtonStyle.Secondary).setEmoji('❌')
      );

      // Send to suggestion channel
      try {
        const msg = await targetChannel.send({
          ...v2(createContainer({
            title: `Suggestion Pending`,
            description: content,
            fields: [
              { name: "Author", value: `${interaction.user}` },
              { name: "Status", value: "PENDING" },
              { name: "Votes", value: "👍 0 | 👎 0" }
            ],
            color: '#1e1f29',
            footer: false
          }), [row])
        });

        // Save suggestion in DB
        db.saveSuggestion({
          message_id: msg.id,
          guild_id: guildId,
          user_id: interaction.user.id,
          content: content,
          status: 'PENDING',
          reason: '',
          votes_up: '[]',
          votes_down: '[]'
        });

        return interaction.editReply({ content: "Your suggestion has been successfully submitted!" });
      } catch (err) {
        return interaction.editReply({ content: `Failed to post suggestion: ${err.message}` });
      }
    }
  }
};
