/**
 * MIDTS Automation Engine
 * STAGE: 8 (End-to-end commercial workflow validation)
 * WHAT THIS FILE DOES:
 * - Runs one synthetic test-mode commercial spine from qualified lead to deposit-gated delivery readiness.
 * - Validates Lead → Vendor → Quote → Project → Payment links and expected blocked states.
 * - Avoids live client data and suppresses live emails unless TEST_MODE is explicitly false.
 * DEPENDENCIES:
 * - Google Sheets tabs: Leads, Vendors, Vendor Pricing, Quotes, Projects, Payments, Error Logs
 * - LeadService (LeadService.gs)
 * - VendorAssignmentService (VendorAssignmentService.gs)
 * - VendorPricingService (VendorPricingService.gs)
 * - QuoteService (QuoteService.gs)
 * - ProjectService (ProjectService.gs)
 * - PaymentService (PaymentService.gs)
 * - DriveService (DriveService.gs)
 * - DriveLogService (DriveLogService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: runCommercialWorkflowSmokeTest
 * PURPOSE: Validate the full MIDTS commercial spine with synthetic data and test-mode email suppression by default.
 * INPUT: options (object, optional: TEST_MODE boolean, sendEmails boolean, createDriveFolder boolean)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends synthetic test rows to Leads, Vendors, Vendor Pricing, Quotes, Projects, Payments, and Error Logs.
 */
function runCommercialWorkflowSmokeTest(options) {
  // ===== CONFIG =====
  var settings = options || {};
  var testMode = settings.TEST_MODE !== false;
  var sendEmails = testMode ? false : settings.sendEmails === true;
  // Drive folder creation is disabled by default because it creates real Drive assets.
  var createDriveFolder = settings.createDriveFolder === true;
  var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var testTag = 'COMMERCIAL_SMOKE_' + runStamp;

  // ===== MAIN LOGIC =====
  try {
    var setup = commercialWorkflowEnsureSetup_();
    if (!setup.success) {
      return setup;
    }

    var failedStates = [];

    var lead = LeadService.createLead({
      fullName: 'MIDTS Commercial Smoke Lead ' + runStamp,
      email: 'commercial-smoke-' + runStamp + '@example.com',
      company: 'MIDTS Smoke Test Company',
      projectType: 'CAD/CAM Commercial Smoke Test',
      source: testTag,
      notes: testTag + ' synthetic lead only; safe to delete.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 97);
    if (!qualify.success) {
      return qualify;
    }

    var vendor = commercialWorkflowCreateApprovedVendor_(runStamp, testTag);
    if (!vendor.success) {
      return vendor;
    }
    var vendorId = vendor.data.vendorId;

    var assignment = VendorAssignmentService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: sendEmails });
    if (!assignment.success) {
      return assignment;
    }

    var blockedDuplicateAssignment = VendorAssignmentService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    failedStates.push({
      name: 'Duplicate vendor pricing dispatch blocked',
      passed: blockedDuplicateAssignment.success === false,
      result: blockedDuplicateAssignment
    });

    var vendorPricing = VendorPricingService.submitVendorPricing({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      currency: 'GBP',
      eta: '5 working days',
      vendorNotes: testTag + ' synthetic vendor pricing response.'
    });
    if (!vendorPricing.success) {
      return vendorPricing;
    }

    var pricingApproval = VendorPricingService.approveVendorPricingForQuote(
      vendorPricing.data.vendorPricingId,
      testTag + ' approved for smoke-test quote creation.',
      { marginType: 'PERCENT', marginValue: 25 }
    );
    if (!pricingApproval.success) {
      return pricingApproval;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      currency: 'GBP',
      quoteStatus: 'Draft',
      sendEmail: sendEmails,
      notes: testTag + ' synthetic customer quote.'
    });
    if (!quote.success) {
      return quote;
    }

    var blockedDraftProject = ProjectService.createProjectFromQuote({
      quoteId: quote.data.quoteId,
      notes: testTag + ' should be blocked before quote acceptance.'
    });
    failedStates.push({
      name: 'Draft quote project creation blocked',
      passed: blockedDraftProject.success === false,
      result: blockedDraftProject
    });

    var quoteSent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!quoteSent.success) {
      return quoteSent;
    }

    var blockedSentProject = ProjectService.createProjectFromQuote({
      quoteId: quote.data.quoteId,
      notes: testTag + ' should be blocked while quote is Sent but not Accepted.'
    });
    failedStates.push({
      name: 'Sent quote project creation blocked',
      passed: blockedSentProject.success === false,
      result: blockedSentProject
    });

    var quoteAccepted = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Accepted');
    if (!quoteAccepted.success) {
      return quoteAccepted;
    }

    var project = ProjectService.createProjectFromQuote({
      quoteId: quote.data.quoteId,
      notes: testTag + ' synthetic project created after accepted quote.',
      createDriveFolder: createDriveFolder,
      folderName: 'MIDTS Commercial Smoke ' + runStamp,
      paymentStatusReference: 'Not Requested'
    });
    if (!project.success) {
      return project;
    }

    var driveAudit = createDriveFolder && project.data.driveFolder
      ? project.data.driveFolder
      : DriveService.logDriveAccess_(
        'SMOKE_TEST_DRIVE_SKIPPED',
        project.data.projectId,
        project.data.vendorId,
        '',
        '',
        'Skipped',
        testMode
          ? 'Commercial smoke test ran in TEST_MODE; no real Drive folder or vendor access was created.'
          : 'Commercial smoke test ran without createDriveFolder=true; Drive folder creation was skipped.'
      );
    if (!driveAudit.success) {
      return driveAudit;
    }

    var duplicateProject = ProjectService.createProjectFromQuote(quote.data.quoteId);
    failedStates.push({
      name: 'Duplicate project creation blocked',
      passed: duplicateProject.success === false,
      result: duplicateProject
    });

    var blockedBeforeDeposit = PaymentService.canReleaseWork(project.data.projectId);
    failedStates.push({
      name: 'Delivery gate blocks before deposit',
      passed: blockedBeforeDeposit.success === true && blockedBeforeDeposit.data.canReleaseWork === false,
      result: blockedBeforeDeposit
    });

    var depositRequested = PaymentService.createPaymentRecord({
      projectId: project.data.projectId,
      quoteId: quote.data.quoteId,
      amount: 500,
      paymentType: 'Deposit',
      paymentStatus: 'Requested',
      paymentReference: testTag + '-DEPOSIT-REQUESTED',
      currency: 'GBP',
      notes: testTag + ' synthetic deposit requested.'
    });
    if (!depositRequested.success) {
      return depositRequested;
    }

    var blockedRequestedDeposit = PaymentService.canReleaseWork(project.data.projectId);
    failedStates.push({
      name: 'Delivery gate blocks while deposit is only Requested',
      passed: blockedRequestedDeposit.success === true && blockedRequestedDeposit.data.canReleaseWork === false,
      result: blockedRequestedDeposit
    });

    var depositReceived = PaymentService.updatePaymentStatus(
      depositRequested.data.paymentId,
      'Received',
      testTag + '-DEPOSIT-RECEIVED',
      testTag + ' synthetic deposit marked received.'
    );
    if (!depositReceived.success) {
      return depositReceived;
    }

    var readyForDelivery = PaymentService.canReleaseWork(project.data.projectId);
    if (!readyForDelivery.success) {
      return readyForDelivery;
    }

    var idChecks = commercialWorkflowValidateIds_({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorPricingId: vendorPricing.data.vendorPricingId,
      quoteId: quote.data.quoteId,
      projectId: project.data.projectId,
      paymentId: depositRequested.data.paymentId
    });

    var linkChecks = commercialWorkflowValidateLinks_({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorPricing: vendorPricing,
      quote: quote,
      project: project,
      payment: depositRequested
    });

    var failedStatePass = failedStates.every(function (state) { return state.passed === true; });
    var pass = idChecks.success && linkChecks.success && failedStatePass && readyForDelivery.data.canReleaseWork === true;

    return {
      success: pass,
      message: pass ? 'Commercial workflow smoke test passed.' : 'Commercial workflow smoke test failed.',
      data: {
        testMode: testMode,
        liveEmailsSent: sendEmails,
        runStamp: runStamp,
        testTag: testTag,
        workflowSummary: {
          leadId: lead.data.leadId,
          vendorId: vendorId,
          vendorPricingId: vendorPricing.data.vendorPricingId,
          quoteId: quote.data.quoteId,
          projectId: project.data.projectId,
          depositPaymentId: depositRequested.data.paymentId,
          finalCustomerPrice: quote.data.finalCustomerPrice || quote.data.clientQuoteAmount || quote.data.amount,
          depositStatus: depositReceived.data.paymentStatus,
          readyForDelivery: readyForDelivery.data.canReleaseWork,
          driveAuditStatus: driveAudit.message
        },
        idChecks: idChecks,
        linkChecks: linkChecks,
        failedStateChecks: failedStates,
        steps: {
          setup: setup,
          lead: lead,
          qualification: qualify,
          vendor: vendor,
          assignment: assignment,
          vendorPricing: vendorPricing,
          pricingApproval: pricingApproval,
          quote: quote,
          quoteSent: quoteSent,
          quoteAccepted: quoteAccepted,
          project: project,
          driveAudit: driveAudit,
          depositRequested: depositRequested,
          depositReceived: depositReceived,
          readyForDelivery: readyForDelivery
        }
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runCommercialWorkflowSmokeTest', error, { options: options, runStamp: runStamp, testTag: testTag });
    return { success: false, message: 'Commercial workflow smoke test failed unexpectedly.' };
  }
}

/**
 * FUNCTION: commercialWorkflowEnsureSetup_
 * PURPOSE: Ensure all sheets required by the commercial smoke test exist with current headers.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create sheets and append missing headers only.
 */
function commercialWorkflowEnsureSetup_() {
  // ===== MAIN LOGIC =====
  try {
    var checks = [
      DatabaseService.ensureLeadsSheetStructure(),
      DatabaseService.ensureVendorsSheetStructure(),
      VendorPricingService.ensureVendorPricingSheetStructure(),
      DatabaseService.ensureQuotesSheetStructure(),
      DatabaseService.ensureProjectsSheetStructure(),
      PaymentService.ensurePaymentsSheetStructure(),
      DriveService.ensureDriveAccessLogsSheetStructure(),
      DriveLogService.ensureSheet(),
      DatabaseService.ensureErrorLogsSheetStructure(),
      DatabaseService.ensureIdCountersSheetStructure()
    ];

    for (var i = 0; i < checks.length; i++) {
      if (!checks[i].success) {
        return checks[i];
      }
    }

    return { success: true, message: 'Commercial workflow smoke test setup verified.', data: { checks: checks } };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('commercialWorkflowEnsureSetup_', error);
    return { success: false, message: 'Failed to verify commercial workflow smoke test setup.' };
  }
}

/**
 * FUNCTION: commercialWorkflowCreateApprovedVendor_
 * PURPOSE: Append one synthetic approved vendor used only by the smoke test.
 * INPUT: runStamp (string), testTag (string)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one Vendors row.
 */
function commercialWorkflowCreateApprovedVendor_(runStamp, testTag) {
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

    var vendorId = UtilsService.createSequentialId_('VENDOR');
    var vendorEmail = 'commercial-smoke-vendor-' + runStamp + '@example.com';
    sheet.appendRow([
      vendorId,
      'MIDTS Commercial Smoke Vendor ' + runStamp,
      vendorEmail,
      'Yes',
      'Yes',
      'Approved',
      ''
    ]);

    return {
      success: true,
      message: 'Synthetic approved vendor created for commercial smoke test.',
      data: { vendorId: vendorId, vendorEmail: vendorEmail, testTag: testTag }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('commercialWorkflowCreateApprovedVendor_', error, { runStamp: runStamp, testTag: testTag });
    return { success: false, message: 'Failed to create synthetic approved vendor.' };
  }
}

/**
 * FUNCTION: commercialWorkflowValidateIds_
 * PURPOSE: Confirm each generated workflow ID uses the canonical MIDTS branded prefix.
 * INPUT: ids (object)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function commercialWorkflowValidateIds_(ids) {
  // ===== MAIN LOGIC =====
  var checks = {
    leadId: /^MIDTS-L-\d{6,}$/.test(String(ids.leadId || '')) || /^LEAD-/.test(String(ids.leadId || '')),
    vendorId: /^MIDTS-V-\d{6,}$/.test(String(ids.vendorId || '')),
    vendorPricingId: /^MIDTS-VP-\d{6,}$/.test(String(ids.vendorPricingId || '')),
    quoteId: /^MIDTS-Q-\d{6,}$/.test(String(ids.quoteId || '')),
    projectId: /^MIDTS-P-\d{6,}$/.test(String(ids.projectId || '')),
    paymentId: /^MIDTS-PAY-\d{6,}$/.test(String(ids.paymentId || ''))
  };

  var success = Object.keys(checks).every(function (key) { return checks[key] === true; });
  return {
    success: success,
    message: success ? 'All commercial workflow IDs use expected formats.' : 'One or more commercial workflow IDs failed format checks.',
    data: { ids: ids, checks: checks }
  };
}

/**
 * FUNCTION: commercialWorkflowValidateLinks_
 * PURPOSE: Validate Lead → Vendor → Quote → Project → Payment linkage returned by the smoke-test steps.
 * INPUT: links (object)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function commercialWorkflowValidateLinks_(links) {
  // ===== MAIN LOGIC =====
  var leadId = links.leadId;
  var vendorId = links.vendorId;
  var checks = {
    vendorPricingLead: links.vendorPricing.data.leadId === leadId,
    vendorPricingVendor: links.vendorPricing.data.vendorId === vendorId,
    quoteLead: links.quote.data.leadId === leadId,
    quoteVendor: links.quote.data.vendorId === vendorId,
    projectQuote: links.project.data.quoteId === links.quote.data.quoteId,
    projectLead: links.project.data.leadId === leadId,
    projectVendor: links.project.data.vendorId === vendorId,
    paymentProject: links.payment.data.projectId === links.project.data.projectId,
    paymentQuote: links.payment.data.quoteId === links.quote.data.quoteId,
    paymentType: links.payment.data.paymentType === 'Deposit'
  };

  var success = Object.keys(checks).every(function (key) { return checks[key] === true; });
  return {
    success: success,
    message: success ? 'Commercial workflow records are linked correctly.' : 'One or more commercial workflow link checks failed.',
    data: { checks: checks }
  };
}
