module.exports = {
  branding: {
    name: "Golem",
    color: "#1e1f29", // Sleek dark gaming theme color
    errorColor: "#ff4757",
    successColor: "#2ed573",
    warningColor: "#ffa502",
    footer: "Golem • Server Guardian"
  },
  
  // Default values when modules are enabled
  defaultSettings: {
    prefix: "g!",
    welcomeEnabled: 0,
    welcomeChannel: null,
    welcomeMessage: "Welcome {user} to {server}! You are member #{membercount}.",
    goodbyeEnabled: 0,
    goodbyeChannel: null,
    goodbyeMessage: "{username} has left the server.",
    autoRoleEnabled: 0,
    autoRoles: "[]", // JSON array of role IDs
    
    loggingEnabled: 0,
    loggingChannel: null,
    logEvents: JSON.stringify({
      messageDelete: true,
      messageEdit: true,
      memberJoin: true,
      memberLeave: true,
      roleChange: true,
      channelChange: true,
      ban: true,
      kick: true,
      timeout: true,
      voice: true
    }),

    starboardEnabled: 0,
    starboardChannel: null,
    starboardThreshold: 3,

    suggestionEnabled: 0,
    suggestionChannel: null,
    suggestionAutoApprove: false,

    ticketEnabled: 0,
    ticketCategory: null,
    ticketLogsChannel: null,

    levelingEnabled: 0,
    levelingXpRate: 15, // Average XP per message
    levelingCooldown: 60, // Seconds between XP gains
    levelUpChannel: null,
    embedColor: null,

    minecraftEnabled: 0,
    minecraftIp: "",
    minecraftPort: 25565
  }
};
