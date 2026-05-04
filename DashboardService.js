/**
 * MIDTS Automation Engine
 * STAGE: 9 (HTML Service admin dashboard backend)
 * WHAT THIS FILE DOES:
 * - Provides read-only dashboard summaries for Apps Script HTML Service.
 * - Provides a safe manual lead creation wrapper for the dashboard form.
 * - Does not expose Settings, API keys, webhook URLs, or internal configuration values.
 * DEPENDENCIES:
 * - Google Sheets tabs: Leads, Quotes, Projects, Payments, Vendors, Drive Access Logs, Email Logs, Slack Logs
 * - LeadService (LeadService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

var DashboardService = {
  // ===== CONFIG =====
  MAX_RECENT_ROWS: 8,

  /**
   * FUNCTION: getDashboardData
   * PURPOSE: Return dashboard counts and recent operational rows without exposing secrets.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create missing sheet headers for existing stage-owned sheets.
   */
  getDashboardData: function () {
    // ===== MAIN LOGIC =====
    try {
      this.ensureDashboardReadableSheets_();

      var leads = this.getSheetObjects_(ConfigService.LEADS_SHEET_NAME);
      var quotes = this.getSheetObjects_(ConfigService.QUOTES_SHEET_NAME);
      var projects = this.getSheetObjects_(ConfigService.PROJECTS_SHEET_NAME);
      var vendors = this.getSheetObjects_(ConfigService.VENDORS_SHEET_NAME);
      var payments = this.getSheetObjects_(PaymentService.PAYMENTS_SHEET_NAME);
      var driveLogs = this.getSheetObjects_(DriveService.DRIVE_ACCESS_LOGS_SHEET_NAME);
      var emailLogs = this.getSheetObjects_(EmailService.EMAIL_LOGS_SHEET_NAME);
      var slackLogs = this.getSheetObjects_(SlackService.SLACK_LOGS_SHEET_NAME);

      return {
        success: true,
        message: 'Dashboard data loaded successfully.',
        data: {
          refreshedAt: new Date().toISOString(),
          metrics: {
            leadsTotal: leads.length,
            leadsQualified: this.countWhere_(leads, 'Qualification Status', 'Qualified'),
            quotesTotal: quotes.length,
            quotesAccepted: this.countWhere_(quotes, 'Quote Status', 'Accepted'),
            projectsOpen: this.countWhere_(projects, 'Project Status', 'Open'),
            vendorsApproved: this.countWhere_(vendors, 'Approved Status', 'Approved'),
            paymentsPending: this.countWhere_(payments, 'Payment Status', 'Pending') + this.countWhere_(payments, 'Payment Status', 'Part Paid'),
            paymentsPaid: this.countWhere_(payments, 'Payment Status', 'Paid')
          },
          recent: {
            leads: this.pickRecent_(leads, ['Lead ID', 'Created At', 'Full Name', 'Company', 'Project Type', 'Status', 'Qualification Status', 'Reminder Status']),
            quotes: this.pickRecent_(quotes, ['Quote ID', 'Lead ID', 'Created At', 'Quote Status', 'Amount', 'Currency']),
            projects: this.pickRecent_(projects, ['Project ID', 'Lead ID', 'Vendor ID', 'Quote ID', 'Project Status', 'Drive Folder ID']),
            payments: this.pickRecent_(payments, ['Payment ID', 'Quote ID', 'Lead ID', 'Payment Status', 'Amount Due', 'Amount Paid', 'Currency']),
            logs: {
              drive: this.pickRecent_(driveLogs, ['Timestamp', 'Action', 'Project ID', 'Vendor ID', 'Result']),
              email: this.pickRecent_(emailLogs, ['Timestamp', 'Recipient', 'Subject', 'Template Key', 'Result']),
              slack: this.pickRecent_(slackLogs, ['Timestamp', 'Alert Type', 'Result', 'HTTP Status'])
            }
          }
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DashboardService.getDashboardData', error);
      return { success: false, message: 'Failed to load dashboard data.' };
    }
  },

  /**
   * FUNCTION: createLeadFromDashboard
   * PURPOSE: Create one lead from the admin dashboard form using LeadService validation.
   * INPUT: input (object: fullName, email, company, projectType, source, notes)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: Appends one lead row to Leads sheet when validation passes.
   */
  createLeadFromDashboard: function (input) {
    // ===== MAIN LOGIC =====
    try {
      var payload = input || {};
      var result = LeadService.createLead({
        fullName: payload.fullName,
        email: payload.email,
        company: payload.company,
        projectType: payload.projectType,
        source: payload.source || 'Dashboard',
        notes: payload.notes || ''
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: 'Dashboard lead created successfully.',
        data: result.data
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('DashboardService.createLeadFromDashboard', error, { input: input });
      return { success: false, message: 'Failed to create dashboard lead.' };
    }
  },

  /**
   * FUNCTION: ensureDashboardReadableSheets_
   * PURPOSE: Internal helper to prepare sheet structures used by the dashboard.
   * INPUT: none
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May create missing tabs/headers only.
   */
  ensureDashboardReadableSheets_: function () {
    // ===== MAIN LOGIC =====
    DatabaseService.ensureLeadsSheetStructure();
    DatabaseService.ensureQuotesSheetStructure();
    DatabaseService.ensureProjectsSheetStructure();
    DatabaseService.ensureVendorsSheetStructure();
    PaymentService.ensurePaymentsSheetStructure();
    DriveService.ensureDriveAccessLogsSheetStructure();
    EmailService.ensureEmailLogsSheetStructure();
    SlackService.ensureSlackLogsSheetStructure();
    return { success: true, message: 'Dashboard readable sheets verified.' };
  },

  /**
   * FUNCTION: getSheetObjects_
   * PURPOSE: Internal helper to convert a sheet range into safe object rows.
   * INPUT: sheetName (string)
   * OUTPUT: object[]
   * SIDE EFFECTS: none
   */
  getSheetObjects_: function (sheetName) {
    // ===== MAIN LOGIC =====
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return [];
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return [];
    }

    var headers = values[0].map(function (header) {
      return String(header || '').trim();
    });

    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var row = {};
      var hasValue = false;
      for (var j = 0; j < headers.length; j++) {
        if (!headers[j]) {
          continue;
        }
        var value = values[i][j];
        if (value !== '' && value !== null && typeof value !== 'undefined') {
          hasValue = true;
        }
        row[headers[j]] = this.formatCellValue_(value);
      }
      if (hasValue) {
        rows.push(row);
      }
    }

    return rows;
  },

  /**
   * FUNCTION: pickRecent_
   * PURPOSE: Internal helper to select recent rows and specific display fields.
   * INPUT: rows (object[]), fields (string[])
   * OUTPUT: object[]
   * SIDE EFFECTS: none
   */
  pickRecent_: function (rows, fields) {
    // ===== MAIN LOGIC =====
    var start = Math.max(rows.length - this.MAX_RECENT_ROWS, 0);
    return rows.slice(start).reverse().map(function (row) {
      var picked = {};
      fields.forEach(function (field) {
        picked[field] = row[field] || '';
      });
      return picked;
    });
  },

  /**
   * FUNCTION: countWhere_
   * PURPOSE: Internal helper to count rows where a field exactly matches a value.
   * INPUT: rows (object[]), field (string), expectedValue (string)
   * OUTPUT: number
   * SIDE EFFECTS: none
   */
  countWhere_: function (rows, field, expectedValue) {
    // ===== MAIN LOGIC =====
    return rows.filter(function (row) {
      return String(row[field] || '').trim() === String(expectedValue).trim();
    }).length;
  },

  /**
   * FUNCTION: formatCellValue_
   * PURPOSE: Internal helper to serialize Date values safely for HTML Service.
   * INPUT: value (any)
   * OUTPUT: string|number|boolean
   * SIDE EFFECTS: none
   */
  formatCellValue_: function (value) {
    // ===== MAIN LOGIC =====
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return String(value || '');
  }
};
