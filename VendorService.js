/**
 * MIDTS Automation Engine
 * STAGE: 4 (Vendor assignment security gating)
 * WHAT THIS FILE DOES:
 * - Validates vendor eligibility and assigns approved vendors to leads.
 * - Sends assigned vendors a sanitized pricing request email.
 * DEPENDENCIES:
 * - Google Sheets tab: Vendors
 * - DatabaseService (DatabaseService.gs)
 * - LeadService (LeadService.gs)
 * - VendorAssignmentService (VendorAssignmentService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - EmailService (EmailService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var VendorService = {
  /**
   * FUNCTION: assignVendorToLead
   * PURPOSE: Assign one eligible vendor to one qualified lead and notify the vendor by email.
   * INPUT: leadId (string), vendorId (string), options (object, optional: sendEmail)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates Assigned Lead IDs field in Vendors sheet; may send one Brevo email.
   */
  assignVendorToLead: function (leadId, vendorId, options) {
    // ===== MAIN LOGIC =====
    try {
      var settings = options || {};
      // Delegate to the dedicated assignment workflow so existing callers keep using
      // VendorService while the lead/vendor/pricing updates remain centralized.
      return VendorAssignmentService.assignVendorToLead(leadId, vendorId, {
        sendEmail: settings.sendEmail,
        // Preserve the historic VendorService behavior: assignment can succeed even
        // when an external email dependency is not configured, while the email
        // failure is still logged by VendorAssignmentService.
        requireEmailSuccess: false
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorService.assignVendorToLead', error, { leadId: leadId, vendorId: vendorId });
      return { success: false, message: 'Failed to assign vendor to lead.' };
    }
  },

  /**
   * FUNCTION: sendVendorPricingRequest_
   * PURPOSE: Internal helper to send the assigned vendor sanitized project details and pricing link.
   * INPUT: leadId (string), vendor (object: vendorId, vendorName, vendorEmail)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Sends one Brevo email when configuration is present.
   */
  sendVendorPricingRequest_: function (leadId, vendor) {
    // ===== MAIN LOGIC =====
    try {
      var snapshot = LeadService.getSanitizedVendorLeadSnapshot(leadId);
      if (!snapshot.success) {
        return snapshot;
      }

      return EmailService.sendVendorPricingRequestEmail({
        vendorEmail: vendor.vendorEmail,
        vendorName: vendor.vendorName,
        vendorId: vendor.vendorId,
        lead: snapshot.data.lead
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('VendorService.sendVendorPricingRequest_', error, { leadId: leadId, vendor: vendor });
      return { success: false, message: 'Failed to send vendor pricing request email.' };
    }
  }
  ,
  /**
   * FUNCTION: logVendorPricingDispatchAttempt_
   * PURPOSE: Record pricing dispatch outcomes in Vendor Pricing Logs for operational traceability.
   * INPUT: stage (string), result (object), leadId (string), vendorId (string), vendorEmail (string)
   * OUTPUT: none
   * SIDE EFFECTS: Appends one Vendor Pricing Logs row when possible.
   */
  logVendorPricingDispatchAttempt_: function (stage, result, leadId, vendorId, vendorEmail) {
    // ===== MAIN LOGIC =====
    VendorPricingService.logVendorPricingAttempt_(stage, result, {
      leadId: leadId,
      vendorId: vendorId,
      vendorEmail: vendorEmail
    });
  }
};
