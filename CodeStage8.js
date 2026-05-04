/**
 * MIDTS Automation Engine
 * STAGE: 8 (Slack alert runner functions)
 * WHAT THIS FILE DOES:
 * - Provides top-level Apps Script runner functions for Stage 8 verification.
 * DEPENDENCIES:
 * - Uses Slack webhook from Settings sheet: SLACK_WEBHOOK_URL
 * - Uses Google Sheet tab: Slack Logs
 * - SlackService (SlackService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage8SlackSetupValidation
 * PURPOSE: Verify Stage 8 Slack Logs sheet setup without sending a Slack alert.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Slack Logs sheet and append missing headers only.
 */
function runStage8SlackSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var slackLogs = SlackService.ensureSlackLogsSheetStructure();
    if (!slackLogs.success) {
      return slackLogs;
    }

    return {
      success: true,
      message: 'Stage 8 Slack setup validation completed.',
      data: { slackLogs: slackLogs }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage8SlackSetupValidation', error);
    return { success: false, message: 'Stage 8 Slack setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage8SlackAlertTest
 * PURPOSE: Send one controlled Slack test alert and log the result.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Sends one external Slack webhook request and appends one Slack Logs row.
 */
function runStage8SlackAlertTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = runStage8SlackSetupValidation();
    if (!setup.success) {
      return setup;
    }

    var sendResult = SlackService.sendStage8TestAlert();

    return {
      success: sendResult.success,
      message: sendResult.success ? 'Stage 8 Slack alert test passed.' : 'Stage 8 Slack alert test failed.',
      data: { setup: setup, sendResult: sendResult }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage8SlackAlertTest', error);
    return { success: false, message: 'Stage 8 Slack alert test failed unexpectedly.' };
  }
}
