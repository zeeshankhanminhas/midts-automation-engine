/**
 * MIDTS Automation Engine
 * Stage 4.2 - Controlled default vendor email dispatch runner
 *
 * Purpose:
 * - Proves the post-Step-2 vendor assignment path can use DEFAULT_VENDOR_ID_FOR_PRICING.
 * - Proves a vendor pricing request row is created.
 * - Proves the real vendor pricing email path is called successfully.
 *
 * Important:
 * - This is a manual validation runner only.
 * - Running this function sends one real vendor pricing request email to the default vendor.
 * - Do not attach this runner to a time trigger.
 */

function runStage4VendorAssignmentDispatcherDefaultVendorEmailTest() {
  try {
    var testTag = '[TEST][Stage4.2][DefaultVendorEmailDispatcher]';
    var runStamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    );

    var setup = VendorAssignmentDispatcherService.ensureVendorAssignmentSetup();
    if (!setup.success) {
      return setup;
    }

    var defaultVendor = VendorAssignmentDispatcherService.getDefaultVendorId_();
    if (!defaultVendor.success) {
      return defaultVendor;
    }

    if (!defaultVendor.data.vendorId) {
      return {
        success: false,
        message: 'DEFAULT_VENDOR_ID_FOR_PRICING is not configured.',
        data: defaultVendor.data
      };
    }

    var vendorSnapshot = VendorAssignmentDispatcherService.getVendorSnapshot_(defaultVendor.data.vendorId);
    if (!vendorSnapshot.success) {
      return vendorSnapshot;
    }

    var vendor = vendorSnapshot.data.vendor;
    if (!vendor.vendorEmail || vendor.vendorEmail.indexOf('@') === -1) {
      return {
        success: false,
        message: 'Default vendor does not have a valid email address.',
        data: {
          vendorId: defaultVendor.data.vendorId,
          vendorEmail: vendor.vendorEmail || ''
        }
      };
    }

    if (vendor.ndaSigned !== 'Yes' || vendor.idVerified !== 'Yes' || vendor.approvedStatus !== 'Approved') {
      return {
        success: false,
        message: 'Default vendor is not eligible for pricing dispatch.',
        data: {
          vendorId: defaultVendor.data.vendorId,
          ndaSigned: vendor.ndaSigned,
          idVerified: vendor.idVerified,
          approvedStatus: vendor.approvedStatus
        }
      };
    }

    var pricingFormBaseUrl = EmailService.getSettingValue_(ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY);
    if (!pricingFormBaseUrl.success) {
      return pricingFormBaseUrl;
    }

    var lead = LeadService.createLead({
      fullName: testTag + ' Lead ' + runStamp,
      email: 'stage42-default-vendor-email-' + runStamp + '@example.com',
      company: 'MIDTS Automation Test',
      projectType: 'CAD/CAM',
      source: 'TEST_Stage42DefaultVendorEmailDispatcher_' + runStamp,
      notes: testTag + ' Creates one controlled lead and sends one real vendor pricing email. Safe to delete.'
    });

    if (!lead.success) {
      return lead;
    }

    var step2 = LeadService.markStep2Completed(lead.data.leadId, 95);
    if (!step2.success) {
      return step2;
    }

    var dispatch = VendorAssignmentDispatcherService.dispatchAfterStep2(lead.data.leadId, {
      source: 'runStage4VendorAssignmentDispatcherDefaultVendorEmailTest',
      forceDispatch: true,
      sendEmail: true
    });

    var dispatchData = dispatch && dispatch.data ? dispatch.data : {};
    var emailNotification = dispatchData.emailNotification || null;
    var dispatchRecord = dispatchData.dispatchRecord || null;

    var passed = dispatch.success === true &&
      dispatchData.vendorId === defaultVendor.data.vendorId &&
      dispatchRecord &&
      dispatchRecord.success === true &&
      emailNotification &&
      emailNotification.success === true;

    return {
      success: passed,
      message: passed
        ? 'Default vendor email dispatcher test passed.'
        : 'Default vendor email dispatcher test failed.',
      data: {
        leadId: lead.data.leadId,
        vendorId: dispatchData.vendorId || defaultVendor.data.vendorId,
        vendorEmail: vendor.vendorEmail,
        vendorPricingId: dispatchRecord && dispatchRecord.data
          ? dispatchRecord.data.vendorPricingId
          : '',
        pricingFormBaseUrlConfigured: true,
        dispatch: dispatch,
        emailNotification: emailNotification
      }
    };
  } catch (error) {
    ErrorLogger.logError_(
      'Stage4.2DefaultVendorEmailDispatcher',
      'runStage4VendorAssignmentDispatcherDefaultVendorEmailTest',
      error,
      {}
    );

    return {
      success: false,
      message: 'Default vendor email dispatcher test failed: ' + error.message,
      data: {
        error: error.message,
        stack: error.stack
      }
    };
  }
}
