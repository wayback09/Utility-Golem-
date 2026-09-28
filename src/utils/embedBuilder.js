const {
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/default.js');

function getEmbedColor(guildId) {
  try {
    if (guildId) {
      const db = require('../database/db');
      const settings = db.getGuildSettings(guildId);
      if (settings && settings.embedColor) return settings.embedColor;
      // Fallback to file for already-installed servers
      const cfg = db.getGuildConfig(guildId);
      if (cfg.guild && cfg.guild.embedColor) return cfg.guild.embedColor;
    }
  } catch (_) {}
  try {
    const cfgPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.guild && cfg.guild.embedColor) return cfg.guild.embedColor;
    }
  } catch (_) {}
  return config.branding.color;
}

/**
 * Creates a standardized Golem-branded embed
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {string} [options.color]
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields]
 * @param {string} [options.thumbnail]
 * @param {string} [options.image]
 * @param {object} [options.author]
 * @param {boolean} [options.timestamp=true]
 */
function createEmbed({
  title,
  description,
  color,
  fields,
  thumbnail,
  image,
  author,
  timestamp = true
} = {}) {
  const embed = new EmbedBuilder()
    .setColor(color || getEmbedColor())
    .setFooter({ text: config.branding.footer });

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields && fields.length > 0) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author) embed.setAuthor(author);
  if (timestamp) embed.setTimestamp();

  return embed;
}

/** Message flag that opts a message into Components V2 (`1 << 15`). Required whenever `components` contains V2 builders. */
const V2_FLAGS = MessageFlags.IsComponentsV2;

function hexToInt(hex) {
  if (typeof hex === 'number') return hex;
  if (typeof hex !== 'string') return 0xe91e8c;
  const clean = hex.replace('#', '').trim();
  const parsed = parseInt(clean, 16);
  return Number.isNaN(parsed) ? 0xe91e8c : parsed;
}

/**
 * Creates a Components V2 Container mirroring {@link createEmbed}.
 * Returns a ContainerBuilder — send with `{ components: [container], flags: V2_FLAGS }`
 * (plus `files: [...]` when `image` is an `attachment://` URL).
 *
 * @param {object} options
 * @param {string} [options.title] rendered as `# title`
 * @param {string} [options.description] markdown body (mentions ping inside TextDisplay)
 * @param {string|number} [options.color] accent bar color (hex string or int)
 * @param {string} [options.guildId] used to resolve the guild embed color when `color` omitted
 * @param {Array<{name: string, value: string}>} [options.fields] rendered as `**name**\nvalue` blocks
 * @param {string} [options.thumbnail] URL or `attachment://` shown as Section accessory
 * @param {string} [options.thumbnailDescription] alt text for the thumbnail
 * @param {string} [options.image] URL or `attachment://` shown as a Media Gallery item
 * @param {string} [options.imageDescription] alt text for the gallery image
 * @param {boolean} [options.spoiler=false] blur the whole container
 * @param {boolean} [options.footer=true] append `-# Golem • Server Guardian` line
 * @param {boolean} [options.timestamp=false] append `<t:unix:f>` to the footer line (V2 has no native timestamp)
 */
function createContainer({
  title,
  description,
  color,
  guildId,
  fields,
  thumbnail,
  thumbnailDescription,
  image,
  imageDescription,
  spoiler = false,
  footer = true,
  timestamp = false,
} = {}) {
  const accent = hexToInt(color || getEmbedColor(guildId));

  const lines = [];
  if (title) lines.push(`# ${title}`);
  if (description) lines.push(description);
  if (fields && fields.length > 0) {
    for (const f of fields) {
      lines.push(`**${f.name}**\n${f.value}`);
    }
  }
  const body = lines.join('\n\n').slice(0, 4000) || ' ';
  const bodyDisplay = new TextDisplayBuilder().setContent(body);

  const container = new ContainerBuilder().setAccentColor(accent);
  if (spoiler) container.setSpoiler(true);

  if (thumbnail) {
    const thumb = new ThumbnailBuilder().setURL(thumbnail);
    if (thumbnailDescription) thumb.setDescription(thumbnailDescription.slice(0, 1024));
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(bodyDisplay)
        .setThumbnailAccessory(thumb)
    );
  } else {
    container.addTextDisplayComponents(bodyDisplay);
  }

  if (image) {
    const item = new MediaGalleryItemBuilder().setURL(image);
    if (imageDescription) item.setDescription(imageDescription.slice(0, 1024));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(item));
  }

  if (footer !== false) {
    let footerText = `-# ${config.branding.footer}`;
    if (timestamp) footerText += ` • <t:${Math.floor(Date.now() / 1000)}:f>`;
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
  }

  return container;
}

module.exports = { createEmbed, createContainer, getEmbedColor, V2_FLAGS };
