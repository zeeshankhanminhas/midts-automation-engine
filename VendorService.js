/**
 * MIDTS Automation Engine
 * STAGE: 4 (Vendor assignment security gating)
 * WHAT THIS FILE DOES:
 * - Validates vendor eligibility and assigns approved vendors to leads.
 * DEPENDENCIES:
 * - Google Sheets tab: Vendors
 * - DatabaseService (DatabaseService.gs)
 * - LeadService (LeadService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorService = {
  /**
   * FUNCTION: assignVendorToLead
   * PURPOSE: Assign one eligible vendor to one qualified lead.
   * INPUT: leadId (string), vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates Assigned Lead IDs field in Vendors sheet.
   */
  assignVendorToLead: function (leadId, vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var targetLeadId = String(leadId || '').trim();
      var targetVendorId = String(vendorId || '').trim();
      if (!targetLeadId || !targetVendorId) {
        return { success: false, message: 'leadId and vendorId are required.' };
      }

      var gateResult = LeadService.canLeadProceedToQuote(targetLeadId);
      if (!gateResult.success || !gateResult.data.canProceed) {
        return { success: false, message: 'Lead is not yet qualified for vendor assignment.', data: gateResult.data || {} };
      }

      var ensureResult = DatabaseService.ensureVendorsSheetStructure();
      if (!ensureResult.success) {
        return ensureResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.VENDORS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Vendors sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === targetVendorId) {
          var ndaSigned = String(values[i][3] || '').trim();
          var idVerified = String(values[i][4] || '').trim();
          var approvedStatus = String(values[i][5] || '').trim();

          // Vendor assignment allowed only after NDA, ID verification, and approval.
          var eligible = ndaSigned === 'Yes' && idVerified === 'Yes' && approvedStatus === 'Approved';
          if (!eligible) {
            return {
              success: false,
              message: 'Vendor is not eligible for assignment.',
              data: { vendorId: targetVendorId, ndaSigned: ndaSigned, idVerified: idVerified, approvedStatus: approvedStatus }
            };
          }

          var assignedLeadIds = String(values[i][6] || '').trim();
          var assignedSet = assignedLeadIds ? assignedLeadIds.split(',').map(function (item) { return item.trim(); }) : [];
          if (assignedSet.indexOf(targetLeadId) === -1) {
            assignedSet.push(targetLeadId);
          }
          sheet.getRange(i + 1, 7).setValue(assignedSet.join(', '));

          return {
            success: true,
            message: 'Vendor assigned to lead successfully.',
            data: { leadId: targetLeadId, vendorId: targetVendorId }
          };
        }
      }

      return { success: false, message: 'Vendor not found for provided vendorId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorService.assignVendorToLead', error, { leadId: leadId, vendorId: vendorId });
      return { success: false, message: 'Failed to assign vendor to lead.' };
    }
  }
};
