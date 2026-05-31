var MIDTSEmailProductionCopyPatch = {
  apply: function () {
    if (typeof EmailService === 'undefined') return;

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

        var htmlContent = '<p>Hello ' + safeFullName + ',</p>' +
          '<p>Thank you for contacting MIDTS. We have received your request and created your reference: <strong>' + safeLeadReference + '</strong>.</p>' +
          '<p>To review the work properly, we now need the technical details for your requirement. Please complete Step 2 using the secure link below:</p>' +
          '<p><a href="' + safeStep2Url + '">Complete Step 2 technical requirements</a></p>' +
          '<p>Once Step 2 is submitted, our team will review the information and move the request into qualification and pricing.</p>' +
          '<p>Kind regards,<br>MIDTS</p>';

        var textContent = 'Hello ' + fullName + ', thank you for contacting MIDTS. We have received your request and created your reference: ' + leadId + '. To review the work properly, please complete Step 2 using this secure link: ' + step2Url + '. Once Step 2 is submitted, our team will review the information and move the request into qualification and pricing. Kind regards, MIDTS';

        return this.sendTransactionalEmail({
          toEmail: email,
          toName: fullName,
          subject: 'MIDTS request received - next step required',
          htmlContent: htmlContent,
          textContent: textContent,
          templateKey: 'LEAD_RECEIVED_STEP_2'
        });
      } catch (error) {
        ErrorLogger.logError_('EmailService.sendLeadReceivedEmail', error, { lead: lead });
        return { success: false, message: 'Failed to send lead received email.' };
      }
    };

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

        var htmlContent = '<p>Hello ' + safeFullName + ',</p>' +
          '<p>' + this.escapeHtml_(template.data.htmlIntro) + '</p>' +
          '<p><a href="' + safeStep2Url + '">Complete Step 2 technical requirements</a></p>' +
          '<p>Reference: <strong>' + safeLeadId + '</strong></p>' +
          '<p>' + this.escapeHtml_(template.data.htmlOutro) + '</p>' +
          '<p>Kind regards,<br>MIDTS</p>';

        var textContent = 'Hello ' + fullName + ', ' + template.data.textIntro + ' Complete Step 2 here: ' + step2Url + '. Reference: ' + leadId + '. ' + template.data.textOutro + ' Kind regards, MIDTS';

        return this.sendTransactionalEmail({
          toEmail: email,
          toName: fullName,
          subject: template.data.subject,
          htmlContent: htmlContent,
          textContent: textContent,
          templateKey: template.data.templateKey
        });
      } catch (error) {
        ErrorLogger.logError_('EmailService.sendStep2ReminderEmail', error, { lead: lead, reminderStage: reminderStage });
        return { success: false, message: 'Failed to send Step 2 reminder email.' };
      }
    };

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

        var htmlContent = '<p>Hello ' + this.escapeHtml_(vendorName) + ',</p>' +
          '<p>MIDTS has assigned a qualified request to you for pricing review.</p>' +
          '<p>Please review the summary below and submit your cost, estimated turnaround, assumptions, and any exclusions through the secure pricing form.</p>' +
          '<p><strong>Lead reference:</strong> ' + this.escapeHtml_(leadId) + '</p>' +
          '<p><strong>Company:</strong> ' + this.escapeHtml_(company) + '</p>' +
          '<p><strong>Project type:</strong> ' + this.escapeHtml_(projectType) + '</p>' +
          '<p><strong>Qualification status:</strong> ' + this.escapeHtml_(qualificationStatus) + '</p>' +
          '<p><strong>Project details:</strong><br>' + this.escapeHtml_(notes).replace(/\n/g, '<br>') + '</p>' +
          '<p><a href="' + safePricingUrl + '">Submit vendor pricing</a></p>' +
          '<p>This link is assigned to your vendor profile. Please do not forward it.</p>' +
          '<p>Kind regards,<br>MIDTS</p>';

        var textContent = 'Hello ' + vendorName + ', MIDTS has assigned a qualified request to you for pricing review. Please review the summary and submit your cost, estimated turnaround, assumptions, and any exclusions through the secure pricing form. Lead reference: ' + leadId + '. Company: ' + company + '. Project type: ' + projectType + '. Qualification status: ' + qualificationStatus + '. Project details: ' + notes + '. Submit vendor pricing here: ' + pricingUrl + '. This link is assigned to your vendor profile. Please do not forward it. Kind regards, MIDTS';

        return this.sendTransactionalEmail({
          toEmail: vendorEmail,
          toName: vendorName,
          subject: 'MIDTS pricing request - ' + leadId,
          htmlContent: htmlContent,
          textContent: textContent,
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
