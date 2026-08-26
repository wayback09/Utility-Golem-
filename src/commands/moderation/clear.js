const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk deletes messages in the current channel')
    .addIntegerOption(option => 
      option.setName('amount')
            .setDescription('Number of messages to clear (1-1000)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ flags: 64 });

    try {
      let remaining = amount;
      let totalDeleted = 0;

      // Discord bulkDelete caps at 100 per call and 14-day age limit
      while (remaining > 0) {
        const batchSize = Math.min(100, remaining);
        const fetched = await interaction.channel.messages.fetch({ limit: batchSize });
        if (fetched.size === 0) break;

        // true = filter old (>14d) messages instead of throwing
        const deleted = await interaction.channel.bulkDelete(fetched, true);
        totalDeleted += deleted.size;
        remaining -= deleted.size;

        // If we deleted fewer than fetched, we hit age/pinned limit — stop
        if (deleted.size < fetched.size) break;
        if (fetched.size < batchSize) break;
        // Small delay to respect rate limits on large clears
        if (remaining > 0) await new Promise(r => setTimeout(r, 800));
      }

      const embed = createEmbed({
        description: totalDeleted > 0
          ? `Successfully cleared **${totalDeleted}** / **${amount}** messages.${totalDeleted < amount ? ' (remaining messages are older than 14 days and cannot be bulk-deleted)' : ''}`
          : `No deletable messages found (messages may be older than 14 days).`,
        color: totalDeleted > 0 ? '#2ed573' : '#ffa502'
      });
      if (totalDeleted > 0) {
        try { db.addModLog(interaction.guild.id, interaction.user.id, interaction.user.id, 'CLEAR', `Cleared ${totalDeleted}/${amount} in #${interaction.channel.name}`); } catch (_) {}
      }
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ content: `Failed to delete messages: ${err.message}` });
    }
  }
};
