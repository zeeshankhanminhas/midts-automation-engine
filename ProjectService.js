/**
 * MIDTS Automation Engine
 * STAGE: 6 (Project creation after quote acceptance)
 * WHAT THIS FILE DOES:
 * - Creates project records only after a customer quote has been accepted.
 * - Links Project, Quote, Lead, and Vendor records without starting delivery or payment workflows.
 * - Updates the lead status to Converted / Project Created for downstream visibility.
 * - Optionally creates a private project Drive folder through DriveService when explicitly requested.
 * DEPENDENCIES:
 * - Google Sheets tab: Projects
 * - Google Sheets tab: Leads
 * - Google Sheets tab: Quotes
 * - Google Drive root folder from Settings sheet: ROOT_DRIVE_FOLDER_ID when createDriveFolder is true
 * - QuoteService (QuoteService.gs)
 * - DriveService (DriveService.gs, optional for folder creation)
 * - DatabaseService (DatabaseService.gs)
 * - UtilsService (Utils.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var ProjectService = {
  // ===== CONFIG =====
  PROJECT_STATUS_CREATED: 'Project Created',
  LEAD_STATUS_CONVERTED: 'Converted',
  LEAD_NURTURE_PROJECT_CREATED: 'Project Created',

  /**
   * FUNCTION: createProjectFromQuote
   * PURPOSE: Create one project from an Accepted quote and prevent duplicate projects for the same quote.
   * INPUT: quoteIdOrPayload (string quoteId OR object: quoteId, notes, createDriveFolder, folderName, paymentStatusReference)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one Projects row; updates one Leads row; may create one Drive folder when requested.
   */
  createProjectFromQuote: function (quoteIdOrPayload) {
    // ===== MAIN LOGIC =====
    try {
      var input = this.normalizeProjectInput_(quoteIdOrPayload);
      if (!input.success) {
        return input;
      }
      var request = input.data.request;

      var setupResult = this.ensureProjectWorkflowStructure_();
      if (!setupResult.success) {
        return setupResult;
      }

      var quoteResult = QuoteService.getQuoteSnapshot(request.quoteId);
      if (!quoteResult.success) {
        return quoteResult;
      }
      var quote = quoteResult.data;

      // Project creation is gated strictly on customer quote acceptance.
      if (quote.quoteStatus !== 'Accepted') {
        return this.fail_('ProjectService.createProjectFromQuote', 'Quote must be Accepted before project creation.', {
          quoteId: request.quoteId,
          quoteStatus: quote.quoteStatus
        });
      }

      var leadId = String(quote.leadId || '').trim();
      var vendorId = String(quote.vendorId || request.vendorId || '').trim();
      if (!leadId || !vendorId) {
        return this.fail_('ProjectService.createProjectFromQuote', 'Accepted quote must include Lead ID and Vendor ID before project creation.', {
          quoteId: request.quoteId,
          leadId: leadId,
          vendorId: vendorId
        });
      }

      var duplicateCheck = this.findProjectByQuote_(request.quoteId);
      if (!duplicateCheck.success) {
        return duplicateCheck;
      }
      if (duplicateCheck.data.exists) {
        return this.fail_('ProjectService.createProjectFromQuote', 'Project already exists for this quote.', duplicateCheck.data);
      }

      var projectId = UtilsService.createSequentialId_('PROJECT');
      var appendResult = this.appendProjectRow_({
        projectId: projectId,
        leadId: leadId,
        vendorId: vendorId,
        quoteId: request.quoteId,
        projectStatus: this.PROJECT_STATUS_CREATED,
        notes: request.notes,
        paymentStatusReference: request.paymentStatusReference,
        createdFrom: 'Accepted Quote'
      });
      if (!appendResult.success) {
        return appendResult;
      }

      var leadUpdate = this.updateLeadProjectStatus_(leadId, projectId);
      if (!leadUpdate.success) {
        return leadUpdate;
      }

      var driveFolder = null;
      if (request.createDriveFolder) {
        driveFolder = this.createProjectDriveFolder_(projectId, request.folderName);
        if (!driveFolder.success) {
          return this.fail_('ProjectService.createProjectFromQuote', 'Project row was created, but Drive folder creation failed.', {
            projectId: projectId,
            quoteId: request.quoteId,
            driveFolder: driveFolder
          });
        }
      }

      return {
        success: true,
        message: 'Project created successfully from accepted quote.',
        data: {
          projectId: projectId,
          quoteId: request.quoteId,
          leadId: leadId,
          vendorId: vendorId,
          projectStatus: this.PROJECT_STATUS_CREATED,
          paymentStatusReference: request.paymentStatusReference,
          driveFolder: driveFolder,
          leadUpdate: leadUpdate,
          rowNumber: appendResult.data.rowNumber
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.createProjectFromQuote', error, { quoteIdOrPayload: quoteIdOrPayload });
      return { success: false, message: 'Failed to create project from quote.' };
    }
  },

  /**
   * FUNCTION: normalizeProjectInput_
   * PURPOSE: Normalize string or object input into a project creation request.
   * INPUT: quoteIdOrPayload (string or object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Logs validation failures to Error Logs.
   */
  normalizeProjectInput_: function (quoteIdOrPayload) {
    // ===== MAIN LOGIC =====
    try {
      var payload = typeof quoteIdOrPayload === 'object' && quoteIdOrPayload !== null
        ? quoteIdOrPayload
        : { quoteId: quoteIdOrPayload };
      var quoteId = String(payload.quoteId || '').trim();
      if (!quoteId) {
        return this.fail_('ProjectService.normalizeProjectInput_', 'quoteId is required.', { input: quoteIdOrPayload });
      }

      return {
        success: true,
        message: 'Project input normalized.',
        data: {
          request: {
            quoteId: quoteId,
            vendorId: String(payload.vendorId || '').trim(),
            notes: String(payload.notes || '').trim(),
            createDriveFolder: payload.createDriveFolder === true,
            folderName: String(payload.folderName || '').trim(),
            // Payment status is reference-only here; payment workflow is not started by project creation.
            paymentStatusReference: String(payload.paymentStatusReference || payload.paymentStatus || '').trim()
          }
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.normalizeProjectInput_', error, { input: quoteIdOrPayload });
      return { success: false, message: 'Failed to normalize project creation input.' };
    }
  },

  /**
   * FUNCTION: ensureProjectWorkflowStructure_
   * PURPOSE: Ensure sheets and headers required for project creation exist.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create sheets and append missing headers only.
   */
  ensureProjectWorkflowStructure_: function () {
    // ===== MAIN LOGIC =====
    try {
      var projectsResult = DatabaseService.ensureProjectsSheetStructure();
      if (!projectsResult.success) {
        return projectsResult;
      }
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }
      var quotesResult = DatabaseService.ensureQuotesSheetStructure();
      if (!quotesResult.success) {
        return quotesResult;
      }
      return { success: true, message: 'Project workflow sheet structure verified.' };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.ensureProjectWorkflowStructure_', error);
      return { success: false, message: 'Failed to verify project workflow structure.' };
    }
  },

  /**
   * FUNCTION: appendProjectRow_
   * PURPOSE: Append one project row using current Projects headers without overwriting existing project records.
   * INPUT: project (object)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one row to Projects sheet.
   */
  appendProjectRow_: function (project) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('ProjectService.appendProjectRow_', 'Projects sheet not found.', { project: project });
      }

      var columns = this.getHeaderMap_(sheet);
      var row = new Array(sheet.getLastColumn()).fill('');
      this.setField_(row, columns, 'Project ID', project.projectId);
      this.setField_(row, columns, 'Lead ID', project.leadId);
      this.setField_(row, columns, 'Vendor ID', project.vendorId);
      this.setField_(row, columns, 'Quote ID', project.quoteId);
      this.setField_(row, columns, 'Created At', new Date());
      this.setField_(row, columns, 'Project Status', project.projectStatus);
      this.setField_(row, columns, 'Notes', project.notes);
      this.setField_(row, columns, 'Payment Status Reference', project.paymentStatusReference);
      this.setField_(row, columns, 'Created From', project.createdFrom);

      sheet.appendRow(row);
      return {
        success: true,
        message: 'Project row appended successfully.',
        data: { projectId: project.projectId, rowNumber: sheet.getLastRow() }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.appendProjectRow_', error, { project: project });
      return { success: false, message: 'Failed to append project row.' };
    }
  },

  /**
   * FUNCTION: findProjectByQuote_
   * PURPOSE: Prevent duplicate project creation for the same accepted quote.
   * INPUT: quoteId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  findProjectByQuote_: function (quoteId) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.PROJECTS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('ProjectService.findProjectByQuote_', 'Projects sheet not found.', { quoteId: quoteId });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Quote ID'] - 1] || '').trim() === String(quoteId || '').trim()) {
          return {
            success: true,
            message: 'Existing project found for quote.',
            data: {
              exists: true,
              projectId: String(values[i][columns['Project ID'] - 1] || '').trim(),
              quoteId: quoteId,
              leadId: String(values[i][columns['Lead ID'] - 1] || '').trim(),
              vendorId: String(values[i][columns['Vendor ID'] - 1] || '').trim(),
              projectStatus: String(values[i][columns['Project Status'] - 1] || '').trim(),
              rowNumber: i + 1
            }
          };
        }
      }

      return { success: true, message: 'No project exists for quote.', data: { exists: false, quoteId: quoteId } };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.findProjectByQuote_', error, { quoteId: quoteId });
      return { success: false, message: 'Failed to check duplicate project creation.' };
    }
  },

  /**
   * FUNCTION: updateLeadProjectStatus_
   * PURPOSE: Mark lead as Converted and Project Created after project row creation.
   * INPUT: leadId (string), projectId (string)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Updates one Leads row.
   */
  updateLeadProjectStatus_: function (leadId, projectId) {
    // ===== MAIN LOGIC =====
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return this.fail_('ProjectService.updateLeadProjectStatus_', 'Leads sheet not found.', { leadId: leadId, projectId: projectId });
      }

      var columns = this.getHeaderMap_(sheet);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][columns['Lead ID'] - 1] || '').trim() === String(leadId || '').trim()) {
          this.setSheetValue_(sheet, i + 1, columns, 'Status', this.LEAD_STATUS_CONVERTED);
          this.setSheetValue_(sheet, i + 1, columns, 'Nurture State', this.LEAD_NURTURE_PROJECT_CREATED);
          this.setSheetValue_(sheet, i + 1, columns, 'Project ID', projectId);
          this.setSheetValue_(sheet, i + 1, columns, 'Project Created At', new Date());

          return {
            success: true,
            message: 'Lead marked as Converted / Project Created.',
            data: {
              leadId: leadId,
              projectId: projectId,
              status: this.LEAD_STATUS_CONVERTED,
              nurtureState: this.LEAD_NURTURE_PROJECT_CREATED
            }
          };
        }
      }

      return this.fail_('ProjectService.updateLeadProjectStatus_', 'Lead not found for provided leadId.', { leadId: leadId, projectId: projectId });
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.updateLeadProjectStatus_', error, { leadId: leadId, projectId: projectId });
      return { success: false, message: 'Failed to update lead project status.' };
    }
  },

  /**
   * FUNCTION: createProjectDriveFolder_
   * PURPOSE: Optionally create a private Drive folder through DriveService after project row creation.
   * INPUT: projectId (string), folderName (string, optional)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create one private Google Drive folder and update Projects Drive Folder ID.
   */
  createProjectDriveFolder_: function (projectId, folderName) {
    // ===== MAIN LOGIC =====
    try {
      if (typeof DriveService === 'undefined' || !DriveService.createProjectFolder) {
        return this.fail_('ProjectService.createProjectDriveFolder_', 'DriveService is not available for project folder creation.', { projectId: projectId });
      }
      return DriveService.createProjectFolder(projectId, folderName || ('MIDTS Project ' + projectId));
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('ProjectService.createProjectDriveFolder_', error, { projectId: projectId, folderName: folderName });
      return { success: false, message: 'Failed to create optional project Drive folder.' };
    }
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
 * FUNCTION: runStage6ProjectCreationAfterQuoteAcceptanceSetupValidation
 * PURPOSE: Verify project creation sheets and headers without creating project records.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create sheets and append missing headers only.
 */
function runStage6ProjectCreationAfterQuoteAcceptanceSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    return ProjectService.ensureProjectWorkflowStructure_();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage6ProjectCreationAfterQuoteAcceptanceSetupValidation', error);
    return { success: false, message: 'Project creation setup validation failed unexpectedly.' };
  }
}

/**
 * FUNCTION: runStage6ProjectCreationAfterQuoteAcceptanceDryRunTest
 * PURPOSE: Verify Draft/Sent/Rejected quotes are blocked, Accepted quotes create one linked project, and duplicate creation is blocked.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends test Leads, Vendors, Vendor Pricing, Quotes, Projects, and Error Logs rows.
 */
function runStage6ProjectCreationAfterQuoteAcceptanceDryRunTest() {
  // ===== MAIN LOGIC =====
  try {
    var setup = ProjectService.ensureProjectWorkflowStructure_();
    if (!setup.success) {
      return setup;
    }

    var lead = LeadService.createLead({
      fullName: 'Stage6 Project Accepted Quote Lead',
      email: 'stage6-project-accepted@example.com',
      company: 'MIDTS Stage6 Project Test',
      projectType: 'CAD/CAM',
      source: 'Stage6ProjectCreationDryRun',
      notes: 'Dry-run lead for project creation after quote acceptance.'
    });
    if (!lead.success) {
      return lead;
    }

    var qualify = LeadService.markStep2Completed(lead.data.leadId, 94);
    if (!qualify.success) {
      return qualify;
    }

    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.VENDORS_SHEET_NAME);
    var vendorId = UtilsService.createSequentialId_('VENDOR');
    vendorSheet.appendRow([vendorId, 'Stage6 Project Eligible Vendor', 'stage6-project-vendor@example.com', 'Yes', 'Yes', 'Approved', '']);

    var assignment = VendorAssignmentService.assignVendorToLead(lead.data.leadId, vendorId, { sendEmail: false });
    if (!assignment.success) {
      return assignment;
    }

    var draftQuote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 1000,
      marginPercent: 20,
      currency: 'GBP',
      quoteStatus: 'Draft',
      sendEmail: false,
      notes: 'Draft quote should be blocked for project creation.'
    });
    if (!draftQuote.success) {
      return draftQuote;
    }

    var blockedDraft = ProjectService.createProjectFromQuote(draftQuote.data.quoteId);
    var sentStatus = QuoteService.updateQuoteStatus(draftQuote.data.quoteId, 'Sent');
    if (!sentStatus.success) {
      return sentStatus;
    }
    var blockedSent = ProjectService.createProjectFromQuote(draftQuote.data.quoteId);
    var acceptedStatus = QuoteService.updateQuoteStatus(draftQuote.data.quoteId, 'Accepted');
    if (!acceptedStatus.success) {
      return acceptedStatus;
    }

    var project = ProjectService.createProjectFromQuote({
      quoteId: draftQuote.data.quoteId,
      notes: 'Project created only after quote acceptance.',
      createDriveFolder: false,
      paymentStatusReference: 'Not Started'
    });
    var duplicate = ProjectService.createProjectFromQuote(draftQuote.data.quoteId);

    var rejectedQuote = QuoteService.createQuoteForLead({
      leadId: lead.data.leadId,
      vendorId: vendorId,
      vendorCost: 500,
      marginPercent: 10,
      currency: 'GBP',
      quoteStatus: 'Draft',
      sendEmail: false,
      notes: 'Rejected quote should be blocked for project creation.'
    });
    if (!rejectedQuote.success) {
      return rejectedQuote;
    }
    var rejectedSent = QuoteService.updateQuoteStatus(rejectedQuote.data.quoteId, 'Sent');
    if (!rejectedSent.success) {
      return rejectedSent;
    }
    var rejectedStatus = QuoteService.updateQuoteStatus(rejectedQuote.data.quoteId, 'Rejected');
    if (!rejectedStatus.success) {
      return rejectedStatus;
    }
    var blockedRejected = ProjectService.createProjectFromQuote(rejectedQuote.data.quoteId);

    var pass = blockedDraft.success === false &&
      blockedSent.success === false &&
      blockedRejected.success === false &&
      project.success === true &&
      project.data.projectId &&
      project.data.quoteId === draftQuote.data.quoteId &&
      project.data.leadId === lead.data.leadId &&
      project.data.vendorId === vendorId &&
      duplicate.success === false;

    return {
      success: pass,
      message: pass ? 'Project creation after quote acceptance dry-run test passed.' : 'Project creation after quote acceptance dry-run test failed.',
      data: {
        setup: setup,
        lead: lead,
        qualification: qualify,
        vendorId: vendorId,
        assignment: assignment,
        quote: draftQuote,
        blockedDraft: blockedDraft,
        blockedSent: blockedSent,
        acceptedStatus: acceptedStatus,
        project: project,
        duplicate: duplicate,
        rejectedQuote: rejectedQuote,
        blockedRejected: blockedRejected
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage6ProjectCreationAfterQuoteAcceptanceDryRunTest', error);
    return { success: false, message: 'Project creation after quote acceptance dry-run test failed unexpectedly.' };
  }
}
