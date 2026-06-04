/**
 * MIDTS Automation Engine
 * STAGE: Production messaging sprint
 * WHAT THIS FILE DOES:
 * - Applies production-safe copy wrappers to existing EmailService functions.
 * - Renders central ProductionTemplateService email templates before live dispatch.
 * DEPENDENCIES:
 * - ProductionTemplateService (ProductionTemplateService.gs)
 * - EmailService (EmailService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var MIDTSEmailProductionCopyPatch = {
  /**
   * FUNCTION: apply
   * PURPOSE: Replace selected EmailService methods with production-template-backed versions.
   * INPUT: none
   * OUTPUT: none
   * SIDE EFFECTS: Mutates EmailService functions in memory.
   */
  apply: function () {
    if (typeof EmailService === 'undefined') return;

    /**
     * FUNCTION: EmailService.sendLeadReceivedEmail
     * PURPOSE: Send the production Step 1 enquiry received template to a client.
     * INPUT: lead (object: email, fullName, leadId)
     * OUTPUT: { success: boolean, message: string, data?: object }
     * SIDE EFFECTS: Sends one Brevo email through EmailService.sendTransactionalEmail.
     */
    EmailService.sendLeadReceivedEmail = function (lead) {
      try {
        var payload = lead || {};
        var email = String(payload.email || '').trim();
        var fullName = String(payload.fullName || 'there').trim();
        var leadId = String(payload.leadId || '').trim();

        if (!email || email.indexOf('@') === -1) return { success: false, message: 'A valid lead email is required.' };
        if (!leadId) return { success: false, message: 'leadId is required to send the Step 2 link.' };

        var step2BaseUrlResult = this.getSettingValue_(ConfigService.STEP2_FORM_BASE_URL_KEY);
        if (!step2BaseUrlResult.success) return step2BaseUrlResult;

        var step2Url = this.buildStep2FormUrl_(step2BaseUrlResult.data.value, leadId);
        var safeFullName = this.escapeHtml_(fullName);
        var safeLeadReference = this.escapeHtml_(leadId);
        var safeStep2Url = this.escapeHtml_(step2Url);

        var render = ProductionTemplateService.renderEmailTemplate('STEP_1_ENQUIRY_RECEIVED', {
          client_name: safeFullName,
          lead_id: safeLeadReference,
          step2_url: safeStep2Url
        });
        if (!render.success) return render;

        return this.sendTransactionalEmail({
          toEmail: email,
          toName: fullName,
          subject: render.data.subject,
          htmlContent: render.data.htmlContent,
          textContent: render.data.textContent,
          templateKey: 'STEP_1_ENQUIRY_RECEIVED'
        });
      } catch (error) {
        ErrorLogger.logError_('EmailService.sendLeadReceivedEmail', error, { lead: lead });
        return { success: false, message: 'Failed to send lead received email.' };
      }
    };

    /**
     * FUNCTION: EmailService.getStep2ReminderTemplate_
     * PURPOSE: Return Step 2 reminder metadata while keeping production-safe subject lines.
     * INPUT: reminderStage (string: 2h|24h|72h)
     * OUTPUT: { success: boolean, message: string, data?: object }
     * SIDE EFFECTS: none
     */
    EmailService.getStep2ReminderTemplate_ = function (reminderStage) {
      var stage = String(reminderStage || '').trim().toLowerCase();
      var templates = {
        '2h': {
          subject: 'MIDTS Step 2 required - technical details needed',
          htmlIntro: 'We have received your initial request. To assess it accurately, we need the Step 2 technical details before our team can move it into review.',
          textIntro: 'We have received your initial request. To assess it accurately, we need the Step 2 technical details before our team can move it into review.',
          htmlOutro: 'If you have already submitted Step 2, no further action is needed.',
          textOutro: 'If you have already submitted Step 2, no further action is needed.',
          templateKey: 'STEP_2_REMINDER_2H'
        },
        '24h': {
          subject: 'Reminder: MIDTS is waiting for your Step 2 details',
          htmlIntro: 'Your MIDTS request is still open, but we cannot complete qualification until the Step 2 technical requirement form has been submitted.',
          textIntro: 'Your MIDTS request is still open, but we cannot complete qualification until the Step 2 technical requirement form has been submitted.',
          htmlOutro: 'Submitting Step 2 helps us understand the requirement, check feasibility, and prepare the correct next action.',
          textOutro: 'Submitting Step 2 helps us understand the requirement, check feasibility, and prepare the correct next action.',
          templateKey: 'STEP_2_REMINDER_24H'
        },
        '72h': {
          subject: 'Final reminder: MIDTS Step 2 still required',
          htmlIntro: 'This is the final reminder for your open MIDTS request. We still need the Step 2 technical details before the request can be qualified.',
          textIntro: 'This is the final reminder for your open MIDTS request. We still need the Step 2 technical details before the request can be qualified.',
          htmlOutro: 'If Step 2 is not completed, the request may remain inactive until the required information is received.',
          textOutro: 'If Step 2 is not completed, the request may remain inactive until the required information is received.',
          templateKey: 'STEP_2_REMINDER_72H'
        }
      };

      if (!templates[stage]) return { success: false, message: 'Invalid Step 2 reminder stage. Use 2h, 24h, or 72h.' };
      return { success: true, message: 'Step 2 reminder template loaded.', data: templates[stage] };
    };

    /**
     * FUNCTION: EmailService.sendStep2ReminderEmail
     * PURPOSE: Send a production-safe Step 2 technical requirement reminder to a client.
     * INPUT: lead (object: email, fullName, leadId), reminderStage (string)
     * OUTPUT: { success: boolean, message: string, data?: object }
     * SIDE EFFECTS: Sends one Brevo email through EmailService.sendTransactionalEmail.
     */
    EmailService.sendStep2ReminderEmail = function (lead, reminderStage) {
      try {
        var payload = lead || {};
        var email = String(payload.email || '').trim();
        var fullName = String(payload.fullName || 'there').trim();
        var leadId = String(payload.leadId || '').trim();
        var stage = String(reminderStage || '').trim().toLowerCase();
        var template = this.getStep2ReminderTemplate_(stage);

        if (!template.success) return template;
        if (!email || email.indexOf('@') === -1) return { success: false, message: 'A valid lead email is required.' };
        if (!leadId) return { success: false, message: 'leadId is required to send the Step 2 reminder.' };

        var step2BaseUrlResult = this.getSettingValue_(ConfigService.STEP2_FORM_BASE_URL_KEY);
        if (!step2BaseUrlResult.success) return step2BaseUrlResult;

        var step2Url = this.buildStep2FormUrl_(step2BaseUrlResult.data.value, leadId);
        var safeFullName = this.escapeHtml_(fullName);
        var safeStep2Url = this.escapeHtml_(step2Url);
        var safeLeadId = this.escapeHtml_(leadId);

        var render = ProductionTemplateService.renderEmailTemplate('STEP_2_TECHNICAL_REQUIREMENT_REQUEST', {
          client_name: safeFullName,
          lead_id: safeLeadId,
          step2_url: safeStep2Url
        });
        if (!render.success) return render;

        return this.sendTransactionalEmail({
          toEmail: email,
          toName: fullName,
          subject: render.data.subject,
          htmlContent: render.data.htmlContent,
          textContent: render.data.textContent,
          templateKey: template.data.templateKey
        });
      } catch (error) {
        ErrorLogger.logError_('EmailService.sendStep2ReminderEmail', error, { lead: lead, reminderStage: reminderStage });
        return { success: false, message: 'Failed to send Step 2 reminder email.' };
      }
    };

    /**
     * FUNCTION: EmailService.sendVendorPricingRequestEmail
     * PURPOSE: Send the production vendor pricing request template to an approved vendor.
     * INPUT: request (object: vendorEmail, vendorName, vendorId, lead)
     * OUTPUT: { success: boolean, message: string, data?: object }
     * SIDE EFFECTS: Sends one Brevo email through EmailService.sendTransactionalEmail.
     */
    EmailService.sendVendorPricingRequestEmail = function (request) {
      try {
        var payload = request || {};
        var lead = payload.lead || {};
        var vendorEmail = String(payload.vendorEmail || '').trim();
        var vendorName = String(payload.vendorName || 'there').trim();
        var vendorId = String(payload.vendorId || '').trim();
        var leadId = String(lead.leadId || payload.leadId || '').trim();

        if (!vendorEmail || vendorEmail.indexOf('@') === -1) return { success: false, message: 'A valid vendor email is required.' };
        if (!vendorId || !leadId) return { success: false, message: 'vendorId and leadId are required to send the vendor pricing link.' };

        var baseUrlResult = this.getSettingValue_(ConfigService.VENDOR_PRICING_FORM_BASE_URL_KEY);
        if (!baseUrlResult.success) return baseUrlResult;

        var pricingUrl = this.buildVendorPricingFormUrl_(baseUrlResult.data.value, leadId, vendorId);
        var company = String(lead.company || 'Not specified').trim();
        var projectType = String(lead.projectType || 'Not specified').trim();
        var notes = String(lead.notes || 'No technical notes provided yet.').trim();
        var qualificationStatus = String(lead.qualificationStatus || 'Qualified').trim();
        var safePricingUrl = this.escapeHtml_(pricingUrl);

        var render = ProductionTemplateService.renderEmailTemplate('VENDOR_PRICING_REQUEST', {
          vendor_name: this.escapeHtml_(vendorName),
          lead_id: this.escapeHtml_(leadId),
          company_name: this.escapeHtml_(company),
          project_type: this.escapeHtml_(projectType),
          qualification_status: this.escapeHtml_(qualificationStatus),
          technical_summary: this.escapeHtml_(notes).replace(/\n/g, '<br>'),
          vendor_pricing_url: safePricingUrl
        });
        if (!render.success) return render;

        return this.sendTransactionalEmail({
          toEmail: vendorEmail,
          toName: vendorName,
          subject: render.data.subject,
          htmlContent: render.data.htmlContent,
          textContent: render.data.textContent,
          templateKey: 'VENDOR_PRICING_REQUEST'
        });
      } catch (error) {
        ErrorLogger.logError_('EmailService.sendVendorPricingRequestEmail', error, { request: request });
        return { success: false, message: 'Failed to send vendor pricing request email.' };
      }
    };
  }
};

MIDTSEmailProductionCopyPatch.apply();
