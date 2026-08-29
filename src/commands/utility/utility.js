const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  module: 'utility',
  data: new SlashCommandBuilder()
    .setName('utility')
    .setDescription('General utility commands')
    .addSubcommand(sub =>
      sub.setName('ping')
         .setDescription('Responds with bot latency')
    )
    .addSubcommand(sub =>
      sub.setName('uptime')
         .setDescription('Shows bot uptime')
    )
    .addSubcommand(sub =>
      sub.setName('botinfo')
         .setDescription('Get technical information about Golem')
    )
    .addSubcommand(sub =>
      sub.setName('userinfo')
         .setDescription('Display information about a server member')
         .addUserOption(opt => opt.setName('user').setDescription('Member to check'))
    )
    .addSubcommand(sub =>
      sub.setName('serverinfo')
         .setDescription('Displays information about the current Discord server')
    )
    .addSubcommand(sub =>
      sub.setName('avatar')
         .setDescription('View the avatar of a user')
         .addUserOption(opt => opt.setName('user').setDescription('Target user'))
    )
    .addSubcommand(sub =>
      sub.setName('banner')
         .setDescription('View the banner of a user')
         .addUserOption(opt => opt.setName('user').setDescription('Target user'))
    )
    .addSubcommand(sub =>
      sub.setName('help')
         .setDescription('List all commands and features')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ping') {
      const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const apiPing = Math.round(interaction.client.ws.ping);

      return interaction.editReply({
        content: null,
        embeds: [createEmbed({
          title: "🏓 Pong!",
          fields: [
            { name: "Bot Latency", value: `\`${latency}ms\``, inline: true },
            { name: "API Heartbeat", value: `\`${apiPing}ms\``, inline: true }
          ],
          color: '#2ed573'
        })]
      });
    }

    if (subcommand === 'uptime') {
      let totalSeconds = (interaction.client.uptime / 1000);
      let days = Math.floor(totalSeconds / 86400);
      totalSeconds %= 86400;
      let hours = Math.floor(totalSeconds / 3600);
      totalSeconds %= 3600;
      let minutes = Math.floor(totalSeconds / 60);
      let seconds = Math.floor(totalSeconds % 60);

      return interaction.reply({
        embeds: [createEmbed({
          title: "Bot Uptime",
          description: `Golem has been online for:\n\`${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds\`.`,
          color: '#3498db'
        })]
      });
    }

    if (subcommand === 'botinfo') {
      return interaction.reply({
        embeds: [createEmbed({
          title: "Golem Bot Profile",
          description: "Golem is a custom built Discord Server Guardian designed for ultimate modularity, security, and scalability.",
          fields: [
            { name: "Library", value: "discord.js v14", inline: true },
            { name: "Platform Node", value: process.version, inline: true },
            { name: "Memory Usage", value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
            { name: "Guilds Joined", value: `${interaction.client.guilds.cache.size}`, inline: true },
            { name: "Uptime", value: `<t:${Math.round((Date.now() - interaction.client.uptime) / 1000)}:R>`, inline: true }
          ],
          color: '#1e1f29'
        })]
      });
    }

    if (subcommand === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(user.id);

      const fields = [
        { name: "Account Created", value: `<t:${Math.round(user.createdTimestamp / 1000)}:R>`, inline: true }
      ];

      if (member) {
        fields.push({ name: "Joined Server", value: `<t:${Math.round(member.joinedTimestamp / 1000)}:R>`, inline: true });
        fields.push({ name: "Highest Role", value: `${member.roles.highest}`, inline: true });
      }

      return interaction.reply({
        embeds: [createEmbed({
          title: `User Stats: ${user.tag}`,
          fields: fields,
          thumbnail: user.displayAvatarURL({ dynamic: true }),
          color: '#3498db'
        })]
      });
    }

    if (subcommand === 'serverinfo') {
      const guild = interaction.guild;
      return interaction.reply({
        embeds: [createEmbed({
          title: `Server Profile: ${guild.name}`,
          fields: [
            { name: "Server ID", value: guild.id, inline: true },
            { name: "Total Members", value: `${guild.memberCount}`, inline: true },
            { name: "Created At", value: `<t:${Math.round(guild.createdTimestamp / 1000)}:f>`, inline: false }
          ],
          thumbnail: guild.iconURL({ dynamic: true }),
          color: '#1e1f29'
        })]
      });
    }

    if (subcommand === 'avatar') {
      const user = interaction.options.getUser('user') || interaction.user;
      return interaction.reply({
        embeds: [createEmbed({
          title: `${user.username}'s Avatar`,
          image: user.displayAvatarURL({ size: 1024, dynamic: true }),
          color: '#3498db'
        })]
      });
    }

    if (subcommand === 'banner') {
      const user = interaction.options.getUser('user') || interaction.user;
      const fullUser = await interaction.client.users.fetch(user.id, { force: true });
      
      if (!fullUser.bannerURL()) {
        return interaction.reply({ content: "This user does not have a profile banner set.", flags: 64 });
      }

      return interaction.reply({
        embeds: [createEmbed({
          title: `${user.username}'s Banner`,
          image: fullUser.bannerURL({ size: 1024, dynamic: true }),
          color: '#3498db'
        })]
      });
    }

    if (subcommand === 'help') {
      return interaction.reply({
        embeds: [createEmbed({
          title: "Golem Command Manual",
          description: "All Golem commands are modern slash commands. Access them via `/` followed by category commands.",
          fields: [
            { name: "🛡️ Moderation", value: "`/ban`, `/unban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clear`, `/lock`, `/unlock`, `/slowmode`" },
            { name: "⚙️ Config", value: "`/config status`, `/config welcome`, `/config goodbye`, `/config logging`, `/config module`" },
            { name: "🤖 Automod", value: "`/automod status`, `/automod toggle`, `/automod badwords`, `/automod mentions`" },
            { name: "🎫 Support Tickets", value: "`/tickets panel`, `/tickets config`" },
            { name: "🗳️ Suggestions", value: "`/suggest submit`, `/suggest config`" },
            { name: "🎁 Giveaways", value: "`/giveaway start`, `/giveaway end`, `/giveaway reroll`" },
            { name: "📝 Custom Commands", value: "`/customcommand create`, `/customcommand permissions`, `/customcommand delete`, `/customcommand list`" },
            { name: "🎮 Minecraft", value: "`/minecraft serverstatus`, `/minecraft players`" },
            { name: "📊 Levels", value: "`/level rank`, `/level leaderboard`, `/level reward-add`" },
            { name: "🎨 Roles", value: "`/roles button`, `/roles select`, `/roles verify`" },
            { name: "🔧 Utility", value: "`/utility ping`, `/utility uptime`, `/utility botinfo`, `/utility userinfo`, `/utility serverinfo`" }
          ],
          color: '#1e1f29'
        })]
      });
    }
  }
};
