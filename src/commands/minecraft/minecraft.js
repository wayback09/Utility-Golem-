const { SlashCommandBuilder } = require('discord.js');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  module: 'minecraft',
  data: new SlashCommandBuilder()
    .setName('minecraft')
    .setDescription('Minecraft server status queries')
    .addSubcommand(sub =>
      sub.setName('serverstatus')
         .setDescription('Get status of a Minecraft server')
         .addStringOption(opt => opt.setName('ip').setDescription('Minecraft server IP/Host (e.g. play.hypixel.net)').setRequired(true))
         .addIntegerOption(opt => opt.setName('port').setDescription('Port number (default: 25565)'))
    )
    .addSubcommand(sub =>
      sub.setName('players')
         .setDescription('List online players of a Minecraft server')
         .addStringOption(opt => opt.setName('ip').setDescription('Minecraft server IP/Host').setRequired(true))
         .addIntegerOption(opt => opt.setName('port').setDescription('Port number (default: 25565)'))
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    const ip = interaction.options.getString('ip');
    const port = interaction.options.getInteger('port') || 25565;

    const url = `https://api.mcsrvstat.us/2/${ip}:${port}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.online) {
        return interaction.editReply({
          ...v2(createContainer({
            title: "Minecraft Server Status",
            description: `❌ Server **${ip}:${port}** is currently **offline** or unreachable.`,
            color: '#ff4757',
            footer: false
          }))
        });
      }

      if (subcommand === 'serverstatus') {
        const motd = data.motd && data.motd.clean ? data.motd.clean.join('\n') : 'No MOTD';
        
        return interaction.editReply({
          ...v2(createContainer({
            title: `Minecraft Server: ${ip}:${port}`,
            description: `🟢 Server is online!`,
            fields: [
              { name: "Version", value: data.version || "Unknown", inline: true },
              { name: "Players Online", value: `${data.players.online} / ${data.players.max}`, inline: true },
              { name: "MOTD", value: `\`\`\`\n${String(motd).slice(0, 1000)}\n\`\`\``, inline: false }
            ],
            thumbnail: `https://api.mcsrvstat.us/icon/${ip}:${port}`,
            color: '#2ed573',
            footer: false
          }))
        });
      }

      if (subcommand === 'players') {
        if (!data.players.list || data.players.list.length === 0) {
          return interaction.editReply({
            ...v2(createContainer({
              title: `Players on ${ip}:${port}`,
              description: `No players are currently online (or player list is disabled in server properties).`,
              color: '#3498db',
              footer: false
            }))
          });
        }

        const playerList = data.players.list.join(', ');
        return interaction.editReply({
          ...v2(createContainer({
            title: `Players on ${ip}:${port} (${data.players.online}/${data.players.max})`,
            description: `\`\`\`\n${playerList.slice(0, 1500)}\n\`\`\``,
            color: '#2ed573',
            footer: false
          }))
        });
      }
    } catch (err) {
      logger.error(`Error querying minecraft status: ${err.message}`);
      return interaction.editReply({ content: "Error while querying the Minecraft server details." });
    }
  }
};
