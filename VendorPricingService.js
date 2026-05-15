/**
 * MIDTS Automation Engine
 * STAGE: 4.5 (Vendor pricing prerequisite for quotes)
 * WHAT THIS FILE DOES:
 * - Stores vendor pricing submissions against qualified leads.
 * - Records MIDTS review status before quote generation is allowed.
 * - Accepts public vendor pricing form submissions through the website webhook.
 * - Provides quote-gating helpers used by QuoteService.
 * DEPENDENCIES:
 * - Google Sheets tab: Vendor Pricing
 * - Google Sheets tab: Vendor Pricing Logs
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorPricingService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Vendor Pricing
  VENDOR_PRICING_SHEET_NAME: 'Vendor Pricing',
  VENDOR_PRICING_LOGS_SHEET_NAME: 'Vendor Pricing Logs',
  STATUS_SUBMITTED: 'Submitted',
  REVIEW_APPROVED_FOR_QUOTE: 'Approved for Quote',

  /**
   * FUNCTION: handlePostEvent
   * PURPOSE: Receive a public vendor pricing webhook submission and record it against a qualified lead.
   * INPUT: e (Apps Script POST event object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append one Vendor Pricing row and one Vendor Pricing Logs row.
   */
  handlePostEvent: function (e) {
    // ===== MAIN LOGIC =====
    try {
      var payloadResult = WebsiteWebhookService.parsePostEvent_(e);
      if (!payloadResult.success) {
        this.logVendorPricingAttempt_('Parse payload', payloadResult, {});
        return payloadResult;
      }

      var payload = payloadResult.data.payload || {};
      var tokenResult = WebsiteWebhookService.validateWebhookToken_(payload);
      if (!tokenResult.success) {
        this.logVendorPricingAttempt_('Token validation', tokenResult, payload);
        return tokenResult;
      }

      var result = this.submitVendorPricingFromPayload_(payload);
      this.logVendorPricingAttempt_('Vendor pricing submission', result, payload);
      return result;
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.handlePostEvent', error, { event: e });
      var failure = { success: false, message: 'Vendor pricing webhook failed unexpectedly.' };
      this.logVendorPricingAttempt_('Unexpected failure', failure, {});
      return failure;
    }
  },

  /**
   * FUNCTION: isVendorPricingPayload
   * PURPOSE: Detect whether a public website payload belongs to vendor pricing intake.
   * INPUT: payload (object)
   * OUTPUT: boolean
   * SIDE EFFECTS: none
   */
  isVendorPricingPayload: function (payload) {
    // ===== MAIN LOGIC =====
    var input = payload || {};
    var stage = String(input.formStage || input.form_stage || input.stage || '').trim().toLowerCase();
    return stage === 'vendorpricing' ||
      stage === 'vendor_pricing' ||
      stage === 'vendor-pricing' ||
      stage === 'pricing' ||
      stage === 'vendor_price';
  },

  /**
   * FUNCTION: submitVendorPricingFromPayload_
   * PURPOSE: Normalize website form aliases before recording vendor pricing.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Vendor Pricing row when validation passes.
   */
  submitVendorPricingFromPayload_: function (payload) {
    // ===== MAIN LOGIC =====
    var input = payload || {};
    var costText = String(this.getField_(input, ['vendorCost', 'vendor_cost', 'cost', 'price', 'quotedCost', 'quoted_cost']) || '').replace(/[^0-9.-]/g, '');
    return this.submitVendorPricing({
      leadId: this.getField_(input, ['leadId', 'lead_id', 'leadReference', 'lead_reference']),
      vendorId: this.getField_(input, ['vendorId', 'vendor_id', 'vendorReference', 'vendor_reference']),
      vendorCost: Number(costText || 0),
      currency: this.getField_(input, ['currency']) || 'GBP',
      eta: this.getField_(input, ['eta', 'turnaround', 'timeline', 'deliveryTime', 'delivery_time']),
      vendorNotes: this.getField_(input, ['vendorNotes', 'vendor_notes', 'notes', 'message', 'pricingNotes', 'pricing_notes'])
    });
  },

  /**
   * FUNCTION: ensureVendorPricingSheetStructure
   * PURPOSE: Ensure Vendor Pricing sheet exists with fixed headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Vendor Pricing sheet if missing; appends missing headers only.
   */
  ensureVendorPricingSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = [
        'Vendor Pricing ID',
        'Lead ID',
        'Vendor ID',
        'Submitted At',
        'Vendor Cost',
        'Currency',
        'ETA',
        'Vendor Notes',
        'Pricing Status',
        'MIDTS Review Status',
        'Reviewed At',
        'MIDTS Notes'
      ];
      return DatabaseService.ensureSheetAndHeaders_(this.VENDOR_PRICING_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.ensureVendorPricingSheetStructure', error);
      return { success: false, message: 'Failed to verify Vendor Pricing sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureVendorPricingLogSheet_
   * PURPOSE: Ensure public vendor pricing attempts are auditable.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Vendor Pricing Logs sheet if missing.
   */
  ensureVendorPricingLogSheet_: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = [
        'Timestamp',
        'Stage',
        'Success',
        'Message',
        'Lead ID',
        'Vendor ID',
        'Vendor Cost',
        'Currency',
        'Payload Keys',
        'Result JSON'
      ];
      return DatabaseService.ensureSheetAndHeaders_(this.VENDOR_PRICING_LOGS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.ensureVendorPricingLogSheet_', error);
      return { success: false, message: 'Failed to verify Vendor Pricing Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: logVendorPricingAttempt_
   * PURPOSE: Record public vendor pricing webhook audit details.
   * INPUT: stage (string), result (object), payload (object)
   * OUTPUT: none
   * SIDE EFFECTS: Appends one Vendor Pricing Logs row when possible.
   */
  logVendorPricingAttempt_: function (stage, result, payload) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureVendorPricingLogSheet_();
      var input = payload || {};
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.VENDOR_PRICING_LOGS_SHEET_NAME);
      if (!sheet) {
        return;
      }

      sheet.appendRow([
        new Date(),
        stage || '',
        result && result.success ? 'TRUE' : 'FALSE',
        result && result.message ? result.message : '',
        this.cleanText_(this.getField_(input, ['leadId', 'lead_id', 'leadReference', 'lead_reference'])),
        this.cleanText_(this.getField_(input, ['vendorId', 'vendor_id', 'vendorReference', 'vendor_reference'])),
        this.cleanText_(this.getField_(input, ['vendorCost', 'vendor_cost', 'cost', 'price', 'quotedCost', 'quoted_cost'])),
        this.cleanText_(this.getField_(input, ['currency'])),
        Object.keys(input).sort().join(', '),
        JSON.stringify(result || {})
      ]);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.logVendorPricingAttempt_', error, { stage: stage, result: result });
    }
  },

  /**
   * FUNCTION: submitVendorPricing
   * PURPOSE: Record one vendor pricing submission for a qualified lead.
   * INPUT: payload (object: leadId, vendorId, vendorCost, currency, eta, vendorNotes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Vendor Pricing row when validation passes.
   */
  submitVendorPricing: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var leadId = String(input.leadId || '').trim();
      var vendorId = String(input.vendorId || '').trim();
      var vendorCost = Number(input.vendorCost || 0);
      var currency = String(input.currency || 'GBP').trim();
      var eta = String(input.eta || '').trim();
      var vendorNotes = String(input.vendorNotes || '').trim();

      if (!leadId || !vendorId) {
        return { success: false, message: 'leadId and vendorId are required.' };
      }
      if (vendorCost <= 0) {
        return { success: false, message: 'vendorCost must be greater than zero.' };
      }

      var leadGate = LeadService.canLeadProceedToQuote(leadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        return { success: false, message: 'Lead is not qualified for vendor pricing.', data: leadGate.data || {} };
      }

      var ensureResult = this.ensureVendorPricingSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.VENDOR_PRICING_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Vendor Pricing sheet not found.' };
      }

      var vendorPricingId = UtilsService.createSequentialId_('VENDOR_PRICING');
      sheet.appendRow([
        vendorPricingId,
        leadId,
        vendorId,
        new Date(),
        vendorCost,
        currency,
        eta,
        vendorNotes,
        this.STATUS_SUBMITTED,
        'Pending Review',
        '',
        ''
      ]);

      return {
        success: true,
        message: 'Vendor pricing submitted successfully.',
        data: { vendorPricingId: vendorPricingId, leadId: leadId, vendorId: vendorId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.submitVendorPricing', error, { payload: payload });
      return { success: false, message: 'Failed to submit vendor pricing.' };
    }
  },

  /**
   * FUNCTION: approveVendorPricingForQuote
   * PURPOSE: Mark submitted vendor pricing as reviewed and approved for quote generation.
   * INPUT: vendorPricingId (string), midtsNotes (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Vendor Pricing row review fields.
   */
  approveVendorPricingForQuote: function (vendorPricingId, midtsNotes) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(vendorPricingId || '').trim();
      if (!id) {
        return { success: false, message: 'vendorPricingId is required.' };
      }

      var ensureResult = this.ensureVendorPricingSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.VENDOR_PRICING_SHEET_NAME);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === id) {
          var pricingStatus = String(values[i][8] || '').trim();
          if (pricingStatus !== this.STATUS_SUBMITTED) {
            return {
              success: false,
              message: 'Vendor pricing must be Submitted before approval.',
              data: { vendorPricingId: id, pricingStatus: pricingStatus }
            };
          }

          sheet.getRange(i + 1, 10).setValue(this.REVIEW_APPROVED_FOR_QUOTE);
          sheet.getRange(i + 1, 11).setValue(new Date());
          sheet.getRange(i + 1, 12).setValue(String(midtsNotes || '').trim());

          return {
            success: true,
            message: 'Vendor pricing approved for quote.',
            data: { vendorPricingId: id, leadId: String(values[i][1] || '').trim(), vendorId: String(values[i][2] || '').trim() }
          };
        }
      }

      return { success: false, message: 'Vendor pricing not found for provided vendorPricingId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.approveVendorPricingForQuote', error, { vendorPricingId: vendorPricingId });
      return { success: false, message: 'Failed to approve vendor pricing.' };
    }
  },

  /**
   * FUNCTION: getApprovedPricingForLead
   * PURPOSE: Return the newest submitted vendor pricing row approved by MIDTS for quote generation.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getApprovedPricingForLead: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      var targetLeadId = String(leadId || '').trim();
      if (!targetLeadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var ensureResult = this.ensureVendorPricingSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.VENDOR_PRICING_SHEET_NAME);
      var values = sheet.getDataRange().getValues();
      for (var i = values.length - 1; i >= 1; i--) {
        var rowLeadId = String(values[i][1] || '').trim();
        var pricingStatus = String(values[i][8] || '').trim();
        var reviewStatus = String(values[i][9] || '').trim();
        if (rowLeadId === targetLeadId && pricingStatus === this.STATUS_SUBMITTED && reviewStatus === this.REVIEW_APPROVED_FOR_QUOTE) {
          return {
            success: true,
            message: 'Approved vendor pricing found for lead.',
            data: {
              vendorPricingId: String(values[i][0] || '').trim(),
              leadId: rowLeadId,
              vendorId: String(values[i][2] || '').trim(),
              vendorCost: Number(values[i][4] || 0),
              currency: String(values[i][5] || '').trim(),
              eta: String(values[i][6] || '').trim(),
              rowNumber: i + 1
            }
          };
        }
      }

      return {
        success: false,
        message: 'No submitted vendor pricing has been approved for quote generation.',
        data: { leadId: targetLeadId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorPricingService.getApprovedPricingForLead', error, { leadId: leadId });
      return { success: false, message: 'Failed to load approved vendor pricing.' };
    }
  },

  /**
   * FUNCTION: getField_
   * PURPOSE: Return the first populated field across accepted aliases.
   * INPUT: payload (object), aliases (array)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  getField_: function (payload, aliases) {
    // ===== MAIN LOGIC =====
    var input = payload || {};
    for (var i = 0; i < aliases.length; i++) {
      var key = aliases[i];
      if (input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== '') {
        return input[key];
      }
    }
    return '';
  },

  /**
   * FUNCTION: cleanText_
   * PURPOSE: Convert any simple payload value into a trimmed string.
   * INPUT: value (any)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  cleanText_: function (value) {
    // ===== MAIN LOGIC =====
    return String(value || '').trim();
  }
};