/**
 * MIDTS Automation Engine
 * STAGE: 1 (General helper utilities)
 * WHAT THIS FILE DOES:
 * - Provides low-level utility functions shared across services.
 * - Generates branded, sequential MIDTS IDs from the ID Counters sheet.
 * DEPENDENCIES:
 * - Google Sheets tab: ID Counters
 * - DatabaseService (DatabaseService.gs)
 * - ConfigService (Config.gs)
 */

var UtilsService = {
  // ===== CONFIG =====
  // Canonical short type codes used in template-friendly MIDTS IDs.
  ID_TYPE_CODE_MAP_: {
    LEAD: 'L',
    VENDOR: 'V',
    VENDOR_PRICING: 'VP',
    PROJECT: 'P',
    QUOTE: 'Q',
    PAYMENT: 'PAY',
    EMAIL_LOG: 'ELOG',
    SLACK_LOG: 'SLOG',
    DRIVE_LOG: 'DLOG',
    ERROR: 'ERR',
    LOG: 'LOG'
  },

  // Backward compatibility for older service calls while records migrate to the new ID standard.
  LEGACY_PREFIX_TYPE_MAP_: {
    'LEAD-': 'LEAD',
    'VEND-': 'VENDOR',
    'VEND-STAGE6-': 'VENDOR',
    'PROJ-': 'PROJECT',
    'QUOTE-': 'QUOTE',
    'PAY-': 'PAYMENT',
    'LOG-': 'LOG'
  },

  /**
   * FUNCTION: createSequentialId_
   * PURPOSE: Create a branded, short, sequential MIDTS ID for one record type.
   * INPUT: recordType (string: LEAD, VENDOR, VENDOR_PRICING, PROJECT, QUOTE, PAYMENT, EMAIL_LOG, SLACK_LOG, DRIVE_LOG, ERROR, LOG)
   * OUTPUT: string
   * SIDE EFFECTS: Creates/updates one row in ID Counters sheet.
   */
  createSequentialId_: function (recordType) {
    // ===== MAIN LOGIC =====
    var lock = LockService.getScriptLock();
    try {
      // Locking prevents two simultaneous form/API runs from taking the same sequence number.
      lock.waitLock(30000);

      var normalizedType = String(recordType || '').trim().toUpperCase();
      var typeCode = this.ID_TYPE_CODE_MAP_[normalizedType];
      if (!typeCode) {
        return this.createTimestampFallbackId_(normalizedType || 'GEN');
      }

      var ensureResult = DatabaseService.ensureIdCountersSheetStructure();
      if (!ensureResult.success) {
        return this.createTimestampFallbackId_(typeCode);
      }

      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(ConfigService.ID_COUNTERS_SHEET_NAME);
      if (!sheet) {
        return this.createTimestampFallbackId_(typeCode);
      }

      var yearSuffix = this.getYearSuffix_(new Date());
      var values = sheet.getDataRange().getValues();
      var targetRow = 0;

      for (var i = 1; i < values.length; i++) {
        var rowType = String(values[i][0] || '').trim().toUpperCase();
        var rowYear = String(values[i][1] || '').trim();
        if (rowType === normalizedType && rowYear === yearSuffix) {
          targetRow = i + 1;
          break;
        }
      }

      var nextSequence = 1;
      var nextId = '';
      if (targetRow > 0) {
        nextSequence = Number(sheet.getRange(targetRow, 3).getValue() || 0) + 1;
        nextId = this.buildMidtsId_(typeCode, yearSuffix, nextSequence);
        sheet.getRange(targetRow, 3, 1, 3).setValues([[nextSequence, new Date(), nextId]]);
      } else {
        nextId = this.buildMidtsId_(typeCode, yearSuffix, nextSequence);
        sheet.appendRow([normalizedType, yearSuffix, nextSequence, new Date(), nextId]);
      }

      return nextId;
    } catch (error) {
      // ===== ERROR HANDLING =====
      // ID generation must still return a usable value so logging and intake paths do not fully collapse.
      return this.createTimestampFallbackId_(recordType || 'GEN');
    } finally {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // Ignore release errors because Apps Script may auto-release expired locks.
      }
    }
  },

  /**
   * FUNCTION: createPrefixedId_
   * PURPOSE: Backward-compatible wrapper for older prefix-based ID calls.
   * INPUT: prefix (string)
   * OUTPUT: string
   * SIDE EFFECTS: Creates/updates one row in ID Counters sheet when prefix is recognized.
   */
  createPrefixedId_: function (prefix) {
    // ===== MAIN LOGIC =====
    var cleanPrefix = String(prefix || '').trim();
    var mappedType = this.LEGACY_PREFIX_TYPE_MAP_[cleanPrefix];
    if (mappedType) {
      return this.createSequentialId_(mappedType);
    }

    return this.createTimestampFallbackId_(cleanPrefix || 'GEN');
  },

  /**
   * FUNCTION: buildMidtsId_
   * PURPOSE: Internal helper to format the canonical MIDTS ID string.
   * INPUT: typeCode (string), yearSuffix (string), sequence (number)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  buildMidtsId_: function (typeCode, yearSuffix, sequence) {
    // ===== MAIN LOGIC =====
    return 'MIDTS-' + String(typeCode || 'GEN') + '-' + String(yearSuffix || this.getYearSuffix_(new Date())) + this.padSequence_(sequence, 4);
  },

  /**
   * FUNCTION: padSequence_
   * PURPOSE: Internal helper to keep IDs compact but aligned for templates and Sheets.
   * INPUT: sequence (number), minimumDigits (number)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  padSequence_: function (sequence, minimumDigits) {
    // ===== MAIN LOGIC =====
    var raw = String(Math.max(Number(sequence || 1), 1));
    while (raw.length < Number(minimumDigits || 4)) {
      raw = '0' + raw;
    }
    return raw;
  },

  /**
   * FUNCTION: getYearSuffix_
   * PURPOSE: Internal helper to keep sequential IDs traceable by calendar year.
   * INPUT: dateValue (Date)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  getYearSuffix_: function (dateValue) {
    // ===== MAIN LOGIC =====
    var year = (dateValue instanceof Date ? dateValue : new Date()).getFullYear();
    return String(year).slice(-2);
  },

  /**
   * FUNCTION: createTimestampFallbackId_
   * PURPOSE: Internal emergency fallback when the counter sheet cannot be used.
   * INPUT: typeCode (string)
   * OUTPUT: string
   * SIDE EFFECTS: none
   */
  createTimestampFallbackId_: function (typeCode) {
    // ===== MAIN LOGIC =====
    var cleanType = String(typeCode || 'GEN').replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'GEN';
    var randomSuffix = Math.floor(Math.random() * 1000);
    return 'MIDTS-' + cleanType + '-' + this.getYearSuffix_(new Date()) + new Date().getTime() + this.padSequence_(randomSuffix, 3);
  }
};
