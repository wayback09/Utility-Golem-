const db = require('../src/database/db');
const logger = require('../src/utils/logger');

function runTest() {
  logger.info("Running database validation checks...");
  
  // Initialize Database
  db.init();

  // Test Guild Settings
  const testGuildId = "123456789012345678";
  logger.info("Testing Guild Settings read/write...");
  
  db.updateGuildSettings(testGuildId, "welcome_enabled", 0);
  const settingsZero = db.getGuildSettings(testGuildId);
  if (!settingsZero || settingsZero.welcome_enabled !== 0) {
    logger.error("Guild settings write/read 0 test failed!");
    process.exit(1);
  }

  db.updateGuildSettings(testGuildId, "welcome_enabled", 1);
  const settingsOne = db.getGuildSettings(testGuildId);
  if (!settingsOne || settingsOne.welcome_enabled !== 1) {
    logger.error("Guild settings write/read 1 test failed!");
    process.exit(1);
  }
  db.updateGuildSettings(testGuildId, "welcome_enabled", 0);
  logger.success("Guild settings tests passed.");

  // Test Warning System
  logger.info("Testing Warning logs...");
  db.addWarning(testGuildId, "9999", "8888", "Test Warning");
  const warnings = db.getWarnings(testGuildId, "9999");
  if (warnings.length === 0 || warnings[0].reason !== "Test Warning") {
    logger.error("Warning logs read/write test failed!");
    process.exit(1);
  }
  
  db.clearWarnings(testGuildId, "9999");
  const warningsCleared = db.getWarnings(testGuildId, "9999");
  if (warningsCleared.length !== 0) {
    logger.error("Warning clear test failed!");
    process.exit(1);
  }
  logger.success("Warning tests passed.");

  // Test Leveling
  logger.info("Testing leveling system storage...");
  db.saveUserLevel(testGuildId, "9999", 50, 2, Date.now());
  const stats = db.getUserLevel(testGuildId, "9999");
  if (stats.xp !== 50 || stats.level !== 2) {
    logger.error("Leveling read/write test failed!");
    process.exit(1);
  }
  logger.success("Leveling tests passed.");

  // Test Custom Commands & Permissions
  logger.info("Testing custom command permissions...");
  db.saveCustomCommand(testGuildId, "testrule", "Rule text", 1, ["ROLE_123"], ["USER_456"], "ManageMessages");
  const testCmd = db.getCustomCommand(testGuildId, "testrule");
  if (
    !testCmd ||
    testCmd.response !== "Rule text" ||
    testCmd.is_embed !== 1 ||
    !testCmd.allowed_roles.includes("ROLE_123") ||
    !testCmd.allowed_users.includes("USER_456") ||
    testCmd.required_permission !== "ManageMessages"
  ) {
    logger.error("Custom command creation with permissions test failed!");
    process.exit(1);
  }

  // Update permissions
  db.setCustomCommandPermissions(testGuildId, "testrule", {
    allowed_roles: ["ROLE_123", "ROLE_999"],
    allowed_users: [],
    required_permission: null
  });
  const updatedCmd = db.getCustomCommand(testGuildId, "testrule");
  if (
    !updatedCmd ||
    updatedCmd.allowed_roles.length !== 2 ||
    updatedCmd.allowed_users.length !== 0 ||
    updatedCmd.required_permission !== null
  ) {
    logger.error("Custom command permissions update test failed!");
    process.exit(1);
  }

  // Cleanup test command
  db.deleteCustomCommand(testGuildId, "testrule");
  if (db.getCustomCommand(testGuildId, "testrule") !== null) {
    logger.error("Custom command deletion test failed!");
    process.exit(1);
  }
  logger.success("Custom command permissions tests passed.");

  logger.success("All Golem database schema checks passed successfully!");
}

runTest();
