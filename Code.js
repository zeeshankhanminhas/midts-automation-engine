/**
 * MIDTS Automation Engine
 * STAGE: 1 (Foundation bootstrap; no business workflow automation yet)
 * WHAT THIS FILE DOES:
 * - Provides entry-point and Stage 1 validation helpers.
 * DEPENDENCIES:
 * - Google Sheets tabs via SpreadsheetApp
 * - ConfigService (Config.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage1Validation
 * PURPOSE: Validate that Stage 1 foundational prerequisites exist without changing user data.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create missing required sheet tabs and append missing headers only.
 */
function runStage1Validation() {
  // ===== MAIN LOGIC =====
  try {
    // Validate settings tab and required keys for secure configuration.
    var settingsResult = DatabaseService.ensureSettingsSheetStructure();
    if (!settingsResult.success) {
      return settingsResult;
    }

    // Validate error log tab so future failures can be audited.
    var errorLogResult = DatabaseService.ensureErrorLogsSheetStructure();
    if (!errorLogResult.success) {
      return errorLogResult;
    }

    // Validate that required setting values are present (can be Script Properties fallback).
    var configResult = ConfigService.validateRequiredSettings();

    // Return a consistent major-function payload for Stage 1 checks.
    return {
      success: true,
      message: 'Stage 1 validation completed successfully.',
      data: {
        requiredSheets: ['Settings', 'Error Logs'],
        settingsValidation: configResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage1Validation', error, {
      note: 'Unhandled failure while validating Stage 1 prerequisites.'
    });

    return {
      success: false,
      message: 'Stage 1 validation failed. Check Error Logs sheet for details.'
    };
  }
}

/**
 * FUNCTION: runStage1SmokeTest
 * PURPOSE: Execute a lightweight test routine to verify foundational helper behavior.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May append one test error row to Error Logs if logging path is exercised.
 */
function runStage1SmokeTest() {
  // ===== MAIN LOGIC =====
  try {
    // Step 1: ensure foundational sheets are present.
    var validation = runStage1Validation();
    if (!validation.success) {
      return validation;
    }

    // Step 2: verify LOG- prefix generation for auditing requirements.
    var testLogId = UtilsService.createPrefixedId_('LOG-');
    var hasLogPrefix = String(testLogId).indexOf('LOG-') === 0;

    if (!hasLogPrefix) {
      return {
        success: false,
        message: 'Smoke test failed: LOG- prefix was not generated correctly.',
        data: { generatedId: testLogId }
      };
    }

    return {
      success: true,
      message: 'Stage 1 smoke test passed.',
      data: {
        validation: validation,
        generatedLogId: testLogId
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage1SmokeTest', error);
    return { success: false, message: 'Stage 1 smoke test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage2LeadCaptureTest
 * PURPOSE: Verify Stage 2 lead capture path by validating sheets and creating one test lead.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Leads sheet and append one test lead row.
 */
function runStage2LeadCaptureTest() {
  // ===== MAIN LOGIC =====
  try {
    // Keep Stage 1 checks in place so Stage 2 tests run on a valid foundation.
    var stage1Result = runStage1Validation();
    if (!stage1Result.success) {
      return stage1Result;
    }

    var leadsSheetResult = DatabaseService.ensureLeadsSheetStructure();
    if (!leadsSheetResult.success) {
      return leadsSheetResult;
    }

    // Sample payload proves full validation + append path without external APIs.
    var leadResult = LeadService.createLead({
      fullName: 'Stage 2 Test Lead',
      email: 'stage2-test@example.com',
      company: 'MIDTS Test Company',
      projectType: 'CAD/CAM Overflow',
      source: 'Stage2Test',
      notes: 'Created by runStage2LeadCaptureTest.'
    });

    return {
      success: leadResult.success,
      message: leadResult.success ? 'Stage 2 lead capture test passed.' : 'Stage 2 lead capture test failed.',
      data: {
        stage1Validation: stage1Result,
        leadsSheetCheck: leadsSheetResult,
        leadCreation: leadResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage2LeadCaptureTest', error);
    return { success: false, message: 'Stage 2 lead capture test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage2NurtureQualificationTest
 * PURPOSE: Verify Step 2 completion flow that marks lead as qualified and stores lead score.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one lead row then updates it to Qualified for test coverage.
 */
function runStage2NurtureQualificationTest() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Stage 2 Qualification Test',
      email: 'qualification-test@example.com',
      company: 'MIDTS Qualification Co',
      projectType: 'Complex CAM',
      source: 'Stage2QualificationTest',
      notes: 'Created for qualification test flow.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var qualifyResult = LeadService.markStep2Completed(createResult.data.leadId, 85);

    return {
      success: qualifyResult.success,
      message: qualifyResult.success ? 'Stage 2 nurture qualification test passed.' : 'Stage 2 nurture qualification test failed.',
      data: {
        leadCreation: createResult,
        qualification: qualifyResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage2NurtureQualificationTest', error);
    return { success: false, message: 'Stage 2 nurture qualification test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runReminderAuditProofTest
 * PURPOSE: Create a lead and return a reminder audit snapshot to prove whether blank reminder fields are expected.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one lead row for test purposes.
 */
function runReminderAuditProofTest() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Reminder Audit Test',
      email: 'reminder-audit@example.com',
      company: 'MIDTS Reminder Audit',
      projectType: 'CAD',
      source: 'ReminderAuditTest',
      notes: 'Used to verify blank reminder expectations.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var auditResult = LeadService.getReminderAuditSnapshot(createResult.data.leadId);

    return {
      success: auditResult.success,
      message: auditResult.success ? 'Reminder audit proof test completed.' : 'Reminder audit proof test failed.',
      data: {
        leadCreation: createResult,
        audit: auditResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runReminderAuditProofTest', error);
    return { success: false, message: 'Reminder audit proof test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runReminderStatusUpdateTest
 * PURPOSE: Create a lead and persist operational reminder status for quick dashboard-style checks.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one lead row and updates its reminder status columns.
 */
function runReminderStatusUpdateTest() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Reminder Status Test',
      email: 'reminder-status@example.com',
      company: 'MIDTS Reminder Status',
      projectType: 'CAD',
      source: 'ReminderStatusTest',
      notes: 'Used to persist reminder status values.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var statusResult = LeadService.refreshReminderStatus(createResult.data.leadId);

    return {
      success: statusResult.success,
      message: statusResult.success ? 'Reminder status update test completed.' : 'Reminder status update test failed.',
      data: {
        leadCreation: createResult,
        reminderStatus: statusResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runReminderStatusUpdateTest', error);
    return { success: false, message: 'Reminder status update test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: testStage2NurtureDefaults
 * PURPOSE: Create a lead and verify Stage 2 nurture default fields are populated exactly as required.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one test lead row to Leads sheet.
 */
function testStage2NurtureDefaults() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Nurture Defaults Test',
      email: 'nurture-defaults@example.com',
      company: 'MIDTS Defaults Co',
      projectType: 'CAD/CAM',
      source: 'NurtureDefaultsTest',
      notes: 'Verifies default nurture field values.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
    var values = sheet.getDataRange().getValues();
    var found = null;

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === String(createResult.data.leadId).trim()) {
        found = values[i];
        break;
      }
    }

    if (!found) {
      return { success: false, message: 'Test lead row not found after creation.' };
    }

    // Blank timestamp fields explicitly indicate "not completed/not sent yet".
    var assertions = {
      step1CompletedAtIsDate: found[9] instanceof Date,
      step2CompletedAtBlank: String(found[10] || '') === '',
      qualificationStatusPending: String(found[11] || '') === 'Pending',
      leadScoreZero: Number(found[12] || 0) === 0,
      highValueFlagNo: String(found[13] || '') === 'No',
      reminder2hBlank: String(found[14] || '') === '',
      reminder24hBlank: String(found[15] || '') === '',
      reminder72hBlank: String(found[16] || '') === '',
      lastReminderStageNone: String(found[17] || '') === 'None',
      nurtureStateAwaitingStep2: String(found[18] || '') === 'Awaiting Step 2',
      reminderStatusPending: String(found[19] || '') === 'Pending'
    };

    var failedKeys = [];
    Object.keys(assertions).forEach(function (key) {
      if (!assertions[key]) {
        failedKeys.push(key);
      }
    });

    if (failedKeys.length > 0) {
      return {
        success: false,
        message: 'Stage 2 nurture defaults test failed.',
        data: { leadId: createResult.data.leadId, failedChecks: failedKeys, assertions: assertions }
      };
    }

    return {
      success: true,
      message: 'Stage 2 nurture defaults test passed.',
      data: { leadId: createResult.data.leadId, assertions: assertions }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('testStage2NurtureDefaults', error);
    return { success: false, message: 'Stage 2 nurture defaults test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage2ReminderProcessingTest
 * PURPOSE: Verify Stage 2.2 reminder processing updates timestamp/state fields without sending emails.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one lead row and mutates created timestamp to force 2h due path for testing.
 */
function runStage2ReminderProcessingTest() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Reminder Processing Test',
      email: 'reminder-processing@example.com',
      company: 'MIDTS Reminder Processor',
      projectType: 'CAD/CAM',
      source: 'ReminderProcessingTest',
      notes: 'For Stage 2.2 reminder processing validation.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === String(createResult.data.leadId).trim()) {
        // Backdate Created At by 3 hours to force 2h threshold due in this isolated test.
        var backdated = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
        sheet.getRange(i + 1, 2).setValue(backdated);
        break;
      }
    }

    var processResult = LeadService.processReminderDueLeads();
    var auditResult = LeadService.getReminderAuditSnapshot(createResult.data.leadId);

    return {
      success: processResult.success && auditResult.success,
      message: (processResult.success && auditResult.success) ? 'Stage 2 reminder processing test passed.' : 'Stage 2 reminder processing test failed.',
      data: {
        leadCreation: createResult,
        processing: processResult,
        audit: auditResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage2ReminderProcessingTest', error);
    return { success: false, message: 'Stage 2 reminder processing test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runQuoteGatingTest
 * PURPOSE: Verify quote gating blocks unqualified leads and allows qualified leads.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test leads and updates one lead to Qualified.
 */
function runQuoteGatingTest() {
  // ===== MAIN LOGIC =====
  try {
    var unqualifiedLead = LeadService.createLead({
      fullName: 'Quote Gate Pending',
      email: 'quote-gate-pending@example.com',
      company: 'MIDTS Quote Pending',
      projectType: 'CAD',
      source: 'QuoteGatingTest',
      notes: 'Should be blocked before qualification.'
    });
    if (!unqualifiedLead.success) {
      return unqualifiedLead;
    }

    var pendingGate = LeadService.canLeadProceedToQuote(unqualifiedLead.data.leadId);

    var qualifiedLead = LeadService.createLead({
      fullName: 'Quote Gate Qualified',
      email: 'quote-gate-qualified@example.com',
      company: 'MIDTS Quote Qualified',
      projectType: 'CAM',
      source: 'QuoteGatingTest',
      notes: 'Should be allowed after qualification.'
    });
    if (!qualifiedLead.success) {
      return qualifiedLead;
    }

    var qualify = LeadService.markStep2Completed(qualifiedLead.data.leadId, 90);
    if (!qualify.success) {
      return qualify;
    }

    var qualifiedGate = LeadService.canLeadProceedToQuote(qualifiedLead.data.leadId);

    var pass = pendingGate.success && pendingGate.data.canProceed === false && qualifiedGate.success && qualifiedGate.data.canProceed === true;

    return {
      success: pass,
      message: pass ? 'Quote gating test passed.' : 'Quote gating test failed.',
      data: {
        unqualifiedLead: unqualifiedLead,
        pendingGate: pendingGate,
        qualifiedLead: qualifiedLead,
        qualificationUpdate: qualify,
        qualifiedGate: qualifiedGate
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runQuoteGatingTest', error);
    return { success: false, message: 'Quote gating test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage3QuoteCreationTest
 * PURPOSE: Verify Stage 3 quote creation is blocked for unqualified leads and allowed for qualified leads.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends leads and one quote test row.
 */
function runStage3QuoteCreationTest() {
  // ===== MAIN LOGIC =====
  try {
    var pendingLead = LeadService.createLead({
      fullName: 'Stage3 Quote Pending',
      email: 'stage3-quote-pending@example.com',
      company: 'MIDTS Stage3 Pending',
      projectType: 'CAD',
      source: 'Stage3QuoteTest',
      notes: 'Should fail quote gate while pending.'
    });
    if (!pendingLead.success) {
      return pendingLead;
    }

    var blockedQuote = QuoteService.createQuoteForLead({
      leadId: pendingLead.data.leadId,
      amount: 500,
      currency: 'GBP',
      validUntil: '',
      notes: 'Blocked quote test.'
    });

    var qualifiedLead = LeadService.createLead({
      fullName: 'Stage3 Quote Qualified',
      email: 'stage3-quote-qualified@example.com',
      company: 'MIDTS Stage3 Qualified',
      projectType: 'CAM',
      source: 'Stage3QuoteTest',
      notes: 'Should pass quote gate when qualified.'
    });
    if (!qualifiedLead.success) {
      return qualifiedLead;
    }

    var qualify = LeadService.markStep2Completed(qualifiedLead.data.leadId, 88);
    if (!qualify.success) {
      return qualify;
    }

    var allowedQuote = QuoteService.createQuoteForLead({
      leadId: qualifiedLead.data.leadId,
      amount: 1200,
      currency: 'GBP',
      validUntil: '',
      notes: 'Allowed quote test.'
    });

    var pass = blockedQuote.success === false && allowedQuote.success === true;
    return {
      success: pass,
      message: pass ? 'Stage 3 quote creation test passed.' : 'Stage 3 quote creation test failed.',
      data: {
        pendingLead: pendingLead,
        blockedQuote: blockedQuote,
        qualifiedLead: qualifiedLead,
        qualificationUpdate: qualify,
        allowedQuote: allowedQuote
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage3QuoteCreationTest', error);
    return { success: false, message: 'Stage 3 quote creation test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage3QuoteSetupValidation
 * PURPOSE: Verify Stage 3 setup by creating/validating Quotes sheet structure without creating quote rows.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Quotes sheet and append missing headers only.
 */
function runStage3QuoteSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var result = DatabaseService.ensureQuotesSheetStructure();
    return {
      success: result.success,
      message: result.success ? 'Stage 3 quote setup validation completed.' : 'Stage 3 quote setup validation failed.',
      data: { quotesSheetValidation: result }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage3QuoteSetupValidation', error);
    return { success: false, message: 'Stage 3 quote setup validation failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage3QuoteStatusWorkflowTest
 * PURPOSE: Verify quote status transitions Draft -> Sent -> Accepted and block invalid transitions.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one quote and updates status values in Quotes sheet.
 */
function runStage3QuoteStatusWorkflowTest() {
  // ===== MAIN LOGIC =====
  try {
    var lead = LeadService.createLead({
      fullName: 'Stage3 Quote Status Lead',
      email: 'stage3-quote-status@example.com',
      company: 'MIDTS Quote Status',
      projectType: 'CAD',
      source: 'Stage3QuoteStatusTest',
      notes: 'For quote status workflow test.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 92);
    if (!qualify.success) {
      return qualify;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      amount: 1500,
      currency: 'GBP',
      validUntil: '',
      notes: 'Quote status workflow test.'
    });
    if (!quote.success) {
      return quote;
    }

    var draftToSent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    var sentToAccepted = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Accepted');
    var invalidAfterAccepted = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Rejected');

    var pass = draftToSent.success && sentToAccepted.success && invalidAfterAccepted.success === false;

    return {
      success: pass,
      message: pass ? 'Stage 3 quote status workflow test passed.' : 'Stage 3 quote status workflow test failed.',
      data: {
        lead: lead,
        qualification: qualify,
        quote: quote,
        draftToSent: draftToSent,
        sentToAccepted: sentToAccepted,
        invalidAfterAccepted: invalidAfterAccepted
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage3QuoteStatusWorkflowTest', error);
    return { success: false, message: 'Stage 3 quote status workflow test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage4VendorEligibilityTest
 * PURPOSE: Verify vendor assignment requires qualified lead and eligible vendor security fields.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates vendor rows and updates assignment field for one eligible vendor.
 */
function runStage4VendorEligibilityTest() {
  // ===== MAIN LOGIC =====
  try {
    var lead = LeadService.createLead({
      fullName: 'Stage4 Vendor Lead',
      email: 'stage4-vendor@example.com',
      company: 'MIDTS Vendor Test',
      projectType: 'CAD',
      source: 'Stage4VendorTest',
      notes: 'Vendor eligibility test lead.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 86);
    if (!qualify.success) {
      return qualify;
    }

    var vendorSheetResult = DatabaseService.ensureVendorsSheetStructure();
    if (!vendorSheetResult.success) {
      return vendorSheetResult;
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(ConfigService.VENDORS_SHEET_NAME);

    sheet.appendRow(['VEND-INELIGIBLE', 'Ineligible Vendor', 'bad@example.com', 'No', 'No', 'Pending', '']);
    sheet.appendRow(['VEND-ELIGIBLE', 'Eligible Vendor', 'good@example.com', 'Yes', 'Yes', 'Approved', '']);

    var blocked = VendorService.assignVendorToLead(lead.data.leadId, 'VEND-INELIGIBLE');
    var allowed = VendorService.assignVendorToLead(lead.data.leadId, 'VEND-ELIGIBLE');

    var pass = blocked.success === false && allowed.success === true;

    return {
      success: pass,
      message: pass ? 'Stage 4 vendor eligibility test passed.' : 'Stage 4 vendor eligibility test failed.',
      data: {
        lead: lead,
        qualification: qualify,
        blockedAssignment: blocked,
        allowedAssignment: allowed
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4VendorEligibilityTest', error);
    return { success: false, message: 'Stage 4 vendor eligibility test failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage4ProjectCreationTest
 * PURPOSE: Verify project creation from qualified lead, eligible vendor, and accepted quote.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends lead/vendor/quote/project test rows.
 */
function runStage4ProjectCreationTest() {
  // ===== MAIN LOGIC =====
  try {
    var lead = LeadService.createLead({
      fullName: 'Stage4 Project Lead',
      email: 'stage4-project@example.com',
      company: 'MIDTS Project Test',
      projectType: 'CAM',
      source: 'Stage4ProjectTest',
      notes: 'Project creation test lead.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 95);
    if (!qualify.success) {
      return qualify;
    }

    DatabaseService.ensureVendorsSheetStructure();
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow(['VEND-PROJ-ELIGIBLE', 'Project Eligible Vendor', 'proj-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      amount: 2400,
      currency: 'GBP',
      validUntil: '',
      notes: 'Project creation quote.'
    });
    if (!quote.success) {
      return quote;
    }

    var sent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!sent.success) {
      return sent;
    }

    var project = ProjectService.createProjectFromQuote({
      leadId: lead.data.leadId,
      vendorId: 'VEND-PROJ-ELIGIBLE',
      quoteId: quote.data.quoteId,
      notes: 'Stage 4 project creation test.'
    });

    return {
      success: project.success,
      message: project.success ? 'Stage 4 project creation test passed.' : 'Stage 4 project creation test failed.',
      data: {
        lead: lead,
        qualification: qualify,
        quote: quote,
        quoteSent: sent,
        project: project
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4ProjectCreationTest', error);
    return { success: false, message: 'Stage 4 project creation test failed unexpectedly.' };
  }
}
