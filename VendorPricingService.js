/**
 * MIDTS Automation Engine
 * STAGE: 4.5 (Vendor pricing prerequisite for quotes)
 * WHAT THIS FILE DOES:
 * - Stores vendor pricing submissions against qualified leads.
 * - Records MIDTS review status before quote generation is allowed.
 * - Provides quote-gating helpers used by QuoteService.
 * DEPENDENCIES:
 * - Google Sheets tab: Vendor Pricing
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorPricingService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Vendor Pricing
  VENDOR_PRICING_SHEET_NAME: 'Vendor Pricing',
  STATUS_SUBMITTED: 'Submitted',
  REVIEW_APPROVED_FOR_QUOTE: 'Approved for Quote',

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
  }
};
