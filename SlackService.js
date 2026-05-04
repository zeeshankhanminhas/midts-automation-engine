/**
 * MIDTS Automation Engine
 * STAGE: 8 (Slack internal alerts)
 * WHAT THIS FILE DOES:
 * - Sends controlled internal alerts to a configured Slack webhook.
 * - Logs every Slack alert attempt to Google Sheets.
 * - Avoids sensitive Drive links and secrets in Slack message content.
 * DEPENDENCIES:
 * - Uses Slack webhook from Settings sheet: SLACK_WEBHOOK_URL
 * - Uses Google Sheet tab: Slack Logs
 * - UrlFetchApp external API access
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var SlackService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Slack Logs
  SLACK_LOGS_SHEET_NAME: 'Slack Logs',

  /**
   * FUNCTION: ensureSlackLogsSheetStructure
   * PURPOSE: Ensure Slack Logs sheet exists with fixed audit headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Slack Logs sheet if missing; appends missing headers only.
   */
  ensureSlackLogsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = ['Log ID', 'Timestamp', 'Alert Type', 'Result', 'HTTP Status', 'Notes'];
      return DatabaseService.ensureSheetAndHeaders_(this.SLACK_LOGS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.ensureSlackLogsSheetStructure', error);
      return { success: false, message: 'Failed to verify Slack Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: sendStage8TestAlert
   * PURPOSE: Send a controlled Stage 8 test alert to the configured MIDTS Slack webhook.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Slack webhook request and appends one Slack Logs row.
   */
  sendStage8TestAlert: function () {
    // ===== MAIN LOGIC =====
    try {
      return this.sendInternalAlert({
        alertType: 'STAGE_8_TEST',
        title: 'MIDTS Stage 8 Slack test',
        body: 'Slack internal alerts are configured. No secrets or Drive links are included.',
        fields: {
          stage: '8',
          source: 'runStage8SlackAlertTest'
        }
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.sendStage8TestAlert', error);
      return { success: false, message: 'Failed to send Stage 8 Slack test alert.' };
    }
  },

  /**
   * FUNCTION: sendLeadCreatedAlert
   * PURPOSE: Send a safe internal Slack alert when a lead is created.
   * INPUT: lead (object: leadId, company, projectType, source)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Slack webhook request and appends one Slack Logs row.
   */
  sendLeadCreatedAlert: function (lead) {
    // ===== MAIN LOGIC =====
    try {
      var payload = lead || {};
      return this.sendInternalAlert({
        alertType: 'LEAD_CREATED',
        title: 'New MIDTS lead captured',
        body: 'A new lead has entered the MIDTS automation pipeline.',
        fields: {
          leadId: String(payload.leadId || ''),
          company: String(payload.company || ''),
          projectType: String(payload.projectType || ''),
          source: String(payload.source || '')
        }
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.sendLeadCreatedAlert', error, { lead: lead });
      return { success: false, message: 'Failed to send lead created Slack alert.' };
    }
  },

  /**
   * FUNCTION: sendInternalAlert
   * PURPOSE: Send one internal Slack alert through the configured webhook.
   * INPUT: payload (object: alertType, title, body, fields)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one external Slack webhook request and appends one Slack Logs row.
   */
  sendInternalAlert: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var alertType = String(input.alertType || 'CUSTOM').trim();
      var title = String(input.title || '').trim();
      var body = String(input.body || '').trim();
      var fields = input.fields || {};

      if (!title) {
        return { success: false, message: 'title is required.' };
      }
      if (!body) {
        return { success: false, message: 'body is required.' };
      }

      var webhookResult = this.getSettingValue_(ConfigService.SLACK_WEBHOOK_URL_KEY);
      if (!webhookResult.success) {
        return webhookResult;
      }

      var messageText = this.buildSlackMessage_(title, body, fields);

      // Slack webhook URL is read from Settings/Script Properties and never exposed to frontend HTML.
      var response = UrlFetchApp.fetch(webhookResult.data.value, {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({ text: messageText })
      });

      var statusCode = response.getResponseCode();
      var responseText = response.getContentText();
      var success = statusCode >= 200 && statusCode < 300;

      this.logSlackAlert_(alertType, success ? 'Success' : 'Failed', statusCode, responseText || 'No response body');

      if (!success) {
        return { success: false, message: 'Slack webhook request failed.', data: { statusCode: statusCode, responseText: responseText } };
      }

      return { success: true, message: 'Slack alert sent successfully.', data: { statusCode: statusCode } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.sendInternalAlert', error, { payload: payload });
      return { success: false, message: 'Failed to send Slack internal alert.' };
    }
  },

  /**
   * FUNCTION: getSettingValue_
   * PURPOSE: Internal helper to read a setting from Settings sheet with Script Properties fallback.
   * INPUT: key (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getSettingValue_: function (key) {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = DatabaseService.getSettingsMap();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var fromSheet = String(settingsResult.data.settingsMap[key] || '').trim();
      var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
      var value = fromSheet || fromScript;

      if (!value) {
        return { success: false, message: 'Missing required setting: ' + key, data: { missingKey: key } };
      }

      return { success: true, message: 'Setting loaded successfully.', data: { key: key, value: value } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.getSettingValue_', error, { key: key });
      return { success: false, message: 'Failed to load setting value.' };
    }
  },

  /**
   * FUNCTION: buildSlackMessage_
   * PURPOSE: Internal helper to build a safe plain-text Slack message.
   * INPUT: title (string), body (string), fields (object)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildSlackMessage_: function (title, body, fields) {
    // ===== MAIN LOGIC =====
    var lines = [];
    lines.push('*' + this.sanitizeSlackText_(title) + '*');
    lines.push(this.sanitizeSlackText_(body));

    Object.keys(fields || {}).forEach(function (key) {
      var value = String(fields[key] || '').trim();
      if (value) {
        lines.push('*' + key + ':* ' + SlackService.sanitizeSlackText_(value));
      }
    });

    return lines.join('\n');
  },

  /**
   * FUNCTION: sanitizeSlackText_
   * PURPOSE: Internal helper to keep alert content plain and avoid accidental mention/link formatting.
   * INPUT: value (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  sanitizeSlackText_: function (value) {
    // ===== MAIN LOGIC =====
    return String(value || '')
      .replace(/&/g, 'and')
      .replace(/</g, '(')
      .replace(/>/g, ')')
      .replace(/@/g, ' at ')
      .trim();
  },

  /**
   * FUNCTION: logSlackAlert_
   * PURPOSE: Internal helper to append a Slack alert audit row.
   * INPUT: alertType, result, httpStatus, notes
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Slack Logs sheet.
   */
  logSlackAlert_: function (alertType, result, httpStatus, notes) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureSlackLogsSheetStructure();
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SLACK_LOGS_SHEET_NAME);
      var logId = UtilsService.createPrefixedId_('LOG-');

      sheet.appendRow([
        logId,
        new Date(),
        alertType,
        result,
        httpStatus,
        notes
      ]);

      return { success: true, message: 'Slack log written.', data: { logId: logId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('SlackService.logSlackAlert_', error, { alertType: alertType, result: result });
      return { success: false, message: 'Failed to write Slack log.' };
    }
  }
};
