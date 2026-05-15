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
    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var blockedLead = LeadService.createLead({
      fullName: 'Stage 4.5 Blocked Pricing Lead',
      email: 'stage45-blocked@example.com',
      company: 'MIDTS Vendor Pricing Test',
      projectType: 'CAD/CAM',
      source: 'Stage45VendorPricingTest',
      notes: 'Created to prove unqualified leads cannot receive vendor pricing.'
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
      fullName: 'Stage 4.5 Vendor Pricing Lead',
      email: 'stage45-vendor-pricing@example.com',
      company: 'MIDTS Vendor Pricing Test',
      projectType: 'CAD/CAM',
      source: 'Stage45VendorPricingTest',
      notes: 'Created by runStage45VendorPricingWorkflowTest.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 88);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, 'Stage 4.5 Eligible Vendor', 'stage45-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var assignment = VendorService.assignVendorToLead(lead.data.leadId, vendorId);
    if (!assignment.success) {
      return assignment;
    }

    var vendorPricing = VendorPricingService.submitVendorPricing({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 950,
      currency: 'GBP',
      eta: '5 working days',
      vendorNotes: 'Stage 4.5 workflow vendor pricing.'
    });
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var pricingApproval = VendorPricingService.approveVendorPricingForQuote(vendorPricing.data.vendorPricingId, 'Approved for Stage 4.5 workflow test.');
    if (!pricingApproval.success) {
      return pricingApproval;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      amount: 1900,
      currency: 'GBP',
      validUntil: '',
      notes: 'Quote created after approved vendor pricing.'
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
    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var logSetup = VendorPricingService.ensureVendorPricingLogSheet_();
    if (!logSetup.success) {
      return logSetup;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage 4.5 Vendor Webhook Lead',
      email: 'stage45-vendor-webhook@example.com',
      company: 'MIDTS Vendor Pricing Webhook Test',
      projectType: 'CAD/CAM',
      source: 'Stage45VendorPricingWebhookTest',
      notes: 'Created by runStage45VendorPricingWebhookPayloadTest.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 90);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE45-WEB-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, 'Stage 4.5 Webhook Vendor', 'stage45-webhook-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

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
          vendorNotes: 'Stage 4.5 public vendor pricing webhook test.',
          source: 'Stage45VendorPricingWebhookPayloadTest',
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
