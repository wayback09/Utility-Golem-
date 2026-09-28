const db = require('../database/db');
const { createContainer, v2 } = require('../utils/embedBuilder');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot || !reaction.message.guild) return;

    // Fetch partials if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        return;
      }
    }
    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (error) {
        return;
      }
    }

    const guildId = reaction.message.guild.id;

    // 1. Starboard Module
    if (db.isModuleEnabled(guildId, 'starboard')) {
      const settings = db.getGuildSettings(guildId);
      if (settings.starboard_enabled === 1 && settings.starboard_channel && reaction.emoji.name === '⭐') {
        const threshold = settings.starboard_threshold || 3;
        const starCount = reaction.count;
        
        if (starCount >= threshold) {
          const starboardChannel = reaction.message.guild.channels.cache.get(settings.starboard_channel);
          if (starboardChannel) {
            const existingStar = db.getStarboardMessage(reaction.message.id);
            const firstAttachment = reaction.message.attachments.size > 0
              ? reaction.message.attachments.first().url : undefined;
            const container = createContainer({
              guildId,
              title: `⭐ ${starCount} | #${reaction.message.channel.name}`,
              description: `**${reaction.message.author.tag}**\n${reaction.message.content || "*Attachment/Embed*"}\n[Jump to Message](${reaction.message.url})`,
              thumbnail: reaction.message.author.displayAvatarURL({ extension: 'png', size: 128 }),
              thumbnailDescription: `${reaction.message.author.tag}'s avatar`,
              image: firstAttachment,
              color: '#ffa502',
              footer: false
            });

            if (existingStar) {
              try {
                const starboardMsg = await starboardChannel.messages.fetch(existingStar.starboard_msg_id);
                if (starboardMsg) {
                  await starboardMsg.edit({ ...v2(container) });
                  db.saveStarboardMessage(reaction.message.id, existingStar.starboard_msg_id, guildId, starCount);
                }
              } catch (err) {
                // If message deleted, recreate it
                const newMsg = await starboardChannel.send({ ...v2(container) });
                db.saveStarboardMessage(reaction.message.id, newMsg.id, guildId, starCount);
              }
            } else {
              const newMsg = await starboardChannel.send({ ...v2(container) });
              db.saveStarboardMessage(reaction.message.id, newMsg.id, guildId, starCount);
            }
          }
        }
      }
    }

    // 2. Reaction Roles Handler (if applicable)
    // We can hook role assignment based on custom reaction keys
    // For roles module, we will also provide Button roles and Select menu roles which are much more modern
  }
};
