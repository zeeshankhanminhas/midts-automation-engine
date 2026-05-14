/**
 * MIDTS Automation Engine
 * STAGE: 11 (Step 2 technical requirement intake)
 * WHAT THIS FILE DOES:
 * - Accepts validated Step 2 technical requirement submissions.
 * - Updates the matching lead as Step 2 completed and qualified.
 * - Stores a compact technical summary in lead notes.
 * - Audits every Step 2 webhook outcome to the Step 2 Requirement Logs sheet.
 * DEPENDENCIES:
 * - Uses website webhook token from Settings sheet: WEBSITE_WEBHOOK_TOKEN
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Step 2 Requirement Logs
 * - LeadService (LeadService.gs)
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var Step2RequirementService = {
  // ===== CONFIG =====
  STEP2_LOGS_SHEET_NAME: 'Step 2 Requirement Logs',
  MAX_TEXT_LENGTH: 3000,
  STEP2_LOG_HEADERS: [
    'Timestamp',
    'Stage',
    'Success',
    'Message',
    'Lead ID',
    'Lead Score',
    'Qualification Status',
    'Payload Keys',
    'Email',
    'Project Type',
    'Timeline / Urgency',
    'Files Ready',
    'Requirement Complexity',
    'Result JSON'
  ],

  /**
   * FUNCTION: handlePostEvent
   * PURPOSE: Process one Step 2 technical requirement POST into a qualified lead update.
   * INPUT: e (Apps Script doPost event object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Leads row; appends one Step 2 Requirement Logs row.
   */
  handlePostEvent: function (e) {
    // ===== MAIN LOGIC =====
    var payload = {};
    try {
      var payloadResult = WebsiteWebhookService.parsePostEvent_(e);
      if (payloadResult.success && payloadResult.data && payloadResult.data.payload) {
        payload = payloadResult.data.payload;
      }
      if (!payloadResult.success) {
        this.logStep2Attempt_('Parse', payloadResult, payload);
        return payloadResult;
      }

      var tokenResult = WebsiteWebhookService.validateWebhookToken_(payload);
      if (!tokenResult.success) {
        this.logStep2Attempt_('Token validation', tokenResult, payload);
        return tokenResult;
      }

      var updateResult = this.updateLeadFromStep2Payload_(payload);
      this.logStep2Attempt_('Lead qualification', updateResult, payload);
      return updateResult;
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.handlePostEvent', error);
      var errorResult = { success: false, message: 'Step 2 requirement webhook failed unexpectedly.' };
      this.logStep2Attempt_('Unhandled error', errorResult, payload);
      return errorResult;
    }
  },

  /**
   * FUNCTION: ensureStep2RequirementSetup
   * PURPOSE: Verify Step 2 webhook dependencies are ready.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create Leads and Step 2 Requirement Logs sheet headers.
   */
  ensureStep2RequirementSetup: function () {
    // ===== MAIN LOGIC =====
    try {
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }

      var logsResult = this.ensureStep2LogSheet_();
      if (!logsResult.success) {
        return logsResult;
      }

      var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
      if (!tokenResult.success) {
        return tokenResult;
      }

      return {
        success: true,
        message: 'Step 2 requirement webhook setup verified.',
        data: {
          requiredSetting: ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY,
          auditSheet: this.STEP2_LOGS_SHEET_NAME
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.ensureStep2RequirementSetup', error);
      return { success: false, message: 'Failed to verify Step 2 requirement setup.' };
    }
  },

  /**
   * FUNCTION: updateLeadFromStep2Payload_
   * PURPOSE: Internal helper to validate Step 2 payload and qualify the matching lead.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Leads row.
   */
  updateLeadFromStep2Payload_: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var leadId = this.cleanText_(this.getField_(payload, ['leadId', 'lead_id', 'midtsLeadId', 'midts_lead_id']));
      if (!leadId) {
        return { success: false, message: 'leadId is required for Step 2 completion.' };
      }

      var scoreResult = this.calculateLeadScore_(payload);
      var qualifyResult = LeadService.markStep2Completed(leadId, scoreResult.data.leadScore);
      if (!qualifyResult.success) {
        return qualifyResult;
      }

      var notesResult = this.appendStep2Notes_(leadId, payload, scoreResult.data);
      return {
        success: true,
        message: 'Step 2 requirement submitted and lead qualified.',
        data: {
          leadId: leadId,
          leadScore: scoreResult.data.leadScore,
          highValueFlag: scoreResult.data.highValueFlag,
          qualificationStatus: 'Qualified',
          notesUpdate: notesResult
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.updateLeadFromStep2Payload_', error, { payload: this.redactSensitivePayload_(payload) });
      return { success: false, message: 'Failed to update lead from Step 2 requirement payload.' };
    }
  },

  /**
   * FUNCTION: calculateLeadScore_
   * PURPOSE: Internal helper to score Step 2 submissions deterministically.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  calculateLeadScore_: function (payload) {
    // ===== MAIN LOGIC =====
    var score = 50;
    var timeline = this.cleanText_(this.getField_(payload, ['timelineUrgency', 'timeline_urgency', 'timeline', 'deadline', 'requiredBy'])).toLowerCase();
    var filesReady = this.cleanText_(this.getField_(payload, ['filesDrawingsReady', 'files_drawings_ready', 'filesReady'])).toLowerCase();
    var complexity = this.cleanText_(this.getField_(payload, ['requirementComplexity', 'requirement_complexity', 'complexity'])).toLowerCase();
    var budget = this.cleanText_(this.getField_(payload, ['budget', 'estimatedBudget', 'estimated_budget'])).toLowerCase();
    var description = this.cleanText_(this.getField_(payload, ['technicalRequirement', 'technical_requirement', 'briefRequirement', 'brief_requirement', 'description', 'message', 'notes']));

    if (timeline.indexOf('urgent') !== -1 || timeline.indexOf('24') !== -1 || timeline.indexOf('72') !== -1 || timeline.indexOf('week') !== -1) {
      score += 10;
    }
    if (filesReady.indexOf('yes') !== -1 || filesReady.indexOf('ready') !== -1) {
      score += 15;
    }
    if (complexity.indexOf('cam') !== -1 || complexity.indexOf('reverse') !== -1 || complexity.indexOf('manufacturing') !== -1 || complexity.indexOf('mixed') !== -1) {
      score += 15;
    }
    if (budget && budget.indexOf('not') === -1 && budget.indexOf('unsure') === -1) {
      score += 5;
    }
    if (description.length >= 80) {
      score += 5;
    }

    score = Math.max(0, Math.min(100, score));
    return {
      success: true,
      message: 'Step 2 lead score calculated.',
      data: {
        leadScore: score,
        highValueFlag: score >= 80 ? 'Yes' : 'No'
      }
    };
  },

  /**
   * FUNCTION: appendStep2Notes_
   * PURPOSE: Internal helper to append Step 2 technical context to the lead Notes field.
   * INPUT: leadId (string), payload (object), scoreData (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Leads row Notes cell.
   */
  appendStep2Notes_: function (leadId, payload, scoreData) {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(leadId).trim()) {
          var existingNotes = String(values[i][8] || '').trim();
          var step2Notes = this.buildStep2Notes_(payload, scoreData);
          var combinedNotes = existingNotes ? (existingNotes + '\n\n' + step2Notes) : step2Notes;
          sheet.getRange(i + 1, 9).setValue(combinedNotes.slice(0, this.MAX_TEXT_LENGTH));
          return { success: true, message: 'Step 2 notes appended to lead.', data: { leadId: leadId } };
        }
      }

      return { success: false, message: 'Lead not found while appending Step 2 notes.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.appendStep2Notes_', error, { leadId: leadId });
      return { success: false, message: 'Failed to append Step 2 notes.' };
    }
  },

  /**
   * FUNCTION: buildStep2Notes_
   * PURPOSE: Internal helper to format Step 2 technical fields for the lead notes field.
   * INPUT: payload (object), scoreData (object)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildStep2Notes_: function (payload, scoreData) {
    // ===== MAIN LOGIC =====
    var lines = ['Step 2 technical requirement received.'];
    var fields = [
      ['Technical Requirement', ['technicalRequirement', 'technical_requirement', 'briefRequirement', 'brief_requirement', 'description', 'message', 'notes']],
      ['Timeline / Urgency', ['timelineUrgency', 'timeline_urgency', 'timeline', 'deadline', 'requiredBy']],
      ['Files / Drawings Ready', ['filesDrawingsReady', 'files_drawings_ready', 'filesReady']],
      ['Requirement Complexity', ['requirementComplexity', 'requirement_complexity', 'complexity']],
      ['Budget', ['budget', 'estimatedBudget', 'estimated_budget']],
      ['Phone', ['phone', 'phoneNumber', 'phone_number']]
    ];

    fields.forEach(function (entry) {
      var value = Step2RequirementService.cleanText_(Step2RequirementService.getField_(payload, entry[1]));
      if (value) {
        lines.push(entry[0] + ': ' + value);
      }
    });
    lines.push('Lead Score: ' + scoreData.leadScore);
    lines.push('High Value Flag: ' + scoreData.highValueFlag);
    return lines.join('\n');
  },

  /**
   * FUNCTION: ensureStep2LogSheet_
   * PURPOSE: Internal helper to create the Step 2 audit sheet with fixed headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create Step 2 Requirement Logs sheet and set missing headers.
   */
  ensureStep2LogSheet_: function () {
    // ===== MAIN LOGIC =====
    try {
      return DatabaseService.ensureSheetAndHeaders_(this.STEP2_LOGS_SHEET_NAME, this.STEP2_LOG_HEADERS);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.ensureStep2LogSheet_', error);
      return { success: false, message: 'Failed to verify Step 2 Requirement Logs sheet.' };
    }
  },

  /**
   * FUNCTION: logStep2Attempt_
   * PURPOSE: Internal helper to record every Step 2 webhook decision for operational debugging.
   * INPUT: stage (string), result (object), payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Step 2 Requirement Logs row; never throws back to doPost.
   */
  logStep2Attempt_: function (stage, result, payload) {
    // ===== MAIN LOGIC =====
    try {
      var ensureResult = this.ensureStep2LogSheet_();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(this.STEP2_LOGS_SHEET_NAME);
      var safePayload = this.redactSensitivePayload_(payload || {});
      var safeResult = this.redactSensitivePayload_(result || {});
      var resultData = result && result.data ? result.data : {};

      sheet.appendRow([
        new Date(),
        stage || 'Unknown',
        Boolean(result && result.success),
        result && result.message ? String(result.message) : '',
        resultData.leadId || this.cleanText_(this.getField_(safePayload, ['leadId', 'lead_id', 'midtsLeadId', 'midts_lead_id'])),
        resultData.leadScore || '',
        resultData.qualificationStatus || '',
        Object.keys(safePayload).sort().join(', '),
        this.cleanText_(this.getField_(safePayload, ['email', 'work_email', 'emailAddress', 'email_address'])),
        this.cleanText_(this.getField_(safePayload, ['projectType', 'project_type', 'service', 'requirement'])),
        this.cleanText_(this.getField_(safePayload, ['timelineUrgency', 'timeline_urgency', 'timeline', 'deadline', 'requiredBy'])),
        this.cleanText_(this.getField_(safePayload, ['filesDrawingsReady', 'files_drawings_ready', 'filesReady'])),
        this.cleanText_(this.getField_(safePayload, ['requirementComplexity', 'requirement_complexity', 'complexity'])),
        JSON.stringify(safeResult)
      ]);

      return { success: true, message: 'Step 2 requirement attempt logged.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('Step2RequirementService.logStep2Attempt_', error, { stage: stage });
      return { success: false, message: 'Failed to log Step 2 requirement attempt.' };
    }
  },

  /**
   * FUNCTION: isStep2Payload
   * PURPOSE: Detect whether a public POST should route to Step 2 instead of Step 1 lead intake.
   * INPUT: payload (object)
   * OUTPUT: boolean
   * SIDE EFFECTS: none
   */
  isStep2Payload: function (payload) {
    // ===== MAIN LOGIC =====
    var stage = this.cleanText_(this.getField_(payload, ['formStage', 'form_stage', 'submissionType', 'submission_type', 'stage'])).toLowerCase();
    return stage === 'step2' || stage === 'step_2' || stage === 'technical_requirement' || stage === 'requirements';
  },

  /**
   * FUNCTION: getField_
   * PURPOSE: Internal helper to read the first available value from common Step 2 aliases.
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
   * FUNCTION: redactSensitivePayload_
   * PURPOSE: Internal helper to remove public webhook token values before writing audit rows.
   * INPUT: value (object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  redactSensitivePayload_: function (value) {
    // ===== MAIN LOGIC =====
    return WebsiteWebhookService.redactSensitivePayload_(value);
  }
};
