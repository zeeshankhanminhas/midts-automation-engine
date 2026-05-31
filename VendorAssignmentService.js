/**
 * MIDTS Automation Engine
 * STAGE: 4 (Vendor assignment workflow for qualified leads)
 * WHAT THIS FILE DOES:
 * - Assigns eligible vendors to qualified leads.
 * - Updates both Leads and Vendors sheet records without exposing client Drive links.
 * - Creates a Vendor Pricing request row and triggers the existing EmailService vendor pricing email.
 * DEPENDENCIES:
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Vendors
 * - Google Sheets tab: Vendor Pricing
 * - Google Sheets tab: Error Logs
 * - DatabaseService (DatabaseService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - EmailService (EmailService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorAssignmentService = {
  // ===== CONFIG =====
  // Lead status stored after all assignment gates pass.
  ASSIGNED_VENDOR_STATUS: 'Vendor Assigned',

  // Vendor pricing status created by this workflow before vendor submission.
  VENDOR_PRICING_REQUESTED_STATUS: 'Requested',

  /**
   * FUNCTION: assignVendorToLead
   * PURPOSE: Assign one eligible vendor to one qualified lead and trigger the vendor pricing request email.
   * INPUT: leadId (string), vendorId (string), options (object, optional: sendEmail, requireEmailSuccess)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates Leads and Vendors sheets; appends Vendor Pricing row; may send Brevo email; logs failures to Error Logs.
   */
  assignVendorToLead: function (leadId, vendorId, options) {
    // ===== MAIN LOGIC =====
    var targetLeadId = String(leadId || '').trim();
    var targetVendorId = String(vendorId || '').trim();
    var settings = options || {};

    try {
      if (!targetLeadId || !targetVendorId) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', 'leadId and vendorId are required.', {
          leadId: targetLeadId,
          vendorId: targetVendorId
        });
      }

      var setupResult = this.ensureVendorAssignmentStructure_();
      if (!setupResult.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', setupResult.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          setupResult: setupResult
        });
      }

      var leadResult = this.getLeadForAssignment_(targetLeadId);
      if (!leadResult.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', leadResult.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          leadResult: leadResult
        });
      }

      var lead = leadResult.data.lead;
      if (!lead.isQualified) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', 'Lead must be Qualified before vendor assignment.', {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          status: lead.status,
          qualificationStatus: lead.qualificationStatus
        });
      }

      var vendorResult = this.getVendorForAssignment_(targetVendorId);
      if (!vendorResult.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', vendorResult.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          vendorResult: vendorResult
        });
      }

      var vendor = vendorResult.data.vendor;
      if (!vendor.isEligible) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', 'Vendor is not eligible for assignment.', {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          ndaSigned: vendor.ndaSigned,
          idVerified: vendor.idVerified,
          approvedStatus: vendor.approvedStatus
        });
      }

      var duplicateCheck = VendorPricingService.hasActivePricingRequestForLeadVendor(targetLeadId, targetVendorId);
      if (!duplicateCheck.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', duplicateCheck.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          duplicateCheck: duplicateCheck
        });
      }
      if (duplicateCheck.data.hasActiveRequest) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', 'Active vendor pricing request already exists for this lead/vendor pair.', {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          activeRequest: duplicateCheck.data
        });
      }

      var leadUpdate = this.updateLeadAssignment_(lead, vendor);
      if (!leadUpdate.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', leadUpdate.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          leadUpdate: leadUpdate
        });
      }

      var vendorUpdate = this.updateVendorAssignedLeadIds_(vendor, targetLeadId);
      if (!vendorUpdate.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', vendorUpdate.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          vendorUpdate: vendorUpdate
        });
      }

      var dispatchRecord = VendorPricingService.createVendorPricingDispatchRecord({
        leadId: targetLeadId,
        vendorId: targetVendorId,
        vendorName: vendor.vendorName,
        vendorEmail: vendor.vendorEmail,
        currency: 'GBP',
        eta: '',
        notes: 'Pricing request created by VendorAssignmentService after qualified lead assignment.'
      });
      if (!dispatchRecord.success) {
        return this.fail_('VendorAssignmentService.assignVendorToLead', dispatchRecord.message, {
          leadId: targetLeadId,
          vendorId: targetVendorId,
          dispatchRecord: dispatchRecord
        });
      }

      var emailResult = { success: true, message: 'Vendor pricing email skipped by options.', data: { skipped: true } };
      if (settings.sendEmail !== false) {
        emailResult = this.sendVendorPricingRequest_(lead, vendor);
        if (!emailResult.success) {
          var emailFailure = this.fail_('VendorAssignmentService.assignVendorToLead', emailResult.message, {
            leadId: targetLeadId,
            vendorId: targetVendorId,
            emailResult: emailResult,
            vendorPricingId: dispatchRecord.data.vendorPricingId
          });
          emailFailure.data = this.buildResponseData_(lead, vendor, leadUpdate, vendorUpdate, dispatchRecord, emailResult);

          // Email delivery is mandatory by default because the vendor must receive the pricing request.
          if (settings.requireEmailSuccess === false) {
            emailFailure.success = true;
            emailFailure.message = 'Vendor assigned and pricing request created, but vendor pricing email failed.';
          }
          return emailFailure;
        }
      }

      return {
        success: true,
        message: 'Vendor assigned to qualified lead and vendor pricing request email triggered.',
        data: this.buildResponseData_(lead, vendor, leadUpdate, vendorUpdate, dispatchRecord, emailResult)
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.assignVendorToLead', error, { leadId: leadId, vendorId: vendorId });
      return { success: false, message: 'Failed to assign vendor to lead.' };
    }
  },

  /**
   * FUNCTION: ensureVendorAssignmentStructure_
   * PURPOSE: Ensure all sheets and headers needed by assignment workflow exist before reads/writes.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create sheets and append missing headers only.
   */
  ensureVendorAssignmentStructure_: function () {
    // ===== MAIN LOGIC =====
    try {
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }

      var vendorsResult = DatabaseService.ensureVendorsSheetStructure();
      if (!vendorsResult.success) {
        return vendorsResult;
      }

      var pricingResult = VendorPricingService.ensureVendorPricingSheetStructure();
      if (!pricingResult.success) {
        return pricingResult;
      }

      return { success: true, message: 'Vendor assignment sheet structure verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.ensureVendorAssignmentStructure_', error);
      return { success: false, message: 'Failed to verify vendor assignment sheet structure.' };
    }
  },

  /**
   * FUNCTION: getLeadForAssignment_
   * PURPOSE: Load a lead and derive whether it is qualified for vendor assignment.
   * INPUT: leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getLeadForAssignment_: function (leadId) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        var rowLeadId = String(values[i][columns['Lead ID'] - 1] || '').trim();
        if (rowLeadId === String(leadId || '').trim()) {
          var status = String(values[i][columns.Status - 1] || '').trim();
          var qualificationStatus = String(values[i][columns['Qualification Status'] - 1] || '').trim();
          // Qualified in either status field is accepted because historical stages may update both fields.
          var isQualified = qualificationStatus === 'Qualified' || status === 'Qualified';

          return {
            success: true,
            message: 'Lead found for vendor assignment.',
            data: {
              lead: {
                leadId: rowLeadId,
                rowNumber: i + 1,
                columns: columns,
                fullName: String(values[i][columns['Full Name'] - 1] || '').trim(),
                email: String(values[i][columns.Email - 1] || '').trim(),
                company: String(values[i][columns.Company - 1] || '').trim(),
                projectType: String(values[i][columns['Project Type'] - 1] || '').trim(),
                status: status,
                source: String(values[i][columns.Source - 1] || '').trim(),
                notes: String(values[i][columns.Notes - 1] || '').trim(),
                qualificationStatus: qualificationStatus,
                leadScore: Number(values[i][columns['Lead Score'] - 1] || 0),
                highValueFlag: String(values[i][columns['High Value Flag'] - 1] || '').trim(),
                isQualified: isQualified
              }
            }
          };
        }
      }

      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.getLeadForAssignment_', error, { leadId: leadId });
      return { success: false, message: 'Failed to load lead for vendor assignment.' };
    }
  },

  /**
   * FUNCTION: getVendorForAssignment_
   * PURPOSE: Load a vendor and derive whether it satisfies NDA, ID, and approval eligibility gates.
   * INPUT: vendorId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getVendorForAssignment_: function (vendorId) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Vendors sheet not found.' };
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        var rowVendorId = String(values[i][columns['Vendor ID'] - 1] || '').trim();
        if (rowVendorId === String(vendorId || '').trim()) {
          var ndaSigned = String(values[i][columns['NDA Signed'] - 1] || '').trim();
          var idVerified = String(values[i][columns['ID Verified'] - 1] || '').trim();
          var approvedStatus = String(values[i][columns['Approved Status'] - 1] || '').trim();
          // Vendor access is allowed only when all security prerequisites are satisfied.
          var isEligible = ndaSigned === 'Yes' && idVerified === 'Yes' && approvedStatus === 'Approved';

          return {
            success: true,
            message: 'Vendor found for assignment.',
            data: {
              vendor: {
                vendorId: rowVendorId,
                rowNumber: i + 1,
                columns: columns,
                vendorName: String(values[i][columns['Vendor Name'] - 1] || '').trim(),
                vendorEmail: String(values[i][columns.Email - 1] || '').trim(),
                ndaSigned: ndaSigned,
                idVerified: idVerified,
                approvedStatus: approvedStatus,
                assignedLeadIds: String(values[i][columns['Assigned Lead IDs'] - 1] || '').trim(),
                isEligible: isEligible
              }
            }
          };
        }
      }

      return { success: false, message: 'Vendor not found for provided vendorId.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.getVendorForAssignment_', error, { vendorId: vendorId });
      return { success: false, message: 'Failed to load vendor for assignment.' };
    }
  },

  /**
   * FUNCTION: updateLeadAssignment_
   * PURPOSE: Mark the lead with the assigned vendor and assignment status.
   * INPUT: lead (object), vendor (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one existing Leads row.
   */
  updateLeadAssignment_: function (lead, vendor) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      var columns = this.getHeaderMap_(sheet);
      var assignedAt = new Date();

      sheet.getRange(lead.rowNumber, columns['Assigned Vendor ID']).setValue(vendor.vendorId);
      sheet.getRange(lead.rowNumber, columns['Assigned Vendor Status']).setValue(this.ASSIGNED_VENDOR_STATUS);
      sheet.getRange(lead.rowNumber, columns['Vendor Assigned At']).setValue(assignedAt);
      sheet.getRange(lead.rowNumber, columns['Vendor Pricing Status']).setValue(this.VENDOR_PRICING_REQUESTED_STATUS);

      return {
        success: true,
        message: 'Lead assignment fields updated.',
        data: {
          leadId: lead.leadId,
          assignedVendorId: vendor.vendorId,
          assignedVendorStatus: this.ASSIGNED_VENDOR_STATUS,
          vendorPricingStatus: this.VENDOR_PRICING_REQUESTED_STATUS,
          assignedAt: assignedAt
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.updateLeadAssignment_', error, { lead: lead, vendor: vendor });
      return { success: false, message: 'Failed to update lead assignment fields.' };
    }
  },

  /**
   * FUNCTION: updateVendorAssignedLeadIds_
   * PURPOSE: Append the lead ID to the vendor Assigned Lead IDs field without duplicates.
   * INPUT: vendor (object), leadId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one existing Vendors row.
   */
  updateVendorAssignedLeadIds_: function (vendor, leadId) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
      var columns = this.getHeaderMap_(sheet);
      var assignedSet = String(vendor.assignedLeadIds || '').trim()
        ? String(vendor.assignedLeadIds || '').split(',').map(function (item) { return item.trim(); }).filter(function (item) { return item; })
        : [];

      if (assignedSet.indexOf(leadId) === -1) {
        assignedSet.push(leadId);
      }

      sheet.getRange(vendor.rowNumber, columns['Assigned Lead IDs']).setValue(assignedSet.join(', '));

      return {
        success: true,
        message: 'Vendor assigned lead IDs updated.',
        data: { vendorId: vendor.vendorId, assignedLeadIds: assignedSet }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.updateVendorAssignedLeadIds_', error, { vendor: vendor, leadId: leadId });
      return { success: false, message: 'Failed to update vendor assigned lead IDs.' };
    }
  },

  /**
   * FUNCTION: sendVendorPricingRequest_
   * PURPOSE: Trigger existing EmailService with a sanitized lead snapshot and no client Drive links.
   * INPUT: lead (object), vendor (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one vendor pricing request email through EmailService.
   */
  sendVendorPricingRequest_: function (lead, vendor) {
    // ===== MAIN LOGIC =====
    try {
      return EmailService.sendVendorPricingRequestEmail({
        vendorEmail: vendor.vendorEmail,
        vendorName: vendor.vendorName,
        vendorId: vendor.vendorId,
        lead: {
          leadId: lead.leadId,
          company: lead.company,
          projectType: lead.projectType,
          status: lead.status,
          source: lead.source,
          notes: lead.notes,
          qualificationStatus: lead.qualificationStatus,
          leadScore: lead.leadScore,
          highValueFlag: lead.highValueFlag
        }
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorAssignmentService.sendVendorPricingRequest_', error, { lead: lead, vendor: vendor });
      return { success: false, message: 'Failed to trigger vendor pricing request email.' };
    }
  },

  /**
   * FUNCTION: buildResponseData_
   * PURPOSE: Build a consistent structured response for assignment outcomes.
   * INPUT: lead, vendor, leadUpdate, vendorUpdate, dispatchRecord, emailResult
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  buildResponseData_: function (lead, vendor, leadUpdate, vendorUpdate, dispatchRecord, emailResult) {
    // ===== MAIN LOGIC =====
    return {
      leadId: lead.leadId,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      leadAssignment: leadUpdate,
      vendorAssignment: vendorUpdate,
      dispatchRecord: dispatchRecord,
      vendorPricingId: dispatchRecord && dispatchRecord.data ? dispatchRecord.data.vendorPricingId : '',
      emailNotification: emailResult
    };
  },

  /**
   * FUNCTION: getHeaderMap_
   * PURPOSE: Resolve sheet header names to 1-based column numbers for schema-safe updates.
   * INPUT: sheet (Google Sheet object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  getHeaderMap_: function (sheet) {
    // ===== MAIN LOGIC =====
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    headers.forEach(function (header, index) {
      var name = String(header || '').trim();
      if (name) {
        map[name] = index + 1;
      }
    });
    return map;
  },

  /**
   * FUNCTION: fail_
   * PURPOSE: Return a structured failure and log it to Error Logs for auditability.
   * INPUT: functionName (string), message (string), context (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Error Logs row.
   */
  fail_: function (functionName, message, context) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_(functionName, new Error(message), context || {});
    return { success: false, message: message, data: context || {} };
  }
};

/**
 * FUNCTION: runStage4VendorAssignmentWorkflowSetupValidation
 * PURPOSE: Verify sheets/headers required for the qualified lead vendor assignment workflow.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create sheets and append missing headers only.
 */
function runStage4VendorAssignmentWorkflowSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    return VendorAssignmentService.ensureVendorAssignmentStructure_();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4VendorAssignmentWorkflowSetupValidation', error);
    return { success: false, message: 'Vendor assignment workflow setup validation failed unexpectedly.' };
  }
}


/**
 * FUNCTION: runStage4VendorAssignmentWorkflowDryRunTest
 * PURPOSE: Verify unqualified leads are blocked, unapproved vendors are blocked, and valid assignments update both records without sending live email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test Leads, Vendors, Vendor Pricing, and Error Logs rows.
 */
function runStage4VendorAssignmentWorkflowDryRunTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = VendorAssignmentService.ensureVendorAssignmentStructure_();
    if (!setup.success) {
      return setup;
    }

    var unqualifiedLead = LeadService.createLead({
      fullName: 'Vendor Assignment Unqualified Lead',
      email: 'vendor-assignment-unqualified@example.com',
      company: 'MIDTS Vendor Assignment Dry Run',
      projectType: 'CAD',
      source: 'VendorAssignmentDryRun',
      notes: 'Dry-run lead that must remain blocked before qualification.'
    });
    if (!unqualifiedLead.success) {
      return unqualifiedLead;
    }

    var qualifiedLead = LeadService.createLead({
      fullName: 'Vendor Assignment Qualified Lead',
      email: 'vendor-assignment-qualified@example.com',
      company: 'MIDTS Vendor Assignment Dry Run',
      projectType: 'CAM',
      source: 'VendorAssignmentDryRun',
      notes: 'Dry-run lead that should assign to an eligible vendor.'
    });
    if (!qualifiedLead.success) {
      return qualifiedLead;
    }

    var qualify = LeadService.markStep2Completed(qualifiedLead.data.leadId, 90);
    if (!qualify.success) {
      return qualify;
    }

    var vendorsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    var blockedVendorId = UtilsService.createSequentialId_('VENDOR');
    var eligibleVendorId = UtilsService.createSequentialId_('VENDOR');
    vendorsSheet.appendRow([blockedVendorId, 'Blocked Assignment Vendor', 'blocked-assignment-vendor@example.com', 'No', 'No', 'Pending', '']);
    vendorsSheet.appendRow([eligibleVendorId, 'Eligible Assignment Vendor', 'eligible-assignment-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var unqualifiedBlocked = VendorAssignmentService.assignVendorToLead(unqualifiedLead.data.leadId, eligibleVendorId, { sendEmail: false });
    var vendorBlocked = VendorAssignmentService.assignVendorToLead(qualifiedLead.data.leadId, blockedVendorId, { sendEmail: false });
    var validAssignment = VendorAssignmentService.assignVendorToLead(qualifiedLead.data.leadId, eligibleVendorId, { sendEmail: false });

    var pass = unqualifiedBlocked.success === false &&
      vendorBlocked.success === false &&
      validAssignment.success === true &&
      validAssignment.data.leadAssignment.data.assignedVendorId === eligibleVendorId &&
      validAssignment.data.vendorAssignment.data.assignedLeadIds.indexOf(qualifiedLead.data.leadId) !== -1 &&
      validAssignment.data.dispatchRecord.success === true;

    return {
      success: pass,
      message: pass ? 'Vendor assignment workflow dry-run test passed.' : 'Vendor assignment workflow dry-run test failed.',
      data: {
        unqualifiedBlocked: unqualifiedBlocked,
        vendorBlocked: vendorBlocked,
        validAssignment: validAssignment,
        note: 'Dry run intentionally skips live email. Use VendorAssignmentService.assignVendorToLead(leadId, vendorId) with configured Brevo settings to validate live email triggering.'
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage4VendorAssignmentWorkflowDryRunTest', error);
    return { success: false, message: 'Vendor assignment workflow dry-run test failed unexpectedly.' };
  }
}
