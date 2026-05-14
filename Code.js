/**
 * MIDTS Automation Engine
 * STAGE: 1 (Foundation bootstrap; no business workflow automation yet)
 * WHAT THIS FILE DOES:
 * - Provides entry-point and Stage 1 validation helpers.
 * DEPENDENCIES:
 * - Google Sheets tabs via SpreadsheetApp
 * - ConfigService (Config.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage1Validation
 * PURPOSE: Validate that Stage 1 foundational prerequisites exist without changing user data.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create missing required sheet tabs and append missing headers only.
 */
function runStage1Validation() {
  // ===== MAIN LOGIC =====
  try {
    // Validate settings tab and required keys for secure configuration.
    var settingsResult = DatabaseService.ensureSettingsSheetStructure();
    if (!settingsResult.success) {
      return settingsResult;
    }

    // Validate error log tab so future failures can be audited.
    var errorLogResult = DatabaseService.ensureErrorLogsSheetStructure();
    if (!errorLogResult.success) {
      return errorLogResult;
    }

    // Validate ID Counters tab so all new records can use branded sequential MIDTS IDs.
    var idCountersResult = DatabaseService.ensureIdCountersSheetStructure();
    if (!idCountersResult.success) {
      return idCountersResult;
    }

    // Missing required settings must fail validation instead of being buried in data.
    var configResult = ConfigService.validateRequiredSettings();
    if (!configResult.success) {
      return {
        success: false,
        message: configResult.message,
        data: {
          requiredSheets: ['Settings', 'Error Logs', 'ID Counters'],
          idCountersValidation: idCountersResult,
          settingsValidation: configResult
        }
      };
    }

    // Return a consistent major-function payload for Stage 1 checks.
    return {
      success: true,
      message: 'Stage 1 validation completed successfully.',
      data: {
        requiredSheets: ['Settings', 'Error Logs', 'ID Counters'],
        idCountersValidation: idCountersResult,
        settingsValidation: configResult
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage1Validation', error, {
      note: 'Unhandled failure while validating Stage 1 prerequisites.'
    });

    return {
      success: false,
      message: 'Stage 1 validation failed. Check Error Logs sheet for details.'
    };
  }
}

/**
 * FUNCTION: runStage1SmokeTest
 * PURPOSE: Execute a lightweight test routine to verify foundational helper behavior.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May append one test error row to Error Logs if logging path is exercised.
 */
function runStage1SmokeTest() {
  // ===== MAIN LOGIC =====
  try {
    // Step 1: ensure foundational sheets are present.
    var validation = runStage1Validation();
    if (!validation.success) {
      return validation;
    }

    // Step 2: verify branded sequential error log ID generation for auditing requirements.
    var testLogId = UtilsService.createSequentialId_('ERROR');
    var hasLogPrefix = String(testLogId).indexOf('MIDTS-ERR-') === 0;

    if (!hasLogPrefix) {
      return {
        success: false,
        message: 'Smoke test failed: MIDTS-ERR prefix was not generated correctly.',
        data: { generatedId: testLogId }
      };
    }

    return {
      success: true,
      message: 'Stage 1 smoke test passed.',
      data: {
        validation: validation,
        generatedLogId: testLogId
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage1SmokeTest', error);
    return { success: false, message: 'Stage 1 smoke test failed unexpectedly.' };
  }
}
