/**
 * MIDTS Automation Engine
 * STAGE: 7 (Lightweight payment tracking)
 * WHAT THIS FILE DOES:
 * - Creates append-only payment records for projects and quotes.
 * - Tracks Deposit and Final payment types separately.
 * - Updates project payment status fields for lightweight operational visibility.
 * - Provides a delivery/work-release gate that allows release only after Deposit is Received.
 * DEPENDENCIES:
 * - Google Sheets tab: Payments
 * - Google Sheets tab: Projects
 * - Google Sheets tab: Quotes
 * - DatabaseService (DatabaseService.gs)
 * - QuoteService (QuoteService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var PaymentService = {
  // ===== CONFIG =====
  // Uses Google Sheet tab: Payments
  PAYMENTS_SHEET_NAME: 'Payments',

  PAYMENT_TYPE_DEPOSIT: 'Deposit',
  PAYMENT_TYPE_FINAL: 'Final',

  PAYMENT_STATUS_REQUESTED: 'Requested',
  PAYMENT_STATUS_RECEIVED: 'Received',
  PAYMENT_STATUS_FAILED: 'Failed',
  PAYMENT_STATUS_REFUNDED: 'Refunded',

  WORK_RELEASE_BLOCKED: 'Blocked - Deposit Required',
  WORK_RELEASE_ALLOWED: 'Allowed - Deposit Received',

  /**
   * FUNCTION: ensurePaymentsSheetStructure
   * PURPOSE: Ensure Payments sheet exists with fixed headers for lightweight payment tracking.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Creates Payments sheet if missing; appends missing headers only.
   */
  ensurePaymentsSheetStructure: function () {
    // ===== MAIN LOGIC =====
    try {
      // No card details or payment processor secrets are stored in this lightweight tracker.
      var requiredHeaders = [
        'Payment ID',
        'Created At',
        'Project ID',
        'Quote ID',
        'Lead ID',
        'Vendor ID',
        'Payment Type',
        'Payment Status',
        'Amount',
        'Currency',
        'Payment Reference',
        'Status Updated At',
        'Notes'
      ];
      return DatabaseService.ensureSheetAndHeaders_(this.PAYMENTS_SHEET_NAME, requiredHeaders);
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.ensurePaymentsSheetStructure', error);
      return { success: false, message: 'Failed to verify Payments sheet structure.' };
    }
  },

  /**
   * FUNCTION: createPaymentRecord
   * PURPOSE: Create one Deposit or Final payment tracking row and update project payment status.
   * INPUT: payload (object: projectId, quoteId, amount, paymentType, paymentStatus, paymentReference, currency, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Payments row and updates one Projects row payment summary.
   */
  createPaymentRecord: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var validation = this.validatePaymentInput_(payload);
      if (!validation.success) {
        return validation;
      }
      var request = validation.data.request;

      var setupResult = this.ensurePaymentWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var projectResult = this.getProjectSnapshot_(request.projectId);
      if (!projectResult.success) {
        return projectResult;
      }
      var project = projectResult.data.project;

      if (project.quoteId !== request.quoteId) {
        return this.fail_('PaymentService.createPaymentRecord', 'Quote ID does not match the project quote.', {
          projectId: request.projectId,
          requestedQuoteId: request.quoteId,
          projectQuoteId: project.quoteId
        });
      }

      var quoteResult = QuoteService.getQuoteSnapshot(request.quoteId);
      if (!quoteResult.success) {
        return quoteResult;
      }
      var quote = quoteResult.data;
      if (quote.leadId !== project.leadId) {
        return this.fail_('PaymentService.createPaymentRecord', 'Quote Lead ID does not match the project Lead ID.', {
          projectId: request.projectId,
          quoteId: request.quoteId,
          quoteLeadId: quote.leadId,
          projectLeadId: project.leadId
        });
      }

      var paymentId = UtilsService.createSequentialId_('PAYMENT');
      var appendResult = this.appendPaymentRow_({
        paymentId: paymentId,
        projectId: request.projectId,
        quoteId: request.quoteId,
        leadId: project.leadId,
        vendorId: project.vendorId,
        paymentType: request.paymentType,
        paymentStatus: request.paymentStatus,
        amount: request.amount,
        currency: request.currency || quote.currency || 'GBP',
        paymentReference: request.paymentReference,
        notes: request.notes
      });
      if (!appendResult.success) {
        return appendResult;
      }

      var projectPaymentUpdate = this.updateProjectPaymentStatus_(request.projectId);
      if (!projectPaymentUpdate.success) {
        return projectPaymentUpdate;
      }

      var releaseGate = this.canReleaseWork(request.projectId);

      return {
        success: true,
        message: 'Payment record created successfully.',
        data: {
          paymentId: paymentId,
          projectId: request.projectId,
          quoteId: request.quoteId,
          leadId: project.leadId,
          vendorId: project.vendorId,
          paymentType: request.paymentType,
          paymentStatus: request.paymentStatus,
          amount: request.amount,
          currency: request.currency || quote.currency || 'GBP',
          paymentReference: request.paymentReference,
          projectPaymentUpdate: projectPaymentUpdate,
          workReleaseGate: releaseGate,
          rowNumber: appendResult.data.rowNumber
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.createPaymentRecord', error, { payload: payload });
      return { success: false, message: 'Failed to create payment record.' };
    }
  },

  /**
   * FUNCTION: createPaymentForQuote
   * PURPOSE: Backward-compatible helper to create a Requested Deposit payment for an existing project/quote.
   * INPUT: payload (object: projectId, quoteId, amountDue, currency, paymentMethod, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Payments row and updates project payment status.
   */
  createPaymentForQuote: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      return this.createPaymentRecord({
        projectId: input.projectId,
        quoteId: input.quoteId,
        amount: input.amount !== undefined ? input.amount : input.amountDue,
        paymentType: input.paymentType || this.PAYMENT_TYPE_DEPOSIT,
        paymentStatus: input.paymentStatus || this.PAYMENT_STATUS_REQUESTED,
        paymentReference: input.paymentReference || input.paymentMethod || 'Manual',
        currency: input.currency || 'GBP',
        notes: input.notes || ''
      });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.createPaymentForQuote', error, { payload: payload });
      return { success: false, message: 'Failed to create payment for quote.' };
    }
  },

  /**
   * FUNCTION: updatePaymentStatus
   * PURPOSE: Update one payment row status and refresh linked project payment summary.
   * INPUT: paymentId (string), paymentStatus (string), paymentReference (string, optional), notes (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Payments row and one Projects payment summary.
   */
  updatePaymentStatus: function (paymentId, paymentStatus, paymentReference, notes) {
    // ===== MAIN LOGIC =====
    try {
      var id = String(paymentId || '').trim();
      var statusResult = this.normalizePaymentStatus_(paymentStatus);
      if (!id) {
        return this.fail_('PaymentService.updatePaymentStatus', 'paymentId is required.', { paymentId: paymentId, paymentStatus: paymentStatus });
      }
      if (!statusResult.success) {
        return statusResult;
      }

      var setupResult = this.ensurePaymentWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.PAYMENTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('PaymentService.updatePaymentStatus', 'Payments sheet not found.', { paymentId: id });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Payment ID'] - 1] || '').trim() === id) {
          var projectId = String(values[i][columns['Project ID'] - 1] || '').trim();
          var quoteId = String(values[i][columns['Quote ID'] - 1] || '').trim();
          var previousStatus = String(values[i][columns['Payment Status'] - 1] || '').trim();

          sheet.getRange(i + 1, columns['Payment Status']).setValue(statusResult.data.paymentStatus);
          this.setSheetValue_(sheet, i + 1, columns, 'Status Updated At', new Date());
          if (paymentReference !== undefined && paymentReference !== null && String(paymentReference).trim()) {
            this.setSheetValue_(sheet, i + 1, columns, 'Payment Reference', String(paymentReference).trim());
          }
          if (notes !== undefined && notes !== null && String(notes).trim()) {
            this.setSheetValue_(sheet, i + 1, columns, 'Notes', String(notes).trim());
          }

          var projectPaymentUpdate = this.updateProjectPaymentStatus_(projectId);
          if (!projectPaymentUpdate.success) {
            return projectPaymentUpdate;
          }

          return {
            success: true,
            message: 'Payment status updated successfully.',
            data: {
              paymentId: id,
              projectId: projectId,
              quoteId: quoteId,
              previousStatus: previousStatus,
              paymentStatus: statusResult.data.paymentStatus,
              projectPaymentUpdate: projectPaymentUpdate,
              workReleaseGate: this.canReleaseWork(projectId)
            }
          };
        }
      }

      return this.fail_('PaymentService.updatePaymentStatus', 'Payment not found for provided paymentId.', { paymentId: id });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.updatePaymentStatus', error, { paymentId: paymentId, paymentStatus: paymentStatus });
      return { success: false, message: 'Failed to update payment status.' };
    }
  },

  /**
   * FUNCTION: markPaymentPaid
   * PURPOSE: Backward-compatible helper to mark a payment Received.
   * INPUT: paymentId (string), amountPaid (number, optional), paymentMethod (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates payment status to Received and refreshes project payment summary.
   */
  markPaymentPaid: function (paymentId, amountPaid, paymentMethod) {
    // ===== MAIN LOGIC =====
    try {
      return this.updatePaymentStatus(paymentId, this.PAYMENT_STATUS_RECEIVED, paymentMethod || 'Manual', 'Amount paid: ' + String(amountPaid || ''));
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.markPaymentPaid', error, { paymentId: paymentId, amountPaid: amountPaid });
      return { success: false, message: 'Failed to mark payment as received.' };
    }
  },

  /**
   * FUNCTION: canReleaseWork
   * PURPOSE: Block delivery/work release unless the project has a Received Deposit payment.
   * INPUT: projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  canReleaseWork: function (projectId) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      if (!targetProjectId) {
        return this.fail_('PaymentService.canReleaseWork', 'projectId is required.', { projectId: projectId });
      }

      var setupResult = this.ensurePaymentWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var summary = this.getProjectPaymentSummary_(targetProjectId);
      if (!summary.success) {
        return summary;
      }

      var allowed = summary.data.depositStatus === this.PAYMENT_STATUS_RECEIVED;
      return {
        success: true,
        message: allowed ? 'Work release allowed because deposit is Received.' : 'Work release blocked until deposit is Received.',
        data: {
          projectId: targetProjectId,
          canReleaseWork: allowed,
          workReleaseStatus: allowed ? this.WORK_RELEASE_ALLOWED : this.WORK_RELEASE_BLOCKED,
          depositStatus: summary.data.depositStatus,
          finalPaymentStatus: summary.data.finalPaymentStatus
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.canReleaseWork', error, { projectId: projectId });
      return { success: false, message: 'Failed to evaluate work release gate.' };
    }
  },

  /**
   * FUNCTION: ensurePaymentWorkflowStructure_
   * PURPOSE: Ensure Payments and Projects sheet structures support payment tracking.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create sheets and append missing headers only.
   */
  ensurePaymentWorkflowStructure_: function () {
    // ===== MAIN LOGIC =====
    try {
      var paymentsResult = this.ensurePaymentsSheetStructure();
      if (!paymentsResult.success) {
        return paymentsResult;
      }
      var projectsResult = DatabaseService.ensureProjectsSheetStructure();
      if (!projectsResult.success) {
        return projectsResult;
      }
      var quotesResult = DatabaseService.ensureQuotesSheetStructure();
      if (!quotesResult.success) {
        return quotesResult;
      }
      return { success: true, message: 'Payment workflow sheet structure verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.ensurePaymentWorkflowStructure_', error);
      return { success: false, message: 'Failed to verify payment workflow structure.' };
    }
  },

  /**
   * FUNCTION: validatePaymentInput_
   * PURPOSE: Validate and normalize lightweight payment tracking input.
   * INPUT: payload (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs validation failures to Error Logs.
   */
  validatePaymentInput_: function (payload) {
    // ===== MAIN LOGIC =====
    try {
      var input = payload || {};
      var projectId = String(input.projectId || '').trim();
      var quoteId = String(input.quoteId || '').trim();
      var amount = Number(input.amount);
      var paymentType = this.normalizePaymentType_(input.paymentType);
      var paymentStatus = this.normalizePaymentStatus_(input.paymentStatus);
      var currency = String(input.currency || 'GBP').trim();

      if (!projectId) {
        return this.fail_('PaymentService.validatePaymentInput_', 'projectId is required.', { payload: payload });
      }
      if (!quoteId) {
        return this.fail_('PaymentService.validatePaymentInput_', 'quoteId is required.', { projectId: projectId, payload: payload });
      }
      if (!isFinite(amount) || amount <= 0) {
        return this.fail_('PaymentService.validatePaymentInput_', 'amount must be greater than zero.', { projectId: projectId, quoteId: quoteId, amount: input.amount });
      }
      if (!paymentType.success) {
        return paymentType;
      }
      if (!paymentStatus.success) {
        return paymentStatus;
      }
      if (!currency) {
        return this.fail_('PaymentService.validatePaymentInput_', 'currency is required.', { projectId: projectId, quoteId: quoteId });
      }

      return {
        success: true,
        message: 'Payment input validated successfully.',
        data: {
          request: {
            projectId: projectId,
            quoteId: quoteId,
            amount: this.roundMoney_(amount),
            paymentType: paymentType.data.paymentType,
            paymentStatus: paymentStatus.data.paymentStatus,
            paymentReference: String(input.paymentReference || '').trim(),
            currency: currency,
            notes: String(input.notes || '').trim()
          }
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.validatePaymentInput_', error, { payload: payload });
      return { success: false, message: 'Failed to validate payment input.' };
    }
  },

  /**
   * FUNCTION: appendPaymentRow_
   * PURPOSE: Append one payment row without overwriting existing payment records.
   * INPUT: payment (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Payments row.
   */
  appendPaymentRow_: function (payment) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.PAYMENTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('PaymentService.appendPaymentRow_', 'Payments sheet not found.', { payment: payment });
      }

      var columns = this.getHeaderMap_(sheet);
      var row = new Array(sheet.getLastColumn()).fill('');
      this.setField_(row, columns, 'Payment ID', payment.paymentId);
      this.setField_(row, columns, 'Created At', new Date());
      this.setField_(row, columns, 'Project ID', payment.projectId);
      this.setField_(row, columns, 'Quote ID', payment.quoteId);
      this.setField_(row, columns, 'Lead ID', payment.leadId);
      this.setField_(row, columns, 'Vendor ID', payment.vendorId);
      this.setField_(row, columns, 'Payment Type', payment.paymentType);
      this.setField_(row, columns, 'Payment Status', payment.paymentStatus);
      this.setField_(row, columns, 'Amount', payment.amount);
      this.setField_(row, columns, 'Currency', payment.currency);
      this.setField_(row, columns, 'Payment Reference', payment.paymentReference);
      this.setField_(row, columns, 'Status Updated At', new Date());
      this.setField_(row, columns, 'Notes', payment.notes);

      sheet.appendRow(row);
      return { success: true, message: 'Payment row appended successfully.', data: { paymentId: payment.paymentId, rowNumber: sheet.getLastRow() } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.appendPaymentRow_', error, { payment: payment });
      return { success: false, message: 'Failed to append payment row.' };
    }
  },

  /**
   * FUNCTION: updateProjectPaymentStatus_
   * PURPOSE: Persist aggregate Deposit/Final payment statuses and work release status on the Projects row.
   * INPUT: projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Projects row.
   */
  updateProjectPaymentStatus_: function (projectId) {
    // ===== MAIN LOGIC =====
    try {
      var summary = this.getProjectPaymentSummary_(projectId);
      if (!summary.success) {
        return summary;
      }

      var projectResult = this.getProjectSnapshot_(projectId);
      if (!projectResult.success) {
        return projectResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('PaymentService.updateProjectPaymentStatus_', 'Projects sheet not found.', { projectId: projectId });
      }

      var columns = this.getHeaderMap_(sheet);
      var rowNumber = projectResult.data.project.rowNumber;
      var paymentStatus = this.buildProjectPaymentStatus_(summary.data.depositStatus, summary.data.finalPaymentStatus);
      var workReleaseStatus = summary.data.depositStatus === this.PAYMENT_STATUS_RECEIVED ? this.WORK_RELEASE_ALLOWED : this.WORK_RELEASE_BLOCKED;

      this.setSheetValue_(sheet, rowNumber, columns, 'Deposit Payment Status', summary.data.depositStatus);
      this.setSheetValue_(sheet, rowNumber, columns, 'Final Payment Status', summary.data.finalPaymentStatus);
      this.setSheetValue_(sheet, rowNumber, columns, 'Payment Status', paymentStatus);
      this.setSheetValue_(sheet, rowNumber, columns, 'Payment Status Reference', paymentStatus);
      this.setSheetValue_(sheet, rowNumber, columns, 'Work Release Status', workReleaseStatus);
      this.setSheetValue_(sheet, rowNumber, columns, 'Payment Updated At', new Date());

      return {
        success: true,
        message: 'Project payment status updated successfully.',
        data: {
          projectId: projectId,
          depositStatus: summary.data.depositStatus,
          finalPaymentStatus: summary.data.finalPaymentStatus,
          paymentStatus: paymentStatus,
          workReleaseStatus: workReleaseStatus
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.updateProjectPaymentStatus_', error, { projectId: projectId });
      return { success: false, message: 'Failed to update project payment status.' };
    }
  },

  /**
   * FUNCTION: getProjectPaymentSummary_
   * PURPOSE: Aggregate latest payment state for Deposit and Final payments on one project.
   * INPUT: projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getProjectPaymentSummary_: function (projectId) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      if (!targetProjectId) {
        return this.fail_('PaymentService.getProjectPaymentSummary_', 'projectId is required.', { projectId: projectId });
      }

      var paymentsResult = this.ensurePaymentsSheetStructure();
      if (!paymentsResult.success) {
        return paymentsResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.PAYMENTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('PaymentService.getProjectPaymentSummary_', 'Payments sheet not found.', { projectId: targetProjectId });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      var depositStatus = '';
      var finalPaymentStatus = '';
      var depositPaymentId = '';
      var finalPaymentId = '';

      for (var i = 1; i < values.length; i++) {
        var rowProjectId = String(values[i][columns['Project ID'] - 1] || '').trim();
        if (rowProjectId !== targetProjectId) {
          continue;
        }
        var rowType = String(values[i][columns['Payment Type'] - 1] || '').trim();
        var rowStatus = String(values[i][columns['Payment Status'] - 1] || '').trim();
        var rowPaymentId = String(values[i][columns['Payment ID'] - 1] || '').trim();

        if (rowType === this.PAYMENT_TYPE_DEPOSIT) {
          // Received is the only status that opens the delivery gate; keep it sticky for safety.
          if (rowStatus === this.PAYMENT_STATUS_RECEIVED || depositStatus !== this.PAYMENT_STATUS_RECEIVED) {
            depositStatus = rowStatus;
            depositPaymentId = rowPaymentId;
          }
        }
        if (rowType === this.PAYMENT_TYPE_FINAL) {
          if (rowStatus === this.PAYMENT_STATUS_RECEIVED || finalPaymentStatus !== this.PAYMENT_STATUS_RECEIVED) {
            finalPaymentStatus = rowStatus;
            finalPaymentId = rowPaymentId;
          }
        }
      }

      return {
        success: true,
        message: 'Project payment summary loaded.',
        data: {
          projectId: targetProjectId,
          depositStatus: depositStatus || 'Not Requested',
          finalPaymentStatus: finalPaymentStatus || 'Not Requested',
          depositPaymentId: depositPaymentId,
          finalPaymentId: finalPaymentId
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.getProjectPaymentSummary_', error, { projectId: projectId });
      return { success: false, message: 'Failed to load project payment summary.' };
    }
  },

  /**
   * FUNCTION: getProjectSnapshot_
   * PURPOSE: Read one project row needed to link project, quote, lead, and vendor.
   * INPUT: projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  getProjectSnapshot_: function (projectId) {
    // ===== MAIN LOGIC =====
    try {
      var targetProjectId = String(projectId || '').trim();
      if (!targetProjectId) {
        return this.fail_('PaymentService.getProjectSnapshot_', 'projectId is required.', { projectId: projectId });
      }

      var projectsResult = DatabaseService.ensureProjectsSheetStructure();
      if (!projectsResult.success) {
        return projectsResult;
      }

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('PaymentService.getProjectSnapshot_', 'Projects sheet not found.', { projectId: targetProjectId });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Project ID'] - 1] || '').trim() === targetProjectId) {
          return {
            success: true,
            message: 'Project snapshot loaded for payment tracking.',
            data: {
              project: {
                projectId: targetProjectId,
                leadId: String(values[i][columns['Lead ID'] - 1] || '').trim(),
                vendorId: String(values[i][columns['Vendor ID'] - 1] || '').trim(),
                quoteId: String(values[i][columns['Quote ID'] - 1] || '').trim(),
                projectStatus: String(values[i][columns['Project Status'] - 1] || '').trim(),
                rowNumber: i + 1
              }
            }
          };
        }
      }

      return this.fail_('PaymentService.getProjectSnapshot_', 'Project not found for provided projectId.', { projectId: targetProjectId });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PaymentService.getProjectSnapshot_', error, { projectId: projectId });
      return { success: false, message: 'Failed to load project snapshot for payment tracking.' };
    }
  },

  /**
   * FUNCTION: normalizePaymentType_
   * PURPOSE: Allow only Deposit or Final payment types.
   * INPUT: paymentType (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs invalid payment types to Error Logs.
   */
  normalizePaymentType_: function (paymentType) {
    // ===== MAIN LOGIC =====
    var type = String(paymentType || '').trim();
    if (type !== this.PAYMENT_TYPE_DEPOSIT && type !== this.PAYMENT_TYPE_FINAL) {
      return this.fail_('PaymentService.normalizePaymentType_', 'paymentType must be Deposit or Final.', { paymentType: paymentType });
    }
    return { success: true, message: 'Payment type validated.', data: { paymentType: type } };
  },

  /**
   * FUNCTION: normalizePaymentStatus_
   * PURPOSE: Allow only supported lightweight payment statuses.
   * INPUT: paymentStatus (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs invalid payment statuses to Error Logs.
   */
  normalizePaymentStatus_: function (paymentStatus) {
    // ===== MAIN LOGIC =====
    var status = String(paymentStatus || '').trim();
    var allowed = [this.PAYMENT_STATUS_REQUESTED, this.PAYMENT_STATUS_RECEIVED, this.PAYMENT_STATUS_FAILED, this.PAYMENT_STATUS_REFUNDED];
    if (allowed.indexOf(status) === -1) {
      return this.fail_('PaymentService.normalizePaymentStatus_', 'paymentStatus must be Requested, Received, Failed, or Refunded.', { paymentStatus: paymentStatus, allowedStatuses: allowed });
    }
    return { success: true, message: 'Payment status validated.', data: { paymentStatus: status } };
  },

  /**
   * FUNCTION: buildProjectPaymentStatus_
   * PURPOSE: Build one lightweight payment summary value for Projects sheet display.
   * INPUT: depositStatus (string), finalPaymentStatus (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildProjectPaymentStatus_: function (depositStatus, finalPaymentStatus) {
    // ===== MAIN LOGIC =====
    if (finalPaymentStatus === this.PAYMENT_STATUS_RECEIVED) {
      return 'Final Received';
    }
    if (depositStatus === this.PAYMENT_STATUS_RECEIVED) {
      return 'Deposit Received';
    }
    if (depositStatus === this.PAYMENT_STATUS_REQUESTED || finalPaymentStatus === this.PAYMENT_STATUS_REQUESTED) {
      return 'Payment Requested';
    }
    if (depositStatus === this.PAYMENT_STATUS_FAILED || finalPaymentStatus === this.PAYMENT_STATUS_FAILED) {
      return 'Payment Failed';
    }
    if (depositStatus === this.PAYMENT_STATUS_REFUNDED || finalPaymentStatus === this.PAYMENT_STATUS_REFUNDED) {
      return 'Payment Refunded';
    }
    return 'Not Requested';
  },

  /**
   * FUNCTION: getHeaderMap_
   * PURPOSE: Resolve sheet headers into 1-based column numbers for schema-safe reads/writes.
   * INPUT: sheet (Google Sheet object)
   * OUTPUT: object
   * SIDE EFFECTS: none
   */
  getHeaderMap_: function (sheet) {
    // ===== MAIN LOGIC =====
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    headers.forEach(function (header, index) {
      var name = String(header || '').trim();
      if (name) {
        map[name] = index + 1;
      }
    });
    return map;
  },

  /**
   * FUNCTION: setField_
   * PURPOSE: Safely write a value into a row array by header name before append.
   * INPUT: row (array), columns (object), header (string), value (any)
   * OUTPUT: none
   * SIDE EFFECTS: Mutates row array before append.
   */
  setField_: function (row, columns, header, value) {
    // ===== MAIN LOGIC =====
    var column = columns[header] || 0;
    if (column) {
      row[column - 1] = value;
    }
  },

  /**
   * FUNCTION: setSheetValue_
   * PURPOSE: Safely update a sheet cell only when the target header exists.
   * INPUT: sheet, rowNumber, columns, header, value
   * OUTPUT: none
   * SIDE EFFECTS: Updates one sheet cell when the header exists.
   */
  setSheetValue_: function (sheet, rowNumber, columns, header, value) {
    // ===== MAIN LOGIC =====
    var column = columns[header] || 0;
    if (column) {
      sheet.getRange(rowNumber, column).setValue(value);
    }
  },

  /**
   * FUNCTION: roundMoney_
   * PURPOSE: Round monetary values to two decimals for payment storage.
   * INPUT: amount (number)
   * OUTPUT: number
   * SIDE EFFECTS: none
   */
  roundMoney_: function (amount) {
    // ===== MAIN LOGIC =====
    return Math.round(Number(amount || 0) * 100) / 100;
  },

  /**
   * FUNCTION: fail_
   * PURPOSE: Return a structured failure and log it to Error Logs for auditability.
   * INPUT: functionName (string), message (string), context (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Error Logs row.
   */
  fail_: function (functionName, message, context) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_(functionName, new Error(message), context || {});
    return { success: false, message: message, data: context || {} };
  }
};

/**
 * FUNCTION: runStage7PaymentTrackingSetupValidation
 * PURPOSE: Verify Payments and Project payment status headers without creating payment records.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create sheets and append missing headers only.
 */
function runStage7PaymentTrackingSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    return PaymentService.ensurePaymentWorkflowStructure_();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage7PaymentTrackingSetupValidation', error);
    return { success: false, message: 'Payment tracking setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage7PaymentTrackingDryRunTest
 * PURPOSE: Verify payment IDs, Deposit/Final separation, project payment status updates, and unpaid delivery gate blocking.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test Leads, Vendors, Quotes, Projects, Payments, Vendor Pricing, and Error Logs rows.
 */
function runStage7PaymentTrackingDryRunTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = PaymentService.ensurePaymentWorkflowStructure_();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage7 Payment Tracking Lead',
      email: 'stage7-payment-tracking@example.com',
      company: 'MIDTS Stage7 Payment Test',
      projectType: 'CAD/CAM',
      source: 'Stage7PaymentTrackingDryRun',
      notes: 'Dry-run lead for lightweight payment tracking.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 96);
    if (!qualify.success) {
      return qualify;
    }

    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    var vendorId = UtilsService.createSequentialId_('VENDOR');
    vendorSheet.appendRow([vendorId, 'Stage7 Payment Eligible Vendor', 'stage7-payment-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var assignment = VendorAssignmentService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var quote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      marginPercent: 25,
      currency: 'GBP',
      quoteStatus: 'Draft',
      sendEmail: false,
      notes: 'Payment tracking dry-run quote.'
    });
    if (!quote.success) {
      return quote;
    }

    var sent = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Sent');
    if (!sent.success) {
      return sent;
    }
    var accepted = QuoteService.updateQuoteStatus(quote.data.quoteId, 'Accepted');
    if (!accepted.success) {
      return accepted;
    }

    var project = ProjectService.createProjectFromQuote({
      quoteId: quote.data.quoteId,
      notes: 'Payment tracking dry-run project.',
      paymentStatusReference: 'Not Requested'
    });
    if (!project.success) {
      return project;
    }

    var blockedBeforeDeposit = PaymentService.canReleaseWork(project.data.projectId);

    var depositRequested = PaymentService.createPaymentRecord({
      projectId: project.data.projectId,
      quoteId: quote.data.quoteId,
      amount: 500,
      paymentType: 'Deposit',
      paymentStatus: 'Requested',
      paymentReference: 'DRY-RUN-DEPOSIT-REQUEST',
      currency: 'GBP',
      notes: 'Deposit requested for dry-run.'
    });
    if (!depositRequested.success) {
      return depositRequested;
    }

    var blockedAfterRequested = PaymentService.canReleaseWork(project.data.projectId);
    var depositReceived = PaymentService.updatePaymentStatus(depositRequested.data.paymentId, 'Received', 'DRY-RUN-DEPOSIT-RECEIVED', 'Deposit received for dry-run.');
    if (!depositReceived.success) {
      return depositReceived;
    }

    var allowedAfterDeposit = PaymentService.canReleaseWork(project.data.projectId);
    var finalPayment = PaymentService.createPaymentRecord({
      projectId: project.data.projectId,
      quoteId: quote.data.quoteId,
      amount: 750,
      paymentType: 'Final',
      paymentStatus: 'Requested',
      paymentReference: 'DRY-RUN-FINAL-REQUEST',
      currency: 'GBP',
      notes: 'Final payment requested for dry-run.'
    });
    if (!finalPayment.success) {
      return finalPayment;
    }

    var pass = blockedBeforeDeposit.success === true && blockedBeforeDeposit.data.canReleaseWork === false &&
      depositRequested.data.paymentId &&
      depositRequested.data.paymentType === 'Deposit' &&
      blockedAfterRequested.success === true && blockedAfterRequested.data.canReleaseWork === false &&
      depositReceived.data.paymentStatus === 'Received' &&
      allowedAfterDeposit.success === true && allowedAfterDeposit.data.canReleaseWork === true &&
      finalPayment.data.paymentId &&
      finalPayment.data.paymentType === 'Final' &&
      finalPayment.data.projectPaymentUpdate.data.depositStatus === 'Received';

    return {
      success: pass,
      message: pass ? 'Payment tracking dry-run test passed.' : 'Payment tracking dry-run test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        quote: quote,
        project: project,
        blockedBeforeDeposit: blockedBeforeDeposit,
        depositRequested: depositRequested,
        blockedAfterRequested: blockedAfterRequested,
        depositReceived: depositReceived,
        allowedAfterDeposit: allowedAfterDeposit,
        finalPayment: finalPayment
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage7PaymentTrackingDryRunTest', error);
    return { success: false, message: 'Payment tracking dry-run test failed unexpectedly.' };
  }
}
