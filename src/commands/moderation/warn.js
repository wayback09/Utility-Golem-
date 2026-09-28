const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a server member')
    .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (user.bot) {
      return interaction.reply({ content: "You cannot warn a bot.", flags: 64 });
    }

    db.addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
    db.addModLog(interaction.guild.id, user.id, interaction.user.id, 'WARN', reason);

    // Try to DM the warned user
    await user.send({
      ...v2(createContainer({
        title: `Warning from ${interaction.guild.name}`,
        description: `You have been warned by a moderator.\n**Reason:** ${reason}`,
        color: '#ffa502',
        footer: false
      }))
    }).catch(() => {});

    return interaction.reply({
      ...v2(createContainer({
        title: "Member Warned",
        description: `Successfully warned **${user.tag}**.\n**Reason:** ${reason}`,
        color: '#ffa502',
        footer: false
      }))
    });
  }
};
