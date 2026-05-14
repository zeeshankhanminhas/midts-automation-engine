/**
 * MIDTS Automation Engine
 * STAGE: 10 (Website form webhook entry point)
 * WHAT THIS FILE DOES:
 * - Exposes doPost(e) for public website lead submissions.
 * - Routes Step 1 lead intake and Step 2 technical requirement submissions.
 * - Returns JSON responses for website/webhook clients.
 * - Provides Stage 10/11 setup and payload tests.
 * DEPENDENCIES:
 * - Apps Script Web App deployment
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - Step2RequirementService (Step2RequirementService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: doPost
 * PURPOSE: Receive one website form submission and route it to Step 1 lead intake or Step 2 requirement intake.
 * INPUT: e (Apps Script POST event object)
 * OUTPUT: TextOutput JSON
 * SIDE EFFECTS: May append/update lead rows and write webhook audit rows.
 */
function doPost(e) {
  // ===== MAIN LOGIC =====
  try {
    Logger.log('doPost received website webhook request.');
    var routeResult = routeWebsiteWebhookPost_(e);
    var result = routeResult.result;
    var emailResult = routeResult.isStep2 ? null : sendWebsiteLeadAcknowledgement_(e, result);
    if (emailResult) {
      result.data = result.data || {};
      result.data.emailNotification = emailResult;
      result.message = emailResult.success
        ? 'Website lead created successfully and acknowledgement email sent.'
        : 'Website lead created successfully, but acknowledgement email was not sent.';
    }

    Logger.log('doPost website webhook result: ' + JSON.stringify({
      success: result && result.success,
      message: result && result.message,
      leadId: result && result.data ? result.data.leadId : '',
      route: routeResult.isStep2 ? 'step2' : 'step1',
      emailNotification: result && result.data ? result.data.emailNotification : null
    }));
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
 * FUNCTION: routeWebsiteWebhookPost_
 * PURPOSE: Internal helper to route public website posts by explicit form stage.
 * INPUT: e (Apps Script POST event object)
 * OUTPUT: { isStep2: boolean, result: object }
 * SIDE EFFECTS: Downstream handler performs writes.
 */
function routeWebsiteWebhookPost_(e) {
  // ===== MAIN LOGIC =====
  var payloadResult = WebsiteWebhookService.parsePostEvent_(e);
  if (payloadResult.success && Step2RequirementService.isStep2Payload(payloadResult.data.payload || {})) {
    return { isStep2: true, result: Step2RequirementService.handlePostEvent(e) };
  }
  return { isStep2: false, result: WebsiteWebhookService.handlePostEvent(e) };
}

/**
 * FUNCTION: sendWebsiteLeadAcknowledgement_
 * PURPOSE: Internal helper to send the Stage 7 lead acknowledgement after a successful website lead.
 * INPUT: e (Apps Script POST event object), webhookResult (object)
 * OUTPUT: { success: boolean, message: string, data?: object }|null
 * SIDE EFFECTS: May send one Brevo email and appends one Website Webhook Logs row for email status.
 */
function sendWebsiteLeadAcknowledgement_(e, webhookResult) {
  // ===== MAIN LOGIC =====
  try {
    if (!webhookResult || !webhookResult.success || !webhookResult.data || !webhookResult.data.leadId) {
      return null;
    }

    var payloadResult = WebsiteWebhookService.parsePostEvent_(e);
    if (!payloadResult.success) {
      return {
        success: false,
        message: 'Lead was created, but email payload could not be parsed.',
        data: { parseResult: payloadResult }
      };
    }

    var payload = payloadResult.data.payload || {};
    var email = WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(payload, ['email', 'work_email', 'emailAddress', 'email_address']));
    var fullName = WebsiteWebhookService.cleanText_(WebsiteWebhookService.getField_(payload, ['fullName', 'full_name', 'name', 'yourName']));
    var emailResult = EmailService.sendLeadReceivedEmail({
      email: email,
      fullName: fullName,
      leadId: webhookResult.data.leadId
    });

    var auditResult = {
      success: emailResult.success,
      message: emailResult.message,
      data: {
        leadId: webhookResult.data.leadId,
        emailNotification: {
          success: emailResult.success,
          message: emailResult.message,
          data: emailResult.data || {}
        }
      }
    };
    WebsiteWebhookService.logWebhookAttempt_('Lead acknowledgement email', auditResult, payload);
    return auditResult.data.emailNotification;
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('sendWebsiteLeadAcknowledgement_', error);
    return { success: false, message: 'Failed to send website lead acknowledgement email.' };
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
 * FUNCTION: runStage10WebsiteWebhookLogSetupTest
 * PURPOSE: Force-create and verify the Website Webhook Logs sheet for deployment debugging.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Website Webhook Logs sheet headers.
 */
function runStage10WebsiteWebhookLogSetupTest() {
  // ===== MAIN LOGIC =====
  try {
    var setupResult = WebsiteWebhookService.ensureWebhookLogSheet_();
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNames = spreadsheet.getSheets().map(function (sheet) {
      return sheet.getName();
    });
    var hasWebhookLogSheet = sheetNames.indexOf(WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME) !== -1;

    return {
      success: setupResult.success && hasWebhookLogSheet,
      message: hasWebhookLogSheet ? 'Website webhook log sheet exists.' : 'Website webhook log sheet was not found after setup.',
      data: {
        setupResult: setupResult,
        spreadsheetName: spreadsheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        expectedSheetName: WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME,
        hasWebhookLogSheet: hasWebhookLogSheet,
        sheetNames: sheetNames
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage10WebsiteWebhookLogSetupTest', error);
    return {
      success: false,
      message: 'Failed to create or verify Website Webhook Logs sheet.',
      data: { errorMessage: error && error.message ? error.message : String(error) }
    };
  }
}

/**
 * FUNCTION: runStage11Step2RequirementSetupTest
 * PURPOSE: Verify Step 2 requirement webhook dependencies are configured before going live.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Leads and Step 2 Requirement Logs headers.
 */
function runStage11Step2RequirementSetupTest() {
  // ===== MAIN LOGIC =====
  try {
    return Step2RequirementService.ensureStep2RequirementSetup();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage11Step2RequirementSetupTest', error);
    return { success: false, message: 'Stage 11 Step 2 requirement setup test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage11Step2RequirementPayloadTest
 * PURPOSE: Verify Step 2 technical requirement payload updates an existing lead and writes an audit row.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one lead row, then updates it as Step 2 completed and qualified.
 */
function runStage11Step2RequirementPayloadTest() {
  // ===== MAIN LOGIC =====
  try {
    var createResult = LeadService.createLead({
      fullName: 'Stage 11 Step 2 Test Lead',
      email: 'stage11-step2@example.com',
      company: 'MIDTS Step 2 Test',
      projectType: 'Website CAD Enquiry',
      source: 'Stage11Step2Test',
      notes: 'Created by runStage11Step2RequirementPayloadTest.'
    });
    if (!createResult.success) {
      return createResult;
    }

    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    var submittedToken = tokenResult.success ? tokenResult.data.value : '';
    var fakeEvent = {
      parameter: {},
      postData: {
        type: 'application/json',
        contents: JSON.stringify({
          formStage: 'step2',
          webhookToken: submittedToken,
          leadId: createResult.data.leadId,
          email: 'stage11-step2@example.com',
          projectType: 'Website CAD Enquiry',
          timelineUrgency: 'Urgent: 24-72 hours',
          filesDrawingsReady: 'Yes, files are ready',
          requirementComplexity: 'CAM / manufacturing support',
          budget: 'Budget approved',
          technicalRequirement: 'Detailed technical requirement for a manufacturing-ready CAD/CAM support request with enough information to qualify the lead.'
        })
      }
    };

    var result = Step2RequirementService.handlePostEvent(fakeEvent);
    return {
      success: result.success,
      message: result.success ? 'Stage 11 Step 2 requirement payload test passed.' : 'Stage 11 Step 2 requirement payload test failed.',
      data: { leadCreation: createResult, tokenSetup: tokenResult, step2Result: result }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage11Step2RequirementPayloadTest', error);
    return { success: false, message: 'Stage 11 Step 2 requirement payload test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage10WebsiteWebhookPayloadTest
 * PURPOSE: Verify the website webhook payload path creates a lead or logs the exact setup failure.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one webhook audit row; appends one test lead row when WEBSITE_WEBHOOK_TOKEN is configured.
 */
function runStage10WebsiteWebhookPayloadTest() {
  // ===== MAIN LOGIC =====
  try {
    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    var submittedToken = tokenResult.success ? tokenResult.data.value : '';
    var runStamp = String(new Date().getTime());
    var testEmail = 'stage10-website+' + runStamp + '@example.com';

    var fakeEvent = {
      parameter: {},
      postData: {
        type: 'application/json',
        contents: JSON.stringify({
          webhookToken: submittedToken,
          fullName: 'Stage 10 Website Lead ' + runStamp,
          email: testEmail,
          company: 'MIDTS Website Test',
          projectType: 'Website CAD Enquiry',
          source: 'Stage10WebhookTest',
          pageUrl: 'stage10-payload-test',
          message: 'Created by runStage10WebsiteWebhookPayloadTest.'
        })
      }
    };

    var result = WebsiteWebhookService.handlePostEvent(fakeEvent);
    var emailResult = sendWebsiteLeadAcknowledgement_(fakeEvent, result);
    if (emailResult) {
      result.data = result.data || {};
      result.data.emailNotification = emailResult;
    }

    return {
      success: result.success,
      message: result.success ? 'Stage 10 website webhook payload test passed.' : 'Stage 10 website webhook payload test failed.',
      data: { tokenSetup: tokenResult, webhookResult: result, testEmail: testEmail }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage10WebsiteWebhookPayloadTest', error);
    return { success: false, message: 'Stage 10 website webhook payload test failed unexpectedly.' };
  }
}
