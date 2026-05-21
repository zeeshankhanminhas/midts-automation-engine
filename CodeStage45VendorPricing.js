/**
 * MIDTS Automation Engine
 * STAGE: 4.5 (Vendor pricing workflow runner functions)
 * WHAT THIS FILE DOES:
 * - Provides top-level Apps Script runner functions for vendor pricing verification.
 * - Proves the path from qualified lead to vendor assignment, pricing approval, and quote creation.
 * DEPENDENCIES:
 * - Google Sheets tabs: Leads, Vendors, Vendor Pricing, Quotes
 * - LeadService (LeadService.gs)
 * - VendorService (VendorService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - QuoteService (QuoteService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage45VendorPricingSetupValidation
 * PURPOSE: Verify vendor pricing workflow sheets exist without creating business records.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create/extend Leads, Vendors, Vendor Pricing, and Quotes headers only.
 */
function runStage45VendorPricingSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var leads = DatabaseService.ensureLeadsSheetStructure();
    if (!leads.success) {
      return leads;
    }

    var vendors = DatabaseService.ensureVendorsSheetStructure();
    if (!vendors.success) {
      return vendors;
    }

    var vendorPricing = VendorPricingService.ensureVendorPricingSheetStructure();
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var quotes = DatabaseService.ensureQuotesSheetStructure();
    if (!quotes.success) {
      return quotes;
    }

    return {
      success: true,
      message: 'Stage 4.5 vendor pricing setup validation completed.',
      data: { leads: leads, vendors: vendors, vendorPricing: vendorPricing, quotes: quotes }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorPricingSetupValidation', error);
    return { success: false, message: 'Stage 4.5 vendor pricing setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage45VendorPricingWorkflowTest
 * PURPOSE: Verify qualified lead -> eligible vendor assignment -> vendor pricing -> approval -> quote.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test lead, vendor, vendor pricing, and quote rows; updates assignment/pricing review fields.
 */
function runStage45VendorPricingWorkflowTest() {
  // ===== MAIN LOGIC =====
  try {
    // Explicit marker so all artifacts are easy to filter/delete from Sheets later.
    var testTag = '[TEST][Stage4.5][VendorPricingWorkflow]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var blockedLead = LeadService.createLead({
      fullName: testTag + ' Blocked Pricing Lead ' + runStamp,
      email: 'test-stage45-blocked-' + runStamp + '@example.com',
      company: testTag + ' MIDTS Vendor Pricing Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage45VendorPricingWorkflow_' + runStamp,
      notes: testTag + ' Created to prove unqualified leads cannot receive vendor pricing. Safe to delete.'
    });
    if (!blockedLead.success) {
      return blockedLead;
    }

    var blockedPricing = VendorPricingService.submitVendorPricing({
      leadId: blockedLead.data.leadId,
      vendorId: 'STAGE45-BLOCKED-VENDOR',
      vendorCost: 750,
      currency: 'GBP',
      eta: '5 working days',
      vendorNotes: 'This should be blocked because the lead is not qualified.'
    });

    var lead = LeadService.createLead({
      fullName: testTag + ' Vendor Pricing Lead ' + runStamp,
      email: 'test-stage45-vendor-pricing-' + runStamp + '@example.com',
      company: testTag + ' MIDTS Vendor Pricing Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage45VendorPricingWorkflow_' + runStamp,
      notes: testTag + ' Created by runStage45VendorPricingWorkflowTest. Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 88);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-TEST-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Eligible Vendor', 'test-stage45-vendor-' + runStamp + '@example.com', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var assignment = VendorService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var vendorPricing = VendorPricingService.submitVendorPricing({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 950,
      currency: 'GBP',
      eta: '5 working days',
      vendorNotes: testTag + ' Stage 4.5 workflow vendor pricing. Safe to delete.'
    });
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var pricingApproval = VendorPricingService.approveVendorPricingForQuote(
      vendorPricing.data.vendorPricingId,
      'Approved for Stage 4.5 workflow test.',
      { marginType: 'PERCENT', marginValue: 100 }
    );
    if (!pricingApproval.success) {
      return pricingApproval;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      currency: 'GBP',
      validUntil: '',
      notes: testTag + ' Quote created after approved vendor pricing. Safe to delete.'
    });

    var pass = blockedPricing.success === false && quote.success;

    return {
      success: pass,
      message: pass ? 'Stage 4.5 vendor pricing workflow test passed.' : 'Stage 4.5 vendor pricing workflow test failed.',
      data: {
        setup: setup,
        blockedLead: blockedLead,
        blockedPricing: blockedPricing,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        vendorPricing: vendorPricing,
        pricingApproval: pricingApproval,
        quote: quote
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorPricingWorkflowTest', error);
    return { success: false, message: 'Stage 4.5 vendor pricing workflow test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage45VendorPricingWebhookPayloadTest
 * PURPOSE: Verify public vendor pricing webhook payload records pricing without creating a new lead.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one qualified test lead, vendor row, vendor pricing row, and vendor pricing log row.
 */
function runStage45VendorPricingWebhookPayloadTest() {
  // ===== MAIN LOGIC =====
  try {
    // Explicit marker so all webhook test artifacts are easy to filter/delete from Sheets later.
    var testTag = '[TEST][Stage4.5][VendorPricingWebhook]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var logSetup = VendorPricingService.ensureVendorPricingLogSheet_();
    if (!logSetup.success) {
      return logSetup;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Vendor Webhook Lead ' + runStamp,
      email: 'test-stage45-vendor-webhook-' + runStamp + '@example.com',
      company: testTag + ' MIDTS Vendor Pricing Webhook Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage45VendorPricingWebhook_' + runStamp,
      notes: testTag + ' Created by runStage45VendorPricingWebhookPayloadTest. Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 90);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-WEB-TEST-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Webhook Vendor', 'test-stage45-webhook-vendor-' + runStamp + '@example.com', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    var submittedToken = tokenResult.success ? tokenResult.data.value : '';
    var fakeEvent = {
      parameter: {},
      postData: {
        type: 'application/json',
        contents: JSON.stringify({
          formStage: 'vendorPricing',
          webhookToken: submittedToken,
          leadId: lead.data.leadId,
          vendorId: vendorId,
          vendorCost: '875',
          currency: 'GBP',
          eta: '4 working days',
          vendorNotes: testTag + ' Stage 4.5 public vendor pricing webhook test. Safe to delete.',
          source: 'TEST_Stage45VendorPricingWebhookPayload_' + runStamp,
          pageUrl: 'vendor-pricing-payload-test'
        })
      }
    };

    var result = VendorPricingService.handlePostEvent(fakeEvent);
    return {
      success: result.success,
      message: result.success ? 'Stage 4.5 vendor pricing webhook payload test passed.' : 'Stage 4.5 vendor pricing webhook payload test failed.',
      data: {
        setup: setup,
        logSetup: logSetup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        tokenSetup: tokenResult,
        vendorPricingResult: result
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorPricingWebhookPayloadTest', error);
    return { success: false, message: 'Stage 4.5 vendor pricing webhook payload test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage45VendorAssignmentEmailTest
 * PURPOSE: Verify assigning a vendor can send a sanitized pricing request email with a vendor pricing link.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one qualified test lead and vendor row; sends one Brevo email to TEST_EMAIL_RECIPIENT.
 */
function runStage45VendorAssignmentEmailTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var recipientResult = EmailService.getSettingValue_(EmailService.TEST_EMAIL_RECIPIENT_KEY);
    if (!recipientResult.success) {
      return recipientResult;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage 4.5 Vendor Email Lead',
      email: 'stage45-vendor-email@example.com',
      company: 'MIDTS Vendor Email Test',
      projectType: 'CAD/CAM',
      source: 'Stage45VendorAssignmentEmailTest',
      notes: 'Sanitized vendor email test details. Share company, project type, requirement summary, and pricing link only.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 91);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-EMAIL-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, 'Stage 4.5 Email Test Vendor', recipientResult.data.value, 'Yes', 'Yes', 'Approved', '']);

    var assignment = VendorService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: true });
    var emailResult = assignment.data ? assignment.data.emailNotification : null;

    return {
      success: assignment.success && emailResult && emailResult.success,
      message: assignment.success && emailResult && emailResult.success
        ? 'Stage 4.5 vendor assignment email test passed.'
        : 'Stage 4.5 vendor assignment email test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorAssignmentEmailTest', error);
    return { success: false, message: 'Stage 4.5 vendor assignment email test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage45VendorPricingDispatchReliabilityTest
 * PURPOSE: Verify dispatch logging, duplicate prevention, and failed dispatch handling for vendor pricing requests.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test lead/vendor rows and vendor pricing/log records for dispatch reliability validation.
 */
function runStage45VendorPricingDispatchReliabilityTest() {
  // ===== MAIN LOGIC =====
  try {
    var testTag = '[TEST][Stage4.5][DispatchReliability]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var logSetup = VendorPricingService.ensureVendorPricingLogSheet_();
    if (!logSetup.success) {
      return logSetup;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Lead ' + runStamp,
      email: 'test-stage45-dispatch-' + runStamp + '@example.com',
      company: testTag + ' MIDTS Dispatch Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage45DispatchReliability_' + runStamp,
      notes: testTag + ' Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }
    var qualify = LeadService.markStep2Completed(lead.data.leadId, 92);
    if (!qualify.success) {
      return qualify;
    }

    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    var goodVendorId = UtilsService.createPrefixedId_('VEND-STAGE45-DISP-TEST-');
    vendorSheet.appendRow([goodVendorId, testTag + ' Eligible Vendor', 'test-stage45-dispatch-vendor-' + runStamp + '@example.com', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var firstDispatch = VendorService.assignVendorToLead(lead.data.leadId, goodVendorId, { sendEmail: true });
    var duplicateDispatch = VendorService.assignVendorToLead(lead.data.leadId, goodVendorId, { sendEmail: true });

    var badVendorId = UtilsService.createPrefixedId_('VEND-STAGE45-DISP-NOMAIL-TEST-');
    vendorSheet.appendRow([badVendorId, testTag + ' Missing Email Vendor', '', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);
    var failedDispatch = VendorService.assignVendorToLead(lead.data.leadId, badVendorId, { sendEmail: true });

    return {
      success: firstDispatch.success && !duplicateDispatch.success && !failedDispatch.success,
      message: 'Stage 4.5 vendor pricing dispatch reliability test completed.',
      data: {
        setup: setup,
        logSetup: logSetup,
        lead: lead,
        qualification: qualify,
        firstDispatch: firstDispatch,
        duplicateDispatch: duplicateDispatch,
        failedDispatch: failedDispatch
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorPricingDispatchReliabilityTest', error);
    return { success: false, message: 'Stage 4.5 vendor pricing dispatch reliability test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage45VendorPricingResponseIntakeHardeningTest
 * PURPOSE: Verify valid response acceptance plus invalid token, duplicate, and invalid price rejection/logging.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test artifacts and Vendor Pricing/Vendor Pricing Logs rows.
 */
function runStage45VendorPricingResponseIntakeHardeningTest() {
  // ===== MAIN LOGIC =====
  try {
    var testTag = '[TEST][Stage4.5][ResponseHardening]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Lead ' + runStamp,
      email: 'test-stage45-response-' + runStamp + '@example.com',
      company: testTag + ' MIDTS Response Intake Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage45ResponseHardening_' + runStamp,
      notes: testTag + ' Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }
    var qualify = LeadService.markStep2Completed(lead.data.leadId, 93);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-RESP-TEST-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Vendor', 'test-stage45-response-vendor-' + runStamp + '@example.com', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var dispatch = VendorService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!dispatch.success) {
      return dispatch;
    }

    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    var validToken = tokenResult.success ? tokenResult.data.value : '';
    var validEvent = {
      parameter: {},
      postData: { type: 'application/json', contents: JSON.stringify({
        formStage: 'vendorPricing', webhookToken: validToken, leadId: lead.data.leadId, vendorId: vendorId,
        vendorCost: '1200', currency: 'GBP', eta: '6 working days', vendorNotes: testTag + ' valid response'
      })}
    };
    var validSubmit = VendorPricingService.handlePostEvent(validEvent);

    var duplicateSubmit = VendorPricingService.handlePostEvent(validEvent);

    var invalidTokenEvent = {
      parameter: {},
      postData: { type: 'application/json', contents: JSON.stringify({
        formStage: 'vendorPricing', webhookToken: 'INVALID_TOKEN', leadId: lead.data.leadId, vendorId: vendorId,
        vendorCost: '999', currency: 'GBP', eta: '5 working days', vendorNotes: testTag + ' invalid token response'
      })}
    };
    var invalidTokenSubmit = VendorPricingService.handlePostEvent(invalidTokenEvent);

    var badPriceEvent = {
      parameter: {},
      postData: { type: 'application/json', contents: JSON.stringify({
        formStage: 'vendorPricing', webhookToken: validToken, leadId: lead.data.leadId, vendorId: vendorId,
        vendorCost: 'NOT_A_NUMBER', currency: 'GBP', eta: '5 working days', vendorNotes: testTag + ' bad price response'
      })}
    };
    var badPriceSubmit = VendorPricingService.handlePostEvent(badPriceEvent);

    return {
      success: validSubmit.success && !duplicateSubmit.success && !invalidTokenSubmit.success && !badPriceSubmit.success,
      message: 'Stage 4.5 vendor pricing response intake hardening test completed.',
      data: { setup: setup, lead: lead, qualification: qualify, vendorId: vendorId, dispatch: dispatch, validSubmit: validSubmit, duplicateSubmit: duplicateSubmit, invalidTokenSubmit: invalidTokenSubmit, badPriceSubmit: badPriceSubmit }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage45VendorPricingResponseIntakeHardeningTest', error);
    return { success: false, message: 'Stage 4.5 vendor pricing response intake hardening test failed unexpectedly.' };
  }
}
