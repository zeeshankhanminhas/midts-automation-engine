/**
 * MIDTS Automation Engine
 * STAGE: Production lifecycle safety checks
 * WHAT THIS FILE DOES:
 * - Validates lifecycle wiring without sending emails or writing Drive files.
 * - Checks that required services/functions exist before operators run lifecycle runners.
 * - Audits wired email/document templates for missing representative placeholders.
 * SIDE EFFECTS:
 * - None. No email sends. No Drive writes. No sheet writes.
 */

var ProductionLifecycleSafetyCheck = {
  REQUIRED_RUNTIME_FUNCTIONS: [
    { serviceName: 'ProductionTemplateService', service: function () { return ProductionTemplateService; }, functionName: 'renderEmailTemplate' },
    { serviceName: 'ProductionTemplateService', service: function () { return ProductionTemplateService; }, functionName: 'renderDocumentTemplate' },
    { serviceName: 'ProductionTemplateService', service: function () { return ProductionTemplateService; }, functionName: 'getEmailTemplates' },
    { serviceName: 'ProductionTemplateService', service: function () { return ProductionTemplateService; }, functionName: 'getDocumentTemplates' },
    { serviceName: 'EmailService', service: function () { return EmailService; }, functionName: 'sendTransactionalEmail' },
    { serviceName: 'QuoteService', service: function () { return QuoteService; }, functionName: 'getQuoteSnapshot' },
    { serviceName: 'DriveService', service: function () { return DriveService; }, functionName: 'getProjectSnapshot_' },
    { serviceName: 'DriveLogService', service: function () { return DriveLogService; }, functionName: 'log' },
    { serviceName: 'DatabaseService', service: function () { return DatabaseService; }, functionName: 'ensureLeadsSheetStructure' }
  ],

  /**
   * FUNCTION: run
   * PURPOSE: Full non-mutating safety check for lifecycle wiring.
   */
  run: function () {
    try {
      var runtime = this.checkRuntimeFunctions_();
      var templateAudit = this.auditWiredTemplates_();
      var dryRunAvailability = this.checkDryRunAvailability_();
      var success = runtime.success && templateAudit.success && dryRunAvailability.success;

      return {
        success: success,
        message: success ? 'Production lifecycle safety checks passed.' : 'Production lifecycle safety checks found issues.',
        data: {
          noLiveEmailSent: true,
          noDriveWrite: true,
          runtime: runtime,
          templateAudit: templateAudit,
          dryRunAvailability: dryRunAvailability,
          recommendedNextRunner: success ? 'runProductionLifecycleSmokeTest' : 'Fix failed checks before running lifecycle smoke test.'
        }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleSafetyCheck.run', error);
      return { success: false, message: 'Production lifecycle safety check failed unexpectedly.' };
    }
  },

  checkRuntimeFunctions_: function () {
    var checks = this.REQUIRED_RUNTIME_FUNCTIONS.map(function (item) {
      try {
        var service = item.service();
        var exists = !!service && typeof service[item.functionName] === 'function';
        return {
          success: exists,
          service: item.serviceName,
          functionName: item.functionName,
          message: exists ? 'Available' : 'Missing'
        };
      } catch (error) {
        return {
          success: false,
          service: item.serviceName,
          functionName: item.functionName,
          message: 'Reference failed: ' + error.message
        };
      }
    });
    var failed = checks.filter(function (check) { return !check.success; });
    return { success: failed.length === 0, message: failed.length === 0 ? 'Required runtime functions are available.' : 'Required runtime functions are missing.', data: { checks: checks, failed: failed } };
  },

  auditWiredTemplates_: function () {
    try {
      var values = ProductionTemplateService.getRepresentativeValues_();
      var emailKeys = ProductionLifecycleService.EMAIL_TEMPLATES_TO_WIRE || [];
      var documentKeys = ProductionLifecycleService.DOCUMENT_TEMPLATES_TO_WIRE || [];
      var emailCatalogue = ProductionTemplateService.getEmailTemplates();
      var documentCatalogue = ProductionTemplateService.getDocumentTemplates();
      if (!emailCatalogue.success) return emailCatalogue;
      if (!documentCatalogue.success) return documentCatalogue;

      var emailAudits = emailKeys.map(function (key) {
        var template = emailCatalogue.data.templates[key];
        if (!template) return { success: false, templateKey: key, type: 'email', message: 'Template key missing from ProductionTemplateService.' };
        var source = [template.subject, template.text, template.html].join('\n');
        var missing = ProductionLifecycleSafetyCheck.findMissingValues_(source, values);
        var render = ProductionTemplateService.renderEmailTemplate(key, values);
        return { success: missing.length === 0 && render.success, templateKey: key, type: 'email', missingValues: missing, renderSuccess: render.success, message: missing.length === 0 && render.success ? 'Template renders with representative values.' : 'Template has missing representative values or render issue.' };
      });

      var documentAudits = documentKeys.map(function (key) {
        var template = documentCatalogue.data.templates[key];
        if (!template) return { success: false, templateKey: key, type: 'document', message: 'Template key missing from ProductionTemplateService.' };
        var missing = ProductionLifecycleSafetyCheck.findMissingValues_(template.content, values);
        var render = ProductionTemplateService.renderDocumentTemplate(key, values);
        return { success: missing.length === 0 && render.success, templateKey: key, type: 'document', missingValues: missing, renderSuccess: render.success, message: missing.length === 0 && render.success ? 'Template renders with representative values.' : 'Template has missing representative values or render issue.' };
      });

      var audits = emailAudits.concat(documentAudits);
      var failed = audits.filter(function (audit) { return !audit.success; });
      return { success: failed.length === 0, message: failed.length === 0 ? 'All wired templates render safely with representative values.' : 'Some wired templates need values or fixes before live use.', data: { audits: audits, failed: failed } };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleSafetyCheck.auditWiredTemplates_', error);
      return { success: false, message: 'Failed to audit wired templates.' };
    }
  },

  checkDryRunAvailability_: function () {
    var checks = [
      { name: 'getProductionLifecycleTemplateMap', exists: typeof getProductionLifecycleTemplateMap === 'function' },
      { name: 'runProductionLifecycleDryRuns', exists: typeof runProductionLifecycleDryRuns === 'function' },
      { name: 'runProductionLifecycleSmokeTest', exists: typeof runProductionLifecycleSmokeTest === 'function' }
    ];
    var failed = checks.filter(function (check) { return !check.exists; });
    return { success: failed.length === 0, message: failed.length === 0 ? 'Lifecycle dry-run runners are available.' : 'Lifecycle dry-run runners are missing.', data: { checks: checks, failed: failed } };
  },

  findMissingValues_: function (templateSource, values) {
    var matches = String(templateSource || '').match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    var missingMap = {};
    matches.forEach(function (token) {
      var key = token.replace(/[{}\s]/g, '');
      var hasValue = values && Object.prototype.hasOwnProperty.call(values, key) && String(values[key] || '').trim() !== '';
      if (!hasValue) missingMap[key] = true;
    });
    return Object.keys(missingMap);
  }
};

function runProductionLifecycleSafetyCheck() {
  return ProductionLifecycleSafetyCheck.run();
}
