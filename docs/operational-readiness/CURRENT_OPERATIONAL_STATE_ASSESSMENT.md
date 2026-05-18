# MIDTS Automation Engine — Current Operational State Assessment

**Assessment date:** 2026-05-18  
**Repository:** `zeeshankhanminhas/midts-automation-engine`  
**Observed branch in container:** `work`  
**User-stated target branch:** `docs/core-framework-restructure-map`  
**Operational mode:** Infrastructure Preparation & Controlled Execution  
**Assessment scope:** Repository-only static review before further implementation work.

> **Stop condition:** Operational readiness is incomplete. Further workflow implementation should not begin until dependency, template, settings, reference-document, and audit-readiness preparation is completed.

---

## 1. Review Boundary and Governance Inputs

This assessment intentionally does **not** refactor execution files, move files, rename functions, modify workflow logic, or implement new features.

### Governance reference status

The requested governance reference, `docs/core-master-framework/00_RESTRUCTURE_MAP.md`, is **not present** in the checked-out repository. That means the repository cannot currently prove conformance to that document from local source control.

Observed repository governance inputs:

- Root `AGENTS.md` exists and describes the MIDTS staged workflow, security rules, Settings/database rules, ID standard, and Stage 0 expectations.
- The requested `docs/core-master-framework/00_RESTRUCTURE_MAP.md` file is missing.
- The local Git branch name is `work`, not the user-stated `docs/core-framework-restructure-map`.

### Assessment confidence

The assessment is based on static repository inspection. It does not verify the live Apps Script deployment, live Google Sheet contents, live Settings values, Google Drive folders, Brevo account state, Slack webhook validity, or the separate website repository deployment.

---

## 2. Current Operational Stage Assessment

### Overall stage state

The repository has progressed beyond Stage 0 documentation-only scope and contains implementation files for Stages 1 through 11-style workflows, including lead intake, qualification, vendor pricing, quote gating, payment tracking, project creation, Drive access, Brevo email, Slack alerts, dashboard, and website webhook routing.

### Current production-readiness level

**Production-readiness level: Not production-ready / dependency-readiness required first.**

Reasoning:

1. The repository has substantial workflow code, but the required restructure map document is absent.
2. Several workflows depend on external live configuration that cannot be verified from the repository.
3. Vendor pricing does not yet match the full required database schema for MIDTS margin and final customer price.
4. Quote records accept an externally supplied `amount` rather than deriving the customer price from approved vendor cost plus MIDTS margin.
5. Template/document readiness is not established in-source.
6. Drive structure readiness depends on `ROOT_DRIVE_FOLDER_ID` and live Drive permissions.
7. Logging coverage exists in several areas, but not all major state transitions have complete durable audit coverage.
8. Local test coverage consists mostly of Apps Script runner functions and manual/deployment checks rather than an automated local CI harness.

### Recommended operational classification

| Area | Status | Notes |
| --- | --- | --- |
| Stage 1 foundation | Mostly stable but settings-dependent | Settings, Error Logs, and ID Counters structures are present in code. |
| Website Step 1 intake | Partially stable | Backend routing and lead creation exist; production depends on deployed `/exec` URL and token wiring. |
| Step 2 qualification | Partially implemented | Qualification gating exists; detailed requirement schema and downstream dependency map need hardening. |
| Vendor assignment | Partially stable | Vendor eligibility gating exists; assignment audit coverage is limited. |
| Vendor pricing | Partially implemented / blocker | Submission and approval gate exist, but required margin/final-price fields are missing. |
| Quote generation | Unstable for production | Gating exists, but final price is externally supplied and not calculated from approved vendor pricing. |
| Payment tracking | Partially implemented | Payment records can be created/updated against quotes; no payment provider reconciliation is present. |
| Project creation | Partially stable | Requires qualified lead, eligible vendor, and accepted quote; Drive folder creation is separate. |
| Drive access | Partially stable but high-risk | Access grant/remove logic and logs exist; live root folder and vendor email state required. |
| Email | Partially stable but config-dependent | Brevo sender/API keys and form URLs required; templates are inline code, not external document templates. |
| Slack alerts | Partially stable but config-dependent | Webhook and logs exist; alert coverage is not complete across all workflows. |
| Dashboard | Admin visibility exists | Dashboard reads multiple sheets; not a governance control plane. |

---

## 3. Stable Components

The following components appear relatively stable from repository inspection, subject to live Apps Script/Sheets configuration.

### 3.1 Foundation bootstrap

- `runStage1Validation()` verifies Settings, Error Logs, and ID Counters sheet structures and checks required settings.
- `DatabaseService.ensureSheetAndHeaders_()` appends missing headers without deleting or reordering existing data.
- `UtilsService.createSequentialId_()` centralizes branded sequential MIDTS ID creation through the `ID Counters` sheet, with a timestamp fallback if the counter path fails.

### 3.2 Lead creation foundation

- `LeadService.createLead()` validates required lead input and appends a lead row.
- Lead records include qualification, nurture, reminder, and Step 2 fields.
- Website Step 1 intake maps website aliases into the lead creation payload.

### 3.3 Lead qualification gate

- `LeadService.canLeadProceedToQuote()` blocks quote progression unless Step 2 is completed and `Qualification Status` is `Qualified`.
- `LeadService.markStep2Completed()` updates the lead to qualified status with score and high-value flag.

### 3.4 Vendor eligibility gate

- `VendorService.assignVendorToLead()` checks that the lead is qualified before vendor assignment.
- Vendor assignment is gated by `NDA Signed = Yes`, `ID Verified = Yes`, and `Approved Status = Approved`.
- Vendor-facing lead snapshots are sanitized and do not include customer final price, MIDTS margin, or MIDTS profit.

### 3.5 Quote lifecycle transition guard

- `QuoteService.updateQuoteStatus()` restricts quote transitions to `Draft → Sent → Accepted/Rejected` or idempotent same-status updates.
- `ProjectService.createProjectFromQuote()` requires quote status `Accepted` before creating a project.

### 3.6 Logging foundation

- `ErrorLogger.logError_()` writes to `Error Logs` with branded error IDs.
- `EmailService`, `SlackService`, `DriveService`, `WebsiteWebhookService`, and `VendorPricingService` maintain dedicated log sheets for their respective operations.

---

## 4. Unstable or Incomplete Components

### 4.1 Governance reference is missing

The required `docs/core-master-framework/00_RESTRUCTURE_MAP.md` document is absent, so future work cannot reliably apply or validate the requested governance map.

### 4.2 Branch state mismatch

The checked-out local branch is `work`, while the requested current branch is `docs/core-framework-restructure-map`. This should be resolved before implementation or deployment decisions are made.

### 4.3 Vendor Pricing sheet schema is incomplete against governance requirements

The current `VendorPricingService.ensureVendorPricingSheetStructure()` headers are:

- `Vendor Pricing ID`
- `Lead ID`
- `Vendor ID`
- `Submitted At`
- `Vendor Cost`
- `Currency`
- `ETA`
- `Vendor Notes`
- `Pricing Status`
- `MIDTS Review Status`
- `Reviewed At`
- `MIDTS Notes`

The required governance schema also calls for fields such as `Created At`, `Vendor Name`, `Vendor Email`, `Vendor ETA`, `MIDTS Margin Type`, `MIDTS Margin Value`, `MIDTS Profit Amount`, `Final Customer Price`, `Review Status`, `Quote ID`, and `Notes`.

**Impact:** Vendor pricing cannot yet act as a complete controlled source of truth for customer quote generation.

### 4.4 MIDTS margin application is not implemented as a durable workflow step

The code can approve vendor pricing for quote generation, but there is no durable margin type/value capture, profit amount calculation, final customer price calculation, or quote linkage in the Vendor Pricing row.

**Impact:** The required business sequence `Vendor Pricing → MIDTS Margin Applied → Quote Generated` is not fully represented.

### 4.5 Quote generation is gated but not price-governed

`QuoteService.createQuoteForLead()` enforces lead qualification and approved vendor pricing. However, it accepts `amount` from the caller and writes that amount into the quote. It does not derive the final customer price from vendor cost plus fixed margin or vendor cost multiplied by markup.

**Impact:** A caller could generate a quote amount that does not match the approved vendor pricing and MIDTS margin policy.

### 4.6 Website intake production reliability is not proven

The repository includes diagnostics and a safer website-integration route, but the live website repository/deployment is external. The current readiness cannot prove that:

- The live website posts to the correct Apps Script `/exec` URL.
- The live website token matches `WEBSITE_WEBHOOK_TOKEN`.
- The Apps Script web app deployment is updated and accessible.
- Browser-side `no-cors` masking has been removed from production.

### 4.7 Step 2 technical requirement intake is implemented but not fully dependency-governed

Step 2 intake exists and can mark leads qualified. However, readiness depends on the website Step 2 form fields, stable URL generation from `STEP2_FORM_BASE_URL`, and clear downstream dependency mapping from qualification to vendor pricing.

### 4.8 Project Drive folder lifecycle is separate from project creation

Project records can be created after quote acceptance, and Drive folders can be created later. There is no confirmed single orchestrated production path that creates the project, creates the folder, logs the folder, and grants/removes vendor access in one controlled handoff.

### 4.9 Template readiness is weak

Email content is inline in Apps Script functions. No controlled quote/PDF/document templates are present in the repository, and no Settings keys for quote template IDs or project document template IDs are defined.

### 4.10 Logging/audit coverage is uneven

Dedicated logs exist for error, email, Slack, Drive access, website webhook, and vendor pricing webhooks. However, important business state transitions are not consistently logged to a general/system audit log, including:

- Lead status changes.
- Step 2 qualification decisions.
- Vendor assignment changes.
- Vendor pricing approval/rejection decisions beyond row field updates.
- Quote creation and quote status transitions.
- Payment status transitions.
- Project creation.

---

## 5. Workflow-by-Workflow State

### 5.1 Website intake workflow

**Execution state:** Partially implemented and backend-testable.  
**Implemented:**

- `doPost(e)` routes website form submissions.
- Step 1 website payloads are handled by `WebsiteWebhookService.handlePostEvent(e)`.
- Website webhook attempts are logged.
- Lead acknowledgement email is attempted for successful Step 1 intake.
- A Next.js server-side integration example exists under `website-integration/` to avoid exposing webhook token values in the browser.

**Incomplete/unstable:**

- Live website deployment cannot be verified from this repository.
- Current production wiring may still depend on environment variables and deployment settings outside this repository.
- If acknowledgement email settings are missing, lead creation can succeed while email fails.
- Apps Script Web App deployment state is not represented in source.

**Blockers before production:**

- Confirm `/exec` URL, token match, deployment access, and website-side server route deployment.
- Confirm Website Webhook Logs are populated in the live Sheet.

### 5.2 Step 2 qualification workflow

**Execution state:** Partially implemented.  
**Implemented:**

- Step 2 payloads are detected and routed from `doPost(e)`.
- Step 2 completion can mark a lead as qualified.
- Quote/vendor-pricing gates depend on qualification status and Step 2 completion timestamp.

**Incomplete/unstable:**

- No repository-owned frontend Step 2 form template is present.
- Step 2 field validation and scoring model should be reviewed against actual business qualification criteria before further downstream execution.
- Lead nurture/reminder processing exists as runner/test-style functions, but production trigger readiness is not established from source.

**Blockers before production:**

- Confirm Step 2 form URL and fields.
- Confirm `STEP2_FORM_BASE_URL` is configured.
- Confirm trigger schedule for nurture/reminder processing, if it is intended to run automatically.

### 5.3 Vendor pricing workflow

**Execution state:** Partially implemented; not production-ready.  
**Implemented:**

- Vendor pricing payload routing exists.
- Vendor pricing submission requires a qualified lead.
- Vendor pricing submissions are written to `Vendor Pricing`.
- Vendor pricing can be approved for quote generation.
- Quote generation checks for newest submitted/approved vendor pricing.

**Incomplete/unstable:**

- Required Vendor Pricing sheet fields are missing.
- MIDTS margin type/value is not stored.
- MIDTS profit and final customer price are not calculated.
- No durable quote linkage back to vendor pricing is written.
- Review statuses are narrower than the full required status set.
- Vendor assignment sends pricing request emails, but assignment itself lacks a dedicated audit sheet.

**Blockers before production:**

- Prepare the full Vendor Pricing schema.
- Add Settings and templates for vendor pricing forms/emails only after dependency readiness is documented.
- Define margin governance before touching quote generation logic.

### 5.4 Quote generation workflow

**Execution state:** Gated but not production-ready.  
**Implemented:**

- Quote sheet structure exists.
- Quote creation requires qualified lead and approved vendor pricing.
- Quote lifecycle status transitions are constrained.

**Incomplete/unstable:**

- Quote amount is supplied by caller, not computed from approved vendor cost and MIDTS margin.
- Quote sheet lacks vendor pricing ID, margin fields, final price provenance, template/document IDs, PDF/document URLs, sent timestamps, and customer acceptance metadata.
- No quote document/PDF generation template exists in the repository.
- Quote creation does not update the Vendor Pricing row with `Quote ID`.

**Blockers before production:**

- Do not extend quote generation until Vendor Pricing schema and margin readiness are complete.
- Define quote template/document dependency keys before implementation.

### 5.5 Payment tracking workflow

**Execution state:** Partially implemented.  
**Implemented:**

- Payment sheet structure exists.
- Payments can be recorded against an accepted quote.
- Payment status can be updated.

**Incomplete/unstable:**

- No external payment processor, invoice system, reconciliation job, or receipt template is present.
- Payment state changes are not routed through a dedicated payment audit log.
- Project creation is not automatically tied to a confirmed payment event.

**Blockers before production:**

- Confirm intended payment source of truth and required payment Settings keys/templates before implementation.

### 5.6 Project creation workflow

**Execution state:** Partially stable.  
**Implemented:**

- Project creation requires lead ID, vendor ID, and quote ID.
- Lead must be qualified.
- Vendor must be eligible.
- Quote must be accepted.
- Project receives canonical MIDTS project ID.

**Incomplete/unstable:**

- Payment is not a mandatory gate in `ProjectService.createProjectFromQuote()` despite the required sequence including Payment before Project.
- Project creation does not automatically create a Drive folder.
- Project creation does not write a general audit log.

**Blockers before production:**

- Confirm whether payment must be a hard gate before project creation in execution code.
- Prepare project folder and access orchestration rules before enabling live project creation.

### 5.7 Dependency governance readiness

**Execution state:** Incomplete.  
**Implemented:**

- Some gates exist: qualification before quote/vendor assignment, vendor eligibility before assignment, approved vendor pricing before quote, accepted quote before project.

**Missing:**

- The requested restructure map document.
- A machine-readable dependency matrix.
- A stage-by-stage readiness checklist tied to Settings keys, sheets, templates, triggers, and external deployments.
- A single system audit view of dependency gate failures.

### 5.8 Template readiness

**Execution state:** Incomplete.  
**Present:**

- Inline email content in Apps Script.
- Website integration examples for a separate Next.js site.

**Missing:**

- Quote template / PDF template.
- Vendor pricing request template document, if intended outside inline email.
- Payment receipt/invoice template.
- Project kickoff template.
- Settings keys for template IDs.
- Template ownership/versioning guidance.

### 5.9 Drive structure readiness

**Execution state:** Partially implemented, live readiness unknown.  
**Implemented:**

- Project folder creation under `ROOT_DRIVE_FOLDER_ID`.
- Vendor access grant/removal with eligibility checks.
- Drive access logging.

**Missing/unknown:**

- Live root folder ID.
- Standard subfolder taxonomy.
- Folder naming convention beyond default `MIDTS Project {projectId}`.
- Customer/vendor/client folder separation policy encoded as checks.
- Evidence that inherited permissions are private and non-public.

### 5.10 Settings sheet readiness

**Execution state:** Incomplete for full production.  
**Implemented required settings list:**

- `BREVO_API_KEY`
- `SLACK_WEBHOOK_URL`
- `ROOT_DRIVE_FOLDER_ID`
- `WEBSITE_WEBHOOK_TOKEN`
- `STEP2_FORM_BASE_URL`
- `VENDOR_PRICING_FORM_BASE_URL`

**Additional settings referenced by services/tests:**

- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `TEST_EMAIL_RECIPIENT`
- `TEST_VENDOR_EMAIL`

**Missing likely production settings:**

- `QUOTE_TEMPLATE_ID`
- `QUOTE_OUTPUT_FOLDER_ID`
- `PROJECT_TEMPLATE_ID` or project kickoff template key
- `PAYMENT_RECEIPT_TEMPLATE_ID` or invoice/receipt template key
- `INTERNAL_ALERT_CHANNEL` or alert routing metadata, if Slack routing expands
- `ADMIN_EMAIL` or operational owner notification target
- Any payment provider keys, if payment is later integrated with an external provider

### 5.11 Logging and observability readiness

**Execution state:** Partially implemented.  
**Implemented logs:**

- `Error Logs`
- `Email Logs`
- `Slack Logs`
- `Drive Access Logs`
- `Website Webhook Logs`
- `Vendor Pricing Logs`

**Missing/weak coverage:**

- General/System Logs sheet is defined in ID standards but not implemented as a central audit trail.
- Lead lifecycle transitions are not consistently logged.
- Step 2 scoring/qualification decisions are not in a dedicated audit trail.
- Vendor assignment events do not have a dedicated audit log.
- Quote lifecycle transitions do not have a dedicated audit log.
- Payment status transitions do not have a dedicated audit log.
- Project creation and Drive folder creation are not unified into one workflow-level observability record.

### 5.12 Test coverage readiness

**Execution state:** Manual/runner-test coverage exists; automated CI readiness is low.  
**Present:**

- Stage runner/test functions in Apps Script files for foundation, lead capture, qualification, vendor pricing, quotes, payment, Drive, email, Slack, dashboard, and website webhook payloads.
- Website diagnostic markdown and Next.js integration examples.

**Missing/weak:**

- No package-level automated test harness.
- No local Apps Script mock test suite.
- No CI workflow configuration.
- Tests can mutate live Sheets by appending test records.
- External tests require live Brevo, Slack, Drive, Apps Script, and website deployment state.

---

## 6. Missing Dependencies

### 6.1 Repository/documentation dependencies

- `docs/core-master-framework/00_RESTRUCTURE_MAP.md` is missing.
- No explicit operational dependency matrix exists.
- No deployment manifest maps Apps Script deployment ID, Sheet ID, Drive root ID, website URL, and environment ownership.

### 6.2 External service dependencies

- Apps Script Web App deployment URL and access mode.
- Google Sheet bound to the Apps Script project.
- Google Drive root folder and permission model.
- Brevo API key, sender email, sender name, verified sender/domain.
- Slack webhook URL and target channel ownership.
- Website deployment that forwards forms through server-side route or secure equivalent.
- Optional payment provider/invoice system, if later required.

### 6.3 Trigger dependencies

- Lead nurture/reminder trigger schedule, if reminders are intended to run automatically.
- Any scheduled audit/retry jobs for webhook, email, Slack, or payment status.

---

## 7. Missing Templates/Documents

The repository does not currently contain controlled templates for:

1. Customer quote document/PDF.
2. Vendor pricing request document/form template, beyond inline email and external website route guidance.
3. Payment receipt/invoice confirmation.
4. Project kickoff/customer confirmation.
5. Internal admin readiness checklist.
6. Drive folder taxonomy / folder README template.
7. Vendor NDA/ID verification evidence tracking document.

---

## 8. Missing Settings Keys

### 8.1 Required keys already defined by configuration

These must be present in Settings or Script Properties for the current code paths:

- `BREVO_API_KEY`
- `SLACK_WEBHOOK_URL`
- `ROOT_DRIVE_FOLDER_ID`
- `WEBSITE_WEBHOOK_TOKEN`
- `STEP2_FORM_BASE_URL`
- `VENDOR_PRICING_FORM_BASE_URL`

### 8.2 Service/test keys referenced outside the central required list

These are referenced by current services or test runners and should be added to readiness checklists:

- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `TEST_EMAIL_RECIPIENT`
- `TEST_VENDOR_EMAIL`

### 8.3 Keys needed before future production quote/payment/project execution

Do not implement these yet without the dependency preparation stage, but reserve them in readiness planning:

- `QUOTE_TEMPLATE_ID`
- `QUOTE_OUTPUT_FOLDER_ID`
- `PAYMENT_RECEIPT_TEMPLATE_ID`
- `PROJECT_KICKOFF_TEMPLATE_ID`
- `PROJECT_OUTPUT_FOLDER_ID` or documented use of `ROOT_DRIVE_FOLDER_ID`
- `ADMIN_EMAIL`
- Payment provider keys, only if/when a provider is selected.

---

## 9. Current Blockers

1. Missing `docs/core-master-framework/00_RESTRUCTURE_MAP.md` governance reference.
2. Local branch mismatch: container is on `work`, not `docs/core-framework-restructure-map`.
3. Vendor Pricing sheet schema does not match required governance fields.
4. MIDTS margin and final customer price calculation are not implemented as controlled state.
5. Quote generation accepts caller-provided amount instead of using approved vendor pricing plus margin.
6. Quote templates/PDF/document generation dependencies are absent.
7. Live Settings values cannot be proven from repository.
8. Live website deployment and webhook wiring cannot be proven from repository.
9. Project creation does not enforce payment as a hard gate.
10. Central general/system audit log coverage is absent.
11. Test coverage is not automated and may mutate live Sheets.

---

## 10. Recommended Next Implementation Priority

Because operational readiness is incomplete, **do not proceed with new feature implementation yet**.

Recommended priority:

1. Restore or create the missing governance reference at `docs/core-master-framework/00_RESTRUCTURE_MAP.md` before changing workflow code.
2. Create a dependency readiness checklist/matrix covering sheets, headers, Settings keys, templates, Drive folders, triggers, web app deployment, website deployment, and audit logs.
3. Align the Vendor Pricing data model to the required schema in documentation first.
4. Define the margin calculation governance and quote dependency contract in documentation first.
5. Only after dependency readiness is approved, implement the smallest schema-readiness changes needed for vendor pricing and quote governance.

---

## 11. Recommended Immediate Preparation Tasks

These are preparation tasks, not feature implementation tasks:

1. Confirm the correct Git branch and repository state.
2. Add the missing restructure map document or recover it from the intended branch.
3. Build a Settings readiness table with key, source, required stage, example value, owner, and verification method.
4. Build a sheet readiness table with sheet name, required headers, owning stage, and blocker status.
5. Build a template readiness table with template/document name, Settings key, owner, and current status.
6. Build a Drive readiness table with root folder ID, folder taxonomy, sharing policy, and audit requirement.
7. Build an observability matrix listing every workflow transition and required log destination.
8. Build a test readiness matrix separating safe setup checks from live external sends/shares.
9. Verify the live website route can reach Apps Script and returns readable JSON through the server-side route.
10. Decide whether payment is a required hard gate before project creation and document that dependency before implementation.

---

## 12. Risk Assessment Before Further Execution Work

| Risk | Severity | Likelihood | Notes | Mitigation |
| --- | --- | --- | --- | --- |
| Governance map missing | High | High | Required reference cannot be applied. | Restore/create `00_RESTRUCTURE_MAP.md` first. |
| Incorrect quote pricing | Critical | High | Quote amount is caller-supplied and not margin-derived. | Freeze quote implementation until vendor pricing/margin schema is ready. |
| Vendor pricing schema drift | High | High | Current headers are materially different from required schema. | Prepare schema migration plan that appends missing headers only. |
| Live website not reaching Apps Script | High | Medium | Known diagnostic exists; live deployment is external. | Verify `/exec`, token, and server-side route. |
| Missing Settings keys | High | High | Several service-level keys are outside central required validation. | Expand readiness checklist before live tests. |
| Uncontrolled Drive sharing | Critical | Medium | Access logic checks vendor eligibility, but live folder structure is unknown. | Verify root folder and private permission inheritance before sharing. |
| Insufficient audit trail | High | Medium | Several state changes lack durable business audit logs. | Define system audit matrix before workflow expansion. |
| Tests mutate production data | Medium | High | Runner functions append/update Sheets. | Use dedicated test Sheet/environment before running broad tests. |
| Payment/project sequence mismatch | High | Medium | Project creation currently requires accepted quote but not payment. | Decide and document payment gate before project workflow work. |

---

## 13. Final Assessment

The MIDTS Automation Engine repository contains useful Stage 1–11 implementation scaffolding and several working governance gates. However, it is **not operationally ready for further execution implementation** because the dependency foundation is incomplete.

The immediate next step should be dependency readiness preparation, not feature work. In particular, resolve the missing restructure map, document the full dependency matrix, align vendor pricing schema/margin governance on paper, and verify Settings/template/Drive/webhook readiness before changing execution logic.
