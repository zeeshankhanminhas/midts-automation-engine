/**
 * MIDTS Operational Readiness Preflight Runner
 *
 * Manual, non-mutating Apps Script runner for deployment readiness checks.
 * This file is additive only and does not create test records, send emails,
 * modify webhooks, change sheets, or alter existing service behavior.
 */
function runOperationalReadinessPreflight() {
  var checks = [];
  var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  try {
    var spreadsheetCheck = operationalPreflightCheckSpreadsheetBinding_();
    operationalPreflightAddCheck_(checks, 'Spreadsheet binding is available', spreadsheetCheck, true);

    var settingsMapResult = operationalPreflightReadSettingsMap_();
    operationalPreflightAddCheck_(checks, 'Settings sheet can be read without mutation', operationalPreflightSafeResult_(settingsMapResult), true);
    var settingsMap = settingsMapResult.success && settingsMapResult.data ? settingsMapResult.data.settingsMap : {};

    operationalPreflightAddCheck_(checks, 'Required Settings values are present', operationalPreflightCheckRequiredSettings_(settingsMap), true);
    operationalPreflightAddCheck_(checks, 'Email dry-run prerequisites are present', operationalPreflightCheckEmailSettings_(settingsMap), true);
    operationalPreflightAddCheck_(checks, 'Required sheet tabs already exist', operationalPreflightCheckRequiredSheetTabs_(), true);
    operationalPreflightAddCheck_(checks, 'Required sheet headers are present', operationalPreflightCheckRequiredSheetHeaders_(), true);
    operationalPreflightAddCheck_(checks, 'Apps Script service dependencies are callable', operationalPreflightCheckServiceDependencies_(), true);
    operationalPreflightAddCheck_(checks, 'Webhook routing dependencies are callable', operationalPreflightCheckWebhookDependencies_(), true);
    operationalPreflightAddCheck_(checks, 'Quote and project gate dependencies are callable', operationalPreflightCheckGateDependencies_(), true);
    operationalPreflightAddCheck_(checks, 'External integration runtime is available', operationalPreflightCheckExternalRuntime_(), true);
    operationalPreflightAddCheck_(checks, 'Public token value is not returned', {
      success: true,
      message: 'Preflight reports setting presence and source only; secret values are not returned.',
      data: { secretFieldsReturned: 0 }
    }, true);

    var summary = operationalPreflightBuildSummary_(checks);
    return {
      success: summary.failedRequiredChecks === 0,
      message: summary.failedRequiredChecks === 0
        ? 'Operational readiness preflight passed.'
        : 'Operational readiness preflight failed. Review failedChecks before deployment.',
      data: {
        runStamp: runStamp,
        mutationMode: 'none',
        summary: summary,
        checks: checks
      }
    };
  } catch (error) {
    Logger.log('runOperationalReadinessPreflight error: ' + error.message);
    return {
      success: false,
      message: 'Operational readiness preflight failed unexpectedly: ' + error.message,
      data: {
        runStamp: runStamp,
        mutationMode: 'none',
        checksCompleted: checks.length,
        checks: checks
      }
    };
  }
}

function operationalPreflightCheckSpreadsheetBinding_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    return { success: false, message: 'No active spreadsheet is bound to this Apps Script project.' };
  }

  return {
    success: true,
    message: 'Active spreadsheet binding is available.',
    data: {
      spreadsheetName: spreadsheet.getName(),
      spreadsheetIdPresent: !!spreadsheet.getId()
    }
  };
}

function operationalPreflightReadSettingsMap_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    return { success: false, message: 'No active spreadsheet is available.' };
  }

  var sheet = spreadsheet.getSheetByName(ConfigService.SETTINGS_SHEET_NAME);
  if (!sheet) {
    return { success: false, message: 'Settings sheet is missing.' };
  }

  var values = sheet.getDataRange().getValues();
  var settingsMap = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    var value = String(values[i][1] || '').trim();
    if (key) {
      settingsMap[key] = value;
    }
  }

  return {
    success: true,
    message: 'Settings sheet read completed without creating or modifying rows.',
    data: {
      settingsMap: settingsMap,
      settingRowsRead: Math.max(values.length - 1, 0)
    }
  };
}

function operationalPreflightCheckRequiredSettings_(settingsMap) {
  var requiredKeys = ConfigService.getRequiredSettingKeys();
  var missingKeys = [];
  var configuredKeys = [];
  var sources = {};

  for (var i = 0; i < requiredKeys.length; i++) {
    var key = requiredKeys[i];
    var presence = operationalPreflightGetSettingPresence_(settingsMap, key);
    sources[key] = presence.source;
    if (presence.configured) {
      configuredKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }

  return {
    success: missingKeys.length === 0,
    message: missingKeys.length === 0 ? 'Required settings are present.' : 'One or more required settings are missing.',
    data: {
      configuredKeys: configuredKeys,
      missingKeys: missingKeys,
      sources: sources
    }
  };
}

function operationalPreflightCheckEmailSettings_(settingsMap) {
  var requiredEmailKeys = [
    EmailService.TEST_EMAIL_RECIPIENT_KEY,
    EmailService.BREVO_SENDER_EMAIL_KEY,
    EmailService.BREVO_SENDER_NAME_KEY,
    ConfigService.BREVO_API_KEY_KEY,
    ConfigService.STEP2_FORM_BASE_URL_KEY,
    ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY
  ];
  var missingKeys = [];
  var configuredKeys = [];
  var invalidUrlKeys = [];

  for (var i = 0; i < requiredEmailKeys.length; i++) {
    var key = requiredEmailKeys[i];
    var presence = operationalPreflightGetSettingPresence_(settingsMap, key);
    if (presence.configured) {
      configuredKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }

  var step2Url = String(settingsMap[ConfigService.STEP2_FORM_BASE_URL_KEY] || PropertiesService.getScriptProperties().getProperty(ConfigService.STEP2_FORM_BASE_URL_KEY) || '').trim();
  var vendorUrl = String(settingsMap[ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY] || PropertiesService.getScriptProperties().getProperty(ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY) || '').trim();
  if (step2Url && step2Url.indexOf('http') !== 0) {
    invalidUrlKeys.push(ConfigService.STEP2_FORM_BASE_URL_KEY);
  }
  if (vendorUrl && vendorUrl.indexOf('http') !== 0) {
    invalidUrlKeys.push(ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY);
  }

  return {
    success: missingKeys.length === 0 && invalidUrlKeys.length === 0,
    message: missingKeys.length === 0 && invalidUrlKeys.length === 0
      ? 'Email dry-run prerequisites are present.'
      : 'Email dry-run prerequisites are incomplete.',
    data: {
      configuredKeys: configuredKeys,
      missingKeys: missingKeys,
      invalidUrlKeys: invalidUrlKeys
    }
  };
}

function operationalPreflightCheckRequiredSheetTabs_() {
  var sheetNames = operationalPreflightRequiredSheets_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var missingSheets = [];
  var presentSheets = [];

  for (var i = 0; i < sheetNames.length; i++) {
    var sheetName = sheetNames[i];
    if (spreadsheet && spreadsheet.getSheetByName(sheetName)) {
      presentSheets.push(sheetName);
    } else {
      missingSheets.push(sheetName);
    }
  }

  return {
    success: missingSheets.length === 0,
    message: missingSheets.length === 0 ? 'Required sheet tabs are present.' : 'One or more required sheet tabs are missing.',
    data: {
      presentSheets: presentSheets,
      missingSheets: missingSheets
    }
  };
}

function operationalPreflightCheckRequiredSheetHeaders_() {
  var expectedHeaders = operationalPreflightExpectedHeaders_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var failedSheets = [];

  for (var sheetName in expectedHeaders) {
    if (Object.prototype.hasOwnProperty.call(expectedHeaders, sheetName)) {
      var sheet = spreadsheet ? spreadsheet.getSheetByName(sheetName) : null;
      if (!sheet) {
        failedSheets.push({ sheetName: sheetName, missingHeaders: expectedHeaders[sheetName] });
        continue;
      }

      var headerValues = sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : [];
      var currentHeaders = headerValues.map(function (header) {
        return String(header || '').trim();
      });
      var missingHeaders = [];
      for (var i = 0; i < expectedHeaders[sheetName].length; i++) {
        var expectedHeader = expectedHeaders[sheetName][i];
        if (currentHeaders.indexOf(expectedHeader) === -1) {
          missingHeaders.push(expectedHeader);
        }
      }
      if (missingHeaders.length > 0) {
        failedSheets.push({ sheetName: sheetName, missingHeaders: missingHeaders });
      }
    }
  }

  return {
    success: failedSheets.length === 0,
    message: failedSheets.length === 0 ? 'Required sheet headers are present.' : 'One or more sheets are missing required headers.',
    data: { failedSheets: failedSheets }
  };
}

function operationalPreflightCheckServiceDependencies_() {
  var requiredFunctions = [
    ['ConfigService', ConfigService, ['getRequiredSettingKeys']],
    ['DatabaseService', DatabaseService, ['getSettingsMap', 'ensureLeadsSheetStructure', 'ensureQuotesSheetStructure']],
    ['LeadService', LeadService, ['createLead', 'markStep2Completed', 'canLeadProceedToQuote']],
    ['EmailService', EmailService, ['sendLeadReceivedEmail', 'sendVendorPricingRequestEmail', 'getSettingValue_']],
    ['VendorService', VendorService, ['assignVendorToLead']],
    ['VendorPricingService', VendorPricingService, ['handlePostEvent', 'submitVendorPricing', 'approveVendorPricingForQuote']],
    ['QuoteService', QuoteService, ['createQuoteForLead', 'updateQuoteStatus']],
    ['ProjectService', ProjectService, ['createProjectFromQuote']],
    ['UtilsService', UtilsService, ['createPrefixedId_', 'createSequentialId_']]
  ];

  return operationalPreflightCheckFunctionSet_(requiredFunctions);
}

function operationalPreflightCheckWebhookDependencies_() {
  var requiredFunctions = [
    ['WebsiteWebhookService', WebsiteWebhookService, ['parsePostEvent_', 'validateWebhookToken_', 'getConfiguredWebhookToken_', 'handlePostEvent']],
    ['Step2RequirementService', Step2RequirementService, ['handlePostEvent', 'ensureStep2RequirementSetup']],
    ['VendorPricingService', VendorPricingService, ['isVendorPricingPayload', 'handlePostEvent']]
  ];

  return operationalPreflightCheckFunctionSet_(requiredFunctions);
}

function operationalPreflightCheckGateDependencies_() {
  var requiredFunctions = [
    ['LeadService', LeadService, ['canLeadProceedToQuote']],
    ['VendorPricingService', VendorPricingService, ['getApprovedPricingForLead', 'approveVendorPricingForQuote']],
    ['QuoteService', QuoteService, ['createQuoteForLead', 'updateQuoteStatus']],
    ['ProjectService', ProjectService, ['createProjectFromQuote']],
    ['VendorService', VendorService, ['assignVendorToLead']]
  ];

  return operationalPreflightCheckFunctionSet_(requiredFunctions);
}

function operationalPreflightCheckExternalRuntime_() {
  var missingRuntime = [];
  if (typeof UrlFetchApp === 'undefined' || typeof UrlFetchApp.fetch !== 'function') {
    missingRuntime.push('UrlFetchApp.fetch');
  }
  if (typeof PropertiesService === 'undefined' || typeof PropertiesService.getScriptProperties !== 'function') {
    missingRuntime.push('PropertiesService.getScriptProperties');
  }
  if (typeof SpreadsheetApp === 'undefined' || typeof SpreadsheetApp.getActiveSpreadsheet !== 'function') {
    missingRuntime.push('SpreadsheetApp.getActiveSpreadsheet');
  }
  if (typeof Utilities === 'undefined' || typeof Utilities.formatDate !== 'function') {
    missingRuntime.push('Utilities.formatDate');
  }

  return {
    success: missingRuntime.length === 0,
    message: missingRuntime.length === 0 ? 'External integration runtime dependencies are available.' : 'One or more runtime dependencies are missing.',
    data: {
      requiredRuntime: ['UrlFetchApp.fetch', 'PropertiesService.getScriptProperties', 'SpreadsheetApp.getActiveSpreadsheet', 'Utilities.formatDate'],
      missingRuntime: missingRuntime
    }
  };
}

function operationalPreflightCheckFunctionSet_(serviceSets) {
  var missingFunctions = [];
  for (var i = 0; i < serviceSets.length; i++) {
    var serviceName = serviceSets[i][0];
    var serviceObject = serviceSets[i][1];
    var functionNames = serviceSets[i][2];

    if (!serviceObject) {
      missingFunctions.push(serviceName + '.*');
      continue;
    }

    for (var j = 0; j < functionNames.length; j++) {
      var functionName = functionNames[j];
      if (typeof serviceObject[functionName] !== 'function') {
        missingFunctions.push(serviceName + '.' + functionName);
      }
    }
  }

  return {
    success: missingFunctions.length === 0,
    message: missingFunctions.length === 0 ? 'Required functions are callable.' : 'One or more required functions are missing.',
    data: { missingFunctions: missingFunctions }
  };
}

function operationalPreflightRequiredSheets_() {
  return [
    ConfigService.SETTINGS_SHEET_NAME,
    ConfigService.ID_COUNTERS_SHEET_NAME,
    ConfigService.LEADS_SHEET_NAME,
    ConfigService.VENDORS_SHEET_NAME,
    ConfigService.QUOTES_SHEET_NAME,
    ConfigService.PROJECTS_SHEET_NAME,
    ConfigService.ERROR_LOGS_SHEET_NAME,
    WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME,
    Step2RequirementService.STEP2_LOGS_SHEET_NAME,
    VendorPricingService.VENDOR_PRICING_SHEET_NAME,
    VendorPricingService.VENDOR_PRICING_LOGS_SHEET_NAME,
    EmailService.EMAIL_LOGS_SHEET_NAME
  ];
}

function operationalPreflightExpectedHeaders_() {
  var headers = {};
  headers[ConfigService.SETTINGS_SHEET_NAME] = ['Key', 'Value'];
  headers[ConfigService.ID_COUNTERS_SHEET_NAME] = ['Type', 'Year', 'Last Sequence'];
  headers[ConfigService.LEADS_SHEET_NAME] = ['Lead ID', 'Created At', 'Full Name', 'Email', 'Step 2 Completed At', 'Qualification Status'];
  headers[ConfigService.VENDORS_SHEET_NAME] = ['Vendor ID', 'Vendor Name', 'Email', 'NDA Signed', 'ID Verified', 'Approved Status'];
  headers[ConfigService.QUOTES_SHEET_NAME] = ['Quote ID', 'Lead ID', 'Quote Status', 'Amount', 'Currency'];
  headers[ConfigService.PROJECTS_SHEET_NAME] = ['Project ID', 'Lead ID', 'Vendor ID', 'Quote ID', 'Project Status'];
  headers[ConfigService.ERROR_LOGS_SHEET_NAME] = ['Log ID', 'Timestamp', 'Function', 'Error Message'];
  headers[WebsiteWebhookService.WEBHOOK_LOGS_SHEET_NAME] = ['Timestamp', 'Stage', 'Success', 'Message', 'Lead ID'];
  headers[Step2RequirementService.STEP2_LOGS_SHEET_NAME] = ['Timestamp', 'Stage', 'Success', 'Message', 'Lead ID'];
  headers[VendorPricingService.VENDOR_PRICING_SHEET_NAME] = ['Vendor Pricing ID', 'Lead ID', 'Vendor ID', 'Vendor Cost', 'Review Status'];
  headers[VendorPricingService.VENDOR_PRICING_LOGS_SHEET_NAME] = ['Timestamp', 'Stage', 'Success', 'Message', 'Lead ID', 'Vendor ID'];
  headers[EmailService.EMAIL_LOGS_SHEET_NAME] = ['Log ID', 'Timestamp', 'Recipient', 'Subject', 'Template Key', 'Result'];
  return headers;
}

function operationalPreflightGetSettingPresence_(settingsMap, key) {
  var sheetValue = String(settingsMap[key] || '').trim();
  var scriptValue = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
  var source = 'none';

  if (sheetValue && scriptValue) {
    source = 'sheet_and_script_properties';
  } else if (sheetValue) {
    source = 'settings_sheet';
  } else if (scriptValue) {
    source = 'script_properties';
  }

  return {
    configured: !!(sheetValue || scriptValue),
    source: source
  };
}

function operationalPreflightAddCheck_(checks, name, result, required) {
  checks.push({
    name: name,
    required: required !== false,
    success: !!(result && result.success),
    message: result && result.message ? result.message : '',
    data: result && result.data ? operationalPreflightSanitizeData_(result.data) : {}
  });
}

function operationalPreflightBuildSummary_(checks) {
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

function operationalPreflightSafeResult_(result) {
  if (!result) {
    return { success: false, message: 'No result returned.', data: {} };
  }

  return {
    success: result.success === true,
    message: result.message || '',
    data: operationalPreflightSanitizeData_(result.data || {})
  };
}

function operationalPreflightSanitizeData_(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Object.prototype.toString.call(value) === '[object Array]') {
    var cleanArray = [];
    for (var i = 0; i < value.length; i++) {
      cleanArray.push(operationalPreflightSanitizeData_(value[i]));
    }
    return cleanArray;
  }

  if (typeof value === 'object') {
    var cleanObject = {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        var lowerKey = String(key).toLowerCase();
        if (lowerKey === 'settingsmap' || lowerKey.indexOf('token') !== -1 || lowerKey.indexOf('secret') !== -1 || lowerKey === 'value' || lowerKey === 'apikey' || lowerKey === 'api_key') {
          cleanObject[key] = '[REDACTED]';
        } else {
          cleanObject[key] = operationalPreflightSanitizeData_(value[key]);
        }
      }
    }
    return cleanObject;
  }

  return value;
}
