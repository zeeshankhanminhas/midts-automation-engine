/**
 * MIDTS Automation Engine
 * STAGE: 14 (Drive operations audit ledger)
 * WHAT THIS FILE DOES:
 * - Creates and writes the general Drive Logs sheet.
 * - Records Drive-related operational events without exposing private client Drive links.
 * DEPENDENCIES:
 * - Google Sheets tab: Drive Logs
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var DriveLogService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Drive Logs
  SHEET_NAME: 'Drive Logs',
  HEADERS: ['Drive Log ID', 'Timestamp', 'Lead ID', 'Action', 'Folder Type', 'Folder Name', 'Folder ID', 'Folder URL', 'File Name', 'Drive File ID', 'Actor', 'Source', 'Status', 'Notes'],

  /**
   * FUNCTION: ensureSheet
   * PURPOSE: Ensure Drive Logs sheet exists with fixed audit headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Drive Logs sheet if missing and appends missing headers only.
   */
  ensureSheet: function () {
    // ===== MAIN LOGIC =====
    try {
      return DatabaseService.ensureSheetAndHeaders_(this.SHEET_NAME, this.HEADERS);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveLogService.ensureSheet', error);
      return { success: false, message: 'Failed to verify Drive Logs sheet.' };
    }
  },

  /**
   * FUNCTION: log
   * PURPOSE: Append one general Drive operation row to Drive Logs.
   * INPUT: event (object with optional id, time, leadId, action, folder/file metadata, actor, source, status, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Drive Logs.
   */
  log: function (event) {
    // ===== MAIN LOGIC =====
    try {
      var setup = this.ensureSheet();
      if (!setup.success) return setup;
      event = event || {};
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
      var logId = event.id || UtilsService.createSequentialId_('DRIVE_LOG');

      sheet.appendRow([
        logId,
        event.time || new Date(),
        event.leadId || '',
        event.action || '',
        event.folderType || '',
        event.folderName || '',
        event.folderId || '',
        event.folderUrl || '',
        event.fileName || '',
        event.fileId || '',
        event.actor || 'System',
        event.source || 'System',
        event.status || 'Success',
        event.notes || ''
      ]);
      return { success: true, message: 'Drive log written.', data: { logId: logId, sheetName: this.SHEET_NAME } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveLogService.log', error, { event: event });
      return { success: false, message: 'Failed to write Drive log.' };
    }
  },

  /**
   * FUNCTION: logPermissionAction
   * PURPOSE: Log one Drive permission action from a folder object.
   * INPUT: leadId (string), folder (Drive folder object), action (string), actor (string), status (string), notes (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Drive Logs.
   */
  logPermissionAction: function (leadId, folder, action, actor, status, notes) {
    // ===== MAIN LOGIC =====
    try {
      return this.log({
        leadId: leadId || '',
        action: action || 'Permission Action',
        folderType: 'Permission',
        folderName: folder && folder.getName ? folder.getName() : '',
        folderId: folder && folder.getId ? folder.getId() : '',
        // Folder URL is intentionally omitted from generic logs to avoid exposing private client links.
        folderUrl: '',
        actor: actor || 'System',
        source: 'permission_action',
        status: status || 'Success',
        notes: notes || ''
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveLogService.logPermissionAction', error, { leadId: leadId });
      return { success: false, message: 'Failed to log permission action.' };
    }
  }
};

/**
 * FUNCTION: runStage14DriveLogsSetupValidation
 * PURPOSE: Validate Drive Logs sheet structure without writing operational Drive rows.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Drive Logs sheet and append missing headers only.
 */
function runStage14DriveLogsSetupValidation() {
  // ===== MAIN LOGIC =====
  return DriveLogService.ensureSheet();
}
