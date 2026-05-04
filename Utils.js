/**
 * MIDTS Automation Engine
 * STAGE: 1 (General helper utilities)
 * WHAT THIS FILE DOES:
 * - Provides low-level utility functions shared across services.
 * DEPENDENCIES:
 * - none
 */

var UtilsService = {
  /**
   * FUNCTION: createPrefixedId_
   * PURPOSE: Create a compact unique identifier with required business prefix.
   * INPUT: prefix (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  createPrefixedId_: function (prefix) {
    // ===== MAIN LOGIC =====
    // Use current epoch milliseconds plus random suffix for practical uniqueness.
    var randomSuffix = Math.floor(Math.random() * 1000000);
    return String(prefix || '') + new Date().getTime() + '-' + randomSuffix;
  }
};
