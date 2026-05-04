/**
 * MIDTS Automation Engine
 * STAGE: 6 (Drive access runner functions)
 * WHAT THIS FILE DOES:
 * - Provides top-level Apps Script runner functions for Stage 6 verification.
 * DEPENDENCIES:
 * - Google Drive root folder from Settings sheet: ROOT_DRIVE_FOLDER_ID
 * - Optional test vendor email from Settings sheet: TEST_VENDOR_EMAIL
 * - DriveService (DriveService.gs)
 * - LeadService (LeadService.gs)
 * - QuoteService (QuoteService.gs)
 * - ProjectService (ProjectService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runStage6DriveSetupValidation
 * PURPOSE: Verify Stage 6 sheet setup without creating folders or changing Drive access.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create Drive Access Logs sheet and append Drive Folder ID header to Projects sheet.
 */
function runStage6DriveSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var accessLogs = DriveService.ensureDriveAccessLogsSheetStructure();
    if (!accessLogs.success) {
      return accessLogs;
    }

    var projectMetadata = DriveService.ensureProjectDriveMetadataStructure();
    if (!projectMetadata.success) {
      return projectMetadata;
    }

    return {
      success: true,
      message: 'Stage 6 Drive setup validation completed.',
      data: { accessLogs: accessLogs, projectMetadata: projectMetadata }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage6DriveSetupValidation', error);
    return { success: false, message: 'Stage 6 Drive setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage6DriveAccessWorkflowTest
 * PURPOSE: Verify project folder creation, eligible vendor grant, and access removal with audit logs.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Creates test rows, creates one Drive folder, grants/removes access for TEST_VENDOR_EMAIL.
 */
function runStage6DriveAccessWorkflowTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = runStage6DriveSetupValidation();
    if (!setup.success) {
      return setup;
    }

    // TEST_VENDOR_EMAIL is required so this test never shares Drive access to a hard-coded third-party address.
    var testEmailResult = DriveService.getSettingValue_(DriveService.TEST_VENDOR_EMAIL_KEY);
    if (!testEmailResult.success) {
      return {
        success: false,
        message: 'Set TEST_VENDOR_EMAIL in Settings sheet or Script Properties before running the live Stage 6 Drive access workflow test.',
        data: { missingKey: DriveService.TEST_VENDOR_EMAIL_KEY }
      };
    }

    var lead = LeadService.createLead({
      fullName: 'Stage6 Drive Lead',
      email: 'stage6-drive@example.com',
      company: 'MIDTS Drive Test',
      projectType: 'CAD/CAM',
      source: 'Stage6DriveTest',
      notes: 'Drive access workflow test lead.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 94);
    if (!qualify.success) {
      return qualify;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      amount: 2100,
      currency: 'GBP',
      validUntil: '',
      notes: 'Drive workflow quote.'
    });
    if (!quote.success) {
      return quote;
    }

    var sent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!sent.success) {
      return sent;
    }

    var vendorId = UtilsService.createPrefixedId_('VEND-STAGE6-');
    var vendorSheetResult = DatabaseService.ensureVendorsSheetStructure();
    if (!vendorSheetResult.success) {
      return vendorSheetResult;
    }

    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    vendorSheet.appendRow([vendorId, 'Stage 6 Eligible Vendor', testEmailResult.data.value, 'Yes', 'Yes', 'Approved', '']);

    var project = ProjectService.createProjectFromQuote({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      quoteId: quote.data.quoteId,
      notes: 'Stage 6 Drive project creation test.'
    });
    if (!project.success) {
      return project;
    }

    var folder = DriveService.createProjectFolder(project.data.projectId, 'MIDTS Stage 6 Test ' + project.data.projectId);
    if (!folder.success) {
      return folder;
    }

    var grant = DriveService.grantVendorProjectFolderAccess(project.data.projectId, vendorId);
    if (!grant.success) {
      return grant;
    }

    var remove = DriveService.removeVendorProjectFolderAccess(project.data.projectId, vendorId);

    var pass = folder.success && grant.success && remove.success;

    return {
      success: pass,
      message: pass ? 'Stage 6 Drive access workflow test passed.' : 'Stage 6 Drive access workflow test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        quote: quote,
        quoteSent: sent,
        vendorId: vendorId,
        project: project,
        folder: folder,
        grant: grant,
        remove: remove
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage6DriveAccessWorkflowTest', error);
    return { success: false, message: 'Stage 6 Drive access workflow test failed unexpectedly.' };
  }
}
