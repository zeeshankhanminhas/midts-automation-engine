/**
 * MIDTS Automation Engine
 * STAGE: 3.5 (Controlled customer quote delivery and acceptance)
 * WHAT THIS FILE DOES:
 * - Sends a controlled customer quote email through the existing Brevo transactional path.
 * - Provides a manual runner proving quote delivery, customer acceptance, and project gate behavior.
 * DEPENDENCIES:
 * - QuoteService (QuoteService.js)
 * - ProjectService (ProjectService.js)
 * - VendorPricingService (VendorPricingService.js)
 * - LeadService (LeadService.js)
 * - EmailService (EmailService.js)
 * - DatabaseService (DatabaseService.js)
 * - UtilsService (Utils.js)
 * - ErrorLogger (ErrorLogger.js)
 */

/**
 * FUNCTION: getQuoteAcceptanceFormBaseUrl_
 * PURPOSE: Load the optional frontend quote acceptance base URL from Settings or Script Properties.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May ensure Settings sheet exists before reading.
 */
function getQuoteAcceptanceFormBaseUrl_() {
  // ===== MAIN LOGIC =====
  try {
    var key = ConfigService.QUOTE_ACCEPTANCE_FORM_BASE_URL_KEY;
    var settingsResult = DatabaseService.getSettingsMap();
    if (!settingsResult.success) {
      return settingsResult;
    }

    var fromSheet = String(settingsResult.data.settingsMap[key] || '').trim();
    var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
    var value = fromSheet || fromScript;

    return {
      success: true,
      message: value ? 'Quote acceptance form URL configured.' : 'Quote acceptance form URL is not configured; email will use reply instructions.',
      data: { key: key, value: value, configured: Boolean(value) }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('getQuoteAcceptanceFormBaseUrl_', error);
    return { success: false, message: 'Failed to load quote acceptance form URL.' };
  }
}

/**
 * FUNCTION: buildQuoteAcceptanceUrl_
 * PURPOSE: Build a customer-facing quote acceptance URL when the optional frontend URL is configured.
 * INPUT: quoteId (string), leadId (string)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function buildQuoteAcceptanceUrl_(quoteId, leadId) {
  // ===== MAIN LOGIC =====
  try {
    var qid = String(quoteId || '').trim();
    var lid = String(leadId || '').trim();
    if (!qid) {
      return { success: false, message: 'quoteId is required.' };
    }

    var baseResult = getQuoteAcceptanceFormBaseUrl_();
    if (!baseResult.success) {
      return baseResult;
    }
    if (!baseResult.data.configured) {
      return { success: true, message: baseResult.message, data: { configured: false, url: '', key: baseResult.data.key } };
    }

    var baseUrl = String(baseResult.data.value || '').trim();
    var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    var url = baseUrl + separator + 'quoteId=' + encodeURIComponent(qid);
    if (lid) {
      url += '&leadId=' + encodeURIComponent(lid);
    }

    return { success: true, message: 'Quote acceptance URL built.', data: { configured: true, url: url, key: baseResult.data.key } };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('buildQuoteAcceptanceUrl_', error, { quoteId: quoteId, leadId: leadId });
    return { success: false, message: 'Failed to build quote acceptance URL.' };
  }
}

/**
 * FUNCTION: sendCustomerQuoteEmail_
 * PURPOSE: Send an existing quote to a customer with quote amount, project reference, and acceptance instructions.
 * INPUT: request (object: quote, lead, toEmail, toName)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Sends one Brevo email and appends one Email Logs row through EmailService.
 */
function sendCustomerQuoteEmail_(request) {
  // ===== MAIN LOGIC =====
  try {
    var payload = request || {};
    var quote = payload.quote || {};
    var lead = payload.lead || {};
    var toEmail = String(payload.toEmail || '').trim();
    var toName = String(payload.toName || lead.fullName || 'there').trim();
    var quoteId = String(quote.quoteId || '').trim();
    var leadId = String(quote.leadId || lead.leadId || '').trim();
    var amount = Number(quote.amount || 0);
    var currency = String(quote.currency || 'GBP').trim();
    var projectType = String(lead.projectType || 'MIDTS project').trim();
    var company = String(lead.company || '').trim();
    var validUntil = quote.validUntil instanceof Date
      ? Utilities.formatDate(quote.validUntil, Session.getScriptTimeZone(), 'dd MMM yyyy')
      : String(quote.validUntil || '').trim();

    if (!toEmail || toEmail.indexOf('@') === -1) {
      return { success: false, message: 'A valid customer email is required.' };
    }
    if (!quoteId || !leadId) {
      return { success: false, message: 'quoteId and leadId are required to send a customer quote email.' };
    }
    if (amount <= 0) {
      return { success: false, message: 'Quote amount must be greater than zero.' };
    }

    var acceptanceUrlResult = buildQuoteAcceptanceUrl_(quoteId, leadId);
    if (!acceptanceUrlResult.success) {
      return acceptanceUrlResult;
    }
    var acceptanceUrl = acceptanceUrlResult.data && acceptanceUrlResult.data.configured ? acceptanceUrlResult.data.url : '';

    var formattedAmount = currency + ' ' + amount.toFixed(2);
    var safeName = EmailService.escapeHtml_(toName);
    var safeQuoteId = EmailService.escapeHtml_(quoteId);
    var safeLeadId = EmailService.escapeHtml_(leadId);
    var safeProjectType = EmailService.escapeHtml_(projectType);
    var safeCompany = EmailService.escapeHtml_(company || 'Not specified');
    var safeAmount = EmailService.escapeHtml_(formattedAmount);
    var safeValidUntil = EmailService.escapeHtml_(validUntil || 'To be confirmed');
    var safeAcceptanceUrl = EmailService.escapeHtml_(acceptanceUrl);
    var render = ProductionTemplateService.renderEmailTemplate('CLIENT_QUOTE_ISSUED', {
      client_name: safeName,
      quote_id: safeQuoteId,
      lead_id: safeLeadId,
      company_name: safeCompany,
      project_type: safeProjectType,
      client_quote_amount: safeAmount,
      quote_valid_until: safeValidUntil,
      quote_acceptance_url: safeAcceptanceUrl || 'Reply to this email confirming the quote reference.'
    });
    if (!render.success) {
      return render;
    }

    var emailResult = EmailService.sendTransactionalEmail({
      toEmail: toEmail,
      toName: toName,
      subject: render.data.subject,
      htmlContent: render.data.htmlContent,
      textContent: render.data.textContent,
      templateKey: 'CLIENT_QUOTE_ISSUED'
    });
    if (emailResult && emailResult.data) {
      emailResult.data.quoteAcceptanceLinkConfigured = Boolean(acceptanceUrl);
    }
    return emailResult;
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('sendCustomerQuoteEmail_', error, { request: request });
    return { success: false, message: 'Failed to send customer quote email.' };
  }
}

/**
 * FUNCTION: runStage35QuoteAcceptanceLinkBuilderTest
 * PURPOSE: Verify quote emails can build an optional frontend acceptance link without sending email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May ensure Settings sheet exists before reading optional URL.
 */
function runStage35QuoteAcceptanceLinkBuilderTest() {
  // ===== MAIN LOGIC =====
  try {
    var quoteId = 'QUOTE-LINK-TEST-001';
    var leadId = 'MIDTS-LINK-TEST-001';
    var result = buildQuoteAcceptanceUrl_(quoteId, leadId);
    if (!result.success) {
      return result;
    }

    var hasExpectedParameters = !result.data.configured || (
      result.data.url.indexOf('quoteId=' + encodeURIComponent(quoteId)) !== -1 &&
      result.data.url.indexOf('leadId=' + encodeURIComponent(leadId)) !== -1
    );

    return {
      success: hasExpectedParameters,
      message: hasExpectedParameters
        ? 'Quote acceptance link builder test passed.'
        : 'Quote acceptance link builder test failed.',
      data: result.data
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage35QuoteAcceptanceLinkBuilderTest', error);
    return { success: false, message: 'Quote acceptance link builder test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage3QuoteDeliveryAcceptanceTest
 * PURPOSE: Prove customer quote delivery, explicit acceptance, and project gate behavior without frontend changes.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates test lead/vendor/pricing/quote/project rows and sends one quote email to TEST_EMAIL_RECIPIENT.
 */
function runStage3QuoteDeliveryAcceptanceTest() {
  // ===== MAIN LOGIC =====
  try {
    var testTag = '[TEST][Stage3.5][QuoteDeliveryAcceptance]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    var setup = runStage45VendorPricingSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var recipientResult = EmailService.getSettingValue_(EmailService.TEST_EMAIL_RECIPIENT_KEY);
    if (!recipientResult.success) {
      return recipientResult;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Customer Quote Lead ' + runStamp,
      email: recipientResult.data.value,
      company: testTag + ' MIDTS Quote Customer',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage35QuoteDeliveryAcceptance_' + runStamp,
      notes: testTag + ' Created to prove quote delivery and acceptance. Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 94);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE35-QUOTE-');
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Eligible Vendor', 'test-stage35-vendor-' + runStamp + '@example.com', 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var assignment = VendorService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var dispatch = VendorPricingService.createVendorPricingDispatchRecord({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorName: testTag + ' Eligible Vendor',
      vendorEmail: 'test-stage35-vendor-' + runStamp + '@example.com',
      currency: 'GBP',
      eta: '',
      notes: testTag + ' Dispatch record for controlled quote delivery test. Safe to delete.'
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
      vendorNotes: testTag + ' Controlled quote delivery vendor pricing. Safe to delete.'
    });
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var pricingApproval = VendorPricingService.approveVendorPricingForQuote(
      vendorPricing.data.vendorPricingId,
      testTag + ' Approved for controlled quote delivery test.',
      { marginType: 'PERCENT', marginValue: 50 }
    );
    if (!pricingApproval.success) {
      return pricingApproval;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      currency: 'GBP',
      validUntil: '',
      notes: testTag + ' Quote created for delivery and acceptance test. Safe to delete.'
    });
    if (!quote.success) {
      return quote;
    }

    var blockedProject = ProjectService.createProjectFromQuote({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      quoteId: quote.data.quoteId,
      notes: testTag + ' Project should be blocked before quote acceptance.'
    });

    var delivery = QuoteService.sendQuoteToCustomer(quote.data.quoteId, {
      recipientOverrideEmail: recipientResult.data.value,
      recipientOverrideName: 'MIDTS Quote Test Recipient'
    });
    if (!delivery.success) {
      return delivery;
    }

    var acceptance = QuoteService.acceptCustomerQuote(quote.data.quoteId, testTag + ' Manual customer acceptance recorded by runner.');
    if (!acceptance.success) {
      return acceptance;
    }

    var project = ProjectService.createProjectFromQuote({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      quoteId: quote.data.quoteId,
      notes: testTag + ' Project created after quote acceptance. Safe to delete.'
    });

    var finalQuote = QuoteService.getQuoteSnapshot(quote.data.quoteId);
    var pass = blockedProject.success === false &&
      delivery.success === true &&
      acceptance.success === true &&
      project.success === true &&
      finalQuote.success === true &&
      finalQuote.data.quoteStatus === 'Accepted';

    return {
      success: pass,
      message: pass ? 'Stage 3 quote delivery and acceptance test passed.' : 'Stage 3 quote delivery and acceptance test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        dispatch: dispatch,
        vendorPricing: vendorPricing,
        pricingApproval: pricingApproval,
        quote: quote,
        blockedProjectBeforeAcceptance: blockedProject,
        delivery: delivery,
        acceptance: acceptance,
        project: project,
        finalQuote: finalQuote
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage3QuoteDeliveryAcceptanceTest', error);
    return { success: false, message: 'Stage 3 quote delivery and acceptance test failed unexpectedly.' };
  }
}
