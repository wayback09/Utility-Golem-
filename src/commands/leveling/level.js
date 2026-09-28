const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const { generateRankCard } = require('../../utils/imageBuilder');

module.exports = {
  module: 'leveling',
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Server leveling commands')
    .addSubcommand(sub =>
      sub.setName('rank')
         .setDescription('Display your current rank and level')
         .addUserOption(opt => opt.setName('user').setDescription('The user to view'))
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard')
         .setDescription('Show server leveling leaderboards')
    )
    .addSubcommand(sub =>
      sub.setName('reward-add')
         .setDescription('Add a role reward for a level')
         .addIntegerOption(opt => opt.setName('level').setDescription('Target level').setRequired(true).setMinValue(1))
         .addRoleOption(opt => opt.setName('role').setDescription('Role to reward').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reward-remove')
         .setDescription('Remove a role reward for a level')
         .addIntegerOption(opt => opt.setName('level').setDescription('Target level').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('reward-list')
         .setDescription('List all leveling role rewards')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'rank') {
      const user = interaction.options.getUser('user') || interaction.user;
      if (user.bot) {
        return interaction.reply({ content: "Bots do not gain XP or levels.", flags: 64 });
      }

      const userStats = db.getUserLevel(guildId, user.id);
      
      // Calculate progress percentage
      const nextLevelXp = (userStats.level * 100) + 100;
      const percentage = Math.min(100, Math.floor((userStats.xp / nextLevelXp) * 100));
      
      // Render text progress bar
      const barSize = 10;
      const filledCount = Math.round((percentage / 100) * barSize);
      const emptyCount = barSize - filledCount;
      const progressBar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);

      // Find position on leaderboard
      const leaderboard = db.getLeaderboard(guildId);
      const rank = leaderboard.findIndex(entry => entry.user_id === user.id) + 1;

      await interaction.deferReply();

      try {
        const imgBuffer = await generateRankCard(user, userStats, rank, guildId);
        const attachment = new AttachmentBuilder(imgBuffer, { name: 'rank.png' });
        return interaction.editReply({ files: [attachment] });
      } catch (err) {
        // Fallback to text embed if image generation fails
        const nextLevelXp = (userStats.level * 100) + 100;
        const percentage = Math.min(100, Math.floor((userStats.xp / nextLevelXp) * 100));
        const barSize = 10;
        const filledCount = Math.round((percentage / 100) * barSize);
        const progressBar = '█'.repeat(filledCount) + '░'.repeat(barSize - filledCount);
        return interaction.editReply({
          ...v2(createContainer({
            title: `${user.username}'s Rank Status`,
            description: [
              `Here is the current leveling status for ${user}:\n`,
              `🏆 **Rank:** \`#${rank || 'N/A'}\``,
              `📈 **Level:** \`${userStats.level}\``,
              `✨ **XP:** \`${userStats.xp} / ${nextLevelXp}\` \`(${percentage}%)\``,
              `📊 **Progress:** \`[${progressBar}]\``
            ].join('\n'),
            thumbnail: user.displayAvatarURL({ extension: 'png', size: 256 }),
            thumbnailDescription: `${user.username}'s avatar`,
            color: '#e91e8c',
            footer: false
          }))
        });
      }
    }

    if (subcommand === 'leaderboard') {
      await interaction.deferReply();
      const leaderboard = db.getLeaderboard(guildId).slice(0, 10);
      
      if (leaderboard.length === 0) {
        return interaction.editReply({ content: "No user stats recorded yet." });
      }

      const rows = [];
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        let displayName = `User (${entry.user_id})`;
        try {
          const user = await interaction.client.users.fetch(entry.user_id);
          if (user) {
            displayName = user.username;
          }
        } catch (_) {
          // If the user left or API failed, we can try to get cached member
          const cachedMember = interaction.guild.members.cache.get(entry.user_id);
          if (cachedMember) displayName = cachedMember.user.username;
        }
        rows.push(`**#${i + 1}** **${displayName}** — Level **${entry.level}** (${entry.xp} XP)`);
      }

      return interaction.editReply({
        ...v2(createContainer({
          title: `Server Leveling Leaderboard`,
          description: rows.join('\n'),
          color: '#5865F2',
          footer: false
        }))
      });
    }

    // Role reward management (requires admin)
    if (subcommand === 'reward-add') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "You need Administrator permissions to configure rewards.", flags: 64 });
      }
      
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      db.saveLevelReward(guildId, level, role.id);
      
      return interaction.reply({ content: `Role ${role} will now be awarded upon reaching **Level ${level}**.` });
    }

    if (subcommand === 'reward-remove') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "You need Administrator permissions to configure rewards.", flags: 64 });
      }

      const level = interaction.options.getInteger('level');
      const deleted = db.deleteLevelReward(guildId, level);

      if (deleted) {
        return interaction.reply({ content: `Successfully removed role reward for **Level ${level}**.` });
      } else {
        return interaction.reply({ content: `No reward found for **Level ${level}**.` });
      }
    }

    if (subcommand === 'reward-list') {
      const rewards = db.getLevelRewards(guildId);
      const rewardKeys = Object.keys(rewards);

      if (rewardKeys.length === 0) {
        return interaction.reply({ content: "No level rewards configured yet." });
      }

      const desc = rewardKeys
        .sort((a, b) => Number(a) - Number(b))
        .map(level => `Level **${level}**: <@&${rewards[level]}>`)
        .join('\n');

      return interaction.reply({
        ...v2(createContainer({
          title: "Level Role Rewards",
          description: desc,
          color: '#1e1f29',
          footer: false
        }))
      });
    }
  }
};
