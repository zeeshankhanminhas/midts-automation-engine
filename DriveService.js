/**
 * MIDTS Automation Engine
 * STAGE: 6 (Controlled Google Drive project folder access)
 * WHAT THIS FILE DOES:
 * - Creates project folders under the configured MIDTS Drive root folder.
 * - Grants and removes vendor access only after eligibility checks pass.
 * - Logs every Drive access grant/remove attempt to a dedicated audit sheet.
 * DEPENDENCIES:
 * - Google Drive root folder from Settings sheet: ROOT_DRIVE_FOLDER_ID
 * - Optional test vendor email from Settings sheet: TEST_VENDOR_EMAIL
 * - Google Sheets tabs: Projects, Vendors, Drive Access Logs
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var DriveService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Drive Access Logs
  DRIVE_ACCESS_LOGS_SHEET_NAME: 'Drive Access Logs',

  // REQUIRED for Stage 6 test sharing: Set this value in Settings sheet before running live Drive access tests.
  // Example: TEST_VENDOR_EMAIL = "your-test-vendor@example.com"
  TEST_VENDOR_EMAIL_KEY: 'TEST_VENDOR_EMAIL',

  /**
   * FUNCTION: ensureDriveAccessLogsSheetStructure
   * PURPOSE: Ensure Drive Access Logs sheet exists with fixed audit headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Drive Access Logs sheet if missing; appends missing headers only.
   */
  ensureDriveAccessLogsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = ['Log ID', 'Timestamp', 'Action', 'Project ID', 'Vendor ID', 'Folder ID', 'Vendor Email', 'Result', 'Notes'];
      return DatabaseService.ensureSheetAndHeaders_(this.DRIVE_ACCESS_LOGS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.ensureDriveAccessLogsSheetStructure', error);
      return { success: false, message: 'Failed to verify Drive Access Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureProjectDriveMetadataStructure
   * PURPOSE: Ensure Projects sheet can store Drive folder IDs without reordering existing project data.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append Drive Folder ID header to Projects sheet.
   */
  ensureProjectDriveMetadataStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      var requiredHeaders = ['Project ID', 'Lead ID', 'Vendor ID', 'Quote ID', 'Created At', 'Project Status', 'Notes', 'Drive Folder ID'];
      return DatabaseService.ensureSheetAndHeaders_(ConfigService.PROJECTS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.ensureProjectDriveMetadataStructure', error);
      return { success: false, message: 'Failed to verify project Drive metadata structure.' };
    }
  },

  /**
   * FUNCTION: createProjectFolder
   * PURPOSE: Create or return a private Drive folder for one project under ROOT_DRIVE_FOLDER_ID.
   * INPUT: projectId (string), folderName (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create one Google Drive folder and update Projects sheet Drive Folder ID.
   */
  createProjectFolder: function (projectId, folderName) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      if (!targetProjectId) {
        return { success: false, message: 'projectId is required.' };
      }

      var structureResult = this.ensureProjectDriveMetadataStructure();
      if (!structureResult.success) {
        return structureResult;
      }

      var projectResult = this.getProjectSnapshot_(targetProjectId);
      if (!projectResult.success) {
        return projectResult;
      }

      if (projectResult.data.driveFolderId) {
        return {
          success: true,
          message: 'Project already has a Drive folder recorded.',
          data: { projectId: targetProjectId, folderId: projectResult.data.driveFolderId }
        };
      }

      var rootIdResult = this.getSettingValue_(ConfigService.ROOT_DRIVE_FOLDER_ID_KEY);
      if (!rootIdResult.success) {
        return rootIdResult;
      }

      var rootFolder = DriveApp.getFolderById(rootIdResult.data.value);
      var safeFolderName = String(folderName || ('MIDTS Project ' + targetProjectId)).trim();

      // New folders inherit parent restrictions; do not make folders public in Stage 6.
      var projectFolder = rootFolder.createFolder(safeFolderName);
      var folderId = projectFolder.getId();

      var updateResult = this.updateProjectFolderId_(targetProjectId, folderId);
      if (!updateResult.success) {
        return updateResult;
      }

      this.logDriveAccess_('CREATE_FOLDER', targetProjectId, projectResult.data.vendorId, folderId, '', 'Success', 'Project folder created under configured root folder.');

      return {
        success: true,
        message: 'Project Drive folder created successfully.',
        data: { projectId: targetProjectId, folderId: folderId, folderName: safeFolderName }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.createProjectFolder', error, { projectId: projectId, folderName: folderName });
      return { success: false, message: 'Failed to create project Drive folder.' };
    }
  },

  /**
   * FUNCTION: grantVendorProjectFolderAccess
   * PURPOSE: Grant one eligible vendor editor access to one project folder.
   * INPUT: projectId (string), vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Adds vendor email as folder editor and appends Drive access log row.
   */
  grantVendorProjectFolderAccess: function (projectId, vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      var targetVendorId = String(vendorId || '').trim();
      if (!targetProjectId || !targetVendorId) {
        return { success: false, message: 'projectId and vendorId are required.' };
      }

      var projectResult = this.getProjectSnapshot_(targetProjectId);
      if (!projectResult.success) {
        return projectResult;
      }

      var vendorResult = this.getEligibleVendorSnapshot_(targetVendorId);
      if (!vendorResult.success) {
        this.logDriveAccess_('GRANT_ACCESS', targetProjectId, targetVendorId, projectResult.data.driveFolderId || '', '', 'Blocked', vendorResult.message);
        return vendorResult;
      }

      if (projectResult.data.vendorId !== targetVendorId) {
        var mismatchMessage = 'Vendor is not assigned to this project.';
        this.logDriveAccess_('GRANT_ACCESS', targetProjectId, targetVendorId, projectResult.data.driveFolderId || '', vendorResult.data.email, 'Blocked', mismatchMessage);
        return { success: false, message: mismatchMessage };
      }

      var folderId = projectResult.data.driveFolderId;
      if (!folderId) {
        var folderResult = this.createProjectFolder(targetProjectId);
        if (!folderResult.success) {
          return folderResult;
        }
        folderId = folderResult.data.folderId;
      }

      // Vendor access is limited to the project folder, never the internal client/root folder.
      var folder = DriveApp.getFolderById(folderId);
      folder.addEditor(vendorResult.data.email);

      this.logDriveAccess_('GRANT_ACCESS', targetProjectId, targetVendorId, folderId, vendorResult.data.email, 'Success', 'Vendor editor access granted to project folder only.');

      return {
        success: true,
        message: 'Vendor Drive access granted successfully.',
        data: { projectId: targetProjectId, vendorId: targetVendorId, folderId: folderId, vendorEmail: vendorResult.data.email }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.grantVendorProjectFolderAccess', error, { projectId: projectId, vendorId: vendorId });
      return { success: false, message: 'Failed to grant vendor Drive access.' };
    }
  },

  /**
   * FUNCTION: removeVendorProjectFolderAccess
   * PURPOSE: Remove one vendor email from one project folder.
   * INPUT: projectId (string), vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Removes vendor from folder editors/viewers and appends Drive access log row.
   */
  removeVendorProjectFolderAccess: function (projectId, vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      var targetVendorId = String(vendorId || '').trim();
      if (!targetProjectId || !targetVendorId) {
        return { success: false, message: 'projectId and vendorId are required.' };
      }

      var projectResult = this.getProjectSnapshot_(targetProjectId);
      if (!projectResult.success) {
        return projectResult;
      }

      var vendorResult = this.getVendorSnapshot_(targetVendorId);
      if (!vendorResult.success) {
        return vendorResult;
      }

      if (!projectResult.data.driveFolderId) {
        return { success: false, message: 'Project has no Drive folder recorded.' };
      }

      var folder = DriveApp.getFolderById(projectResult.data.driveFolderId);
      folder.removeEditor(vendorResult.data.email);
      folder.removeViewer(vendorResult.data.email);

      this.logDriveAccess_('REMOVE_ACCESS', targetProjectId, targetVendorId, projectResult.data.driveFolderId, vendorResult.data.email, 'Success', 'Vendor access removed from project folder.');

      return {
        success: true,
        message: 'Vendor Drive access removed successfully.',
        data: { projectId: targetProjectId, vendorId: targetVendorId, folderId: projectResult.data.driveFolderId, vendorEmail: vendorResult.data.email }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.removeVendorProjectFolderAccess', error, { projectId: projectId, vendorId: vendorId });
      return { success: false, message: 'Failed to remove vendor Drive access.' };
    }
  },

  /**
   * FUNCTION: getSettingValue_
   * PURPOSE: Internal helper to read a setting from Settings sheet with Script Properties fallback.
   * INPUT: key (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getSettingValue_: function (key) {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = DatabaseService.getSettingsMap();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var fromSheet = String(settingsResult.data.settingsMap[key] || '').trim();
      var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
      var value = fromSheet || fromScript;

      if (!value) {
        return { success: false, message: 'Missing required setting: ' + key, data: { missingKey: key } };
      }

      return { success: true, message: 'Setting loaded successfully.', data: { key: key, value: value } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.getSettingValue_', error, { key: key });
      return { success: false, message: 'Failed to load setting value.' };
    }
  },

  /**
   * FUNCTION: getProjectSnapshot_
   * PURPOSE: Internal helper to read one project row and Drive folder metadata.
   * INPUT: projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getProjectSnapshot_: function (projectId) {
    // ===== MAIN LOGIC =====
    try {
      var structureResult = this.ensureProjectDriveMetadataStructure();
      if (!structureResult.success) {
        return structureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Projects sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(projectId).trim()) {
          return {
            success: true,
            message: 'Project snapshot loaded.',
            data: {
              projectId: String(values[i][0] || '').trim(),
              leadId: String(values[i][1] || '').trim(),
              vendorId: String(values[i][2] || '').trim(),
              quoteId: String(values[i][3] || '').trim(),
              projectStatus: String(values[i][5] || '').trim(),
              driveFolderId: String(values[i][7] || '').trim(),
              rowNumber: i + 1
            }
          };
        }
      }

      return { success: false, message: 'Project not found for provided projectId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.getProjectSnapshot_', error, { projectId: projectId });
      return { success: false, message: 'Failed to load project snapshot.' };
    }
  },

  /**
   * FUNCTION: getVendorSnapshot_
   * PURPOSE: Internal helper to read one vendor row.
   * INPUT: vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getVendorSnapshot_: function (vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var ensureResult = DatabaseService.ensureVendorsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Vendors sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === String(vendorId).trim()) {
          return {
            success: true,
            message: 'Vendor snapshot loaded.',
            data: {
              vendorId: String(values[i][0] || '').trim(),
              vendorName: String(values[i][1] || '').trim(),
              email: String(values[i][2] || '').trim(),
              ndaSigned: String(values[i][3] || '').trim(),
              idVerified: String(values[i][4] || '').trim(),
              approvedStatus: String(values[i][5] || '').trim()
            }
          };
        }
      }

      return { success: false, message: 'Vendor not found for provided vendorId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.getVendorSnapshot_', error, { vendorId: vendorId });
      return { success: false, message: 'Failed to load vendor snapshot.' };
    }
  },

  /**
   * FUNCTION: getEligibleVendorSnapshot_
   * PURPOSE: Internal helper to enforce vendor security rules before Drive access.
   * INPUT: vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getEligibleVendorSnapshot_: function (vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var vendorResult = this.getVendorSnapshot_(vendorId);
      if (!vendorResult.success) {
        return vendorResult;
      }

      var vendor = vendorResult.data;
      var eligible = vendor.ndaSigned === 'Yes' && vendor.idVerified === 'Yes' && vendor.approvedStatus === 'Approved';
      if (!eligible) {
        return { success: false, message: 'Vendor is not eligible for Drive access.', data: vendor };
      }

      if (!vendor.email || vendor.email.indexOf('@') === -1) {
        return { success: false, message: 'Vendor email is missing or invalid.', data: vendor };
      }

      return vendorResult;
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.getEligibleVendorSnapshot_', error, { vendorId: vendorId });
      return { success: false, message: 'Failed to evaluate vendor Drive eligibility.' };
    }
  },

  /**
   * FUNCTION: updateProjectFolderId_
   * PURPOSE: Internal helper to save Drive folder ID against a project row.
   * INPUT: projectId (string), folderId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates Drive Folder ID cell in Projects sheet.
   */
  updateProjectFolderId_: function (projectId, folderId) {
    // ===== MAIN LOGIC =====
    try {
      var projectResult = this.getProjectSnapshot_(projectId);
      if (!projectResult.success) {
        return projectResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      sheet.getRange(projectResult.data.rowNumber, 8).setValue(folderId);

      return { success: true, message: 'Project Drive folder ID saved.', data: { projectId: projectId, folderId: folderId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.updateProjectFolderId_', error, { projectId: projectId, folderId: folderId });
      return { success: false, message: 'Failed to save project Drive folder ID.' };
    }
  },

  /**
   * FUNCTION: logDriveAccess_
   * PURPOSE: Internal helper to append a Drive access audit row.
   * INPUT: action, projectId, vendorId, folderId, vendorEmail, result, notes
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Drive Access Logs sheet.
   */
  logDriveAccess_: function (action, projectId, vendorId, folderId, vendorEmail, result, notes) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureDriveAccessLogsSheetStructure();
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.DRIVE_ACCESS_LOGS_SHEET_NAME);
      var logId = UtilsService.createPrefixedId_('LOG-');

      sheet.appendRow([
        logId,
        new Date(),
        action,
        projectId,
        vendorId,
        folderId,
        vendorEmail,
        result,
        notes
      ]);

      return { success: true, message: 'Drive access log written.', data: { logId: logId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DriveService.logDriveAccess_', error, { action: action, projectId: projectId, vendorId: vendorId });
      return { success: false, message: 'Failed to write Drive access log.' };
    }
  }
};
