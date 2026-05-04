/**
 * MIDTS Automation Engine
 * STAGE: 3 (Quote creation gating and append-only quote records)
 * WHAT THIS FILE DOES:
 * - Creates quote records only for qualified leads.
 * DEPENDENCIES:
 * - Google Sheets tabs: Leads, Quotes
 * - Uses Google Sheet tab: Quotes
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var QuoteService = {

  /**
   * FUNCTION: updateQuoteStatus
   * PURPOSE: Update quote status using allowed transitions (Draft -> Sent -> Accepted/Rejected).
   * INPUT: quoteId (string), newStatus (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one quote row status in Quotes sheet.
   */
  updateQuoteStatus: function (quoteId, newStatus) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(quoteId || '').trim();
      var status = String(newStatus || '').trim();
      if (!id) {
        return { success: false, message: 'quoteId is required.' };
      }
      if (!status) {
        return { success: false, message: 'newStatus is required.' };
      }

      var allowedStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
      if (allowedStatuses.indexOf(status) === -1) {
        return { success: false, message: 'Invalid quote status.' };
      }

      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Quotes sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === id) {
          var currentStatus = String(values[i][3] || '').trim();

          // Allowed transitions enforce a predictable quote lifecycle.
          var canTransition = (
            (currentStatus === 'Draft' && status === 'Sent') ||
            (currentStatus === 'Sent' && (status === 'Accepted' || status === 'Rejected')) ||
            (currentStatus === status)
          );

          if (!canTransition) {
            return {
              success: false,
              message: 'Invalid quote status transition.',
              data: { quoteId: id, currentStatus: currentStatus, requestedStatus: status }
            };
          }

          sheet.getRange(i + 1, 4).setValue(status);
          return {
            success: true,
            message: 'Quote status updated successfully.',
            data: { quoteId: id, previousStatus: currentStatus, newStatus: status }
          };
        }
      }

      return { success: false, message: 'Quote not found for provided quoteId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.updateQuoteStatus', error, { quoteId: quoteId, newStatus: newStatus });
      return { success: false, message: 'Failed to update quote status.' };
    }
  },

  /**
   * FUNCTION: createQuoteForLead
   * PURPOSE: Create a quote row only when lead passes qualification gate.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Quotes sheet when validation passes.
   */
  createQuoteForLead: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var leadId = String(input.leadId || '').trim();
      var amount = Number(input.amount || 0);
      var currency = String(input.currency || 'GBP').trim();
      var validUntil = input.validUntil || '';
      var notes = String(input.notes || '').trim();

      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
      }

      if (amount <= 0) {
        return { success: false, message: 'amount must be greater than zero.' };
      }

      // Ensure Quotes sheet exists early so operations can verify structure even when gating blocks writes.
      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      // Enforce workflow policy: only qualified leads can move to quote generation.
      var gateResult = LeadService.canLeadProceedToQuote(leadId);
      if (!gateResult.success) {
        return gateResult;
      }
      if (!gateResult.data.canProceed) {
        return { success: false, message: 'Lead is not qualified for quote generation.', data: gateResult.data };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Quotes sheet not found.' };
      }

      // Uses unique ID prefix QUOTE- for quote entities.
      var quoteId = UtilsService.createPrefixedId_('QUOTE-');
      sheet.appendRow([
        quoteId,
        leadId,
        new Date(),
        'Draft',
        amount,
        currency,
        validUntil,
        notes
      ]);

      return {
        success: true,
        message: 'Quote created successfully.',
        data: { quoteId: quoteId, leadId: leadId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createQuoteForLead', error, { payload: payload });
      return { success: false, message: 'Failed to create quote for lead.' };
    }
  }
};
