const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { createContainer, V2_FLAGS } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { getApplyConfig, getQuestions, DEFAULT_COOLDOWN } = require('../../commands/forms/apply');

function hasReviewPermission(interaction, cfg) {
  const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                   interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  const hasRole = cfg && cfg.role && interaction.member.roles.cache.has(String(cfg.role).trim());
  return hasAdmin || hasRole;
}

async function handleModalSubmit(interaction) {
  const guildId = interaction.guildId;

  // Reject-reason modal: apply_reject_<submissionId>
  if (interaction.customId.startsWith('apply_reject_')) {
    const submissionId = interaction.customId.split('apply_reject_')[1];
    const cfg = getApplyConfig(guildId);
    if (!hasReviewPermission(interaction, cfg)) {
      return interaction.reply({ content: "You do not have permission to review applications.", flags: 64 });
    }
    const submission = db.getApplicationSubmission(submissionId);
    if (!submission) {
      return interaction.reply({ content: "This application can no longer be found (already processed).", flags: 64 });
    }
    const reason = (interaction.fields.getTextInputValue('reason') || 'No reason provided').slice(0, 1000);

    db.deleteApplicationSubmission(submissionId);
    db.setApplicationCooldown(guildId, submission.author_id, Date.now());

    const cooldown = (cfg && cfg.cooldown !== null && !Number.isNaN(cfg.cooldown)) ? cfg.cooldown : DEFAULT_COOLDOWN;
    const retryAt = Math.floor((Date.now() + cooldown * 1000) / 1000);

    // DM the applicant with the reason
    try {
      const applicant = await interaction.client.users.fetch(submission.author_id);
      await applicant.send(
        `Your staff application in **${interaction.guild.name}** was **rejected**.\n` +
        `**Reason:** ${reason}\n` +
        (cooldown > 0 ? `You can apply again <t:${retryAt}:R>.` : `You may apply again whenever you're ready.`)
      ).catch(() => {});
    } catch (_) {}

    // Update the review message in place
    try {
      const channel = interaction.guild.channels.cache.get(String(submission.review_channel_id));
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(String(submission.review_message_id)).catch(() => null);
        if (msg) {
          await msg.edit({
            components: [createContainer({
              title: 'Application Rejected',
              description: `<@${submission.author_id}>'s application was rejected by ${interaction.user}.\n**Reason:** ${reason}`,
              color: '#ff4757'
            })]
          });
        }
      }
    } catch (err) {
      logger.error(`Application reject edit failed: ${err.message}`);
    }

    return interaction.reply({ content: "Application rejected and the applicant was notified.", flags: 64 });
  }

  // New application modal: apply_submit
  if (interaction.customId !== 'apply_submit') return;

  const cfg = getApplyConfig(guildId);
  if (!cfg || !cfg.channel || !cfg.role) {
    return interaction.reply({ content: "Applications aren't configured for this server.", flags: 64 });
  }

  // Re-validate guards (modal may have been open a while)
  if (db.getPendingApplication(guildId, interaction.user.id)) {
    return interaction.reply({ content: "You already have an application pending review.", flags: 64 });
  }
  const cooldown = (cfg.cooldown !== null && !Number.isNaN(cfg.cooldown)) ? cfg.cooldown : DEFAULT_COOLDOWN;
  if (cooldown > 0) {
    const lastReject = db.getApplicationCooldown(guildId, interaction.user.id);
    if (lastReject && Date.now() - lastReject < cooldown * 1000) {
      const retryAt = Math.floor((lastReject + cooldown * 1000) / 1000);
      return interaction.reply({ content: `You can apply again <t:${retryAt}:R>.`, flags: 64 });
    }
  }

  const questions = getQuestions(guildId);
  const answers = questions.map((q, i) => ({
    q: String(q.label || `Question ${i + 1}`).slice(0, 256),
    a: (interaction.fields.getTextInputValue(`q${i}`) || '_(no answer)_').slice(0, 1024)
  }));

  const staffChannel = interaction.guild.channels.cache.get(String(cfg.channel));
  if (!staffChannel || !staffChannel.isTextBased()) {
    return interaction.reply({ content: "The configured application review channel no longer exists.", flags: 64 });
  }

  const submissionId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const fields = [
    { name: 'Applicant', value: `${interaction.user} (ID: ${interaction.user.id})` },
    ...answers.map(a => ({ name: a.q, value: a.a }))
  ];

  const container = createContainer({
    title: 'New Staff Application',
    description: `<@&${String(cfg.role)}> — a new application needs review.`,
    fields,
    color: '#f39c12',
    timestamp: true
  });

  const approveBtn = new ButtonBuilder()
    .setCustomId(`apply_approve_${submissionId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');
  const rejectBtn = new ButtonBuilder()
    .setCustomId(`apply_reject_${submissionId}`)
    .setLabel('Reject')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

  await interaction.deferReply({ flags: 64 });

  const staff = await staffChannel.send({
    components: [container, row],
    flags: V2_FLAGS,
    allowedMentions: { parse: ['roles'] }
  }).catch(err => {
    logger.error(`Application submission send failed: ${err.message}`);
    return null;
  });

  if (!staff) {
    return interaction.editReply({ content: "Failed to submit your application: the review channel/role IDs may be wrong or the bot lacks permission there. Ask an administrator to check `/config application`." });
  }

  db.saveApplicationSubmission({
    id: submissionId,
    guild_id: guildId,
    author_id: interaction.user.id,
    answers,
    status: 'pending',
    review_channel_id: staffChannel.id,
    review_message_id: staff.id,
    created_at: Date.now()
  });

  return interaction.editReply({ content: "Your application has been submitted. Staff will review it and you'll receive a DM with the decision." });
}

async function handleInteraction(interaction) {
  const guildId = interaction.guildId;
  const cfg = getApplyConfig(guildId);

  if (!hasReviewPermission(interaction, cfg)) {
    return interaction.reply({ content: "You do not have permission to review applications.", flags: 64 });
  }

  const isApprove = interaction.customId.startsWith('apply_approve_');
  const submissionId = interaction.customId.split(isApprove ? 'apply_approve_' : 'apply_reject_')[1];
  const submission = db.getApplicationSubmission(submissionId);

  if (!submission) {
    return interaction.reply({ content: "This application can no longer be found (already processed).", flags: 64 });
  }

  if (!isApprove) {
    // Open the reject-reason modal (DMs the applicant with the reason on submit)
    const modal = new ModalBuilder()
      .setCustomId(`apply_reject_${submissionId}`)
      .setTitle('Reject Application');
    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Rejection reason (sent to applicant)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000)
      .setPlaceholder('e.g. Not enough experience yet — re-apply in a few weeks.');
    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // Approve: auto-assign the accept role, DM the applicant, close the review
  await interaction.deferReply({ flags: 64 });

  let roleNote = '';
  if (cfg && cfg.acceptRole) {
    try {
      const member = await interaction.guild.members.fetch(submission.author_id).catch(() => null);
      const role = interaction.guild.roles.cache.get(String(cfg.acceptRole));
      if (!member) {
        roleNote = ' The applicant has left the server, so no role was assigned.';
      } else if (!role) {
        roleNote = ' The accept role no longer exists, so no role was assigned.';
      } else {
        await member.roles.add(role);
        roleNote = ` Assigned ${role}.`;
      }
    } catch (err) {
      logger.error(`Application auto-role failed: ${err.message}`);
      roleNote = ` Could not assign the role (${err.message}). Check hierarchy/permissions.`;
    }
  }

  try {
    const applicant = await interaction.client.users.fetch(submission.author_id);
    await applicant.send(
      `Your staff application in **${interaction.guild.name}** was **accepted**! 🎉${cfg && cfg.acceptRole ? ' Your new role should now be visible in the server.' : ''}`
    ).catch(() => {});
  } catch (_) {}

  db.deleteApplicationSubmission(submissionId);
  db.clearApplicationCooldown(guildId, submission.author_id);

  try {
    await interaction.message.edit({
      components: [createContainer({
        title: 'Application Approved',
        description: `<@${submission.author_id}>'s application was approved by ${interaction.user}.${roleNote}`,
        color: '#2ed573'
      })]
    });
  } catch (err) {
    logger.error(`Application approve edit failed: ${err.message}`);
  }

  return interaction.editReply({ content: `Application approved.${roleNote} The applicant was notified.` });
}

module.exports = { handleInteraction, handleModalSubmit };
