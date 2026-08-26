const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'golem_db.json');
const configPath = path.join(process.cwd(), 'config.json');

// Read config.json fresh every time (so edits take effect without restart)
function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    logger.error(`Failed to read config.json: ${e.message}`);
  }
  return {};
}

// Get config for a specific guild, falling back to root config for backwards compatibility
function getGuildConfig(guildId) {
  const config = getConfig();
  if (guildId && config.guilds && config.guilds[guildId]) {
    return config.guilds[guildId];
  }
  return config;
}

// Memory cache for database content
let data = {
  guild_settings: {},
  moderation_logs: [],
  warnings: [],
  giveaways: {},
  suggestions: {},
  tickets: {},
  custom_commands: {}, // guildId -> { cmdName: { response, is_embed } }
  levels: {}, // guildId -> { userId: { xp, level, last_message_time } }
  level_rewards: {}, // guildId -> { level: roleId }
  starboard_messages: {}, // original_msg_id -> { starboard_msg_id, guild_id, star_count }
  automod_settings: {},
  puzzle_submissions: {} // id -> { author_id, title, question, answer, hint, difficulty, image_url, created_at }
};

// Save database atomatically
function save() {
  try {
    const tempPath = dbPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, dbPath);
  } catch (err) {
    logger.error(`Failed to save database: ${err.message}`);
  }
}

// Load database
function init() {
  logger.info(`Initializing JSON database at ${dbPath}`);
  if (fs.existsSync(dbPath)) {
    try {
      const fileData = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(fileData);
      data = { ...data, ...parsed };
      logger.success('Database loaded successfully.');
    } catch (err) {
      logger.error(`Failed to parse database file: ${err.message}. Creating backup and resetting.`);
      try {
        fs.renameSync(dbPath, dbPath + `.backup-${Date.now()}`);
      } catch (_) {}
      save();
    }
  } else {
    save();
    logger.success('New database file created.');
  }
}

// Settings Cache
function getGuildSettings(guildId) {
  // Always merge config.json values on top of whatever is in the database
  const config = getGuildConfig(guildId);

  if (!data.guild_settings[guildId]) {
    const defaultConfig = require('../config/default');
    const defaults = defaultConfig.defaultSettings;
    const allModules = [
      'moderation', 'automod', 'logging', 'welcome', 'roles',
      'tickets', 'suggestions', 'giveaways', 'leveling', 'minecraft', 'utility', 'starboard'
    ];

    data.guild_settings[guildId] = {
      guild_id: guildId,
      welcome_enabled: defaults.welcomeEnabled,
      welcome_channel: defaults.welcomeChannel,
      welcome_message: defaults.welcomeMessage,
      goodbye_enabled: defaults.goodbyeEnabled,
      goodbye_channel: defaults.goodbyeChannel,
      goodbye_message: defaults.goodbyeMessage,
      autorole_enabled: defaults.autoRoleEnabled,
      autoroles: defaults.autoRoles,
      logging_enabled: defaults.loggingEnabled,
      logging_channel: defaults.loggingChannel,
      log_events: defaults.logEvents,
      starboard_enabled: defaults.starboardEnabled,
      starboard_channel: defaults.starboardChannel,
      starboard_threshold: defaults.starboardThreshold,
      suggestion_enabled: defaults.suggestionEnabled,
      suggestion_channel: defaults.suggestionChannel,
      ticket_enabled: defaults.ticketEnabled,
      ticket_category: defaults.ticketCategory,
      ticket_logs_channel: defaults.ticketLogsChannel,
      leveling_enabled: defaults.levelingEnabled,
      minecraft_enabled: defaults.minecraftEnabled,
      minecraft_ip: defaults.minecraftIp,
      minecraft_port: defaults.minecraftPort,
      enabled_modules: JSON.stringify(allModules),
      commandOnlyChannels: [],
      commandChannels: {},
      prefix: defaults.prefix,
      embedColor: null,
      levelUpChannel: defaults.levelUpChannel || null,
      // Forms — DB authoritative, file is fallback only
      forms_modmail_channel: null,
      forms_modmail_role: null,
      forms_puzzle_channel: null,
      forms_puzzle_role: null,
      forms_puzzle_publicChannel: null,
      forms_puzzle_postRole: null
    };
    save();
  }

  const settings = data.guild_settings[guildId];

  // Ensure command channel settings exist — DB authoritative, import from file only if DB empty (preserves both servers)
  let hasCmdOnly = Array.isArray(settings.commandOnlyChannels);
  if (!hasCmdOnly) {
    if (typeof settings.commandOnlyChannels === 'string') {
      try { settings.commandOnlyChannels = JSON.parse(settings.commandOnlyChannels); } catch { settings.commandOnlyChannels = []; }
      hasCmdOnly = Array.isArray(settings.commandOnlyChannels);
      if (!hasCmdOnly) settings.commandOnlyChannels = [];
    } else {
      settings.commandOnlyChannels = [];
      hasCmdOnly = true;
    }
  }
  // Import from config only if DB list is empty and file has entries (one-time)
  if (hasCmdOnly && settings.commandOnlyChannels.length === 0 && Array.isArray(config.commandOnlyChannels) && config.commandOnlyChannels.length > 0) {
    settings.commandOnlyChannels = config.commandOnlyChannels.map(id => String(id).trim()).filter(Boolean);
  }

  let hasCmdChannels = settings.commandChannels && typeof settings.commandChannels === 'object' && !Array.isArray(settings.commandChannels);
  if (!hasCmdChannels) {
    if (typeof settings.commandChannels === 'string') {
      try { settings.commandChannels = JSON.parse(settings.commandChannels); } catch { settings.commandChannels = {}; }
      hasCmdChannels = settings.commandChannels && typeof settings.commandChannels === 'object' && !Array.isArray(settings.commandChannels);
      if (!hasCmdChannels) settings.commandChannels = {};
    } else {
      settings.commandChannels = {};
      hasCmdChannels = true;
    }
  }
  // Import from config only if DB object is empty and file has entries
  if (hasCmdChannels && Object.keys(settings.commandChannels).length === 0 && config.commandChannels && typeof config.commandChannels === 'object' && !Array.isArray(config.commandChannels) && Object.keys(config.commandChannels).length > 0) {
    // Deep copy and normalize to string arrays
    const imported = {};
    for (const [k, v] of Object.entries(config.commandChannels)) {
      if (Array.isArray(v) && v.length > 0) imported[k] = v.map(id => String(id).trim()).filter(Boolean);
      else if (Array.isArray(v)) imported[k] = [];
    }
    if (Object.keys(imported).length > 0) settings.commandChannels = imported;
  }
  // Normalize commandChannels values to arrays
  for (const [cmd, val] of Object.entries(settings.commandChannels)) {
    if (!Array.isArray(val)) {
      if (typeof val === 'string') {
        try { settings.commandChannels[cmd] = JSON.parse(val); } catch { settings.commandChannels[cmd] = []; }
      } else {
        settings.commandChannels[cmd] = [];
      }
    }
  }

  // Ensure new keys exist for old DBs (preserve both servers' progress, no wipe)
  const defaults = require('../config/default').defaultSettings;
  if (settings.prefix === undefined) settings.prefix = defaults.prefix || 'g!';
  if (settings.embedColor === undefined) settings.embedColor = null;
  if (settings.levelUpChannel === undefined) settings.levelUpChannel = defaults.levelUpChannel || null;
  if (settings.forms_modmail_channel === undefined) settings.forms_modmail_channel = null;
  if (settings.forms_modmail_role === undefined) settings.forms_modmail_role = null;
  if (settings.forms_puzzle_channel === undefined) settings.forms_puzzle_channel = null;
  if (settings.forms_puzzle_role === undefined) settings.forms_puzzle_role = null;
  if (settings.forms_puzzle_publicChannel === undefined) settings.forms_puzzle_publicChannel = null;
  if (settings.forms_puzzle_postRole === undefined) settings.forms_puzzle_postRole = null;

  // DB authoritative: only use config.json as fallback when DB value is empty
  // This keeps both existing servers' progress while allowing zero-config for new guilds
try {
      if (config.channels) {
        if (!settings.logging_channel && config.channels.logs)         settings.logging_channel     = config.channels.logs;
        if (!settings.welcome_channel && config.channels.welcome)      settings.welcome_channel     = config.channels.welcome;
        if (!settings.goodbye_channel && config.channels.goodbye)      settings.goodbye_channel     = config.channels.goodbye;
        if (!settings.suggestion_channel && config.channels.suggestions)  settings.suggestion_channel  = config.channels.suggestions;
        if (!settings.ticket_logs_channel && config.channels.tickets)      settings.ticket_logs_channel = config.channels.tickets;
        // levelUp channel fallback (used by messageCreate leveling)
        if (!settings.levelUpChannel && config.channels.levelUp) settings.levelUpChannel = config.channels.levelUp;
      }
      // levelUp fallback from guild config (older key)
      if (!settings.prefix && config.guild && config.guild.prefix) {
        settings.prefix = config.guild.prefix;
      }
      // Embed color fallback
      if (!settings.embedColor && config.guild && config.guild.embedColor) {
        settings.embedColor = config.guild.embedColor;
      }
      // Forms fallback — keep existing file config for already-installed servers
      if (config.forms) {
        if (config.forms.modmail) {
          if (!settings.forms_modmail_channel && config.forms.modmail.channel) settings.forms_modmail_channel = String(config.forms.modmail.channel);
          if (!settings.forms_modmail_role && config.forms.modmail.role) settings.forms_modmail_role = String(config.forms.modmail.role);
        }
        if (config.forms.puzzlesubmit) {
          if (!settings.forms_puzzle_channel && config.forms.puzzlesubmit.channel) settings.forms_puzzle_channel = String(config.forms.puzzlesubmit.channel);
          if (!settings.forms_puzzle_role && config.forms.puzzlesubmit.role) settings.forms_puzzle_role = String(config.forms.puzzlesubmit.role);
          if (!settings.forms_puzzle_publicChannel && config.forms.puzzlesubmit.publicChannel) settings.forms_puzzle_publicChannel = String(config.forms.puzzlesubmit.publicChannel);
          if (!settings.forms_puzzle_postRole && config.forms.puzzlesubmit.postRole) settings.forms_puzzle_postRole = String(config.forms.puzzlesubmit.postRole);
        }
      }
      // Welcome module auto-enable only if DB hasn't been explicitly set
      if (config.modules) {
        const welcomeModule = config.modules.welcome === true;
        if (welcomeModule && config.channels) {
          if (settings.welcome_enabled !== 1 && settings.welcome_enabled !== 0) {
            if (config.channels.welcome) settings.welcome_enabled = 1;
          } else if (!settings.welcome_channel && config.channels.welcome) {
            // allow file to fill empty channel without forcing enabled state
            settings.welcome_channel = config.channels.welcome;
          }
          if (settings.goodbye_enabled !== 1 && settings.goodbye_enabled !== 0) {
            if (config.channels.goodbye) settings.goodbye_enabled = 1;
          } else if (!settings.goodbye_channel && config.channels.goodbye) {
            settings.goodbye_channel = config.channels.goodbye;
          }
        }
      }
      // Editable welcome/goodbye message templates — fallback only
      if (config.messages) {
        if (!settings.welcome_message && config.messages.welcome)  settings.welcome_message  = config.messages.welcome;
        if (!settings.goodbye_message && config.messages.goodbye)  settings.goodbye_message  = config.messages.goodbye;
      }
      // One-time modules migration: if DB still has default all-modules and file has explicit toggles, import file once
      if (config.modules && !settings._modulesMigrated) {
        try {
          const current = JSON.parse(settings.enabled_modules || '[]');
          const allModules = ['moderation','automod','logging','welcome','roles','tickets','suggestions','giveaways','leveling','minecraft','utility','starboard'];
          const isDefaultAll = current.length === allModules.length && allModules.every(m => current.includes(m));
          if (isDefaultAll) {
            const hasExplicitFalse = Object.values(config.modules).some(v => v === false);
            if (hasExplicitFalse) {
              const migrated = Object.entries(config.modules).filter(([,v])=>v===true).map(([k])=>k);
              // ensure at least fallback to current if file would empty everything
              if (migrated.length > 0) {
                settings.enabled_modules = JSON.stringify(migrated);
              }
            }
          }
        } catch (_) {}
        settings._modulesMigrated = 1;
        save();
      }
    } catch (e) {
    logger.error(`Error applying config.json overrides: ${e.message}`);
  }

  return settings;
}

function updateGuildSettings(guildId, key, value) {
  const settings = getGuildSettings(guildId);
  settings[key] = value;
  save();
}

function isModuleEnabled(guildId, moduleName) {
  // DB authoritative — allows per-guild /config module toggles without editing config.json
  // Keeps existing file as fallback for fresh guilds before first DB write
  try {
    const settings = getGuildSettings(guildId);
    if (settings && typeof settings.enabled_modules === 'string') {
      const modules = JSON.parse(settings.enabled_modules || '[]');
      // If DB has explicit list (including after migration), use it
      if (Array.isArray(modules) && modules.length > 0) {
        return modules.includes(moduleName);
      }
      // Empty list means all disabled — respect it
      if (Array.isArray(modules) && modules.length === 0) return false;
    }
  } catch (_) {}
  // Fallback to config.json (supports pre-existing installs before migration)
  const config = getGuildConfig(guildId);
  if (config.modules && config.modules.hasOwnProperty(moduleName)) {
    return config.modules[moduleName] === true;
  }
  return false;
}

// Automod Settings helper
function getAutomodSettings(guildId) {
  if (!data.automod_settings[guildId]) {
    data.automod_settings[guildId] = {
      guild_id: guildId,
      anti_spam: 0,
      anti_invite: 0,
      anti_caps: 0,
      anti_mentions: 0,
      bad_words: '[]',
      duplicate_detection: 0,
      raid_protection: 0
    };
    save();
  }
  return data.automod_settings[guildId];
}

function updateAutomodSettings(guildId, key, value) {
  const settings = getAutomodSettings(guildId);
  settings[key] = value;
  save();
}

// Moderation Logs helpers
function addModLog(guildId, userId, moderatorId, actionType, reason) {
  const log = {
    id: data.moderation_logs.length + 1,
    guild_id: guildId,
    user_id: userId,
    moderator_id: moderatorId,
    action_type: actionType,
    reason: reason || 'No reason provided',
    timestamp: Date.now()
  };
  data.moderation_logs.push(log);
  save();
  return log;
}

function getModLogs(guildId) {
  return data.moderation_logs.filter(log => log.guild_id === guildId);
}

// Warnings Helpers
function addWarning(guildId, userId, moderatorId, reason) {
  const warning = {
    id: data.warnings.length + 1,
    guild_id: guildId,
    user_id: userId,
    moderator_id: moderatorId,
    reason: reason || 'No reason provided',
    timestamp: Date.now()
  };
  data.warnings.push(warning);
  save();
  return warning;
}

function getWarnings(guildId, userId) {
  return data.warnings.filter(w => w.guild_id === guildId && w.user_id === userId);
}

function clearWarnings(guildId, userId) {
  const originalLength = data.warnings.length;
  data.warnings = data.warnings.filter(w => !(w.guild_id === guildId && w.user_id === userId));
  save();
  return originalLength - data.warnings.length;
}

// Giveaway Helpers
function saveGiveaway(giveaway) {
  data.giveaways[giveaway.message_id] = giveaway;
  save();
}

function getGiveaway(messageId) {
  return data.giveaways[messageId];
}

function getActiveGiveaways() {
  return Object.values(data.giveaways).filter(g => g.ended === 0);
}

function getAllGiveaways() {
  return Object.values(data.giveaways);
}

// Suggestions Helpers
function saveSuggestion(suggestion) {
  data.suggestions[suggestion.message_id] = suggestion;
  save();
}

function getSuggestion(messageId) {
  return data.suggestions[messageId];
}

function getAllSuggestions(guildId) {
  return Object.values(data.suggestions).filter(s => s.guild_id === guildId);
}

// Tickets Helpers
function saveTicket(ticket) {
  data.tickets[ticket.channel_id] = ticket;
  save();
}

function getTicket(channelId) {
  return data.tickets[channelId];
}

function getAllTickets(guildId) {
  return Object.values(data.tickets).filter(t => t.guild_id === guildId);
}

// Custom Commands Helpers
function saveCustomCommand(guildId, name, response, isEmbed = 0) {
  if (!data.custom_commands[guildId]) {
    data.custom_commands[guildId] = {};
  }
  data.custom_commands[guildId][name.toLowerCase()] = { response, is_embed: isEmbed };
  save();
}

function deleteCustomCommand(guildId, name) {
  if (data.custom_commands[guildId] && data.custom_commands[guildId][name.toLowerCase()]) {
    delete data.custom_commands[guildId][name.toLowerCase()];
    save();
    return true;
  }
  return false;
}

function getCustomCommands(guildId) {
  return data.custom_commands[guildId] || {};
}

// Leveling Helpers
function getUserLevel(guildId, userId) {
  if (!data.levels[guildId]) {
    data.levels[guildId] = {};
  }
  if (!data.levels[guildId][userId]) {
    data.levels[guildId][userId] = { xp: 0, level: 0, last_message_time: 0 };
  }
  return data.levels[guildId][userId];
}

function saveUserLevel(guildId, userId, xp, level, lastMessageTime) {
  if (!data.levels[guildId]) {
    data.levels[guildId] = {};
  }
  data.levels[guildId][userId] = { xp, level, last_message_time: lastMessageTime };
  save();
}

function getLeaderboard(guildId) {
  if (!data.levels[guildId]) return [];
  return Object.entries(data.levels[guildId]).map(([userId, stats]) => ({
    user_id: userId,
    ...stats
  })).sort((a, b) => {
    if (b.level !== a.level) {
      return b.level - a.level;
    }
    return b.xp - a.xp;
  });
}

function saveLevelReward(guildId, level, roleId) {
  if (!data.level_rewards[guildId]) {
    data.level_rewards[guildId] = {};
  }
  data.level_rewards[guildId][level] = roleId;
  save();
}

function getLevelRewards(guildId) {
  return data.level_rewards[guildId] || {};
}

function deleteLevelReward(guildId, level) {
  if (data.level_rewards[guildId] && data.level_rewards[guildId][level]) {
    delete data.level_rewards[guildId][level];
    save();
    return true;
  }
  return false;
}

// Starboard Helpers
function saveStarboardMessage(originalMsgId, starboardMsgId, guildId, starCount) {
  data.starboard_messages[originalMsgId] = { starboard_msg_id: starboardMsgId, guild_id: guildId, star_count: starCount };
  save();
}

function getStarboardMessage(originalMsgId) {
  return data.starboard_messages[originalMsgId];
}

// Puzzle Submission Helpers
function savePuzzleSubmission(submission) {
  data.puzzle_submissions[submission.id] = submission;
  save();
  return submission;
}

function getPuzzleSubmission(id) {
  return data.puzzle_submissions[id];
}

function deletePuzzleSubmission(id) {
  if (data.puzzle_submissions[id]) {
    delete data.puzzle_submissions[id];
    save();
    return true;
  }
  return false;
}

function getAllPuzzleSubmissions() {
  return Object.values(data.puzzle_submissions);
}

module.exports = {
  db: {
    prepare: (sql) => {
      // Mock db.prepare for backwards compatibility where direct raw queries are executed
      return {
        all: (guildId) => {
          if (sql.includes('moderation_logs')) {
            return getModLogs(guildId);
          }
          return [];
        }
      };
    }
  },
  init,
  getGuildConfig,
  getGuildSettings,
  updateGuildSettings,
  isModuleEnabled,
  getAutomodSettings,
  updateAutomodSettings,
  addModLog,
  getModLogs,
  addWarning,
  getWarnings,
  clearWarnings,
  saveGiveaway,
  getGiveaway,
  getActiveGiveaways,
  getAllGiveaways,
  saveSuggestion,
  getSuggestion,
  getAllSuggestions,
  saveTicket,
  getTicket,
  getAllTickets,
  saveCustomCommand,
  deleteCustomCommand,
  getCustomCommands,
  getUserLevel,
  saveUserLevel,
  getLeaderboard,
  saveLevelReward,
  getLevelRewards,
  deleteLevelReward,
  saveStarboardMessage,
  getStarboardMessage,
  savePuzzleSubmission,
  getPuzzleSubmission,
  deletePuzzleSubmission,
  getAllPuzzleSubmissions
};
