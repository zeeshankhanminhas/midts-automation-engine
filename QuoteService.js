/**
 * MIDTS Automation Engine
 * STAGE: 3 (Quote creation gating and append-only quote records)
 * WHAT THIS FILE DOES:
 * - Creates quote records only for qualified leads with approved vendor pricing.
 * - Sends customer quote emails and records explicit customer quote acceptance.
 * DEPENDENCIES:
 * - Google Sheets tabs: Leads, Quotes, Vendor Pricing
 * - Uses Google Sheet tab: Quotes
 * - LeadService (LeadService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - EmailService (EmailService.gs)
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
   * FUNCTION: getQuoteSnapshot
   * PURPOSE: Read one quote row without mutating its lifecycle status.
   * INPUT: quoteId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getQuoteSnapshot: function (quoteId) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(quoteId || '').trim();
      if (!id) {
        return { success: false, message: 'quoteId is required.' };
      }

      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Quotes sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === id) {
          return {
            success: true,
            message: 'Quote snapshot loaded.',
            data: {
              quoteId: id,
              leadId: String(values[i][1] || '').trim(),
              createdAt: values[i][2],
              quoteStatus: String(values[i][3] || '').trim(),
              amount: Number(values[i][4] || 0),
              currency: String(values[i][5] || '').trim(),
              validUntil: values[i][6],
              notes: String(values[i][7] || '').trim(),
              rowNumber: i + 1
            }
          };
        }
      }

      return { success: false, message: 'Quote not found for provided quoteId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.getQuoteSnapshot', error, { quoteId: quoteId });
      return { success: false, message: 'Failed to load quote snapshot.' };
    }
  },

  /**
   * FUNCTION: createQuoteForLead
   * PURPOSE: Create a quote row only when lead passes qualification and vendor pricing gates.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Quotes sheet when validation passes.
   */
  createQuoteForLead: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var leadId = String(input.leadId || '').trim();
      var requestedCurrency = String(input.currency || 'GBP').trim();
      var validUntil = input.validUntil || '';
      var notes = String(input.notes || '').trim();

      if (!leadId) {
        return { success: false, message: 'leadId is required.' };
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

      // Enforce vendor pricing policy before customer quote creation.
      var pricingResult = VendorPricingService.getApprovedPricingForLead(leadId);
      if (!pricingResult.success) {
        return pricingResult;
      }

      var finalCustomerPrice = Number(pricingResult.data.finalCustomerPrice || 0);
      if (finalCustomerPrice <= 0) {
        return {
          success: false,
          message: 'Approved vendor pricing is missing Final Customer Price. Apply MIDTS margin before quote generation.',
          data: {
            leadId: leadId,
            vendorPricingId: pricingResult.data.vendorPricingId
          }
        };
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Quotes sheet not found.' };
      }

      // Uses unique ID prefix QUOTE- for quote entities.
      var quoteId = UtilsService.createPrefixedId_('QUOTE-');
      var quoteCurrency = String(pricingResult.data.currency || requestedCurrency || 'GBP').trim();

      sheet.appendRow([
        quoteId,
        leadId,
        new Date(),
        'Draft',
        finalCustomerPrice,
        quoteCurrency,
        validUntil,
        notes
      ]);

      var linkResult = VendorPricingService.linkQuoteToVendorPricing(pricingResult.data.vendorPricingId, quoteId);
      if (!linkResult.success) {
        return linkResult;
      }

      return {
        success: true,
        message: 'Quote created successfully.',
        data: {
          quoteId: quoteId,
          leadId: leadId,
          vendorPricingId: pricingResult.data.vendorPricingId,
          vendorId: pricingResult.data.vendorId,
          finalCustomerPrice: finalCustomerPrice,
          currency: quoteCurrency,
          marginType: pricingResult.data.marginType,
          marginValue: pricingResult.data.marginValue
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createQuoteForLead', error, { payload: payload });
      return { success: false, message: 'Failed to create quote for lead.' };
    }
  },

  /**
   * FUNCTION: sendQuoteToCustomer
   * PURPOSE: Email an existing Draft quote to the lead and mark it Sent only after successful delivery.
   * INPUT: quoteId (string), options (object, optional: recipientOverrideEmail, recipientOverrideName)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Brevo email and updates quote status Draft -> Sent after success.
   */
  sendQuoteToCustomer: function (quoteId, options) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(quoteId || '').trim();
      var settings = options || {};
      if (!id) {
        return { success: false, message: 'quoteId is required.' };
      }

      var quoteResult = this.getQuoteSnapshot(id);
      if (!quoteResult.success) {
        return quoteResult;
      }
      var quote = quoteResult.data;
      if (quote.quoteStatus !== 'Draft' && quote.quoteStatus !== 'Sent') {
        return {
          success: false,
          message: 'Only Draft or Sent quotes can be delivered to the customer.',
          data: { quoteId: id, quoteStatus: quote.quoteStatus }
        };
      }

      var leadResult = this.getLeadContactForQuote_(quote.leadId);
      if (!leadResult.success) {
        return leadResult;
      }

      var lead = leadResult.data.lead;
      var recipientEmail = String(settings.recipientOverrideEmail || lead.email || '').trim();
      var recipientName = String(settings.recipientOverrideName || lead.fullName || 'there').trim();
      if (!recipientEmail || recipientEmail.indexOf('@') === -1) {
        return { success: false, message: 'A valid customer recipient email is required.' };
      }

      var emailResult = sendCustomerQuoteEmail_({
        quote: quote,
        lead: lead,
        toEmail: recipientEmail,
        toName: recipientName
      });
      if (!emailResult.success) {
        return { success: false, message: 'Customer quote email failed; quote status was not updated.', data: { quoteId: id, email: emailResult } };
      }

      var statusResult = quote.quoteStatus === 'Sent'
        ? { success: true, message: 'Quote was already marked Sent.', data: { quoteId: id, previousStatus: 'Sent', newStatus: 'Sent' } }
        : this.updateQuoteStatus(id, 'Sent');
      if (!statusResult.success) {
        return statusResult;
      }

      return {
        success: true,
        message: 'Quote sent to customer successfully.',
        data: {
          quoteId: id,
          leadId: quote.leadId,
          recipientEmail: recipientEmail,
          emailNotification: emailResult,
          statusUpdate: statusResult
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.sendQuoteToCustomer', error, { quoteId: quoteId, options: options });
      return { success: false, message: 'Failed to send quote to customer.' };
    }
  },

  /**
   * FUNCTION: acceptCustomerQuote
   * PURPOSE: Record customer acceptance by moving an existing Sent quote to Accepted.
   * INPUT: quoteId (string), acceptanceNotes (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one quote row status Sent -> Accepted.
   */
  acceptCustomerQuote: function (quoteId, acceptanceNotes) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(quoteId || '').trim();
      if (!id) {
        return { success: false, message: 'quoteId is required.' };
      }

      var quoteResult = this.getQuoteSnapshot(id);
      if (!quoteResult.success) {
        return quoteResult;
      }
      if (quoteResult.data.quoteStatus !== 'Sent') {
        return {
          success: false,
          message: 'Quote must be Sent before customer acceptance can be recorded.',
          data: { quoteId: id, quoteStatus: quoteResult.data.quoteStatus }
        };
      }

      var statusResult = this.updateQuoteStatus(id, 'Accepted');
      if (!statusResult.success) {
        return statusResult;
      }

      return {
        success: true,
        message: 'Customer quote acceptance recorded successfully.',
        data: {
          quoteId: id,
          leadId: quoteResult.data.leadId,
          acceptedAt: new Date(),
          acceptanceNotes: String(acceptanceNotes || '').trim(),
          statusUpdate: statusResult
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.acceptCustomerQuote', error, { quoteId: quoteId, acceptanceNotes: acceptanceNotes });
      return { success: false, message: 'Failed to record customer quote acceptance.' };
    }
  },

  /**
   * FUNCTION: getLeadContactForQuote_
   * PURPOSE: Internal helper to load customer-facing lead contact details for quote delivery.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getLeadContactForQuote_: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      var targetLeadId = String(leadId || '').trim();
      if (!targetLeadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var ensureResult = DatabaseService.ensureLeadsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === targetLeadId) {
          return {
            success: true,
            message: 'Lead contact loaded for quote delivery.',
            data: {
              lead: {
                leadId: targetLeadId,
                fullName: String(values[i][2] || '').trim(),
                email: String(values[i][3] || '').trim(),
                company: String(values[i][4] || '').trim(),
                projectType: String(values[i][5] || '').trim()
              }
            }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.getLeadContactForQuote_', error, { leadId: leadId });
      return { success: false, message: 'Failed to load lead contact for quote delivery.' };
    }
  }
};
