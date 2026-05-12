/**
 * MIDTS Automation Engine
 * STAGE: 10 (Website form lead webhook)
 * WHAT THIS FILE DOES:
 * - Accepts validated website form submissions from Apps Script doPost(e).
 * - Normalizes external form fields into LeadService.createLead input.
 * - Requires WEBSITE_WEBHOOK_TOKEN from Settings sheet or Script Properties.
 * DEPENDENCIES:
 * - Uses website webhook token from Settings sheet: WEBSITE_WEBHOOK_TOKEN
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Settings
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var WebsiteWebhookService = {
  // ===== CONFIG =====
  DEFAULT_SOURCE: 'Website',
  DEFAULT_COMPANY: 'Not provided',
  DEFAULT_PROJECT_TYPE: 'Website Enquiry',
  MAX_TEXT_LENGTH: 3000,

  /**
   * FUNCTION: handlePostEvent
   * PURPOSE: Process one public website form POST into a lead record.
   * INPUT: e (Apps Script doPost event object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append one Leads row when validation passes.
   */
  handlePostEvent: function (e) {
    // ===== MAIN LOGIC =====
    try {
      var payloadResult = this.parsePostEvent_(e);
      if (!payloadResult.success) {
        return payloadResult;
      }

      var tokenResult = this.validateWebhookToken_(payloadResult.data.payload);
      if (!tokenResult.success) {
        return tokenResult;
      }

      if (this.isHoneypotFilled_(payloadResult.data.payload)) {
        // Return success without creating a row so simple bot submissions receive no useful signal.
        return { success: true, message: 'Submission received.', data: { ignored: true } };
      }

      return this.createLeadFromWebsitePayload_(payloadResult.data.payload);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.handlePostEvent', error);
      return { success: false, message: 'Website lead webhook failed unexpectedly.' };
    }
  },

  /**
   * FUNCTION: ensureWebsiteWebhookSetup
   * PURPOSE: Verify the website webhook can receive submissions safely.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create Settings/Leads sheet headers and append missing WEBSITE_WEBHOOK_TOKEN row.
   */
  ensureWebsiteWebhookSetup: function () {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = this.ensureWebhookSettingsStructure_();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }

      var tokenResult = this.getConfiguredWebhookToken_();
      if (!tokenResult.success) {
        return tokenResult;
      }

      return {
        success: true,
        message: 'Website webhook setup verified.',
        data: { requiredSetting: ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.ensureWebsiteWebhookSetup', error);
      return { success: false, message: 'Failed to verify website webhook setup.' };
    }
  },

  /**
   * FUNCTION: parsePostEvent_
   * PURPOSE: Internal helper to parse JSON, text JSON, or form-urlencoded POST payloads.
   * INPUT: e (Apps Script doPost event object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  parsePostEvent_: function (e) {
    // ===== MAIN LOGIC =====
    try {
      var payload = {};
      var parameters = (e && e.parameter) ? e.parameter : {};
      Object.keys(parameters).forEach(function (key) {
        payload[key] = parameters[key];
      });

      var raw = e && e.postData && e.postData.contents ? String(e.postData.contents || '') : '';
      var contentType = e && e.postData && e.postData.type ? String(e.postData.type || '').toLowerCase() : '';
      if (raw) {
        var trimmed = raw.trim();
        var parsed = null;

        if (contentType.indexOf('application/json') !== -1 || trimmed.indexOf('{') === 0) {
          parsed = JSON.parse(trimmed);
        } else if (Object.keys(payload).length === 0 && trimmed.indexOf('=') !== -1) {
          parsed = this.parseQueryString_(trimmed);
        }

        if (parsed) {
          Object.keys(parsed).forEach(function (key) {
            payload[key] = parsed[key];
          });
        }
      }

      if (Object.keys(payload).length === 0) {
        return { success: false, message: 'No website form payload received.' };
      }

      return { success: true, message: 'Website form payload parsed.', data: { payload: payload } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.parsePostEvent_', error);
      return { success: false, message: 'Failed to parse website form payload.' };
    }
  },

  /**
   * FUNCTION: createLeadFromWebsitePayload_
   * PURPOSE: Internal helper to normalize public form fields and create one lead.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Leads row when validation passes.
   */
  createLeadFromWebsitePayload_: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var fullName = this.cleanText_(this.getField_(payload, ['fullName', 'full_name', 'name', 'yourName']));
      var email = this.cleanText_(this.getField_(payload, ['email', 'work_email', 'emailAddress', 'email_address']));
      var company = this.cleanText_(this.getField_(payload, ['company', 'companyName', 'company_name'])) || this.DEFAULT_COMPANY;
      var projectType = this.cleanText_(this.getField_(payload, ['projectType', 'project_type', 'service', 'requirement'])) || this.DEFAULT_PROJECT_TYPE;
      var source = this.cleanText_(this.getField_(payload, ['source', 'formSource'])) || this.DEFAULT_SOURCE;
      var notes = this.buildNotes_(payload);

      if (!fullName) {
        return { success: false, message: 'fullName/name is required.' };
      }
      if (!email || email.indexOf('@') === -1) {
        return { success: false, message: 'A valid email is required.' };
      }

      var result = LeadService.createLead({
        fullName: fullName,
        email: email,
        company: company,
        projectType: projectType,
        source: source,
        notes: notes
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: 'Website lead created successfully.',
        data: { leadId: result.data.leadId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.createLeadFromWebsitePayload_', error, { payload: payload });
      return { success: false, message: 'Failed to create website lead.' };
    }
  },

  /**
   * FUNCTION: validateWebhookToken_
   * PURPOSE: Internal helper to require the configured website webhook token on every public POST.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  validateWebhookToken_: function (payload) {
    // ===== MAIN LOGIC =====
    var configuredResult = this.getConfiguredWebhookToken_();
    if (!configuredResult.success) {
      return configuredResult;
    }

    var submittedToken = this.cleanText_(this.getField_(payload, ['webhookToken', 'webhook_token', 'formToken', 'token', ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY]));
    if (!submittedToken || submittedToken !== configuredResult.data.value) {
      return { success: false, message: 'Website webhook token is missing or invalid.' };
    }

    return { success: true, message: 'Website webhook token verified.' };
  },

  /**
   * FUNCTION: getConfiguredWebhookToken_
   * PURPOSE: Internal helper to read WEBSITE_WEBHOOK_TOKEN from Settings sheet or Script Properties.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append missing Settings key row.
   */
  getConfiguredWebhookToken_: function () {
    // ===== MAIN LOGIC =====
    try {
      var ensureResult = this.ensureWebhookSettingsStructure_();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var settingsResult = DatabaseService.getSettingsMap();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var key = ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY;
      var fromSheet = String(settingsResult.data.settingsMap[key] || '').trim();
      var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
      var value = fromSheet || fromScript;

      if (!value) {
        return { success: false, message: 'Missing required setting: ' + key, data: { missingKey: key } };
      }

      return { success: true, message: 'Website webhook token loaded.', data: { key: key, value: value } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.getConfiguredWebhookToken_', error);
      return { success: false, message: 'Failed to load website webhook token.' };
    }
  },

  /**
   * FUNCTION: ensureWebhookSettingsStructure_
   * PURPOSE: Internal helper to preserve Settings rows and add WEBSITE_WEBHOOK_TOKEN row if missing.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create Settings sheet and append one missing key row.
   */
  ensureWebhookSettingsStructure_: function () {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = DatabaseService.ensureSettingsSheetStructure();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.SETTINGS_SHEET_NAME);
      var key = ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY;
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === key) {
          return { success: true, message: 'Website webhook setting row verified.' };
        }
      }

      sheet.appendRow([key, '', 'REQUIRED: Set this value before accepting public website form posts']);
      return { success: true, message: 'Website webhook setting row added.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('WebsiteWebhookService.ensureWebhookSettingsStructure_', error);
      return { success: false, message: 'Failed to verify website webhook setting row.' };
    }
  },

  /**
   * FUNCTION: buildNotes_
   * PURPOSE: Internal helper to preserve useful website form context in the lead notes field.
   * INPUT: payload (object)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildNotes_: function (payload) {
    // ===== MAIN LOGIC =====
    var lines = [];
    var message = this.cleanText_(this.getField_(payload, ['notes', 'message', 'brief_requirement', 'projectDetails', 'project_details', 'description']));
    if (message) {
      lines.push(message);
    }

    var contextFields = [
      ['Timeline / Urgency', ['timeline_urgency', 'timelineUrgency', 'timeline', 'deadline', 'requiredBy']],
      ['Files / Drawings Ready', ['files_drawings_ready', 'filesDrawingsReady', 'filesReady']],
      ['Requirement Complexity', ['requirement_complexity', 'requirementComplexity', 'complexity']],
      ['Phone', ['phone', 'phoneNumber', 'phone_number']],
      ['Budget', ['budget', 'estimatedBudget', 'estimated_budget']],
      ['Page URL', ['pageUrl', 'page_url', 'url']],
      ['Consent', ['consent', 'privacyConsent', 'privacy_consent']]
    ];

    contextFields.forEach(function (entry) {
      var value = WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(payload, entry[1]));
      if (value) {
        lines.push(entry[0] + ': ' + value);
      }
    });

    lines.push('Received from website webhook.');
    return lines.join('\n').slice(0, this.MAX_TEXT_LENGTH);
  },

  /**
   * FUNCTION: isHoneypotFilled_
   * PURPOSE: Internal helper to ignore simple bot submissions without writing data.
   * INPUT: payload (object)
   * OUTPUT: boolean
   * SIDE EFFECTS: none
   */
  isHoneypotFilled_: function (payload) {
    // ===== MAIN LOGIC =====
    return Boolean(this.cleanText_(this.getField_(payload, ['formHoneypot', 'honeypot', '_gotcha'])));
  },

  /**
   * FUNCTION: getField_
   * PURPOSE: Internal helper to read the first available value from common website form aliases.
   * INPUT: payload (object), aliases (string[])
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  getField_: function (payload, aliases) {
    // ===== MAIN LOGIC =====
    for (var i = 0; i < aliases.length; i++) {
      var key = aliases[i];
      if (payload && Object.prototype.hasOwnProperty.call(payload, key)) {
        return payload[key];
      }
    }
    return '';
  },

  /**
   * FUNCTION: cleanText_
   * PURPOSE: Internal helper to normalize external form values before validation/storage.
   * INPUT: value (any)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  cleanText_: function (value) {
    // ===== MAIN LOGIC =====
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, this.MAX_TEXT_LENGTH);
  },

  /**
   * FUNCTION: parseQueryString_
   * PURPOSE: Internal helper to parse form-urlencoded text payloads when e.parameter is unavailable.
   * INPUT: raw (string)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  parseQueryString_: function (raw) {
    // ===== MAIN LOGIC =====
    var parsed = {};
    String(raw || '').split('&').forEach(function (pair) {
      if (!pair) {
        return;
      }
      var parts = pair.split('=');
      var key = decodeURIComponent(String(parts[0] || '').replace(/\+/g, ' '));
      var value = decodeURIComponent(String(parts.slice(1).join('=') || '').replace(/\+/g, ' '));
      if (key) {
        parsed[key] = value;
      }
    });
    return parsed;
  }
};
