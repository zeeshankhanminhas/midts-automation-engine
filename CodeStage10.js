/**
 * MIDTS Automation Engine
 * STAGE: 10 (Website form webhook entry point)
 * WHAT THIS FILE DOES:
 * - Exposes doPost(e) for public website lead submissions.
 * - Returns JSON responses for website/webhook clients.
 * - Provides Stage 10 setup and payload tests.
 * DEPENDENCIES:
 * - Apps Script Web App deployment
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: doPost
 * PURPOSE: Receive one website form submission and create a lead through WebsiteWebhookService.
 * INPUT: e (Apps Script POST event object)
 * OUTPUT: TextOutput JSON
 * SIDE EFFECTS: May append one Leads row when validation passes.
 */
function doPost(e) {
  // ===== MAIN LOGIC =====
  try {
    var result = WebsiteWebhookService.handlePostEvent(e);
    return createWebsiteWebhookJsonResponse_(result);
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('doPost', error, { event: e });
    return createWebsiteWebhookJsonResponse_({
      success: false,
      message: 'Website webhook request failed unexpectedly.'
    });
  }
}

/**
 * FUNCTION: createWebsiteWebhookJsonResponse_
 * PURPOSE: Internal helper to return a consistent JSON webhook response.
 * INPUT: result (object)
 * OUTPUT: TextOutput JSON
 * SIDE EFFECTS: none
 */
function createWebsiteWebhookJsonResponse_(result) {
  // ===== MAIN LOGIC =====
  return ContentService
    .createTextOutput(JSON.stringify(result || { success: false, message: 'No result.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNCTION: runStage10WebsiteWebhookSetupValidation
 * PURPOSE: Verify website webhook dependencies are configured before going live.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Settings/Leads headers and append missing WEBSITE_WEBHOOK_TOKEN row.
 */
function runStage10WebsiteWebhookSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    return WebsiteWebhookService.ensureWebsiteWebhookSetup();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage10WebsiteWebhookSetupValidation', error);
    return { success: false, message: 'Stage 10 website webhook setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage10WebsiteWebhookPayloadTest
 * PURPOSE: Verify the website webhook payload path creates a lead using the configured token.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one test lead row when WEBSITE_WEBHOOK_TOKEN is configured.
 */
function runStage10WebsiteWebhookPayloadTest() {
  // ===== MAIN LOGIC =====
  try {
    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    if (!tokenResult.success) {
      return tokenResult;
    }

    var fakeEvent = {
      parameter: {},
      postData: {
        type: 'application/json',
        contents: JSON.stringify({
          webhookToken: tokenResult.data.value,
          fullName: 'Stage 10 Website Lead',
          email: 'stage10-website@example.com',
          company: 'MIDTS Website Test',
          projectType: 'Website CAD Enquiry',
          source: 'Stage10WebhookTest',
          message: 'Created by runStage10WebsiteWebhookPayloadTest.'
        })
      }
    };

    var result = WebsiteWebhookService.handlePostEvent(fakeEvent);
    return {
      success: result.success,
      message: result.success ? 'Stage 10 website webhook payload test passed.' : 'Stage 10 website webhook payload test failed.',
      data: { webhookResult: result }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage10WebsiteWebhookPayloadTest', error);
    return { success: false, message: 'Stage 10 website webhook payload test failed unexpectedly.' };
  }
}
