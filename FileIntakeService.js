/**
 * MIDTS Automation Engine
 * STAGE: 12 (Technical engineering file intake)
 * WHAT THIS FILE DOES:
 * - Receives Step 2 file-upload payloads, validates content, and stores approved files in lead intake folders.
 * - Creates/uses per-lead intake folder structure (raw/internal-review/vendor-safe).
 * - Writes upload attempts to File Logs and updates lead summary linkage fields.
 * DEPENDENCIES:
 * - Google Sheet tabs: Leads, Settings, File Logs
 * - Uses Google Drive root folder from Settings sheet: FILE_INTAKE_ROOT_FOLDER_ID
 * - WebsiteWebhookService (WebsiteWebhookService.gs)
 * - DatabaseService (DatabaseService.gs)
 * - ErrorLogger (ErrorLogger.gs)
 * - UtilsService (Utils.gs)
 */
var FileIntakeService = {
  FILE_LOGS_SHEET_NAME: 'File Logs',
  MAX_FILE_COUNT: 15,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  MAX_TOTAL_BYTES: 250 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['step', 'stp', 'iges', 'igs', 'stl', 'dxf', 'dwg', 'sldprt', 'sldasm', 'pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'zip', 'rar'],

  isFileUploadPayload: function (input) {
    var stage = String((input && (input.formStage || input.form_stage || input.stage)) || '').trim().toLowerCase();
    return stage === 'file_upload' || stage === 'step2_file_upload';
  },

  handlePostEvent: function (e) {
    try {
      var parseResult = WebsiteWebhookService.parsePostEvent_(e);
      if (!parseResult.success) { return parseResult; }
      var payload = parseResult.data.payload || {};
      var token = String(payload.webhookToken || '').trim();
      var tokenResult = WebsiteWebhookService.getConfiguredWebhookToken_();
      if (!tokenResult.success || token !== tokenResult.data.value) {
        this.logFileAttempt_('', '', '', '', '', '', 0, '', '', 'step2_file_upload', 'Rejected', 'Invalid webhook token.');
        return { success: false, message: 'Invalid webhook token.' };
      }
      var leadId = String(payload.leadId || '').trim();
      var lead = this.getLeadRow_(leadId);
      if (!lead.success) {
        this.logFileAttempt_('', '', leadId, '', '', '', 0, '', '', 'step2_file_upload', 'Rejected', 'Missing lead linkage.');
        return lead;
      }
      var files = this.parseFiles_(payload.files);
      if (!files.success) {
        this.logFileAttempt_('', '', leadId, '', '', '', 0, '', '', 'step2_file_upload', 'Rejected', files.message);
        return files;
      }
      var validate = this.validateFiles_(files.data.files);
      if (!validate.success) {
        this.logFileAttempt_('', '', leadId, '', '', '', 0, '', '', 'step2_file_upload', 'Rejected', validate.message);
        return validate;
      }
      var intakeFolder = this.ensureLeadIntakeFolders_(leadId, lead.data.company);
      if (!intakeFolder.success) { return intakeFolder; }

      var created = [];
      for (var i = 0; i < files.data.files.length; i++) {
        var item = files.data.files[i];
        var storedName = this.buildSafeStoredFilename_(leadId, item.name, i + 1);
        var bytes = Utilities.base64Decode(item.base64);
        var blob = Utilities.newBlob(bytes, item.type || 'application/octet-stream', storedName);
        var driveFile = DriveApp.getFolderById(intakeFolder.data.rawFolderId).createFile(blob);
        created.push({ driveFileId: driveFile.getId(), storedFilename: storedName, fileSize: item.size, mimeType: item.type, originalFilename: item.name });
        this.logFileAttempt_(UtilsService.createSequentialId_('LOG'), new Date(), leadId, item.name, storedName, item.type, item.size, driveFile.getId(), intakeFolder.data.rawFolderId, 'step2_file_upload', 'Stored', 'Stored in 01_RAW_CLIENT_UPLOADS.');
      }
      var updateResult = this.updateLeadFileSummary_(lead.data.row, created.length, intakeFolder.data.leadFolderId, intakeFolder.data.leadFolderUrl);
      return { success: updateResult.success, message: updateResult.success ? 'Files uploaded and stored successfully.' : updateResult.message, data: { leadId: leadId, filesStored: created.length, leadIntakeFolderId: intakeFolder.data.leadFolderId, rawFolderId: intakeFolder.data.rawFolderId } };
    } catch (error) {
      ErrorLogger.logError_('FileIntakeService.handlePostEvent', error, { event: e });
      this.logFileAttempt_('', '', '', '', '', '', 0, '', '', 'step2_file_upload', 'Rejected', 'Unhandled exception while processing upload.');
      return { success: false, message: 'File upload processing failed unexpectedly.' };
    }
  },

  ensureFileIntakeSetup: function () {
    try {
      var leads = DatabaseService.ensureLeadsSheetStructure();
      if (!leads.success) return leads;
      var logs = DatabaseService.ensureFileLogsSheetStructure();
      if (!logs.success) return logs;
      var settings = DatabaseService.ensureSettingsSheetStructure();
      if (!settings.success) return settings;

      var root = this.getSettingValue_(ConfigService.FILE_INTAKE_ROOT_FOLDER_ID_KEY);
      if (!root.success) return root;

      var rootFolder = DriveApp.getFolderById(root.data.value);
      var probeName = 'MIDTS_FILE_INTAKE_SETUP_PROBE';
      var probe = this.findOrCreateChildFolder_(rootFolder, probeName);

      return {
        success: true,
        message: 'File intake setup verified, including Drive root folder access.',
        data: {
          rootFolderId: rootFolder.getId(),
          rootFolderUrl: rootFolder.getUrl(),
          probeFolderId: probe.getId(),
          fileLogsSheet: this.FILE_LOGS_SHEET_NAME
        }
      };
    } catch (error) {
      ErrorLogger.logError_('FileIntakeService.ensureFileIntakeSetup', error);
      return { success: false, message: 'Failed to verify File Intake setup. Check FILE_INTAKE_ROOT_FOLDER_ID and Drive permissions.', data: { errorMessage: error && error.message ? error.message : String(error) } };
    }
  },

  parseFiles_: function (raw) { try { var parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw; if (!(parsed instanceof Array) || parsed.length === 0) return { success: false, message: 'File payload is empty.' }; return { success: true, message: 'Files parsed.', data: { files: parsed } }; } catch (error) { return { success: false, message: 'Invalid file payload JSON.' }; } },
  validateFiles_: function (files) { var total = 0; if (files.length > this.MAX_FILE_COUNT) return { success: false, message: 'Too many files. Maximum is 15.' }; for (var i=0;i<files.length;i++){var f=files[i]||{};var name=String(f.name||'').trim();var ext=(name.split('.').pop()||'').toLowerCase();var size=Number(f.size||0);if(!name||!f.base64){return {success:false,message:'File payload not complete.'};} if(this.ALLOWED_EXTENSIONS.indexOf(ext)===-1){return {success:false,message:'Unsupported file extension: '+ext};} if(size<=0||size>this.MAX_FILE_SIZE_BYTES){return {success:false,message:'File size exceeds 50MB limit.'};} total += size; if(total>this.MAX_TOTAL_BYTES){return {success:false,message:'Total payload exceeds 250MB limit.'};} try { Utilities.base64Decode(String(f.base64)); } catch (e) { return { success:false,message:'Invalid base64 payload.'}; }} return { success:true,message:'File payload validated.', data:{totalSizeBytes:total}}; },
  ensureLeadIntakeFolders_: function (leadId, company) { try { var root = this.getSettingValue_(ConfigService.FILE_INTAKE_ROOT_FOLDER_ID_KEY); if (!root.success) return root; var rootFolder = DriveApp.getFolderById(root.data.value); var folderName = leadId + ' - ' + (String(company || '').trim() || 'Unknown'); var leadFolder = this.findOrCreateChildFolder_(rootFolder, folderName); var raw = this.findOrCreateChildFolder_(leadFolder, '01_RAW_CLIENT_UPLOADS'); this.findOrCreateChildFolder_(leadFolder, '02_INTERNAL_REVIEW'); this.findOrCreateChildFolder_(leadFolder, '03_VENDOR_SAFE_PACKAGE'); return { success:true,message:'Intake folders ready.',data:{leadFolderId:leadFolder.getId(),leadFolderUrl:leadFolder.getUrl(),rawFolderId:raw.getId()}}; } catch (error) { ErrorLogger.logError_('FileIntakeService.ensureLeadIntakeFolders_', error, { leadId: leadId }); return { success:false,message:'Failed to create lead intake folders.', data: { errorMessage: error && error.message ? error.message : String(error) }}; } },
  getSettingValue_: function (key) { var map = DatabaseService.getSettingsMap(); if(!map.success) return map; var v = String(map.data.settingsMap[key] || PropertiesService.getScriptProperties().getProperty(key) || '').trim(); if(!v) return {success:false,message:'Missing required setting: '+key}; return {success:true,message:'Setting found.',data:{value:v}}; },
  getLeadRow_: function (leadId) { try { if(!leadId) return {success:false,message:'leadId is required.'}; DatabaseService.ensureLeadsSheetStructure(); var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME); var values=sh.getDataRange().getValues(); for(var i=1;i<values.length;i++){if(String(values[i][0]||'').trim()===leadId){return {success:true,message:'Lead found.',data:{row:i+1,company:values[i][4]}};}} return {success:false,message:'Lead not found for provided leadId.'}; } catch(error){ ErrorLogger.logError_('FileIntakeService.getLeadRow_', error, {leadId:leadId}); return {success:false,message:'Failed to read lead row.'}; } },
  updateLeadFileSummary_: function (rowNumber, incrementCount, folderId, folderUrl) { try { var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ConfigService.LEADS_SHEET_NAME); var current=Number(sh.getRange(rowNumber,23).getValue()||0); sh.getRange(rowNumber,21,1,7).setValues([[ 'Yes', 'Stored', current + incrementCount, folderId, folderUrl, new Date(), 'No' ]]); return {success:true,message:'Lead file summary updated.'}; } catch(error){ ErrorLogger.logError_('FileIntakeService.updateLeadFileSummary_', error, {rowNumber:rowNumber}); return {success:false,message:'Failed to update lead file summary.'}; } },
  findOrCreateChildFolder_: function (parentFolder, name) { var iterator = parentFolder.getFoldersByName(name); return iterator.hasNext() ? iterator.next() : parentFolder.createFolder(name); },
  buildSafeStoredFilename_: function (leadId, originalName, ordinal) { var safeOriginal = String(originalName || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_'); return leadId + '_' + new Date().getTime() + '_' + ordinal + '_' + safeOriginal; },
  logFileAttempt_: function (fileId, timestamp, leadId, originalName, storedName, mimeType, size, driveFileId, driveFolderId, source, status, notes) { try { DatabaseService.ensureFileLogsSheetStructure(); var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.FILE_LOGS_SHEET_NAME); sh.appendRow([fileId || UtilsService.createSequentialId_('LOG'), timestamp || new Date(), leadId || '', originalName || '', storedName || '', mimeType || '', Number(size||0), driveFileId || '', driveFolderId || '', source || 'step2_file_upload', status || 'Unknown', notes || '' ]); } catch (error) { ErrorLogger.logError_('FileIntakeService.logFileAttempt_', error, { leadId: leadId, status: status }); } }
};
