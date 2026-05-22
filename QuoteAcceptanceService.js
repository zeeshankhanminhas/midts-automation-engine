/**
 * MIDTS Automation Engine
 * STAGE: 3.6 (Customer quote acceptance webhook)
 * WHAT THIS FILE DOES:
 * - Accepts explicit customer quote acceptance submissions from the public website webhook.
 * - Requires the existing WEBSITE_WEBHOOK_TOKEN before mutating quote status.
 * - Records all quote acceptance attempts in a dedicated audit log sheet.
 * DEPENDENCIES:
 * - Google Sheets tab: Quotes
 * - Google Sheets tab: Quote Acceptance Logs
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - QuoteService (QuoteService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var QuoteAcceptanceService = {
  // ===== CONFIG =====
  QUOTE_ACCEPTANCE_LOGS_SHEET_NAME: 'Quote Acceptance Logs',
  QUOTE_ACCEPTANCE_LOG_HEADERS: [
    'Timestamp',
    'Stage',
    'Success',
    'Message',
    'Quote ID',
    'Lead ID',
    'Payload Keys',
    'Result JSON'
  ],

  /**
   * FUNCTION: isQuoteAcceptancePayload
   * PURPOSE: Detect whether a public website payload belongs to customer quote acceptance.
   * INPUT: payload (object)
   * OUTPUT: boolean
   * SIDE EFFECTS: none
   */
  isQuoteAcceptancePayload: function (payload) {
    // ===== MAIN LOGIC =====
    var input = payload || {};
    var stage = String(input.formStage || input.form_stage || input.stage || '').trim().toLowerCase();
    return stage === 'quoteacceptance' ||
      stage === 'quote_acceptance' ||
      stage === 'quote-acceptance' ||
      stage === 'acceptquote' ||
      stage === 'accept_quote' ||
      stage === 'quote';
  },

  /**
   * FUNCTION: handlePostEvent
   * PURPOSE: Receive a public quote acceptance webhook and record customer acceptance.
   * INPUT: e (Apps Script POST event object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May update one Quotes row from Sent to Accepted and appends one Quote Acceptance Logs row.
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
        this.logQuoteAcceptanceAttempt_('Parse payload', payloadResult, payload);
        return payloadResult;
      }

      var tokenResult = WebsiteWebhookService.validateWebhookToken_(payload);
      if (!tokenResult.success) {
        this.logQuoteAcceptanceAttempt_('Token validation', tokenResult, payload);
        return tokenResult;
      }

      var result = this.acceptQuoteFromPayload_(payload);
      this.logQuoteAcceptanceAttempt_('Quote acceptance', result, payload);
      return result;
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteAcceptanceService.handlePostEvent', error, { event: e });
      var failure = { success: false, message: 'Quote acceptance webhook failed unexpectedly.' };
      this.logQuoteAcceptanceAttempt_('Unexpected failure', failure, payload);
      return failure;
    }
  },

  /**
   * FUNCTION: acceptQuoteFromPayload_
   * PURPOSE: Normalize public payload aliases before recording quote acceptance.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May update one Quotes row from Sent to Accepted.
   */
  acceptQuoteFromPayload_: function (payload) {
    // ===== MAIN LOGIC =====
    var input = payload || {};
    var quoteId = WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(input, [
      'quoteId',
      'quote_id',
      'quoteReference',
      'quote_reference',
      'quote'
    ]));
    var acceptanceNotes = WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(input, [
      'acceptanceNotes',
      'acceptance_notes',
      'notes',
      'message'
    ]));

    if (!quoteId) {
      return { success: false, message: 'quoteId is required for quote acceptance.' };
    }

    return QuoteService.acceptCustomerQuote(
      quoteId,
      acceptanceNotes || 'Accepted from quote acceptance webhook.'
    );
  },

  /**
   * FUNCTION: ensureQuoteAcceptanceLogSheet_
   * PURPOSE: Ensure customer quote acceptance webhook attempts are auditable.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Quote Acceptance Logs sheet if missing.
   */
  ensureQuoteAcceptanceLogSheet_: function () {
    // ===== MAIN LOGIC =====
    try {
      return DatabaseService.ensureSheetAndHeaders_(this.QUOTE_ACCEPTANCE_LOGS_SHEET_NAME, this.QUOTE_ACCEPTANCE_LOG_HEADERS);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteAcceptanceService.ensureQuoteAcceptanceLogSheet_', error);
      return { success: false, message: 'Failed to verify Quote Acceptance Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: logQuoteAcceptanceAttempt_
   * PURPOSE: Record public quote acceptance webhook audit details.
   * INPUT: stage (string), result (object), payload (object)
   * OUTPUT: none
   * SIDE EFFECTS: Appends one Quote Acceptance Logs row when possible.
   */
  logQuoteAcceptanceAttempt_: function (stage, result, payload) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureQuoteAcceptanceLogSheet_();
      var input = WebsiteWebhookService.redactSensitivePayload_(payload || {});
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.QUOTE_ACCEPTANCE_LOGS_SHEET_NAME);
      if (!sheet) {
        return;
      }

      sheet.appendRow([
        new Date(),
        stage || '',
        result && result.success ? 'TRUE' : 'FALSE',
        result && result.message ? result.message : '',
        WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(input, ['quoteId', 'quote_id', 'quoteReference', 'quote_reference', 'quote'])),
        result && result.data && result.data.leadId ? result.data.leadId : '',
        Object.keys(input).sort().join(', '),
        JSON.stringify(result || {})
      ]);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteAcceptanceService.logQuoteAcceptanceAttempt_', error, { stage: stage, result: result });
    }
  }
};

/**
 * FUNCTION: runStage35QuoteAcceptanceWebhookPayloadTest
 * PURPOSE: Verify quote acceptance can be routed through doPost-style webhook payloads without frontend changes.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates test lead/vendor/pricing/quote rows, marks one quote Sent, accepts it, and appends one Quote Acceptance Logs row.
 */
function runStage35QuoteAcceptanceWebhookPayloadTest() {
  // ===== MAIN LOGIC =====
  try {
    var testTag = '[TEST][Stage3.6][QuoteAcceptanceWebhook]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    var settings = ConfigService.validateRequiredSettings();
    if (!settings.success) {
      return settings;
    }

    var vendorsSetup = DatabaseService.ensureVendorsSheetStructure();
    if (!vendorsSetup.success) {
      return vendorsSetup;
    }

    var pricingSetup = VendorPricingService.ensureVendorPricingSheetStructure();
    if (!pricingSetup.success) {
      return pricingSetup;
    }

    var quoteSetup = DatabaseService.ensureQuotesSheetStructure();
    if (!quoteSetup.success) {
      return quoteSetup;
    }

    var logSetup = QuoteAcceptanceService.ensureQuoteAcceptanceLogSheet_();
    if (!logSetup.success) {
      return logSetup;
    }

    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    if (!tokenResult.success) {
      return tokenResult;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Lead ' + runStamp,
      email: 'stage36-quote-acceptance-' + runStamp + '@example.com',
      company: testTag + ' Customer',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage36QuoteAcceptanceWebhook_' + runStamp,
      notes: testTag + ' Created to prove quote acceptance webhook routing. Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 95);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE36-ACCEPT-');
    var vendorEmail = 'test-stage36-vendor-' + runStamp + '@example.com';
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Eligible Vendor', vendorEmail, 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var assignment = VendorService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var dispatch = VendorPricingService.createVendorPricingDispatchRecord({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorName: testTag + ' Eligible Vendor',
      vendorEmail: vendorEmail,
      currency: 'GBP',
      eta: '',
      notes: testTag + ' Dispatch record for quote acceptance webhook test. Safe to delete.'
    });
    if (!dispatch.success) {
      return dispatch;
    }

    var vendorPricing = VendorPricingService.submitVendorPricing({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      currency: 'GBP',
      eta: '5 working days',
      vendorNotes: testTag + ' Controlled quote acceptance vendor pricing. Safe to delete.'
    });
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var pricingApproval = VendorPricingService.approveVendorPricingForQuote(
      vendorPricing.data.vendorPricingId,
      testTag + ' Approved for controlled quote acceptance webhook test.',
      { marginType: 'PERCENT', marginValue: 50 }
    );
    if (!pricingApproval.success) {
      return pricingApproval;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      currency: 'GBP',
      validUntil: '',
      notes: testTag + ' Quote created for quote acceptance webhook test. Safe to delete.'
    });
    if (!quote.success) {
      return quote;
    }

    var sent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!sent.success) {
      return sent;
    }

    var fakeEvent = {
      parameter: {},
      postData: {
        type: 'application/json',
        contents: JSON.stringify({
          formStage: 'quoteAcceptance',
          webhookToken: tokenResult.data.value,
          quoteId: quote.data.quoteId,
          acceptanceNotes: testTag + ' Accepted through controlled webhook runner.',
          source: 'Stage36QuoteAcceptanceWebhookTest',
          pageUrl: 'stage36-quote-acceptance-test'
        })
      }
    };

    var routeResult = routeWebsiteWebhookPost_(fakeEvent);
    var finalQuote = QuoteService.getQuoteSnapshot(quote.data.quoteId);
    var pass = routeResult.route === 'quoteAcceptance' &&
      routeResult.result && routeResult.result.success === true &&
      finalQuote.success === true &&
      finalQuote.data.quoteStatus === 'Accepted';

    return {
      success: pass,
      message: pass ? 'Stage 3.6 quote acceptance webhook payload test passed.' : 'Stage 3.6 quote acceptance webhook payload test failed.',
      data: {
        settings: settings,
        vendorsSetup: vendorsSetup,
        pricingSetup: pricingSetup,
        quoteSetup: quoteSetup,
        logSetup: logSetup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        dispatch: dispatch,
        vendorPricing: vendorPricing,
        pricingApproval: pricingApproval,
        quote: quote,
        sent: sent,
        routeResult: routeResult,
        finalQuote: finalQuote
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage35QuoteAcceptanceWebhookPayloadTest', error);
    return { success: false, message: 'Stage 3.6 quote acceptance webhook payload test failed unexpectedly.' };
  }
}
