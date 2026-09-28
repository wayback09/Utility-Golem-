const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'giveaways',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub =>
      sub.setName('start')
         .setDescription('Starts a new giveaway')
         .addStringOption(opt => opt.setName('prize').setDescription('What to win').setRequired(true))
         .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
         .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1))
         .addChannelOption(opt => opt.setName('channel').setDescription('Where to host giveaway').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('end')
         .setDescription('Force ends a giveaway')
         .addStringOption(opt => opt.setName('id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
         .setDescription('Rerolls winners for an ended giveaway')
         .addStringOption(opt => opt.setName('id').setDescription('Giveaway message ID').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'start') {
      await interaction.deferReply({ flags: 64 });

      const prize = interaction.options.getString('prize');
      const duration = interaction.options.getInteger('duration');
      const winnersCount = interaction.options.getInteger('winners');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const endTime = Date.now() + (duration * 60 * 1000);

      const container = createContainer({
        title: `🎁 GIVEAWAY: ${prize}`,
        description: `Click the button below to enter!\n\n**Time Remaining:** Ends <t:${Math.round(endTime / 1000)}:R> (<t:${Math.round(endTime / 1000)}:f>)\n**Hosted By:** ${interaction.user}\n**Winners:** ${winnersCount}`,
        color: '#3498db',
        footer: false
      });

      const button = new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel('Enter')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      let giveawayMessage;
      try {
        giveawayMessage = await channel.send({
          ...v2(container, [row])
        });
      } catch (err) {
        return interaction.editReply({
          ...v2(createContainer({
            title: "Giveaway Failed",
            description: `Could not send the giveaway message in ${channel}.\n\`${err.message}\``,
            color: '#ff4757',
            footer: false
          }))
        });
      }

      // Save to database
      db.saveGiveaway({
        message_id: giveawayMessage.id,
        guild_id: guildId,
        channel_id: channel.id,
        prize: prize,
        winner_count: winnersCount,
        end_time: endTime,
        requirements: '[]',
        host_id: interaction.user.id,
        ended: 0,
        winners: '[]'
      });

      return interaction.editReply({ content: `Giveaway started in ${channel}!` });
    }

    if (subcommand === 'end') {
      await interaction.deferReply();

      const id = interaction.options.getString('id');
      const giveaway = db.getGiveaway(id);

      if (!giveaway) {
        return interaction.editReply({ content: "Giveaway not found." });
      }

      if (giveaway.ended === 1) {
        return interaction.editReply({ content: "That giveaway has already ended." });
      }

      // End it immediately
      const giveawayManager = require('../../modules/giveaways/giveawayManager');
      await giveawayManager.endGiveaway(interaction.client, giveaway);
      return interaction.editReply({ content: "Giveaway ended successfully." });
    }

    if (subcommand === 'reroll') {
      await interaction.deferReply();

      const id = interaction.options.getString('id');
      const giveaway = db.getGiveaway(id);

      if (!giveaway) {
        return interaction.editReply({ content: "Giveaway not found." });
      }

      if (giveaway.ended === 0) {
        return interaction.editReply({ content: "That giveaway hasn't ended yet." });
      }

      const giveawayManager = require('../../modules/giveaways/giveawayManager');
      await giveawayManager.rerollGiveaway(interaction.client, giveaway);
      return interaction.editReply({ content: "Rerolled winners successfully." });
    }
  }
};
