# MIDTS Automation Engine — AGENTS.md

## Project Purpose
MIDTS Automation Engine is an internal automation system for **MIDTS**, a UK-based CAD/CAM overflow support business.

The system is intended to manage:
- Lead capture
- Lead qualification
- Vendor assignment
- Quote generation and tracking
- Payment tracking
- Project tracking
- Controlled Google Drive file access
- Brevo transactional emails
- Slack internal alerts
- Lightweight Apps Script HTML Service admin dashboard

---

## Core Stack
- Google Apps Script
- Google Sheets (database)
- Google Drive (project folders and vendor file access)
- Brevo API (transactional emails)
- Slack webhook (internal alerts)
- Apps Script HTML Service (CRUD/admin dashboard)

---

## Stage-Based Delivery Rules
1. Build stage-by-stage.
2. Do not implement future stages unless explicitly requested.
3. Every stage must be independently testable.
4. Every stage must include either:
   - a test function, or
   - a clear testing checklist.
5. At the end of every stage, always explain:
   - files changed
   - functions added
   - how to test
   - known limitations
   - next recommended stage

### Current Scope
- **Stage 0 only** in this step.
- Do **not** write application code in Stage 0.
- Stage 0 output is documentation/setup guidance only.

---

## Engineering Rules
1. Use modular Apps Script files.
2. Never hard-code secrets.
3. Read secrets from Script Properties or a Settings sheet.
4. Every major function must return:
   ```js
   { success: boolean, message: string, data?: object }
   ```
5. Every major function must use `try/catch`.
6. Errors must be logged to Error Logs.
7. Do not expose API keys, Slack webhook URLs, or internal IDs in frontend HTML.
8. Prefer simple, reliable code over clever abstractions.
9. Do not delete or overwrite existing user data unless explicitly instructed.
10. When creating sheets, preserve existing rows and only add missing headers.
11. Use branded, unique, sequential MIDTS IDs for business records and logs.

### ID Standard
All new production records must use short, human-readable, branded IDs. The standard format is:

```text
MIDTS-{TYPE}-{YY}{SEQUENCE}
```

Where:
- `MIDTS` is the fixed brand prefix.
- `{TYPE}` is the short record type code.
- `{YY}` is the two-digit calendar year, for example `26` for 2026.
- `{SEQUENCE}` is a zero-padded sequential number, normally 4 digits at minimum.

Required business record formats:
- Lead: `MIDTS-L-260001`
- Vendor: `MIDTS-V-260001`
- Project: `MIDTS-P-260001`
- Quote: `MIDTS-Q-260001`
- Payment: `MIDTS-PAY-260001`

Required log record formats:
- Email Log: `MIDTS-ELOG-260001`
- Slack Log: `MIDTS-SLOG-260001`
- Drive Access Log: `MIDTS-DLOG-260001`
- Error Log: `MIDTS-ERR-260001`
- General/System Log: `MIDTS-LOG-260001`

ID generation rules:
1. Generate IDs from one central utility function, not separately inside each service.
2. Use one independent sequence per record type, so quote, lead, project, payment, vendor, and log IDs do not share one global counter.
3. Store counters in a dedicated sheet such as `ID Counters`, or another explicit durable counter store.
4. Existing historical IDs must remain valid and must not be rewritten unless explicitly requested.
5. New stages and new records should use the branded sequential format going forward.
6. IDs that appear on templates, emails, PDFs, project folders, Slack alerts, and dashboard views should use the same canonical value.

---

## Code Commenting Standard
Every file and function must include clear inline helper comments.

### Required Header at Top of Every File
Include:
- What this file does
- Which stage it belongs to
- Dependencies (Sheets, APIs, triggers, Drive folders)

### External Dependency Comment Requirements
When used, include explicit comments such as:
- Uses Brevo API key from Settings sheet: `BREVO_API_KEY`
- Uses Slack webhook from Settings sheet: `SLACK_WEBHOOK_URL`
- Uses Google Drive root folder from Settings sheet: `ROOT_DRIVE_FOLDER_ID`
- Uses Google Sheet tab: `Leads`

### User-Configurable Value Guidance
For each required value, include explicit instructions:
- `REQUIRED: Set this value in Settings sheet before running`
- Example format:
  - `BREVO_API_KEY = "xkeysib-xxxx"`

### Required Function Comment Block
Every function must include:
```
FUNCTION:
PURPOSE:
INPUT:
OUTPUT:
SIDE EFFECTS:
```

### Critical Logic Documentation
- Explain **why** each critical logic block exists.
- Never leave magic values unexplained.

Bad:
```js
if (hours > 24)
```

Good:
```js
// 24 hours = Step 2 reminder threshold
if (hours > 24)
```

### Visual Comment Markers
Use section markers in code:
- `===== CONFIG =====`
- `===== MAIN LOGIC =====`
- `===== ERROR HANDLING =====`

### TODO Marker Convention
Mark future-stage extensions with:
- `TODO (Stage X): explanation`

---

## Security Rules
1. API keys must never appear in frontend HTML.
2. Web app endpoints must validate input before writing to Sheets.
3. Vendor access must never expose internal client folders.
4. Vendor access is granted only when all are true:
   - NDA Signed = Yes
   - ID Verified = Yes
   - Approved Status = Approved
5. Drive access must be logged when granted or removed.
6. Files/folders must never be shared publicly unless explicitly instructed.
7. Do not email sensitive file links until access rules are validated.

---

## Database Rules
Google Sheets is the database.

Requirements:
- Each sheet must have fixed headers.
- Do not reorder existing headers unless explicitly asked.
- Only append missing headers.
- Preserve existing data.

---

## Required Initial File Structure (for Future Stages)
These files should be introduced in subsequent implementation stages:
- `Code.gs`
- `Config.gs`
- `DatabaseService.gs`
- `ErrorLogger.gs`
- `Utils.gs`

Potential future files:
- `LeadService.gs`
- `EmailService.gs`
- `ReminderService.gs`
- `VendorService.gs`
- `ProjectService.gs`
- `DriveService.gs`
- `AccessControlService.gs`
- `QuoteService.gs`
- `PaymentService.gs`
- `DashboardService.gs`
- `Index.html`
- `Styles.html`
- `ClientJS.html`

---

## Testing Expectations by Stage
Each stage must define a runnable verification method:
- Prefer dedicated test functions in Apps Script for backend logic.
- If no test function exists yet, provide a step-by-step manual checklist.
- Verification must be executable independently of future stages.

---


## Post-Completion Cleanup Rule (After All Stages Pass)
When all planned stages are completed and successfully tested:
1. Keep a minimal permanent smoke-test layer for regression safety.
2. Remove or isolate stage-only test helpers that were created only for temporary validation.
3. Prefer moving non-production helpers into a dedicated test harness file (for example: `TestHarness.gs`).
4. Clearly prefix retained test-only functions (for example: `test_` or `dev_`) and add comments that they are non-production helpers.
5. Keep production services focused on business workflows; remove dead code and outdated TODO markers.


## Stage 0 Definition of Done
- `AGENTS.md` exists at repository root.
- It clearly defines:
  - project purpose
  - stack
  - stage rules
  - engineering rules
  - security rules
  - database rules
  - commenting standards
  - testing expectations
- No Apps Script application code is written in Stage 0.
