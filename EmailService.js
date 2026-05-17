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
 * - Step 2 form base URL from Settings sheet: STEP2_FORM_BASE_URL
 * - Vendor pricing form base URL from Settings sheet: VENDOR_PRICING_FORM_BASE_URL
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
      if (!leadId) {
        return { success: false, message: 'leadId is required to send the Step 2 link.' };
      }

      var step2BaseUrlResult = this.getSettingValue_(ConfigService.STEP2_FORM_BASE_URL_KEY);
      if (!step2BaseUrlResult.success) {
        return step2BaseUrlResult;
      }
      var step2Url = this.buildStep2FormUrl_(step2BaseUrlResult.data.value, leadId);

      // Never include sensitive file links in this acknowledgement.
      var safeLeadReference = ' Reference: ' + this.escapeHtml_(leadId) + '.';
      var safeStep2Url = this.escapeHtml_(step2Url);
      return this.sendTransactionalEmail({
        toEmail: email,
        toName: fullName,
        subject: 'MIDTS request received - complete Step 2',
        htmlContent: '<p>Hello ' + this.escapeHtml_(fullName) + ',</p><p>We have received your MIDTS request.</p><p>Please complete the Step 2 technical requirement form so we can qualify the work: <a href="' + safeStep2Url + '">Complete Step 2</a>.</p><p>' + safeLeadReference + '</p>',
        textContent: 'Hello ' + fullName + ', we have received your MIDTS request. Please complete the Step 2 technical requirement form: ' + step2Url + safeLeadReference,
        templateKey: 'LEAD_RECEIVED_STEP_2'
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.sendLeadReceivedEmail', error, { lead: lead });
      return { success: false, message: 'Failed to send lead received email.' };
    }
  },

  /**
   * FUNCTION: sendVendorPricingRequestEmail
   * PURPOSE: Send sanitized project details and a pricing form link to an assigned vendor.
   * INPUT: request (object: vendorEmail, vendorName, vendorId, lead)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Brevo email and appends one Email Logs row.
   */
  sendVendorPricingRequestEmail: function (request) {
    // ===== MAIN LOGIC =====
    try {
      var payload = request || {};
      var lead = payload.lead || {};
      var vendorEmail = String(payload.vendorEmail || '').trim();
      var vendorName = String(payload.vendorName || 'there').trim();
      var vendorId = String(payload.vendorId || '').trim();
      var leadId = String(lead.leadId || payload.leadId || '').trim();

      if (!vendorEmail || vendorEmail.indexOf('@') === -1) {
        return { success: false, message: 'A valid vendor email is required.' };
      }
      if (!vendorId || !leadId) {
        return { success: false, message: 'vendorId and leadId are required to send the vendor pricing link.' };
      }

      var baseUrlResult = this.getSettingValue_(ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY);
      if (!baseUrlResult.success) {
        return baseUrlResult;
      }
      var pricingUrl = this.buildVendorPricingFormUrl_(baseUrlResult.data.value, leadId, vendorId);

      var company = String(lead.company || 'Not specified').trim();
      var projectType = String(lead.projectType || 'Not specified').trim();
      var notes = String(lead.notes || 'No technical notes provided yet.').trim();
      var qualificationStatus = String(lead.qualificationStatus || '').trim();
      var safePricingUrl = this.escapeHtml_(pricingUrl);

      var htmlContent = '<p>Hello ' + this.escapeHtml_(vendorName) + ',</p>' +
        '<p>MIDTS has assigned you a qualified request for vendor pricing.</p>' +
        '<p><strong>Lead reference:</strong> ' + this.escapeHtml_(leadId) + '</p>' +
        '<p><strong>Company:</strong> ' + this.escapeHtml_(company) + '</p>' +
        '<p><strong>Project type:</strong> ' + this.escapeHtml_(projectType) + '</p>' +
        '<p><strong>Qualification status:</strong> ' + this.escapeHtml_(qualificationStatus || 'Qualified') + '</p>' +
        '<p><strong>Project details:</strong><br>' + this.escapeHtml_(notes).replace(/\n/g, '<br>') + '</p>' +
        '<p>Submit your cost, turnaround, and assumptions here: <a href="' + safePricingUrl + '">Submit vendor pricing</a>.</p>' +
        '<p>Please do not forward this link. It is tied to your vendor assignment.</p>';

      var textContent = 'Hello ' + vendorName + ', MIDTS has assigned you a qualified request for vendor pricing. ' +
        'Lead reference: ' + leadId + '. Company: ' + company + '. Project type: ' + projectType + '. ' +
        'Qualification status: ' + (qualificationStatus || 'Qualified') + '. Project details: ' + notes + '. ' +
        'Submit your cost, turnaround, and assumptions here: ' + pricingUrl + '. Please do not forward this link.';

      return this.sendTransactionalEmail({
        toEmail: vendorEmail,
        toName: vendorName,
        subject: 'MIDTS vendor pricing request - ' + leadId,
        htmlContent: htmlContent,
        textContent: textContent,
        templateKey: 'VENDOR_PRICING_REQUEST'
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('EmailService.sendVendorPricingRequestEmail', error, { request: request });
      return { success: false, message: 'Failed to send vendor pricing request email.' };
    }
  },

  /**
   * FUNCTION: buildStep2FormUrl_
   * PURPOSE: Internal helper to create a personalized Step 2 form link for an existing lead.
   * INPUT: baseUrl (string), leadId (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildStep2FormUrl_: function (baseUrl, leadId) {
    // ===== MAIN LOGIC =====
    var trimmedBaseUrl = String(baseUrl || '').trim();
    var separator = trimmedBaseUrl.indexOf('?') === -1 ? '?' : '&';
    return trimmedBaseUrl + separator + 'leadId=' + encodeURIComponent(String(leadId || '').trim());
  },

  /**
   * FUNCTION: buildVendorPricingFormUrl_
   * PURPOSE: Internal helper to create a personalized vendor pricing form link.
   * INPUT: baseUrl (string), leadId (string), vendorId (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildVendorPricingFormUrl_: function (baseUrl, leadId, vendorId) {
    // ===== MAIN LOGIC =====
    var trimmedBaseUrl = String(baseUrl || '').trim();
    var separator = trimmedBaseUrl.indexOf('?') === -1 ? '?' : '&';
    return trimmedBaseUrl + separator + 'leadId=' + encodeURIComponent(String(leadId || '').trim()) + '&vendorId=' + encodeURIComponent(String(vendorId || '').trim());
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
      .replace(/\"/g, '&quot;')
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
