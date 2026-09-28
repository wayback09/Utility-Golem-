const db = require('../../database/db');
const { createContainer, v2 } = require('../../utils/embedBuilder');

const userMessageCache = new Map(); // userId -> [{ content, timestamp }]

async function handleAutomod(message) {
  if (message.author.bot || !message.guild) return false;
  
  const guildId = message.guild.id;
  if (!db.isModuleEnabled(guildId, 'automod')) return false;

  const settings = db.getAutomodSettings(guildId);
  const content = message.content;

  // 1. Anti invite links
  if (settings.anti_invite === 1) {
    const inviteRegex = /(discord\.(gg|io|me|li)\/|discordapp\.com\/invite\/)/i;
    if (inviteRegex.test(content)) {
      await message.delete().catch(() => {});
      db.addWarning(guildId, message.author.id, message.client.user.id, "Automod: Posted discord invite link");
      await message.channel.send({
        ...v2(createContainer({
          guildId,
          title: "Automod Action",
          description: `${message.author}\nInvite links are not allowed in this server.`,
          color: '#ff4757',
          footer: false
        }))
      });
      return true;
    }
  }

  // 2. Anti Caps
  if (settings.anti_caps === 1 && content.length > 8) {
    const capsCount = content.replace(/[^A-Z]/g, "").length;
    if (capsCount / content.length > 0.7) {
      await message.delete().catch(() => {});
      await message.channel.send({
        ...v2(createContainer({
          guildId,
          title: "Automod Action",
          description: `${message.author}\nPlease do not use excessive capital letters.`,
          color: '#ff4757',
          footer: false
        }))
      });
      return true;
    }
  }

  // 3. Bad Word Filter
  try {
    const badWords = JSON.parse(settings.bad_words || '[]');
    if (badWords.length > 0) {
      const lowerContent = content.toLowerCase();
      const hasBadWord = badWords.some(word => lowerContent.includes(word.toLowerCase()));
      if (hasBadWord) {
        await message.delete().catch(() => {});
        db.addWarning(guildId, message.author.id, message.client.user.id, "Automod: Profanity / Bad words");
        await message.channel.send({
          ...v2(createContainer({
            guildId,
            title: "Automod Action",
            description: `${message.author}\nYour message contained restricted words.`,
            color: '#ff4757',
            footer: false
          }))
        });
        return true;
      }
    }
  } catch (err) {}

  // 4. Duplicate Message & Anti-Spam
  if (settings.anti_spam === 1 || settings.duplicate_detection === 1) {
    const now = Date.now();
    if (!userMessageCache.has(message.author.id)) {
      userMessageCache.set(message.author.id, []);
    }
    
    const userMessages = userMessageCache.get(message.author.id);
    userMessages.push({ content, timestamp: now });
    
    // Cleanup old messages from cache (keep last 10s)
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < 10000);
    userMessageCache.set(message.author.id, recentMessages);

    // Spam check (more than 5 messages in 5 seconds)
    if (settings.anti_spam === 1) {
      const spamMessages = recentMessages.filter(msg => now - msg.timestamp < 5000);
      if (spamMessages.length > 5) {
        await message.delete().catch(() => {});
        db.addWarning(guildId, message.author.id, message.client.user.id, "Automod: Spamming messages");
        await message.channel.send({
          ...v2(createContainer({
            guildId,
            title: "Automod Action",
            description: `${message.author}\nPlease stop spamming messages.`,
            color: '#ff4757',
            footer: false
          }))
        });
        return true;
      }
    }

    // Duplicate detection (3 identical messages in 10 seconds)
    if (settings.duplicate_detection === 1) {
      const duplicates = recentMessages.filter(msg => msg.content === content);
      if (duplicates.length >= 3) {
        await message.delete().catch(() => {});
        db.addWarning(guildId, message.author.id, message.client.user.id, "Automod: Sending duplicate messages");
        await message.channel.send({
          ...v2(createContainer({
            guildId,
            title: "Automod Action",
            description: `${message.author}\nPlease do not post duplicate messages.`,
            color: '#ff4757',
            footer: false
          }))
        });
        return true;
      }
    }
  }

  // 5. Anti excessive mentions
  if (settings.anti_mentions > 0) {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > settings.anti_mentions) {
      await message.delete().catch(() => {});
      db.addWarning(guildId, message.author.id, message.client.user.id, `Automod: Excessive mentions (${mentionCount})`);
      await message.channel.send({
        ...v2(createContainer({
          guildId,
          title: "Automod Action",
          description: `${message.author}\nDo not mention more than ${settings.anti_mentions} users/roles at once.`,
          color: '#ff4757',
          footer: false
        }))
      });
      return true;
    }
  }

  return false;
}

module.exports = { handleAutomod };
