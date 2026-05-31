/**
 * MIDTS Automation Engine
 * STAGE: 5 (Quote creation from vendor pricing)
 * WHAT THIS FILE DOES:
 * - Creates append-only customer quote records from vendor pricing inputs.
 * - Validates lead existence, qualified lead status, and vendor assignment before customer quote creation.
 * - Calculates MIDTS profit and final client quote amount from vendor cost and margin percent.
 * - Sends customer quote emails and tracks quote lifecycle statuses.
 * DEPENDENCIES:
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Vendors
 * - Google Sheets tab: Quotes
 * - Google Sheets tab: Vendor Pricing
 * - Uses Google Sheet tab: Quotes
 * - Uses Brevo API key from Settings sheet: BREVO_API_KEY when quote email sending is requested
 * - REQUIRED: Set BREVO_API_KEY, BREVO_SENDER_EMAIL, and BREVO_SENDER_NAME before sending quote emails
 * - LeadService (LeadService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - EmailService (EmailService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var QuoteService = {
  // ===== CONFIG =====
  QUOTE_STATUS_DRAFT: 'Draft',
  QUOTE_STATUS_SENT: 'Sent',
  QUOTE_STATUS_ACCEPTED: 'Accepted',
  QUOTE_STATUS_REJECTED: 'Rejected',
  QUOTE_STATUS_EXPIRED: 'Expired',

  /**
   * FUNCTION: updateQuoteStatus
   * PURPOSE: Update quote status using allowed customer quote lifecycle transitions.
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
        return this.fail_('QuoteService.updateQuoteStatus', 'quoteId is required.', { quoteId: quoteId, newStatus: newStatus });
      }
      if (!status) {
        return this.fail_('QuoteService.updateQuoteStatus', 'newStatus is required.', { quoteId: id, newStatus: newStatus });
      }

      var allowedStatuses = this.getAllowedQuoteStatuses_();
      if (allowedStatuses.indexOf(status) === -1) {
        return this.fail_('QuoteService.updateQuoteStatus', 'Invalid quote status.', { quoteId: id, requestedStatus: status, allowedStatuses: allowedStatuses });
      }

      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return this.fail_('QuoteService.updateQuoteStatus', 'Quotes sheet not found.', { quoteId: id, requestedStatus: status });
      }

      var columns = this.getQuoteColumnMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns.quoteId - 1] || '').trim() === id) {
          var currentStatus = String(values[i][columns.quoteStatus - 1] || '').trim();

          // Status transitions protect downstream payment/project stages from premature progression.
          var canTransition = (
            (currentStatus === this.QUOTE_STATUS_DRAFT && (status === this.QUOTE_STATUS_SENT || status === this.QUOTE_STATUS_EXPIRED)) ||
            (currentStatus === this.QUOTE_STATUS_SENT && (status === this.QUOTE_STATUS_ACCEPTED || status === this.QUOTE_STATUS_REJECTED || status === this.QUOTE_STATUS_EXPIRED)) ||
            (currentStatus === status)
          );

          if (!canTransition) {
            return this.fail_('QuoteService.updateQuoteStatus', 'Invalid quote status transition.', {
              quoteId: id,
              currentStatus: currentStatus,
              requestedStatus: status
            });
          }

          sheet.getRange(i + 1, columns.quoteStatus).setValue(status);
          return {
            success: true,
            message: 'Quote status updated successfully.',
            data: { quoteId: id, previousStatus: currentStatus, newStatus: status }
          };
        }
      }

      return this.fail_('QuoteService.updateQuoteStatus', 'Quote not found for provided quoteId.', { quoteId: id, requestedStatus: status });
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
        return this.fail_('QuoteService.getQuoteSnapshot', 'quoteId is required.', { quoteId: quoteId });
      }

      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return this.fail_('QuoteService.getQuoteSnapshot', 'Quotes sheet not found.', { quoteId: id });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Quote ID'] - 1] || '').trim() === id) {
          return {
            success: true,
            message: 'Quote snapshot loaded.',
            data: this.buildQuoteSnapshotFromRow_(values[i], columns, i + 1)
          };
        }
      }

      return this.fail_('QuoteService.getQuoteSnapshot', 'Quote not found for provided quoteId.', { quoteId: id });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.getQuoteSnapshot', error, { quoteId: quoteId });
      return { success: false, message: 'Failed to load quote snapshot.' };
    }
  },

  /**
   * FUNCTION: createQuoteForLead
   * PURPOSE: Create a customer quote from vendor pricing, or from approved Vendor Pricing when direct pricing fields are omitted.
   * INPUT: payload (object: leadId, vendorId, vendorCost, marginPercent, currency, notes, quoteStatus, sendEmail)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one quote row; may link Vendor Pricing; may send quote email and mark Sent.
   */
  createQuoteForLead: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var hasDirectVendorPricing = input.vendorId !== undefined || input.vendorCost !== undefined || input.marginPercent !== undefined;

      if (hasDirectVendorPricing) {
        return this.createQuoteFromVendorPricing_(input);
      }

      // Backward-compatible approved-pricing path used by earlier vendor pricing stages.
      var approvedPricingResult = VendorPricingService.getApprovedPricingForLead(String(input.leadId || '').trim());
      if (approvedPricingResult.success) {
        return this.createQuoteFromApprovedPricing_(input, approvedPricingResult.data);
      }

      // Backward-compatible legacy amount path for older stage tests; new production callers should pass vendor pricing fields.
      if (input.amount !== undefined) {
        return this.createLegacyAmountQuote_(input);
      }

      return this.fail_('QuoteService.createQuoteForLead', approvedPricingResult.message || 'Vendor pricing is required before quote creation.', {
        payload: payload,
        approvedPricingResult: approvedPricingResult
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createQuoteForLead', error, { payload: payload });
      return { success: false, message: 'Failed to create quote for lead.' };
    }
  },

  /**
   * FUNCTION: createQuoteFromVendorPricing_
   * PURPOSE: Create a quote from explicit vendor cost and MIDTS margin percent after assignment validation.
   * INPUT: input (object: leadId, vendorId, vendorCost, marginPercent, currency, notes, quoteStatus, sendEmail)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one quote row and may send quote email.
   */
  createQuoteFromVendorPricing_: function (input) {
    // ===== MAIN LOGIC =====
    try {
      var validation = this.validateDirectQuoteInput_(input);
      if (!validation.success) {
        return validation;
      }
      var request = validation.data.request;

      var setupResult = this.ensureQuoteWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var leadResult = this.getLeadContactForQuote_(request.leadId);
      if (!leadResult.success) {
        return leadResult;
      }

      var leadGate = LeadService.canLeadProceedToQuote(request.leadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        return this.fail_('QuoteService.createQuoteFromVendorPricing_', 'Lead is not qualified for quote creation.', {
          leadId: request.leadId,
          vendorId: request.vendorId,
          gate: leadGate
        });
      }

      var assignmentResult = this.validateVendorAssignment_(request.leadId, request.vendorId);
      if (!assignmentResult.success) {
        return assignmentResult;
      }

      var calculation = this.calculateQuoteAmount_(request.vendorCost, request.marginPercent);
      if (!calculation.success) {
        return calculation;
      }

      var quoteId = UtilsService.createSequentialId_('QUOTE');
      var appendResult = this.appendQuoteRow_({
        quoteId: quoteId,
        leadId: request.leadId,
        vendorId: request.vendorId,
        vendorCost: request.vendorCost,
        marginPercent: request.marginPercent,
        midtsProfitAmount: calculation.data.midtsProfitAmount,
        clientQuoteAmount: calculation.data.clientQuoteAmount,
        amount: calculation.data.clientQuoteAmount,
        currency: request.currency,
        quoteStatus: request.sendEmail ? this.QUOTE_STATUS_DRAFT : request.quoteStatus,
        validUntil: request.validUntil,
        notes: request.notes,
        vendorPricingId: request.vendorPricingId,
        createdFrom: 'Direct Vendor Pricing'
      });
      if (!appendResult.success) {
        return appendResult;
      }

      var emailResult = null;
      var statusResult = null;
      if (request.sendEmail) {
        emailResult = this.sendQuoteToCustomer(quoteId, request.emailOptions || {});
        if (!emailResult.success) {
          return this.fail_('QuoteService.createQuoteFromVendorPricing_', 'Quote was saved as Draft, but quote email failed.', {
            quoteId: quoteId,
            leadId: request.leadId,
            vendorId: request.vendorId,
            emailResult: emailResult
          });
        }
        statusResult = emailResult.data.statusUpdate;
      }

      return {
        success: true,
        message: request.sendEmail ? 'Quote created and sent to client successfully.' : 'Quote created successfully.',
        data: {
          quoteId: quoteId,
          leadId: request.leadId,
          vendorId: request.vendorId,
          vendorCost: request.vendorCost,
          marginPercent: request.marginPercent,
          midtsProfitAmount: calculation.data.midtsProfitAmount,
          clientQuoteAmount: calculation.data.clientQuoteAmount,
          finalCustomerPrice: calculation.data.clientQuoteAmount,
          amount: calculation.data.clientQuoteAmount,
          currency: request.currency,
          quoteStatus: request.sendEmail ? this.QUOTE_STATUS_SENT : request.quoteStatus,
          emailNotification: emailResult,
          statusUpdate: statusResult,
          rowNumber: appendResult.data.rowNumber
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createQuoteFromVendorPricing_', error, { input: input });
      return { success: false, message: 'Failed to create quote from vendor pricing.' };
    }
  },

  /**
   * FUNCTION: createQuoteFromApprovedPricing_
   * PURPOSE: Preserve approved Vendor Pricing quote creation and write expanded quote metadata.
   * INPUT: input (object), pricing (object from VendorPricingService.getApprovedPricingForLead)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one quote row and links Vendor Pricing to Quote ID.
   */
  createQuoteFromApprovedPricing_: function (input, pricing) {
    // ===== MAIN LOGIC =====
    try {
      var leadId = String(input.leadId || '').trim();
      if (!leadId) {
        return this.fail_('QuoteService.createQuoteFromApprovedPricing_', 'leadId is required.', { payload: input });
      }

      var setupResult = this.ensureQuoteWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var leadGate = LeadService.canLeadProceedToQuote(leadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        return this.fail_('QuoteService.createQuoteFromApprovedPricing_', 'Lead is not qualified for quote generation.', { leadId: leadId, gate: leadGate });
      }

      var finalCustomerPrice = Number(pricing.finalCustomerPrice || 0);
      if (finalCustomerPrice <= 0) {
        return this.fail_('QuoteService.createQuoteFromApprovedPricing_', 'Approved vendor pricing is missing Final Customer Price. Apply MIDTS margin before quote generation.', {
          leadId: leadId,
          vendorPricingId: pricing.vendorPricingId
        });
      }

      var quoteId = UtilsService.createSequentialId_('QUOTE');
      var quoteStatus = this.normalizeInitialQuoteStatus_(input.quoteStatus || input.status || this.QUOTE_STATUS_DRAFT);
      if (!quoteStatus.success) {
        return quoteStatus;
      }

      var appendResult = this.appendQuoteRow_({
        quoteId: quoteId,
        leadId: leadId,
        vendorId: pricing.vendorId,
        vendorCost: Number(pricing.vendorCost || 0),
        marginPercent: String(pricing.marginType || '').toUpperCase() === 'PERCENT' ? Number(pricing.marginValue || 0) : '',
        midtsProfitAmount: Number(pricing.profitAmount || 0),
        clientQuoteAmount: finalCustomerPrice,
        amount: finalCustomerPrice,
        currency: String(pricing.currency || input.currency || 'GBP').trim(),
        quoteStatus: quoteStatus.data.quoteStatus,
        validUntil: input.validUntil || '',
        notes: String(input.notes || '').trim(),
        vendorPricingId: pricing.vendorPricingId,
        createdFrom: 'Approved Vendor Pricing'
      });
      if (!appendResult.success) {
        return appendResult;
      }

      var linkResult = VendorPricingService.linkQuoteToVendorPricing(pricing.vendorPricingId, quoteId);
      if (!linkResult.success) {
        return linkResult;
      }

      return {
        success: true,
        message: 'Quote created successfully.',
        data: {
          quoteId: quoteId,
          leadId: leadId,
          vendorPricingId: pricing.vendorPricingId,
          vendorId: pricing.vendorId,
          vendorCost: Number(pricing.vendorCost || 0),
          marginPercent: String(pricing.marginType || '').toUpperCase() === 'PERCENT' ? Number(pricing.marginValue || 0) : '',
          midtsProfitAmount: Number(pricing.profitAmount || 0),
          clientQuoteAmount: finalCustomerPrice,
          finalCustomerPrice: finalCustomerPrice,
          amount: finalCustomerPrice,
          currency: String(pricing.currency || input.currency || 'GBP').trim(),
          quoteStatus: quoteStatus.data.quoteStatus,
          marginType: pricing.marginType,
          marginValue: pricing.marginValue,
          rowNumber: appendResult.data.rowNumber
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createQuoteFromApprovedPricing_', error, { input: input, pricing: pricing });
      return { success: false, message: 'Failed to create quote from approved vendor pricing.' };
    }
  },

  /**
   * FUNCTION: createLegacyAmountQuote_
   * PURPOSE: Keep earlier stage amount-based tests working without introducing payment or project logic.
   * INPUT: input (object: leadId, amount, currency, validUntil, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one quote row.
   */
  createLegacyAmountQuote_: function (input) {
    // ===== MAIN LOGIC =====
    try {
      var leadId = String(input.leadId || '').trim();
      var amount = Number(input.amount || 0);
      if (!leadId) {
        return this.fail_('QuoteService.createLegacyAmountQuote_', 'leadId is required.', { payload: input });
      }
      if (!isFinite(amount) || amount <= 0) {
        return this.fail_('QuoteService.createLegacyAmountQuote_', 'amount must be greater than zero.', { leadId: leadId, amount: input.amount });
      }

      var setupResult = this.ensureQuoteWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var leadGate = LeadService.canLeadProceedToQuote(leadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        return this.fail_('QuoteService.createLegacyAmountQuote_', 'Lead is not qualified for quote generation.', { leadId: leadId, gate: leadGate });
      }

      var quoteStatus = this.normalizeInitialQuoteStatus_(input.quoteStatus || input.status || this.QUOTE_STATUS_DRAFT);
      if (!quoteStatus.success) {
        return quoteStatus;
      }

      var quoteId = UtilsService.createSequentialId_('QUOTE');
      var appendResult = this.appendQuoteRow_({
        quoteId: quoteId,
        leadId: leadId,
        vendorId: String(input.vendorId || '').trim(),
        vendorCost: '',
        marginPercent: '',
        midtsProfitAmount: '',
        clientQuoteAmount: amount,
        amount: amount,
        currency: String(input.currency || 'GBP').trim(),
        quoteStatus: quoteStatus.data.quoteStatus,
        validUntil: input.validUntil || '',
        notes: String(input.notes || '').trim(),
        vendorPricingId: '',
        createdFrom: 'Legacy Amount'
      });
      if (!appendResult.success) {
        return appendResult;
      }

      return {
        success: true,
        message: 'Quote created successfully.',
        data: {
          quoteId: quoteId,
          leadId: leadId,
          vendorId: String(input.vendorId || '').trim(),
          amount: amount,
          clientQuoteAmount: amount,
          finalCustomerPrice: amount,
          currency: String(input.currency || 'GBP').trim(),
          quoteStatus: quoteStatus.data.quoteStatus,
          rowNumber: appendResult.data.rowNumber
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.createLegacyAmountQuote_', error, { input: input });
      return { success: false, message: 'Failed to create legacy amount quote.' };
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
        return this.fail_('QuoteService.sendQuoteToCustomer', 'quoteId is required.', { quoteId: quoteId, options: options });
      }

      var quoteResult = this.getQuoteSnapshot(id);
      if (!quoteResult.success) {
        return quoteResult;
      }
      var quote = quoteResult.data;
      if (quote.quoteStatus !== this.QUOTE_STATUS_DRAFT && quote.quoteStatus !== this.QUOTE_STATUS_SENT) {
        return this.fail_('QuoteService.sendQuoteToCustomer', 'Only Draft or Sent quotes can be delivered to the customer.', {
          quoteId: id,
          quoteStatus: quote.quoteStatus
        });
      }

      var leadResult = this.getLeadContactForQuote_(quote.leadId);
      if (!leadResult.success) {
        return leadResult;
      }

      var lead = leadResult.data.lead;
      var recipientEmail = String(settings.recipientOverrideEmail || lead.email || '').trim();
      var recipientName = String(settings.recipientOverrideName || lead.fullName || 'there').trim();
      if (!recipientEmail || recipientEmail.indexOf('@') === -1) {
        return this.fail_('QuoteService.sendQuoteToCustomer', 'A valid customer recipient email is required.', {
          quoteId: id,
          leadId: quote.leadId,
          recipientEmail: recipientEmail
        });
      }

      var emailResult = sendCustomerQuoteEmail_({
        quote: quote,
        lead: lead,
        toEmail: recipientEmail,
        toName: recipientName
      });
      if (!emailResult.success) {
        return this.fail_('QuoteService.sendQuoteToCustomer', 'Customer quote email failed; quote status was not updated.', {
          quoteId: id,
          email: emailResult
        });
      }

      var statusResult = quote.quoteStatus === this.QUOTE_STATUS_SENT
        ? { success: true, message: 'Quote was already marked Sent.', data: { quoteId: id, previousStatus: this.QUOTE_STATUS_SENT, newStatus: this.QUOTE_STATUS_SENT } }
        : this.updateQuoteStatus(id, this.QUOTE_STATUS_SENT);
      if (!statusResult.success) {
        return statusResult;
      }

      return {
        success: true,
        message: 'Quote sent to customer successfully.',
        data: {
          quoteId: id,
          leadId: quote.leadId,
          vendorId: quote.vendorId,
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
        return this.fail_('QuoteService.acceptCustomerQuote', 'quoteId is required.', { quoteId: quoteId, acceptanceNotes: acceptanceNotes });
      }

      var quoteResult = this.getQuoteSnapshot(id);
      if (!quoteResult.success) {
        return quoteResult;
      }
      if (quoteResult.data.quoteStatus !== this.QUOTE_STATUS_SENT) {
        return this.fail_('QuoteService.acceptCustomerQuote', 'Quote must be Sent before customer acceptance can be recorded.', {
          quoteId: id,
          quoteStatus: quoteResult.data.quoteStatus
        });
      }

      var statusResult = this.updateQuoteStatus(id, this.QUOTE_STATUS_ACCEPTED);
      if (!statusResult.success) {
        return statusResult;
      }

      return {
        success: true,
        message: 'Customer quote acceptance recorded successfully.',
        data: {
          quoteId: id,
          leadId: quoteResult.data.leadId,
          vendorId: quoteResult.data.vendorId,
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
        return this.fail_('QuoteService.getLeadContactForQuote_', 'leadId is required.', { leadId: leadId });
      }

      var ensureResult = DatabaseService.ensureLeadsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('QuoteService.getLeadContactForQuote_', 'Leads sheet not found.', { leadId: targetLeadId });
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
                projectType: String(values[i][5] || '').trim(),
                rowNumber: i + 1
              }
            }
          };
        }
      }

      return this.fail_('QuoteService.getLeadContactForQuote_', 'Lead not found for provided leadId.', { leadId: targetLeadId });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.getLeadContactForQuote_', error, { leadId: leadId });
      return { success: false, message: 'Failed to load lead contact for quote delivery.' };
    }
  },

  /**
   * FUNCTION: validateDirectQuoteInput_
   * PURPOSE: Validate and normalize direct vendor pricing quote input.
   * INPUT: input (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs validation failures to Error Logs.
   */
  validateDirectQuoteInput_: function (input) {
    // ===== MAIN LOGIC =====
    try {
      var payload = input || {};
      var leadId = String(payload.leadId || '').trim();
      var vendorId = String(payload.vendorId || '').trim();
      var vendorCost = Number(payload.vendorCost);
      var marginPercent = Number(payload.marginPercent);
      var currency = String(payload.currency || 'GBP').trim();
      var notes = String(payload.notes || '').trim();
      var validUntil = payload.validUntil || '';
      var sendEmail = payload.sendEmail === true;
      var quoteStatusInput = payload.quoteStatus || payload.status || this.QUOTE_STATUS_DRAFT;

      if (!leadId) {
        return this.fail_('QuoteService.validateDirectQuoteInput_', 'leadId is required.', { payload: payload });
      }
      if (!vendorId) {
        return this.fail_('QuoteService.validateDirectQuoteInput_', 'vendorId is required.', { leadId: leadId, payload: payload });
      }
      if (!isFinite(vendorCost) || vendorCost <= 0) {
        return this.fail_('QuoteService.validateDirectQuoteInput_', 'vendorCost must be greater than zero.', { leadId: leadId, vendorId: vendorId, vendorCost: payload.vendorCost });
      }
      if (!isFinite(marginPercent) || marginPercent < 0) {
        return this.fail_('QuoteService.validateDirectQuoteInput_', 'marginPercent must be zero or greater.', { leadId: leadId, vendorId: vendorId, marginPercent: payload.marginPercent });
      }
      if (!currency) {
        return this.fail_('QuoteService.validateDirectQuoteInput_', 'currency is required.', { leadId: leadId, vendorId: vendorId });
      }

      var quoteStatus = this.normalizeInitialQuoteStatus_(quoteStatusInput);
      if (!quoteStatus.success) {
        return quoteStatus;
      }

      return {
        success: true,
        message: 'Quote input validated successfully.',
        data: {
          request: {
            leadId: leadId,
            vendorId: vendorId,
            vendorCost: vendorCost,
            marginPercent: marginPercent,
            currency: currency,
            notes: notes,
            validUntil: validUntil,
            quoteStatus: quoteStatus.data.quoteStatus,
            sendEmail: sendEmail,
            emailOptions: payload.emailOptions || {},
            vendorPricingId: String(payload.vendorPricingId || '').trim()
          }
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.validateDirectQuoteInput_', error, { input: input });
      return { success: false, message: 'Failed to validate quote input.' };
    }
  },

  /**
   * FUNCTION: validateVendorAssignment_
   * PURPOSE: Confirm the requested vendor is assigned to the lead before quote creation.
   * INPUT: leadId (string), vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs validation failures to Error Logs.
   */
  validateVendorAssignment_: function (leadId, vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }
      var vendorsResult = DatabaseService.ensureVendorsSheetStructure();
      if (!vendorsResult.success) {
        return vendorsResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var leadSheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      var vendorSheet = spreadsheet.getSheetByName(ConfigService.VENDORS_SHEET_NAME);
      if (!leadSheet || !vendorSheet) {
        return this.fail_('QuoteService.validateVendorAssignment_', 'Leads or Vendors sheet not found.', { leadId: leadId, vendorId: vendorId });
      }

      var leadColumns = this.getHeaderMap_(leadSheet);
      var leadValues = leadSheet.getDataRange().getValues();
      var leadFound = false;
      var leadAssignedVendorId = '';
      for (var i = 1; i < leadValues.length; i++) {
        if (String(leadValues[i][leadColumns['Lead ID'] - 1] || '').trim() === String(leadId || '').trim()) {
          leadFound = true;
          leadAssignedVendorId = leadColumns['Assigned Vendor ID'] ? String(leadValues[i][leadColumns['Assigned Vendor ID'] - 1] || '').trim() : '';
          break;
        }
      }
      if (!leadFound) {
        return this.fail_('QuoteService.validateVendorAssignment_', 'Lead not found for provided leadId.', { leadId: leadId, vendorId: vendorId });
      }

      var vendorColumns = this.getHeaderMap_(vendorSheet);
      var vendorValues = vendorSheet.getDataRange().getValues();
      var vendorFound = false;
      var assignedLeadIds = [];
      for (var j = 1; j < vendorValues.length; j++) {
        if (String(vendorValues[j][vendorColumns['Vendor ID'] - 1] || '').trim() === String(vendorId || '').trim()) {
          vendorFound = true;
          var assignedText = String(vendorValues[j][vendorColumns['Assigned Lead IDs'] - 1] || '').trim();
          assignedLeadIds = assignedText ? assignedText.split(',').map(function (item) { return item.trim(); }).filter(function (item) { return item; }) : [];
          break;
        }
      }
      if (!vendorFound) {
        return this.fail_('QuoteService.validateVendorAssignment_', 'Vendor not found for provided vendorId.', { leadId: leadId, vendorId: vendorId });
      }

      var leadSideAssigned = leadAssignedVendorId === String(vendorId || '').trim();
      var vendorSideAssigned = assignedLeadIds.indexOf(String(leadId || '').trim()) !== -1;
      if (!leadSideAssigned && !vendorSideAssigned) {
        return this.fail_('QuoteService.validateVendorAssignment_', 'Vendor assignment does not exist for this lead/vendor pair.', {
          leadId: leadId,
          vendorId: vendorId,
          leadAssignedVendorId: leadAssignedVendorId,
          vendorAssignedLeadIds: assignedLeadIds
        });
      }

      return {
        success: true,
        message: 'Vendor assignment validated for quote creation.',
        data: {
          leadId: leadId,
          vendorId: vendorId,
          leadSideAssigned: leadSideAssigned,
          vendorSideAssigned: vendorSideAssigned
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.validateVendorAssignment_', error, { leadId: leadId, vendorId: vendorId });
      return { success: false, message: 'Failed to validate vendor assignment for quote creation.' };
    }
  },

  /**
   * FUNCTION: calculateQuoteAmount_
   * PURPOSE: Calculate MIDTS profit and final client quote amount using percentage markup.
   * INPUT: vendorCost (number), marginPercent (number)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs invalid inputs to Error Logs.
   */
  calculateQuoteAmount_: function (vendorCost, marginPercent) {
    // ===== MAIN LOGIC =====
    try {
      var cost = Number(vendorCost);
      var margin = Number(marginPercent);
      if (!isFinite(cost) || cost <= 0) {
        return this.fail_('QuoteService.calculateQuoteAmount_', 'vendorCost must be greater than zero.', { vendorCost: vendorCost, marginPercent: marginPercent });
      }
      if (!isFinite(margin) || margin < 0) {
        return this.fail_('QuoteService.calculateQuoteAmount_', 'marginPercent must be zero or greater.', { vendorCost: vendorCost, marginPercent: marginPercent });
      }

      // Percentage markup formula: Customer Price = Vendor Cost × (1 + Margin Percent / 100).
      var midtsProfitAmount = this.roundMoney_(cost * (margin / 100));
      var clientQuoteAmount = this.roundMoney_(cost + midtsProfitAmount);

      return {
        success: true,
        message: 'Quote amount calculated successfully.',
        data: {
          vendorCost: this.roundMoney_(cost),
          marginPercent: margin,
          midtsProfitAmount: midtsProfitAmount,
          clientQuoteAmount: clientQuoteAmount
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.calculateQuoteAmount_', error, { vendorCost: vendorCost, marginPercent: marginPercent });
      return { success: false, message: 'Failed to calculate quote amount.' };
    }
  },

  /**
   * FUNCTION: appendQuoteRow_
   * PURPOSE: Append one quote row using current Quotes headers without overwriting existing records.
   * INPUT: quote (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Quotes sheet.
   */
  appendQuoteRow_: function (quote) {
    // ===== MAIN LOGIC =====
    try {
      var ensureResult = DatabaseService.ensureQuotesSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return this.fail_('QuoteService.appendQuoteRow_', 'Quotes sheet not found.', { quote: quote });
      }

      var columns = this.getHeaderMap_(sheet);
      var row = new Array(sheet.getLastColumn()).fill('');
      this.setField_(row, columns, 'Quote ID', quote.quoteId);
      this.setField_(row, columns, 'Lead ID', quote.leadId);
      this.setField_(row, columns, 'Vendor ID', quote.vendorId);
      this.setField_(row, columns, 'Vendor Pricing ID', quote.vendorPricingId);
      this.setField_(row, columns, 'Created At', new Date());
      this.setField_(row, columns, 'Quote Status', quote.quoteStatus);
      this.setField_(row, columns, 'Vendor Cost', quote.vendorCost);
      this.setField_(row, columns, 'Margin Percent', quote.marginPercent);
      this.setField_(row, columns, 'MIDTS Profit Amount', quote.midtsProfitAmount);
      this.setField_(row, columns, 'Client Quote Amount', quote.clientQuoteAmount);
      this.setField_(row, columns, 'Amount', quote.amount);
      this.setField_(row, columns, 'Currency', quote.currency);
      this.setField_(row, columns, 'Valid Until', quote.validUntil);
      this.setField_(row, columns, 'Notes', quote.notes);
      this.setField_(row, columns, 'Created From', quote.createdFrom);

      sheet.appendRow(row);
      return {
        success: true,
        message: 'Quote row appended successfully.',
        data: { quoteId: quote.quoteId, rowNumber: sheet.getLastRow() }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.appendQuoteRow_', error, { quote: quote });
      return { success: false, message: 'Failed to append quote row.' };
    }
  },

  /**
   * FUNCTION: ensureQuoteWorkflowStructure_
   * PURPOSE: Ensure quote workflow dependencies are present before validation and append-only writes.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create sheets and append missing headers only.
   */
  ensureQuoteWorkflowStructure_: function () {
    // ===== MAIN LOGIC =====
    try {
      var quotesResult = DatabaseService.ensureQuotesSheetStructure();
      if (!quotesResult.success) {
        return quotesResult;
      }
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }
      var vendorsResult = DatabaseService.ensureVendorsSheetStructure();
      if (!vendorsResult.success) {
        return vendorsResult;
      }
      return { success: true, message: 'Quote workflow sheet structure verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('QuoteService.ensureQuoteWorkflowStructure_', error);
      return { success: false, message: 'Failed to verify quote workflow structure.' };
    }
  },

  /**
   * FUNCTION: normalizeInitialQuoteStatus_
   * PURPOSE: Allow only Draft or Sent at quote creation time.
   * INPUT: status (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs invalid status to Error Logs.
   */
  normalizeInitialQuoteStatus_: function (status) {
    // ===== MAIN LOGIC =====
    var quoteStatus = String(status || this.QUOTE_STATUS_DRAFT).trim();
    if (quoteStatus !== this.QUOTE_STATUS_DRAFT && quoteStatus !== this.QUOTE_STATUS_SENT) {
      return this.fail_('QuoteService.normalizeInitialQuoteStatus_', 'Quote status must be Draft or Sent at creation.', { requestedStatus: quoteStatus });
    }
    return { success: true, message: 'Quote status validated.', data: { quoteStatus: quoteStatus } };
  },

  /**
   * FUNCTION: getAllowedQuoteStatuses_
   * PURPOSE: Return controlled quote lifecycle statuses.
   * INPUT: none
   * OUTPUT: string[]
   * SIDE EFFECTS: none
   */
  getAllowedQuoteStatuses_: function () {
    // ===== MAIN LOGIC =====
    return [this.QUOTE_STATUS_DRAFT, this.QUOTE_STATUS_SENT, this.QUOTE_STATUS_ACCEPTED, this.QUOTE_STATUS_REJECTED, this.QUOTE_STATUS_EXPIRED];
  },

  /**
   * FUNCTION: buildQuoteSnapshotFromRow_
   * PURPOSE: Convert a Quotes row into a stable object with legacy and new quote fields.
   * INPUT: row (array), columns (object), rowNumber (number)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  buildQuoteSnapshotFromRow_: function (row, columns, rowNumber) {
    // ===== MAIN LOGIC =====
    var amount = Number(this.getField_(row, columns, 'Amount') || this.getField_(row, columns, 'Client Quote Amount') || 0);
    var clientQuoteAmount = Number(this.getField_(row, columns, 'Client Quote Amount') || amount || 0);
    return {
      quoteId: String(this.getField_(row, columns, 'Quote ID') || '').trim(),
      leadId: String(this.getField_(row, columns, 'Lead ID') || '').trim(),
      vendorId: String(this.getField_(row, columns, 'Vendor ID') || '').trim(),
      vendorPricingId: String(this.getField_(row, columns, 'Vendor Pricing ID') || '').trim(),
      createdAt: this.getField_(row, columns, 'Created At'),
      quoteStatus: String(this.getField_(row, columns, 'Quote Status') || '').trim(),
      vendorCost: Number(this.getField_(row, columns, 'Vendor Cost') || 0),
      marginPercent: Number(this.getField_(row, columns, 'Margin Percent') || 0),
      midtsProfitAmount: Number(this.getField_(row, columns, 'MIDTS Profit Amount') || 0),
      clientQuoteAmount: clientQuoteAmount,
      amount: amount,
      currency: String(this.getField_(row, columns, 'Currency') || '').trim(),
      validUntil: this.getField_(row, columns, 'Valid Until'),
      notes: String(this.getField_(row, columns, 'Notes') || '').trim(),
      createdFrom: String(this.getField_(row, columns, 'Created From') || '').trim(),
      rowNumber: rowNumber
    };
  },

  /**
   * FUNCTION: getQuoteColumnMap_
   * PURPOSE: Resolve Quotes headers into named 1-based indices required by quote reads/writes.
   * INPUT: sheet (Google Sheet object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  getQuoteColumnMap_: function (sheet) {
    // ===== MAIN LOGIC =====
    var map = this.getHeaderMap_(sheet);
    return {
      quoteId: map['Quote ID'],
      leadId: map['Lead ID'],
      vendorId: map['Vendor ID'],
      vendorPricingId: map['Vendor Pricing ID'],
      createdAt: map['Created At'],
      quoteStatus: map['Quote Status'],
      vendorCost: map['Vendor Cost'],
      marginPercent: map['Margin Percent'],
      midtsProfitAmount: map['MIDTS Profit Amount'],
      clientQuoteAmount: map['Client Quote Amount'],
      amount: map.Amount,
      currency: map.Currency,
      validUntil: map['Valid Until'],
      notes: map.Notes,
      createdFrom: map['Created From']
    };
  },

  /**
   * FUNCTION: getHeaderMap_
   * PURPOSE: Resolve arbitrary sheet headers into 1-based column numbers.
   * INPUT: sheet (Google Sheet object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  getHeaderMap_: function (sheet) {
    // ===== MAIN LOGIC =====
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    headers.forEach(function (header, index) {
      var name = String(header || '').trim();
      if (name) {
        map[name] = index + 1;
      }
    });
    return map;
  },

  /**
   * FUNCTION: getField_
   * PURPOSE: Safely read a row value by header name.
   * INPUT: row (array), columns (object), header (string)
   * OUTPUT: any
   * SIDE EFFECTS: none
   */
  getField_: function (row, columns, header) {
    // ===== MAIN LOGIC =====
    var column = columns[header] || 0;
    return column ? row[column - 1] : '';
  },

  /**
   * FUNCTION: setField_
   * PURPOSE: Safely write a row value by header name when that header exists.
   * INPUT: row (array), columns (object), header (string), value (any)
   * OUTPUT: none
   * SIDE EFFECTS: Mutates row array before append.
   */
  setField_: function (row, columns, header, value) {
    // ===== MAIN LOGIC =====
    var column = columns[header] || 0;
    if (column) {
      row[column - 1] = value;
    }
  },

  /**
   * FUNCTION: roundMoney_
   * PURPOSE: Round monetary values to two decimals for quote storage and email display.
   * INPUT: amount (number)
   * OUTPUT: number
   * SIDE EFFECTS: none
   */
  roundMoney_: function (amount) {
    // ===== MAIN LOGIC =====
    return Math.round(Number(amount || 0) * 100) / 100;
  },

  /**
   * FUNCTION: fail_
   * PURPOSE: Return a structured failure and log it to Error Logs for auditability.
   * INPUT: functionName (string), message (string), context (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Error Logs row.
   */
  fail_: function (functionName, message, context) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_(functionName, new Error(message), context || {});
    return { success: false, message: message, data: context || {} };
  }
};

/**
 * FUNCTION: runStage5QuoteCreationFromVendorPricingSetupValidation
 * PURPOSE: Verify quote workflow sheets and headers exist before creating quotes.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create sheets and append missing headers only.
 */
function runStage5QuoteCreationFromVendorPricingSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    return QuoteService.ensureQuoteWorkflowStructure_();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage5QuoteCreationFromVendorPricingSetupValidation', error);
    return { success: false, message: 'Quote creation setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage5QuoteCreationFromVendorPricingDryRunTest
 * PURPOSE: Verify invalid pricing fails and valid vendor pricing creates a linked Draft quote without sending email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test Leads, Vendors, Vendor Pricing, Quotes, and Error Logs rows.
 */
function runStage5QuoteCreationFromVendorPricingDryRunTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = QuoteService.ensureQuoteWorkflowStructure_();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage5 Quote Vendor Pricing Lead',
      email: 'stage5-quote-vendor-pricing@example.com',
      company: 'MIDTS Stage5 Quote Test',
      projectType: 'CAD/CAM',
      source: 'Stage5QuoteCreationDryRun',
      notes: 'Dry-run lead for quote creation from vendor pricing.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 93);
    if (!qualify.success) {
      return qualify;
    }

    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    var vendorId = UtilsService.createSequentialId_('VENDOR');
    vendorSheet.appendRow([vendorId, 'Stage5 Quote Eligible Vendor', 'stage5-quote-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var assignment = VendorAssignmentService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var invalidCost = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 0,
      marginPercent: 25,
      currency: 'GBP',
      notes: 'Invalid cost should fail.'
    });

    var invalidMargin = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      marginPercent: -1,
      currency: 'GBP',
      notes: 'Invalid margin should fail.'
    });

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      marginPercent: 25,
      currency: 'GBP',
      quoteStatus: 'Draft',
      sendEmail: false,
      notes: 'Valid direct vendor pricing quote should be saved as Draft.'
    });

    var expectedAmount = 1250;
    var pass = invalidCost.success === false &&
      invalidMargin.success === false &&
      quote.success === true &&
      quote.data.quoteId &&
      quote.data.leadId === lead.data.leadId &&
      quote.data.vendorId === vendorId &&
      quote.data.clientQuoteAmount === expectedAmount &&
      quote.data.quoteStatus === 'Draft';

    return {
      success: pass,
      message: pass ? 'Quote creation from vendor pricing dry-run test passed.' : 'Quote creation from vendor pricing dry-run test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        invalidCost: invalidCost,
        invalidMargin: invalidMargin,
        quote: quote,
        expectedAmount: expectedAmount
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage5QuoteCreationFromVendorPricingDryRunTest', error);
    return { success: false, message: 'Quote creation from vendor pricing dry-run test failed unexpectedly.' };
  }
}
