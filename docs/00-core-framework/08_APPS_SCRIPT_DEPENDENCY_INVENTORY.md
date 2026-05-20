# MIDTS Automation Engine - Apps Script Dependency Inventory

Status: Stage 5 documentation-only dependency inventory. This document does not authorize code movement, renames, refactors, sheet changes, webhook changes, deployment changes, or functional changes.

Source baseline:

- `docs/00_RESTRUCTURE_MAP.md`
- `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md`
- `docs/00-core-framework/05_SYSTEM_TOPOLOGY.md`
- `docs/00-core-framework/06_DATA_FLOW_MAP.md`
- `docs/00-core-framework/07_EVENT_CHAIN_MAP.md`

## Inventory Rules

- File names are current runtime names and must be treated as locked until a migration plan exists.
- Dependencies listed here are operationally inferred from the current framework maps and dependency lock documents.
- This is a planning inventory, not permission to restructure.
- Any future PR that changes a dependency, sheet, setting, log, trigger, or gate must update this inventory.

## Apps Script File Inventory

| Apps Script file | Primary responsibility | Depends on services/functions | Sheets read/write | Settings required | Logs created | Webhook/event triggers involved |
|---|---|---|---|---|---|---|
| `.clasp.json` | Binds repository to Apps Script project | Clasp deployment tooling | None directly | Apps Script project/script ID binding | None | Deployment/push target; must be confirmed before any push |
| `appsscript.json` | Apps Script manifest/runtime configuration | Apps Script platform runtime | None directly | Manifest/runtime configuration | None | Deployment/runtime behavior |
| `Code.js` | Stage 1-4 runner/orchestration surface for foundation, lead, quote, vendor, and project tests | `ConfigService`, `DatabaseService`, `UtilsService`, `ErrorLogger`, `LeadService`, `QuoteService`, `VendorService`, `ProjectService` | `Settings`, `Error Logs`, `ID Counters`, `Leads`, `Quotes`, `Vendors`, `Projects` | Indirectly all setup keys validated by stage runners | May create `Error Logs`; runner-created records may touch operational sheets | Manual Apps Script runner execution |
| `CodeStage45VendorPricing.js` | Stage 4.5 vendor pricing validation, workflow, webhook payload, and vendor email tests | `VendorPricingService`, `VendorService`, `LeadService`, `QuoteService`, `EmailService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | `Leads`, `Vendors`, `Vendor Pricing`, `Vendor Pricing Logs`, `Quotes`, `Email Logs`, `Settings` | `WEBSITE_WEBHOOK_TOKEN`, `VENDOR_PRICING_FORM_BASE_URL`, `TEST_VENDOR_EMAIL`, Brevo settings where email test is used | `Vendor Pricing Logs`, `Email Logs`, possible `Error Logs` | Manual runner execution; simulates vendor pricing webhook payload |
| `CodeStage5.js` | Stage 5 payment setup and tracking validation | `PaymentService`, `QuoteService`, `LeadService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | `Payments`, `Quotes`, `Leads`, `Error Logs` | None directly documented | Possible `Error Logs`; payment test rows may be created | Manual runner execution |
| `CodeStage6.js` | Stage 6 Drive setup and access workflow validation | `DriveService`, `ProjectService`, `VendorService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | `Projects`, `Vendors`, `Drive Access Logs`, `Settings`, `Error Logs` | `ROOT_DRIVE_FOLDER_ID` | `Drive Access Logs`, possible `Error Logs` | Manual runner execution; external Google Drive action proof |
| `CodeStage7.js` | Stage 7 Brevo/email setup and controlled email validation | `EmailService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | `Email Logs`, `Settings`, `Error Logs` | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `TEST_EMAIL_RECIPIENT` | `Email Logs`, possible `Error Logs` | Manual runner execution; external Brevo API proof |
| `CodeStage8.js` | Stage 8 Slack setup and alert validation | `SlackService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | `Slack Logs`, `Settings`, `Error Logs` | `SLACK_WEBHOOK_URL` | `Slack Logs`, possible `Error Logs` | Manual runner execution; external Slack webhook proof |
| `CodeStage9.js` | Dashboard web app entry point and dashboard validation runner | `DashboardService`, `LeadService`, `DatabaseService`, `ConfigService`, `ErrorLogger`, HTML Service helpers | `Leads`, `Quotes`, `Projects`, `Vendors`, `Payments`, `Drive Access Logs`, `Email Logs`, `Slack Logs`, possible `Error Logs` | None directly documented | Possible `Error Logs`; dashboard actions can create lead rows through wrapper | `doGet(e)`, `include(filename)`, `getDashboardData()`, `createDashboardLead(input)`, manual Stage 9 runner |
| `CodeStage10.js` | Public `doPost(e)` router for Step 1, Step 2, and vendor pricing plus Stage 10/11 runners | `WebsiteWebhookService`, `Step2RequirementService`, `VendorPricingService`, `LeadService`, `EmailService`, `ConfigService`, `DatabaseService`, `ErrorLogger`, `ContentService` | `Leads`, `Website Webhook Logs`, `Step 2 Requirement Logs`, `Vendor Pricing`, `Vendor Pricing Logs`, `Email Logs`, `Settings`, possible `Error Logs` | `WEBSITE_WEBHOOK_TOKEN`, `STEP2_FORM_BASE_URL`, Brevo settings where acknowledgement email is used | `Website Webhook Logs`, `Step 2 Requirement Logs`, `Vendor Pricing Logs`, `Email Logs`, possible `Error Logs` | `doPost(e)` public webhook; manual Stage 10/11 runners |
| `Config.js` | Defines config constants, sheet names, required settings keys, settings lookup/validation | `DatabaseService`, Apps Script `PropertiesService` | Reads `Settings`; defines all sheet names | All required keys: `WEBSITE_WEBHOOK_TOKEN`, Brevo keys, Slack URL, Drive root, form base URLs, test emails | Possible `Error Logs` through callers | Called by setup validations and all config-dependent services |
| `DatabaseService.js` | Shared sheet access, sheet/header setup, settings map access | `ConfigService`, Apps Script `SpreadsheetApp` | Reads/writes/ensures `Settings`, `Error Logs`, `ID Counters`, `Leads`, `Quotes`, `Vendors`, `Projects`, `Payments`, and service log sheets | None directly; reads settings values for callers | Can enable log writers by ensuring log sheets | Called by nearly every service and runner |
| `Utils.js` | Sequential branded ID generation and shared utility behavior | `DatabaseService`, `ConfigService`, Apps Script `LockService` | Reads/writes `ID Counters` | None directly documented | Possible `Error Logs` through callers | Triggered by services creating leads, quotes, projects, payments, or log identifiers |
| `ErrorLogger.js` | Central unexpected failure logging | `DatabaseService`, `ConfigService`, `UtilsService`, Apps Script `SpreadsheetApp` | Writes `Error Logs` | None directly documented | `Error Logs` | Triggered by service failure paths and runner failures |
| `LeadService.js` | Lead creation, validation, defaults, reminders, Step 2 completion, qualification, quote readiness helpers | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger` | Reads/writes `Leads`; may interact with `ID Counters` through IDs | None directly documented | Possible `Error Logs`; downstream webhook logs may record lead outcomes | Triggered by website webhook, Step 2 service, dashboard wrapper, quote/project/vendor services, Stage 2 runners |
| `WebsiteWebhookService.js` | Public Step 1 website intake, token validation, honeypot suppression, payload parsing, lead normalization, webhook audit logging | `LeadService`, `DatabaseService`, `ConfigService`, `ErrorLogger`, Apps Script `PropertiesService`/web event parsing | Reads `Settings`; writes `Leads`; writes `Website Webhook Logs` | `WEBSITE_WEBHOOK_TOKEN` | `Website Webhook Logs`, possible `Error Logs` | `doPost(e)` default Step 1 route; Stage 10 payload/log runners |
| `Step2RequirementService.js` | Public Step 2 technical requirement intake, lead update, Step 2 scoring/qualification, Step 2 logging | `WebsiteWebhookService`, `LeadService`, `DatabaseService`, `ConfigService`, `ErrorLogger` | Reads/writes `Leads`; writes `Step 2 Requirement Logs`; reads settings through shared webhook validation path | `WEBSITE_WEBHOOK_TOKEN` through public webhook path | `Step 2 Requirement Logs`, possible `Error Logs` | `doPost(e)` Step 2 route; Stage 11 runners |
| `VendorPricingService.js` | Public vendor pricing intake, pricing storage, vendor pricing logging, pricing approval gate helper | `WebsiteWebhookService`, `LeadService`, `VendorService`, `QuoteService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | Reads/writes `Vendor Pricing`; writes `Vendor Pricing Logs`; reads `Leads`; may support `Quotes` gate | `WEBSITE_WEBHOOK_TOKEN` through public webhook path | `Vendor Pricing Logs`, possible `Error Logs` | `doPost(e)` vendor pricing route; Stage 4.5 runners |
| `VendorService.js` | Vendor eligibility validation, vendor assignment, sanitized vendor pricing request path | `DatabaseService`, `LeadService`, `EmailService`, `ConfigService`, `ErrorLogger` | Reads/writes `Vendors`; reads/writes `Leads`; may create `Email Logs` through `EmailService` | `VENDOR_PRICING_FORM_BASE_URL`, `TEST_VENDOR_EMAIL` for tests; Brevo settings through `EmailService` | `Email Logs` through `EmailService`; possible `Error Logs` | Stage 4 and Stage 4.5 runners; project/vendor pricing workflows |
| `QuoteService.js` | Quote creation and status lifecycle; quote gate enforcement using lead and vendor pricing readiness | `LeadService`, `VendorPricingService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | Reads/writes `Quotes`; reads `Leads`; reads `Vendor Pricing`; may touch `ID Counters` | None directly documented | Possible `Error Logs` | Stage 3 quote runners; downstream project/payment workflows |
| `ProjectService.js` | Project creation from qualified lead, eligible vendor, and accepted quote | `LeadService`, `VendorService`, `QuoteService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | Reads/writes `Projects`; reads `Leads`, `Vendors`, `Quotes`; may touch `ID Counters` | None directly documented | Possible `Error Logs` | Stage 4 project runner; downstream Drive/payment workflows |
| `PaymentService.js` | Payment record creation and payment status tracking after accepted quote | `QuoteService`, `LeadService`, `DatabaseService`, `UtilsService`, `ErrorLogger` | Reads/writes `Payments`; reads `Quotes`, `Leads`; may touch `ID Counters` | None directly documented | Possible `Error Logs` | Stage 5 payment runners; downstream project/payment visibility |
| `DriveService.js` | Project Drive folder creation, vendor access grant/remove, Drive access logging | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, Apps Script `DriveApp` | Reads/writes `Projects`; reads `Vendors`; writes `Drive Access Logs`; reads `Settings` | `ROOT_DRIVE_FOLDER_ID` | `Drive Access Logs`, possible `Error Logs` | Stage 6 Drive runners; project execution/access workflows |
| `EmailService.js` | Brevo transactional email sending, lead/Step 2/vendor communication, email audit logging | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, Apps Script `UrlFetchApp` | Writes `Email Logs`; reads `Settings`; may consume lead/vendor data from callers | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `TEST_EMAIL_RECIPIENT`; indirectly `STEP2_FORM_BASE_URL`, `VENDOR_PRICING_FORM_BASE_URL` through callers/workflows | `Email Logs`, possible `Error Logs` | Lead acknowledgement, Step 2/client email paths, vendor pricing request, Stage 7 email runner |
| `SlackService.js` | Slack alert sending and Slack audit logging | `DatabaseService`, `ConfigService`, `UtilsService`, `ErrorLogger`, Apps Script `UrlFetchApp` | Writes `Slack Logs`; reads `Settings` | `SLACK_WEBHOOK_URL` | `Slack Logs`, possible `Error Logs` | Stage 8 Slack runner; internal alert workflows |
| `DashboardService.js` | Dashboard metric aggregation and manual dashboard lead creation support | `LeadService`, `DatabaseService`, `ConfigService`, `PaymentService`, `DriveService`, `EmailService`, `SlackService`, `ErrorLogger` | Reads `Leads`, `Quotes`, `Projects`, `Vendors`, `Payments`, `Drive Access Logs`, `Email Logs`, `Slack Logs`; may write `Leads` via manual creation wrapper | None directly documented | Possible `Error Logs`; lead creation path can create normal lead audit/state | `doGet(e)` dashboard path, `getDashboardData()`, `createDashboardLead(input)`, Stage 9 runner |
| `Index.html` | Dashboard HTML template | `CodeStage9.js` include/render path, dashboard client scripts | Reads no sheets directly; uses server-side dashboard wrappers | None | None directly | Rendered by `doGet(e)` |
| `ClientJS.html` | Dashboard client-side behavior and `google.script.run` calls | `getDashboardData()`, `createDashboardLead(input)` | Reads/writes no sheets directly; calls Apps Script wrappers | None | None directly | Dashboard browser/client events |
| `Styles.html` | Dashboard styling | `include(filename)` | None | None | None | Rendered as dashboard partial |

## Settings Inventory

| Setting key | Primary consumers | Operational purpose | Restructure caution |
|---|---|---|---|
| `WEBSITE_WEBHOOK_TOKEN` | `WebsiteWebhookService`, `CodeStage10.js` routed webhooks, Step 2/vendor pricing public paths | Authenticates public webhook submissions | Do not rename without dual-read migration and payload runner proof |
| `STEP2_FORM_BASE_URL` | Step 2 email/form workflow, `EmailService` callers | Builds client Step 2 requirement links | Do not change without dry-run email/link verification |
| `VENDOR_PRICING_FORM_BASE_URL` | `VendorService`, vendor pricing email workflow | Builds vendor pricing submission links | Do not change without vendor email dry-run verification |
| `BREVO_API_KEY` | `EmailService` | Authenticates Brevo API | Do not change without Stage 7 test proof |
| `BREVO_SENDER_EMAIL` | `EmailService` | Brevo sender email | Do not change without Stage 7 dry-run proof |
| `BREVO_SENDER_NAME` | `EmailService` | Brevo sender display name | Do not change without email verification |
| `TEST_EMAIL_RECIPIENT` | Stage 7 email runner | Safe controlled test recipient | Do not use live client/vendor address for dry-run proof |
| `TEST_VENDOR_EMAIL` | Stage 4.5 vendor email runner | Safe controlled vendor test recipient | Do not use uncontrolled vendor address in tests |
| `ROOT_DRIVE_FOLDER_ID` | `DriveService` | Google Drive project root | Do not change without Stage 6 Drive proof |
| `SLACK_WEBHOOK_URL` | `SlackService` | Slack alert destination | Do not change without Stage 8 proof |

## Log Inventory

| Log sheet | Created/written by | Triggered by | Restructure caution |
|---|---|---|---|
| `Website Webhook Logs` | `WebsiteWebhookService` | Step 1 webhook and Stage 10 tests | Required for diagnosing public intake |
| `Step 2 Requirement Logs` | `Step2RequirementService` | Step 2 webhook and Stage 11 tests | Required for diagnosing qualification updates |
| `Vendor Pricing Logs` | `VendorPricingService` | Vendor pricing webhook and Stage 4.5 tests | Required for diagnosing vendor pricing |
| `Email Logs` | `EmailService` | Lead acknowledgement, Step 2/vendor emails, Stage 7 tests | Required for Brevo proof and email diagnosis |
| `Slack Logs` | `SlackService` | Slack alerts and Stage 8 tests | Required for alert proof |
| `Drive Access Logs` | `DriveService` | Drive folder/access workflows and Stage 6 tests | Required for access governance |
| `Error Logs` | `ErrorLogger` | Unexpected service failures | Required for incident diagnosis |

## Event Trigger Inventory

| Trigger | Entry point/file | Primary dependency chain | Proof runner |
|---|---|---|---|
| Step 1 public webhook | `doPost(e)` / `CodeStage10.js` | `WebsiteWebhookService` -> `LeadService` -> `EmailService` -> logs | `runStage10WebsiteWebhookPayloadTest` |
| Step 2 public webhook | `doPost(e)` / `CodeStage10.js` | `Step2RequirementService` -> `LeadService` -> logs | `runStage11Step2RequirementPayloadTest` |
| Vendor pricing public webhook | `doPost(e)` / `CodeStage10.js` | `VendorPricingService` -> `Vendor Pricing` -> logs -> quote gate | `runStage45VendorPricingWebhookPayloadTest` |
| Dashboard page load | `doGet(e)` / `CodeStage9.js` | HTML Service -> `Index.html`/partials -> dashboard client | `runStage9DashboardSetupValidation` |
| Dashboard data call | `getDashboardData()` / `CodeStage9.js` | `DashboardService` -> sheet reads | `runStage9DashboardSetupValidation` |
| Dashboard manual lead creation | `createDashboardLead(input)` / `CodeStage9.js` | `DashboardService` -> `LeadService` -> `Leads` | Dashboard smoke test plus lead row inspection |
| Manual validation runners | `Code.js`, `CodeStage*.js` | Stage-specific services and sheets | Matching runner by stage |

## Inventory Control Note

This inventory is a dependency checklist for future restructuring. Any movement or rename proposal must preserve these dependencies or include a migration plan, compatibility proof, and rollback path.