var DriveLogService = {
  SHEET_NAME: 'Drive Logs',
  HEADERS: ['Drive Log ID','Timestamp','Lead ID','Action','Folder Type','Folder Name','Folder ID','Folder URL','File Name','Drive File ID','Actor','Source','Status','Notes'],

  ensureSheet: function () {
    try {
      return DatabaseService.ensureSheetAndHeaders_(this.SHEET_NAME, this.HEADERS);
    } catch (error) {
      ErrorLogger.logError_('DriveLogService.ensureSheet', error);
      return { success: false, message: 'Failed to verify Drive Logs sheet.' };
    }
  },

  log: function (event) {
    try {
      var setup = this.ensureSheet();
      if (!setup.success) return setup;
      event = event || {};
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
      sheet.appendRow([
        event.id || UtilsService.createSequentialId_('DLOG'),
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
      return { success: true, message: 'Drive log written.' };
    } catch (error) {
      ErrorLogger.logError_('DriveLogService.log', error, { event: event });
      return { success: false, message: 'Failed to write Drive log.' };
    }
  }
};

function runStage14DriveLogsSetupValidation() {
  return DriveLogService.ensureSheet();
}
