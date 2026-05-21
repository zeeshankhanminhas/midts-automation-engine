/**
 * MIDTS Automation Engine
 * STAGE: 2.4 (Controlled Step 2 reminder scheduler)
 * WHAT THIS FILE DOES:
 * - Provides the scheduled processor for Step 2 reminder emails.
 * - Provides manual install/remove/status functions for the time trigger.
 * - Provides a controlled filtered test runner that does not process live leads.
 * DEPENDENCIES:
 * - LeadService (LeadService.js)
 * - EmailService (EmailService.js)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 * - Apps Script services: SpreadsheetApp, ScriptApp, LockService
 */

var STAGE2_REMINDER_SCHEDULER_HANDLER = 'runStage2ReminderEmailScheduledProcessor';
var STAGE2_REMINDER_SCHEDULER_INTERVAL_HOURS = 1;
var STAGE2_REMINDER_SCHEDULER_MAX_SENDS_PER_RUN = 20;

/**
 * FUNCTION: runStage2ReminderEmailScheduledProcessor
 * PURPOSE: Scheduled-safe processor that sends due Step 2 reminder emails for active leads.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May send Brevo emails, append Email Logs rows, and stamp reminder fields in Leads sheet.
 */
function runStage2ReminderEmailScheduledProcessor() {
  return stage2ReminderEmailProcessDueLeads_({
    maxSends: STAGE2_REMINDER_SCHEDULER_MAX_SENDS_PER_RUN,
    sourceFilter: '',
    runMode: 'scheduled'
  });
}

/**
 * FUNCTION: installStage2ReminderEmailTrigger
 * PURPOSE: Manually install one hourly time trigger for the scheduled Step 2 reminder processor.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates one Apps Script time trigger if missing.
 */
function installStage2ReminderEmailTrigger() {
  // ===== MAIN LOGIC =====
  try {
    var statusBefore = getStage2ReminderEmailTriggerStatus();
    if (!statusBefore.success) {
      return statusBefore;
    }

    if (statusBefore.data.triggerCount > 0) {
      return {
        success: true,
        message: 'Stage 2 reminder email trigger already exists.',
        data: statusBefore.data
      };
    }

    var trigger = ScriptApp.newTrigger(STAGE2_REMINDER_SCHEDULER_HANDLER)
      .timeBased()
      .everyHours(STAGE2_REMINDER_SCHEDULER_INTERVAL_HOURS)
      .create();

    var statusAfter = getStage2ReminderEmailTriggerStatus();
    return {
      success: true,
      message: 'Stage 2 reminder email trigger installed successfully.',
      data: {
        handlerFunction: STAGE2_REMINDER_SCHEDULER_HANDLER,
        intervalHours: STAGE2_REMINDER_SCHEDULER_INTERVAL_HOURS,
        triggerUid: trigger.getUniqueId ? trigger.getUniqueId() : '',
        status: statusAfter.data
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('installStage2ReminderEmailTrigger', error);
    return { success: false, message: 'Failed to install Stage 2 reminder email trigger.' };
  }
}

/**
 * FUNCTION: removeStage2ReminderEmailTriggers
 * PURPOSE: Remove all time triggers that call the scheduled Step 2 reminder processor.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Deletes matching Apps Script triggers only.
 */
function removeStage2ReminderEmailTriggers() {
  // ===== MAIN LOGIC =====
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var removedCount = 0;

    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === STAGE2_REMINDER_SCHEDULER_HANDLER) {
        ScriptApp.deleteTrigger(triggers[i]);
        removedCount++;
      }
    }

    return {
      success: true,
      message: 'Stage 2 reminder email triggers removed.',
      data: { handlerFunction: STAGE2_REMINDER_SCHEDULER_HANDLER, removedCount: removedCount }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('removeStage2ReminderEmailTriggers', error);
    return { success: false, message: 'Failed to remove Stage 2 reminder email triggers.' };
  }
}

/**
 * FUNCTION: getStage2ReminderEmailTriggerStatus
 * PURPOSE: Report whether the scheduled Step 2 reminder email trigger exists.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function getStage2ReminderEmailTriggerStatus() {
  // ===== MAIN LOGIC =====
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var matchingTriggers = [];

    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === STAGE2_REMINDER_SCHEDULER_HANDLER) {
        matchingTriggers.push({
          handlerFunction: triggers[i].getHandlerFunction(),
          eventType: String(triggers[i].getEventType ? triggers[i].getEventType() : ''),
          triggerSource: String(triggers[i].getTriggerSource ? triggers[i].getTriggerSource() : ''),
          uniqueIdPresent: !!(triggers[i].getUniqueId && triggers[i].getUniqueId())
        });
      }
    }

    return {
      success: true,
      message: matchingTriggers.length > 0 ? 'Stage 2 reminder email trigger is installed.' : 'Stage 2 reminder email trigger is not installed.',
      data: {
        handlerFunction: STAGE2_REMINDER_SCHEDULER_HANDLER,
        expectedIntervalHours: STAGE2_REMINDER_SCHEDULER_INTERVAL_HOURS,
        triggerCount: matchingTriggers.length,
        triggers: matchingTriggers
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('getStage2ReminderEmailTriggerStatus', error);
    return { success: false, message: 'Failed to read Stage 2 reminder email trigger status.' };
  }
}

/**
 * FUNCTION: runStage2ReminderEmailScheduledProcessorTest
 * PURPOSE: Prove the scheduled processor path using a filtered test lead only.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates one test lead, sends one 2h reminder to TEST_EMAIL_RECIPIENT, appends one Email Logs row, and stamps the test lead only.
 */
function runStage2ReminderEmailScheduledProcessorTest() {
  // ===== MAIN LOGIC =====
  try {
    var source = 'Stage2ReminderEmailScheduledProcessorTest';
    var recipientResult = EmailService.getSettingValue_(EmailService.TEST_EMAIL_RECIPIENT_KEY);
    if (!recipientResult.success) {
      return recipientResult;
    }

    var createResult = LeadService.createLead({
      fullName: 'Stage 2 Reminder Scheduler Test',
      email: recipientResult.data.value,
      company: 'MIDTS Reminder Scheduler Test',
      projectType: 'CAD/CAM',
      source: source,
      notes: 'Created by runStage2ReminderEmailScheduledProcessorTest. Filtered scheduler test lead only.'
    });

    if (!createResult.success) {
      return createResult;
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var leadsSheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
    if (!leadsSheet) {
      return { success: false, message: 'Leads sheet not found.' };
    }

    var leadRowNumber = stage2ReminderEmailFindLeadRowNumber_(leadsSheet, createResult.data.leadId);
    if (!leadRowNumber) {
      return { success: false, message: 'Test lead row not found after creation.' };
    }

    // Backdate Created At by 3 hours so only the 2h reminder is due for this controlled test.
    leadsSheet.getRange(leadRowNumber, 2).setValue(new Date(new Date().getTime() - (3 * 60 * 60 * 1000)));

    var processResult = stage2ReminderEmailProcessDueLeads_({
      maxSends: 1,
      sourceFilter: source,
      runMode: 'filtered-test'
    });

    var updatedRow = leadsSheet.getRange(leadRowNumber, 1, 1, 20).getValues()[0];
    var assertions = {
      processorSucceeded: processResult.success === true,
      exactlyOneReminderSent: processResult.data && processResult.data.sentCount === 1,
      onlyTestSourceProcessed: processResult.data && processResult.data.sourceFilter === source,
      testLeadProcessed: processResult.data && processResult.data.sentLeadIds && processResult.data.sentLeadIds.indexOf(createResult.data.leadId) !== -1,
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
      message: pass ? 'Stage 2 reminder scheduled processor test passed.' : 'Stage 2 reminder scheduled processor test failed.',
      data: {
        leadId: createResult.data.leadId,
        processResult: processResult,
        assertions: assertions,
        failedChecks: failedChecks,
        note: 'This test uses a source filter and does not install the time trigger.'
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage2ReminderEmailScheduledProcessorTest', error);
    return { success: false, message: 'Stage 2 reminder scheduled processor test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: stage2ReminderEmailProcessDueLeads_
 * PURPOSE: Internal shared processor for scheduled and filtered test reminder email runs.
 * INPUT: options (object: maxSends, sourceFilter, runMode)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May send emails and stamp reminder fields depending on due leads.
 */
function stage2ReminderEmailProcessDueLeads_(options) {
  // ===== MAIN LOGIC =====
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    var runOptions = options || {};
    var maxSends = Number(runOptions.maxSends || STAGE2_REMINDER_SCHEDULER_MAX_SENDS_PER_RUN);
    var sourceFilter = String(runOptions.sourceFilter || '').trim();
    var runMode = String(runOptions.runMode || 'manual').trim();
    var sentLeadIds = [];
    var skipped = [];
    var failures = [];

    if (maxSends <= 0) {
      return { success: false, message: 'maxSends must be greater than zero.' };
    }

    lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) {
      return { success: false, message: 'Another Step 2 reminder email processor run is already active.' };
    }

    var prerequisiteResult = stage2ReminderEmailCheckPrerequisites_();
    if (!prerequisiteResult.success) {
      return prerequisiteResult;
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
    if (!sheet) {
      return { success: false, message: 'Leads sheet not found.' };
    }

    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (sentLeadIds.length >= maxSends) {
        break;
      }

      var row = values[i];
      var leadId = String(row[0] || '').trim();
      var source = String(row[7] || '').trim();
      if (!leadId) {
        continue;
      }

      if (sourceFilter && source !== sourceFilter) {
        continue;
      }

      var stageResult = stage2ReminderEmailGetDueStageForRow_(row);
      if (!stageResult.success) {
        skipped.push({ leadId: leadId, reason: stageResult.data ? stageResult.data.reason : stageResult.message });
        continue;
      }

      var sendResult = LeadService.sendStep2ReminderForLead(leadId, stageResult.data.stage);
      if (sendResult.success) {
        sentLeadIds.push(leadId);
      } else {
        failures.push({ leadId: leadId, reminderStage: stageResult.data.stage, result: sendResult });
      }
    }

    return {
      success: failures.length === 0,
      message: failures.length === 0 ? 'Step 2 reminder email processor completed.' : 'Step 2 reminder email processor completed with failures.',
      data: {
        runMode: runMode,
        sourceFilter: sourceFilter,
        maxSends: maxSends,
        sentCount: sentLeadIds.length,
        sentLeadIds: sentLeadIds,
        skippedCount: skipped.length,
        skipped: skipped,
        failureCount: failures.length,
        failures: failures
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('stage2ReminderEmailProcessDueLeads_', error, { options: options });
    return { success: false, message: 'Failed to process due Step 2 reminder emails.' };
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

/**
 * FUNCTION: stage2ReminderEmailCheckPrerequisites_
 * PURPOSE: Ensure required sheets and email settings exist before any scheduled send attempts.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create required sheet headers through existing setup helpers.
 */
function stage2ReminderEmailCheckPrerequisites_() {
  // ===== MAIN LOGIC =====
  var leadsResult = DatabaseService.ensureLeadsSheetStructure();
  if (!leadsResult.success) {
    return leadsResult;
  }

  var emailLogsResult = EmailService.ensureEmailLogsSheetStructure();
  if (!emailLogsResult.success) {
    return emailLogsResult;
  }

  var requiredSettings = [
    ConfigService.BREVO_API_KEY_KEY,
    EmailService.BREVO_SENDER_EMAIL_KEY,
    EmailService.BREVO_SENDER_NAME_KEY,
    ConfigService.STEP2_FORM_BASE_URL_KEY
  ];

  for (var i = 0; i < requiredSettings.length; i++) {
    var settingResult = EmailService.getSettingValue_(requiredSettings[i]);
    if (!settingResult.success) {
      return settingResult;
    }
  }

  return { success: true, message: 'Stage 2 reminder email prerequisites are present.' };
}

/**
 * FUNCTION: stage2ReminderEmailGetDueStageForRow_
 * PURPOSE: Determine the highest due unsent Step 2 reminder stage for one lead row.
 * INPUT: row (array from Leads sheet)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function stage2ReminderEmailGetDueStageForRow_(row) {
  // ===== MAIN LOGIC =====
  var createdAt = row[1];
  var step2CompletedAt = row[10];
  var reminder2hSentAt = row[14];
  var reminder24hSentAt = row[15];
  var reminder72hSentAt = row[16];

  if (step2CompletedAt instanceof Date) {
    return { success: false, message: 'Step 2 already complete.', data: { reason: 'STEP_2_COMPLETE' } };
  }

  if (!(createdAt instanceof Date)) {
    return { success: false, message: 'Invalid Created At value.', data: { reason: 'INVALID_CREATED_AT' } };
  }

  var elapsedHours = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (elapsedHours >= 72 && !reminder72hSentAt) {
    return { success: true, message: '72h reminder is due.', data: { stage: '72h', elapsedHours: elapsedHours } };
  }

  if (elapsedHours >= 24 && !reminder24hSentAt) {
    return { success: true, message: '24h reminder is due.', data: { stage: '24h', elapsedHours: elapsedHours } };
  }

  if (elapsedHours >= 2 && !reminder2hSentAt) {
    return { success: true, message: '2h reminder is due.', data: { stage: '2h', elapsedHours: elapsedHours } };
  }

  return { success: false, message: 'No reminder is due.', data: { reason: 'NOT_DUE', elapsedHours: elapsedHours } };
}

/**
 * FUNCTION: stage2ReminderEmailFindLeadRowNumber_
 * PURPOSE: Internal helper to locate a lead row number by lead ID.
 * INPUT: sheet (Sheet), leadId (string)
 * OUTPUT: row number or null
 * SIDE EFFECTS: none
 */
function stage2ReminderEmailFindLeadRowNumber_(sheet, leadId) {
  // ===== MAIN LOGIC =====
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === String(leadId || '').trim()) {
      return i + 1;
    }
  }

  return null;
}
