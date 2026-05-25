/**
 * MIDTS Automation Engine
 * STAGE: 13 (Low-friction file review status automation)
 * WHAT THIS FILE DOES:
 * - Adds a controlled File Review Status workflow on the Leads sheet.
 * - Installs an authorised on-edit trigger for Drive-safe automation.
 * - When File Review Status becomes "Vendor Package Ready", copies RAW files into the vendor-safe folder.
 * - Updates the lead summary fields and writes File Logs rows for auditability.
 * DEPENDENCIES:
 * - Google Sheet tabs: Leads, File Logs
 * - FileIntakeService (FileIntakeService.js)
 * - DatabaseService (DatabaseService.js)
 * - ConfigService (Config.js)
 * - ErrorLogger (ErrorLogger.js)
 * - UtilsService (Utils.js)
 */
var FileReviewAutomationService = {
  FILE_REVIEW_STATUS_HEADER: 'File Review Status',
  VENDOR_PACKAGE_PREPARED_AT_HEADER: 'Vendor Package Prepared At',
  VENDOR_PACKAGE_SOURCE_HEADER: 'Vendor Package Source',
  VENDOR_PACKAGE_NOTES_HEADER: 'Vendor Package Notes',
  STATUS_RAW_UPLOADED: 'Raw Uploaded',
  STATUS_INTERNAL_REVIEW: 'Internal Review',
  STATUS_VENDOR_PACKAGE_READY: 'Vendor Package Ready',
  STATUS_SENT_TO_VENDOR: 'Sent To Vendor',

  /**
   * FUNCTION: ensureFileReviewAutomationSetup
   * PURPOSE: Prepare Leads columns, dropdown validation, File Logs, and installable edit trigger.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Adds missing columns, applies dropdown validation, installs trigger if missing.
   */
  ensureFileReviewAutomationSetup: function () {
    try {
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) return leadsResult;
      var fileLogsResult = DatabaseService.ensureFileLogsSheetStructure();
      if (!fileLogsResult.success) return fileLogsResult;

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      var headersResult = this.ensureReviewHeaders_(sheet);
      if (!headersResult.success) return headersResult;

      var validationResult = this.applyReviewStatusValidation_(sheet);
      if (!validationResult.success) return validationResult;

      var triggerResult = this.ensureInstallableOnEditTrigger_();
      if (!triggerResult.success) return triggerResult;

      return {
        success: true,
        message: 'File review status automation setup verified.',
        data: {
          leadsSheet: ConfigService.LEADS_SHEET_NAME,
          statusHeader: this.FILE_REVIEW_STATUS_HEADER,
          trigger: triggerResult.data
        }
      };
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.ensureFileReviewAutomationSetup', error);
      return { success: false, message: 'Failed to verify file review automation setup.', data: { errorMessage: error && error.message ? error.message : String(error) } };
    }
  },

  /**
   * FUNCTION: handleInstallableEdit
   * PURPOSE: Entry point for the installable edit trigger.
   * INPUT: e (Apps Script edit event)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May copy files and update lead row.
   */
  handleInstallableEdit: function (e) {
    try {
      if (!e || !e.range) return { success: true, message: 'No edit range supplied.' };
      var sheet = e.range.getSheet();
      if (!sheet || sheet.getName() !== ConfigService.LEADS_SHEET_NAME) {
        return { success: true, message: 'Edit ignored because it was not on Leads sheet.' };
      }
      if (e.range.getRow() <= 1) {
        return { success: true, message: 'Header edit ignored.' };
      }

      var headerMap = this.getHeaderMap_(sheet);
      var statusCol = headerMap[this.FILE_REVIEW_STATUS_HEADER];
      if (!statusCol || e.range.getColumn() !== statusCol) {
        return { success: true, message: 'Edit ignored because it was not File Review Status.' };
      }

      var nextStatus = String(e.value || e.range.getValue() || '').trim();
      if (nextStatus !== this.STATUS_VENDOR_PACKAGE_READY) {
        return { success: true, message: 'Edit ignored because status is not Vendor Package Ready.', data: { status: nextStatus } };
      }

      return this.prepareVendorPackageForRow_(sheet, e.range.getRow());
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.handleInstallableEdit', error);
      return { success: false, message: 'File review status edit handling failed.', data: { errorMessage: error && error.message ? error.message : String(error) } };
    }
  },

  /**
   * FUNCTION: prepareVendorPackageForRow_
   * PURPOSE: Copy RAW files to vendor-safe package for one lead row.
   * INPUT: sheet (Sheet), rowNumber (number)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Copies files, updates Leads, writes File Logs.
   */
  prepareVendorPackageForRow_: function (sheet, rowNumber) {
    try {
      var headerMap = this.getHeaderMap_(sheet);
      var leadId = String(sheet.getRange(rowNumber, headerMap['Lead ID']).getValue() || '').trim();
      if (!leadId) return { success: false, message: 'Lead ID missing on selected row.' };

      var company = headerMap['Company'] ? String(sheet.getRange(rowNumber, headerMap['Company']).getValue() || '').trim() : '';
      var folderIdCol = headerMap['Lead Intake Folder ID'];
      var leadFolderId = folderIdCol ? String(sheet.getRange(rowNumber, folderIdCol).getValue() || '').trim() : '';

      if (!leadFolderId) {
        var intakeResult = FileIntakeService.ensureLeadIntakeFolders_(leadId, company);
        if (!intakeResult.success) {
          FileIntakeService.logFileAttempt_('', '', leadId, '', '', '', 0, '', '', 'file_review_status', 'Rejected', 'Vendor package preparation failed: ' + intakeResult.message);
          return intakeResult;
        }
        leadFolderId = intakeResult.data.leadFolderId;
        this.writeIfHeaderExists_(sheet, rowNumber, headerMap, 'Lead Intake Folder ID', intakeResult.data.leadFolderId);
        this.writeIfHeaderExists_(sheet, rowNumber, headerMap, 'Lead Intake Folder URL', intakeResult.data.leadFolderUrl);
      }

      var leadFolder = DriveApp.getFolderById(leadFolderId);
      var rawFolder = FileIntakeService.findOrCreateChildFolder_(leadFolder, '01_RAW_CLIENT_UPLOADS');
      var vendorFolder = FileIntakeService.findOrCreateChildFolder_(leadFolder, '03_VENDOR_SAFE_PACKAGE');
      var copied = 0;
      var skipped = 0;
      var files = rawFolder.getFiles();

      while (files.hasNext()) {
        var sourceFile = files.next();
        var filename = sourceFile.getName();
        var existing = vendorFolder.getFilesByName(filename);
        if (existing.hasNext()) {
          skipped += 1;
          continue;
        }
        var copiedFile = sourceFile.makeCopy(filename, vendorFolder);
        copied += 1;
        FileIntakeService.logFileAttempt_(
          UtilsService.createSequentialId_('LOG'),
          new Date(),
          leadId,
          filename,
          copiedFile.getName(),
          copiedFile.getMimeType(),
          copiedFile.getSize(),
          copiedFile.getId(),
          vendorFolder.getId(),
          'file_review_status',
          'Vendor Safe Copied',
          'Copied from 01_RAW_CLIENT_UPLOADS to 03_VENDOR_SAFE_PACKAGE after File Review Status changed to Vendor Package Ready.'
        );
      }

      this.writeIfHeaderExists_(sheet, rowNumber, headerMap, 'Vendor Safe Package Ready', 'Yes');
      this.writeIfHeaderExists_(sheet, rowNumber, headerMap, 'File Intake Status', this.STATUS_VENDOR_PACKAGE_READY);
      this.writeIfHeaderExists_(sheet, rowNumber, headerMap, this.VENDOR_PACKAGE_PREPARED_AT_HEADER, new Date());
      this.writeIfHeaderExists_(sheet, rowNumber, headerMap, this.VENDOR_PACKAGE_SOURCE_HEADER, 'File Review Status dropdown');
      this.writeIfHeaderExists_(sheet, rowNumber, headerMap, this.VENDOR_PACKAGE_NOTES_HEADER, 'Copied ' + copied + ' file(s); skipped ' + skipped + ' existing file(s).');

      if (copied === 0) {
        FileIntakeService.logFileAttempt_(
          UtilsService.createSequentialId_('LOG'),
          new Date(),
          leadId,
          '',
          '',
          '',
          0,
          '',
          vendorFolder.getId(),
          'file_review_status',
          'Vendor Package Checked',
          'No new raw files copied. Existing vendor-safe files skipped: ' + skipped + '.'
        );
      }

      return {
        success: true,
        message: 'Vendor-safe package prepared from review status.',
        data: { leadId: leadId, copied: copied, skipped: skipped, vendorFolderId: vendorFolder.getId(), vendorFolderUrl: vendorFolder.getUrl() }
      };
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.prepareVendorPackageForRow_', error, { rowNumber: rowNumber });
      return { success: false, message: 'Failed to prepare vendor-safe package.', data: { errorMessage: error && error.message ? error.message : String(error) } };
    }
  },

  ensureReviewHeaders_: function (sheet) {
    try {
      var headers = [this.FILE_REVIEW_STATUS_HEADER, this.VENDOR_PACKAGE_PREPARED_AT_HEADER, this.VENDOR_PACKAGE_SOURCE_HEADER, this.VENDOR_PACKAGE_NOTES_HEADER];
      return DatabaseService.ensureSheetAndHeaders_(ConfigService.LEADS_SHEET_NAME, headers);
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.ensureReviewHeaders_', error);
      return { success: false, message: 'Failed to verify file review headers.' };
    }
  },

  applyReviewStatusValidation_: function (sheet) {
    try {
      var headerMap = this.getHeaderMap_(sheet);
      var statusCol = headerMap[this.FILE_REVIEW_STATUS_HEADER];
      if (!statusCol) return { success: false, message: 'File Review Status header missing.' };
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList([this.STATUS_RAW_UPLOADED, this.STATUS_INTERNAL_REVIEW, this.STATUS_VENDOR_PACKAGE_READY, this.STATUS_SENT_TO_VENDOR], true)
        .setAllowInvalid(false)
        .build();
      var maxRows = Math.max(sheet.getMaxRows() - 1, 1);
      sheet.getRange(2, statusCol, maxRows, 1).setDataValidation(rule);
      return { success: true, message: 'File Review Status dropdown validation applied.' };
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.applyReviewStatusValidation_', error);
      return { success: false, message: 'Failed to apply File Review Status dropdown.' };
    }
  },

  ensureInstallableOnEditTrigger_: function () {
    try {
      var handler = 'onFileReviewStatusEdit';
      var triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === handler) {
          return { success: true, message: 'File review edit trigger already installed.', data: { handler: handler, installed: true, reused: true } };
        }
      }
      ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
      return { success: true, message: 'File review edit trigger installed.', data: { handler: handler, installed: true, reused: false } };
    } catch (error) {
      ErrorLogger.logError_('FileReviewAutomationService.ensureInstallableOnEditTrigger_', error);
      return { success: false, message: 'Failed to install file review edit trigger.', data: { errorMessage: error && error.message ? error.message : String(error) } };
    }
  },

  getHeaderMap_: function (sheet) {
    var values = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    for (var i = 0; i < values.length; i++) {
      var header = String(values[i] || '').trim();
      if (header) map[header] = i + 1;
    }
    return map;
  },

  writeIfHeaderExists_: function (sheet, rowNumber, headerMap, header, value) {
    if (headerMap[header]) {
      sheet.getRange(rowNumber, headerMap[header]).setValue(value);
    }
  }
};

/**
 * FUNCTION: onFileReviewStatusEdit
 * PURPOSE: Installable edit trigger wrapper for File Review Status workflow.
 */
function onFileReviewStatusEdit(e) {
  return FileReviewAutomationService.handleInstallableEdit(e);
}

/**
 * FUNCTION: runStage13FileReviewAutomationSetupValidation
 * PURPOSE: One-time setup runner for File Review Status dropdown and installable trigger.
 */
function runStage13FileReviewAutomationSetupValidation() {
  return FileReviewAutomationService.ensureFileReviewAutomationSetup();
}
