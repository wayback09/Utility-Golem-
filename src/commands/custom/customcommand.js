const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createEmbed } = require('../../utils/embedBuilder');

function formatPermissions(cmd) {
  const parts = [];
  if (cmd.allowed_roles && cmd.allowed_roles.length > 0) {
    parts.push(`Roles: ${cmd.allowed_roles.map(r => `<@&${r}>`).join(', ')}`);
  }
  if (cmd.allowed_users && cmd.allowed_users.length > 0) {
    parts.push(`Users: ${cmd.allowed_users.map(u => `<@${u}>`).join(', ')}`);
  }
  if (cmd.required_permission) {
    parts.push(`Perm: \`${cmd.required_permission}\``);
  }
  return parts.length > 0 ? parts.join(' | ') : 'Everyone';
}

module.exports = {
  module: 'utility',
  data: new SlashCommandBuilder()
    .setName('customcommand')
    .setDescription('Manage custom server commands and permissions')
    .addSubcommand(sub =>
      sub.setName('create')
         .setDescription('Create a new custom command')
         .addStringOption(opt => opt.setName('name').setDescription('Command triggers (e.g. "ip")').setRequired(true))
         .addStringOption(opt => opt.setName('response').setDescription('What the command responds with').setRequired(true))
         .addBooleanOption(opt => opt.setName('embed').setDescription('Respond with an embed instead of plain text'))
         .addRoleOption(opt => opt.setName('role').setDescription('Restrict command to this role'))
         .addUserOption(opt => opt.setName('user').setDescription('Restrict command to this specific user'))
         .addStringOption(opt =>
           opt.setName('permission')
              .setDescription('Restrict command to users with this Discord permission')
              .addChoices(
                { name: 'Administrator', value: 'Administrator' },
                { name: 'Manage Server', value: 'ManageGuild' },
                { name: 'Manage Messages', value: 'ManageMessages' },
                { name: 'Moderate Members (Timeout)', value: 'ModerateMembers' },
                { name: 'Kick Members', value: 'KickMembers' },
                { name: 'Ban Members', value: 'BanMembers' },
                { name: 'Mention Everyone', value: 'MentionEveryone' }
              )
         )
    )
    .addSubcommand(sub =>
      sub.setName('permissions')
         .setDescription('Configure who can use a custom command')
         .addStringOption(opt => opt.setName('name').setDescription('Command trigger name').setRequired(true))
         .addStringOption(opt =>
           opt.setName('action')
              .setDescription('Permission action')
              .setRequired(true)
              .addChoices(
                { name: 'View Permissions', value: 'view' },
                { name: 'Add Allowed Role', value: 'add_role' },
                { name: 'Remove Allowed Role', value: 'remove_role' },
                { name: 'Add Allowed User', value: 'add_user' },
                { name: 'Remove Allowed User', value: 'remove_user' },
                { name: 'Set Required Permission', value: 'set_permission' },
                { name: 'Clear All Restrictions (Make Public)', value: 'clear_restrictions' }
              )
         )
         .addRoleOption(opt => opt.setName('role').setDescription('Role to add or remove'))
         .addUserOption(opt => opt.setName('user').setDescription('User to add or remove'))
         .addStringOption(opt =>
           opt.setName('permission')
              .setDescription('Discord permission required to run the command')
              .addChoices(
                { name: 'None (Clear permission requirement)', value: 'none' },
                { name: 'Administrator', value: 'Administrator' },
                { name: 'Manage Server', value: 'ManageGuild' },
                { name: 'Manage Messages', value: 'ManageMessages' },
                { name: 'Moderate Members (Timeout)', value: 'ModerateMembers' },
                { name: 'Kick Members', value: 'KickMembers' },
                { name: 'Ban Members', value: 'BanMembers' },
                { name: 'Mention Everyone', value: 'MentionEveryone' }
              )
         )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
         .setDescription('Deletes a custom command')
         .addStringOption(opt => opt.setName('name').setDescription('Command trigger name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
         .setDescription('Lists all custom commands on this server')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'create') {
      const name = interaction.options.getString('name').toLowerCase().trim();
      const response = interaction.options.getString('response');
      const isEmbed = interaction.options.getBoolean('embed') ? 1 : 0;
      const role = interaction.options.getRole('role');
      const user = interaction.options.getUser('user');
      const permission = interaction.options.getString('permission');

      // Prevent overwriting built-in commands
      if (interaction.client.commands.has(name)) {
        return interaction.reply({ content: `\`/${name}\` is a built-in command and cannot be overwritten.`, flags: 64 });
      }

      const allowedRoles = role ? [role.id] : [];
      const allowedUsers = user ? [user.id] : [];
      const requiredPermission = (permission && permission !== 'none') ? permission : null;

      db.saveCustomCommand(guildId, name, response, isEmbed, allowedRoles, allowedUsers, requiredPermission);

      const settings = db.getGuildSettings(guildId);
      const prefix = settings.prefix || 'g!';
      const preview = response.length > 80 ? response.slice(0, 80) + '...' : response;

      const createdCmd = db.getCustomCommand(guildId, name) || { allowed_roles: allowedRoles, allowed_users: allowedUsers, required_permission: requiredPermission };

      return interaction.reply({
        embeds: [createEmbed({
          title: 'Custom Command Created',
          description: `Command \`${prefix}${name}\` is ready to use!`,
          fields: [
            { name: 'Response Type', value: isEmbed === 1 ? 'Embed' : 'Plain Text', inline: true },
            { name: 'Access', value: formatPermissions(createdCmd), inline: true },
            { name: 'Preview', value: preview || '(no content)', inline: false }
          ],
          color: '#2ed573'
        })]
      });
    }

    if (subcommand === 'permissions') {
      const name = interaction.options.getString('name').toLowerCase().trim();
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      const user = interaction.options.getUser('user');
      const permission = interaction.options.getString('permission');

      const cmd = db.getCustomCommand(guildId, name);
      if (!cmd) {
        return interaction.reply({ content: `Custom command \`${name}\` not found on this server.`, flags: 64 });
      }

      let allowedRoles = Array.isArray(cmd.allowed_roles) ? [...cmd.allowed_roles] : [];
      let allowedUsers = Array.isArray(cmd.allowed_users) ? [...cmd.allowed_users] : [];
      let requiredPermission = cmd.required_permission || null;

      if (action === 'view') {
        return interaction.reply({
          embeds: [createEmbed({
            title: `Permissions: \`${name}\``,
            fields: [
              { name: 'Allowed Roles', value: allowedRoles.length > 0 ? allowedRoles.map(id => `<@&${id}>`).join(', ') : 'None specified', inline: true },
              { name: 'Allowed Users', value: allowedUsers.length > 0 ? allowedUsers.map(id => `<@${id}>`).join(', ') : 'None specified', inline: true },
              { name: 'Required Permission', value: requiredPermission ? `\`${requiredPermission}\`` : 'None', inline: true },
              { name: 'Overall Access', value: formatPermissions(cmd), inline: false }
            ],
            color: '#5865F2'
          })]
        });
      }

      if (action === 'add_role') {
        if (!role) {
          return interaction.reply({ content: 'Please provide a role using the `role` option.', flags: 64 });
        }
        if (allowedRoles.includes(role.id)) {
          return interaction.reply({ content: `Role ${role} is already in the allowed list for \`${name}\`.`, flags: 64 });
        }
        allowedRoles.push(role.id);
        db.setCustomCommandPermissions(guildId, name, { allowed_roles: allowedRoles });
        return interaction.reply({ content: `Added role ${role} to allowed roles for custom command \`${name}\`.` });
      }

      if (action === 'remove_role') {
        if (!role) {
          return interaction.reply({ content: 'Please provide a role using the `role` option.', flags: 64 });
        }
        if (!allowedRoles.includes(role.id)) {
          return interaction.reply({ content: `Role ${role} is not in the allowed list for \`${name}\`.`, flags: 64 });
        }
        allowedRoles = allowedRoles.filter(id => id !== role.id);
        db.setCustomCommandPermissions(guildId, name, { allowed_roles: allowedRoles });
        return interaction.reply({ content: `Removed role ${role} from allowed roles for custom command \`${name}\`.` });
      }

      if (action === 'add_user') {
        if (!user) {
          return interaction.reply({ content: 'Please provide a user using the `user` option.', flags: 64 });
        }
        if (allowedUsers.includes(user.id)) {
          return interaction.reply({ content: `User ${user} is already in the allowed list for \`${name}\`.`, flags: 64 });
        }
        allowedUsers.push(user.id);
        db.setCustomCommandPermissions(guildId, name, { allowed_users: allowedUsers });
        return interaction.reply({ content: `Added user ${user} to allowed users for custom command \`${name}\`.` });
      }

      if (action === 'remove_user') {
        if (!user) {
          return interaction.reply({ content: 'Please provide a user using the `user` option.', flags: 64 });
        }
        if (!allowedUsers.includes(user.id)) {
          return interaction.reply({ content: `User ${user} is not in the allowed list for \`${name}\`.`, flags: 64 });
        }
        allowedUsers = allowedUsers.filter(id => id !== user.id);
        db.setCustomCommandPermissions(guildId, name, { allowed_users: allowedUsers });
        return interaction.reply({ content: `Removed user ${user} from allowed users for custom command \`${name}\`.` });
      }

      if (action === 'set_permission') {
        if (!permission) {
          return interaction.reply({ content: 'Please select a permission using the `permission` option.', flags: 64 });
        }
        const newPerm = permission === 'none' ? null : permission;
        db.setCustomCommandPermissions(guildId, name, { required_permission: newPerm });
        return interaction.reply({ content: newPerm ? `Required permission for \`${name}\` set to \`${newPerm}\`.` : `Removed required permission for \`${name}\`.` });
      }

      if (action === 'clear_restrictions') {
        db.setCustomCommandPermissions(guildId, name, { allowed_roles: [], allowed_users: [], required_permission: null });
        return interaction.reply({ content: `Cleared all restrictions for \`${name}\`. It is now usable by everyone.` });
      }
    }

    if (subcommand === 'delete') {
      const name = interaction.options.getString('name').toLowerCase().trim();
      const deleted = db.deleteCustomCommand(guildId, name);

      if (deleted) {
        return interaction.reply({ content: `Successfully deleted custom command \`${name}\`.` });
      } else {
        return interaction.reply({ content: `Custom command \`${name}\` not found on this server.`, flags: 64 });
      }
    }

    if (subcommand === 'list') {
      const cmds = db.getCustomCommands(guildId);
      const cmdNames = Object.keys(cmds);

      if (cmdNames.length === 0) {
        return interaction.reply({ content: "No custom commands configured for this server yet." });
      }

      const settings = db.getGuildSettings(guildId);
      const prefix = settings.prefix || 'g!';

      return interaction.reply({
        embeds: [createEmbed({
          title: "Custom Commands List",
          description: cmdNames.map(name => `• **${prefix}${name}** (${cmds[name].is_embed === 1 ? 'Embed' : 'Text'})\n  └ *Access:* ${formatPermissions(cmds[name])}`).join('\n\n'),
          color: '#5865F2'
        })]
      });
    }
  }
};
