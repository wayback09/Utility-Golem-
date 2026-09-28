const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');

function suggestionCard(suggestion, messageId, upvotes, downvotes) {
  const color = suggestion.status === 'APPROVED' ? '#2ed573'
    : (suggestion.status === 'DENIED' ? '#ff4757' : '#1e1f29');
  return createContainer({
    title: `Suggestion #${messageId.substring(messageId.length - 6)} [${suggestion.status}]`,
    description: suggestion.content,
    color,
    fields: [
      { name: "Author", value: `<@${suggestion.user_id}>` },
      { name: "Status", value: suggestion.status },
      { name: "Votes", value: `👍 ${upvotes.length} | 👎 ${downvotes.length}` }
    ],
    footer: false
  });
}

async function handleInteraction(interaction) {
  const { customId, user, guild, message } = interaction;
  const suggestion = db.getSuggestion(message.id);
  if (!suggestion) return interaction.reply({ content: "Suggestion details not found in database.", flags: 64 });

  let upvotes = JSON.parse(suggestion.votes_up || '[]');
  let downvotes = JSON.parse(suggestion.votes_down || '[]');

  if (customId === 'suggest_upvote') {
    if (upvotes.includes(user.id)) {
      upvotes = upvotes.filter(id => id !== user.id);
    } else {
      upvotes.push(user.id);
      downvotes = downvotes.filter(id => id !== user.id); // Remove downvote if upvoting
    }
  } else if (customId === 'suggest_downvote') {
    if (downvotes.includes(user.id)) {
      downvotes = downvotes.filter(id => id !== user.id);
    } else {
      downvotes.push(user.id);
      upvotes = upvotes.filter(id => id !== user.id); // Remove upvote if downvoting
    }
  } else if (customId === 'suggest_approve' || customId === 'suggest_deny') {
    // Check permission (Staff only)
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "You do not have permission to approve/deny suggestions.", flags: 64 });
    }

    const isApprove = customId === 'suggest_approve';
    suggestion.status = isApprove ? 'APPROVED' : 'DENIED';
    db.saveSuggestion(suggestion);

    // Update card, dropping the voting buttons (V2 message must stay V2)
    await message.edit({ ...v2(suggestionCard(suggestion, message.id, upvotes, downvotes)) });
    return interaction.reply({ content: `Suggestion has been ${isApprove ? 'approved' : 'denied'}.`, flags: 64 });
  }

  // Save changes
  suggestion.votes_up = JSON.stringify(upvotes);
  suggestion.votes_down = JSON.stringify(downvotes);
  db.saveSuggestion(suggestion);

  // Update original card vote counts
  await message.edit({ ...v2(suggestionCard(suggestion, message.id, upvotes, downvotes)) });
  await interaction.reply({ content: "Vote updated!", flags: 64 });
}

module.exports = { handleInteraction };
