var MIDTSDriveServicePatch = {
  apply: function () {
    if (typeof DriveService === 'undefined') return;

    DriveService.logDriveAccess_ = function (action, projectId, vendorId, folderId, vendorEmail, result, notes) {
      try {
        this.ensureDriveAccessLogsSheetStructure();
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.DRIVE_ACCESS_LOGS_SHEET_NAME);
        var logId = UtilsService.createSequentialId_('DRIVE_LOG');
        var timestamp = new Date();

        sheet.appendRow([
          logId,
          timestamp,
          action,
          projectId,
          vendorId,
          folderId,
          vendorEmail,
          result,
          notes
        ]);

        var driveLogResult = DriveLogService.log({
          id: logId,
          time: timestamp,
          action: action,
          folderType: 'Project Folder',
          folderId: folderId || '',
          actor: 'DriveService',
          source: 'DriveService.logDriveAccess_',
          status: result || 'Logged',
          notes: this.buildDriveLogNotes_(projectId, vendorId, vendorEmail, notes)
        });

        if (!driveLogResult.success) {
          return driveLogResult;
        }

        return {
          success: true,
          message: 'Drive access log and Drive log written.',
          data: {
            logId: logId,
            accessLogId: logId,
            driveLogId: driveLogResult.data && driveLogResult.data.logId ? driveLogResult.data.logId : logId,
            sheets: [this.DRIVE_ACCESS_LOGS_SHEET_NAME, DriveLogService.SHEET_NAME]
          }
        };
      } catch (error) {
        ErrorLogger.logError_('DriveService.logDriveAccess_', error, { action: action, projectId: projectId, vendorId: vendorId });
        return { success: false, message: 'Failed to write Drive access log.' };
      }
    };
  }
};

MIDTSDriveServicePatch.apply();
