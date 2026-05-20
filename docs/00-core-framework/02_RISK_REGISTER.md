# MIDTS Automation Engine - Stage 2 Risk Register

Status: Documentation-only risk classification. This document does not authorize code movement, file renames, refactors, deployment changes, sheet changes, or webhook changes.

Source baseline: `docs/00_RESTRUCTURE_MAP.md` and `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md`.

## Risk Classification Guide

| Classification | Meaning | Change control expectation |
|---|---|---|
| Critical | Directly affects public intake, security, core lifecycle gates, production data, deployment, or sheet contracts | Change only with migration plan, backup, targeted tests, and operator validation |
| High Risk | Affects important workflow behavior, cross-service dependencies, customer/vendor communication, or dashboard visibility | Change with focused regression testing and rollback notes |
| Medium Risk | Affects setup runners, observability, secondary integrations, or UI wrappers | Change with targeted validation and documentation update |
| Low Risk | Documentation-only or non-runtime reference material | Safe for docs-only updates when no runtime instructions are changed incorrectly |
| Future / Dormant | Planned architecture or inactive/non-production capability | Keep documented separately until promoted into operational flow |

## Component Risk Register

| Component | Type | Classification | Why | Primary failure mode | Change control requirement |
|---|---|---|---|---|---|
| `doPost(e)` in `CodeStage10.js` | Public Apps Script entry point | Critical | Single public POST entry for website intake, Step 2, and vendor pricing | All frontend/webhook submissions stop, route incorrectly, or return invalid JSON | Webhook migration plan, deployed version validation, Stage 10/11/4.5 payload tests |
| `routeWebsiteWebhookPost_(e)` in `CodeStage10.js` | Webhook router | Critical | Determines which service owns each public payload | Step 2/vendor payloads create wrong records or no records | Route alias inventory, payload regression tests |
| `sendWebsiteLeadAcknowledgement_` in `CodeStage10.js` | Email bridge | High Risk | Sends acknowledgement after lead intake | Leads created without expected email or email failure blocks too much | Lead creation test plus Brevo/email log validation |
| `WebsiteWebhookService.js` | Public webhook service | Critical | Owns Step 1 intake, token validation, honeypot handling, website webhook logging | Public lead intake fails or accepts invalid submissions | Stage 10 setup/log/payload tests, token validation check |
| `Step2RequirementService.js` | Public webhook service | Critical | Updates existing leads with technical requirements | Step 2 form creates no update, updates wrong lead, or bypasses quote gate | Stage 11 setup/payload tests and lead row inspection |
| `VendorPricingService.js` | Public webhook service | Critical | Records vendor pricing responses used by quote workflow | Quote cannot proceed or pricing attaches to wrong lead/vendor | Stage 4.5 setup/workflow/webhook tests |
| `LeadService.js` | Operational core service | Critical | Lead creation, qualification, Step 2 readiness, and quote gate dependency | Duplicate/broken leads, invalid status progression, quote blocked incorrectly | Lead capture, qualification, Step 2, and quote gate tests |
| `QuoteService.js` | Operational core service | Critical | Quote creation, quote status transitions, vendor pricing prerequisite | Quotes created too early, blocked forever, or wrong status | Stage 3 quote setup/creation/status tests |
| `VendorService.js` | Operational core service | Critical | Vendor eligibility, assignment, and vendor-related gates | Ineligible vendor receives work or eligible vendor blocked | Stage 4 and Stage 4.5 tests |
| `ProjectService.js` | Operational core service | Critical | Project creation after quote/lead/vendor readiness | Project created before prerequisites or not created after approval | Stage 4 project creation and downstream Drive/payment checks |
| `DriveService.js` | Operational core service | Critical | Drive folder/access workflow and vendor access gate | Unauthorized access or missing project files | Stage 6 setup/access workflow validation |
| `EmailService.js` | Communication infrastructure | Critical | Brevo transactional email and email audit logs | Client/vendor emails fail silently or send with wrong settings | Stage 7 Brevo test, email log inspection, sender settings check |
| `DatabaseService.js` | Infrastructure | Critical | Shared sheet access and row append/update primitives | Any sheet-backed workflow corrupts data or fails globally | Full setup validation and sheet backup before modification |
| `Config.js` / `ConfigService` | Config infrastructure | Critical | Owns settings keys and configuration lookup | Missing/renamed keys break webhooks, email, Slack, Drive, or forms | Settings migration plan, dual-read if renaming keys |
| `appsscript.json` | Deployment manifest | Critical | Controls Apps Script runtime/deployment behavior | Deployment/runtime changes unexpectedly | Manifest review and deployment smoke test |
| `.clasp.json` | Deployment binding | Critical | Binds repo to Apps Script project | Push goes to wrong Apps Script project | Confirm script ID before any push |
| `Settings` sheet | Sheet contract | Critical | Runtime config source | Webhooks/email/Drive/Slack fail due missing keys | Backup and setup validation before changing columns or key names |
| `Leads` sheet | Sheet contract | Critical | Primary lifecycle record | Lead, quote, Step 2, project, email flows break | Backup and row/column migration plan |
| `Quotes` sheet | Sheet contract | Critical | Quote lifecycle record | Quote generation/status tracking fails | Backup and Stage 3 validation |
| `Vendors` sheet | Sheet contract | Critical | Vendor eligibility and assignment source | Wrong vendor selection or access | Backup and Stage 4 validation |
| `Projects` sheet | Sheet contract | Critical | Project execution record | Drive/project workflow breaks | Backup and Stage 4/6 validation |
| `Vendor Pricing` sheet | Sheet contract | Critical | Vendor price collection for quote readiness | Quote cannot be built from vendor responses | Backup and Stage 4.5 validation |
| `Utils.js` / `UtilsService` | Utility infrastructure | High Risk | ID generation and shared helpers | Duplicate or malformed IDs, lifecycle references fail | ID counter validation and lifecycle smoke tests |
| `ErrorLogger.js` | Governance infrastructure | High Risk | Central error logging | Failures become invisible or logs corrupt | Failure-path test and Error Logs inspection |
| `DashboardService.js` | Visibility service | High Risk | Aggregates operational dashboard data from many sheets | Dashboard displays wrong counts/statuses | Stage 9 validation and dashboard smoke test |
| `CodeStage9.js` | Dashboard entry/wrapper | High Risk | `doGet`, `include`, and `google.script.run` wrappers | Dashboard page or dashboard actions fail | Dashboard render and client action test |
| `Index.html` | Dashboard UI | High Risk | Main dashboard template | Dashboard cannot render or call expected wrappers | Dashboard browser validation |
| `ClientJS.html` | Dashboard client logic | High Risk | Client-side dashboard behavior | User actions fail or call missing server functions | Dashboard interaction validation |
| `PaymentService.js` | Operational service | High Risk | Tracks payment state and downstream readiness | Payment status blocks or releases work incorrectly | Stage 5 validation |
| `Code.js` | Stage 1/base runner area | High Risk | Foundation validation and smoke testing entry points | Setup validation becomes unreliable | Stage 1 smoke validation |
| `CodeStage45VendorPricing.js` | Runner/orchestration file | High Risk | Vendor pricing setup, workflow, webhook payload, and email tests | Vendor pricing validation gives false confidence | Stage 4.5 runner validation |
| `CodeStage6.js` | Runner/orchestration file | High Risk | Drive setup/access workflow validation | Drive access regression goes undetected | Stage 6 validation |
| `CodeStage5.js` | Runner/orchestration file | Medium Risk | Payment setup and tracking validation | Payment regression goes undetected | Stage 5 validation |
| `SlackService.js` | Communication infrastructure | Medium Risk | Slack operational alerts | Alerting unavailable while core lifecycle continues | Stage 8 setup/alert validation |
| `CodeStage7.js` | Runner/orchestration file | Medium Risk | Email setup and Brevo validation runner | Email validation unavailable or misleading | Stage 7 validation |
| `CodeStage8.js` | Runner/orchestration file | Medium Risk | Slack setup and alert validation runner | Slack validation unavailable or misleading | Stage 8 validation |
| `Styles.html` | Dashboard presentation | Medium Risk | Dashboard styling | UI readability/layout issues | Dashboard visual smoke test |
| `Website Webhook Logs` sheet | Audit sheet | High Risk | Intake diagnosis and token/payload trace | Webhook failures become hard to diagnose | Stage 10 log setup test |
| `Step 2 Requirement Logs` sheet | Audit sheet | High Risk | Step 2 diagnosis and trace | Step 2 failures become hard to diagnose | Stage 11 setup/payload test |
| `Vendor Pricing Logs` sheet | Audit sheet | High Risk | Vendor pricing diagnosis and trace | Vendor pricing failures become hard to diagnose | Stage 4.5 webhook test |
| `Email Logs` sheet | Audit sheet | Medium Risk | Email delivery/audit trace | Email failures become hard to diagnose | Stage 7 email log inspection |
| `Slack Logs` sheet | Audit sheet | Medium Risk | Slack alert/audit trace | Alert failures become hard to diagnose | Stage 8 validation |
| `Drive Access Logs` sheet | Audit sheet | Medium Risk | Drive access/audit trace | Drive access failures become hard to diagnose | Stage 6 validation |
| `Payments` sheet | Sheet contract | High Risk | Payment lifecycle state | Payment tracking and lifecycle gates fail | Backup and Stage 5 validation |
| `ID Counters` sheet | Sheet contract | High Risk | Sequential ID generation source | Duplicate IDs or broken references | Backup and ID generation validation |
| `Error Logs` sheet | Sheet contract | Medium Risk | Central failure trace | Failures become less visible | Error-path validation |
| `website-integration/` | Integration reference | Medium Risk | Frontend/backend payload reference material | Frontend may drift from backend contracts if edited incorrectly | Update alongside webhook docs and payload tests |
| `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md` | Diagnostic documentation | Low Risk | Operator troubleshooting guide | Wrong instructions can slow diagnosis but not alter runtime | Documentation review only |
| `docs/**` | Governance documentation | Low Risk | Architecture and operational mapping | Misleading docs if not kept current | Documentation review only |
| `AGENTS.md` | Contributor/governance instruction | Medium Risk | Guides future agents/operators | Bad instructions could lead to unsafe future changes | Governance review before material changes |
| `docs/08-intelligence/README.md` | Future layer documentation | Future / Dormant | Placeholder for future intelligence layer | None until implemented | Keep separate from operational core until promoted |

## Must Not Rename Without Migration

The following must be treated as locked names until a specific migration plan exists:

- Apps Script global entry points: `doPost(e)`, `doGet(e)`, `include(filename)`, `getDashboardData()`, `createDashboardLead(input)`.
- Public service objects: `WebsiteWebhookService`, `Step2RequirementService`, `VendorPricingService`, `LeadService`, `QuoteService`, `VendorService`, `ProjectService`, `DriveService`, `EmailService`, `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`.
- Manifest/deployment files: `appsscript.json`, `.clasp.json`.
- Dashboard template files: `Index.html`, `ClientJS.html`, `Styles.html`.
- Sheet tabs: `Settings`, `Error Logs`, `ID Counters`, `Leads`, `Quotes`, `Vendors`, `Projects`, `Payments`, `Website Webhook Logs`, `Step 2 Requirement Logs`, `Vendor Pricing`, `Vendor Pricing Logs`, `Email Logs`, `Slack Logs`, `Drive Access Logs`.
- Settings keys: `WEBSITE_WEBHOOK_TOKEN`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `TEST_EMAIL_RECIPIENT`, `TEST_VENDOR_EMAIL`, `STEP2_FORM_BASE_URL`, `VENDOR_PRICING_FORM_BASE_URL`, `ROOT_DRIVE_FOLDER_ID`, `SLACK_WEBHOOK_URL`.

## Safe Stage 2 Change Scope

The current Stage 2 safe scope is limited to:

- Creating or updating documentation under `docs/`.
- Describing existing dependencies, risks, and lock points.
- Adding governance notes that explicitly preserve current runtime behavior.

The current Stage 2 unsafe scope includes:

- Moving Apps Script files.
- Renaming service objects, runner functions, or entry points.
- Changing sheet names, column structures, or settings keys.
- Changing webhook route aliases, token validation, or honeypot behavior.
- Changing Brevo, Slack, Drive, quote, vendor, project, or payment logic.
- Changing deployment manifests or clasp project binding.

## Promotion Rule

Any component classified as Critical or High Risk should be promoted into future framework layers only by wrapper documentation first, then compatibility shims or dual-write/dual-read migration where needed, and only after the matching stage runner tests prove unchanged behavior.