/**
 * MIDTS Automation Engine
 * STAGE: 2 (Lead capture foundation)
 * WHAT THIS FILE DOES:
 * - Validates lead input and appends safe lead records to the Leads sheet.
 * DEPENDENCIES:
 * - Google Sheets tab: Leads
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var LeadService = {
  /**
   * FUNCTION: createLead
   * PURPOSE: Validate and persist one lead record using append-only writes.
   * INPUT: input (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append a new row to Leads sheet.
   */
  createLead: function (input) {
    // ===== MAIN LOGIC =====
    try {
      // Ensure Leads tab exists with fixed headers before write attempts.
      var ensureResult = DatabaseService.ensureLeadsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      // Validate and normalize user-provided input before writing to Sheets.
      var validationResult = this.validateLeadInput_(input);
      if (!validationResult.success) {
        return validationResult;
      }

      // Append one row only after all validation checks pass.
      return this.appendLeadRow_(validationResult.data.normalizedLead);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.createLead', error, { input: input });
      return { success: false, message: 'Failed to create lead due to unexpected error.' };
    }
  },

  /**
   * FUNCTION: validateLeadInput_
   * PURPOSE: Enforce required fields and normalize lead payload values.
   * INPUT: input (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  validateLeadInput_: function (input) {
    // ===== MAIN LOGIC =====
    try {
      var payload = input || {};

      // Required fields minimize unusable records and downstream manual cleanup.
      var fullName = String(payload.fullName || '').trim();
      var email = String(payload.email || '').trim();
      var company = String(payload.company || '').trim();
      var projectType = String(payload.projectType || '').trim();
      var source = String(payload.source || 'Manual').trim();
      var notes = String(payload.notes || '').trim();

      if (!fullName) {
        return { success: false, message: 'fullName is required.' };
      }

      if (!email || email.indexOf('@') === -1) {
        // Basic sanity check prevents obviously invalid email values at ingestion time.
        return { success: false, message: 'A valid email is required.' };
      }

      if (!company) {
        return { success: false, message: 'company is required.' };
      }

      if (!projectType) {
        return { success: false, message: 'projectType is required.' };
      }

      return {
        success: true,
        message: 'Lead input validated successfully.',
        data: {
          normalizedLead: {
            fullName: fullName,
            email: email,
            company: company,
            projectType: projectType,
            status: 'New',
            source: source,
            notes: notes,
            step1CompletedAt: new Date(),
            // Blank timestamp means Step 2 has not been completed yet.
            step2CompletedAt: '',
            qualificationStatus: 'Pending',
            leadScore: 0,
            highValueFlag: 'No',
            // Blank timestamps mean reminders have not been sent yet.
            reminder2hSentAt: '',
            reminder24hSentAt: '',
            reminder72hSentAt: '',
            lastReminderStage: 'None',
            nurtureState: 'Awaiting Step 2',
            // Reminder Status starts as Pending until scheduler/processing updates it.
            reminderStatus: 'Pending'
          }
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.validateLeadInput_', error, { input: input });
      return { success: false, message: 'Failed to validate lead input.' };
    }
  },


  /**
   * FUNCTION: markStep2Completed
   * PURPOSE: Mark a lead as qualified when Step 2 is completed and update nurture fields.
   * INPUT: leadId (string), leadScore (number, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one existing lead row in Leads sheet.
   */
  markStep2Completed: function (leadId, leadScore) {
    // ===== MAIN LOGIC =====
    try {
      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(leadId).trim()) {
          // Step 2 completion moves lead to qualified state for downstream workflow gating.
          var computedScore = Number(leadScore || 0);
          var highValueFlag = computedScore >= 80 ? 'Yes' : 'No';

          sheet.getRange(i + 1, 11).setValue(new Date());
          sheet.getRange(i + 1, 12).setValue('Qualified');
          sheet.getRange(i + 1, 13).setValue(computedScore);
          sheet.getRange(i + 1, 14).setValue(highValueFlag);
          sheet.getRange(i + 1, 19).setValue('Qualified');
          sheet.getRange(i + 1, 7).setValue('Qualified');

          return {
            success: true,
            message: 'Lead marked as Step 2 completed and qualified.',
            data: { leadId: leadId, leadScore: computedScore, highValueFlag: highValueFlag }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.markStep2Completed', error, { leadId: leadId, leadScore: leadScore });
      return { success: false, message: 'Failed to mark Step 2 completion.' };
    }
  },



  /**
   * FUNCTION: refreshReminderStatus
   * PURPOSE: Compute and persist a single reminder lifecycle status for easier operations visibility.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates Last Reminder Stage and Reminder Status columns for one lead row.
   */
  refreshReminderStatus: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(leadId).trim()) {
          var createdAt = values[i][1];
          var step2CompletedAt = values[i][10];
          var reminder2hSentAt = values[i][14];
          var reminder24hSentAt = values[i][15];
          var reminder72hSentAt = values[i][16];

          var now = new Date();
          var createdMs = (createdAt instanceof Date) ? createdAt.getTime() : 0;
          var elapsedHours = createdMs > 0 ? ((now.getTime() - createdMs) / (1000 * 60 * 60)) : 0;
          var isStep2Completed = step2CompletedAt instanceof Date;

          var status = 'Pending';
          var lastStage = 'None';

          if (isStep2Completed) {
            status = 'Closed - Step 2 Complete';
            lastStage = 'Closed';
          } else if (elapsedHours >= 72) {
            status = reminder72hSentAt ? 'Reminder 72h Sent' : 'Reminder 72h Due';
            lastStage = reminder72hSentAt ? '72h Sent' : '72h Due';
          } else if (elapsedHours >= 24) {
            status = reminder24hSentAt ? 'Reminder 24h Sent' : 'Reminder 24h Due';
            lastStage = reminder24hSentAt ? '24h Sent' : '24h Due';
          } else if (elapsedHours >= 2) {
            status = reminder2hSentAt ? 'Reminder 2h Sent' : 'Reminder 2h Due';
            lastStage = reminder2hSentAt ? '2h Sent' : '2h Due';
          }

          // Column 18 = Last Reminder Stage, Column 20 = Reminder Status.
          sheet.getRange(i + 1, 18).setValue(lastStage);
          sheet.getRange(i + 1, 20).setValue(status);

          return {
            success: true,
            message: 'Reminder status refreshed successfully.',
            data: { leadId: leadId, reminderStatus: status, lastReminderStage: lastStage, elapsedHours: elapsedHours }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.refreshReminderStatus', error, { leadId: leadId });
      return { success: false, message: 'Failed to refresh reminder status.' };
    }
  },

  /**
   * FUNCTION: getReminderAuditSnapshot
   * PURPOSE: Evaluate reminder due/sent state so blank reminder timestamps can be proven as expected or flagged.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getReminderAuditSnapshot: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(leadId).trim()) {
          var createdAt = values[i][1];
          var step2CompletedAt = values[i][10];
          var reminder2hSentAt = values[i][14];
          var reminder24hSentAt = values[i][15];
          var reminder72hSentAt = values[i][16];

          var now = new Date();
          var createdMs = (createdAt instanceof Date) ? createdAt.getTime() : 0;
          var elapsedHours = createdMs > 0 ? ((now.getTime() - createdMs) / (1000 * 60 * 60)) : 0;
          var isStep2Completed = step2CompletedAt instanceof Date;

          // If Step 2 is complete, no reminders are required by nurture policy.
          var due2h = !isStep2Completed && elapsedHours >= 2;
          var due24h = !isStep2Completed && elapsedHours >= 24;
          var due72h = !isStep2Completed && elapsedHours >= 72;

          var status = {
            reminder2h: {
              isDue: due2h,
              sentAt: reminder2hSentAt || '',
              isBlankExpected: !due2h || isStep2Completed,
              note: (!due2h || isStep2Completed) ? 'Blank is expected.' : 'Blank may indicate pending job or bug.'
            },
            reminder24h: {
              isDue: due24h,
              sentAt: reminder24hSentAt || '',
              isBlankExpected: !due24h || isStep2Completed,
              note: (!due24h || isStep2Completed) ? 'Blank is expected.' : 'Blank may indicate pending job or bug.'
            },
            reminder72h: {
              isDue: due72h,
              sentAt: reminder72hSentAt || '',
              isBlankExpected: !due72h || isStep2Completed,
              note: (!due72h || isStep2Completed) ? 'Blank is expected.' : 'Blank may indicate pending job or bug.'
            }
          };

          return {
            success: true,
            message: 'Reminder audit snapshot computed.',
            data: {
              leadId: leadId,
              elapsedHours: elapsedHours,
              step2Completed: isStep2Completed,
              reminderStatus: status
            }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.getReminderAuditSnapshot', error, { leadId: leadId });
      return { success: false, message: 'Failed to compute reminder audit snapshot.' };
    }
  },


  /**
   * FUNCTION: processReminderDueLeads
   * PURPOSE: Evaluate all leads and update reminder status/timestamps when 2h/24h/72h reminder thresholds are due.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates reminder fields in Leads sheet; no external email sending in this stage.
   */
  processReminderDueLeads: function () {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      var updatedLeadIds = [];

      for (var i = 1; i < values.length; i++) {
        var leadId = String(values[i][0] || '').trim();
        if (!leadId) {
          continue;
        }

        var createdAt = values[i][1];
        var step2CompletedAt = values[i][10];
        var reminder2hSentAt = values[i][14];
        var reminder24hSentAt = values[i][15];
        var reminder72hSentAt = values[i][16];

        // Skip reminder lifecycle updates once Step 2 is complete.
        if (step2CompletedAt instanceof Date) {
          sheet.getRange(i + 1, 18).setValue('Closed');
          sheet.getRange(i + 1, 20).setValue('Closed - Step 2 Complete');
          continue;
        }

        var createdMs = (createdAt instanceof Date) ? createdAt.getTime() : 0;
        if (createdMs <= 0) {
          continue;
        }

        var elapsedHours = (new Date().getTime() - createdMs) / (1000 * 60 * 60);

        // Timestamp/state-based nurture progression:
        // - Blank reminder timestamp means "not sent yet"
        // - Write timestamp only when that reminder stage becomes due.
        if (elapsedHours >= 72 && !reminder72hSentAt) {
          sheet.getRange(i + 1, 17).setValue(new Date());
          sheet.getRange(i + 1, 18).setValue('72h Sent');
          sheet.getRange(i + 1, 20).setValue('Reminder 72h Sent');
          updatedLeadIds.push(leadId);
          continue;
        }

        if (elapsedHours >= 24 && !reminder24hSentAt) {
          sheet.getRange(i + 1, 16).setValue(new Date());
          sheet.getRange(i + 1, 18).setValue('24h Sent');
          sheet.getRange(i + 1, 20).setValue('Reminder 24h Sent');
          updatedLeadIds.push(leadId);
          continue;
        }

        if (elapsedHours >= 2 && !reminder2hSentAt) {
          sheet.getRange(i + 1, 15).setValue(new Date());
          sheet.getRange(i + 1, 18).setValue('2h Sent');
          sheet.getRange(i + 1, 20).setValue('Reminder 2h Sent');
          updatedLeadIds.push(leadId);
          continue;
        }

        // Pending means lead is still waiting for next reminder threshold.
        sheet.getRange(i + 1, 20).setValue('Pending');
      }

      return {
        success: true,
        message: 'Reminder due lead processing completed.',
        data: { updatedCount: updatedLeadIds.length, updatedLeadIds: updatedLeadIds }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.processReminderDueLeads', error);
      return { success: false, message: 'Failed to process reminder due leads.' };
    }
  },


  /**
   * FUNCTION: canLeadProceedToQuote
   * PURPOSE: Enforce gating rule that only qualified leads can proceed to quote generation.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  canLeadProceedToQuote: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(leadId).trim()) {
          var qualificationStatus = String(values[i][11] || '').trim();
          var step2CompletedAt = values[i][10];

          // Lead is eligible only when Step 2 is completed and status is explicitly Qualified.
          var allowed = qualificationStatus === 'Qualified' && (step2CompletedAt instanceof Date);

          return {
            success: true,
            message: allowed ? 'Lead can proceed to quote generation.' : 'Lead is blocked until qualification is complete.',
            data: {
              leadId: leadId,
              qualificationStatus: qualificationStatus,
              step2Completed: step2CompletedAt instanceof Date,
              canProceed: allowed
            }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.canLeadProceedToQuote', error, { leadId: leadId });
      return { success: false, message: 'Failed to evaluate quote gating.' };
    }
  },

  /**
   * FUNCTION: appendLeadRow_
   * PURPOSE: Append a normalized lead record as one new row in Leads sheet.
   * INPUT: normalizedLead (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Leads sheet.
   */
  appendLeadRow_: function (normalizedLead) {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      // Uses unique ID prefix LEAD- to satisfy project ID convention.
      var leadId = UtilsService.createPrefixedId_('LEAD-');

      sheet.appendRow([
        leadId,
        new Date(),
        normalizedLead.fullName,
        normalizedLead.email,
        normalizedLead.company,
        normalizedLead.projectType,
        normalizedLead.status,
        normalizedLead.source,
        normalizedLead.notes,
        normalizedLead.step1CompletedAt,
        normalizedLead.step2CompletedAt,
        normalizedLead.qualificationStatus,
        normalizedLead.leadScore,
        normalizedLead.highValueFlag,
        normalizedLead.reminder2hSentAt,
        normalizedLead.reminder24hSentAt,
        normalizedLead.reminder72hSentAt,
        normalizedLead.lastReminderStage,
        normalizedLead.nurtureState,
        normalizedLead.reminderStatus
      ]);

      return {
        success: true,
        message: 'Lead created successfully.',
        data: { leadId: leadId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('LeadService.appendLeadRow_', error, { normalizedLead: normalizedLead });
      return { success: false, message: 'Failed to append lead row.' };
    }
  }
};
