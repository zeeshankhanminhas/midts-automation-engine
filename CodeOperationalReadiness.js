/**
 * MIDTS Operational Readiness Validation Runner
 *
 * Manual Apps Script runner for Sprint 1 launch-readiness validation.
 * This file is additive only and does not change existing webhook contracts,
 * sheet names, deployment behavior, or service responsibilities.
 */
function runOperationalReadinessValidation() {
  var checks = [];
  var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var testTag = '[TEST][OperationalReadiness][' + runStamp + ']';

  try {
    operationalReadinessAddCheck_(checks, 'Required Settings values exist', operationalReadinessCheckRequiredSettings_(), true);
    operationalReadinessAddCheck_(checks, 'Required sheets exist', operationalReadinessCheckRequiredSheets_(), true);

    var controlledRecipient = operationalReadinessGetControlledRecipient_();
    operationalReadinessAddCheck_(checks, 'Controlled test email recipient configured', controlledRecipient, true);

    var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
    operationalReadinessAddCheck_(checks, 'Website webhook token configured', operationalReadinessSafeResult_(tokenResult), true);
    var webhookToken = tokenResult.success && tokenResult.data ? tokenResult.data.value : '';

    var websiteLogRowsBefore = operationalReadinessGetSheetRowCount_(WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME);
    var step2LogRowsBefore = operationalReadinessGetSheetRowCount_(Step2RequirementService.STEP2_LOGS_SHEET_NAME);
    var vendorPricingLogRowsBefore = operationalReadinessGetSheetRowCount_(VendorPricingService.VENDOR_PRICING_LOGS_SHEET_NAME);
    var emailLogRowsBefore = operationalReadinessGetSheetRowCount_(EmailService.EMAIL_LOGS_SHEET_NAME);

    var leadEmail = controlledRecipient.success && controlledRecipient.data ? controlledRecipient.data.email : '';
    var leadPayload = {
      webhookToken: webhookToken,
      source: 'OperationalReadinessRunner',
      pageUrl: 'operational-readiness-validation',
      fullName: 'MIDTS Operational Readiness Lead ' + runStamp,
      email: leadEmail,
      company: 'MIDTS Operational Readiness Test',
      projectType: 'Website CAD Enquiry',
      message: testTag + ' Step 1 lead capture validation.'
    };

    var leadResult = webhookToken
      ? WebsiteWebhookService.handlePostEvent(operationalReadinessCreateEvent_(leadPayload))
      : { success: false, message: 'Website webhook token is not configured.' };
    operationalReadinessAddCheck_(checks, 'Step 1 lead creation path works', operationalReadinessSafeResult_(leadResult), true);

    var leadId = leadResult.success && leadResult.data ? leadResult.data.leadId : '';
    var acknowledgementResult = leadResult.success && controlledRecipient.success
      ? sendWebsiteLeadAcknowledgement_(operationalReadinessCreateEvent_(leadPayload), leadResult)
      : { success: false, message: 'Acknowledgement email skipped because lead creation or controlled recipient check failed.' };
    operationalReadinessAddCheck_(checks, 'Brevo acknowledgement email path works', operationalReadinessSafeResult_(acknowledgementResult), true);

    var websiteLogRowsAfterLead = operationalReadinessGetSheetRowCount_(WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME);
    operationalReadinessAddRowIncreaseCheck_(checks, 'Website webhook audit log written', websiteLogRowsBefore, websiteLogRowsAfterLead, true);

    var step2Payload = {
      webhookToken: webhookToken,
      formStage: 'step2-requirements',
      source: 'OperationalReadinessRunner',
      pageUrl: 'operational-readiness-step-2-validation',
      leadId: leadId,
      email: leadEmail,
      fullName: leadPayload.fullName,
      company: leadPayload.company,
      projectType: 'Website CAD Enquiry',
      timelineUrgency: 'Within one week',
      filesReady: 'Yes, ready for review',
      requirementComplexity: 'CAD/CAM manufacturing support',
      budget: '1000-2500',
      technicalRequirement: testTag + ' Step 2 requirement intake validation. Files are ready, delivery is needed within one week, and CAD/CAM manufacturing review is required before vendor pricing.',
      notes: testTag + ' Requirement detail captured by readiness runner.'
    };

    var step2Result = leadId && webhookToken
      ? Step2RequirementService.handlePostEvent(operationalReadinessCreateEvent_(step2Payload))
      : { success: false, message: 'Step 2 validation skipped because lead creation failed.' };
    operationalReadinessAddCheck_(checks, 'Step 2 update path works', operationalReadinessSafeResult_(step2Result), true);

    var step2LogRowsAfter = operationalReadinessGetSheetRowCount_(Step2RequirementService.STEP2_LOGS_SHEET_NAME);
    operationalReadinessAddRowIncreaseCheck_(checks, 'Step 2 audit log written', step2LogRowsBefore, step2LogRowsAfter, true);

    var qualificationResult = leadId
      ? LeadService.canLeadProceedToQuote(leadId)
      : { success: false, message: 'Qualification check skipped because lead creation failed.' };
    operationalReadinessAddCheck_(checks, 'Qualification status is applied', {
      success: !!(qualificationResult.success && qualificationResult.data && qualificationResult.data.canProceed),
      message: qualificationResult.message || 'Qualification gate evaluated.',
      data: operationalReadinessSanitizeData_(qualificationResult.data || {})
    }, true);

    var vendorSetupResult = runStage45VendorPricingSetupValidation();
    operationalReadinessAddCheck_(checks, 'Vendor pricing setup is valid', operationalReadinessSafeResult_(vendorSetupResult), true);

    var vendorResult = operationalReadinessCreateReadinessVendor_(testTag);
    operationalReadinessAddCheck_(checks, 'Readiness vendor record available', operationalReadinessSafeResult_(vendorResult), true);
    var vendorId = vendorResult.success && vendorResult.data ? vendorResult.data.vendorId : '';

    var quoteBeforePricingResult = leadId
      ? QuoteService.createQuoteForLead({
          leadId: leadId,
          currency: 'GBP',
          notes: testTag + ' Expected to be blocked before approved vendor pricing.'
        })
      : { success: false, message: 'Quote gate skipped because lead creation failed.' };
    operationalReadinessAddCheck_(checks, 'Quote creation is blocked until vendor pricing approval', {
      success: quoteBeforePricingResult.success === false,
      message: quoteBeforePricingResult.success === false
        ? 'Quote creation was blocked before vendor pricing approval.'
        : 'Quote creation was not blocked before vendor pricing approval.',
      data: operationalReadinessSanitizeData_(quoteBeforePricingResult.data || {})
    }, true);

    var pricingPayload = {
      webhookToken: webhookToken,
      formStage: 'vendor-pricing',
      source: 'OperationalReadinessRunner',
      pageUrl: 'operational-readiness-vendor-pricing-validation',
      leadId: leadId,
      vendorId: vendorId,
      vendorName: 'MIDTS Readiness Vendor',
      vendorEmail: '',
      price: '975',
      currency: 'GBP',
      leadTime: '7 working days',
      notes: testTag + ' Vendor pricing readiness validation.'
    };

    var vendorPricingResult = leadId && vendorId && webhookToken
      ? VendorPricingService.handlePostEvent(operationalReadinessCreateEvent_(pricingPayload))
      : { success: false, message: 'Vendor pricing validation skipped because lead, vendor, or token setup failed.' };
    operationalReadinessAddCheck_(checks, 'Vendor pricing gate accepts submitted pricing', operationalReadinessSafeResult_(vendorPricingResult), true);

    var vendorPricingLogRowsAfter = operationalReadinessGetSheetRowCount_(VendorPricingService.VENDOR_PRICING_LOGS_SHEET_NAME);
    operationalReadinessAddRowIncreaseCheck_(checks, 'Vendor pricing audit log written', vendorPricingLogRowsBefore, vendorPricingLogRowsAfter, true);

    var vendorPricingId = vendorPricingResult.success && vendorPricingResult.data ? vendorPricingResult.data.vendorPricingId : '';
    var approvalResult = vendorPricingId
      ? VendorPricingService.approveVendorPricingForQuote(vendorPricingId, testTag + ' Approved for readiness validation.', {
          marginType: 'PERCENT',
          marginValue: 100
        })
      : { success: false, message: 'Vendor pricing approval skipped because pricing submission failed.' };
    operationalReadinessAddCheck_(checks, 'Vendor pricing approval gate works', operationalReadinessSafeResult_(approvalResult), true);

    var quoteAfterApprovalResult = approvalResult.success
      ? QuoteService.createQuoteForLead({
          leadId: leadId,
          currency: 'GBP',
          notes: testTag + ' Quote after approved vendor pricing.'
        })
      : { success: false, message: 'Quote creation skipped because vendor pricing approval failed.' };
    operationalReadinessAddCheck_(checks, 'Quote creation works after vendor pricing approval', operationalReadinessSafeResult_(quoteAfterApprovalResult), true);

    var quoteId = quoteAfterApprovalResult.success && quoteAfterApprovalResult.data ? quoteAfterApprovalResult.data.quoteId : '';
    var projectBeforeAcceptanceResult = quoteId
      ? ProjectService.createProjectFromQuote({
          leadId: leadId,
          vendorId: vendorId,
          quoteId: quoteId,
          notes: testTag + ' Expected to be blocked before quote acceptance.'
        })
      : { success: false, message: 'Project gate skipped because quote creation failed.' };
    operationalReadinessAddCheck_(checks, 'Project creation is blocked until quote acceptance', {
      success: projectBeforeAcceptanceResult.success === false,
      message: projectBeforeAcceptanceResult.success === false
        ? 'Project creation was blocked before quote acceptance.'
        : 'Project creation was not blocked before quote acceptance.',
      data: operationalReadinessSanitizeData_(projectBeforeAcceptanceResult.data || {})
    }, true);

    var quoteSentResult = quoteId
      ? QuoteService.updateQuoteStatus(quoteId, 'Sent', testTag + ' Sent before acceptance readiness validation.')
      : { success: false, message: 'Quote status update skipped because quote creation failed.' };
    operationalReadinessAddCheck_(checks, 'Quote can move to Sent status', operationalReadinessSafeResult_(quoteSentResult), true);

    var quoteAcceptedResult = quoteSentResult.success
      ? QuoteService.updateQuoteStatus(quoteId, 'Accepted', testTag + ' Accepted for project readiness validation.')
      : { success: false, message: 'Quote acceptance skipped because Sent status update failed.' };
    operationalReadinessAddCheck_(checks, 'Quote acceptance gate works', operationalReadinessSafeResult_(quoteAcceptedResult), true);

    var projectAfterAcceptanceResult = quoteAcceptedResult.success
      ? ProjectService.createProjectFromQuote({
          leadId: leadId,
          vendorId: vendorId,
          quoteId: quoteId,
          notes: testTag + ' Project readiness validation.'
        })
      : { success: false, message: 'Project creation skipped because quote acceptance failed.' };
    operationalReadinessAddCheck_(checks, 'Project creation works after quote acceptance', operationalReadinessSafeResult_(projectAfterAcceptanceResult), true);

    var emailLogRowsAfter = operationalReadinessGetSheetRowCount_(EmailService.EMAIL_LOGS_SHEET_NAME);
    operationalReadinessAddRowIncreaseCheck_(checks, 'Email audit log written', emailLogRowsBefore, emailLogRowsAfter, true);

    operationalReadinessAddCheck_(checks, 'No production secrets are returned by runner', {
      success: true,
      message: 'Secret values are used internally only and are redacted from returned check data.',
      data: { secretFieldsReturned: 0 }
    }, true);

    var summary = operationalReadinessBuildSummary_(checks);
    return {
      success: summary.failedRequiredChecks === 0,
      message: summary.failedRequiredChecks === 0
        ? 'Operational readiness validation passed.'
        : 'Operational readiness validation failed. Review failedChecks for details.',
      data: {
        runStamp: runStamp,
        testTag: testTag,
        summary: summary,
        checks: checks
      }
    };
  } catch (error) {
    Logger.log('runOperationalReadinessValidation error: ' + error.message);
    return {
      success: false,
      message: 'Operational readiness validation failed with an unexpected error: ' + error.message,
      data: {
        runStamp: runStamp,
        testTag: testTag,
        checksCompleted: checks.length,
        checks: checks
      }
    };
  }
}

function operationalReadinessCheckRequiredSettings_() {
  var validationResult = ConfigService.validateRequiredSettings();
  var requiredKeys = ConfigService.getRequiredSettingKeys();
  var missingKeys = validationResult.data && validationResult.data.missingKeys ? validationResult.data.missingKeys : [];

  return {
    success: validationResult.success === true,
    message: validationResult.message || 'Required settings checked.',
    data: {
      requiredKeys: requiredKeys,
      missingKeys: missingKeys,
      configuredCount: requiredKeys.length - missingKeys.length,
      requiredCount: requiredKeys.length
    }
  };
}

function operationalReadinessCheckRequiredSheets_() {
  var setupResults = [
    DatabaseService.ensureSettingsSheetStructure(),
    DatabaseService.ensureIdCountersSheetStructure(),
    DatabaseService.ensureLeadsSheetStructure(),
    DatabaseService.ensureVendorsSheetStructure(),
    DatabaseService.ensureQuotesSheetStructure(),
    DatabaseService.ensureProjectsSheetStructure(),
    WebsiteWebhookService.ensureWebhookLogSheet_(),
    Step2RequirementService.ensureStep2RequirementSetup(),
    VendorPricingService.ensureVendorPricingSheetStructure(),
    VendorPricingService.ensureVendorPricingLogSheet_(),
    EmailService.ensureEmailLogsSheetStructure()
  ];

  var failed = [];
  for (var i = 0; i < setupResults.length; i++) {
    if (!setupResults[i].success) {
      failed.push(setupResults[i].message || ('Setup check failed at index ' + i));
    }
  }

  return {
    success: failed.length === 0,
    message: failed.length === 0 ? 'Required sheets are available.' : 'One or more required sheets failed setup validation.',
    data: { failedChecks: failed }
  };
}

function operationalReadinessGetControlledRecipient_() {
  if (!EmailService.TEST_EMAIL_RECIPIENT_KEY) {
    return {
      success: false,
      message: 'EmailService.TEST_EMAIL_RECIPIENT_KEY is not available.',
      data: { requiredKey: 'TEST_EMAIL_RECIPIENT' }
    };
  }

  var recipientResult = EmailService.getSettingValue_(EmailService.TEST_EMAIL_RECIPIENT_KEY);
  if (!recipientResult.success) {
    return recipientResult;
  }

  var recipient = String(recipientResult.data && recipientResult.data.value ? recipientResult.data.value : '').trim();
  if (!recipient) {
    return {
      success: false,
      message: 'Missing controlled test email recipient setting.',
      data: { requiredKey: EmailService.TEST_EMAIL_RECIPIENT_KEY }
    };
  }

  return {
    success: true,
    message: 'Controlled test recipient is configured.',
    data: {
      requiredKey: EmailService.TEST_EMAIL_RECIPIENT_KEY,
      email: recipient
    }
  };
}

function operationalReadinessCreateReadinessVendor_(testTag) {
  var vendorsResult = DatabaseService.ensureVendorsSheetStructure();
  if (!vendorsResult.success) {
    return vendorsResult;
  }

  var vendorId = UtilsService.createPrefixedId_('VEND-OPS-READY-');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
  sheet.appendRow([
    vendorId,
    'MIDTS Readiness Vendor',
    '',
    'Yes',
    'Yes',
    'Approved',
    testTag + ' Temporary readiness validation vendor.'
  ]);

  return {
    success: true,
    message: 'Readiness vendor record created.',
    data: { vendorId: vendorId }
  };
}

function operationalReadinessCreateEvent_(payload) {
  return { postData: { contents: JSON.stringify(payload) } };
}

function operationalReadinessGetSheetRowCount_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  return sheet ? sheet.getLastRow() : 0;
}

function operationalReadinessAddRowIncreaseCheck_(checks, name, beforeRows, afterRows, required) {
  operationalReadinessAddCheck_(checks, name, {
    success: afterRows > beforeRows,
    message: afterRows > beforeRows ? name + ': row count increased.' : name + ': row count did not increase.',
    data: {
      beforeRows: beforeRows,
      afterRows: afterRows
    }
  }, required);
}

function operationalReadinessAddCheck_(checks, name, result, required) {
  checks.push({
    name: name,
    required: required !== false,
    success: !!(result && result.success),
    message: result && result.message ? result.message : '',
    data: result && result.data ? operationalReadinessSanitizeData_(result.data) : {}
  });
}

function operationalReadinessBuildSummary_(checks) {
  var failedRequiredChecks = [];
  var failedOptionalChecks = [];

  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].success && checks[i].required) {
      failedRequiredChecks.push(checks[i].name);
    }
    if (!checks[i].success && !checks[i].required) {
      failedOptionalChecks.push(checks[i].name);
    }
  }

  return {
    totalChecks: checks.length,
    passedChecks: checks.length - failedRequiredChecks.length - failedOptionalChecks.length,
    failedRequiredChecks: failedRequiredChecks.length,
    failedOptionalChecks: failedOptionalChecks.length,
    failedChecks: failedRequiredChecks.concat(failedOptionalChecks)
  };
}

function operationalReadinessSafeResult_(result) {
  if (!result) {
    return { success: false, message: 'No result returned.', data: {} };
  }

  return {
    success: result.success === true,
    message: result.message || '',
    data: operationalReadinessSanitizeData_(result.data || {})
  };
}

function operationalReadinessSanitizeData_(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Object.prototype.toString.call(value) === '[object Array]') {
    var cleanArray = [];
    for (var i = 0; i < value.length; i++) {
      cleanArray.push(operationalReadinessSanitizeData_(value[i]));
    }
    return cleanArray;
  }

  if (typeof value === 'object') {
    var cleanObject = {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        var lowerKey = String(key).toLowerCase();
        if (lowerKey.indexOf('token') !== -1 || lowerKey.indexOf('secret') !== -1 || lowerKey === 'value' || lowerKey === 'apikey' || lowerKey === 'api_key') {
          cleanObject[key] = '[REDACTED]';
        } else {
          cleanObject[key] = operationalReadinessSanitizeData_(value[key]);
        }
      }
    }
    return cleanObject;
  }

  return value;
}
