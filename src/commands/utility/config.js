const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'utility',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Golem server settings')
    .addSubcommand(sub =>
      sub.setName('module')
         .setDescription('Enable or disable Golem bot modules')
         .addStringOption(opt =>
           opt.setName('name')
              .setDescription('The module name')
              .setRequired(true)
               .addChoices(
                { name: 'Moderation', value: 'moderation' },
                { name: 'Automod', value: 'automod' },
                { name: 'Logging', value: 'logging' },
                { name: 'Welcome System', value: 'welcome' },
                { name: 'Roles', value: 'roles' },
                { name: 'Ticketing', value: 'tickets' },
                { name: 'Suggestions', value: 'suggestions' },
                { name: 'Giveaways', value: 'giveaways' },
                { name: 'Leveling', value: 'leveling' },
                { name: 'Starboard', value: 'starboard' },
                { name: 'Minecraft Integration', value: 'minecraft' },
                { name: 'Applications', value: 'applications' }
               )
         )
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Toggle state').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('welcome')
         .setDescription('Configure Welcome Messages')
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable welcome messages').setRequired(true))
         .addChannelOption(opt => opt.setName('channel').setDescription('Where welcome embeds are sent').addChannelTypes(ChannelType.GuildText))
         .addStringOption(opt => opt.setName('message').setDescription('Message support variables: {user}, {username}, {server}, {membercount}'))
    )
    .addSubcommand(sub =>
      sub.setName('goodbye')
         .setDescription('Configure Goodbye Messages')
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable goodbye messages').setRequired(true))
         .addChannelOption(opt => opt.setName('channel').setDescription('Where goodbye embeds are sent').addChannelTypes(ChannelType.GuildText))
         .addStringOption(opt => opt.setName('message').setDescription('Message support variables: {user}, {username}, {server}, {membercount}'))
    )
    .addSubcommand(sub =>
      sub.setName('logging')
         .setDescription('Configure Server Logging channel')
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable server logging').setRequired(true))
         .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('starboard')
         .setDescription('Configure Starboard channel')
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable starboard').setRequired(true))
         .addChannelOption(opt => opt.setName('channel').setDescription('Starboard channel').addChannelTypes(ChannelType.GuildText))
         .addIntegerOption(opt => opt.setName('threshold').setDescription('Required stars to pin (default: 3)').setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('commands')
         .setDescription('Manage channels where only slash commands are allowed')
         .addStringOption(opt =>
           opt.setName('action')
              .setDescription('Add or remove the channel')
              .setRequired(true)
              .addChoices(
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' }
              )
         )
         .addChannelOption(opt =>
           opt.setName('channel')
              .setDescription('Channel to add or remove (defaults to current channel)')
              .addChannelTypes(ChannelType.GuildText)
         )
    )
    .addSubcommand(sub =>
      sub.setName('commandchannels')
         .setDescription('Restrict a slash command to specific channels')
         .addStringOption(opt =>
           opt.setName('command')
              .setDescription('Command name (e.g. level, giveaway, tickets)')
              .setRequired(true)
         )
         .addStringOption(opt =>
           opt.setName('action')
              .setDescription('Add or remove the channel')
              .setRequired(true)
              .addChoices(
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' }
              )
         )
         .addChannelOption(opt =>
           opt.setName('channel')
              .setDescription('Channel to add or remove (defaults to current channel)')
              .addChannelTypes(ChannelType.GuildText)
         )
    )
    .addSubcommand(sub =>
      sub.setName('modmail')
         .setDescription('Configure modmail staff channel and role (file-free)')
         .addChannelOption(opt => opt.setName('channel').setDescription('Staff channel for modmail').addChannelTypes(ChannelType.GuildText))
         .addRoleOption(opt => opt.setName('role').setDescription('Staff role to ping for modmail'))
    )
    .addSubcommand(sub =>
      sub.setName('puzzle')
         .setDescription('Configure puzzle submission channels and roles (file-free)')
         .addChannelOption(opt => opt.setName('channel').setDescription('Staff review channel').addChannelTypes(ChannelType.GuildText))
         .addRoleOption(opt => opt.setName('role').setDescription('Staff role for puzzle review'))
         .addChannelOption(opt => opt.setName('public_channel').setDescription('Public puzzle channel (text or forum)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum))
         .addRoleOption(opt => opt.setName('post_role').setDescription('Role to ping when puzzle is published'))
    )
    .addSubcommand(sub =>
       sub.setName('status')
          .setDescription('Display current server config status')
    )
    .addSubcommand(sub =>
       sub.setName('application')
          .setDescription('Configure staff applications (file-free)')
          .addChannelOption(opt => opt.setName('channel').setDescription('Staff review channel').addChannelTypes(ChannelType.GuildText))
          .addRoleOption(opt => opt.setName('role').setDescription('Staff role to ping on new application'))
          .addRoleOption(opt => opt.setName('accept_role').setDescription('Role auto-assigned when an application is approved'))
          .addIntegerOption(opt => opt.setName('cooldown_hours').setDescription('Hours a rejected applicant must wait before re-applying').setMinValue(0).setMaxValue(720))
    )
    .addSubcommand(sub =>
       sub.setName('application_questions')
          .setDescription('Manage staff application questions (max 5)')
          .addStringOption(opt =>
            opt.setName('action')
               .setDescription('What to do')
               .setRequired(true)
               .addChoices(
                 { name: 'List', value: 'list' },
                 { name: 'Add', value: 'add' },
                 { name: 'Remove', value: 'remove' },
                 { name: 'Clear', value: 'clear' }
               )
          )
          .addStringOption(opt => opt.setName('label').setDescription('Question label (for add, max 45 chars)').setMaxLength(45))
          .addStringOption(opt => opt.setName('placeholder').setDescription('Ghost text inside the answer box (for add)').setMaxLength(100))
          .addBooleanOption(opt => opt.setName('required').setDescription('Must the applicant answer it? (default true)'))
          .addBooleanOption(opt => opt.setName('short').setDescription('Single-line answer instead of paragraph? (default false)'))
          .addIntegerOption(opt => opt.setName('index').setDescription('Question number to remove (see list)').setMinValue(1).setMaxValue(5))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const settings = db.getGuildSettings(guildId);

    if (subcommand === 'status') {
      let enabledModules = [];
      try { enabledModules = JSON.parse(settings.enabled_modules || '[]'); } catch (e) {}

      const cmdOnly = settings.commandOnlyChannels || [];
      const cmdOnlyVal = cmdOnly.length > 0 ? cmdOnly.map(id => `<#${id}>`).join(', ') : 'None (chat allowed everywhere)';
      const cmdChObj = settings.commandChannels || {};
      const cmdChLines = Object.keys(cmdChObj).length > 0
        ? Object.entries(cmdChObj).map(([cmd, arr]) => `**/${cmd}**: ${arr.length>0 ? arr.map(id=>`<#${id}>`).join(', ') : 'everywhere'}`).join('\n')
        : 'None (all commands allowed everywhere)';

      const modmailCh = settings.forms_modmail_channel ? `<#${settings.forms_modmail_channel}>` : '`not set`';
      const modmailRole = settings.forms_modmail_role ? `<@&${settings.forms_modmail_role}>` : '`not set`';
      const puzzleCh = settings.forms_puzzle_channel ? `<#${settings.forms_puzzle_channel}>` : '`not set`';
      const puzzleRole = settings.forms_puzzle_role ? `<@&${settings.forms_puzzle_role}>` : '`not set`';
      const puzzlePublic = settings.forms_puzzle_publicChannel ? `<#${settings.forms_puzzle_publicChannel}>` : '`not set`';
      const puzzlePost = settings.forms_puzzle_postRole ? `<@&${settings.forms_puzzle_postRole}>` : '`not set`';
      const applyCh = settings.forms_apply_channel ? `<#${settings.forms_apply_channel}>` : '`not set`';
      const applyRole = settings.forms_apply_role ? `<@&${settings.forms_apply_role}>` : '`not set`';
      const applyAccept = settings.forms_apply_acceptRole ? `<@&${settings.forms_apply_acceptRole}>` : '`not set`';
      let applyQCount = 0;
      try {
        const aq = JSON.parse(settings.forms_apply_questions || '[]');
        if (Array.isArray(aq)) applyQCount = aq.length;
      } catch { applyQCount = 0; }

      return interaction.reply({
        ...v2(createContainer({
          title: `${interaction.guild.name} Settings`,
          description: "Configure options using `/config [subcommand]`. All settings are per-server (DB authoritative, `config.json` is fallback only).",
          fields: [
          { name: "Enabled Modules", value: enabledModules.length > 0 ? `\`${enabledModules.join(', ')}\`` : "None", inline: false },
          { name: "Welcome System", value: settings.welcome_enabled === 1 ? `Channel: <#${settings.welcome_channel}>\nMessage: \`${settings.welcome_message}\`` : "❌ Disabled", inline: false },
          { name: "Goodbye System", value: settings.goodbye_enabled === 1 ? `Channel: <#${settings.goodbye_channel}>\nMessage: \`${settings.goodbye_message}\`` : "❌ Disabled", inline: false },
          { name: "Logging System", value: settings.logging_enabled === 1 ? `Channel: <#${settings.logging_channel}>` : "❌ Disabled", inline: true },
          { name: "Starboard", value: settings.starboard_enabled === 1 ? `Channel: <#${settings.starboard_channel}> | Stars: ${settings.starboard_threshold}` : "❌ Disabled", inline: true },
          { name: "Prefix / Embed", value: `Prefix: \`${settings.prefix || 'g!'}\` | Color: \`${settings.embedColor || 'default'}\` | LevelUp: ${settings.levelUpChannel ? `<#${settings.levelUpChannel}>` : '`not set`'}`, inline: false },
          { name: "Command-Only Channels", value: cmdOnlyVal, inline: false },
          { name: "Command Restrictions", value: cmdChLines.slice(0,1024), inline: false },
          { name: "Modmail", value: `Channel: ${modmailCh} | Role: ${modmailRole}`, inline: true },
          { name: "Puzzle", value: `Review: ${puzzleCh} | Role: ${puzzleRole}\nPublic: ${puzzlePublic} | Post Role: ${puzzlePost}`, inline: true },
          { name: "Applications", value: `Review: ${applyCh} | Role: ${applyRole}\nAccept Role: ${applyAccept} | Questions: ${applyQCount > 0 ? applyQCount : 'defaults (3)'}`, inline: false }
        ],
        color: '#1e1f29',
        footer: false
      }))
      });
    }

    if (subcommand === 'commands') {
      const action = interaction.options.getString('action');
      const selectedChannel = interaction.options.getChannel('channel');
      const targetChannel = selectedChannel || interaction.channel;

      if (!targetChannel || !targetChannel.id) {
        return interaction.reply({ content: 'Could not determine the target channel.', flags: 64 });
      }

      // Ensure we read from the correct guild settings (fixes PR bug where channel.id was used)
      let current = settings.commandOnlyChannels;
      if (typeof current === 'string') {
        try { current = JSON.parse(current); } catch { current = []; }
      }
      if (!Array.isArray(current)) current = [];

      if (action === 'add') {
        if (current.includes(targetChannel.id)) {
          return interaction.reply({ content: `Channel ${targetChannel} is already in the command-only list.`, flags: 64 });
        }
        const updated = [...current, targetChannel.id];
        db.updateGuildSettings(guildId, 'commandOnlyChannels', updated);
        return interaction.reply({ content: `Added ${targetChannel} to command-only channels. Messages there will be deleted unless they are slash commands.` });
      } else {
        if (!current.includes(targetChannel.id)) {
          return interaction.reply({ content: `Channel ${targetChannel} is not in the command-only list.`, flags: 64 });
        }
        const updated = current.filter(id => id !== targetChannel.id);
        db.updateGuildSettings(guildId, 'commandOnlyChannels', updated);
        return interaction.reply({ content: `Removed ${targetChannel} from command-only channels.` });
      }
    }

    if (subcommand === 'commandchannels') {
      const commandName = interaction.options.getString('command').toLowerCase().trim();
      const action = interaction.options.getString('action');
      const selectedChannel = interaction.options.getChannel('channel');
      const targetChannel = selectedChannel || interaction.channel;

      if (!targetChannel || !targetChannel.id) {
        return interaction.reply({ content: 'Could not determine the target channel.', flags: 64 });
      }
      if (!commandName) {
        return interaction.reply({ content: 'Please provide a valid command name.', flags: 64 });
      }

      let currentObj = settings.commandChannels;
      if (typeof currentObj === 'string') {
        try { currentObj = JSON.parse(currentObj); } catch { currentObj = {}; }
      }
      if (!currentObj || typeof currentObj !== 'object' || Array.isArray(currentObj)) currentObj = {};

      let arr = currentObj[commandName];
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = []; }
      }
      if (!Array.isArray(arr)) arr = [];

      if (action === 'add') {
        if (arr.includes(targetChannel.id)) {
          return interaction.reply({ content: `Channel ${targetChannel} is already allowed for \`/${commandName}\`.`, flags: 64 });
        }
        arr = [...arr, targetChannel.id];
        currentObj[commandName] = arr;
        db.updateGuildSettings(guildId, 'commandChannels', currentObj);
        return interaction.reply({ content: `Added ${targetChannel} to allowed channels for \`/${commandName}\`. The command will now only work there${arr.length > 1 ? ' (and other configured channels)' : ''}.` });
      } else {
        if (!arr.includes(targetChannel.id)) {
          return interaction.reply({ content: `Channel ${targetChannel} is not in the allowed list for \`/${commandName}\`.`, flags: 64 });
        }
        arr = arr.filter(id => id !== targetChannel.id);
        currentObj[commandName] = arr;
        db.updateGuildSettings(guildId, 'commandChannels', currentObj);
        const extra = arr.length === 0 ? ' The command will now be allowed everywhere (no restriction).' : '';
        return interaction.reply({ content: `Removed ${targetChannel} from allowed channels for \`/${commandName}\`.${extra}` });
      }
    }

    if (subcommand === 'modmail') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      if (!channel && !role) {
        // Show current config
        const curCh = settings.forms_modmail_channel ? `<#${settings.forms_modmail_channel}>` : '`not set`';
        const curRole = settings.forms_modmail_role ? `<@&${settings.forms_modmail_role}>` : '`not set`';
        return interaction.reply({ content: `**Modmail config:**\nChannel: ${curCh}\nRole: ${curRole}\n\nProvide \`channel\` and/or \`role\` to update.`, flags: 64 });
      }
      if (channel) db.updateGuildSettings(guildId, 'forms_modmail_channel', channel.id);
      if (role) db.updateGuildSettings(guildId, 'forms_modmail_role', role.id);
      const updated = db.getGuildSettings(guildId);
      return interaction.reply({ content: `Modmail configured — Channel: ${updated.forms_modmail_channel ? `<#${updated.forms_modmail_channel}>` : '`not set`'} | Role: ${updated.forms_modmail_role ? `<@&${updated.forms_modmail_role}>` : '`not set`'}` });
    }

    if (subcommand === 'puzzle') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const publicChannel = interaction.options.getChannel('public_channel');
      const postRole = interaction.options.getRole('post_role');
      if (!channel && !role && !publicChannel && !postRole) {
        const cur = settings;
        const fmtCh = (id) => id ? `<#${id}>` : '`not set`';
        const fmtRole = (id) => id ? `<@&${id}>` : '`not set`';
        return interaction.reply({
          content: `**Puzzle config:**\nReview Channel: ${fmtCh(cur.forms_puzzle_channel)}\nReview Role: ${fmtRole(cur.forms_puzzle_role)}\nPublic Channel: ${fmtCh(cur.forms_puzzle_publicChannel)}\nPost Role: ${fmtRole(cur.forms_puzzle_postRole)}\n\nProvide any option to update.`,
          flags: 64
        });
      }
      if (channel) db.updateGuildSettings(guildId, 'forms_puzzle_channel', channel.id);
      if (role) db.updateGuildSettings(guildId, 'forms_puzzle_role', role.id);
      if (publicChannel) db.updateGuildSettings(guildId, 'forms_puzzle_publicChannel', publicChannel.id);
      if (postRole) db.updateGuildSettings(guildId, 'forms_puzzle_postRole', postRole.id);
      const u = db.getGuildSettings(guildId);
      return interaction.reply({ content: `Puzzle configured — Review: ${u.forms_puzzle_channel ? `<#${u.forms_puzzle_channel}>` : '`not set`'} | Role: ${u.forms_puzzle_role ? `<@&${u.forms_puzzle_role}>` : '`not set`'} | Public: ${u.forms_puzzle_publicChannel ? `<#${u.forms_puzzle_publicChannel}>` : '`not set`'} | Post Role: ${u.forms_puzzle_postRole ? `<@&${u.forms_puzzle_postRole}>` : '`not set`'}` });
    }

    if (subcommand === 'application') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const acceptRole = interaction.options.getRole('accept_role');
      const cooldownHours = interaction.options.getInteger('cooldown_hours');
      if (!channel && !role && !acceptRole && cooldownHours === null) {
        const cur = settings;
        const fmtCh = (id) => id ? `<#${id}>` : '`not set`';
        const fmtRole = (id) => id ? `<@&${id}>` : '`not set`';
        let questions = [];
        try { questions = JSON.parse(cur.forms_apply_questions || '[]'); } catch { questions = []; }
        const qLines = questions.length > 0
          ? questions.map((q, i) => `**${i + 1}.** ${q.label}${q.required === false ? ' _(optional)_' : ''}`).join('\n')
          : '_(defaults will be used — add your own with `/config application_questions action:Add`)_';
        const cd = cur.forms_apply_cooldown !== null && cur.forms_apply_cooldown !== undefined
          ? `${Math.round(Number(cur.forms_apply_cooldown) / 3600 * 10) / 10}h` : '`default (24h)`';
        return interaction.reply({
          content: `**Application config:**\nReview Channel: ${fmtCh(cur.forms_apply_channel)}\nReview Role: ${fmtRole(cur.forms_apply_role)}\nAccept Role (auto-assigned): ${fmtRole(cur.forms_apply_acceptRole)}\nReject Cooldown: ${cd}\nQuestions:\n${qLines}\n\nProvide any option to update.`,
          flags: 64
        });
      }
      if (channel) db.updateGuildSettings(guildId, 'forms_apply_channel', channel.id);
      if (role) db.updateGuildSettings(guildId, 'forms_apply_role', role.id);
      if (acceptRole) db.updateGuildSettings(guildId, 'forms_apply_acceptRole', acceptRole.id);
      if (cooldownHours !== null) db.updateGuildSettings(guildId, 'forms_apply_cooldown', cooldownHours * 3600);
      const a = db.getGuildSettings(guildId);
      return interaction.reply({ content: `Applications configured — Review: ${a.forms_apply_channel ? `<#${a.forms_apply_channel}>` : '`not set`'} | Role: ${a.forms_apply_role ? `<@&${a.forms_apply_role}>` : '`not set`'} | Accept Role: ${a.forms_apply_acceptRole ? `<@&${a.forms_apply_acceptRole}>` : '`not set`'} | Cooldown: ${a.forms_apply_cooldown !== null ? `${Number(a.forms_apply_cooldown) / 3600}h` : 'default'}` });
    }

    if (subcommand === 'application_questions') {
      const action = interaction.options.getString('action');
      let questions = [];
      try { questions = JSON.parse(settings.forms_apply_questions || '[]'); } catch { questions = []; }
      if (!Array.isArray(questions)) questions = [];

      if (action === 'list') {
        const lines = questions.length > 0
          ? questions.map((q, i) => `**${i + 1}.** ${q.label}${q.placeholder ? ` _(“${q.placeholder}”)_` : ''}${q.required === false ? ' _(optional)_' : ''}${q.short ? ' _(short)_' : ''}`).join('\n')
          : 'No custom questions yet — `/apply` will use the 3 defaults. Add up to 5 with `action:Add`.';
        return interaction.reply({ content: `**Application questions (${questions.length}/5):**\n${lines}`, flags: 64 });
      }

      if (action === 'clear') {
        db.updateGuildSettings(guildId, 'forms_apply_questions', JSON.stringify([]));
        return interaction.reply({ content: 'Cleared all custom questions. `/apply` will use the defaults until you add new ones.' });
      }

      if (action === 'add') {
        const label = (interaction.options.getString('label') || '').trim();
        if (!label) return interaction.reply({ content: 'Provide a `label` for the new question (max 45 characters).', flags: 64 });
        if (questions.length >= 5) return interaction.reply({ content: 'Maximum of 5 questions reached. Remove one first (`action:Remove`).', flags: 64 });
        const placeholder = (interaction.options.getString('placeholder') || '').trim() || null;
        const required = interaction.options.getBoolean('required');
        const short = interaction.options.getBoolean('short');
        questions.push({
          label: label.slice(0, 45),
          placeholder: placeholder ? placeholder.slice(0, 100) : null,
          required: required === null ? true : required,
          short: short === true
        });
        db.updateGuildSettings(guildId, 'forms_apply_questions', JSON.stringify(questions));
        return interaction.reply({ content: `Added question **${questions.length}**: “${label}”.` });
      }

      // remove
      const index = interaction.options.getInteger('index');
      if (!index) return interaction.reply({ content: 'Provide the `index` of the question to remove (see `action:List`).', flags: 64 });
      if (index < 1 || index > questions.length) return interaction.reply({ content: `Invalid index — there are ${questions.length} question(s).`, flags: 64 });
      const removed = questions.splice(index - 1, 1)[0];
      db.updateGuildSettings(guildId, 'forms_apply_questions', JSON.stringify(questions));
      return interaction.reply({ content: `Removed question **${index}**: “${removed.label}”.` });
    }

    if (subcommand === 'module') {
      const name = interaction.options.getString('name');
      const enabled = interaction.options.getBoolean('enabled');
      
      let enabledModules = [];
      try { enabledModules = JSON.parse(settings.enabled_modules || '[]'); } catch (e) {}

      if (enabled) {
        if (!enabledModules.includes(name)) enabledModules.push(name);
      } else {
        enabledModules = enabledModules.filter(m => m !== name);
      }

      db.updateGuildSettings(guildId, 'enabled_modules', JSON.stringify(enabledModules));

      return interaction.reply({
        content: `Module **${name}** has been **${enabled ? 'ENABLED' : 'DISABLED'}**.`
      });
    }

    if (subcommand === 'welcome') {
      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');

      db.updateGuildSettings(guildId, 'welcome_enabled', enabled ? 1 : 0);
      if (channel) db.updateGuildSettings(guildId, 'welcome_channel', channel.id);
      if (message) db.updateGuildSettings(guildId, 'welcome_message', message);

      return interaction.reply({ content: "Welcome system configurations saved successfully." });
    }

    if (subcommand === 'goodbye') {
      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');

      db.updateGuildSettings(guildId, 'goodbye_enabled', enabled ? 1 : 0);
      if (channel) db.updateGuildSettings(guildId, 'goodbye_channel', channel.id);
      if (message) db.updateGuildSettings(guildId, 'goodbye_message', message);

      return interaction.reply({ content: "Goodbye system configurations saved successfully." });
    }

    if (subcommand === 'logging') {
      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');

      db.updateGuildSettings(guildId, 'logging_enabled', enabled ? 1 : 0);
      if (channel) db.updateGuildSettings(guildId, 'logging_channel', channel.id);

      return interaction.reply({ content: "Logging system configurations saved successfully." });
    }

    if (subcommand === 'starboard') {
      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold');

      db.updateGuildSettings(guildId, 'starboard_enabled', enabled ? 1 : 0);
      if (channel) db.updateGuildSettings(guildId, 'starboard_channel', channel.id);
      if (threshold) db.updateGuildSettings(guildId, 'starboard_threshold', threshold);

      return interaction.reply({ content: "Starboard configurations saved successfully." });
    }
  }
};
