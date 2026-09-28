const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

async function handleInteraction(interaction) {
  const { customId, guild, user, channel } = interaction;
  const settings = db.getGuildSettings(guild.id);

  if (customId === 'ticket_create') {
    await interaction.deferReply({ flags: 64 });

    // Find if user already has an active ticket
    const activeTickets = db.getAllTickets(guild.id).filter(t => t.user_id === user.id && t.closed === 0);
    if (activeTickets.length > 0) {
      return interaction.editReply({ content: `You already have an active ticket: <#${activeTickets[0].channel_id}>.` });
    }

    // Determine category
    const parentCategory = settings.ticket_category ? guild.channels.cache.get(settings.ticket_category) : null;

    // Create channel
    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: parentCategory?.id || null,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });

      // Save ticket to DB
      db.saveTicket({
        channel_id: ticketChannel.id,
        guild_id: guild.id,
        user_id: user.id,
        claimed_by: null,
        closed: 0,
        created_at: Date.now()
      });

      // Send greeting in ticket channel
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        ...v2(createContainer({
          title: "Support Ticket",
          description: `${user} welcome to your support ticket. Staff will be with you shortly.\nClick below to claim or close this ticket.`,
          color: '#3498db',
          footer: false
        }), [row])
      });

      return interaction.editReply({ content: `Ticket created! Head over to ${ticketChannel}.` });
    } catch (err) {
      logger.error(`Failed to create ticket channel: ${err.message}`);
      return interaction.editReply({ content: "Failed to create support ticket. Please try again." });
    }
  }

  if (customId === 'ticket_claim') {
    const ticket = db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: "Ticket details not found.", flags: 64 });

    if (ticket.claimed_by) {
      return interaction.reply({ content: `Ticket is already claimed by <@${ticket.claimed_by}>.`, flags: 64 });
    }

    // Set permission for staff member
    await channel.permissionOverwrites.create(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});

    ticket.claimed_by = user.id;
    db.saveTicket(ticket);

    await interaction.reply({
      ...v2(createContainer({
        description: `This ticket has been claimed by ${user}.`,
        color: '#2ed573',
        footer: false
      }))
    });
  }

  if (customId === 'ticket_close') {
    const ticket = db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: "Ticket details not found.", flags: 64 });

    await interaction.reply({ content: "Closing ticket in 5 seconds..." });

    // Generate Transcript (simple text backup of the messages in the channel)
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    let transcriptText = `--- Ticket Transcript for channel: ${channel.name} ---\n`;
    if (messages) {
      const sorted = [...messages.values()].reverse();
      for (const msg of sorted) {
        transcriptText += `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
      }
    }

    ticket.closed = 1;
    db.saveTicket(ticket);

    setTimeout(async () => {
      // Log ticket closing to ticket logs channel
      if (settings.ticket_logs_channel) {
        const logsChannel = guild.channels.cache.get(settings.ticket_logs_channel);
        if (logsChannel) {
          // Send transcript as file
          const buffer = Buffer.from(transcriptText, 'utf8');
          await logsChannel.send({
            content: `Ticket closed for <@${ticket.user_id}>.`,
            files: [{
              attachment: buffer,
              name: `transcript-${channel.name}.txt`
            }]
          }).catch(() => {});
        }
      }
      
      await channel.delete().catch(() => {});
    }, 5000);
  }
}

module.exports = { handleInteraction };
