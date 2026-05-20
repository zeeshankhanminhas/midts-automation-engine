# MIDTS Automation Engine - Core Master Framework Map

Stage: 1 - Identification and Mapping Only

This document maps the current active production-stage Apps Script repository into a governance-first Core Master Framework. It is intentionally documentation-only. It does not recommend moving, renaming, deleting, or rewriting working code in this phase.

## Non-Destructive Scope

- No code restructuring has been performed.
- No Apps Script execution flow has been changed.
- No webhook behavior has been changed.
- No sheet structures have been changed.
- No deployment logic has been changed.
- The framework locations below are future architectural destinations only.

## Current Repository Structure

```text
.clasp.json
.gitkeep
AGENTS.md
ClientJS.html
Code.js
CodeStage10.js
CodeStage45VendorPricing.js
CodeStage5.js
CodeStage6.js
CodeStage7.js
CodeStage8.js
CodeStage9.js
Config.js
DashboardService.js
DatabaseService.js
DriveService.js
EmailService.js
ErrorLogger.js
Index.html
LeadService.js
PaymentService.js
ProjectService.js
QuoteService.js
SlackService.js
Step2RequirementService.js
Styles.html
Utils.js
VendorPricingService.js
VendorService.js
WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md
WebsiteWebhookService.js
appsscript.json
docs/operational-readiness/CURRENT_OPERATIONAL_STATE_ASSESSMENT.md
docs/operational-readiness/DEPENDENCY_GOVERNANCE_MATRIX
docs/operational-readiness/DEPENDENCY_GOVERNANCE_MATRIX.md
website-integration/README.md
website-integration/app/api/enquiry/route.ts
website-integration/components/EnquiryForm-submit-handler.example.tsx
```

## Core Framework Layers

| Layer | Purpose | Current primary components |
|---|---|---|
| 1. Intake Layer | Capture new leads and public form submissions | `LeadService.js`, `WebsiteWebhookService.js`, `CodeStage10.js`, dashboard lead wrapper |
| 2. Qualification Layer | Move leads from pending to qualified and score readiness | `Step2RequirementService.js`, `LeadService.markStep2Completed`, reminder/qualification runners |
| 3. Communication Layer | External and internal notifications | `EmailService.js`, `SlackService.js`, Stage 7/8 runners |
| 4. Vendor Pricing Layer | Vendor assignment, vendor pricing, pricing approval | `VendorService.js`, `VendorPricingService.js`, `CodeStage45VendorPricing.js` |
| 5. Quote Layer | Customer quote creation and quote lifecycle | `QuoteService.js`, quote runners in `Code.js` |
| 6. Project Execution Layer | Project creation, payment tracking, Drive project folder access | `ProjectService.js`, `PaymentService.js`, `DriveService.js`, Stage 5/6 runners |
| 7. Audit & Governance Layer | Error logs, webhook logs, email logs, Slack logs, Drive access logs, dashboard visibility | `ErrorLogger.js`, audit functions in services, `DashboardService.js`, operational docs |
| 8. Intelligence Layer (future) | Scoring strategy, analytics, AI governance, decision support | No dedicated service yet; current seeds exist in lead score and dashboard metrics |
| 9. Config & Utilities Layer | Settings, deployment config, sheet bootstrap, IDs, Apps Script manifest | `Config.js`, `DatabaseService.js`, `Utils.js`, `.clasp.json`, `appsscript.json` |
| 10. Testing & Validation Layer | Stage runners, setup validation, payload tests, workflow tests | `Code.js`, `CodeStage*.js`, diagnostic docs |

## Current Services

| Service/File | Current responsibility | Current dependencies | Risk if modified | Future framework location | Classification |
|---|---|---|---|---|---|
| `LeadService.js` | Creates leads, validates lead inputs, manages Step 2 completion, reminder state, quote eligibility, sanitized vendor lead snapshots | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, `SpreadsheetApp` | High: core lead lifecycle and quote gating depend on it | `01-intake` and `02-qualification` | operational core |
| `WebsiteWebhookService.js` | Public Step 1 website webhook intake, token validation, honeypot suppression, payload parsing, lead normalization, webhook audit logging | `LeadService`, `DatabaseService`, `ConfigService`, `ErrorLogger`, `PropertiesService` | High: public lead intake and audit logs depend on it | `01-intake` and `07-audit-governance` | operational core |
| `Step2RequirementService.js` | Public Step 2 technical requirement intake, scoring, lead qualification, Step 2 audit logging | `WebsiteWebhookService`, `LeadService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | High: qualification and downstream quote gating depend on it | `02-qualification` | operational core |
| `VendorService.js` | Validates vendor eligibility, assigns vendors to qualified leads, sends sanitized vendor pricing request emails | `DatabaseService`, `LeadService`, `EmailService`, `ConfigService`, `ErrorLogger` | High: vendor assignment and project prerequisites depend on it | `04-vendor-pricing` | operational core |
| `VendorPricingService.js` | Receives vendor pricing webhook submissions, stores pricing, logs vendor pricing attempts, approves vendor pricing for quotes, exposes quote gate helper | `WebsiteWebhookService`, `LeadService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | High: quote creation is blocked until approved vendor pricing exists | `04-vendor-pricing` | operational core |
| `QuoteService.js` | Creates quotes only for qualified leads with approved vendor pricing; manages quote status transitions and quote snapshots | `LeadService`, `VendorPricingService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | High: commercial quote lifecycle and project/payment gates depend on it | `05-quotes` | operational core |
| `ProjectService.js` | Creates projects from qualified lead, eligible vendor, and accepted quote | `LeadService`, `VendorService`, `QuoteService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | High: accepted work execution depends on it; currently also triggers vendor assignment gate | `06-projects` | operational core |
| `PaymentService.js` | Creates payment records only for accepted quotes; marks payments paid/part paid | `QuoteService`, `LeadService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | Medium-high: financial lifecycle tracking depends on it | `06-projects` or future finance layer | operational core |
| `DriveService.js` | Creates project Drive folders, grants/removes vendor access, logs Drive access events | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, `DriveApp` | High: external file access and security governance depend on it | `06-projects` and `07-audit-governance` | governance |
| `EmailService.js` | Sends Brevo transactional emails, lead Step 2 emails, vendor pricing request emails, logs email attempts | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, `UrlFetchApp` | High: client/vendor communication depends on it | `03-communication` | operational core |
| `SlackService.js` | Sends internal Slack alerts and logs alert attempts | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, `UrlFetchApp` | Medium: internal notifications depend on it | `03-communication` | infrastructure |
| `DashboardService.js` | Provides HTML Service dashboard metrics/recent rows and dashboard lead creation wrapper | `LeadService`, `DatabaseService`, `ConfigService`, `PaymentService`, `DriveService`, `EmailService`, `SlackService`, `ErrorLogger` | Medium: admin visibility and manual lead entry depend on it | `07-audit-governance` | governance |
| `DatabaseService.js` | Ensures sheet tabs and headers, preserves existing data, reads Settings map | `ConfigService`, `SpreadsheetApp` | Very high: every sheet-backed service depends on it | `09-config-utilities` | infrastructure |
| `Config.js` | Centralizes sheet names and required Settings keys; validates required settings; reads Script Properties | `DatabaseService`, `PropertiesService` | Very high: system settings and required-key discovery depend on it | `09-config-utilities` | infrastructure |
| `Utils.js` | Generates branded sequential IDs using ID Counters with lock protection and fallback IDs | `DatabaseService`, `ConfigService`, `LockService` | High: ID creation and audit traceability depend on it | `09-config-utilities` | utility |
| `ErrorLogger.js` | Logs unexpected failures to `Error Logs` | `DatabaseService`, `ConfigService`, `UtilsService`, `SpreadsheetApp` | High: operational debugging depends on it | `07-audit-governance` | governance |

## Current Workflow Stages

| Stage | Current implementation | Description | Framework layer |
|---|---|---|---|
| Stage 1 | `Code.js`, `Config.js`, `DatabaseService.js`, `Utils.js`, `ErrorLogger.js` | Foundation bootstrap, settings, headers, IDs, error logging | 9 and 10 |
| Stage 2 | `Code.js`, `LeadService.js` | Lead capture, nurture defaults, reminder state, qualification gate seed | 1 and 2 |
| Stage 3 | `Code.js`, `QuoteService.js` | Quote creation and status lifecycle | 5 |
| Stage 4 | `Code.js`, `VendorService.js`, `ProjectService.js` | Vendor eligibility and project creation | 4 and 6 |
| Stage 4.5 | `CodeStage45VendorPricing.js`, `VendorPricingService.js` | Vendor pricing prerequisite before quote creation | 4 |
| Stage 5 | `CodeStage5.js`, `PaymentService.js` | Payment tracking after quote acceptance | 6 |
| Stage 6 | `CodeStage6.js`, `DriveService.js` | Controlled Drive folder creation/access lifecycle | 6 and 7 |
| Stage 7 | `CodeStage7.js`, `EmailService.js` | Brevo email setup and test emails | 3 |
| Stage 8 | `CodeStage8.js`, `SlackService.js` | Slack alert setup and test alerts | 3 |
| Stage 9 | `CodeStage9.js`, `DashboardService.js`, HTML files | Apps Script HTML Service admin dashboard | 7 |
| Stage 10 | `CodeStage10.js`, `WebsiteWebhookService.js` | Public Step 1 website webhook intake | 1 |
| Stage 11 | `CodeStage10.js`, `Step2RequirementService.js` | Public Step 2 technical requirement webhook intake | 2 |

## Current Apps Script Entry Points and Runners

### Live Entry Points

| Function | File | Responsibility | Risk |
|---|---|---|---|
| `doPost(e)` | `CodeStage10.js` | Public webhook router for Step 1, Step 2, and vendor pricing submissions | Very high |
| `doGet(e)` | `CodeStage9.js` | Renders Apps Script admin dashboard | Medium |
| `include(filename)` | `CodeStage9.js` | Includes HTML partials for dashboard | Low-medium |
| `getDashboardData()` | `CodeStage9.js` | Dashboard backend wrapper | Medium |
| `createDashboardLead(input)` | `CodeStage9.js` | Dashboard manual lead creation wrapper | Medium-high |

### Validation and Workflow Runners

| Runner | File | Purpose | Framework layer |
|---|---|---|---|
| `runStage1Validation` | `Code.js` | Foundation sheet/settings validation | 10 |
| `runStage1SmokeTest` | `Code.js` | Foundation ID/log smoke test | 10 |
| `runStage2LeadCaptureTest` | `Code.js` | Lead capture test | 1 and 10 |
| `runStage2NurtureQualificationTest` | `Code.js` | Qualification update test | 2 and 10 |
| `runReminderAuditProofTest` | `Code.js` | Reminder audit snapshot proof | 7 and 10 |
| `runReminderStatusUpdateTest` | `Code.js` | Reminder status persistence test | 2 and 10 |
| `testStage2NurtureDefaults` | `Code.js` | Lead default field assertion test | 2 and 10 |
| `runStage2ReminderProcessingTest` | `Code.js` | Reminder due processing test | 2 and 10 |
| `runQuoteGatingTest` | `Code.js` | Quote eligibility gate test | 5 and 10 |
| `runStage3QuoteCreationTest` | `Code.js` | Quote creation blocked/allowed test | 5 and 10 |
| `runStage3QuoteSetupValidation` | `Code.js` | Quote sheet setup validation | 5 and 10 |
| `runStage3QuoteStatusWorkflowTest` | `Code.js` | Quote lifecycle transition test | 5 and 10 |
| `runStage4VendorEligibilityTest` | `Code.js` | Vendor eligibility gate test | 4 and 10 |
| `runStage4ProjectCreationTest` | `Code.js` | Project creation workflow test | 6 and 10 |
| `runStage45VendorPricingSetupValidation` | `CodeStage45VendorPricing.js` | Vendor pricing workflow sheets validation | 4 and 10 |
| `runStage45VendorPricingWorkflowTest` | `CodeStage45VendorPricing.js` | Qualified lead to vendor pricing to quote test | 4/5 and 10 |
| `runStage45VendorPricingWebhookPayloadTest` | `CodeStage45VendorPricing.js` | Public vendor pricing webhook payload test | 4 and 10 |
| `runStage45VendorAssignmentEmailTest` | `CodeStage45VendorPricing.js` | Vendor assignment email test | 3/4 and 10 |
| `runStage5PaymentSetupValidation` | `CodeStage5.js` | Payment sheet setup validation | 6 and 10 |
| `runStage5PaymentTrackingTest` | `CodeStage5.js` | Accepted quote payment tracking test | 6 and 10 |
| `runStage6DriveSetupValidation` | `CodeStage6.js` | Drive access log/project metadata validation | 6/7 and 10 |
| `runStage6DriveAccessWorkflowTest` | `CodeStage6.js` | Drive folder grant/remove workflow test | 6/7 and 10 |
| `runStage7EmailSetupValidation` | `CodeStage7.js` | Email logs setup validation | 3/7 and 10 |
| `runStage7BrevoEmailTest` | `CodeStage7.js` | Brevo controlled test email | 3 and 10 |
| `runStage8SlackSetupValidation` | `CodeStage8.js` | Slack logs setup validation | 3/7 and 10 |
| `runStage8SlackAlertTest` | `CodeStage8.js` | Slack controlled test alert | 3 and 10 |
| `runStage9DashboardSetupValidation` | `CodeStage9.js` | Dashboard data load validation | 7 and 10 |
| `runStage10WebsiteWebhookSetupValidation` | `CodeStage10.js` | Website webhook setup validation | 1/7 and 10 |
| `runStage10WebsiteWebhookLogSetupTest` | `CodeStage10.js` | Website webhook log sheet proof | 7 and 10 |
| `runStage10WebsiteWebhookPayloadTest` | `CodeStage10.js` | Step 1 payload and acknowledgement email test | 1/3 and 10 |
| `runStage11Step2RequirementSetupTest` | `CodeStage10.js` | Step 2 setup validation | 2/7 and 10 |
| `runStage11Step2RequirementPayloadTest` | `CodeStage10.js` | Step 2 payload qualification test | 2 and 10 |

## Existing Sheet Dependencies

| Sheet | Owner/service | Purpose | Risk if structure changes |
|---|---|---|---|
| `Settings` | `DatabaseService`, `ConfigService` | Key-value configuration | Very high |
| `Error Logs` | `ErrorLogger` | Unexpected failure audit | High |
| `ID Counters` | `UtilsService` | Sequential branded ID counters | High |
| `Leads` | `LeadService`, webhooks, dashboard | Lead lifecycle, qualification, reminders | Very high |
| `Quotes` | `QuoteService` | Quote lifecycle records | High |
| `Vendors` | `VendorService`, `DriveService` | Vendor eligibility, assignment state, email | High |
| `Projects` | `ProjectService`, `DriveService` | Project lifecycle and Drive folder metadata | High |
| `Payments` | `PaymentService` | Quote-linked payment tracking | Medium-high |
| `Website Webhook Logs` | `WebsiteWebhookService` | Step 1 webhook audit and troubleshooting | High for diagnostics |
| `Step 2 Requirement Logs` | `Step2RequirementService` | Step 2 intake/qualification audit | High for diagnostics |
| `Vendor Pricing` | `VendorPricingService` | Vendor costs and MIDTS review state | Very high |
| `Vendor Pricing Logs` | `VendorPricingService` | Public vendor pricing webhook audit | High for diagnostics |
| `Email Logs` | `EmailService` | Brevo send audit | High for communication governance |
| `Slack Logs` | `SlackService` | Slack alert audit | Medium |
| `Drive Access Logs` | `DriveService` | Folder access grant/remove audit | Very high for access governance |

## Existing Settings Dependencies

| Key | Current consumers | Purpose |
|---|---|---|
| `BREVO_API_KEY` | `EmailService` | Brevo transactional email API access |
| `BREVO_SENDER_EMAIL` | `EmailService` | Verified sender email |
| `BREVO_SENDER_NAME` | `EmailService` | Sender display name |
| `SLACK_WEBHOOK_URL` | `SlackService` | Internal Slack alerts |
| `ROOT_DRIVE_FOLDER_ID` | `DriveService` | Root folder for project folders |
| `WEBSITE_WEBHOOK_TOKEN` | `WebsiteWebhookService`, `Step2RequirementService`, `VendorPricingService` | Public POST shared token |
| `STEP2_FORM_BASE_URL` | `EmailService` | Client Step 2 link generation |
| `VENDOR_PRICING_FORM_BASE_URL` | `EmailService` | Vendor pricing link generation |
| `TEST_EMAIL_RECIPIENT` | `EmailService`, `CodeStage45VendorPricing.js` | Controlled email tests |
| `TEST_VENDOR_EMAIL` | `DriveService`, `CodeStage6.js` | Controlled Drive access tests |

## Existing Webhook Dependencies

| Webhook path | Entry point | Router condition | Downstream service | Token | Audit sheet |
|---|---|---|---|---|---|
| Website Step 1 lead intake | `doPost(e)` | Default route when not Step 2 or vendor pricing | `WebsiteWebhookService.handlePostEvent` | `WEBSITE_WEBHOOK_TOKEN` | `Website Webhook Logs` |
| Client Step 2 requirement intake | `doPost(e)` | `formStage` aliases: `step2`, `step_2`, `technical_requirement`, `requirements` | `Step2RequirementService.handlePostEvent` | `WEBSITE_WEBHOOK_TOKEN` | `Step 2 Requirement Logs` |
| Vendor pricing intake | `doPost(e)` | `formStage` aliases: `vendorPricing`, `vendor_pricing`, `vendor-pricing`, `pricing`, `vendor_price` | `VendorPricingService.handlePostEvent` | `WEBSITE_WEBHOOK_TOKEN` | `Vendor Pricing Logs` |

## Existing Audit Systems

| Audit system | Owner | Logged events | Governance role |
|---|---|---|---|
| Error Logs | `ErrorLogger` | Unexpected function failures and context JSON | Operational incident trace |
| Website Webhook Logs | `WebsiteWebhookService` | Parse, token, honeypot, lead creation, email status | Intake traceability |
| Step 2 Requirement Logs | `Step2RequirementService` | Parse, token, qualification, scoring outcome | Qualification traceability |
| Vendor Pricing Logs | `VendorPricingService` | Parse, token, vendor pricing submission result | Vendor quote traceability |
| Email Logs | `EmailService` | Recipient, subject, template key, Brevo result, message ID | Communication audit |
| Slack Logs | `SlackService` | Alert type, result, HTTP status, notes | Internal alert audit |
| Drive Access Logs | `DriveService` | Folder create, access grant, access removal | Security/access audit |
| Dashboard summary | `DashboardService` | Read-only operational metrics and recent rows | Management visibility |

## Existing Gatekeeping Logic

| Gate | Enforced by | Rule | Downstream protected action |
|---|---|---|---|
| Required lead fields | `LeadService.validateLeadInput_` | Full name, valid email, company, project type required | Lead creation |
| Webhook token | `WebsiteWebhookService.validateWebhookToken_` | Submitted token must match configured token | All public POST routes |
| Honeypot | `WebsiteWebhookService.isHoneypotFilled_` | Filled honeypot is ignored without creating a lead | Step 1 public intake |
| Step 2 completion | `LeadService.canLeadProceedToQuote` | Qualification Status = `Qualified` and Step 2 Completed At is Date | Vendor assignment, vendor pricing, quote, project |
| Lead score/high value | `Step2RequirementService.calculateLeadScore_` | Deterministic score from timeline/files/complexity/budget/detail | Qualification metadata |
| Vendor eligibility | `VendorService.assignVendorToLead`; `DriveService.getEligibleVendorSnapshot_` | NDA Signed = Yes, ID Verified = Yes, Approved Status = Approved | Vendor assignment and Drive access |
| Vendor pricing prerequisite | `QuoteService.createQuoteForLead` | Approved vendor pricing must exist for lead | Quote creation |
| Vendor pricing approval | `VendorPricingService.approveVendorPricingForQuote` | Pricing Status must be Submitted before approval | Quote gate |
| Quote status transition | `QuoteService.updateQuoteStatus` | Draft -> Sent -> Accepted/Rejected; no invalid later transitions | Quote lifecycle integrity |
| Project creation | `ProjectService.createProjectFromQuote` | Qualified lead, assigned/eligible vendor, accepted quote | Project records |
| Payment creation | `PaymentService.createPaymentForQuote` | Quote must be Accepted | Payment tracking |
| Drive folder access | `DriveService.grantVendorProjectFolderAccess` | Vendor must be eligible and assigned to project | External folder sharing |

## Existing Validation Logic

- Sheet setup validation uses `DatabaseService.ensureSheetAndHeaders_` and service-specific wrappers.
- Required settings validation uses `ConfigService.validateRequiredSettings` and service-level `getSettingValue_` helpers.
- Public POST payload validation uses parse/token/stage-specific field validation.
- Operational workflow validation is implemented as top-level runner functions in `Code.js` and `CodeStage*.js`.
- Communication validation uses controlled recipients (`TEST_EMAIL_RECIPIENT`, `TEST_VENDOR_EMAIL`) for safe tests.
- ID validation relies on `UtilsService.createSequentialId_` with `LockService` to avoid duplicate sequences.

## File-by-File Framework Mapping

| File | Current responsibility | Current dependencies | Risk if modified | Suggested future framework location | Classification |
|---|---|---|---|---|---|
| `.clasp.json` | Binds local files to Apps Script project | clasp / Apps Script project ID | Very high | `09-config-utilities` | infrastructure |
| `.gitkeep` | Keeps repository initialized | Git | Low | repository root | infrastructure |
| `AGENTS.md` | Agent/developer operating instructions | Human/agent process | Medium | `07-audit-governance` | governance |
| `appsscript.json` | Apps Script manifest, scopes/runtime/web app settings | Apps Script deployment | Very high | `09-config-utilities` | infrastructure |
| `Code.js` | Stage 1-4 core validation/workflow runners | Most core services | High | `10-testing-validation` | testing |
| `CodeStage45VendorPricing.js` | Vendor pricing and assignment email runner tests | Lead, vendor, pricing, quote, email services | High | `10-testing-validation` | testing |
| `CodeStage5.js` | Payment setup/workflow runners | Payment, lead, quote, vendor pricing | Medium-high | `10-testing-validation` | testing |
| `CodeStage6.js` | Drive access setup/workflow runners | Drive, lead, quote, project, pricing | High | `10-testing-validation` | testing |
| `CodeStage7.js` | Email setup/Brevo runner tests | Email service | Medium | `10-testing-validation` | testing |
| `CodeStage8.js` | Slack setup/alert runner tests | Slack service | Medium | `10-testing-validation` | testing |
| `CodeStage9.js` | HTML Service dashboard entry points and dashboard runner | Dashboard service, HTML Service | High for dashboard | `07-audit-governance` and `10-testing-validation` | operational core |
| `CodeStage10.js` | Public `doPost` router and Step 1/2 webhook runners | Website webhook, Step 2, vendor pricing, email | Very high | `01-intake`, `02-qualification`, `04-vendor-pricing` | operational core |
| `ClientJS.html` | Dashboard client-side script partial | HTML Service, `google.script.run` | Medium | `07-audit-governance` | operational core |
| `Index.html` | Dashboard HTML shell | HTML Service, `ClientJS`, `Styles` | Medium | `07-audit-governance` | operational core |
| `Styles.html` | Dashboard styling partial | HTML Service | Low-medium | `07-audit-governance` | utility |
| `Config.js` | Configuration constants and required settings | PropertiesService, Settings sheet | Very high | `09-config-utilities` | infrastructure |
| `DatabaseService.js` | Sheet bootstrap, header preservation, settings map | Config, SpreadsheetApp | Very high | `09-config-utilities` | infrastructure |
| `Utils.js` | Sequential ID generation and fallback IDs | Database, Config, LockService | High | `09-config-utilities` | utility |
| `ErrorLogger.js` | Error logging | Database, Config, Utils | High | `07-audit-governance` | governance |
| `LeadService.js` | Lead creation, qualification, reminder state, quote gate, sanitized snapshots | Database, Config, Utils, ErrorLogger | High | `01-intake` and `02-qualification` | operational core |
| `WebsiteWebhookService.js` | Public Step 1 webhook intake and logs | Lead, Database, Config, ErrorLogger | Very high | `01-intake` | operational core |
| `Step2RequirementService.js` | Public Step 2 intake, scoring, qualification logs | Website webhook, Lead, Database, Config | High | `02-qualification` | operational core |
| `VendorService.js` | Vendor assignment, eligibility, vendor email trigger | Lead, Database, Email, Config | High | `04-vendor-pricing` | operational core |
| `VendorPricingService.js` | Vendor pricing intake, storage, approval, quote gate lookup | Website webhook, Lead, Database, Utils | High | `04-vendor-pricing` | operational core |
| `QuoteService.js` | Quote creation and lifecycle transitions | Lead, VendorPricing, Database, Utils | High | `05-quotes` | operational core |
| `ProjectService.js` | Project creation from accepted quote | Lead, Vendor, Quote, Database, Utils | High | `06-projects` | operational core |
| `PaymentService.js` | Payment records for accepted quotes | Quote, Lead, Database, Utils | Medium-high | `06-projects` | operational core |
| `DriveService.js` | Drive folder creation/access lifecycle and audit | Database, Config, Utils, DriveApp | High | `06-projects` and `07-audit-governance` | governance |
| `EmailService.js` | Brevo transactional emails and email audit | Database, Config, Utils, UrlFetchApp | High | `03-communication` | operational core |
| `SlackService.js` | Slack alerts and alert audit | Database, Config, Utils, UrlFetchApp | Medium | `03-communication` | infrastructure |
| `DashboardService.js` | Admin dashboard summaries and manual lead wrapper | All operational sheet services | Medium-high | `07-audit-governance` | governance |
| `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md` | Troubleshooting guide for website webhook failures | Operational process | Low | `07-audit-governance` | governance |
| `docs/operational-readiness/CURRENT_OPERATIONAL_STATE_ASSESSMENT.md` | Current operations assessment | Documentation | Low | `07-audit-governance` | governance |
| `docs/operational-readiness/DEPENDENCY_GOVERNANCE_MATRIX` | Existing dependency governance artifact without extension | Documentation | Low | `07-audit-governance` | governance |
| `docs/operational-readiness/DEPENDENCY_GOVERNANCE_MATRIX.md` | Existing dependency governance matrix | Documentation | Low | `07-audit-governance` | governance |
| `website-integration/README.md` | Website integration notes | Website integration examples | Medium | `01-intake` | governance |
| `website-integration/app/api/enquiry/route.ts` | Example frontend/API route for enquiry integration | External website / Next.js style route | Medium if used by website | `01-intake` | experimental |
| `website-integration/components/EnquiryForm-submit-handler.example.tsx` | Example frontend submit handler | External website / frontend | Medium if copied into production | `01-intake` | experimental |

## Layer Assignment Summary

### 01 Intake

- `LeadService.createLead`
- `WebsiteWebhookService.handlePostEvent`
- `CodeStage10.doPost` default route
- `DashboardService.createLeadFromDashboard`
- `website-integration/*` examples

### 02 Qualification

- `Step2RequirementService`
- `LeadService.markStep2Completed`
- `LeadService.canLeadProceedToQuote`
- Reminder state functions in `LeadService`

### 03 Communication

- `EmailService`
- `SlackService`
- Stage 7 and Stage 8 runners
- Lead acknowledgement email and vendor pricing request email

### 04 Vendor Pricing

- `VendorService`
- `VendorPricingService`
- `CodeStage45VendorPricing.js`
- Vendor assignment and vendor pricing webhook route

### 05 Quotes

- `QuoteService`
- Quote runners in `Code.js`
- Quote status transition gate

### 06 Projects

- `ProjectService`
- `PaymentService`
- `DriveService` operational folder functions
- Stage 5 and Stage 6 runners

### 07 Audit & Governance

- `ErrorLogger`
- Audit log helpers in `WebsiteWebhookService`, `Step2RequirementService`, `VendorPricingService`, `EmailService`, `SlackService`, `DriveService`
- `DashboardService`
- Existing operational readiness docs

### 08 Intelligence

- No dedicated service yet.
- Future candidates: lead scoring strategy, vendor performance scoring, quote margin analytics, anomaly detection, AI governance review logs.
- Current seed: `Step2RequirementService.calculateLeadScore_` and `DashboardService` metrics.

### 09 Config & Utilities

- `Config.js`
- `DatabaseService.js`
- `Utils.js`
- `.clasp.json`
- `appsscript.json`

### 10 Testing & Validation

- `Code.js`
- `CodeStage5.js`
- `CodeStage6.js`
- `CodeStage7.js`
- `CodeStage8.js`
- `CodeStage9.js`
- `CodeStage10.js` runner functions
- `CodeStage45VendorPricing.js`

## Stage 1 Findings and Governance Notes

1. The system is already layered by business stage, but file names are deployment-era rather than framework-era. Do not rename them in Stage 1.
2. `doPost(e)` is the highest-risk runtime surface because it multiplexes Step 1, Step 2, and vendor pricing public submissions.
3. Sheet headers are part of the production contract. `DatabaseService.ensureSheetAndHeaders_` preserves existing data by appending missing headers only; this is an important governance pattern.
4. Gatekeeping is distributed but explicit. The most important chain is: Step 2 qualified lead -> eligible vendor -> submitted and approved vendor pricing -> quote -> accepted quote -> project/payment/Drive access.
5. Communication is API-driven through Apps Script services. Brevo and Slack should remain backend-only; secrets must stay in Settings or Script Properties.
6. Audit systems are substantial and should be treated as governance core, not incidental logs.
7. The future Core Master Framework can be introduced safely through documentation, wrappers, and tests before any physical file movement is considered.

## Recommended Next Stage

Stage 2 should remain documentation-first and non-destructive:

- Add layer-level README files with active service inventory.
- Add a dependency direction policy for each layer.
- Add a runtime-criticality matrix.
- Add a change-control checklist for high-risk services.
- Do not move code until the framework is proven through docs and tests.
