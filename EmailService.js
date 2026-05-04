/**
 * MIDTS Automation Engine
 * STAGE: 7 (Brevo transactional emails)
 * WHAT THIS FILE DOES:
 * - Sends controlled transactional emails through Brevo.
 * - Logs every email attempt to Google Sheets.
 * - Avoids sensitive Drive links in email body content.
 * DEPENDENCIES:
 * - Uses Brevo API key from Settings sheet: BREVO_API_KEY
 * - Uses Google Sheet tab: Email Logs
 * - Optional test recipient from Settings sheet: TEST_EMAIL_RECIPIENT
 * - UrlFetchApp external API access
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var EmailService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Email Logs
  EMAIL_LOGS_SHEET_NAME: 'Email Logs',

  // REQUIRED: Set this value in Settings sheet before running Stage 7 test emails.
  // Example: TEST_EMAIL_RECIPIENT = "your-test-inbox@example.com"
  TEST_EMAIL_RECIPIENT_KEY: 'TEST_EMAIL_RECIPIENT',

  // REQUIRED: Set this value in Settings sheet before sending production emails.
  // Example: BREVO_SENDER_EMAIL = "noreply@midts.co.uk"
  BREVO_SENDER_EMAIL_KEY: 'BREVO_SENDER_EMAIL',

  // REQUIRED: Set this value in Settings sheet before sending production emails.
  // Example: BREVO_SENDER_NAME = "MIDTS"
  BREVO_SENDER_NAME_KEY: 'BREVO_SENDER_NAME',

  /**
   * FUNCTION: ensureEmailLogsSheetStructure
   * PURPOSE: Ensure Email Logs sheet exists with fixed audit headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Email Logs sheet if missing; appends missing headers only.
   */
  ensureEmailLogsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = ['Log ID', 'Timestamp', 'Recipient', 'Subject', 'Template Key', 'Result', 'Brevo Message ID', 'Notes'];
      return DatabaseService.ensureSheetAndHeaders_(this.EMAIL_LOGS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.ensureEmailLogsSheetStructure', error);
      return { success: false, message: 'Failed to verify Email Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: sendTestEmail
   * PURPOSE: Send a simple Stage 7 verification email to TEST_EMAIL_RECIPIENT only.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Brevo email and appends one Email Logs row.
   */
  sendTestEmail: function () {
    // ===== MAIN LOGIC =====
    try {
      var recipientResult = this.getSettingValue_(this.TEST_EMAIL_RECIPIENT_KEY);
      if (!recipientResult.success) {
        return recipientResult;
      }

      return this.sendTransactionalEmail({
        toEmail: recipientResult.data.value,
        toName: 'MIDTS Test Recipient',
        subject: 'MIDTS Stage 7 email test',
        htmlContent: '<p>This is a controlled MIDTS Stage 7 Brevo email test.</p><p>No project files or Drive links are included.</p>',
        textContent: 'This is a controlled MIDTS Stage 7 Brevo email test. No project files or Drive links are included.',
        templateKey: 'STAGE_7_TEST'
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.sendTestEmail', error);
      return { success: false, message: 'Failed to send Stage 7 test email.' };
    }
  },

  /**
   * FUNCTION: sendLeadReceivedEmail
   * PURPOSE: Send a safe lead received acknowledgement without Drive/file links.
   * INPUT: lead (object: email, fullName, leadId)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Brevo email and appends one Email Logs row.
   */
  sendLeadReceivedEmail: function (lead) {
    // ===== MAIN LOGIC =====
    try {
      var payload = lead || {};
      var email = String(payload.email || '').trim();
      var fullName = String(payload.fullName || 'there').trim();
      var leadId = String(payload.leadId || '').trim();

      if (!email || email.indexOf('@') === -1) {
        return { success: false, message: 'A valid lead email is required.' };
      }

      // Never include sensitive file links in this acknowledgement.
      var safeLeadReference = leadId ? (' Reference: ' + this.escapeHtml_(leadId) + '.') : '';
      return this.sendTransactionalEmail({
        toEmail: email,
        toName: fullName,
        subject: 'MIDTS request received',
        htmlContent: '<p>Hello ' + this.escapeHtml_(fullName) + ',</p><p>We have received your MIDTS request and will review the details shortly.</p><p>' + safeLeadReference + '</p>',
        textContent: 'Hello ' + fullName + ', we have received your MIDTS request and will review the details shortly.' + safeLeadReference,
        templateKey: 'LEAD_RECEIVED'
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.sendLeadReceivedEmail', error, { lead: lead });
      return { success: false, message: 'Failed to send lead received email.' };
    }
  },

  /**
   * FUNCTION: sendTransactionalEmail
   * PURPOSE: Send one transactional email through Brevo using Settings/Script Properties secrets.
   * INPUT: payload (object: toEmail, toName, subject, htmlContent, textContent, templateKey)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one external API request to Brevo and appends one Email Logs row.
   */
  sendTransactionalEmail: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var toEmail = String(input.toEmail || '').trim();
      var toName = String(input.toName || '').trim();
      var subject = String(input.subject || '').trim();
      var htmlContent = String(input.htmlContent || '').trim();
      var textContent = String(input.textContent || '').trim();
      var templateKey = String(input.templateKey || 'CUSTOM').trim();

      if (!toEmail || toEmail.indexOf('@') === -1) {
        return { success: false, message: 'A valid recipient email is required.' };
      }
      if (!subject) {
        return { success: false, message: 'subject is required.' };
      }
      if (!htmlContent && !textContent) {
        return { success: false, message: 'htmlContent or textContent is required.' };
      }

      var apiKeyResult = this.getSettingValue_(ConfigService.BREVO_API_KEY_KEY);
      if (!apiKeyResult.success) {
        return apiKeyResult;
      }

      var senderEmailResult = this.getSettingValue_(this.BREVO_SENDER_EMAIL_KEY);
      if (!senderEmailResult.success) {
        return senderEmailResult;
      }

      var senderNameResult = this.getSettingValue_(this.BREVO_SENDER_NAME_KEY);
      if (!senderNameResult.success) {
        return senderNameResult;
      }

      // Brevo transactional email endpoint; API key is never exposed to frontend HTML.
      var response = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: {
          'api-key': apiKeyResult.data.value,
          'accept': 'application/json'
        },
        payload: JSON.stringify({
          sender: { email: senderEmailResult.data.value, name: senderNameResult.data.value },
          to: [{ email: toEmail, name: toName || toEmail }],
          subject: subject,
          htmlContent: htmlContent || '<p>' + this.escapeHtml_(textContent) + '</p>',
          textContent: textContent || this.stripHtml_(htmlContent)
        })
      });

      var statusCode = response.getResponseCode();
      var responseText = response.getContentText();
      var responseJson = {};
      try {
        responseJson = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        responseJson = { raw: responseText };
      }

      var success = statusCode >= 200 && statusCode < 300;
      var messageId = responseJson.messageId || '';
      this.logEmail_(toEmail, subject, templateKey, success ? 'Success' : 'Failed', messageId, 'HTTP ' + statusCode);

      if (!success) {
        return { success: false, message: 'Brevo email request failed.', data: { statusCode: statusCode, response: responseJson } };
      }

      return { success: true, message: 'Email sent successfully.', data: { statusCode: statusCode, messageId: messageId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.sendTransactionalEmail', error, { payload: payload });
      return { success: false, message: 'Failed to send transactional email.' };
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
      ErrorLogger.logError_('EmailService.getSettingValue_', error, { key: key });
      return { success: false, message: 'Failed to load setting value.' };
    }
  },

  /**
   * FUNCTION: logEmail_
   * PURPOSE: Internal helper to append an email audit row.
   * INPUT: recipient, subject, templateKey, result, messageId, notes
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Email Logs sheet.
   */
  logEmail_: function (recipient, subject, templateKey, result, messageId, notes) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureEmailLogsSheetStructure();
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.EMAIL_LOGS_SHEET_NAME);
      var logId = UtilsService.createPrefixedId_('LOG-');

      sheet.appendRow([
        logId,
        new Date(),
        recipient,
        subject,
        templateKey,
        result,
        messageId,
        notes
      ]);

      return { success: true, message: 'Email log written.', data: { logId: logId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.logEmail_', error, { recipient: recipient, subject: subject });
      return { success: false, message: 'Failed to write email log.' };
    }
  },

  /**
   * FUNCTION: escapeHtml_
   * PURPOSE: Internal helper to escape user-provided text for safe email HTML.
   * INPUT: value (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  escapeHtml_: function (value) {
    // ===== MAIN LOGIC =====
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * FUNCTION: stripHtml_
   * PURPOSE: Internal helper to produce plain text fallback content.
   * INPUT: value (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  stripHtml_: function (value) {
    // ===== MAIN LOGIC =====
    return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};
