/**
 * MIDTS Automation Engine
 * STAGE: 7 (Brevo email runner functions)
 * WHAT THIS FILE DOES:
 * - Provides top-level Apps Script runner functions for Stage 7 verification.
 * DEPENDENCIES:
 * - Uses Brevo API key from Settings sheet: BREVO_API_KEY
 * - Uses Google Sheet tab: Email Logs
 * - TEST_EMAIL_RECIPIENT, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME settings
 * - EmailService (EmailService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage7EmailSetupValidation
 * PURPOSE: Verify Stage 7 Email Logs sheet setup without sending email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Email Logs sheet and append missing headers only.
 */
function runStage7EmailSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var emailLogs = EmailService.ensureEmailLogsSheetStructure();
    if (!emailLogs.success) {
      return emailLogs;
    }

    return {
      success: true,
      message: 'Stage 7 email setup validation completed.',
      data: { emailLogs: emailLogs }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage7EmailSetupValidation', error);
    return { success: false, message: 'Stage 7 email setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage7BrevoEmailTest
 * PURPOSE: Send one controlled Brevo test email to TEST_EMAIL_RECIPIENT and log the result.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Sends one external Brevo email and appends one Email Logs row.
 */
function runStage7BrevoEmailTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = runStage7EmailSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var sendResult = EmailService.sendTestEmail();

    return {
      success: sendResult.success,
      message: sendResult.success ? 'Stage 7 Brevo email test passed.' : 'Stage 7 Brevo email test failed.',
      data: { setup: setup, sendResult: sendResult }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage7BrevoEmailTest', error);
    return { success: false, message: 'Stage 7 Brevo email test failed unexpectedly.' };
  }
}
