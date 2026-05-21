/**
 * MIDTS Automation Engine
 * STAGE: 2.3 (Controlled Step 2 reminder email proof)
 * WHAT THIS FILE DOES:
 * - Provides a manual runner that proves one due lead sends exactly one Step 2 reminder.
 * - Does not create a time trigger.
 * DEPENDENCIES:
 * - LeadService (LeadService.js)
 * - EmailService (EmailService.js)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage2ReminderEmailSingleSendTest
 * PURPOSE: Prove that a due lead sends one 2h reminder email and duplicate sends are blocked.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one test lead row, backdates its Created At, sends one Brevo email to TEST_EMAIL_RECIPIENT, appends one Email Logs row, and stamps the 2h reminder fields.
 */
function runStage2ReminderEmailSingleSendTest() {
  // ===== MAIN LOGIC =====
  try {
    var emailLogsResult = EmailService.ensureEmailLogsSheetStructure();
    if (!emailLogsResult.success) {
      return emailLogsResult;
    }

    var recipientResult = EmailService.getSettingValue_(EmailService.TEST_EMAIL_RECIPIENT_KEY);
    if (!recipientResult.success) {
      return recipientResult;
    }

    var createResult = LeadService.createLead({
      fullName: 'Stage 2 Reminder Email Test',
      email: recipientResult.data.value,
      company: 'MIDTS Reminder Email Test',
      projectType: 'CAD/CAM',
      source: 'Stage2ReminderEmailSingleSendTest',
      notes: 'Created by runStage2ReminderEmailSingleSendTest. Sends one controlled Step 2 reminder email.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var leadsSheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
    if (!leadsSheet) {
      return { success: false, message: 'Leads sheet not found.' };
    }

    var emailLogsSheet = spreadsheet.getSheetByName(EmailService.EMAIL_LOGS_SHEET_NAME);
    if (!emailLogsSheet) {
      return { success: false, message: 'Email Logs sheet not found.' };
    }

    var leadRowNumber = null;
    var leadValues = leadsSheet.getDataRange().getValues();
    for (var i = 1; i < leadValues.length; i++) {
      if (String(leadValues[i][0] || '').trim() === String(createResult.data.leadId).trim()) {
        leadRowNumber = i + 1;
        break;
      }
    }

    if (!leadRowNumber) {
      return { success: false, message: 'Test lead row not found after creation.' };
    }

    // Backdate Created At by 3 hours so the 2h reminder is due during this manual test.
    leadsSheet.getRange(leadRowNumber, 2).setValue(new Date(new Date().getTime() - (3 * 60 * 60 * 1000)));

    var emailLogRowsBefore = emailLogsSheet.getLastRow();
    var firstSend = LeadService.sendStep2ReminderForLead(createResult.data.leadId, '2h');
    var secondSend = LeadService.sendStep2ReminderForLead(createResult.data.leadId, '2h');
    var emailLogRowsAfter = emailLogsSheet.getLastRow();

    var updatedRow = leadsSheet.getRange(leadRowNumber, 1, 1, 20).getValues()[0];
    var assertions = {
      firstSendSucceeded: firstSend.success === true,
      duplicateSendBlocked: secondSend.success === false && secondSend.data && secondSend.data.reason === 'ALREADY_SENT',
      exactlyOneEmailLogCreated: (emailLogRowsAfter - emailLogRowsBefore) === 1,
      reminder2hStamped: updatedRow[14] instanceof Date,
      reminder24hBlank: String(updatedRow[15] || '') === '',
      reminder72hBlank: String(updatedRow[16] || '') === '',
      lastReminderStageStamped: String(updatedRow[17] || '') === '2h Sent',
      reminderStatusStamped: String(updatedRow[19] || '') === 'Reminder 2h Sent'
    };

    var failedChecks = [];
    Object.keys(assertions).forEach(function (key) {
      if (!assertions[key]) {
        failedChecks.push(key);
      }
    });

    var pass = failedChecks.length === 0;
    return {
      success: pass,
      message: pass ? 'Stage 2 reminder email single-send test passed.' : 'Stage 2 reminder email single-send test failed.',
      data: {
        leadId: createResult.data.leadId,
        reminderStage: '2h',
        emailLogRowsBefore: emailLogRowsBefore,
        emailLogRowsAfter: emailLogRowsAfter,
        firstSend: firstSend,
        secondSend: secondSend,
        assertions: assertions,
        failedChecks: failedChecks,
        note: 'No time trigger is created by this runner.'
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage2ReminderEmailSingleSendTest', error);
    return { success: false, message: 'Stage 2 reminder email single-send test failed unexpectedly.' };
  }
}
