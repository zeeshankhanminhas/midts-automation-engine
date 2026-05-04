/**
 * MIDTS Automation Engine
 * STAGE: 1 (Centralized error logging)
 * WHAT THIS FILE DOES:
 * - Logs system errors to the Error Logs sheet in a structured format.
 * DEPENDENCIES:
 * - Google Sheets tab: Error Logs
 * - ConfigService constants
 * - UtilsService for unique MIDTS-ERR IDs
 */

var ErrorLogger = {
  /**
   * FUNCTION: logError_
   * PURPOSE: Internal logger that writes a structured error row without throwing.
   * INPUT: functionName (string), error (any), context (object, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends a row to Error Logs sheet.
   */
  logError_: function (functionName, error, context) {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.ERROR_LOGS_SHEET_NAME);

      // If Error Logs sheet is missing, attempt a safe bootstrap before logging.
      if (!sheet) {
        DatabaseService.ensureErrorLogsSheetStructure();
        sheet = spreadsheet.getSheetByName(ConfigService.ERROR_LOGS_SHEET_NAME);
      }

      // Capture readable message from unknown error types.
      var errorMessage = (error && error.message) ? error.message : String(error || 'Unknown error');

      // Use the canonical branded sequential error log ID for audit tracking.
      var logId = UtilsService.createSequentialId_('ERROR');

      // Store context as JSON for easier debugging in spreadsheet.
      var contextJson = JSON.stringify(context || {});

      sheet.appendRow([
        logId,
        new Date(),
        functionName || 'UnknownFunction',
        errorMessage,
        contextJson
      ]);

      return { success: true, message: 'Error logged successfully.', data: { logId: logId } };
    } catch (loggingError) {
      // ===== ERROR HANDLING =====
      // Intentionally avoid recursive logging calls to prevent infinite loops.
      return {
        success: false,
        message: 'Failed to log error due to logger failure: ' + String(loggingError)
      };
    }
  }
};
