/**
 * MIDTS Automation Engine
 * STAGE: 1 (Configuration constants and access helpers)
 * WHAT THIS FILE DOES:
 * - Defines sheet names and required keys used by foundational services.
 * DEPENDENCIES:
 * - Script Properties service
 * - Google Sheets tab: Settings
 */

// ===== CONFIG =====
var ConfigService = {
  // Uses Google Sheet tab: Settings
  SETTINGS_SHEET_NAME: 'Settings',

  // Uses Google Sheet tab: Error Logs
  ERROR_LOGS_SHEET_NAME: 'Error Logs',

  // Uses Google Sheet tab: Leads
  LEADS_SHEET_NAME: 'Leads',

  // Uses Google Sheet tab: Quotes
  QUOTES_SHEET_NAME: 'Quotes',

  // Uses Google Sheet tab: Vendors
  VENDORS_SHEET_NAME: 'Vendors',

  // Uses Google Sheet tab: Projects
  PROJECTS_SHEET_NAME: 'Projects',

  // REQUIRED: Set this value in Settings sheet before running external email workflows.
  // Uses Brevo API key from Settings sheet: BREVO_API_KEY
  // Example: BREVO_API_KEY = "xkeysib-xxxx"
  BREVO_API_KEY_KEY: 'BREVO_API_KEY',

  // REQUIRED: Set this value in Settings sheet before running Slack alert workflows.
  // Uses Slack webhook from Settings sheet: SLACK_WEBHOOK_URL
  // Example: SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/xxx/yyy/zzz"
  SLACK_WEBHOOK_URL_KEY: 'SLACK_WEBHOOK_URL',

  // REQUIRED: Set this value in Settings sheet before Drive folder automation.
  // Uses Google Drive root folder from Settings sheet: ROOT_DRIVE_FOLDER_ID
  // Example: ROOT_DRIVE_FOLDER_ID = "1AbCdEfGhIjKlMnOp"
  ROOT_DRIVE_FOLDER_ID_KEY: 'ROOT_DRIVE_FOLDER_ID',

  /**
   * FUNCTION: getRequiredSettingKeys
   * PURPOSE: Return the canonical list of required configuration keys.
   * INPUT: none
   * OUTPUT: string[]
   * SIDE EFFECTS: none
   */
  getRequiredSettingKeys: function () {
    // ===== MAIN LOGIC =====
    return [
      this.BREVO_API_KEY_KEY,
      this.SLACK_WEBHOOK_URL_KEY,
      this.ROOT_DRIVE_FOLDER_ID_KEY
    ];
  },

  /**
   * FUNCTION: validateRequiredSettings
   * PURPOSE: Check whether each required setting has a non-empty value in Settings sheet or Script Properties.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  validateRequiredSettings: function () {
    // ===== MAIN LOGIC =====
    try {
      var settingsMapResult = DatabaseService.getSettingsMap();
      if (!settingsMapResult.success) {
        return settingsMapResult;
      }

      var settingsMap = settingsMapResult.data.settingsMap;
      var requiredKeys = this.getRequiredSettingKeys();
      var missingKeys = [];

      // Check Settings sheet first, then Script Properties fallback for flexibility.
      requiredKeys.forEach(function (key) {
        var fromSheet = String(settingsMap[key] || '').trim();
        var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();

        if (!fromSheet && !fromScript) {
          missingKeys.push(key);
        }
      });

      if (missingKeys.length > 0) {
        return {
          success: false,
          message: 'Missing required settings values.',
          data: { missingKeys: missingKeys }
        };
      }

      return { success: true, message: 'Required settings are configured.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ConfigService.validateRequiredSettings', error);
      return { success: false, message: 'Failed to validate required settings.' };
    }
  }
};

/**
 * FUNCTION: getScriptProperty
 * PURPOSE: Read a single configuration value from Script Properties safely.
 * INPUT: key (string)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function getScriptProperty(key) {
  // ===== MAIN LOGIC =====
  try {
    // Guard against empty keys to avoid ambiguous property reads.
    if (!key) {
      return { success: false, message: 'Missing property key.' };
    }

    // Read property from secure Script Properties storage.
    var value = PropertiesService.getScriptProperties().getProperty(key);

    return {
      success: true,
      message: 'Property read completed.',
      data: { key: key, value: value }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('getScriptProperty', error, { key: key });
    return { success: false, message: 'Failed to read Script Property.' };
  }
}
