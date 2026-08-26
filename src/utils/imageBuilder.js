let canvasLib = null;
try {
  canvasLib = require('@napi-rs/canvas');
} catch (e) {
  // @napi-rs/canvas not available or not installed
}
const path = require('path');
const db = require('../database/db');


// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 233, g: 30, b: 140 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circleClip(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
}

function getAccentColor(guildId) {
  try {
    const settings = db.getGuildSettings(guildId);
    if (settings && settings.embedColor) return settings.embedColor;
    const cfg = db.getGuildConfig(guildId);
    if (cfg.guild && cfg.guild.embedColor) return cfg.guild.embedColor;
  } catch (_) {}
  return '#e91e8c';
}

// ─── Rank Card ───────────────────────────────────────────────────────────────

/**
 * Generates a pink-clean rank card image.
 * @param {import('discord.js').User} user
 * @param {{ xp: number, level: number }} stats
 * @param {number} rank
 * @param {string} guildId
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateRankCard(user, stats, rank, guildId) {
  if (!canvasLib) {
    throw new Error('@napi-rs/canvas is not installed or available');
  }
  const { createCanvas, loadImage } = canvasLib;
  const W = 900, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const accent = getAccentColor(guildId);
  const { r, g, b } = hexToRgb(accent);

  // ── Background ──
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, W, H);

  // Soft pink left glow
  const bgGlow = ctx.createRadialGradient(160, H / 2, 20, 160, H / 2, 260);
  bgGlow.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  // ── Card panel ──
  ctx.save();
  roundRect(ctx, 30, 20, W - 60, H - 40, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.restore();

  // ── Avatar ──
  const avatarX = 140, avatarY = H / 2, avatarR = 85;

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Clip & draw avatar
  try {
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarURL);
    ctx.save();
    circleClip(ctx, avatarX, avatarY, avatarR);
    ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch (_) {
    // Fallback grey circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3a4a';
    ctx.fill();
    ctx.restore();
  }

  // ── Text ──
  const textX = 265;

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(user.username, textX, 105);

  // Level & Rank
  ctx.fillStyle = accent;
  ctx.font = '24px sans-serif';
  ctx.fillText(`Level ${stats.level}  |  Rank #${rank || 'N/A'}`, textX, 142);

  // XP numbers (right-aligned)
  const nextLevelXp = (stats.level * 100) + 100;
  const percentage = Math.min(100, Math.floor((stats.xp / nextLevelXp) * 100));
  const xpText = `${stats.xp} / ${nextLevelXp} XP  ${percentage}%`;
  ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
  ctx.font = '22px sans-serif';
  const xpTextWidth = ctx.measureText(xpText).width;
  ctx.fillText(xpText, W - 60 - xpTextWidth, 142);

  // ── Progress Bar ──
  const barX = textX, barY = 165, barW = W - textX - 60, barH = 22, barR = 11;
  const filled = Math.max(barR * 2, Math.floor((percentage / 100) * barW));

  // Track
  ctx.save();
  roundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.restore();

  // Fill gradient
  const grad = ctx.createLinearGradient(barX, 0, barX + filled, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
  grad.addColorStop(1, accent);
  ctx.save();
  roundRect(ctx, barX, barY, filled, barH, barR);
  ctx.fillStyle = grad;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // ── Footer ──
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '18px sans-serif';
  ctx.fillText('Golem • Server Guardian', W - 60 - ctx.measureText('Golem • Server Guardian').width, H - 32);

  return canvas.toBuffer('image/png');
}

// ─── Welcome Card ─────────────────────────────────────────────────────────────

/**
 * Generates a pink-clean welcome card image.
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateWelcomeCard(member) {
  if (!canvasLib) {
    throw new Error('@napi-rs/canvas is not installed or available');
  }
  const { createCanvas, loadImage } = canvasLib;
  const W = 900, H = 400;
  const canvas = createCanvas(W, H);

  const ctx = canvas.getContext('2d');

  const guildId = member.guild.id;
  const accent = getAccentColor(guildId);
  const { r, g, b } = hexToRgb(accent);

  // ── Background ──
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, W, H);

  // Center glow
  const bgGlow = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 320);
  bgGlow.addColorStop(0, `rgba(${r},${g},${b},0.20)`);
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  // ── Card panel ──
  ctx.save();
  roundRect(ctx, 30, 20, W - 60, H - 40, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.restore();

  // ── Avatar ──
  const avatarX = W / 2, avatarY = 115, avatarR = 72;

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Clip & draw avatar
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarURL);
    ctx.save();
    circleClip(ctx, avatarX, avatarY, avatarR);
    ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch (_) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3a4a';
    ctx.fill();
    ctx.restore();
  }

  // ── Text ──
  ctx.textAlign = 'center';

  // Server name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(`Welcome to ${member.guild.name}!`, W / 2, 225);

  // Username
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`@${member.user.username}`, W / 2, 270);

  // Member count
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '22px sans-serif';
  ctx.fillText(`You are member #${member.guild.memberCount.toLocaleString()}`, W / 2, 310);

  // ── Footer ──
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '18px sans-serif';
  ctx.fillText('Golem • Server Guardian', W / 2, H - 32);

  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = { generateRankCard, generateWelcomeCard };
