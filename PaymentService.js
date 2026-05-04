/**
 * MIDTS Automation Engine
 * STAGE: 5 (Payment tracking for accepted quotes)
 * WHAT THIS FILE DOES:
 * - Creates and updates payment records linked to accepted quotes.
 * - Provides Stage 5 setup and workflow test functions.
 * DEPENDENCIES:
 * - Google Sheets tab: Payments
 * - Google Sheets tab: Quotes
 * - QuoteService (QuoteService.gs)
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var PaymentService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Payments
  PAYMENTS_SHEET_NAME: 'Payments',

  /**
   * FUNCTION: ensurePaymentsSheetStructure
   * PURPOSE: Ensure Payments sheet exists with fixed headers for Stage 5 payment tracking.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Payments sheet if missing; appends missing headers only.
   */
  ensurePaymentsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Fixed headers preserve predictable payment records and reporting.
      var requiredHeaders = ['Payment ID', 'Quote ID', 'Lead ID', 'Created At', 'Payment Status', 'Amount Due', 'Amount Paid', 'Currency', 'Payment Method', 'Paid At', 'Notes'];
      return DatabaseService.ensureSheetAndHeaders_(this.PAYMENTS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.ensurePaymentsSheetStructure', error);
      return { success: false, message: 'Failed to verify Payments sheet structure.' };
    }
  },

  /**
   * FUNCTION: createPaymentForQuote
   * PURPOSE: Create a payment tracking row only when a quote has been accepted.
   * INPUT: payload (object: quoteId, amountDue, currency, paymentMethod, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one payment row to Payments sheet when validation passes.
   */
  createPaymentForQuote: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var quoteId = String(input.quoteId || '').trim();
      var amountDue = Number(input.amountDue || 0);
      var currency = String(input.currency || 'GBP').trim();
      var paymentMethod = String(input.paymentMethod || 'Manual').trim();
      var notes = String(input.notes || '').trim();

      if (!quoteId) {
        return { success: false, message: 'quoteId is required.' };
      }

      if (amountDue <= 0) {
        return { success: false, message: 'amountDue must be greater than zero.' };
      }

      var ensureResult = this.ensurePaymentsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var quoteResult = this.getAcceptedQuoteSnapshot_(quoteId);
      if (!quoteResult.success) {
        return quoteResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(this.PAYMENTS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Payments sheet not found.' };
      }

      // Uses unique ID prefix PAY- for payment entities in Stage 5.
      var paymentId = UtilsService.createPrefixedId_('PAY-');
      sheet.appendRow([
        paymentId,
        quoteId,
        quoteResult.data.leadId,
        new Date(),
        'Pending',
        amountDue,
        0,
        currency,
        paymentMethod,
        '',
        notes
      ]);

      return {
        success: true,
        message: 'Payment record created successfully.',
        data: { paymentId: paymentId, quoteId: quoteId, leadId: quoteResult.data.leadId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.createPaymentForQuote', error, { payload: payload });
      return { success: false, message: 'Failed to create payment record.' };
    }
  },

  /**
   * FUNCTION: markPaymentPaid
   * PURPOSE: Mark a payment row as paid after validating payment amount.
   * INPUT: paymentId (string), amountPaid (number), paymentMethod (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one payment row in Payments sheet.
   */
  markPaymentPaid: function (paymentId, amountPaid, paymentMethod) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(paymentId || '').trim();
      var paidAmount = Number(amountPaid || 0);
      var method = String(paymentMethod || '').trim();

      if (!id) {
        return { success: false, message: 'paymentId is required.' };
      }

      if (paidAmount <= 0) {
        return { success: false, message: 'amountPaid must be greater than zero.' };
      }

      var ensureResult = this.ensurePaymentsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(this.PAYMENTS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Payments sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === id) {
          var amountDue = Number(values[i][5] || 0);
          var currentStatus = String(values[i][4] || '').trim();

          if (currentStatus === 'Paid') {
            return { success: false, message: 'Payment is already marked as paid.', data: { paymentId: id } };
          }

          // Payment is complete only when paid amount covers the full amount due.
          var newStatus = paidAmount >= amountDue ? 'Paid' : 'Part Paid';
          sheet.getRange(i + 1, 5).setValue(newStatus);
          sheet.getRange(i + 1, 7).setValue(paidAmount);
          if (method) {
            sheet.getRange(i + 1, 9).setValue(method);
          }
          if (newStatus === 'Paid') {
            sheet.getRange(i + 1, 10).setValue(new Date());
          }

          return {
            success: true,
            message: 'Payment status updated successfully.',
            data: { paymentId: id, paymentStatus: newStatus, amountDue: amountDue, amountPaid: paidAmount }
          };
        }
      }

      return { success: false, message: 'Payment not found for provided paymentId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.markPaymentPaid', error, { paymentId: paymentId, amountPaid: amountPaid });
      return { success: false, message: 'Failed to mark payment as paid.' };
    }
  },

  /**
   * FUNCTION: getAcceptedQuoteSnapshot_
   * PURPOSE: Internal helper to verify a quote exists and is accepted before payment tracking begins.
   * INPUT: quoteId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getAcceptedQuoteSnapshot_: function (quoteId) {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.QUOTES_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Quotes sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(quoteId).trim()) {
          var leadId = String(values[i][1] || '').trim();
          var quoteStatus = String(values[i][3] || '').trim();
          var amount = Number(values[i][4] || 0);
          var currency = String(values[i][5] || '').trim();

          // Payments are tracked only after the client has accepted the quote.
          if (quoteStatus !== 'Accepted') {
            return {
              success: false,
              message: 'Quote must be accepted before payment tracking can start.',
              data: { quoteId: quoteId, quoteStatus: quoteStatus }
            };
          }

          return {
            success: true,
            message: 'Accepted quote verified.',
            data: { quoteId: quoteId, leadId: leadId, amount: amount, currency: currency }
          };
        }
      }

      return { success: false, message: 'Quote not found for provided quoteId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.getAcceptedQuoteSnapshot_', error, { quoteId: quoteId });
      return { success: false, message: 'Failed to verify accepted quote.' };
    }
  }
};

/**
 * FUNCTION: runStage5PaymentSetupValidation
 * PURPOSE: Verify Stage 5 setup by creating/validating Payments sheet structure only.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Payments sheet and append missing headers only.
 */
function runStage5PaymentSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var result = PaymentService.ensurePaymentsSheetStructure();
    return {
      success: result.success,
      message: result.success ? 'Stage 5 payment setup validation completed.' : 'Stage 5 payment setup validation failed.',
      data: { paymentsSheetValidation: result }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage5PaymentSetupValidation', error);
    return { success: false, message: 'Stage 5 payment setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage5PaymentTrackingTest
 * PURPOSE: Verify payment tracking blocks non-accepted quotes and records paid status for accepted quotes.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends lead, quote, and payment test rows; updates one payment row.
 */
function runStage5PaymentTrackingTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = runStage5PaymentSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage5 Payment Lead',
      email: 'stage5-payment@example.com',
      company: 'MIDTS Payment Test',
      projectType: 'CAD/CAM',
      source: 'Stage5PaymentTest',
      notes: 'Payment tracking test lead.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 91);
    if (!qualify.success) {
      return qualify;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      amount: 1800,
      currency: 'GBP',
      validUntil: '',
      notes: 'Payment tracking quote.'
    });
    if (!quote.success) {
      return quote;
    }

    var blockedPayment = PaymentService.createPaymentForQuote({
      quoteId: quote.data.quoteId,
      amountDue: 1800,
      currency: 'GBP',
      paymentMethod: 'Bank Transfer',
      notes: 'Should be blocked until quote is accepted.'
    });

    var sent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!sent.success) {
      return sent;
    }

    var accepted = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Accepted');
    if (!accepted.success) {
      return accepted;
    }

    var payment = PaymentService.createPaymentForQuote({
      quoteId: quote.data.quoteId,
      amountDue: 1800,
      currency: 'GBP',
      paymentMethod: 'Bank Transfer',
      notes: 'Stage 5 accepted quote payment.'
    });
    if (!payment.success) {
      return payment;
    }

    var paid = PaymentService.markPaymentPaid(payment.data.paymentId, 1800, 'Bank Transfer');

    var pass = blockedPayment.success === false && paid.success && paid.data.paymentStatus === 'Paid';

    return {
      success: pass,
      message: pass ? 'Stage 5 payment tracking test passed.' : 'Stage 5 payment tracking test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        quote: quote,
        blockedPayment: blockedPayment,
        quoteSent: sent,
        quoteAccepted: accepted,
        payment: payment,
        paid: paid
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage5PaymentTrackingTest', error);
    return { success: false, message: 'Stage 5 payment tracking test failed unexpectedly.' };
  }
}
