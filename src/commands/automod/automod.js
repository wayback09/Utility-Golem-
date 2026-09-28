const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

module.exports = {
  module: 'automod',
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure Automod settings')
    .addSubcommand(sub =>
      sub.setName('status')
         .setDescription('Show current automod settings')
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
         .setDescription('Toggle specific automod filter rules')
         .addStringOption(opt =>
           opt.setName('rule')
              .setDescription('The rule to toggle')
              .setRequired(true)
              .addChoices(
                { name: 'Anti Spam', value: 'anti_spam' },
                { name: 'Anti Invite Links', value: 'anti_invite' },
                { name: 'Anti Caps', value: 'anti_caps' },
                { name: 'Duplicate Message Detection', value: 'duplicate_detection' },
                { name: 'Raid Protection', value: 'raid_protection' }
              )
         )
         .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('mentions')
         .setDescription('Configure max allowed mentions in a single message')
         .addIntegerOption(opt => opt.setName('limit').setDescription('Max mentions allowed (0 to disable check)').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('badwords')
         .setDescription('Manage filtered bad words list')
         .addStringOption(opt => opt.setName('action').setDescription('Add or remove from bad words').setRequired(true).addChoices(
           { name: 'Add', value: 'add' },
           { name: 'Remove', value: 'remove' },
           { name: 'Clear All', value: 'clear' }
         ))
         .addStringOption(opt => opt.setName('word').setDescription('The word to add/remove'))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const settings = db.getAutomodSettings(guildId);

    if (subcommand === 'status') {
      let badWords = [];
      try { badWords = JSON.parse(settings.bad_words || '[]'); } catch (e) {}
      
      const fields = [
        { name: "Anti Spam", value: settings.anti_spam === 1 ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Anti Invite", value: settings.anti_invite === 1 ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Anti Caps", value: settings.anti_caps === 1 ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Duplicate Message", value: settings.duplicate_detection === 1 ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Raid Protection", value: settings.raid_protection === 1 ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Max Mentions Limit", value: settings.anti_mentions > 0 ? `Limit: ${settings.anti_mentions}` : "❌ Disabled", inline: true },
        { name: "Filtered Bad Words", value: badWords.length > 0 ? `\`${badWords.join(', ')}\`` : "None configured", inline: false }
      ];

      return interaction.reply({
        ...v2(createContainer({
          title: "Automod Status System",
          fields: fields,
          color: '#3498db',
          footer: false
        }))
      });
    }

    if (subcommand === 'toggle') {
      const rule = interaction.options.getString('rule');
      const enabled = interaction.options.getBoolean('enabled');
      const intVal = enabled ? 1 : 0;

      db.updateAutomodSettings(guildId, rule, intVal);

      return interaction.reply({
        ...v2(createContainer({
          description: `Successfully updated **${rule.replace('_', ' ')}** to: **${enabled ? 'ENABLED' : 'DISABLED'}**.`,
          color: '#2ed573',
          footer: false
        }))
      });
    }

    if (subcommand === 'mentions') {
      const limit = interaction.options.getInteger('limit');
      db.updateAutomodSettings(guildId, 'anti_mentions', limit);

      return interaction.reply({
        ...v2(createContainer({
          description: `Successfully set max mentions limit to **${limit}** (0 = disabled).`,
          color: '#2ed573',
          footer: false
        }))
      });
    }

    if (subcommand === 'badwords') {
      const action = interaction.options.getString('action');
      const word = interaction.options.getString('word');
      
      let words = [];
      try { words = JSON.parse(settings.bad_words || '[]'); } catch (e) {}

      if (action === 'clear') {
        db.updateAutomodSettings(guildId, 'bad_words', JSON.stringify([]));
        return interaction.reply({ content: "Cleared all filtered bad words." });
      }

      if (!word) {
        return interaction.reply({ content: "You must provide a word for add/remove actions.", flags: 64 });
      }

      if (action === 'add') {
        if (words.includes(word.toLowerCase())) {
          return interaction.reply({ content: `\`${word}\` is already in the bad words list.`, flags: 64 });
        }
        words.push(word.toLowerCase());
        db.updateAutomodSettings(guildId, 'bad_words', JSON.stringify(words));
        return interaction.reply({ content: `Added \`${word}\` to filtered words list.` });
      }

      if (action === 'remove') {
        if (!words.includes(word.toLowerCase())) {
          return interaction.reply({ content: `\`${word}\` is not in the bad words list.`, flags: 64 });
        }
        words = words.filter(w => w !== word.toLowerCase());
        db.updateAutomodSettings(guildId, 'bad_words', JSON.stringify(words));
        return interaction.reply({ content: `Removed \`${word}\` from filtered words list.` });
      }
    }
  }
};
