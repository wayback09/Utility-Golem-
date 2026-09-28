const { SlashCommandBuilder } = require('discord.js');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

function getFormsConfig(guildId) {
  try {
    const db = require('../../database/db');
    // DB authoritative — file is fallback only (preserves both servers)
    const settings = db.getGuildSettings(guildId);
    if (settings && (settings.forms_modmail_channel || settings.forms_modmail_role)) {
      return {
        channel: settings.forms_modmail_channel || null,
        role: settings.forms_modmail_role || null
      };
    }
    const cfg = db.getGuildConfig(guildId);
    return (cfg.forms && cfg.forms.modmail) || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Send a message to the moderation team')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Short reason/category for the message (e.g. report, appeal, question)')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Explain what this is about')
        .setRequired(true)
        .setMaxLength(2000))
    .addAttachmentOption(opt =>
      opt.setName('image1')
        .setDescription('Screenshot/attachment (optional)'))
    .addAttachmentOption(opt =>
      opt.setName('image2')
        .setDescription('Screenshot/attachment (optional)'))
    .addAttachmentOption(opt =>
      opt.setName('image3')
        .setDescription('Screenshot/attachment (optional)')),
  async execute(interaction) {
    const reason = interaction.options.getString('reason');
    const description = interaction.options.getString('description');
    const images = ['image1', 'image2', 'image3']
      .map(k => interaction.options.getAttachment(k))
      .filter(a => a && a.contentType && a.contentType.startsWith('image/'))
      .slice(0, 3);

    const cfg = getFormsConfig(interaction.guildId);

    await interaction.deferReply({ flags: 64 });

    if (!cfg || !cfg.channel || !cfg.role) {
      return interaction.editReply({
        content: "The modmail system isn't configured yet. An administrator should run `/config modmail channel:#staff-channel role:@Staff` — or add `forms.modmail` in `config.json` as fallback."
      });
    }

    // Coerce IDs to strings — unquoted numeric IDs in JSON lose precision and break lookups
    const targetChannel = interaction.guild.channels.cache.get(String(cfg.channel));
    if (!targetChannel) {
      return interaction.editReply({ content: "The configured modmail channel no longer exists in this server." });
    }
    if (!targetChannel.isTextBased()) {
      return interaction.editReply({ content: "The configured modmail channel isn't a text channel, so messages can't be sent there." });
    }

    // Re-host the images as message attachments and expose them through the
    // gallery (V2 hides attachments unless a component references them)
    const files = images.map((a, i) => ({ attachment: a.url, name: `modmail-${i}-${a.name}` }));
    const container = createContainer({
      title: "Mod Mail Submission",
      description: `<@&${String(cfg.role)}> — new message from ${interaction.user} in ${interaction.channel}.\n${description}`,
      fields: [
        { name: "Reason", value: reason.slice(0, 1024), inline: true },
        { name: "From", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: true }
      ],
      image: files.map(f => ({ url: `attachment://${f.name}`, description: f.name })),
      color: '#3498db',
      timestamp: true
    });

    const sent = await targetChannel.send({
      ...v2(container),
      files: files.length > 0 ? files : undefined,
      allowedMentions: { parse: ['roles'] }
    }).catch(err => {
      logger.error(`Modmail send failed: ${err.message}`);
      return null;
    });

    if (!sent) {
      return interaction.editReply({ content: `Failed to send your message: the staff channel/role IDs may be wrong or the bot lacks permission there. Check \`/config modmail\` or \`config.json\`.` });
    }

    return interaction.editReply({
      content: `Your mod mail has been sent to the staff team${images.length > 0 ? ` with ${images.length} image(s).` : "."}`
    });
  }
};