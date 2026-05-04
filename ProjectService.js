/**
 * MIDTS Automation Engine
 * STAGE: 4 (Project creation from qualified lead + eligible vendor)
 * WHAT THIS FILE DOES:
 * - Creates project records only when lead, vendor, and quote prerequisites are valid.
 * DEPENDENCIES:
 * - Google Sheets tab: Projects
 * - LeadService (LeadService.gs)
 * - VendorService (VendorService.gs)
 * - QuoteService (QuoteService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var ProjectService = {
  /**
   * FUNCTION: createProjectFromQuote
   * PURPOSE: Create a project row from a qualified lead, eligible vendor, and quote.
   * INPUT: payload (object: leadId, vendorId, quoteId, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Projects sheet.
   */
  createProjectFromQuote: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var leadId = String(input.leadId || '').trim();
      var vendorId = String(input.vendorId || '').trim();
      var quoteId = String(input.quoteId || '').trim();
      var notes = String(input.notes || '').trim();

      if (!leadId || !vendorId || !quoteId) {
        return { success: false, message: 'leadId, vendorId, and quoteId are required.' };
      }

      var leadGate = LeadService.canLeadProceedToQuote(leadId);
      if (!leadGate.success || !leadGate.data.canProceed) {
        return { success: false, message: 'Lead is not eligible for project creation.', data: leadGate.data || {} };
      }

      var vendorAssignResult = VendorService.assignVendorToLead(leadId, vendorId);
      if (!vendorAssignResult.success) {
        return { success: false, message: 'Vendor assignment prerequisite failed.', data: vendorAssignResult.data || {} };
      }

      var quoteStatusCheck = QuoteService.updateQuoteStatus(quoteId, 'Accepted');
      if (!quoteStatusCheck.success) {
        return { success: false, message: 'Quote must be accepted before project creation.', data: quoteStatusCheck.data || {} };
      }

      var ensureResult = DatabaseService.ensureProjectsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Projects sheet not found.' };
      }

      // Uses unique ID prefix PROJ- for project entities.
      var projectId = UtilsService.createPrefixedId_('PROJ-');
      sheet.appendRow([
        projectId,
        leadId,
        vendorId,
        quoteId,
        new Date(),
        'Open',
        notes
      ]);

      return {
        success: true,
        message: 'Project created successfully.',
        data: { projectId: projectId, leadId: leadId, vendorId: vendorId, quoteId: quoteId }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.createProjectFromQuote', error, { payload: payload });
      return { success: false, message: 'Failed to create project from quote.' };
    }
  }
};
