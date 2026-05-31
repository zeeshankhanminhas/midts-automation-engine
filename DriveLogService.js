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
        event.id || UtilsService.createSequentialId_('DRIVE_LOG'),
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
  },

  logPermissionAction: function (leadId, folder, action, actor, status, notes) {
    try {
      return this.log({
        leadId: leadId || '',
        action: action || 'Permission Action',
        folderType: 'Permission',
        folderName: folder && folder.getName ? folder.getName() : '',
        folderId: folder && folder.getId ? folder.getId() : '',
        folderUrl: folder && folder.getUrl ? folder.getUrl() : '',
        actor: actor || 'System',
        source: 'permission_action',
        status: status || 'Success',
        notes: notes || ''
      });
    } catch (error) {
      ErrorLogger.logError_('DriveLogService.logPermissionAction', error, { leadId: leadId });
      return { success: false, message: 'Failed to log permission action.' };
    }
  }
};

function runStage14DriveLogsSetupValidation() {
  return DriveLogService.ensureSheet();
}
