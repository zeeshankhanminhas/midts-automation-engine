# 09 Trigger Registry

## EVT-021 — Step 2 file upload submitted
- **Trigger type:** Public web app `doPost(e)` payload event.
- **Router:** `routeWebsiteWebhookPost_(e)` in `CodeStage10.js`.
- **Handler:** `FileIntakeService.handlePostEvent(e)`.
- **State mutation:**
  - Creates lead intake Drive folders when missing.
  - Stores files in `01_RAW_CLIENT_UPLOADS` only.
  - Updates lead summary fields: Has Files, File Intake Status, File Count, Lead Intake Folder ID/URL, Last File Upload At, Vendor Safe Package Ready.
- **Audit logs:**
  - Always appends `File Logs` row for attempts.
  - Writes to `Error Logs` for runtime exceptions.
- **Failure behavior:** Reject with structured response and log `Rejected` status (invalid token, missing lead, invalid extension/base64, payload limits, Drive failures).
- **Proof runner:** `runStage12FileUploadPayloadTest()`.
