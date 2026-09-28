const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

const DEFAULT_COOLDOWN = 86400; // 24h in seconds

const DEFAULT_QUESTIONS = [
  { label: 'Why do you want to join the team?', placeholder: 'Tell us your motivation...', required: true, short: false },
  { label: 'Any relevant experience?', placeholder: 'Past staff roles, skills...', required: true, short: false },
  { label: 'How active can you be?', placeholder: 'e.g. a few hours per week', required: true, short: true }
];

function getApplyConfig(guildId) {
  try {
    // DB authoritative — file is fallback only
    const settings = db.getGuildSettings(guildId);
    if (settings && (settings.forms_apply_channel || settings.forms_apply_role)) {
      return {
        channel: settings.forms_apply_channel || null,
        role: settings.forms_apply_role || null,
        acceptRole: settings.forms_apply_acceptRole || null,
        cooldown: settings.forms_apply_cooldown !== null && settings.forms_apply_cooldown !== undefined
          ? Number(settings.forms_apply_cooldown) : null
      };
    }
    const cfg = db.getGuildConfig(guildId);
    const file = (cfg.forms && cfg.forms.apply) || null;
    if (!file) return null;
    return {
      channel: file.channel || null,
      role: file.role || null,
      acceptRole: file.acceptRole || null,
      cooldown: file.cooldown ? Number(file.cooldown) : null
    };
  } catch (e) {
    return null;
  }
}

function getQuestions(guildId) {
  try {
    const settings = db.getGuildSettings(guildId);
    const parsed = JSON.parse(settings.forms_apply_questions || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 5);
  } catch (_) {}
  try {
    const cfg = db.getGuildConfig(guildId);
    const fileQs = cfg.forms && cfg.forms.apply && cfg.forms.apply.questions;
    if (Array.isArray(fileQs) && fileQs.length > 0) return fileQs.slice(0, 5);
  } catch (_) {}
  return DEFAULT_QUESTIONS;
}

module.exports = {
  module: 'applications',
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply for a staff position'),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getApplyConfig(guildId);

    if (!cfg || !cfg.channel || !cfg.role) {
      return interaction.reply({
        content: "Applications aren't configured yet. An administrator should run `/config application channel:#review role:@Staff` — optionally with `accept_role:@Role` and custom questions via `/config application_questions`.",
        flags: 64
      });
    }

    // One pending application per user
    const pending = db.getPendingApplication(guildId, interaction.user.id);
    if (pending) {
      return interaction.reply({
        content: "You already have an application pending review. Please wait for staff to decide before applying again.",
        flags: 64
      });
    }

    // Rejection cooldown
    const cooldown = (cfg.cooldown !== null && !Number.isNaN(cfg.cooldown) ? cfg.cooldown : DEFAULT_COOLDOWN);
    if (cooldown > 0) {
      const lastReject = db.getApplicationCooldown(guildId, interaction.user.id);
      if (lastReject && Date.now() - lastReject < cooldown * 1000) {
        const retryAt = Math.floor((lastReject + cooldown * 1000) / 1000);
        return interaction.reply({
          content: `Your last application was rejected. You can apply again <t:${retryAt}:R>.`,
          flags: 64
        });
      }
    }

    const questions = getQuestions(guildId);

    const modal = new ModalBuilder()
      .setCustomId('apply_submit')
      .setTitle('Staff Application');

    questions.forEach((q, i) => {
      const input = new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel(String(q.label || `Question ${i + 1}`).slice(0, 45))
        .setStyle(q.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setRequired(q.required !== false);
      if (q.placeholder) input.setPlaceholder(String(q.placeholder).slice(0, 100));
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    await interaction.showModal(modal);
  }
};

module.exports.getApplyConfig = getApplyConfig;
module.exports.getQuestions = getQuestions;
module.exports.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
module.exports.DEFAULT_COOLDOWN = DEFAULT_COOLDOWN;
