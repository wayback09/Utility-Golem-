# Golem - Discord Server Guardian

Golem is a custom, modular Discord server management bot built on Node.js, discord.js v14, and a pure JavaScript JSON database wrapper. It's designed to replace Carl-bot, Sapphire, and others with modularity, custom branding, and extreme stability.

---

## 🚀 Features

1. **Moderation Module:** `/ban`, `/unban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/clear`, `/lock`, `/unlock`, `/slowmode` with robust REST-API bypasses for caching issues.
2. **Automod Module:** Anti-spam, bad word filters, cap filters, excessive mentions filters, duplicate message detection.
3. **Logging System:** Comprehensive logs for mod actions.
4. **Interactive Roles:** Deploy dropdown role selection menus and auto-roles.
5. **Support Tickets:** Create support ticket buttons, automatic channels with staff permissions, and transcript logging.
6. **Giveaways Manager:** Time-scheduled giveaways with rolling winners, rerolling options, and database persistence.
7. **Leveling System:** Exp gain on message cooldown, `/level rank` command with text progress bar, server leaderboard, and role rewards!
8. **Puzzle Submissions:** `/puzzlesubmit` — members submit puzzles with images (plus optional answer image, details, difficulty, and hint) to a staff review channel. Approve to publish to a public channel (text or forum), reject to discard. Optionally pings a role on publish and posts the answer image as a spoiler.
9. **Modmail:** `/modmail` — members send messages to a private staff channel with role ping; replies are relayed back to the member.
10. **Commands-Only Channels:** Designate channels where normal chat is auto-deleted, leaving only slash commands — great for level-up, modmail, and puzzle submission channels.
11. **Custom Commands & Permissions:** Create custom text/embed commands with `/customcommand create` and granularly configure who can use them (roles, users, or permissions) via `/customcommand permissions`.
12. **Minecraft Integration:** Query server statuses, versions, MOTDs, and player lists natively.
13. **Built-in Web Dashboard:** A beautiful, dark-themed local web dashboard served directly from the bot for viewing stats and checking mod logs.
14. **One-Command Auto-Updates:** Run `/update` directly in Discord to automatically pull the latest code from GitHub and restart the bot.

---

## ⚙️ Configuration System (`config.json`)

After the bot first starts, a `config.json` file will be available in your root directory. This is the **single source of truth** for all bot configuration. Edit it directly in the Pterodactyl File Manager.

> **Important:** All channel and role IDs must be wrapped in double quotes `" "` to prevent Discord ID corruption.

> **Auto-merge on update:** When an update introduces new config options, the bot automatically adds them to your existing `config.json` on startup — your configured values are **never overwritten**. Just check the startup log for "Config updated automatically" and fill in the new keys. No need to delete or reset your config file.

**Full `config.json` schema:**
```json
{
  "bot": {
    "name": "Golem",
    "version": "1.0.0",
    "defaultLanguage": "en"
  },
  "guild": {
    "id": "YOUR_SERVER_ID",
    "prefix": "g!",
    "embedColor": "#5865F2"
  },
  "channels": {
    "logs":        "CHANNEL_ID",
    "welcome":     "CHANNEL_ID",
    "goodbye":     "CHANNEL_ID",
    "levelUp":     "CHANNEL_ID",
    "suggestions": "CHANNEL_ID",
    "tickets":     "CHANNEL_ID"
  },
  "commandChannels": {
    "level":       ["CHANNEL_ID", "CHANNEL_ID_2"],
    "giveaway":    ["CHANNEL_ID"],
    "tickets":     ["CHANNEL_ID"],
    "modmail":     ["CHANNEL_ID"],
    "puzzlesubmit": ["CHANNEL_ID"]
  },
  "commandOnlyChannels": ["CHANNEL_ID", "CHANNEL_ID_2"],
  "forms": {
    "modmail": {
      "channel": "STAFF_CHANNEL_ID",
      "role":    "STAFF_ROLE_ID"
    },
    "puzzlesubmit": {
      "channel":       "STAFF_REVIEW_CHANNEL_ID",
      "role":          "STAFF_ROLE_ID",
      "publicChannel": "PUBLIC_PUZZLE_CHANNEL_ID",
      "postRole":      "ROLE_TO_PING_ON_PUBLISH"
    }
  },
  "messages": {
    "welcome": "Welcome {user} to {server}!",
    "goodbye": "{username} has left the server."
  },
  "modules": {
    "moderation":  true,
    "automod":     false,
    "logging":     true,
    "welcome":     true,
    "leveling":    true,
    "tickets":     true,
    "suggestions": true,
    "giveaways":   true,
    "starboard":   false,
    "minecraft":   true,
    "utility":     true
  }
}
```

**How it works:**
- **`channels`** — Set where the bot sends Level Up messages, welcome messages, and mod logs.
- **`commandChannels`** — Restrict a slash command to specific channels only. Leave the array empty `[]` to allow it everywhere.
- **`commandOnlyChannels`** — Normal chat messages in these channels are automatically deleted; only slash commands are allowed.
- **`forms`** — Channel + staff role IDs for the modmail and puzzle systems. `puzzlesubmit.postRole` is pinged when an approved puzzle is published (leave as `""` for no ping).
- **`modules`** — Set `true` or `false` to enable or disable any feature. No restart needed for channel or module changes!

**Welcome message placeholders:** `{user}` renders the member's display name linked to their profile (works on every device, no mention-cache issues), `{username}` is their raw username, `{server}` the server name, and `{membercount}` the current member count.

---

## 🛠️ Installation Guide

### Option 1: Pterodactyl Panel (Auto-Updater)
1. In your Pterodactyl File Manager, upload `package.json` and `index.js` from the `bootstrap/` folder in this repo.
2. Set your Startup Command to `npm start`.
3. Create a `.env` file with:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `API_KEY` (Your custom password to access the web dashboard)
4. Start the server! The bootstrap will automatically download the `src/` folder from GitHub, install packages, and launch the bot. 
5. **To update your bot in the future, simply run `/update` inside Discord!** The bot will auto-download updates and restart itself safely.

### Option 2: Local / VPS Hosting
1. **Clone or Download** this directory.
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Rename `.env.example` to `.env` and fill in your `DISCORD_TOKEN`, `CLIENT_ID`, and `API_KEY`.
4. **Start Bot:**
   ```bash
   npm run dev
   ```

---

## 🌐 Web Dashboard
Golem runs a Web Dashboard and API on port `3000` (configurable via `PORT` in `.env`).
To access the dashboard:
1. Ensure port 3000 is forwarded/open on your host.
2. Visit `http://<your-server-ip>:3000` in your browser.
3. Enter the `API_KEY` you defined in your `.env` file to log in.
4. View server statistics and check moderation logs directly from the web! *(Note: Configuration settings are managed entirely via `config.json` as the single source of truth).*
