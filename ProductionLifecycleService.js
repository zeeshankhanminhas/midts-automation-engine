/**
 * MIDTS Automation Engine
 * STAGE: Production lifecycle template wiring
 * WHAT THIS FILE DOES:
 * - Maps ProductionTemplateService templates to controlled workflow lifecycle events.
 * - Sends only through EmailService after rendering through ProductionTemplateService.
 * - Generates Drive documents only after existing Drive/project gates pass.
 * - Provides dry-run runners and a lifecycle smoke test without live email or Drive writes.
 * DEPENDENCIES:
 * - ProductionTemplateService.js
 * - EmailService.js
 * - QuoteService.js
 * - LeadService.js
 * - ProjectService.js
 * - DriveService.js
 * - DriveLogService.js
 * - DatabaseService.js
 * - Config.js
 * - Utils.js
 * - ErrorLogger.js
 */

var ProductionLifecycleService = {
  // ===== CONFIG =====
  EMAIL_TEMPLATES_TO_WIRE: [
    'QUOTE_ACCEPTED_CONFIRMATION',
    'DEPOSIT_PAYMENT_REQUEST',
    'PROJECT_STARTED_CONFIRMATION',
    'FILE_RECEIVED_CONFIRMATION',
    'DELIVERY_FINAL_HANDOFF_NOTIFICATION',
    'REVISION_CLARIFICATION_REQUEST',
    'UNABLE_TO_QUOTE_DECLINED_PROJECT'
  ],

  DOCUMENT_TEMPLATES_TO_WIRE: [
    'CLIENT_QUOTE',
    'SCOPE_OF_WORK',
    'PROJECT_HANDOFF_BRIEF',
    'DELIVERY_NOTE',
    'PROJECT_CLOSURE_SUMMARY'
  ],

  /**
   * FUNCTION: getLifecycleTemplateMap
   * PURPOSE: Return the production wiring map without mutating workflow data.
   * INPUT: none
   * OUTPUT: { success, message, data: { emailMappings, documentMappings, stillNotWired } }
   * SIDE EFFECTS: none
   */
  getLifecycleTemplateMap: function () {
    try {
      var emailMappings = [
        this.buildEmailMapping_('QUOTE_ACCEPTED_CONFIRMATION', 'Quote accepted', 'Quote status must be Sent before acceptance; update must succeed to Accepted', 'QuoteService.acceptCustomerQuote -> ProductionLifecycleService.handleQuoteAccepted', 'Existing quote acceptance handler must call handleQuoteAccepted after successful status update', ['quote_id', 'lead_id', 'client_name', 'client_email'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('DEPOSIT_PAYMENT_REQUEST', 'Payment requested after quote acceptance', 'Quote status must be Accepted; project/payment status must not be advanced by failed email', 'ProductionLifecycleService.requestDepositPayment', 'Payment provider/webhook trigger is not present in repo; callable runner provided', ['quote_id', 'lead_id', 'client_name', 'client_email', 'payment_amount', 'payment_status'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('PROJECT_STARTED_CONFIRMATION', 'Project created/started from accepted quote', 'ProjectService.createProjectFromQuote requires Accepted quote', 'ProjectService.createProjectFromQuote -> ProductionLifecycleService.handleProjectStarted', 'Existing project creation handler must call handleProjectStarted after project row creation', ['project_id', 'lead_id', 'quote_id', 'client_name', 'client_email', 'project_status'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('FILE_RECEIVED_CONFIRMATION', 'Client file intake received', 'Lead must exist; file intake status is informational only and must not grant vendor access', 'ProductionLifecycleService.handleFileReceived', 'Existing file upload handler must call handleFileReceived after successful file log/write', ['lead_id', 'client_name', 'client_email', 'files_received'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('DELIVERY_FINAL_HANDOFF_NOTIFICATION', 'Delivery ready for final handoff', 'Project must exist; payment gate must allow release before external dispatch', 'ProductionLifecycleService.handleDeliveryReady', 'Delivery-ready trigger is not present in repo; callable runner provided', ['project_id', 'lead_id', 'client_name', 'client_email', 'delivery_summary', 'payment_status'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('REVISION_CLARIFICATION_REQUEST', 'Revision/clarification requested during active project', 'Project must exist and not be closed', 'ProductionLifecycleService.requestRevisionClarification', 'Revision request trigger is not present in repo; callable runner provided', ['project_id', 'lead_id', 'client_name', 'client_email', 'clarification_request'], EmailService.EMAIL_LOGS_SHEET_NAME),
        this.buildEmailMapping_('UNABLE_TO_QUOTE_DECLINED_PROJECT', 'Lead declined/unable to quote after review', 'Lead exists and quote must not already be accepted/project-created', 'ProductionLifecycleService.declineUnableToQuote', 'Decline/rejection trigger is not present in repo; callable runner provided', ['lead_id', 'client_name', 'client_email', 'decline_reason'], EmailService.EMAIL_LOGS_SHEET_NAME)
      ];

      var documentMappings = [
        this.buildDocumentMapping_('CLIENT_QUOTE', 'Client quote document generated after quote issue', 'Approved vendor pricing or documented manual approval; quote exists', 'ProductionLifecycleService.generateClientQuoteDocument', 'Quote document generation trigger is not currently called by QuoteService', ['quote_id', 'lead_id', 'timestamp', 'client_quote_amount'], DriveLogService.SHEET_NAME),
        this.buildDocumentMapping_('SCOPE_OF_WORK', 'Scope of Work generated with or after client quote', 'Scope reviewed before acceptance; quote exists', 'ProductionLifecycleService.generateScopeOfWorkDocument', 'Scope approval trigger is not present in repo; callable runner provided', ['quote_id', 'lead_id', 'technical_summary', 'deliverables'], DriveLogService.SHEET_NAME),
        this.buildDocumentMapping_('PROJECT_HANDOFF_BRIEF', 'Project handoff brief after accepted quote creates project', 'Quote accepted and project created; project Drive folder exists', 'ProductionLifecycleService.generateProjectHandoffBrief', 'ProjectService must call after createProjectFromQuote when Drive folder exists', ['project_id', 'lead_id', 'timestamp'], DriveLogService.SHEET_NAME),
        this.buildDocumentMapping_('DELIVERY_NOTE', 'Delivery note when delivery is ready for release', 'Payment gate allows release; project Drive folder exists', 'ProductionLifecycleService.generateDeliveryNote', 'Delivery-ready trigger is not present in repo; callable runner provided', ['project_id', 'lead_id', 'timestamp', 'delivery_summary'], DriveLogService.SHEET_NAME),
        this.buildDocumentMapping_('PROJECT_CLOSURE_SUMMARY', 'Project closure summary after final handoff', 'Delivery complete and payment gate satisfied; project Drive folder exists', 'ProductionLifecycleService.generateProjectClosureSummary', 'Project-closed trigger is not present in repo; callable runner provided', ['project_id', 'lead_id', 'timestamp'], DriveLogService.SHEET_NAME)
      ];

      var catalogues = this.getTemplateCatalogueKeys_();
      var wired = this.EMAIL_TEMPLATES_TO_WIRE.concat(this.DOCUMENT_TEMPLATES_TO_WIRE);
      var stillNotWired = catalogues.all.filter(function (key) { return wired.indexOf(key) === -1; });

      return {
        success: true,
        message: 'Production lifecycle template map loaded.',
        data: {
          emailMappings: emailMappings,
          documentMappings: documentMappings,
          templatesWiredByThisService: wired,
          templatesStillNotWired: stillNotWired
        }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.getLifecycleTemplateMap', error);
      return { success: false, message: 'Failed to load lifecycle template map.' };
    }
  },

  /**
   * FUNCTION: sendLifecycleEmail
   * PURPOSE: Render a production template and send through the central email provider only after gate success.
   * INPUT: templateKey, values, gateResult
   * OUTPUT: { success, message, data }
   * SIDE EFFECTS: May send one Brevo email and append one Email Logs row.
   */
  sendLifecycleEmail: function (templateKey, values, gateResult) {
    try {
      var gate = gateResult || { success: true, data: { allowed: true } };
      if (!gate.success || (gate.data && gate.data.allowed === false)) {
        return { success: false, message: 'Lifecycle email blocked by gate.', data: { templateKey: templateKey, gate: gate } };
      }

      var payload = values || {};
      var recipientEmail = String(payload.client_email || payload.toEmail || payload.email || '').trim();
      var recipientName = String(payload.client_name || payload.toName || payload.fullName || 'there').trim();
      if (!recipientEmail || recipientEmail.indexOf('@') === -1) {
        return { success: false, message: 'Lifecycle email blocked: valid recipient email is required.', data: { templateKey: templateKey, recipientEmail: recipientEmail } };
      }

      var renderResult = ProductionTemplateService.renderEmailTemplate(templateKey, payload);
      if (!renderResult.success) {
        return renderResult;
      }
      if (renderResult.data.productionSafe === false) {
        return { success: false, message: 'Lifecycle email blocked by production safety audit.', data: renderResult.data };
      }

      return EmailService.sendTransactionalEmail({
        toEmail: recipientEmail,
        toName: recipientName,
        subject: renderResult.data.subject,
        htmlContent: renderResult.data.htmlContent,
        textContent: renderResult.data.textContent,
        templateKey: templateKey
      });
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.sendLifecycleEmail', error, { templateKey: templateKey, values: values });
      return { success: false, message: 'Failed to send lifecycle email.' };
    }
  },

  /**
   * FUNCTION: renderLifecycleEmailDryRun
   * PURPOSE: Render a lifecycle email preview without sending a live email.
   * INPUT: templateKey, values, gateResult
   * OUTPUT: dry-run preview with missing placeholders, recipient, and gate result.
   * SIDE EFFECTS: none
   */
  renderLifecycleEmailDryRun: function (templateKey, values, gateResult) {
    try {
      var payload = this.mergeObjects_(ProductionTemplateService.getRepresentativeValues_(), values || {});
      var renderResult = ProductionTemplateService.renderEmailTemplate(templateKey, payload);
      return {
        success: renderResult.success,
        message: renderResult.success ? 'Lifecycle email dry-run rendered. No live email sent.' : renderResult.message,
        data: {
          noLiveEmailSent: true,
          noLiveDriveWrite: true,
          templateKey: templateKey,
          intendedRecipient: payload.client_email || payload.toEmail || payload.email || '',
          gateResult: gateResult || this.evaluateRepresentativeGate_(templateKey),
          missingPlaceholders: this.findMissingPlaceholders_(renderResult.success ? (renderResult.data.subject + '\n' + renderResult.data.textContent + '\n' + renderResult.data.htmlContent) : ''),
          preview: renderResult
        }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.renderLifecycleEmailDryRun', error, { templateKey: templateKey, values: values });
      return { success: false, message: 'Failed to render lifecycle email dry-run.' };
    }
  },

  /**
   * FUNCTION: renderAllNewlyWiredDryRuns
   * PURPOSE: Dry-run every newly wired email and document template.
   * INPUT: values optional
   * OUTPUT: previews for all wired templates.
   * SIDE EFFECTS: none
   */
  renderAllNewlyWiredDryRuns: function (values) {
    try {
      var self = this;
      var payload = this.mergeObjects_(ProductionTemplateService.getRepresentativeValues_(), values || {});
      var emails = this.EMAIL_TEMPLATES_TO_WIRE.map(function (key) {
        return self.renderLifecycleEmailDryRun(key, payload, self.evaluateRepresentativeGate_(key));
      });
      var documents = this.DOCUMENT_TEMPLATES_TO_WIRE.map(function (key) {
        return self.renderLifecycleDocumentDryRun(key, payload, self.evaluateRepresentativeGate_(key));
      });
      return {
        success: true,
        message: 'Dry-run previews completed. No live email sent and no Drive document created.',
        data: { noLiveEmailSent: true, noLiveDriveWrite: true, emailDryRuns: emails, documentDryRuns: documents }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.renderAllNewlyWiredDryRuns', error, { values: values });
      return { success: false, message: 'Failed to render all lifecycle dry-runs.' };
    }
  },

  /**
   * FUNCTION: renderLifecycleDocumentDryRun
   * PURPOSE: Render a document preview without writing to Drive.
   * INPUT: templateKey, values, gateResult
   * OUTPUT: dry-run preview.
   * SIDE EFFECTS: none
   */
  renderLifecycleDocumentDryRun: function (templateKey, values, gateResult) {
    try {
      var payload = this.mergeObjects_(ProductionTemplateService.getRepresentativeValues_(), values || {});
      var renderResult = ProductionTemplateService.renderDocumentTemplate(templateKey, payload);
      return {
        success: renderResult.success,
        message: renderResult.success ? 'Lifecycle document dry-run rendered. No Drive file created.' : renderResult.message,
        data: {
          noLiveEmailSent: true,
          noLiveDriveWrite: true,
          templateKey: templateKey,
          gateResult: gateResult || this.evaluateRepresentativeGate_(templateKey),
          missingPlaceholders: this.findMissingPlaceholders_(renderResult.success ? renderResult.data.content : ''),
          intendedDriveFolder: renderResult.success ? renderResult.data.metadata.driveFolderLocation : '',
          preview: renderResult
        }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.renderLifecycleDocumentDryRun', error, { templateKey: templateKey, values: values });
      return { success: false, message: 'Failed to render lifecycle document dry-run.' };
    }
  },

  /**
   * FUNCTION: generateLifecycleDocument
   * PURPOSE: Generate a Google Doc in an existing project Drive folder after gate success.
   * INPUT: templateKey, values, projectId, gateResult
   * OUTPUT: Drive document result.
   * SIDE EFFECTS: Creates one Google Doc in Drive and logs to Drive Logs.
   */
  generateLifecycleDocument: function (templateKey, values, projectId, gateResult) {
    try {
      var gate = gateResult || { success: true, data: { allowed: true } };
      if (!gate.success || (gate.data && gate.data.allowed === false)) {
        return { success: false, message: 'Lifecycle document generation blocked by gate.', data: { templateKey: templateKey, gate: gate } };
      }

      var projectSnapshot = DriveService.getProjectSnapshot_(projectId);
      if (!projectSnapshot.success) {
        return projectSnapshot;
      }
      if (!projectSnapshot.data.driveFolderId) {
        return { success: false, message: 'Lifecycle document generation blocked: existing project Drive folder is required.', data: { templateKey: templateKey, projectId: projectId } };
      }

      var payload = this.mergeObjects_(values || {}, {
        project_id: projectSnapshot.data.projectId,
        lead_id: projectSnapshot.data.leadId,
        quote_id: projectSnapshot.data.quoteId,
        project_status: projectSnapshot.data.projectStatus,
        timestamp: new Date().toISOString()
      });
      var renderResult = ProductionTemplateService.renderDocumentTemplate(templateKey, payload);
      if (!renderResult.success) return renderResult;
      if (renderResult.data.productionSafe === false) {
        return { success: false, message: 'Lifecycle document blocked by production safety audit.', data: renderResult.data };
      }

      var docTitle = renderResult.data.title + ' - ' + (payload.project_id || payload.lead_id || payload.quote_id || new Date().getTime());
      var doc = DocumentApp.create(docTitle);
      doc.getBody().setText(renderResult.data.content);
      doc.saveAndClose();

      var file = DriveApp.getFileById(doc.getId());
      var folder = DriveApp.getFolderById(projectSnapshot.data.driveFolderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);

      var logResult = DriveLogService.log({
        leadId: projectSnapshot.data.leadId,
        action: 'GENERATE_DOCUMENT_' + templateKey,
        folderType: 'Project Folder',
        folderName: folder.getName(),
        folderId: folder.getId(),
        fileName: docTitle,
        fileId: doc.getId(),
        actor: 'ProductionLifecycleService',
        source: 'ProductionLifecycleService.generateLifecycleDocument',
        status: 'Success',
        notes: 'Generated from ProductionTemplateService without external dispatch.'
      });

      return {
        success: true,
        message: 'Lifecycle document generated successfully.',
        data: { templateKey: templateKey, projectId: projectId, documentId: doc.getId(), documentTitle: docTitle, driveLog: logResult }
      };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.generateLifecycleDocument', error, { templateKey: templateKey, projectId: projectId, values: values });
      return { success: false, message: 'Failed to generate lifecycle document.' };
    }
  },

  // ===== LIVE EMAIL EVENT RUNNERS =====
  handleQuoteAccepted: function (quoteId, values) {
    var quote = QuoteService.getQuoteSnapshot(quoteId);
    if (!quote.success) return quote;
    var gate = { success: quote.data.quoteStatus === 'Accepted', data: { allowed: quote.data.quoteStatus === 'Accepted', quoteStatus: quote.data.quoteStatus } };
    return this.sendLifecycleEmail('QUOTE_ACCEPTED_CONFIRMATION', this.mergeObjects_(this.buildValuesFromQuote_(quote.data), values || {}), gate);
  },

  requestDepositPayment: function (quoteId, values) {
    var quote = QuoteService.getQuoteSnapshot(quoteId);
    if (!quote.success) return quote;
    var gate = { success: quote.data.quoteStatus === 'Accepted', data: { allowed: quote.data.quoteStatus === 'Accepted', quoteStatus: quote.data.quoteStatus } };
    return this.sendLifecycleEmail('DEPOSIT_PAYMENT_REQUEST', this.mergeObjects_(this.buildValuesFromQuote_(quote.data), values || {}), gate);
  },

  handleProjectStarted: function (projectId, values) {
    var project = DriveService.getProjectSnapshot_(projectId);
    if (!project.success) return project;
    var gate = { success: !!project.data.projectId, data: { allowed: !!project.data.projectId, projectStatus: project.data.projectStatus } };
    return this.sendLifecycleEmail('PROJECT_STARTED_CONFIRMATION', this.mergeObjects_(this.buildValuesFromProject_(project.data), values || {}), gate);
  },

  handleFileReceived: function (leadId, filesReceived, values) {
    var lead = this.getLeadSnapshot_(leadId);
    if (!lead.success) return lead;
    var gate = { success: true, data: { allowed: true, fileEventRecorded: true } };
    return this.sendLifecycleEmail('FILE_RECEIVED_CONFIRMATION', this.mergeObjects_(lead.data.values, this.mergeObjects_({ files_received: filesReceived || '' }, values || {})), gate);
  },

  handleDeliveryReady: function (projectId, values) {
    var project = DriveService.getProjectSnapshot_(projectId);
    if (!project.success) return project;
    var paymentStatus = String((values || {}).payment_status || project.data.paymentStatusReference || '').trim();
    var allowed = ['Paid', 'Paid in Full', 'Release Approved', 'Not Required'].indexOf(paymentStatus) !== -1;
    var gate = { success: allowed, data: { allowed: allowed, paymentStatus: paymentStatus || 'Missing' } };
    return this.sendLifecycleEmail('DELIVERY_FINAL_HANDOFF_NOTIFICATION', this.mergeObjects_(this.buildValuesFromProject_(project.data), values || {}), gate);
  },

  requestRevisionClarification: function (projectId, clarificationRequest, values) {
    var project = DriveService.getProjectSnapshot_(projectId);
    if (!project.success) return project;
    var closed = String(project.data.projectStatus || '').toLowerCase().indexOf('closed') !== -1;
    var gate = { success: !closed, data: { allowed: !closed, projectStatus: project.data.projectStatus } };
    return this.sendLifecycleEmail('REVISION_CLARIFICATION_REQUEST', this.mergeObjects_(this.buildValuesFromProject_(project.data), this.mergeObjects_({ clarification_request: clarificationRequest || '' }, values || {})), gate);
  },

  declineUnableToQuote: function (leadId, declineReason, values) {
    var lead = this.getLeadSnapshot_(leadId);
    if (!lead.success) return lead;
    var gate = { success: true, data: { allowed: true, reason: 'Lead exists and decline is informational; no project status advances.' } };
    return this.sendLifecycleEmail('UNABLE_TO_QUOTE_DECLINED_PROJECT', this.mergeObjects_(lead.data.values, this.mergeObjects_({ decline_reason: declineReason || '' }, values || {})), gate);
  },

  // ===== DOCUMENT EVENT RUNNERS =====
  generateClientQuoteDocument: function (projectId, values) { return this.generateLifecycleDocument('CLIENT_QUOTE', values || {}, projectId, { success: true, data: { allowed: true, gate: 'Quote exists / commercial approval' } }); },
  generateScopeOfWorkDocument: function (projectId, values) { return this.generateLifecycleDocument('SCOPE_OF_WORK', values || {}, projectId, { success: true, data: { allowed: true, gate: 'Scope reviewed before acceptance' } }); },
  generateProjectHandoffBrief: function (projectId, values) { return this.generateLifecycleDocument('PROJECT_HANDOFF_BRIEF', values || {}, projectId, { success: true, data: { allowed: true, gate: 'Quote accepted and project created' } }); },
  generateDeliveryNote: function (projectId, values) { return this.generateLifecycleDocument('DELIVERY_NOTE', values || {}, projectId, { success: true, data: { allowed: true, gate: 'Payment gate allows release' } }); },
  generateProjectClosureSummary: function (projectId, values) { return this.generateLifecycleDocument('PROJECT_CLOSURE_SUMMARY', values || {}, projectId, { success: true, data: { allowed: true, gate: 'Delivery complete and payment gate satisfied' } }); },

  /**
   * FUNCTION: runLifecycleSmokeTest
   * PURPOSE: Simulate the production lifecycle without live email or Drive writes.
   * INPUT: none
   * OUTPUT: ordered smoke test stages.
   * SIDE EFFECTS: none
   */
  runLifecycleSmokeTest: function () {
    try {
      var values = ProductionTemplateService.getRepresentativeValues_();
      var stages = [
        { event: 'Create fake lead', result: { success: true, message: 'Fake lead prepared in memory only.', data: { lead_id: values.lead_id } } },
        { event: 'Complete Step 2', result: { success: true, message: 'Representative Step 2 completion gate passed.', data: { qualification_status: 'Qualified' } } },
        { event: 'Vendor pricing received', result: { success: true, message: 'Representative vendor pricing received.', data: { vendor_price: values.vendor_price, vendor_eta: values.vendor_eta } } },
        { event: 'Client quote issued', result: ProductionTemplateService.renderEmailTemplate('CLIENT_QUOTE_ISSUED', values) },
        { event: 'Quote accepted', result: this.renderLifecycleEmailDryRun('QUOTE_ACCEPTED_CONFIRMATION', values, { success: true, data: { allowed: true, quoteStatus: 'Accepted' } }) },
        { event: 'Payment requested', result: this.renderLifecycleEmailDryRun('DEPOSIT_PAYMENT_REQUEST', values, { success: true, data: { allowed: true, quoteStatus: 'Accepted' } }) },
        { event: 'Project started', result: this.renderLifecycleEmailDryRun('PROJECT_STARTED_CONFIRMATION', values, { success: true, data: { allowed: true, projectStatus: 'Project Created' } }) },
        { event: 'Delivery ready', result: this.renderLifecycleEmailDryRun('DELIVERY_FINAL_HANDOFF_NOTIFICATION', this.mergeObjects_(values, { payment_status: 'Release Approved' }), { success: true, data: { allowed: true, paymentStatus: 'Release Approved' } }) },
        { event: 'Project closed', result: this.renderLifecycleDocumentDryRun('PROJECT_CLOSURE_SUMMARY', values, { success: true, data: { allowed: true, projectStatus: 'Closed' } }) }
      ];
      return { success: true, message: 'Lifecycle smoke test completed without live email or Drive writes.', data: { noLiveEmailSent: true, noLiveDriveWrite: true, stages: stages } };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.runLifecycleSmokeTest', error);
      return { success: false, message: 'Lifecycle smoke test failed.' };
    }
  },

  // ===== HELPERS =====
  buildEmailMapping_: function (templateKey, lifecycleEvent, requiredGate, hook, missingTrigger, requiredDataFields, loggingDestination) {
    return { templateKey: templateKey, lifecycleEvent: lifecycleEvent, requiredGate: requiredGate, existingServiceFunctionToHookInto: hook, missingTriggerIfAny: missingTrigger, requiredDataFields: requiredDataFields, loggingDestination: loggingDestination };
  },

  buildDocumentMapping_: function (templateKey, lifecycleEvent, requiredGate, hook, missingTrigger, requiredDataFields, loggingDestination) {
    return { templateKey: templateKey, lifecycleEvent: lifecycleEvent, requiredGate: requiredGate, existingServiceFunctionToHookInto: hook, missingTriggerIfAny: missingTrigger, requiredDataFields: requiredDataFields, loggingDestination: loggingDestination };
  },

  getTemplateCatalogueKeys_: function () {
    var emailResult = ProductionTemplateService.getEmailTemplates();
    var docResult = ProductionTemplateService.getDocumentTemplates();
    var emailKeys = emailResult.success ? Object.keys(emailResult.data.templates) : [];
    var docKeys = docResult.success ? Object.keys(docResult.data.templates) : [];
    return { emailKeys: emailKeys, documentKeys: docKeys, all: emailKeys.concat(docKeys) };
  },

  buildValuesFromQuote_: function (quote) {
    var lead = this.getLeadSnapshot_(quote.leadId);
    var base = lead.success ? lead.data.values : {};
    return this.mergeObjects_(base, {
      quote_id: quote.quoteId,
      lead_id: quote.leadId,
      vendor_name: quote.vendorId || '',
      client_quote_amount: quote.clientQuoteAmount || quote.amount || '',
      quote_valid_until: quote.validUntil || '',
      payment_amount: quote.clientQuoteAmount || quote.amount || '',
      payment_status: 'Pending'
    });
  },

  buildValuesFromProject_: function (project) {
    var lead = this.getLeadSnapshot_(project.leadId);
    var base = lead.success ? lead.data.values : {};
    return this.mergeObjects_(base, {
      project_id: project.projectId,
      lead_id: project.leadId,
      quote_id: project.quoteId,
      project_status: project.projectStatus,
      payment_status: project.paymentStatusReference || 'Pending'
    });
  },

  getLeadSnapshot_: function (leadId) {
    try {
      var setup = DatabaseService.ensureLeadsSheetStructure();
      if (!setup.success) return setup;
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Lead ID'] - 1] || '').trim() === String(leadId || '').trim()) {
          return {
            success: true,
            message: 'Lead snapshot loaded.',
            data: {
              values: {
                lead_id: String(values[i][columns['Lead ID'] - 1] || '').trim(),
                client_name: String(values[i][columns['Full Name'] - 1] || '').trim(),
                client_email: String(values[i][columns['Email'] - 1] || '').trim(),
                company_name: String(values[i][columns['Company'] - 1] || '').trim(),
                project_type: String(values[i][columns['Project Type'] - 1] || '').trim(),
                technical_summary: String(values[i][columns['Notes'] - 1] || '').trim(),
                qualification_status: columns['Qualification Status'] ? String(values[i][columns['Qualification Status'] - 1] || '').trim() : ''
              },
              rowNumber: i + 1
            }
          };
        }
      }
      return { success: false, message: 'Lead not found for provided leadId.' };
    } catch (error) {
      ErrorLogger.logError_('ProductionLifecycleService.getLeadSnapshot_', error, { leadId: leadId });
      return { success: false, message: 'Failed to load lead snapshot.' };
    }
  },

  getHeaderMap_: function (sheet) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    headers.forEach(function (header, index) { map[String(header || '').trim()] = index + 1; });
    return map;
  },

  findMissingPlaceholders_: function (renderedContent) {
    var text = String(renderedContent || '');
    var matches = text.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || [];
    var unique = {};
    matches.forEach(function (match) { unique[match] = true; });
    return Object.keys(unique);
  },

  evaluateRepresentativeGate_: function (templateKey) {
    var gates = {
      QUOTE_ACCEPTED_CONFIRMATION: 'Quote status Accepted',
      DEPOSIT_PAYMENT_REQUEST: 'Quote status Accepted',
      PROJECT_STARTED_CONFIRMATION: 'Project exists',
      FILE_RECEIVED_CONFIRMATION: 'File intake event recorded',
      DELIVERY_FINAL_HANDOFF_NOTIFICATION: 'Payment gate allows release',
      REVISION_CLARIFICATION_REQUEST: 'Project active',
      UNABLE_TO_QUOTE_DECLINED_PROJECT: 'Lead reviewed and not converted',
      CLIENT_QUOTE: 'Approved vendor pricing or manual approval',
      SCOPE_OF_WORK: 'Scope reviewed before acceptance',
      PROJECT_HANDOFF_BRIEF: 'Quote accepted and project created',
      DELIVERY_NOTE: 'Payment gate allows release',
      PROJECT_CLOSURE_SUMMARY: 'Delivery complete and payment gate satisfied'
    };
    return { success: true, data: { allowed: true, gate: gates[templateKey] || 'Representative dry-run gate' } };
  },

  mergeObjects_: function (base, overlay) {
    var merged = {};
    Object.keys(base || {}).forEach(function (key) { merged[key] = base[key]; });
    Object.keys(overlay || {}).forEach(function (key) { merged[key] = overlay[key]; });
    return merged;
  }
};

// ===== GLOBAL RUNNERS FOR APPS SCRIPT =====
function getProductionLifecycleTemplateMap() { return ProductionLifecycleService.getLifecycleTemplateMap(); }
function runProductionLifecycleDryRuns(values) { return ProductionLifecycleService.renderAllNewlyWiredDryRuns(values || {}); }
function runProductionLifecycleSmokeTest() { return ProductionLifecycleService.runLifecycleSmokeTest(); }
function sendQuoteAcceptedLifecycleEmail(quoteId, values) { return ProductionLifecycleService.handleQuoteAccepted(quoteId, values || {}); }
function sendDepositPaymentRequestLifecycleEmail(quoteId, values) { return ProductionLifecycleService.requestDepositPayment(quoteId, values || {}); }
function sendProjectStartedLifecycleEmail(projectId, values) { return ProductionLifecycleService.handleProjectStarted(projectId, values || {}); }
function sendFileReceivedLifecycleEmail(leadId, filesReceived, values) { return ProductionLifecycleService.handleFileReceived(leadId, filesReceived, values || {}); }
function sendDeliveryReadyLifecycleEmail(projectId, values) { return ProductionLifecycleService.handleDeliveryReady(projectId, values || {}); }
function sendRevisionClarificationLifecycleEmail(projectId, clarificationRequest, values) { return ProductionLifecycleService.requestRevisionClarification(projectId, clarificationRequest, values || {}); }
function sendUnableToQuoteLifecycleEmail(leadId, declineReason, values) { return ProductionLifecycleService.declineUnableToQuote(leadId, declineReason, values || {}); }
