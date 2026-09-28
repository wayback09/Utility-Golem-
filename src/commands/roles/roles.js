const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'roles',
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Deploy interactive role panels')
    .addSubcommand(sub =>
      sub.setName('button')
         .setDescription('Create a self-assignable role button panel')
         .addChannelOption(opt => opt.setName('channel').setDescription('Where to send panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
         .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
         .addStringOption(opt => opt.setName('label').setDescription('Button label').setRequired(true))
         .addStringOption(opt => opt.setName('emoji').setDescription('Button emoji'))
    )
    .addSubcommand(sub =>
      sub.setName('select')
         .setDescription('Create a dropdown selection panel for roles')
         .addChannelOption(opt => opt.setName('channel').setDescription('Where to send panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
         .addStringOption(opt => opt.setName('roles').setDescription('Comma separated role IDs (e.g. 111,222,333)').setRequired(true))
         .addStringOption(opt => opt.setName('placeholder').setDescription('Dropdown placeholder text'))
    )
    .addSubcommand(sub =>
      sub.setName('verify')
         .setDescription('Deploy verification panel')
         .addChannelOption(opt => opt.setName('channel').setDescription('Where to send panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    if (subcommand === 'button') {
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('emoji');

      const button = new ButtonBuilder()
        .setCustomId(`role_add_${role.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);

      if (emoji) button.setEmoji(emoji);

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({
        ...v2(createContainer({
          title: "Get / Remove Roles",
          description: `Click below to toggle the **${role.name}** role.`,
          color: '#1e1f29',
          footer: false
        }), [row])
      });

      return interaction.reply({ content: `Successfully sent Button Role panel to ${channel}!`, flags: 64 });
    }

    if (subcommand === 'select') {
      const rolesInput = interaction.options.getString('roles');
      const placeholder = interaction.options.getString('placeholder') || "Select your roles...";
      
      const roleIds = rolesInput.split(',').map(id => id.trim());
      const selectMenuOptions = [];

      for (const id of roleIds) {
        const role = interaction.guild.roles.cache.get(id);
        if (role) {
          selectMenuOptions.push({
            label: role.name,
            value: role.id,
            description: `Toggle the ${role.name} role.`
          });
        }
      }

      if (selectMenuOptions.length === 0) {
        return interaction.reply({ content: "No valid role IDs found. Double check your input.", flags: 64 });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_select')
        .setPlaceholder(placeholder)
        .addOptions(selectMenuOptions)
        .setMinValues(0)
        .setMaxValues(selectMenuOptions.length);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await channel.send({
        ...v2(createContainer({
          title: "Self-Assign Roles Menu",
          description: "Choose any role(s) from the dropdown selection menu below.",
          color: '#1e1f29',
          footer: false
        }), [row])
      });

      return interaction.reply({ content: `Successfully sent Select Menu Role panel to ${channel}!`, flags: 64 });
    }

    if (subcommand === 'verify') {
      const button = new ButtonBuilder()
        .setCustomId('verify_join')
        .setLabel('Verify')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({
        ...v2(createContainer({
          title: "Server Verification",
          description: "To gain full access to this server, click the **Verify** button below to assign yourself the Verified role.",
          color: '#2ed573',
          footer: false
        }), [row])
      });

      return interaction.reply({ content: `Successfully sent Verification panel to ${channel}!`, flags: 64 });
    }
  }
};
