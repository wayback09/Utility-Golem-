const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'tickets',
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Configure and deploy ticket system')
    .addSubcommand(sub =>
      sub.setName('panel')
         .setDescription('Deploy ticket creation button panel')
         .addChannelOption(opt => opt.setName('channel').setDescription('Where to deploy panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('config')
         .setDescription('Configure ticket categories and log channels')
         .addChannelOption(opt => opt.setName('category').setDescription('Category under which tickets open').addChannelTypes(ChannelType.GuildCategory))
         .addChannelOption(opt => opt.setName('logs').setDescription('Logs channel for closed tickets').addChannelTypes(ChannelType.GuildText))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'panel') {
      const channel = interaction.options.getChannel('channel');

      const button = new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Create Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({
        ...v2(createContainer({
          title: "Support Tickets",
          description: "Need help? Click the button below to open a support ticket and talk to staff.",
          color: '#3498db',
          footer: false
        }), [row])
      });

      return interaction.reply({ content: `Successfully sent ticket panel to ${channel}!`, flags: 64 });
    }

    if (subcommand === 'config') {
      const category = interaction.options.getChannel('category');
      const logs = interaction.options.getChannel('logs');

      if (category) db.updateGuildSettings(guildId, 'ticket_category', category.id);
      if (logs) db.updateGuildSettings(guildId, 'ticket_logs_channel', logs.id);

      return interaction.reply({ content: "Ticket configurations successfully updated." });
    }
  }
};
