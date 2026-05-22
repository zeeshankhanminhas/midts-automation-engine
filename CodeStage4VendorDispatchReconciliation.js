/**
 * MIDTS Automation Engine
 * Stage 4.3 - Post-Step-2 vendor dispatch reconciliation
 *
 * Purpose:
 * - Finds qualified Step 2 leads that do not have an active Vendor Pricing request.
 * - Sends them through the existing controlled VendorAssignmentDispatcherService.
 * - Provides a manual recovery path when Step 2 intake succeeded but vendor dispatch did not run.
 *
 * Important:
 * - This file does not create a trigger.
 * - The live runner can send real vendor pricing emails.
 * - The dispatcher still enforces AUTO_VENDOR_ASSIGNMENT_ENABLED and duplicate pricing guards.
 */

var PostStep2VendorDispatchReconciliationService = {
  DEFAULT_LIMIT: 5,

  /**
   * FUNCTION: reconcile
   * PURPOSE: Scan qualified Step 2 leads and dispatch missing vendor pricing requests.
   * INPUT: options (object: dryRun, limit)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: May assign vendors, create Vendor Pricing rows, send vendor emails, and write dispatcher logs.
   */
  reconcile: function (options) {
    // ===== MAIN LOGIC =====
    try {
      var settings = options || {};
      var dryRun = settings.dryRun === true;
      var limit = Number(settings.limit || this.DEFAULT_LIMIT);
      if (!limit || limit < 1) {
        limit = this.DEFAULT_LIMIT;
      }

      var setup = VendorAssignmentDispatcherService.ensureVendorAssignmentSetup();
      if (!setup.success) {
        return setup;
      }

      var leadScan = this.findDispatchCandidates_(limit);
      if (!leadScan.success) {
        return leadScan;
      }

      var candidates = leadScan.data.candidates;
      var outcomes = [];
      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        if (dryRun) {
          outcomes.push({
            success: true,
            message: 'Dry run candidate identified. No dispatch attempted.',
            data: candidate
          });
          continue;
        }

        outcomes.push(VendorAssignmentDispatcherService.dispatchAfterStep2(candidate.leadId, {
          source: 'runPostStep2VendorDispatchReconciliation',
          sendEmail: true
        }));
      }

      var attemptedCount = dryRun ? 0 : outcomes.length;
      var successfulDispatchCount = outcomes.filter(function (item) {
        return item && item.success && item.data && item.data.vendorId && item.data.skipped !== true;
      }).length;
      var skippedCount = outcomes.filter(function (item) {
        return item && item.data && item.data.skipped === true;
      }).length;
      var failedCount = outcomes.filter(function (item) {
        return !item || item.success !== true;
      }).length;

      return {
        success: failedCount === 0,
        message: dryRun
          ? 'Post-Step-2 vendor dispatch reconciliation dry run completed.'
          : 'Post-Step-2 vendor dispatch reconciliation completed.',
        data: {
          dryRun: dryRun,
          scannedLeadCount: leadScan.data.scannedLeadCount,
          candidateCount: candidates.length,
          attemptedCount: attemptedCount,
          successfulDispatchCount: successfulDispatchCount,
          skippedCount: skippedCount,
          failedCount: failedCount,
          candidates: candidates,
          outcomes: outcomes
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PostStep2VendorDispatchReconciliationService.reconcile', error, { options: options });
      return {
        success: false,
        message: 'Post-Step-2 vendor dispatch reconciliation failed unexpectedly.',
        data: { error: error.message, stack: error.stack }
      };
    }
  },

  /**
   * FUNCTION: findDispatchCandidates_
   * PURPOSE: Find qualified Step 2 leads that have no active Vendor Pricing request.
   * INPUT: limit (number)
   * OUTPUT: { success: boolean, message: string, data?: object }
   * SIDE EFFECTS: none
   */
  findDispatchCandidates_: function (limit) {
    // ===== MAIN LOGIC =====
    try {
      var leadsResult = DatabaseService.ensureLeadsSheetStructure();
      if (!leadsResult.success) {
        return leadsResult;
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.LEADS_SHEET_NAME);
      if (!sheet) {
        return { success: false, message: 'Leads sheet not found.' };
      }

      var values = sheet.getDataRange().getValues();
      var candidates = [];
      for (var i = values.length - 1; i >= 1 && candidates.length < limit; i--) {
        var row = values[i];
        var leadId = String(row[0] || '').trim();
        var status = String(row[6] || '').trim();
        var source = String(row[7] || '').trim();
        var step2CompletedAt = row[10];
        var qualificationStatus = String(row[11] || '').trim();
        var nurtureState = String(row[18] || '').trim();
        var isStep2Complete = step2CompletedAt instanceof Date || String(step2CompletedAt || '').trim() !== '';
        var isQualified = qualificationStatus === 'Qualified' || status === 'Qualified' || nurtureState === 'Qualified';

        if (!leadId || !isStep2Complete || !isQualified) {
          continue;
        }

        var activeRequest = VendorAssignmentDispatcherService.hasActivePricingRequestForLead_(leadId);
        if (!activeRequest.success) {
          return activeRequest;
        }
        if (activeRequest.data.hasActiveRequest) {
          continue;
        }

        candidates.push({
          leadId: leadId,
          rowNumber: i + 1,
          source: source,
          status: status,
          qualificationStatus: qualificationStatus,
          step2CompletedAt: step2CompletedAt,
          nurtureState: nurtureState
        });
      }

      return {
        success: true,
        message: 'Post-Step-2 vendor dispatch candidates loaded.',
        data: {
          scannedLeadCount: Math.max(values.length - 1, 0),
          candidateCount: candidates.length,
          candidates: candidates
        }
      };
    } catch (error) {
      // ===== ERROR HANDLING =====
      ErrorLogger.logError_('PostStep2VendorDispatchReconciliationService.findDispatchCandidates_', error);
      return { success: false, message: 'Failed to find post-Step-2 vendor dispatch candidates.' };
    }
  }
};

/**
 * FUNCTION: runPostStep2VendorDispatchReconciliationDryRun
 * PURPOSE: Identify qualified Step 2 leads missing vendor pricing requests without sending email.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none beyond setup/header verification.
 */
function runPostStep2VendorDispatchReconciliationDryRun() {
  return PostStep2VendorDispatchReconciliationService.reconcile({
    dryRun: true,
    limit: 5
  });
}

/**
 * FUNCTION: runPostStep2VendorDispatchReconciliation
 * PURPOSE: Dispatch up to five qualified Step 2 leads that are missing active vendor pricing requests.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May send real vendor pricing emails through the existing dispatcher.
 */
function runPostStep2VendorDispatchReconciliation() {
  return PostStep2VendorDispatchReconciliationService.reconcile({
    dryRun: false,
    limit: 5
  });
}
