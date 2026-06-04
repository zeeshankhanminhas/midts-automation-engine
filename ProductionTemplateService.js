/**
 * MIDTS Automation Engine
 * STAGE: Production messaging and document templates sprint
 * WHAT THIS FILE DOES:
 * - Stores production-safe outbound email templates for MIDTS lifecycle communication.
 * - Stores document template content and governance metadata for generated operational records.
 * - Provides dry-run preview helpers that render templates without sending emails or writing records.
 * DEPENDENCIES:
 * - No external APIs.
 * - No Google Sheet writes.
 * - Optional caller-provided placeholder values from existing service objects.
 */

var ProductionTemplateService = {
  // ===== CONFIG =====
  // These terms are disallowed in rendered production-facing previews because they make messages sound experimental.
  PRODUCTION_UNSAFE_PATTERN_: /\b(test|dry\s*-?\s*run|sample|placeholder|demo|fake|todo|debug)\b/i,

  /**
   * FUNCTION: getEmailTemplates
   * PURPOSE: Return the complete production-safe email template catalogue.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getEmailTemplates: function () {
    // ===== MAIN LOGIC =====
    try {
      var templates = {
        STEP_1_ENQUIRY_RECEIVED: {
          recipientType: 'Client',
          subject: 'MIDTS enquiry received - {{lead_id}}',
          text: 'Hello {{client_name}},\n\nThank you for contacting MIDTS. We have received your enquiry and created reference {{lead_id}}.\n\nTo assess the work properly, please complete the technical requirement step using this secure link:\n{{step2_url}}\n\nOnce the technical details are submitted, MIDTS will review the requirement, confirm whether it is suitable for support, and advise the next step.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Thank you for contacting MIDTS. We have received your enquiry and created reference <strong>{{lead_id}}</strong>.</p><p>To assess the work properly, please complete the technical requirement step using this secure link:</p><p><a href="{{step2_url}}">Complete technical requirements</a></p><p>Once the technical details are submitted, MIDTS will review the requirement, confirm whether it is suitable for support, and advise the next step.</p><p>Kind regards,<br>MIDTS</p>'
        },
        STEP_2_TECHNICAL_REQUIREMENT_REQUEST: {
          recipientType: 'Client',
          subject: 'MIDTS technical details required - {{lead_id}}',
          text: 'Hello {{client_name}},\n\nMIDTS needs the technical requirement details before we can qualify your request for review and pricing.\n\nPlease complete the requirement form here:\n{{step2_url}}\n\nReference: {{lead_id}}\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>MIDTS needs the technical requirement details before we can qualify your request for review and pricing.</p><p><a href="{{step2_url}}">Complete technical requirements</a></p><p>Reference: <strong>{{lead_id}}</strong></p><p>Kind regards,<br>MIDTS</p>'
        },
        STEP_2_RECEIVED_CONFIRMATION: {
          recipientType: 'Client',
          subject: 'MIDTS technical details received - {{lead_id}}',
          text: 'Hello {{client_name}},\n\nWe have received the technical requirement details for {{lead_id}}. MIDTS will review the information and confirm whether the work can proceed to pricing.\n\nIf clarification is needed, we will contact you before any quote is issued.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>We have received the technical requirement details for <strong>{{lead_id}}</strong>. MIDTS will review the information and confirm whether the work can proceed to pricing.</p><p>If clarification is needed, we will contact you before any quote is issued.</p><p>Kind regards,<br>MIDTS</p>'
        },
        INTERNAL_LEAD_REVIEW_NOTIFICATION: {
          recipientType: 'Internal',
          subject: 'MIDTS lead review required - {{lead_id}}',
          text: 'Lead review required.\n\nLead: {{lead_id}}\nClient: {{client_name}}\nCompany: {{company_name}}\nProject type: {{project_type}}\nTechnical summary: {{technical_summary}}\n\nReview qualification status before vendor pricing is requested.',
          html: '<p>Lead review required.</p><ul><li><strong>Lead:</strong> {{lead_id}}</li><li><strong>Client:</strong> {{client_name}}</li><li><strong>Company:</strong> {{company_name}}</li><li><strong>Project type:</strong> {{project_type}}</li><li><strong>Technical summary:</strong> {{technical_summary}}</li></ul><p>Review qualification status before vendor pricing is requested.</p>'
        },
        VENDOR_PRICING_REQUEST: {
          recipientType: 'Vendor',
          subject: 'MIDTS pricing request - {{lead_id}}',
          text: 'Hello {{vendor_name}},\n\nMIDTS has assigned a qualified request to you for pricing review. Please review the summary below and submit your cost, estimated turnaround, assumptions, and exclusions through the secure pricing form.\n\nLead reference: {{lead_id}}\nCompany: {{company_name}}\nProject type: {{project_type}}\nQualification status: {{qualification_status}}\nTechnical summary: {{technical_summary}}\n\nSubmit vendor pricing here:\n{{vendor_pricing_url}}\n\nThis link is assigned to your vendor profile. Please do not forward it.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{vendor_name}},</p><p>MIDTS has assigned a qualified request to you for pricing review. Please review the summary below and submit your cost, estimated turnaround, assumptions, and exclusions through the secure pricing form.</p><ul><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Company:</strong> {{company_name}}</li><li><strong>Project type:</strong> {{project_type}}</li><li><strong>Qualification status:</strong> {{qualification_status}}</li><li><strong>Technical summary:</strong> {{technical_summary}}</li></ul><p><a href="{{vendor_pricing_url}}">Submit vendor pricing</a></p><p>This link is assigned to your vendor profile. Please do not forward it.</p><p>Kind regards,<br>MIDTS</p>'
        },
        VENDOR_PRICING_RECEIVED_CONFIRMATION: {
          recipientType: 'Vendor',
          subject: 'MIDTS pricing received - {{lead_id}}',
          text: 'Hello {{vendor_name}},\n\nMIDTS has received your pricing response for {{lead_id}}. The submission will be reviewed internally before any client quote is issued.\n\nSubmitted cost: {{vendor_price}}\nEstimated turnaround: {{vendor_eta}}\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{vendor_name}},</p><p>MIDTS has received your pricing response for <strong>{{lead_id}}</strong>. The submission will be reviewed internally before any client quote is issued.</p><ul><li><strong>Submitted cost:</strong> {{vendor_price}}</li><li><strong>Estimated turnaround:</strong> {{vendor_eta}}</li></ul><p>Kind regards,<br>MIDTS</p>'
        },
        CLIENT_QUOTE_ISSUED: {
          recipientType: 'Client',
          subject: 'MIDTS quote issued - {{quote_id}}',
          text: 'Hello {{client_name}},\n\nYour MIDTS quote is ready for review.\n\nQuote reference: {{quote_id}}\nLead reference: {{lead_id}}\nCompany: {{company_name}}\nProject type: {{project_type}}\nQuote amount: {{client_quote_amount}}\nValid until: {{quote_valid_until}}\n\nTo accept the quote, use this link or reply confirming the quote reference:\n{{quote_acceptance_url}}\n\nProject work will not start until quote acceptance is recorded and the payment gate is satisfied where applicable.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Your MIDTS quote is ready for review.</p><ul><li><strong>Quote reference:</strong> {{quote_id}}</li><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Company:</strong> {{company_name}}</li><li><strong>Project type:</strong> {{project_type}}</li><li><strong>Quote amount:</strong> {{client_quote_amount}}</li><li><strong>Valid until:</strong> {{quote_valid_until}}</li></ul><p><a href="{{quote_acceptance_url}}">Accept this quote</a></p><p>Project work will not start until quote acceptance is recorded and the payment gate is satisfied where applicable.</p><p>Kind regards,<br>MIDTS</p>'
        },
        QUOTE_ACCEPTED_CONFIRMATION: {
          recipientType: 'Client',
          subject: 'MIDTS quote accepted - {{quote_id}}',
          text: 'Hello {{client_name}},\n\nMIDTS has recorded acceptance of quote {{quote_id}} for lead {{lead_id}}.\n\nThe project will move to the next operational step once payment and project-start checks are complete.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>MIDTS has recorded acceptance of quote <strong>{{quote_id}}</strong> for lead <strong>{{lead_id}}</strong>.</p><p>The project will move to the next operational step once payment and project-start checks are complete.</p><p>Kind regards,<br>MIDTS</p>'
        },
        DEPOSIT_PAYMENT_REQUEST: {
          recipientType: 'Client',
          subject: 'MIDTS payment request - {{quote_id}}',
          text: 'Hello {{client_name}},\n\nPayment is required before the project can move into active delivery.\n\nQuote reference: {{quote_id}}\nLead reference: {{lead_id}}\nAmount due: {{payment_amount}}\nPayment status: {{payment_status}}\n\nPlease use the payment instructions provided by MIDTS.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Payment is required before the project can move into active delivery.</p><ul><li><strong>Quote reference:</strong> {{quote_id}}</li><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Amount due:</strong> {{payment_amount}}</li><li><strong>Payment status:</strong> {{payment_status}}</li></ul><p>Please use the payment instructions provided by MIDTS.</p><p>Kind regards,<br>MIDTS</p>'
        },
        PROJECT_STARTED_CONFIRMATION: {
          recipientType: 'Client',
          subject: 'MIDTS project started - {{project_id}}',
          text: 'Hello {{client_name}},\n\nYour MIDTS project has started.\n\nProject reference: {{project_id}}\nLead reference: {{lead_id}}\nProject status: {{project_status}}\n\nMIDTS will manage the delivery workflow and advise if further clarification is required.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Your MIDTS project has started.</p><ul><li><strong>Project reference:</strong> {{project_id}}</li><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Project status:</strong> {{project_status}}</li></ul><p>MIDTS will manage the delivery workflow and advise if further clarification is required.</p><p>Kind regards,<br>MIDTS</p>'
        },
        FILE_RECEIVED_CONFIRMATION: {
          recipientType: 'Client',
          subject: 'MIDTS files received - {{lead_id}}',
          text: 'Hello {{client_name}},\n\nMIDTS has received files for {{lead_id}}.\n\nFiles received: {{files_received}}\n\nThe files will be reviewed before any vendor-safe package is prepared or dispatched.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>MIDTS has received files for <strong>{{lead_id}}</strong>.</p><p><strong>Files received:</strong> {{files_received}}</p><p>The files will be reviewed before any vendor-safe package is prepared or dispatched.</p><p>Kind regards,<br>MIDTS</p>'
        },
        DELIVERY_FINAL_HANDOFF_NOTIFICATION: {
          recipientType: 'Client',
          subject: 'MIDTS delivery ready - {{project_id}}',
          text: 'Hello {{client_name}},\n\nDelivery is ready for project {{project_id}}.\n\nLead reference: {{lead_id}}\nDelivery summary: {{delivery_summary}}\nPayment status: {{payment_status}}\n\nFinal release is controlled by the applicable payment and delivery checks.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Delivery is ready for project <strong>{{project_id}}</strong>.</p><ul><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Delivery summary:</strong> {{delivery_summary}}</li><li><strong>Payment status:</strong> {{payment_status}}</li></ul><p>Final release is controlled by the applicable payment and delivery checks.</p><p>Kind regards,<br>MIDTS</p>'
        },
        REVISION_CLARIFICATION_REQUEST: {
          recipientType: 'Client',
          subject: 'MIDTS clarification required - {{project_id}}',
          text: 'Hello {{client_name}},\n\nMIDTS needs clarification before the work can continue.\n\nProject reference: {{project_id}}\nLead reference: {{lead_id}}\nClarification required: {{clarification_request}}\n\nPlease reply with the requested details so the delivery workflow can continue.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>MIDTS needs clarification before the work can continue.</p><ul><li><strong>Project reference:</strong> {{project_id}}</li><li><strong>Lead reference:</strong> {{lead_id}}</li><li><strong>Clarification required:</strong> {{clarification_request}}</li></ul><p>Please reply with the requested details so the delivery workflow can continue.</p><p>Kind regards,<br>MIDTS</p>'
        },
        UNABLE_TO_QUOTE_DECLINED_PROJECT: {
          recipientType: 'Client',
          subject: 'MIDTS enquiry update - {{lead_id}}',
          text: 'Hello {{client_name}},\n\nThank you for sending the details for {{lead_id}}. After review, MIDTS is unable to provide a quote for this requirement.\n\nReason: {{decline_reason}}\n\nNo project work has been started.\n\nKind regards,\nMIDTS',
          html: '<p>Hello {{client_name}},</p><p>Thank you for sending the details for <strong>{{lead_id}}</strong>. After review, MIDTS is unable to provide a quote for this requirement.</p><p><strong>Reason:</strong> {{decline_reason}}</p><p>No project work has been started.</p><p>Kind regards,<br>MIDTS</p>'
        }
      };
      return { success: true, message: 'Email template catalogue loaded.', data: { templates: templates } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.getEmailTemplates', error);
      return { success: false, message: 'Failed to load email templates.' };
    }
  },

  /**
   * FUNCTION: getDocumentTemplates
   * PURPOSE: Return the complete document template catalogue with governance metadata and body content.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getDocumentTemplates: function () {
    // ===== MAIN LOGIC =====
    try {
      var common = {
        outputFormat: 'Google Doc generated in Drive, with optional PDF export after approval',
        owner: 'MIDTS Operations',
        failureHandling: 'Do not dispatch externally. Log the failure, keep existing data unchanged, and retry after required fields or approvals are corrected.'
      };
      var templates = {
        INITIAL_ENQUIRY_RECORD: this.buildDocumentTemplate_('Initial Enquiry Record', 'Client intake and internal review', 'Created after Step 1 enquiry capture', ['{{lead_id}}', '{{timestamp}}', '{{client_name}}', '{{company_name}}', '{{project_type}}', '{{source}}'], ['{{lead_id}}', '{{timestamp}}', '{{client_name}}', '{{client_email}}'], ['{{company_name}}', '{{project_type}}', '{{initial_notes}}'], 'Leads/{{lead_id}}/01 Intake', 'MIDTS Intake', 'Lead ID exists'),
        TECHNICAL_REQUIREMENT_BRIEF: this.buildDocumentTemplate_('Technical Requirement Brief', 'MIDTS review team and approved vendors after safe packaging', 'Created after Step 2 details are received', ['{{lead_id}}', '{{timestamp}}', '{{technical_summary}}', '{{files_received}}', '{{deadline}}'], ['{{lead_id}}', '{{timestamp}}', '{{technical_summary}}'], ['{{files_received}}', '{{deadline}}', '{{software_requirements}}'], 'Leads/{{lead_id}}/02 Requirements', common.owner, 'Step 2 submitted'),
        INTERNAL_REVIEW_SHEET: this.buildDocumentTemplate_('Internal Review Sheet', 'MIDTS internal approver', 'Created during qualification review', ['{{lead_id}}', '{{timestamp}}', '{{qualification_status}}', '{{review_notes}}'], ['{{lead_id}}', '{{timestamp}}', '{{qualification_status}}'], ['{{review_notes}}', '{{risk_notes}}'], 'Leads/{{lead_id}}/03 Internal Review', 'MIDTS Approver', 'MIDTS approval before vendor pricing'),
        VENDOR_PRICING_REQUEST: this.buildDocumentTemplate_('Vendor Pricing Request', 'Approved vendor', 'Created before vendor pricing dispatch', ['{{lead_id}}', '{{timestamp}}', '{{vendor_name}}', '{{technical_summary}}', '{{files_received}}'], ['{{lead_id}}', '{{timestamp}}', '{{vendor_name}}', '{{technical_summary}}'], ['{{vendor_eta}}', '{{vendor_notes}}'], 'Leads/{{lead_id}}/04 Vendor Pricing', 'MIDTS Operations', 'Vendor eligibility and vendor-safe package approved'),
        VENDOR_QUOTE_COMPARISON: this.buildDocumentTemplate_('Vendor Quote Comparison', 'MIDTS internal approver', 'Created after one or more vendor submissions', ['{{lead_id}}', '{{timestamp}}', '{{vendor_name}}', '{{vendor_price}}', '{{vendor_eta}}'], ['{{lead_id}}', '{{timestamp}}', '{{vendor_price}}'], ['{{vendor_notes}}', '{{comparison_notes}}'], 'Leads/{{lead_id}}/04 Vendor Pricing', 'MIDTS Approver', 'Vendor pricing submitted'),
        CLIENT_QUOTE: this.buildDocumentTemplate_('Client Quote', 'Client', 'Generated after approved vendor pricing or manual approval', ['{{quote_id}}', '{{lead_id}}', '{{timestamp}}', '{{client_quote_amount}}', '{{quote_valid_until}}'], ['{{quote_id}}', '{{lead_id}}', '{{timestamp}}', '{{client_quote_amount}}'], ['{{scope_summary}}', '{{quote_terms}}'], 'Leads/{{lead_id}}/05 Quote', 'MIDTS Commercial', 'Approved vendor pricing or documented manual approval'),
        SCOPE_OF_WORK: this.buildDocumentTemplate_('Scope of Work', 'Client and MIDTS delivery', 'Generated with or after client quote', ['{{quote_id}}', '{{lead_id}}', '{{technical_summary}}', '{{deliverables}}'], ['{{quote_id}}', '{{lead_id}}', '{{technical_summary}}', '{{deliverables}}'], ['{{exclusions}}', '{{assumptions}}'], 'Leads/{{lead_id}}/05 Quote', 'MIDTS Commercial', 'Scope reviewed before acceptance'),
        PROJECT_HANDOFF_BRIEF: this.buildDocumentTemplate_('Project Handoff Brief', 'MIDTS delivery team', 'Created after quote acceptance and project creation', ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{project_status}}', '{{technical_summary}}'], ['{{project_id}}', '{{lead_id}}', '{{timestamp}}'], ['{{vendor_name}}', '{{delivery_notes}}'], 'Projects/{{project_id}}/01 Handoff', 'MIDTS Delivery', 'Quote accepted and project created'),
        FILE_INTAKE_REGISTER: this.buildDocumentTemplate_('File Intake Register', 'MIDTS internal file reviewer', 'Created or updated when files are received', ['{{lead_id}}', '{{timestamp}}', '{{files_received}}', '{{file_review_status}}'], ['{{lead_id}}', '{{timestamp}}', '{{files_received}}'], ['{{file_notes}}'], 'Leads/{{lead_id}}/06 Files', 'MIDTS File Reviewer', 'Files uploaded or manually recorded'),
        VENDOR_SAFE_FILE_PACKAGE_NOTE: this.buildDocumentTemplate_('Vendor Safe File Package Note', 'Approved vendor', 'Created before vendor package dispatch', ['{{lead_id}}', '{{timestamp}}', '{{vendor_name}}', '{{files_received}}'], ['{{lead_id}}', '{{timestamp}}', '{{vendor_name}}'], ['{{package_notes}}'], 'Leads/{{lead_id}}/06 Files/Vendor Safe Packages', 'MIDTS File Reviewer', 'Vendor-safe package reviewed and access rules passed'),
        PAYMENT_RECORD: this.buildDocumentTemplate_('Payment Record', 'MIDTS finance and client if shared', 'Created when payment is requested or updated', ['{{payment_id}}', '{{quote_id}}', '{{lead_id}}', '{{timestamp}}', '{{payment_status}}'], ['{{payment_id}}', '{{quote_id}}', '{{lead_id}}', '{{timestamp}}'], ['{{payment_notes}}'], 'Leads/{{lead_id}}/07 Payments', 'MIDTS Finance', 'Quote accepted'),
        DELIVERY_NOTE: this.buildDocumentTemplate_('Delivery Note', 'Client', 'Created when delivery is ready for release', ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{delivery_summary}}', '{{payment_status}}'], ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{delivery_summary}}'], ['{{handoff_notes}}'], 'Projects/{{project_id}}/02 Delivery', 'MIDTS Delivery', 'Payment gate allows release'),
        REVISION_REQUEST_RECORD: this.buildDocumentTemplate_('Revision Request Record', 'Client, MIDTS delivery, and vendor if applicable', 'Created when a revision or clarification is requested', ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{clarification_request}}'], ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{clarification_request}}'], ['{{revision_notes}}'], 'Projects/{{project_id}}/03 Revisions', 'MIDTS Delivery', 'Project active'),
        PROJECT_CLOSURE_SUMMARY: this.buildDocumentTemplate_('Project Closure Summary', 'MIDTS internal and client if shared', 'Created after final handoff and closure checks', ['{{project_id}}', '{{lead_id}}', '{{timestamp}}', '{{project_status}}', '{{delivery_summary}}'], ['{{project_id}}', '{{lead_id}}', '{{timestamp}}'], ['{{closure_notes}}'], 'Projects/{{project_id}}/04 Closure', 'MIDTS Delivery', 'Delivery complete and payment gate satisfied'),
        AUDIT_LOG_SUMMARY: this.buildDocumentTemplate_('Audit Log Summary', 'MIDTS internal governance', 'Generated on demand for operational review', ['{{lead_id}}', '{{timestamp}}', '{{email_log_summary}}', '{{drive_log_summary}}', '{{error_log_summary}}'], ['{{lead_id}}', '{{timestamp}}'], ['{{email_log_summary}}', '{{drive_log_summary}}', '{{error_log_summary}}'], 'Leads/{{lead_id}}/99 Audit', 'MIDTS Operations', 'Internal request for audit summary')
      };
      return { success: true, message: 'Document template catalogue loaded.', data: { templates: templates, defaults: common } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.getDocumentTemplates', error);
      return { success: false, message: 'Failed to load document templates.' };
    }
  },

  /**
   * FUNCTION: renderEmailTemplate
   * PURPOSE: Render one email template with caller-provided placeholder values.
   * INPUT: templateKey (string), values (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  renderEmailTemplate: function (templateKey, values) {
    // ===== MAIN LOGIC =====
    try {
      var catalogue = this.getEmailTemplates();
      if (!catalogue.success) return catalogue;
      var key = String(templateKey || '').trim();
      var template = catalogue.data.templates[key];
      if (!template) return { success: false, message: 'Email template not found: ' + key };
      var subject = this.renderString_(template.subject, values || {});
      var text = this.renderString_(template.text, values || {});
      var html = this.renderString_(template.html, values || {});
      var safety = this.assessProductionSafety_(subject + '\n' + text + '\n' + html);
      return {
        success: true,
        message: 'Email template rendered without sending.',
        data: {
          templateKey: key,
          recipientType: template.recipientType,
          subject: subject,
          textContent: text,
          htmlContent: html,
          productionSafe: safety.safe,
          safetyFindings: safety.findings,
          placeholderValues: values || {}
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.renderEmailTemplate', error, { templateKey: templateKey });
      return { success: false, message: 'Failed to render email template.' };
    }
  },

  /**
   * FUNCTION: renderDocumentTemplate
   * PURPOSE: Render one document template with caller-provided placeholder values.
   * INPUT: templateKey (string), values (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  renderDocumentTemplate: function (templateKey, values) {
    // ===== MAIN LOGIC =====
    try {
      var catalogue = this.getDocumentTemplates();
      if (!catalogue.success) return catalogue;
      var key = String(templateKey || '').trim();
      var template = catalogue.data.templates[key];
      if (!template) return { success: false, message: 'Document template not found: ' + key };
      var rendered = this.renderString_(template.content, values || {});
      var safety = this.assessProductionSafety_(rendered);
      return { success: true, message: 'Document template rendered without generating a file.', data: { templateKey: key, title: template.title, content: rendered, metadata: template, productionSafe: safety.safe, safetyFindings: safety.findings, placeholderValues: values || {} } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.renderDocumentTemplate', error, { templateKey: templateKey });
      return { success: false, message: 'Failed to render document template.' };
    }
  },

  /**
   * FUNCTION: runTemplateDryRunPreview
   * PURPOSE: Render representative email and document previews without live email or file generation.
   * INPUT: options (object, optional: emailTemplateKey, documentTemplateKey, values)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  runTemplateDryRunPreview: function (options) {
    // ===== MAIN LOGIC =====
    try {
      var settings = options || {};
      var values = this.mergeObjects_(this.getRepresentativeValues_(), settings.values || {});
      var emailKey = String(settings.emailTemplateKey || 'CLIENT_QUOTE_ISSUED').trim();
      var documentKey = String(settings.documentTemplateKey || 'CLIENT_QUOTE').trim();
      var emailPreview = this.renderEmailTemplate(emailKey, values);
      var documentPreview = this.renderDocumentTemplate(documentKey, values);
      var success = emailPreview.success && documentPreview.success;
      return {
        success: success,
        message: success ? 'Dry-run preview rendered without sending emails or creating files.' : 'Dry-run preview could not render all selected templates.',
        data: {
          noLiveEmailSent: true,
          noDocumentCreated: true,
          selectedEmailTemplate: emailKey,
          selectedDocumentTemplate: documentKey,
          emailPreview: emailPreview,
          documentPreview: documentPreview
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.runTemplateDryRunPreview', error, { options: options });
      return { success: false, message: 'Failed to run template dry-run preview.' };
    }
  },

  /**
   * FUNCTION: auditCommunicationTemplates
   * PURPOSE: Check template catalogues for wording that is unsafe in production-facing communication.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  auditCommunicationTemplates: function () {
    // ===== MAIN LOGIC =====
    try {
      var findings = [];
      var emails = this.getEmailTemplates();
      var docs = this.getDocumentTemplates();
      if (!emails.success) return emails;
      if (!docs.success) return docs;
      this.collectUnsafeFindings_(findings, 'email', emails.data.templates);
      this.collectUnsafeFindings_(findings, 'document', docs.data.templates);
      return { success: findings.length === 0, message: findings.length === 0 ? 'No unsafe wording found in production template catalogues.' : 'Unsafe wording found in production template catalogues.', data: { findings: findings } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProductionTemplateService.auditCommunicationTemplates', error);
      return { success: false, message: 'Failed to audit communication templates.' };
    }
  },

  /**
   * FUNCTION: buildDocumentTemplate_
   * PURPOSE: Internal helper that builds consistent document template metadata and content.
   * INPUT: title, audience, whenGenerated, sourceDataFields, requiredFields, optionalFields, driveFolderLocation, owner, approvalGate
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  buildDocumentTemplate_: function (title, audience, whenGenerated, sourceDataFields, requiredFields, optionalFields, driveFolderLocation, owner, approvalGate) {
    // ===== MAIN LOGIC =====
    return {
      title: title,
      purpose: title + ' for controlled MIDTS workflow governance.',
      audience: audience,
      whenGenerated: whenGenerated,
      sourceDataFields: sourceDataFields,
      requiredFields: requiredFields,
      optionalFields: optionalFields,
      outputFormat: 'Google Doc generated in Drive, with optional PDF export after approval',
      driveFolderLocation: driveFolderLocation,
      owner: owner,
      approvalGate: approvalGate,
      failureHandling: 'Do not dispatch externally. Log the failure, keep existing data unchanged, and retry after required fields or approvals are corrected.',
      content: title + '\nGenerated at: {{timestamp}}\nLead ID: {{lead_id}}\nProject ID: {{project_id}}\nQuote ID: {{quote_id}}\n\nClient: {{client_name}}\nCompany: {{company_name}}\nProject type: {{project_type}}\nStatus: {{project_status}}\n\nTechnical summary:\n{{technical_summary}}\n\nFiles received:\n{{files_received}}\n\nCommercial fields:\nVendor: {{vendor_name}}\nVendor price: {{vendor_price}}\nMIDTS margin: {{midts_margin}}\nClient quote amount: {{client_quote_amount}}\nQuote valid until: {{quote_valid_until}}\nPayment status: {{payment_status}}\n\nOperational notes:\n{{operational_notes}}\n\nApproval gate:\n' + approvalGate + '\n\nOwner:\n' + owner + '\n'
    };
  },

  /**
   * FUNCTION: renderString_
   * PURPOSE: Internal helper that replaces {{tokens}} with provided values.
   * INPUT: template (string), values (object)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  renderString_: function (template, values) {
    // ===== MAIN LOGIC =====
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (match, key) {
      var value = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
      return String(value == null ? '' : value);
    });
  },

  /**
   * FUNCTION: assessProductionSafety_
   * PURPOSE: Internal helper that flags rendered content containing experimental wording.
   * INPUT: content (string)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  assessProductionSafety_: function (content) {
    // ===== MAIN LOGIC =====
    var text = String(content || '');
    var matches = text.match(this.PRODUCTION_UNSAFE_PATTERN_);
    return { safe: !matches, findings: matches ? [matches[0]] : [] };
  },

  /**
   * FUNCTION: collectUnsafeFindings_
   * PURPOSE: Internal helper that scans template definitions for unsafe terms.
   * INPUT: findings (array), type (string), templates (object)
   * OUTPUT: none
   * SIDE EFFECTS: Mutates the findings array supplied by the caller.
   */
  collectUnsafeFindings_: function (findings, type, templates) {
    // ===== MAIN LOGIC =====
    Object.keys(templates || {}).forEach(function (key) {
      var serialized = JSON.stringify(templates[key]);
      var match = serialized.match(ProductionTemplateService.PRODUCTION_UNSAFE_PATTERN_);
      if (match) findings.push({ type: type, templateKey: key, term: match[0] });
    });
  },

  /**
   * FUNCTION: getRepresentativeValues_
   * PURPOSE: Internal helper that supplies realistic but non-client-specific values for dry-run previews.
   * INPUT: none
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  getRepresentativeValues_: function () {
    // ===== MAIN LOGIC =====
    return {
      lead_id: 'MIDTS-L-260001',
      quote_id: 'MIDTS-Q-260001',
      project_id: 'MIDTS-P-260001',
      payment_id: 'MIDTS-PAY-260001',
      timestamp: '2026-06-04T09:00:00Z',
      client_name: 'Client Contact',
      client_email: 'client@example.com',
      company_name: 'Client Company',
      vendor_name: 'Approved Vendor',
      project_type: 'CAD/CAM overflow support',
      technical_summary: 'Engineering support requirement requiring review of supplied CAD/CAM information and agreed deliverables.',
      files_received: 'CAD package, requirement notes',
      vendor_price: 'GBP 1,000.00',
      vendor_eta: '5 working days',
      midts_margin: '20%',
      client_quote_amount: 'GBP 1,200.00',
      quote_valid_until: '2026-07-04',
      payment_status: 'Pending',
      payment_amount: 'GBP 600.00',
      project_status: 'Pending start',
      qualification_status: 'Qualified',
      step2_url: 'https://midts.example/requirements?leadId=MIDTS-L-260001',
      vendor_pricing_url: 'https://midts.example/vendor-pricing?leadId=MIDTS-L-260001&vendorId=MIDTS-V-260001',
      quote_acceptance_url: 'https://midts.example/quote-acceptance?quoteId=MIDTS-Q-260001',
      delivery_summary: 'Final deliverables prepared for controlled release.',
      clarification_request: 'Please confirm tolerance requirements and preferred output format.',
      decline_reason: 'The requirement is outside the supported MIDTS overflow scope.',
      operational_notes: 'Review gates must be completed before external dispatch.'
    };
  },

  /**
   * FUNCTION: mergeObjects_
   * PURPOSE: Internal helper that overlays caller values on defaults.
   * INPUT: base (object), overlay (object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  mergeObjects_: function (base, overlay) {
    // ===== MAIN LOGIC =====
    var merged = {};
    Object.keys(base || {}).forEach(function (key) { merged[key] = base[key]; });
    Object.keys(overlay || {}).forEach(function (key) { merged[key] = overlay[key]; });
    return merged;
  }
};

/**
 * FUNCTION: runProductionTemplateDryRunPreview
 * PURPOSE: Global Apps Script runner for previewing templates without sending live emails or creating documents.
 * INPUT: options (object, optional: emailTemplateKey, documentTemplateKey, values)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function runProductionTemplateDryRunPreview(options) {
  // ===== MAIN LOGIC =====
  return ProductionTemplateService.runTemplateDryRunPreview(options || {});
}

/**
 * FUNCTION: auditProductionCommunicationTemplates
 * PURPOSE: Global Apps Script runner for auditing production templates for unsafe wording.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function auditProductionCommunicationTemplates() {
  // ===== MAIN LOGIC =====
  return ProductionTemplateService.auditCommunicationTemplates();
}
