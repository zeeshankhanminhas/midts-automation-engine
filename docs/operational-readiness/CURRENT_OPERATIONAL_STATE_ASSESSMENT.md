# MIDTS Automation Engine — Current Operational State Assessment

**Assessment date:** 2026-06-09
**Repository:** `zeeshankhanminhas/midts-automation-engine`
**Observed branch in container:** `work`
**Operational mode:** Infrastructure Preparation & Controlled Execution
**Assessment scope:** Repository-only static review after implementation drift and readiness-document reconciliation.

> **Stop condition:** Operational readiness is still incomplete. The repository now contains substantial implementation, including vendor-pricing margin logic and quote creation from approved pricing, but production readiness still depends on live Settings, Apps Script deployment, website routing, Drive permissions, templates, manual smoke tests, and final payment/project policy decisions.

---

## 0.1 Dependency Governance Baseline

A governed dependency matrix exists at `docs/operational-readiness/DEPENDENCY_GOVERNANCE_MATRIX.md` and should remain the operational gate before additional workflow implementation.

The requested governance reference `docs/core-master-framework/00_RESTRUCTURE_MAP.md` is now present in the repository. It identifies the current phase as governance mapping and operational structuring, with execution refactor status still **NOT STARTED**. That means the framework map can be used for planning, but it does not authorize file movement, function renames, webhook changes, sheet-tab changes, deployment changes, or functional refactors.

---

## 1. Review Boundary and Governance Inputs

This assessment intentionally does **not** refactor execution files, move files, rename functions, modify workflow logic, change deployment configuration, or implement new features.

### Governance reference status

Observed repository governance inputs:

- Root `AGENTS.md` exists and describes the MIDTS staged workflow, security rules, Settings/database rules, ID standard, and Stage 0 expectations.
- `docs/core-master-framework/00_RESTRUCTURE_MAP.md` exists and states that governance mapping is active while execution restructuring has not started.
- `docs/00-core-framework/19_SYSTEM_BASELINE.md` exists and defines the current known-good architecture baseline before future operational scaling or controlled restructuring.
- The local Git branch name observed during this update is `work`.

### Assessment confidence

The assessment is based on static repository inspection. It does not verify the live Apps Script deployment, live Google Sheet contents, live Settings values, Google Drive folders, Brevo account state, Slack webhook validity, or separate website deployment.

---

## 2. Current Operational Stage Assessment

### Overall stage state

The repository has progressed beyond Stage 0 documentation-only scope and contains implementation files for Stage 1 through Stage 14-style workflows, including lead intake, qualification, reminder/nurture support, vendor assignment, vendor pricing, quote creation/delivery/acceptance, payment tracking, project creation, Drive access/logging, Brevo email, Slack alerts, dashboard access, website webhook routing, Step 2 technical requirement intake, file intake, file review automation, production lifecycle messaging, and operational preflight/readiness checks.

### Current production-readiness level

**Production-readiness level: Not yet production-proven / dependency-readiness and live verification required first.**

Reasoning:

1. The repository has substantial workflow code, including corrected vendor-pricing margin fields and quote generation from approved pricing, but live deployment behavior cannot be proven from source alone.
2. Several workflows depend on external live configuration that cannot be verified from the repository.
3. Vendor pricing schema and margin calculation are now implemented in code, but any existing live Sheet must be validated to confirm missing headers were appended safely and historical rows remain compatible.
4. Quote creation from approved vendor pricing is implemented, but quote document/PDF/template generation and customer-facing template dependencies are not production-ready.
5. Drive structure readiness depends on `ROOT_DRIVE_FOLDER_ID`, `FILE_INTAKE_ROOT_FOLDER_ID`, inherited Drive permissions, and live folder policy verification.
6. Logging coverage exists in many dedicated sheets, but central general/system audit coverage and transition-level observability remain incomplete.
7. Local test coverage consists mostly of Apps Script runner functions and manual/deployment checks rather than an automated local CI harness.
8. Runner functions may append or update Sheets, so broad workflow tests should be run only in a staging/test spreadsheet unless production mutation is explicitly accepted.

### Recommended operational classification

| Area | Status | Notes |
| --- | --- | --- |
| Stage 1 foundation | Mostly stable but settings-dependent | Settings, Error Logs, and ID Counters structures are present in code. |
| Website Step 1 intake | Backend implemented; live verification required | `doPost(e)` routing and `WebsiteWebhookService` exist; production depends on deployed `/exec` URL and token wiring. |
| Step 2 qualification | Implemented; dependency verification required | Step 2 payload handling, lead update, file-intake setup, and vendor-dispatch handoff exist; frontend fields and trigger expectations still need live confirmation. |
| Lead nurture/reminders | Implemented/testable; trigger readiness unknown | Reminder runners and scheduled processor code exist; live trigger schedule must be verified before production reliance. |
| Vendor assignment | Implemented; audit/runtime proof required | Vendor eligibility and dispatcher flows exist, including dedicated assignment logs; default vendor and email Settings must be verified. |
| Vendor pricing | Implemented in code; live Sheet validation required | Required schema, margin fields, final price, review gate, and quote linkage are implemented; live data/header compatibility must be checked. |
| Quote generation | Gated and price-governed in current code; template readiness incomplete | Approved pricing path uses final customer price from vendor pricing; quote documents/PDF/template dependencies remain unfinished. |
| Quote acceptance/delivery | Implemented/testable; live routing required | Acceptance URL/link and webhook payload tests exist; production website route and customer-facing template flow need verification. |
| Payment tracking | Implemented as lightweight tracking | Deposit/final payment rows, project payment summaries, and work-release gate exist; no external processor/reconciliation/receipt workflow is present. |
| Project creation | Implemented after accepted quote; payment policy undecided | Project creation requires an accepted quote and can create Drive folders when requested; decide whether payment should also hard-gate project creation. |
| Drive access | Implemented but high-risk live dependency | Folder creation, access grant/remove, and logging exist; live root folders, private inheritance, and vendor access policy need manual proof. |
| Email | Implemented but config/template-dependent | Brevo API/sender keys and form URLs are required; production template governance remains incomplete. |
| Slack alerts | Implemented but config-dependent | Webhook and logs exist; alert coverage should be mapped against every critical business transition. |
| Dashboard | Backend/admin visibility exists; browser smoke required | Dashboard entry points and setup validation exist; UI behavior and `google.script.run` calls need manual browser proof. |
| Operational preflight/readiness | Implemented; should be run before broad tests | Preflight/readiness runners exist to summarize required settings, sheets, dependencies, and row/log effects. |

---

## 3. Stable Components

The following components appear relatively stable from repository inspection, subject to live Apps Script/Sheets configuration.

### 3.1 Foundation bootstrap

- `runStage1Validation()` verifies Settings, Error Logs, and ID Counters sheet structures and checks required settings.
- `DatabaseService.ensureSheetAndHeaders_()` appends missing headers without deleting or reordering existing data.
- `UtilsService.createSequentialId_()` centralizes branded sequential MIDTS ID creation through the `ID Counters` sheet, with a timestamp fallback if the counter path fails.

### 3.2 Lead creation foundation

- `LeadService.createLead()` creates lead records with canonical MIDTS lead IDs.
- `LeadService.canLeadProceedToQuote()` provides qualification gating for downstream quote readiness.
- Lead sheet structure includes Step 1, Step 2, qualification, reminder/nurture, file-intake, and vendor-pricing status fields.

### 3.3 Website intake backend

- `doPost(e)` routes website Step 1, Step 2, file upload, vendor pricing, and quote acceptance submissions.
- `WebsiteWebhookService.handlePostEvent(e)` validates the webhook token, blocks honeypot submissions, creates leads, and writes `Website Webhook Logs` rows.
- Website integration examples exist under `website-integration/`, including a server-side route pattern to avoid exposing the Apps Script token in the browser.

### 3.4 Step 2 requirement intake

- `Step2RequirementService.handlePostEvent(e)` validates tokenized Step 2 payloads, updates matching leads, provisions file-intake setup when available, and writes `Step 2 Requirement Logs` rows.
- Step 2 can mark leads qualified and prepare them for downstream vendor pricing and quote gates.

### 3.5 Vendor pricing and quote gate

- `VendorPricingService.ensureVendorPricingSheetStructure()` now defines the required Vendor Pricing headers, including MIDTS margin fields, profit amount, final customer price, review status, quote ID, vendor name, and vendor email.
- `VendorPricingService.approveVendorPricingForQuote()` now validates submitted pricing, applies `FIXED` or `PERCENT` margin logic, writes MIDTS profit/final customer price, and marks the row `Approved for Quote`.
- `VendorPricingService.getApprovedPricingForLead()` returns only submitted vendor pricing rows approved for quote generation.
- `QuoteService.createQuoteFromApprovedPricing_()` requires qualified lead state, requires final customer price, writes quote metadata from approved pricing, and links the quote back to the Vendor Pricing row.

### 3.6 Payment and work-release tracking

- `PaymentService.ensurePaymentsSheetStructure()` creates fixed payment headers.
- `PaymentService.createPaymentRecord()` creates Deposit/Final payment rows and updates project payment summary fields.
- `PaymentService.canReleaseWork()` blocks delivery/work release until Deposit is `Received`.

### 3.7 Project creation and Drive support

- `ProjectService.createProjectFromQuote()` creates projects from accepted quotes, prevents duplicate projects per quote, updates lead project status, and optionally creates Drive folders.
- `DriveService` provides project folder creation, vendor access grant/removal checks, and Drive access logging.
- `DriveLogService` provides an additional broader Drive operational ledger.

### 3.8 Communication and alerts

- `EmailService` supports Brevo-backed emails and email logs.
- `SlackService` supports Slack webhook alerts and Slack logs.
- Production lifecycle messaging services exist for quote accepted, payment request, project started, file received, delivery ready, revision clarification, and unable-to-quote scenarios.

### 3.9 Dashboard and operational checks

- `doGet(e)` renders the Apps Script HTML Service dashboard.
- `getDashboardData()` and `createDashboardLead(input)` expose dashboard backend operations.
- `runOperationalReadinessPreflight()` and `runOperationalReadinessValidation()` provide broader readiness/preflight check surfaces.

---

## 4. Unstable or Incomplete Components

### 4.1 Live deployment state is unknown

The repository cannot prove:

- The active Apps Script Web App URL.
- The deployment access mode.
- The bound Google Sheet ID.
- Whether the live website posts to the intended `/exec` URL.
- Whether the live website token matches `WEBSITE_WEBHOOK_TOKEN`.
- Whether the Apps Script deployment includes the latest repository code.
- Whether browser-side `no-cors` masking has been removed from production website code.

### 4.2 Live Settings values are unknown

The code references required Settings keys, but repository source cannot prove that live Sheet/Script Property values are present, valid, and owned.

### 4.3 Vendor pricing is implemented but not live-proven

The current code implements the required Vendor Pricing schema, MIDTS margin calculation, final customer price, and quote linkage. Remaining risks are live-data risks:

- Existing live headers may need safe append-only reconciliation.
- Historical Vendor Pricing rows may lack newly added fields.
- Operators need a clear review process for applying margin before quote generation.
- Live runner evidence is needed to prove the end-to-end path in the target Sheet.

### 4.4 Quote pricing is improved but document generation is incomplete

The approved-pricing path is now price-governed, but production quote delivery still needs:

- Quote template/document/PDF ownership.
- Quote output folder policy.
- Customer-facing quote content review.
- Sent timestamp and PDF/document URL governance if formal document generation is required.

### 4.5 Payment/project sequence requires an explicit policy decision

The business process requires Payment before Project. Current code allows project creation after quote acceptance and uses payment status to block work release until deposit is received. This may be acceptable if `Project Created` means internal setup only, but it should be explicitly documented. If the business requires no project row before payment, `ProjectService.createProjectFromQuote()` needs a hard payment gate.

### 4.6 Payment integration is lightweight only

Payment tracking exists, but there is no external payment provider webhook, invoice system, reconciliation job, receipt template, or accounting integration.

### 4.7 Drive lifecycle needs live permission proof

Project folder creation and vendor access logging exist, but production readiness still depends on:

- Correct `ROOT_DRIVE_FOLDER_ID` and `FILE_INTAKE_ROOT_FOLDER_ID`.
- Private inherited permissions.
- Confirmed folder taxonomy.
- Customer/vendor/client folder separation policy.
- Evidence that files/folders are never shared publicly.

### 4.8 Template readiness is incomplete

The framework map still marks several email/document assets as To Prepare. Production readiness requires template ownership, IDs, merge fields, sample outputs, and approval status for quotes, NDAs, SOW/contracts, payment receipts, and project kickoff communications.

### 4.9 Logging/audit coverage is uneven

Dedicated logs exist for several workflows, including error, email, Slack, Drive, website webhook, Step 2, vendor pricing, vendor assignment, and quote acceptance. However, a central general/system audit log is still not clearly implemented as a single business transition ledger for:

- Lead status changes.
- Step 2 scoring/qualification decisions.
- Vendor assignment changes.
- Vendor pricing approval/rejection decisions.
- Quote creation and quote status transitions.
- Payment status transitions.
- Project creation and Drive folder creation.

### 4.10 Test coverage is runner-heavy, not CI-heavy

Apps Script runner functions exist, but there is no local Apps Script mock test suite or CI workflow. Many runners append or update test rows, so broad tests should be executed in staging or with explicit production-test approval.

---

## 5. Workflow-by-Workflow State

### 5.1 Website intake workflow

**Execution state:** Backend implemented; production wiring unproven.
**Implemented:**

- `doPost(e)` routes website form submissions.
- Step 1 website payloads are handled by `WebsiteWebhookService.handlePostEvent(e)`.
- Website webhook attempts are logged.
- Lead acknowledgement email is attempted for successful Step 1 intake.
- A Next.js server-side integration example exists under `website-integration/` to avoid exposing webhook token values in the browser.

**Incomplete/unstable:**

- Live website deployment cannot be verified from this repository.
- Current production wiring may depend on environment variables and deployment settings outside this repository.
- If acknowledgement email settings are missing, lead creation can succeed while email fails.
- Apps Script Web App deployment state is not represented in source.

**Blockers before production reliance:**

- Confirm `/exec` URL, token match, deployment access, and website-side server route deployment.
- Confirm Website Webhook Logs are populated in the live Sheet.
- Confirm browser receives readable JSON through the server-side route.

### 5.2 Step 2 qualification workflow

**Execution state:** Implemented; frontend/live dependencies unproven.
**Implemented:**

- Step 2 payloads are detected and routed from `doPost(e)`.
- Step 2 completion can mark a lead as qualified.
- Quote/vendor-pricing gates depend on qualification status and Step 2 completion timestamp.
- File intake setup and vendor assignment dispatch hooks are present.

**Incomplete/unstable:**

- Repository-owned frontend Step 2 form/template is not fully proven against live fields.
- Qualification/scoring model should be reviewed against actual business qualification criteria before production reliance.
- Lead nurture/reminder processing exists, but production trigger readiness is not established from source.

**Blockers before production reliance:**

- Confirm Step 2 form URL and fields.
- Confirm `STEP2_FORM_BASE_URL` is configured.
- Confirm trigger schedule for nurture/reminder processing, if it is intended to run automatically.

### 5.3 Vendor assignment workflow

**Execution state:** Implemented; live dispatch policy needs confirmation.
**Implemented:**

- Vendor eligibility fields exist on the Vendors sheet.
- Vendor assignment and dispatcher services exist.
- Dedicated Vendor Assignment Logs are present in code.
- Default vendor dispatch and email runners exist.

**Incomplete/unstable:**

- `AUTO_VENDOR_ASSIGNMENT_ENABLED`, `DEFAULT_VENDOR_ID_FOR_PRICING`, and vendor email Settings must be validated before live dispatch.
- Vendor assignment policy and escalation ownership need live-business confirmation.

### 5.4 Vendor pricing workflow

**Execution state:** Implemented in current code; live data/readiness proof required.
**Implemented:**

- Vendor pricing payload routing exists.
- Vendor pricing submission requires a qualified lead.
- Vendor pricing submissions are written to `Vendor Pricing`.
- Full required Vendor Pricing schema is represented in code.
- Vendor pricing can be approved with `FIXED` or `PERCENT` margin.
- MIDTS profit amount and final customer price are calculated and stored.
- Quote generation checks for newest submitted/approved vendor pricing.
- Quote ID can be linked back to the Vendor Pricing row.

**Incomplete/unstable:**

- Live Sheet headers and historical row compatibility must be validated.
- Operator procedure for applying margin and approval needs documentation.
- Live vendor pricing form URL and token routing must be verified.
- Vendor-facing templates and confidentiality controls are not fully production-ready.

**Blockers before production reliance:**

- Run vendor-pricing setup validation in the target Apps Script project.
- Confirm missing headers append safely in the live Sheet.
- Run a staging vendor-pricing workflow test.
- Confirm vendor never receives MIDTS margin/profit/final customer price.

### 5.5 Quote generation workflow

**Execution state:** Gated and price-governed in current code; document delivery readiness incomplete.
**Implemented:**

- Quote sheet structure exists.
- Quote creation requires qualified lead and approved vendor pricing in the approved-pricing path.
- Quote lifecycle status transitions are constrained.
- Approved vendor pricing with final customer price is used to create quotes.
- Vendor Pricing row can be linked back to the generated Quote ID.

**Incomplete/unstable:**

- Formal quote document/PDF generation template is not production-ready.
- Quote output folder and document URL governance require definition.
- Customer quote email/document content needs approval.
- Legacy/direct amount quote paths should be reviewed before production exposure to avoid bypassing pricing governance.

**Blockers before production reliance:**

- Confirm approved-pricing quote path is the only customer-facing production quote path.
- Prepare quote template/document/PDF dependencies.
- Run quote creation and quote status workflow tests in staging.

### 5.6 Quote acceptance and delivery workflow

**Execution state:** Implemented/testable; live route proof required.
**Implemented:**

- Quote acceptance link builder and delivery tests exist.
- Quote acceptance webhook payload service exists.
- Quote acceptance attempts have a dedicated log sheet in code.

**Incomplete/unstable:**

- Customer-facing quote acceptance URL must be confirmed.
- Production website route and token behavior must be tested live.
- Acceptance-triggered lifecycle emails need template/content approval.

### 5.7 Payment tracking workflow

**Execution state:** Lightweight tracking implemented.
**Implemented:**

- Payment sheet structure exists.
- Deposit and Final payment rows can be recorded.
- Payment status can be updated.
- Project payment summary fields can be refreshed.
- Work release is blocked until deposit is received.

**Incomplete/unstable:**

- No external payment processor, invoice system, reconciliation job, or receipt template is present.
- Payment state changes are not clearly mirrored to one central business audit log.
- Payment-before-project policy is not resolved at the code/business-rule level.

**Blockers before production reliance:**

- Confirm intended payment source of truth.
- Decide whether payment hard-gates project creation or only work release.
- Prepare payment receipt/invoice templates and any payment provider keys only if a provider is selected.

### 5.8 Project creation workflow

**Execution state:** Implemented after accepted quote; payment policy undecided.
**Implemented:**

- Project creation requires quote ID.
- Quote must be accepted.
- Lead ID and Vendor ID must be present.
- Duplicate project creation for the same quote is blocked.
- Project receives canonical MIDTS project ID.
- Drive folder creation is available when explicitly requested.

**Incomplete/unstable:**

- Payment is not currently a hard gate before project creation.
- Folder creation is optional, not a mandatory project-creation side effect.
- Project creation is not clearly mirrored to a central system audit log.

**Blockers before production reliance:**

- Confirm whether project rows may be created before deposit payment.
- Prepare project folder/access orchestration rules before enabling live project execution.

### 5.9 Drive structure readiness

**Execution state:** Partially implemented, live readiness unknown.
**Implemented:**

- Project folder creation under configured root folder.
- Vendor access grant/removal with eligibility checks.
- Drive access logging and broader Drive logs.

**Missing/unknown:**

- Live root folder IDs.
- Standard subfolder taxonomy.
- Folder naming convention approval.
- Customer/vendor/client folder separation policy encoded as checks.
- Evidence that inherited permissions are private and non-public.

### 5.10 Settings sheet readiness

**Execution state:** Incomplete for full production.
**Implemented required settings list includes:**

- `BREVO_API_KEY`
- `SLACK_WEBHOOK_URL`
- `ROOT_DRIVE_FOLDER_ID`
- `WEBSITE_WEBHOOK_TOKEN`
- `STEP2_FORM_BASE_URL`
- `FILE_INTAKE_ROOT_FOLDER_ID`
- `VENDOR_PRICING_FORM_BASE_URL`
- `QUOTE_ACCEPTANCE_FORM_BASE_URL`
- `AUTO_VENDOR_ASSIGNMENT_ENABLED`
- `DEFAULT_VENDOR_ID_FOR_PRICING`

**Additional settings referenced by services/tests include:**

- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `TEST_EMAIL_RECIPIENT`
- `TEST_VENDOR_EMAIL`

**Missing likely production settings or dependencies:**

- Quote template/document ID.
- Quote output folder ID.
- Payment receipt/invoice template ID.
- Project kickoff template ID.
- Admin/operations notification recipient.
- Payment provider keys, only if payment provider integration is selected.

### 5.11 Logging and observability readiness

**Execution state:** Partially implemented.
**Implemented logs include:**

- `Error Logs`
- `Email Logs`
- `Slack Logs`
- `Drive Access Logs`
- `Drive Logs`
- `Website Webhook Logs`
- `Step 2 Requirement Logs`
- `Vendor Pricing Logs`
- `Vendor Assignment Logs`
- `Quote Acceptance Logs`
- File intake/review logs as implemented by file services

**Missing/weak coverage:**

- A central General/System Logs sheet is defined in ID standards but not clearly implemented as a single business transition ledger.
- Lead lifecycle transitions are not consistently logged to one central audit view.
- Vendor pricing approval/rejection, quote transitions, payment transitions, project creation, and Drive folder creation should be mapped to required audit destinations.

### 5.12 Test coverage readiness

**Execution state:** Manual/runner-test coverage exists; automated CI readiness is low.
**Present:**

- Stage runner/test functions in Apps Script files for foundation, lead capture, qualification, vendor pricing, quotes, payment, Drive, email, Slack, dashboard, website webhook payloads, Step 2, file intake, quote acceptance, operational readiness, and production lifecycle smoke/dry-runs.
- Website diagnostic markdown and Next.js integration examples.

**Missing/weak:**

- No package-level automated test harness.
- No local Apps Script mock test suite.
- No CI workflow configuration.
- Tests can mutate live Sheets by appending/updating test records.
- External tests require live Brevo, Slack, Drive, Apps Script, and website deployment state.

---

## 6. Missing Dependencies

### 6.1 Repository/documentation dependencies

- Operational readiness documentation must be kept synchronized with current code after every substantial workflow change.
- A current deployment manifest should map Apps Script deployment ID, Sheet ID, Drive root IDs, website URL, and environment ownership without exposing secrets.
- A single readiness checklist should identify which runners are safe setup checks and which mutate data or call external services.

### 6.2 External service dependencies

- Apps Script Web App deployment URL and access mode.
- Google Sheet bound to the Apps Script project.
- Google Drive root folders and permission model.
- Brevo API key, sender email, sender name, verified sender/domain, and approved templates/content.
- Slack webhook URL and target channel ownership.
- Website deployment that forwards forms through a server-side route or secure equivalent.
- Optional payment provider/invoice system, if later required.

### 6.3 Trigger dependencies

- Lead nurture/reminder trigger schedule, if reminders are intended to run automatically.
- Any scheduled audit/retry jobs for webhook, email, Slack, payment status, file review, or lifecycle messaging.

---

## 7. Missing Templates/Documents

The repository does not currently contain fully governed production templates for:

1. Customer quote document/PDF.
2. Vendor pricing request document/form template beyond inline email and external website route guidance.
3. Payment receipt/invoice confirmation.
4. Project kickoff/customer confirmation.
5. Internal admin readiness checklist.
6. Drive folder taxonomy / folder README template.
7. Vendor NDA/ID verification evidence tracking document.
8. Customer SOW/contract package, if required before quote acceptance or project start.

---

## 8. Settings Readiness Checklist

### 8.1 Required keys for current code paths

These must be present in Settings or Script Properties before the associated workflows can be relied on:

| Key | Required for | Verification method | Status from repo |
| --- | --- | --- | --- |
| `BREVO_API_KEY` | Brevo email sends | Stage 7 email setup/test; controlled test recipient | Referenced; live value unknown |
| `BREVO_SENDER_EMAIL` | Brevo sender identity | Stage 7 email setup/test | Referenced; live value unknown |
| `BREVO_SENDER_NAME` | Brevo sender identity | Stage 7 email setup/test | Referenced; live value unknown |
| `SLACK_WEBHOOK_URL` | Slack alerts | Stage 8 Slack setup/test | Referenced; live value unknown |
| `ROOT_DRIVE_FOLDER_ID` | Project Drive folders/access | Stage 6 Drive setup/test plus manual Drive inspection | Referenced; live value unknown |
| `FILE_INTAKE_ROOT_FOLDER_ID` | Step 2 file intake | Stage 12 file intake setup/payload tests plus Drive inspection | Referenced; live value unknown |
| `WEBSITE_WEBHOOK_TOKEN` | Public webhooks | Stage 10/11 payload tests and live website smoke | Referenced; live value unknown |
| `STEP2_FORM_BASE_URL` | Lead acknowledgement/Step 2 link | Email/link tests and manual URL click | Referenced; live value unknown |
| `VENDOR_PRICING_FORM_BASE_URL` | Vendor pricing email/link | Vendor assignment/pricing email tests | Referenced; live value unknown |
| `QUOTE_ACCEPTANCE_FORM_BASE_URL` | Quote acceptance link | Quote delivery/acceptance link tests | Referenced; live value unknown |
| `AUTO_VENDOR_ASSIGNMENT_ENABLED` | Automatic post-Step-2 dispatch | Dispatcher setup and dry-run review | Referenced; live value unknown |
| `DEFAULT_VENDOR_ID_FOR_PRICING` | Default vendor assignment | Dispatcher setup and vendor row inspection | Referenced; live value unknown |
| `TEST_EMAIL_RECIPIENT` | Controlled email tests | Stage 7 email test | Referenced; live value unknown |
| `TEST_VENDOR_EMAIL` | Controlled vendor email tests | Vendor assignment/pricing email test | Referenced; live value unknown |

### 8.2 Keys/dependencies needed before future production quote/payment/project execution

Do not implement these without the dependency preparation stage, but reserve them in readiness planning:

- `QUOTE_TEMPLATE_ID` or equivalent quote document template key.
- `QUOTE_OUTPUT_FOLDER_ID` or documented use of an existing controlled folder.
- `PAYMENT_RECEIPT_TEMPLATE_ID` or invoice/receipt template key.
- `PROJECT_KICKOFF_TEMPLATE_ID`.
- `PROJECT_OUTPUT_FOLDER_ID` or documented use of `ROOT_DRIVE_FOLDER_ID`.
- `ADMIN_EMAIL` or operational owner notification target.
- Payment provider keys, only if/when a provider is selected.

---

## 9. Current Blockers

1. Live Settings values cannot be proven from repository.
2. Live Apps Script deployment URL, access mode, and bound Sheet cannot be proven from repository.
3. Live website deployment and webhook wiring cannot be proven from repository.
4. Live Drive root folders, private inheritance, and folder taxonomy are unverified.
5. Production communication/template readiness is incomplete.
6. Quote document/PDF/output-folder governance is incomplete.
7. Payment provider/invoice/reconciliation/receipt workflow is not implemented.
8. Payment-before-project business rule is undecided: current code allows project creation after quote acceptance while blocking work release until deposit is received.
9. Central general/system audit log coverage is absent or not clearly mapped.
10. Test coverage is not automated and may mutate live Sheets.
11. Dashboard browser behavior and `google.script.run` behavior need manual smoke proof.
12. Deployment/manifest/clasp behavior requires manual checklist verification.

---

## 10. Recommended Next Implementation Priority

Because operational readiness is incomplete, **do not proceed with new feature implementation yet**.

Recommended priority:

1. Run safe setup validations in the intended Apps Script/staging environment before broad workflow tests.
2. Verify required Settings values and external service ownership.
3. Verify live website-to-Apps-Script routing using a staging or controlled test form submission.
4. Validate live Sheet headers, especially `Vendor Pricing`, `Quotes`, `Projects`, `Payments`, and log sheets.
5. Decide and document the payment-before-project policy.
6. Prepare quote/payment/project/vendor templates and document IDs before customer-facing document automation.
7. Define a central business-transition audit matrix before adding more workflow automation.
8. Only after the readiness checklist passes, implement the smallest next approved runtime change.

---

## 11. Clear Next-Step Checklist

### 11.1 Repository/documentation checklist

- [x] Confirm `docs/core-master-framework/00_RESTRUCTURE_MAP.md` exists.
- [x] Reconcile this assessment with current vendor-pricing margin and quote-pricing code.
- [ ] Create or update a deployment manifest that records non-secret environment ownership: Apps Script project, deployment URL owner, Sheet owner, Drive root owner, website route owner, Brevo owner, and Slack owner.
- [ ] Create a one-page runner safety matrix separating setup-only checks, data-mutating tests, and external-send/share tests.
- [ ] Create a central audit matrix listing every business state transition and required log destination.

### 11.2 Safe Apps Script setup validations to run first

Run these in the intended Apps Script project before any broad workflow tests:

- [ ] `runStage1Validation()`
- [ ] `runStage3QuoteSetupValidation()`
- [ ] `runStage45VendorPricingSetupValidation()`
- [ ] `runStage5PaymentSetupValidation()`
- [ ] `runStage6DriveSetupValidation()`
- [ ] `runStage7EmailSetupValidation()`
- [ ] `runStage8SlackSetupValidation()`
- [ ] `runStage9DashboardSetupValidation()`
- [ ] `runStage10WebsiteWebhookSetupValidation()`
- [ ] `runStage11Step2RequirementSetupTest()`
- [ ] `runOperationalReadinessPreflight()`

### 11.3 Controlled staging workflow tests to run after setup validations

Run these only in staging/test Sheets or with explicit approval because they may append/update records or call external services:

- [ ] `runStage2LeadCaptureTest()`
- [ ] `runStage2NurtureQualificationTest()`
- [ ] `runStage10WebsiteWebhookPayloadTest()`
- [ ] `runStage11Step2RequirementPayloadTest()`
- [ ] `runStage45VendorPricingWorkflowTest()`
- [ ] `runStage45VendorPricingWebhookPayloadTest()`
- [ ] `runStage45VendorAssignmentEmailTest()` with controlled recipient
- [ ] `runStage3QuoteCreationTest()`
- [ ] `runStage3QuoteStatusWorkflowTest()`
- [ ] `runStage5PaymentTrackingTest()`
- [ ] `runStage6DriveAccessWorkflowTest()` only after Drive folder/permission policy is confirmed
- [ ] `runStage7BrevoEmailTest()` with controlled recipient
- [ ] `runStage8SlackAlertTest()` with approved Slack target
- [ ] `runStage35QuoteAcceptanceWebhookPayloadTest()`
- [ ] `runCommercialWorkflowSmokeTest()` only in a staging environment
- [ ] `runOperationalReadinessValidation()` only after reviewing mutation/external-send behavior

### 11.4 Live environment checks

- [ ] Confirm the active Apps Script Web App `/exec` URL.
- [ ] Confirm deployment access mode and latest code version.
- [ ] Confirm the bound Sheet ID and owner.
- [ ] Confirm all required Settings values exist and are non-placeholder.
- [ ] Confirm the website server-side route posts to the intended Apps Script URL.
- [ ] Submit one controlled Step 1 test enquiry through the website route.
- [ ] Confirm `Leads` and `Website Webhook Logs` rows are written.
- [ ] Submit one controlled Step 2 test payload through the intended route.
- [ ] Confirm `Leads`, `Step 2 Requirement Logs`, file-intake fields, and vendor-dispatch behavior.
- [ ] Confirm vendor pricing form route can submit a test payload and writes `Vendor Pricing` / `Vendor Pricing Logs`.
- [ ] Confirm dashboard renders in browser and `google.script.run` calls complete.

### 11.5 Business decisions required before next code change

- [ ] Decide whether project creation is allowed after quote acceptance before deposit, with work release blocked until deposit.
- [ ] Decide whether a received deposit should be a hard gate before `ProjectService.createProjectFromQuote()` can create a project row.
- [ ] Approve the operator process for applying MIDTS margin to vendor pricing.
- [ ] Approve whether legacy/direct amount quote paths remain callable in production.
- [ ] Approve quote, payment, and project communication templates.
- [ ] Approve Drive folder taxonomy and sharing policy.

---

## 12. Risk Assessment Before Further Execution Work

| Risk | Severity | Likelihood | Notes | Mitigation |
| --- | --- | --- | --- | --- |
| Live website not reaching Apps Script | High | Medium | Backend code exists, but live deployment is external. | Verify `/exec`, token, and server-side route. |
| Live Settings missing or placeholder | High | High | Required runtime keys cannot be proven from repo. | Run setup validations and manually inspect Settings. |
| Vendor pricing live schema drift | High | Medium | Code now has required headers, but live Sheet may have older rows/headers. | Run setup validation; inspect appended headers and historical row behavior. |
| Quote/document mismatch | High | Medium | Quote amount path is improved, but customer documents/templates remain incomplete. | Prepare quote template and output-folder governance before production quote delivery. |
| Payment/project sequence mismatch | High | Medium | Current project creation is quote-acceptance gated, not payment-gated. | Decide and document policy before changing project/payment code. |
| Uncontrolled Drive sharing | Critical | Medium | Access checks exist, but live root/folder inheritance is unknown. | Verify root folders and private permission inheritance before sharing. |
| Insufficient central audit trail | High | Medium | Dedicated logs exist, but one business-transition ledger is not mapped. | Define audit matrix before workflow expansion. |
| Tests mutate production data | Medium | High | Runner functions append/update Sheets. | Use dedicated staging Sheet/environment before broad tests. |
| Dashboard UI drift | Medium | Medium | Backend setup validation exists, but browser behavior is manual. | Run browser smoke test before relying on dashboard operations. |

---

## 13. Final Assessment

The MIDTS Automation Engine repository now contains significant implementation beyond the original documentation-only stage. Important previously listed blockers have been resolved in current code: the core framework map exists, the Vendor Pricing schema includes MIDTS margin/final-price fields, margin calculation is implemented, approved vendor pricing can be used to create quotes, and Quote IDs can be linked back to Vendor Pricing rows.

However, the system is **not yet production-proven**. The immediate next step should be readiness verification, not new feature work. In particular, verify live Settings, Apps Script deployment, website routing, Sheet headers, Drive permissions, Brevo/Slack configuration, dashboard browser behavior, and template readiness. Then decide the payment-before-project policy and central audit approach before making the next runtime change.
