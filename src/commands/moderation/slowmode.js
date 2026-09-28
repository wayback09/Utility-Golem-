const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Sets the slowmode timer of the current channel')
    .addIntegerOption(option => 
      option.setName('seconds')
            .setDescription('Slowmode delay in seconds (0 to disable)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds);
      
      const desc = seconds === 0 
        ? "Slowmode has been disabled." 
        : `Slowmode delay set to **${seconds} seconds**.`;
        
      return interaction.reply({
        ...v2(createContainer({
          title: "Slowmode Updated",
          description: desc,
          color: '#3498db',
          footer: false
        }))
      });
    } catch (err) {
      return interaction.reply({ content: `Failed to set slowmode: ${err.message}`, flags: 64 });
    }
  }
};
