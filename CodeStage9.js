/**
 * MIDTS Automation Engine
 * STAGE: 9 (HTML Service dashboard entry points)
 * WHAT THIS FILE DOES:
 * - Exposes the Apps Script web app entry point.
 * - Provides dashboard setup validation for Stage 9 testing.
 * DEPENDENCIES:
 * - Apps Script HTML Service
 * - DashboardService (DashboardService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 */

/**
 * FUNCTION: doGet
 * PURPOSE: Render the MIDTS admin dashboard as an Apps Script HTML Service web app.
 * INPUT: e (Apps Script event object)
 * OUTPUT: HtmlOutput
 * SIDE EFFECTS: none
 */
function doGet(e) {
  // ===== MAIN LOGIC =====
  try {
    var template = HtmlService.createTemplateFromFile('Index');
    return template.evaluate()
      .setTitle('MIDTS Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('doGet', error, { event: e });
    return HtmlService.createHtmlOutput('MIDTS dashboard failed to load.');
  }
}

/**
 * FUNCTION: include
 * PURPOSE: Include HTML partial files in the dashboard template.
 * INPUT: filename (string)
 * OUTPUT: string
 * SIDE EFFECTS: none
 */
function include(filename) {
  // ===== MAIN LOGIC =====
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('include', error, { filename: filename });
    return '';
  }
}

/**
 * FUNCTION: getDashboardData
 * PURPOSE: Top-level wrapper called by google.script.run from the dashboard.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create missing dashboard-readable sheet headers.
 */
function getDashboardData() {
  // ===== MAIN LOGIC =====
  return DashboardService.getDashboardData();
}

/**
 * FUNCTION: createDashboardLead
 * PURPOSE: Top-level wrapper called by google.script.run to create a manual dashboard lead.
 * INPUT: input (object)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Appends one Leads row when validation passes.
 */
function createDashboardLead(input) {
  // ===== MAIN LOGIC =====
  return DashboardService.createLeadFromDashboard(input);
}

/**
 * FUNCTION: runStage9DashboardSetupValidation
 * PURPOSE: Verify Stage 9 dashboard backend can load summary data without rendering the web app.
 * INPUT: none
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: May create missing dashboard-readable sheet headers.
 */
function runStage9DashboardSetupValidation() {
  // ===== MAIN LOGIC =====
  try {
    var dataResult = DashboardService.getDashboardData();
    if (!dataResult.success) {
      return dataResult;
    }

    return {
      success: true,
      message: 'Stage 9 dashboard setup validation completed.',
      data: {
        metrics: dataResult.data.metrics,
        refreshedAt: dataResult.data.refreshedAt
      }
    };
  } catch (error) {
    // ===== ERROR HANDLING =====
    ErrorLogger.logError_('runStage9DashboardSetupValidation', error);
    return { success: false, message: 'Stage 9 dashboard setup validation failed unexpectedly.' };
  }
}
