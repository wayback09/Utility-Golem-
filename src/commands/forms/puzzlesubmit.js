const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const db = require('../../database/db');
const fs = require('fs');
const path = require('path');

function getFormsConfig(guildId) {
  try {
    // DB authoritative — file is fallback only
    const settings = db.getGuildSettings(guildId);
    if (settings && (settings.forms_puzzle_channel || settings.forms_puzzle_role || settings.forms_puzzle_publicChannel)) {
      return {
        channel: settings.forms_puzzle_channel || null,
        role: settings.forms_puzzle_role || null,
        publicChannel: settings.forms_puzzle_publicChannel || null,
        postRole: settings.forms_puzzle_postRole || null
      };
    }
    const cfg = db.getGuildConfig(guildId);
    return (cfg.forms && cfg.forms.puzzlesubmit) || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('puzzlesubmit')
    .setDescription('Create and submit a puzzle for the puzzle team')
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Puzzle title/name')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('question')
        .setDescription('The puzzle or riddle itself')
        .setRequired(true)
        .setMaxLength(2000))
    .addStringOption(opt =>
      opt.setName('answer')
        .setDescription('The answer (kept hidden from the public until approved)')
        .setRequired(true)
        .setMaxLength(200))
    .addAttachmentOption(opt =>
      opt.setName('image')
        .setDescription('An image for the puzzle')
        .setRequired(true))
    .addAttachmentOption(opt =>
      opt.setName('answer_image')
        .setDescription('Optional image showing the answer (posted as a spoiler after approval)'))
    .addStringOption(opt =>
      opt.setName('details')
        .setDescription('Optional extra details needed to solve the puzzle (shown publicly)')
        .setMaxLength(1500))
    .addStringOption(opt =>
      opt.setName('difficulty')
        .setDescription('Difficulty level')
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
          { name: 'Expert', value: 'expert' }
        ))
    .addStringOption(opt =>
      opt.setName('hint')
        .setDescription('An optional hint for solvers')
        .setMaxLength(500)),
  async execute(interaction) {
    const title = interaction.options.getString('title');
    const question = interaction.options.getString('question');
    const answer = interaction.options.getString('answer');
    const details = interaction.options.getString('details');
    const difficulty = interaction.options.getString('difficulty') || 'unspecified';
    const hint = interaction.options.getString('hint');
    const image = interaction.options.getAttachment('image');
    const answerImage = interaction.options.getAttachment('answer_image');
    const cfg = getFormsConfig(interaction.guildId);

    await interaction.deferReply({ flags: 64 });

    if (!image || !image.contentType || !image.contentType.startsWith('image/')) {
      return interaction.editReply({ content: "The puzzle image must be an actual image file (PNG, JPG, GIF, or WEBP)." });
    }

    if (!cfg || !cfg.channel || !cfg.role) {
      return interaction.editReply({
        content: "The puzzle system isn't configured yet. An administrator should run `/config puzzle channel:#review role:@Staff public_channel:#puzzles` — or add `forms.puzzlesubmit` in `config.json` as fallback."
      });
    }

    const staffChannel = interaction.guild.channels.cache.get(String(cfg.channel));
    if (!staffChannel) {
      return interaction.editReply({ content: "The configured puzzle staff channel no longer exists in this server." });
    }
    if (!staffChannel.isTextBased()) {
      return interaction.editReply({ content: "The configured puzzle staff channel isn't a text channel, so submissions can't be sent there." });
    }

    const submissionId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const fields = [
      { name: "Difficulty", value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), inline: true },
      { name: "Author", value: `${interaction.user} (ID: ${interaction.user.id})`, inline: true },
      { name: "Answer", value: answer, inline: false }
    ];
    if (details) fields.push({ name: "Details (shown publicly)", value: details.slice(0, 1024), inline: false });
    if (cfg.publicChannel) fields.push({ name: "Will be posted to", value: `<#${String(cfg.publicChannel)}>`, inline: true });
    if (hint) fields.push({ name: "Hint", value: hint.slice(0, 1024), inline: false });

    const embed = createEmbed({
      title: `Puzzle Submission — ${title}`,
      description: question,
      fields: fields,
      color: '#9b59b6'
    });

    if (image && image.contentType && image.contentType.startsWith('image/')) embed.setImage(image.url);

    const approveBtn = new ButtonBuilder()
      .setCustomId(`puzzle_approve_${submissionId}`)
      .setLabel('Approve & Post')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');
    const rejectBtn = new ButtonBuilder()
      .setCustomId(`puzzle_reject_${submissionId}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌');
    const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

    const staff = await staffChannel.send({
      content: `<@&${String(cfg.role)}>`,
      embeds: [embed],
      components: [row],
      files: answerImage && answerImage.contentType && answerImage.contentType.startsWith('image/')
        ? [{ attachment: answerImage.url, name: `answer-${submissionId}.${answerImage.contentType.split('/')[1] || 'png'}` }]
        : undefined,
      allowedMentions: { parse: ['roles'] }
    }).catch(err => {
      logger.error(`Puzzle submission send failed: ${err.message}`);
      return null;
    });

    if (!staff) {
      return interaction.editReply({ content: "Failed to submit your puzzle: staff channel/role IDs may be wrong or the bot lacks permission there. Check `/config puzzle` or `config.json`." });
    }

    db.savePuzzleSubmission({
      id: submissionId,
      author_id: interaction.user.id,
      title: title,
      question: question,
      answer: answer,
      details: details || null,
      difficulty: difficulty,
      hint: hint || null,
      image_url: image && image.contentType && image.contentType.startsWith('image/') ? image.url : null,
      answer_image_url: answerImage && answerImage.contentType && answerImage.contentType.startsWith('image/') ? answerImage.url : null,
      created_at: Date.now()
    });

    return interaction.editReply({ content: "Your puzzle has been submitted for review. Staff will approve and post it if accepted." });
  }
};