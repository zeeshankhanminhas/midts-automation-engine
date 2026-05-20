# MIDTS Automation Engine - Stage 2 Dependency Lock Map

Status: Identification and dependency mapping only. This document does not authorize code moves, renames, refactors, sheet changes, deployment changes, or webhook behavior changes.

Source baseline: `docs/00_RESTRUCTURE_MAP.md` on `main` after the Stage 1 governance map.

## Lock Principles

- Treat Apps Script global function names as public contracts when they are invoked by deployments, HTML clients, manual runners, or tests.
- Treat sheet tab names and column contracts as operational dependencies until a migration plan exists.
- Treat settings keys as deployment dependencies; do not rename them without dual-read migration and validation.
- Treat webhook route aliases, payload keys, and token validation as public integration contracts.
- Documentation files may be updated freely when they do not change runtime behavior.

## Apps Script Entry Points

| Entry point | File | Current responsibility | External dependency | Risk if changed | Lock status |
|---|---|---|---|---|---|
| `doPost(e)` | `CodeStage10.js` | Public web app POST router for Step 1 website intake, Step 2 requirements, and vendor pricing payloads | Google Apps Script web app URL, frontend forms, webhook token, `ContentService` JSON response | Critical | Must not be renamed or signature-changed without web app migration |
| `doGet(e)` | `CodeStage9.js` | Dashboard web app GET entry point | Apps Script web app URL and dashboard HTML | High | Must not be renamed without dashboard deployment test |
| `include(filename)` | `CodeStage9.js` | Dashboard HTML include helper | `Index.html`, `ClientJS.html`, `Styles.html` templates | Medium | Rename only with template migration |
| `getDashboardData()` | `CodeStage9.js` | Dashboard client callable data wrapper | `google.script.run` calls from dashboard client | High | Must not be renamed without frontend/dashboard update |
| `createDashboardLead(input)` | `CodeStage9.js` | Dashboard client callable lead creation wrapper | `google.script.run` calls from dashboard client | High | Must not be renamed without frontend/dashboard update |

## Public Webhook Handlers

All public webhook handling enters through `doPost(e)` in `CodeStage10.js`.

| Public route | Router condition | Service handler | Required token | Primary sheets | Current outcome | Risk |
|---|---|---|---|---|---|---|
| Website Step 1 intake | Default route when no Step 2 or vendor pricing alias matches | `WebsiteWebhookService.handlePostEvent(e)` | `WEBSITE_WEBHOOK_TOKEN` | `Leads`, `Website Webhook Logs`, `Settings` | Creates a new lead and logs webhook processing | Critical |
| Step 2 requirements | `formStage` aliases: `step2`, `step_2`, `technical_requirement`, `requirements` | `Step2RequirementService.handlePostEvent(e)` | `WEBSITE_WEBHOOK_TOKEN` through shared webhook validation path | `Leads`, `Step 2 Requirement Logs` | Updates existing lead technical requirements and Step 2 completion state | Critical |
| Vendor pricing | `formStage` aliases: `vendorPricing`, `vendor_pricing`, `vendor-pricing`, `pricing`, `vendor_price` | `VendorPricingService.handlePostEvent(e)` | `WEBSITE_WEBHOOK_TOKEN` through shared webhook validation path | `Vendor Pricing`, `Vendor Pricing Logs`, `Leads` | Records vendor pricing response and supports quote readiness | Critical |

## `doPost(e)` Service Call Chain

Current dependency chain from public webhook receipt:

1. `doPost(e)` receives Apps Script web app POST traffic.
2. `routeWebsiteWebhookPost_(e)` normalizes routing and parses payload through `WebsiteWebhookService.parsePostEvent_(e)`.
3. `Step2RequirementService.isStep2Payload(payload)` decides whether Step 2 requirements should handle the payload.
4. `VendorPricingService.isVendorPricingPayload(payload)` decides whether vendor pricing should handle the payload.
5. Default payloads go to `WebsiteWebhookService.handlePostEvent(e)` for Step 1 intake.
6. Successful Step 1 intake can call `sendWebsiteLeadAcknowledgement_(leadResult, payload)`.
7. `sendWebsiteLeadAcknowledgement_` calls `EmailService.sendLeadReceivedEmail(...)`.
8. Errors and audit records depend on `ErrorLogger`, service-specific log sheets, and `ContentService` JSON responses.

Shared dependencies in this chain:

- `ConfigService.WEBSITE_WEBHOOK_TOKEN_KEY`
- `WebsiteWebhookService.validateWebhookToken_`
- `WebsiteWebhookService.isHoneypotTriggered_`
- `DatabaseService`
- `LeadService`
- `EmailService`
- `ErrorLogger`
- `ContentService`

## Runner Functions

Runner function names are manual/testing contracts inside Apps Script. They should not be renamed while they are used for validation, setup, or operator diagnosis.

| Stage | Runner functions | Primary purpose | Risk |
|---|---|---|---|
| Stage 1 | `runStage1Validation`, `runStage1SmokeTest` | Foundation validation and smoke testing | Medium |
| Stage 2 | `runStage2LeadCaptureTest`, `runStage2NurtureQualificationTest`, `runReminderAuditProofTest`, `runReminderStatusUpdateTest`, `testStage2NurtureDefaults`, `runStage2ReminderProcessingTest` | Lead capture, qualification, reminder testing | Medium |
| Stage 3 | `runQuoteGatingTest`, `runStage3QuoteCreationTest`, `runStage3QuoteSetupValidation`, `runStage3QuoteStatusWorkflowTest` | Quote setup, quote gating, quote status testing | High |
| Stage 4 | `runStage4VendorEligibilityTest`, `runStage4ProjectCreationTest` | Vendor eligibility and project creation gate testing | High |
| Stage 4.5 | `runStage45VendorPricingSetupValidation`, `runStage45VendorPricingWorkflowTest`, `runStage45VendorPricingWebhookPayloadTest`, `runStage45VendorAssignmentEmailTest` | Vendor pricing workflow, webhook, and email testing | High |
| Stage 5 | `runStage5PaymentSetupValidation`, `runStage5PaymentTrackingTest` | Payment setup and tracking testing | Medium |
| Stage 6 | `runStage6DriveSetupValidation`, `runStage6DriveAccessWorkflowTest` | Drive access setup and gate testing | High |
| Stage 7 | `runStage7EmailSetupValidation`, `runStage7BrevoEmailTest` | Brevo/email setup and live email validation | High |
| Stage 8 | `runStage8SlackSetupValidation`, `runStage8SlackAlertTest` | Slack setup and alert validation | Medium |
| Stage 9 | `runStage9DashboardSetupValidation` | Dashboard setup validation | Medium |
| Stage 10 | `runStage10WebsiteWebhookSetupValidation`, `runStage10WebsiteWebhookLogSetupTest`, `runStage10WebsiteWebhookPayloadTest` | Website webhook setup, logging, and payload validation | High |
| Stage 11 | `runStage11Step2RequirementSetupTest`, `runStage11Step2RequirementPayloadTest` | Step 2 requirements setup and payload validation | High |

## Service To Sheet Dependency Matrix

| Service/file | Sheets used | Required settings | Downstream dependencies | Risk |
|---|---|---|---|---|
| `Config.js` / `ConfigService` | `Settings` | All settings keys | Every service that reads config | Critical |
| `DatabaseService.js` | `Settings`, `Error Logs`, `ID Counters`, `Leads`, `Quotes`, `Vendors`, `Projects`, plus service-created tabs | None directly | All sheet-backed services | Critical |
| `Utils.js` / `UtilsService` | `ID Counters` | None directly | Lead, quote, project, and other ID generation | High |
| `ErrorLogger.js` | `Error Logs` | None directly | All services that catch/log failures | High |
| `LeadService.js` | `Leads` | None directly | Website intake, qualification, quote gate, project gate | Critical |
| `WebsiteWebhookService.js` | `Leads`, `Website Webhook Logs`, `Settings` | `WEBSITE_WEBHOOK_TOKEN` | `LeadService`, `DatabaseService`, `ErrorLogger` | Critical |
| `Step2RequirementService.js` | `Leads`, `Step 2 Requirement Logs` | `WEBSITE_WEBHOOK_TOKEN` through router/shared validation | `LeadService`, `DatabaseService`, `ErrorLogger` | Critical |
| `VendorPricingService.js` | `Vendor Pricing`, `Vendor Pricing Logs`, `Leads` | `WEBSITE_WEBHOOK_TOKEN` through router/shared validation | `VendorService`, `QuoteService`, `DatabaseService`, `ErrorLogger` | Critical |
| `VendorService.js` | `Vendors`, `Leads` | `VENDOR_PRICING_FORM_BASE_URL`, `TEST_VENDOR_EMAIL` where email workflows are tested | `EmailService`, `DriveService`, vendor eligibility gates | Critical |
| `QuoteService.js` | `Quotes`, `Leads`, `Vendor Pricing` | None directly | `LeadService`, `VendorPricingService`, `ProjectService`, `PaymentService` | Critical |
| `ProjectService.js` | `Projects`, `Leads`, `Vendors`, `Quotes` | None directly | `DriveService`, `PaymentService`, `QuoteService` | Critical |
| `PaymentService.js` | `Payments`, `Quotes` | None directly | Project/payment lifecycle gates | High |
| `DriveService.js` | `Projects`, `Vendors`, `Drive Access Logs` | `ROOT_DRIVE_FOLDER_ID` | Project execution access control | Critical |
| `EmailService.js` | `Email Logs`, `Settings` | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `TEST_EMAIL_RECIPIENT` | Lead acknowledgement, vendor assignment, email validation | Critical |
| `SlackService.js` | `Slack Logs`, `Settings` | `SLACK_WEBHOOK_URL` | Operational alerting | Medium |
| `DashboardService.js` | `Leads`, `Quotes`, `Projects`, `Vendors`, `Payments`, `Drive Access Logs`, `Email Logs`, `Slack Logs` | None directly | Dashboard web app wrappers | High |

## Required Settings Keys

| Key | Used by | Purpose | Risk if missing/renamed |
|---|---|---|---|
| `WEBSITE_WEBHOOK_TOKEN` | `WebsiteWebhookService`, `doPost(e)` routed webhook services | Authenticates website, Step 2, and vendor pricing webhook submissions | Critical: public forms fail or reject payloads |
| `BREVO_API_KEY` | `EmailService` | Authenticates Brevo transactional email API | Critical: outbound email fails |
| `BREVO_SENDER_EMAIL` | `EmailService` | Sender address for transactional email | High: emails may fail validation or sender policy |
| `BREVO_SENDER_NAME` | `EmailService` | Human sender name | Medium: communication branding issue |
| `TEST_EMAIL_RECIPIENT` | Stage 7 email tests | Safe test recipient | Medium: test email cannot validate delivery |
| `TEST_VENDOR_EMAIL` | Stage 4.5 vendor email tests | Safe vendor test recipient | Medium: vendor assignment email test cannot validate delivery |
| `STEP2_FORM_BASE_URL` | Step 2 email/form workflow | Builds client Step 2 requirement link | Critical: Step 2 email links break or go to wrong frontend |
| `VENDOR_PRICING_FORM_BASE_URL` | Vendor pricing workflow | Builds vendor pricing submission link | Critical: vendor pricing collection breaks |
| `ROOT_DRIVE_FOLDER_ID` | `DriveService` | Root Drive folder for project access workflows | Critical: project file access fails or points to wrong Drive root |
| `SLACK_WEBHOOK_URL` | `SlackService` | Sends operational alerts to Slack | Medium: alerting fails, core lifecycle still runs |

## Brevo And Email Dependencies

| Dependency | Location | Callers | Notes |
|---|---|---|---|
| Brevo transactional email API | `EmailService.js` | Stage 7 tests, website lead acknowledgement, vendor pricing assignment/request flows | Requires `BREVO_API_KEY` and sender settings |
| Lead acknowledgement email | `sendWebsiteLeadAcknowledgement_` in `CodeStage10.js` -> `EmailService.sendLeadReceivedEmail(...)` | Successful Step 1 intake | Should fail safely without blocking lead creation where current behavior allows |
| Vendor assignment/pricing email | `VendorService.js`, `EmailService.js`, Stage 4.5 runners | Vendor pricing workflow | Depends on vendor contact data and `VENDOR_PRICING_FORM_BASE_URL` |
| Email audit logs | `EmailService.js` | All outbound email workflows | Uses `Email Logs`; renaming this sheet breaks audit visibility |

## Token And Security Dependencies

| Dependency | Current location | Protected behavior | Migration requirement |
|---|---|---|---|
| `WEBSITE_WEBHOOK_TOKEN` | `Settings` and/or Apps Script properties via config lookup | Rejects unauthenticated website, Step 2, and vendor pricing payloads | Dual-read and rollout validation before rename |
| Honeypot detection | `WebsiteWebhookService` | Suppresses bot submissions from frontend forms | Must preserve accepted honeypot field names when frontend changes |
| Payload logging redaction | Webhook logging services | Preserves diagnosis without exposing secrets | Review before adding new sensitive payload fields |
| Drive vendor access gates | `DriveService`, `VendorService`, `ProjectService` | Limits project file access to approved/assigned vendors | Requires governance review before loosening |
| Settings sheet access | `ConfigService`, `DatabaseService` | Runtime configuration source of truth | Do not change key names or fallback order without migration plan |

## Quote, Vendor, And Project Gate Dependencies

| Gate | Owning service | Depends on | Blocks |
|---|---|---|---|
| Required lead fields | `LeadService` and website/Step 2 services | Lead/customer/project data | Invalid or incomplete intake from progressing |
| Step 2 completion gate | `LeadService.canLeadProceedToQuote` and `Step2RequirementService` | Existing `Leads` row and completed technical requirements | Quote creation before technical requirements are captured |
| Lead qualification/score gate | `LeadService` | Lead score and qualification status | Unqualified leads from quote/project progression |
| Vendor eligibility gate | `VendorService` | Vendor approval, NDA/ID status, capabilities, status | Ineligible vendor assignment |
| Vendor pricing prerequisite | `VendorPricingService`, `QuoteService` | Vendor pricing response row(s) | Quote creation/finalization without vendor pricing |
| Vendor pricing approval gate | `VendorPricingService`, `QuoteService` | Pricing approval status | Quote workflow progression |
| Quote status transition gate | `QuoteService` | Current quote state and allowed transition path | Invalid quote lifecycle changes |
| Project creation gate | `ProjectService` | Qualified lead, accepted/valid quote, vendor readiness | Project creation before prerequisites are met |
| Payment gate | `PaymentService`, `ProjectService` | Quote/payment status | Downstream lifecycle execution where payment is required |
| Drive access gate | `DriveService` | Project assignment and vendor eligibility | Unauthorized Drive access |

## High-Risk Files

These files are high-risk because they hold public entry points, global Apps Script names, shared sheet/config behavior, or lifecycle gate logic.

- `CodeStage10.js`
- `WebsiteWebhookService.js`
- `Step2RequirementService.js`
- `VendorPricingService.js`
- `LeadService.js`
- `VendorService.js`
- `QuoteService.js`
- `ProjectService.js`
- `DriveService.js`
- `PaymentService.js`
- `EmailService.js`
- `DatabaseService.js`
- `Config.js`
- `Utils.js`
- `ErrorLogger.js`
- `CodeStage9.js`
- `DashboardService.js`
- `Index.html`
- `ClientJS.html`
- `Styles.html`
- `appsscript.json`
- `.clasp.json`

## Safe-To-Document Files

These files and folders are safe targets for documentation-only edits when the content does not change runtime assumptions or operator instructions incorrectly.

- `docs/**`
- `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md`
- `website-integration/**` when treated as examples or integration references only
- `AGENTS.md` when updated as governance/process documentation only
- `README.md` or similar repository documentation when no deployment instructions are changed without validation

## Files That Must Not Be Renamed Without Migration

| File/path | Why the name matters | Required migration before rename |
|---|---|---|
| `CodeStage10.js` | Contains public `doPost(e)` router and Stage 10 helpers/runners | Deployment validation, webhook regression tests, Apps Script push verification |
| `CodeStage9.js` | Contains dashboard `doGet(e)` and client-callable wrappers | Dashboard template/client migration and web app test |
| `WebsiteWebhookService.js` | Global service object used by router and tests | Update all references and run Stage 10 tests |
| `Step2RequirementService.js` | Global service object used by router and Stage 11 tests | Update all references and run Step 2 payload tests |
| `VendorPricingService.js` | Global service object used by router and vendor pricing workflows | Update all references and run Stage 4.5 payload tests |
| `LeadService.js` | Central lead lifecycle object used by multiple stages | Full lead/quote/project regression pass |
| `VendorService.js` | Vendor eligibility and assignment workflows | Vendor eligibility, pricing email, and Drive access regression pass |
| `QuoteService.js` | Quote creation and status gate workflows | Quote setup, quote creation, and quote status tests |
| `ProjectService.js` | Project creation lifecycle gate | Project creation and Drive setup tests |
| `DriveService.js` | Drive access gate and folder dependency | Drive setup and access workflow validation |
| `EmailService.js` | Brevo outbound email and email audit dependency | Stage 7 and vendor assignment email validation |
| `DatabaseService.js` | Shared sheet access layer | Full sheet setup validation before and after migration |
| `Config.js` | Settings constants and config lookup | Settings migration and all setup validations |
| `Utils.js` | ID generation and shared utilities | ID counter validation and lifecycle regression |
| `ErrorLogger.js` | Shared error logging | Error log validation and failure-path tests |
| `Index.html`, `ClientJS.html`, `Styles.html` | Dashboard template names and include dependencies | Dashboard render and client action test |
| `appsscript.json` | Apps Script manifest/deployment behavior | Manifest review and deployment test |
| `.clasp.json` | Clasp project binding | Confirm target Apps Script project before push |
| Sheet tabs listed in this document | Runtime data contracts | Sheet migration script, backup, and validation |

## Documentation Lock Note

This map locks the current known dependency surface for planning purposes only. It does not propose a new repo structure and does not authorize changing any runtime implementation.