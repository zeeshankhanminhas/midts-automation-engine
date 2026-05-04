/**
 * MIDTS Automation Engine
 * STAGE: 5 (Payment tracking runner functions)
 * WHAT THIS FILE DOES:
 * - Provides top-level Apps Script runner functions for Stage 5 verification.
 * DEPENDENCIES:
 * - Google Sheets tab: Payments
 * - PaymentService (PaymentService.gs)
 * - LeadService (LeadService.gs)
 * - QuoteService (QuoteService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

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
