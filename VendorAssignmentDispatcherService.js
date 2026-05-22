/**
 * MIDTS Automation Engine
 * STAGE: 4.1 (Post-Step-2 vendor assignment dispatcher)
 * WHAT THIS FILE DOES:
 * - Connects Step 2 qualification to the vendor pricing business cycle.
 * - Dispatches eligible qualified leads to a configured default vendor when explicitly enabled.
 * - Blocks duplicate active pricing requests and logs every dispatch decision.
 * DEPENDENCIES:
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Vendors
 * - Google Sheets tab: Vendor Pricing
 * - Google Sheets tab: Vendor Assignment Logs
 * - LeadService (LeadService.gs)
 * - VendorService (VendorService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorAssignmentDispatcherService = {
  // ===== CONFIG =====
  VENDOR_ASSIGNMENT_LOGS_SHEET_NAME: 'Vendor Assignment Logs',
  VENDOR_ASSIGNMENT_LOG_HEADERS: [
    'Timestamp',
    'Stage',
    'Success',
    'Message',
    'Lead ID',
    'Vendor ID',
    'Dispatch Action',
    'Skipped',
    'Reason',
    'Result JSON'
  ],

  /**
   * FUNCTION: dispatchAfterStep2
   * PURPOSE: Continue the business cycle after Step 2 by attempting controlled vendor assignment.
   * INPUT: leadId (string), options (object, optional: source, forceDispatch, vendorIdOverride, sendEmail)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May assign a vendor, create a Vendor Pricing request, send vendor email, and append Vendor Assignment Logs row.
   */
  dispatchAfterStep2: function (leadId, options) {
    // ===== MAIN LOGIC =====
    var targetLeadId = String(leadId || '').trim();
    var settings = options || {};
    try {
      this.ensureVendorAssignmentSetup();

      if (!targetLeadId) {
        var missingLead = { success: false, message: 'leadId is required for vendor assignment dispatch.' };
        this.logVendorAssignmentAttempt_('Post-Step-2 dispatch blocked', missingLead, targetLeadId, '', 'blocked', true, 'MISSING_LEAD_ID');
        return missingLead;
      }

      var leadGate = LeadService.canLeadProceedToQuote(targetLeadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        var blockedLead = {
          success: true,
          message: 'Vendor assignment skipped because lead is not qualified for quote workflow.',
          data: { leadId: targetLeadId, skipped: true, reason: 'LEAD_NOT_QUALIFIED', gate: leadGate }
        };
        this.logVendorAssignmentAttempt_('Post-Step-2 dispatch skipped', blockedLead, targetLeadId, '', 'skipped', true, 'LEAD_NOT_QUALIFIED');
        return blockedLead;
      }

      var duplicateCheck = this.hasActivePricingRequestForLead_(targetLeadId);
      if (!duplicateCheck.success) {
        this.logVendorAssignmentAttempt_('Post-Step-2 duplicate check failed', duplicateCheck, targetLeadId, '', 'blocked', true, 'DUPLICATE_CHECK_FAILED');
        return duplicateCheck;
      }
      if (duplicateCheck.data.hasActiveRequest) {
        var duplicateBlocked = {
          success: true,
          message: 'Vendor assignment skipped because an active vendor pricing request already exists for this lead.',
          data: { leadId: targetLeadId, skipped: true, reason: 'ACTIVE_PRICING_EXISTS', activeRequest: duplicateCheck.data }
        };
        this.logVendorAssignmentAttempt_('Post-Step-2 dispatch skipped', duplicateBlocked, targetLeadId, duplicateCheck.data.vendorId, 'skipped', true, 'ACTIVE_PRICING_EXISTS');
        return duplicateBlocked;
      }

      var enabledResult = this.isAutoVendorAssignmentEnabled_();
      if (!enabledResult.success) {
        this.logVendorAssignmentAttempt_('Post-Step-2 enablement check failed', enabledResult, targetLeadId, '', 'blocked', true, 'ENABLEMENT_CHECK_FAILED');
        return enabledResult;
      }
      if (!enabledResult.data.enabled && settings.forceDispatch !== true) {
        var disabledResult = {
          success: true,
          message: 'Vendor assignment dispatcher is connected, but automatic dispatch is disabled.',
          data: { leadId: targetLeadId, skipped: true, reason: 'AUTO_VENDOR_ASSIGNMENT_DISABLED', settingKey: enabledResult.data.key }
        };
        this.logVendorAssignmentAttempt_('Post-Step-2 dispatch skipped', disabledResult, targetLeadId, '', 'skipped', true, 'AUTO_VENDOR_ASSIGNMENT_DISABLED');
        return disabledResult;
      }

      var vendorId = String(settings.vendorIdOverride || '').trim();
      if (!vendorId) {
        var vendorResult = this.getDefaultVendorId_();
        if (!vendorResult.success) {
          this.logVendorAssignmentAttempt_('Post-Step-2 vendor selection failed', vendorResult, targetLeadId, '', 'blocked', true, 'DEFAULT_VENDOR_LOOKUP_FAILED');
          return vendorResult;
        }
        vendorId = vendorResult.data.vendorId;
      }

      if (!vendorId) {
        var missingVendor = {
          success: true,
          message: 'Vendor assignment dispatcher is connected, but no default vendor is configured.',
          data: { leadId: targetLeadId, skipped: true, reason: 'DEFAULT_VENDOR_NOT_CONFIGURED', settingKey: ConfigService.DEFAULT_VENDOR_ID_FOR_PRICING_KEY }
        };
        this.logVendorAssignmentAttempt_('Post-Step-2 dispatch skipped', missingVendor, targetLeadId, '', 'skipped', true, 'DEFAULT_VENDOR_NOT_CONFIGURED');
        return missingVendor;
      }

      var assignment = VendorService.assignVendorToLead(targetLeadId, vendorId, { sendEmail: settings.sendEmail !== false });
      this.logVendorAssignmentAttempt_(
        assignment.success ? 'Post-Step-2 vendor assigned' : 'Post-Step-2 vendor assignment failed',
        assignment,
        targetLeadId,
        vendorId,
        assignment.success ? 'assigned' : 'blocked',
        !assignment.success,
        assignment.success ? '' : 'ASSIGNMENT_FAILED'
      );
      return assignment;
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.dispatchAfterStep2', error, { leadId: leadId, options: options });
      var failure = { success: false, message: 'Post-Step-2 vendor assignment dispatch failed unexpectedly.' };
      this.logVendorAssignmentAttempt_('Post-Step-2 dispatch failed unexpectedly', failure, targetLeadId, '', 'failed', true, 'UNEXPECTED_ERROR');
      return failure;
    }
  },

  /**
   * FUNCTION: ensureVendorAssignmentSetup
   * PURPOSE: Ensure dispatcher logs and optional Settings rows exist before live use.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create Vendor Assignment Logs and append optional Settings rows.
   */
  ensureVendorAssignmentSetup: function () {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = this.ensureVendorAssignmentSettingsRows_();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var vendorsResult = DatabaseService.ensureVendorsSheetStructure();
      if (!vendorsResult.success) {
        return vendorsResult;
      }

      var pricingResult = VendorPricingService.ensureVendorPricingSheetStructure();
      if (!pricingResult.success) {
        return pricingResult;
      }

      var logsResult = this.ensureVendorAssignmentLogSheet_();
      if (!logsResult.success) {
        return logsResult;
      }

      return {
        success: true,
        message: 'Vendor assignment dispatcher setup verified.',
        data: {
          auditSheet: this.VENDOR_ASSIGNMENT_LOGS_SHEET_NAME,
          enablementSetting: ConfigService.AUTO_VENDOR_ASSIGNMENT_ENABLED_KEY,
          defaultVendorSetting: ConfigService.DEFAULT_VENDOR_ID_FOR_PRICING_KEY
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.ensureVendorAssignmentSetup', error);
      return { success: false, message: 'Failed to verify vendor assignment dispatcher setup.' };
    }
  },

  /**
   * FUNCTION: hasActivePricingRequestForLead_
   * PURPOSE: Prevent duplicate active pricing requests for one lead across all vendors.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  hasActivePricingRequestForLead_: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      var targetLeadId = String(leadId || '').trim();
      if (!targetLeadId) {
        return { success: false, message: 'leadId is required.' };
      }

      var ensureResult = VendorPricingService.ensureVendorPricingSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VendorPricingService.VENDOR_PRICING_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Vendor Pricing sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      var columns = VendorPricingService.getVendorPricingColumnMap_(sheet);
      var activeStatuses = { Requested: true, Submitted: true, 'Under Review': true, Approved: true };
      for (var i = values.length - 1; i >= 1; i--) {
        var rowLeadId = String(values[i][columns.leadId - 1] || '').trim();
        var pricingStatus = String(values[i][columns.pricingStatus - 1] || '').trim();
        if (rowLeadId === targetLeadId && activeStatuses[pricingStatus]) {
          return {
            success: true,
            message: 'Active vendor pricing request exists for lead.',
            data: {
              hasActiveRequest: true,
              leadId: targetLeadId,
              vendorPricingId: String(values[i][columns.vendorPricingId - 1] || '').trim(),
              vendorId: String(values[i][columns.vendorId - 1] || '').trim(),
              pricingStatus: pricingStatus,
              rowNumber: i + 1
            }
          };
        }
      }

      return { success: true, message: 'No active vendor pricing request exists for lead.', data: { hasActiveRequest: false, leadId: targetLeadId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.hasActivePricingRequestForLead_', error, { leadId: leadId });
      return { success: false, message: 'Failed to verify active vendor pricing requests for lead.' };
    }
  },

  /**
   * FUNCTION: isAutoVendorAssignmentEnabled_
   * PURPOSE: Read the explicit enablement setting for live post-Step-2 vendor dispatch.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  isAutoVendorAssignmentEnabled_: function () {
    // ===== MAIN LOGIC =====
    var key = ConfigService.AUTO_VENDOR_ASSIGNMENT_ENABLED_KEY;
    var valueResult = this.getOptionalSettingValue_(key);
    if (!valueResult.success) {
      return valueResult;
    }

    var normalized = String(valueResult.data.value || '').trim().toUpperCase();
    var enabled = normalized === 'TRUE' || normalized === 'YES' || normalized === '1' || normalized === 'ENABLED';
    return { success: true, message: enabled ? 'Automatic vendor assignment is enabled.' : 'Automatic vendor assignment is disabled.', data: { key: key, value: valueResult.data.value, enabled: enabled } };
  },

  /**
   * FUNCTION: getDefaultVendorId_
   * PURPOSE: Read the configured default vendor ID for live vendor assignment dispatch.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getDefaultVendorId_: function () {
    // ===== MAIN LOGIC =====
    var key = ConfigService.DEFAULT_VENDOR_ID_FOR_PRICING_KEY;
    var valueResult = this.getOptionalSettingValue_(key);
    if (!valueResult.success) {
      return valueResult;
    }

    return { success: true, message: valueResult.data.value ? 'Default vendor ID loaded.' : 'Default vendor ID is not configured.', data: { key: key, vendorId: String(valueResult.data.value || '').trim() } };
  },

  /**
   * FUNCTION: getOptionalSettingValue_
   * PURPOSE: Read one optional setting from Settings sheet or Script Properties.
   * INPUT: key (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getOptionalSettingValue_: function (key) {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = DatabaseService.getSettingsMap();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var fromSheet = String(settingsResult.data.settingsMap[key] || '').trim();
      var fromScript = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
      return { success: true, message: 'Optional setting loaded.', data: { key: key, value: fromSheet || fromScript } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.getOptionalSettingValue_', error, { key: key });
      return { success: false, message: 'Failed to load optional setting: ' + key };
    }
  },

  /**
   * FUNCTION: ensureVendorAssignmentSettingsRows_
   * PURPOSE: Add optional dispatcher Settings rows without making them production-required.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May append optional Settings rows.
   */
  ensureVendorAssignmentSettingsRows_: function () {
    // ===== MAIN LOGIC =====
    try {
      var settingsResult = DatabaseService.ensureSettingsSheetStructure();
      if (!settingsResult.success) {
        return settingsResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.SETTINGS_SHEET_NAME);
      var values = sheet.getDataRange().getValues();
      var existing = {};
      for (var i = 1; i < values.length; i++) {
        var key = String(values[i][0] || '').trim();
        if (key) {
          existing[key] = true;
        }
      }

      var optionalRows = [
        [ConfigService.AUTO_VENDOR_ASSIGNMENT_ENABLED_KEY, '', 'OPTIONAL: Set TRUE only after dispatcher runner passes and live vendor dispatch is approved'],
        [ConfigService.DEFAULT_VENDOR_ID_FOR_PRICING_KEY, '', 'OPTIONAL: Vendor ID from Vendors sheet used for post-Step-2 pricing dispatch']
      ];
      optionalRows.forEach(function (row) {
        if (!existing[row[0]]) {
          sheet.appendRow(row);
        }
      });

      return { success: true, message: 'Vendor assignment optional Settings rows verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.ensureVendorAssignmentSettingsRows_', error);
      return { success: false, message: 'Failed to verify vendor assignment Settings rows.' };
    }
  },

  /**
   * FUNCTION: ensureVendorAssignmentLogSheet_
   * PURPOSE: Ensure post-Step-2 vendor assignment dispatch attempts are auditable.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Vendor Assignment Logs sheet if missing.
   */
  ensureVendorAssignmentLogSheet_: function () {
    // ===== MAIN LOGIC =====
    try {
      return DatabaseService.ensureSheetAndHeaders_(this.VENDOR_ASSIGNMENT_LOGS_SHEET_NAME, this.VENDOR_ASSIGNMENT_LOG_HEADERS);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.ensureVendorAssignmentLogSheet_', error);
      return { success: false, message: 'Failed to verify Vendor Assignment Logs sheet structure.' };
    }
  },

  /**
   * FUNCTION: logVendorAssignmentAttempt_
   * PURPOSE: Record one post-Step-2 vendor assignment dispatch decision.
   * INPUT: stage, result, leadId, vendorId, action, skipped, reason
   * OUTPUT: none
   * SIDE EFFECTS: Appends one Vendor Assignment Logs row when possible.
   */
  logVendorAssignmentAttempt_: function (stage, result, leadId, vendorId, action, skipped, reason) {
    // ===== MAIN LOGIC =====
    try {
      this.ensureVendorAssignmentLogSheet_();
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.VENDOR_ASSIGNMENT_LOGS_SHEET_NAME);
      if (!sheet) {
        return;
      }

      sheet.appendRow([
        new Date(),
        stage || '',
        result && result.success ? 'TRUE' : 'FALSE',
        result && result.message ? result.message : '',
        leadId || '',
        vendorId || '',
        action || '',
        skipped ? 'Yes' : 'No',
        reason || '',
        JSON.stringify(result || {})
      ]);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentDispatcherService.logVendorAssignmentAttempt_', error, { stage: stage, result: result });
    }
  }
};

/**
 * FUNCTION: runStage4VendorAssignmentDispatcherSetupTest
 * PURPOSE: Verify post-Step-2 vendor assignment dispatcher setup and optional Settings rows.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Vendor Assignment Logs and optional Settings rows.
 */
function runStage4VendorAssignmentDispatcherSetupTest() {
  // ===== MAIN LOGIC =====
  try {
    return VendorAssignmentDispatcherService.ensureVendorAssignmentSetup();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4VendorAssignmentDispatcherSetupTest', error);
    return { success: false, message: 'Vendor assignment dispatcher setup test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage4VendorAssignmentDispatcherSingleLeadTest
 * PURPOSE: Prove one qualified lead can be dispatched to one eligible vendor without sending external email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates test lead/vendor/pricing/log rows; does not send vendor email.
 */
function runStage4VendorAssignmentDispatcherSingleLeadTest() {
  // ===== MAIN LOGIC =====
  try {
    var testTag = '[TEST][Stage4.1][VendorAssignmentDispatcher]';
    var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    var setup = VendorAssignmentDispatcherService.ensureVendorAssignmentSetup();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Lead ' + runStamp,
      email: 'stage41-vendor-dispatch-' + runStamp + '@example.com',
      company: testTag + ' Customer',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage41VendorDispatcher_' + runStamp,
      notes: testTag + ' Created to prove controlled vendor dispatcher. Safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 95);
    if (!qualify.success) {
      return qualify;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE41-DISPATCH-');
    var vendorEmail = 'test-stage41-vendor-' + runStamp + '@example.com';
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, testTag + ' Eligible Vendor', vendorEmail, 'Yes', 'Yes', 'Approved', testTag + ' Safe to delete']);

    var dispatch = VendorAssignmentDispatcherService.dispatchAfterStep2(lead.data.leadId, {
      source: 'runStage4VendorAssignmentDispatcherSingleLeadTest',
      forceDispatch: true,
      vendorIdOverride: vendorId,
      sendEmail: false
    });

    var duplicateCheck = VendorAssignmentDispatcherService.hasActivePricingRequestForLead_(lead.data.leadId);
    var pass = dispatch.success === true &&
      duplicateCheck.success === true &&
      duplicateCheck.data.hasActiveRequest === true &&
      duplicateCheck.data.vendorId === vendorId;

    return {
      success: pass,
      message: pass ? 'Vendor assignment dispatcher single lead test passed.' : 'Vendor assignment dispatcher single lead test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        dispatch: dispatch,
        duplicateCheck: duplicateCheck
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4VendorAssignmentDispatcherSingleLeadTest', error);
    return { success: false, message: 'Vendor assignment dispatcher single lead test failed unexpectedly.' };
  }
}
