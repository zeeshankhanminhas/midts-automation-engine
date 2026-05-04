/**
 * MIDTS Automation Engine
 * STAGE: 1 (Database sheet bootstrap helpers)
 * WHAT THIS FILE DOES:
 * - Ensures required sheet tabs exist.
 * - Preserves existing data by appending only missing headers.
 * DEPENDENCIES:
 * - Google Sheets as database
 * - ConfigService constants
 */

var DatabaseService = {
  /**
   * FUNCTION: ensureSettingsSheetStructure
   * PURPOSE: Ensure Settings sheet exists with required headers and keys for future stages.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers/keys only.
   */
  ensureSettingsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Required Settings headers; fixed order is preserved if already present.
      var requiredHeaders = ['Key', 'Value', 'Description'];

      var result = this.ensureSheetAndHeaders_(ConfigService.SETTINGS_SHEET_NAME, requiredHeaders);
      if (!result.success) {
        return result;
      }

      // Pull required keys from central config to avoid duplicated literals.
      var requiredKeys = ConfigService.getRequiredSettingKeys();

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.SETTINGS_SHEET_NAME);

      // Build index of existing keys to avoid duplicate rows.
      var values = sheet.getDataRange().getValues();
      var existingKeyMap = {};
      for (var i = 1; i < values.length; i++) {
        // Column A stores configuration key names.
        var existingKey = String(values[i][0] || '').trim();
        if (existingKey) {
          existingKeyMap[existingKey] = true;
        }
      }

      // Add only missing key rows; never overwrite existing user values.
      requiredKeys.forEach(function (keyName) {
        if (!existingKeyMap[keyName]) {
          sheet.appendRow([keyName, '', 'REQUIRED: Set this value in Settings sheet before running']);
        }
      });

      return { success: true, message: 'Settings sheet structure verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureSettingsSheetStructure', error);
      return { success: false, message: 'Failed to verify Settings sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureErrorLogsSheetStructure
   * PURPOSE: Ensure Error Logs sheet exists with fixed log headers.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers only.
   */
  ensureErrorLogsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Fixed headers for consistent log auditing across stages.
      var requiredHeaders = ['Log ID', 'Timestamp', 'Function', 'Error Message', 'Context JSON'];
      return this.ensureSheetAndHeaders_(ConfigService.ERROR_LOGS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureErrorLogsSheetStructure', error);
      return { success: false, message: 'Failed to verify Error Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureIdCountersSheetStructure
   * PURPOSE: Ensure ID Counters sheet exists with fixed headers for branded sequential IDs.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates ID Counters sheet if missing; appends missing headers only.
   */
  ensureIdCountersSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // One counter row per record type/year keeps business IDs short and sequential.
      var requiredHeaders = ['Type', 'Year', 'Last Sequence', 'Updated At', 'Sample Format'];
      return this.ensureSheetAndHeaders_(ConfigService.ID_COUNTERS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureIdCountersSheetStructure', error);
      return { success: false, message: 'Failed to verify ID Counters sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureLeadsSheetStructure
   * PURPOSE: Ensure Leads sheet exists with fixed headers for Stage 2 lead intake.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers only.
   */
  ensureLeadsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Fixed Leads headers support consistent append-only lead capture.
      var requiredHeaders = ['Lead ID', 'Created At', 'Full Name', 'Email', 'Company', 'Project Type', 'Status', 'Source', 'Notes', 'Step 1 Completed At', 'Step 2 Completed At', 'Qualification Status', 'Lead Score', 'High Value Flag', 'Reminder 2h Sent At', 'Reminder 24h Sent At', 'Reminder 72h Sent At', 'Last Reminder Stage', 'Nurture State', 'Reminder Status'];
      return this.ensureSheetAndHeaders_(ConfigService.LEADS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureLeadsSheetStructure', error);
      return { success: false, message: 'Failed to verify Leads sheet structure.' };
    }
  },

  /**
   * FUNCTION: ensureQuotesSheetStructure
   * PURPOSE: Ensure Quotes sheet exists with fixed headers for quote workflow.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers only.
   */
  ensureQuotesSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Fixed headers preserve predictable quote records and reporting.
      var requiredHeaders = ['Quote ID', 'Lead ID', 'Created At', 'Quote Status', 'Amount', 'Currency', 'Valid Until', 'Notes'];
      return this.ensureSheetAndHeaders_(ConfigService.QUOTES_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureQuotesSheetStructure', error);
      return { success: false, message: 'Failed to verify Quotes sheet structure.' };
    }
  },


  /**
   * FUNCTION: ensureVendorsSheetStructure
   * PURPOSE: Ensure Vendors sheet exists with eligibility fields required for assignment security checks.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers only.
   */
  ensureVendorsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Eligibility fields support secure vendor assignment gating.
      var requiredHeaders = ['Vendor ID', 'Vendor Name', 'Email', 'NDA Signed', 'ID Verified', 'Approved Status', 'Assigned Lead IDs'];
      return this.ensureSheetAndHeaders_(ConfigService.VENDORS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureVendorsSheetStructure', error);
      return { success: false, message: 'Failed to verify Vendors sheet structure.' };
    }
  },


  /**
   * FUNCTION: ensureProjectsSheetStructure
   * PURPOSE: Ensure Projects sheet exists with fixed headers for project creation workflow.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; appends missing headers only.
   */
  ensureProjectsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // Fixed headers support consistent project tracking records.
      var requiredHeaders = ['Project ID', 'Lead ID', 'Vendor ID', 'Quote ID', 'Created At', 'Project Status', 'Notes'];
      return this.ensureSheetAndHeaders_(ConfigService.PROJECTS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureProjectsSheetStructure', error);
      return { success: false, message: 'Failed to verify Projects sheet structure.' };
    }
  },


  /**
   * FUNCTION: getSettingsMap
   * PURPOSE: Build a key-value map from Settings sheet for configuration lookups.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getSettingsMap: function () {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.SETTINGS_SHEET_NAME);

      // Ensure sheet exists before reading rows.
      if (!sheet) {
        var ensureResult = this.ensureSettingsSheetStructure();
        if (!ensureResult.success) {
          return ensureResult;
        }
        sheet = spreadsheet.getSheetByName(ConfigService.SETTINGS_SHEET_NAME);
      }

      var values = sheet.getDataRange().getValues();
      var settingsMap = {};

      // Skip row 1 header and collect Key->Value pairs.
      for (var i = 1; i < values.length; i++) {
        var key = String(values[i][0] || '').trim();
        var value = String(values[i][1] || '').trim();
        if (key) {
          settingsMap[key] = value;
        }
      }

      return {
        success: true,
        message: 'Settings map loaded successfully.',
        data: { settingsMap: settingsMap }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.getSettingsMap', error);
      return { success: false, message: 'Failed to read settings map.' };
    }
  },

  /**
   * FUNCTION: ensureSheetAndHeaders_
   * PURPOSE: Internal helper to create a sheet if missing and append any missing headers.
   * INPUT: sheetName (string), requiredHeaders (string[])
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates sheet if missing; updates header row only.
   */
  ensureSheetAndHeaders_: function (sheetName, requiredHeaders) {
    // ===== MAIN LOGIC =====
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(sheetName);

      // Create missing sheet tab with the required name.
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
      }

      // Read first row to preserve and extend headers without reordering existing data.
      var currentHeaderCount = Math.max(sheet.getLastColumn(), 1);
      var currentHeaders = sheet.getRange(1, 1, 1, currentHeaderCount).getValues()[0];

      // Normalize current header values for reliable matching.
      var normalizedCurrentHeaders = currentHeaders.map(function (header) {
        return String(header || '').trim();
      }).filter(function (header) {
        return header !== '';
      });

      // Append only missing headers, preserving existing header order and data rows.
      var headersToAppend = requiredHeaders.filter(function (requiredHeader) {
        return normalizedCurrentHeaders.indexOf(requiredHeader) === -1;
      });

      if (normalizedCurrentHeaders.length === 0) {
        // Initialize header row when sheet is blank.
        sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      } else if (headersToAppend.length > 0) {
        // Add missing headers at the end per database rule.
        var startColumn = normalizedCurrentHeaders.length + 1;
        sheet.getRange(1, startColumn, 1, headersToAppend.length).setValues([headersToAppend]);
      }

      return {
        success: true,
        message: 'Sheet and headers verified for: ' + sheetName,
        data: { sheetName: sheetName }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DatabaseService.ensureSheetAndHeaders_', error, {
        sheetName: sheetName
      });
      return { success: false, message: 'Failed to verify sheet and headers.' };
    }
  }
};
