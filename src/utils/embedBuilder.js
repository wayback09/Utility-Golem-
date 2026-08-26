const { EmbedBuilder } = require('discord.js');
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

module.exports = { createEmbed };
