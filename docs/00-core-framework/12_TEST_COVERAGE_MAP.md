# MIDTS Automation Engine - Test Coverage Map

Status: Stage 7 documentation-only test coverage map. This document does not move, rename, delete, refactor, optimize, or modify functional code.

Source baseline:

- `docs/00-core-framework/05_SYSTEM_TOPOLOGY.md`
- `docs/00-core-framework/08_APPS_SCRIPT_DEPENDENCY_INVENTORY.md`
- `docs/00-core-framework/10_RESTRUCTURE_CANDIDATE_MAP.md`
- `docs/00-core-framework/11_SAFE_MIGRATION_SEQUENCE.md`

## Coverage Definitions

| Coverage type | Meaning |
|---|---|
| Direct runner coverage | A named Apps Script runner directly exercises the file/service or its primary behavior |
| Indirect runner coverage | A named runner exercises the file/service through another workflow, but not as the primary target |
| Manual proof required | Coverage depends on manual sheet/log/dashboard/deployment inspection after a runner or live action |
| Coverage gap | Existing maps do not identify enough proof to safely move, rename, split, or refactor the component |

## Automation Layer Coverage

| Automation layer | Existing runner functions | Primary files/services covered | Coverage type | Required manual inspection |
|---|---|---|---|---|
| Foundation / config / persistence | `runStage1Validation`, `runStage1SmokeTest` | `Config.js`, `DatabaseService.js`, `Utils.js`, `ErrorLogger.js` | Direct for setup and smoke behavior | `Settings`, `ID Counters`, `Error Logs` |
| Intake / lead capture | `runStage2LeadCaptureTest`, `runStage10WebsiteWebhookSetupValidation`, `runStage10WebsiteWebhookLogSetupTest`, `runStage10WebsiteWebhookPayloadTest` | `LeadService.js`, `WebsiteWebhookService.js`, `CodeStage10.js` | Direct for lead creation and Step 1 webhook payload path | `Leads`, `Website Webhook Logs`, `Email Logs` if acknowledgement is attempted |
| Qualification / Step 2 | `runStage2NurtureQualificationTest`, `runReminderAuditProofTest`, `runReminderStatusUpdateTest`, `testStage2NurtureDefaults`, `runStage2ReminderProcessingTest`, `runStage11Step2RequirementSetupTest`, `runStage11Step2RequirementPayloadTest` | `LeadService.js`, `Step2RequirementService.js`, `CodeStage10.js` | Direct for qualification and Step 2 payload path | `Leads`, `Step 2 Requirement Logs` |
| Quote | `runQuoteGatingTest`, `runStage3QuoteCreationTest`, `runStage3QuoteSetupValidation`, `runStage3QuoteStatusWorkflowTest` | `QuoteService.js`, `LeadService.js`, `VendorPricingService.js` gate dependency | Direct for quote behavior; indirect for lead/vendor pricing gates | `Quotes`, `Leads`, `Vendor Pricing` |
| Vendor eligibility / assignment | `runStage4VendorEligibilityTest`, `runStage4ProjectCreationTest`, `runStage45VendorAssignmentEmailTest` | `VendorService.js`, `ProjectService.js`, `EmailService.js` | Direct for vendor eligibility; indirect for project/email | `Vendors`, `Leads`, `Projects`, `Email Logs` |
| Vendor pricing | `runStage45VendorPricingSetupValidation`, `runStage45VendorPricingWorkflowTest`, `runStage45VendorPricingWebhookPayloadTest`, `runStage45VendorAssignmentEmailTest` | `VendorPricingService.js`, `VendorService.js`, `QuoteService.js`, `EmailService.js` | Direct for pricing setup/workflow/webhook; indirect for quote/email | `Vendor Pricing`, `Vendor Pricing Logs`, `Quotes`, `Email Logs` |
| Payment | `runStage5PaymentSetupValidation`, `runStage5PaymentTrackingTest` | `PaymentService.js`, `QuoteService.js`, `LeadService.js` | Direct for payment; indirect for quote/lead prerequisites | `Payments`, `Quotes`, `Leads` |
| Project execution | `runStage4ProjectCreationTest`, `runStage5PaymentTrackingTest`, `runStage6DriveAccessWorkflowTest` | `ProjectService.js`, `PaymentService.js`, `DriveService.js` | Direct for project/Drive via specific runners; indirect across payment | `Projects`, `Payments`, `Drive Access Logs` |
| Drive access | `runStage6DriveSetupValidation`, `runStage6DriveAccessWorkflowTest` | `DriveService.js`, Google Drive integration | Direct | `Drive Access Logs`, Drive folder/access permissions |
| Email / Brevo | `runStage7EmailSetupValidation`, `runStage7BrevoEmailTest`, `runStage45VendorAssignmentEmailTest`, `runStage10WebsiteWebhookPayloadTest` | `EmailService.js`, Brevo API, email audit path | Direct for Stage 7; indirect through vendor and intake flows | `Email Logs`, controlled test inbox |
| Slack | `runStage8SlackSetupValidation`, `runStage8SlackAlertTest` | `SlackService.js`, Slack webhook | Direct | `Slack Logs`, Slack destination |
| Dashboard | `runStage9DashboardSetupValidation` plus dashboard smoke test | `CodeStage9.js`, `DashboardService.js`, `Index.html`, `ClientJS.html`, `Styles.html` | Direct for setup/read path; manual for browser/client behavior | Dashboard render, data refresh, manual lead create test |
| Public webhooks | `runStage10WebsiteWebhookPayloadTest`, `runStage11Step2RequirementPayloadTest`, `runStage45VendorPricingWebhookPayloadTest` | `doPost(e)`, `routeWebsiteWebhookPost_(e)`, public service handlers | Direct simulated payload coverage; live web app still needs smoke proof before deployment | Matching log sheets and JSON response behavior |
| Deployment / manifest | No functional runner identified | `.clasp.json`, `appsscript.json`, Apps Script deployment | Coverage gap | Script ID confirmation, manifest review, deployed smoke test |

## File And Service Coverage Matrix

| File/service | Direct coverage | Indirect coverage | Current coverage judgment | Coverage needed before future move/split |
|---|---|---|---|---|
| `.clasp.json` | None | Deployment process only | Coverage gap | Script ID confirmation and deployment smoke test |
| `appsscript.json` | None | Deployment/runtime behavior | Coverage gap | Manifest diff review and deployed smoke test |
| `Code.js` | Stage 1-4 runners live here | Services exercised by Stage 1-4 runners | Partial direct coverage | Runner availability map and Stage 1-4 proof before movement |
| `CodeStage45VendorPricing.js` | Stage 4.5 runners | Vendor/pricing/email/quote workflows | Good direct runner coverage, but high-risk | All Stage 4.5 runners must pass before movement |
| `CodeStage5.js` | Stage 5 runners | Quote/lead prerequisites | Direct for payment runners | Stage 5 setup/tracking proof |
| `CodeStage6.js` | Stage 6 runners | Project/vendor/Drive dependencies | Direct for Drive runners | Stage 6 proof plus Drive permission inspection |
| `CodeStage7.js` | Stage 7 runners | Brevo settings and email logs | Direct for email test runner | Stage 7 dry-run proof with controlled recipient |
| `CodeStage8.js` | Stage 8 runners | Slack setting/logs | Direct for Slack runner | Stage 8 proof |
| `CodeStage9.js` | Stage 9 runner; dashboard entry points | Dashboard browser behavior | Partial; manual browser proof needed | Dashboard render, data refresh, manual lead test |
| `CodeStage10.js` | Stage 10/11 runners; public webhook router | Vendor pricing payload route via Stage 4.5 | Strong simulated webhook coverage; live deployment proof still required | Stage 10/11/4.5 payload proof and deployed web app smoke test |
| `Config.js` | Stage 1 setup validation | All integration tests read settings | Direct setup coverage, broad indirect coverage | Full setup validation and required key check |
| `DatabaseService.js` | Stage 1 setup validation | Every sheet-backed runner | Broad indirect coverage | Full sheet setup validation and backup plan before movement |
| `Utils.js` | Stage 1 smoke test | ID-creating services across runners | Partial direct, broad indirect | ID counter duplicate/fallback proof before movement |
| `ErrorLogger.js` | Stage 1 smoke/failure paths where available | Service failure paths | Partial | Explicit failure-path proof before movement |
| `LeadService.js` | Stage 2 runners, Stage 10 payload test | Step 2, quote, vendor, project, payment, dashboard | Strong but distributed | Full lead capture, Step 2, quote gate, project regression proof |
| `WebsiteWebhookService.js` | Stage 10 setup/log/payload tests | `doPost(e)` route | Strong simulated coverage | Token, honeypot, lead/log proof plus deployed route smoke test |
| `Step2RequirementService.js` | Stage 11 setup/payload tests | Lead/quote readiness tests | Strong simulated coverage | Existing lead update proof and Step 2 log inspection |
| `VendorPricingService.js` | Stage 4.5 setup/workflow/webhook tests | Quote gate tests | Strong simulated coverage | Pricing row/log proof and quote gate proof |
| `VendorService.js` | Stage 4 vendor eligibility, Stage 4.5 assignment email | Project/Drive workflows | Good direct/indirect coverage | Eligibility, assignment email, Drive gate proof |
| `QuoteService.js` | Stage 3 quote tests | Vendor pricing/project/payment workflows | Strong direct coverage | Quote status and vendor pricing prerequisite proof |
| `ProjectService.js` | Stage 4 project creation test | Payment and Drive workflows | Direct plus indirect | Project creation plus Drive/payment downstream proof |
| `PaymentService.js` | Stage 5 payment tests | Project/quote workflows | Direct | Stage 5 setup/tracking proof |
| `DriveService.js` | Stage 6 Drive tests | Project/vendor workflows | Direct but external/manual sensitive | Stage 6 proof plus manual Drive permission inspection |
| `EmailService.js` | Stage 7 email tests | Step 1 acknowledgement and vendor assignment email tests | Direct plus indirect | Controlled dry-run, `Email Logs`, recipient proof |
| `SlackService.js` | Stage 8 Slack tests | Internal alert flows | Direct | Stage 8 alert/log proof |
| `DashboardService.js` | Stage 9 setup validation | Dashboard browser/client behavior | Partial direct; manual UI proof needed | Dashboard render, data refresh, manual lead creation proof |
| `Index.html` | Dashboard smoke test only | Stage 9 setup may catch some issues indirectly | Indirect/manual | Browser render proof before movement |
| `ClientJS.html` | Dashboard smoke test only | `google.script.run` wrapper calls | Indirect/manual | Browser interaction proof before movement |
| `Styles.html` | Dashboard smoke test only | Visual inclusion path | Indirect/manual | Browser render proof before movement |
| `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md` | Documentation review | N/A | Documentation-only | Review accuracy against current webhook docs |
| `website-integration/**` | Payload contract review | Stage 10 live/front-end tests | Indirect/reference | Frontend/backend payload contract proof |
| `docs/**` | Documentation review | N/A | Documentation-only | Review links and consistency |
| `AGENTS.md` | Governance review | N/A | Documentation/governance | Review against current operating rules |

## Direct Coverage Summary

| Service/file group | Direct runner coverage exists? | Runner names |
|---|---|---|
| Foundation/config/sheets | Yes | `runStage1Validation`, `runStage1SmokeTest` |
| Lead capture | Yes | `runStage2LeadCaptureTest`, `runStage10WebsiteWebhookPayloadTest` |
| Lead qualification/reminders | Yes | `runStage2NurtureQualificationTest`, `runReminderAuditProofTest`, `runReminderStatusUpdateTest`, `testStage2NurtureDefaults`, `runStage2ReminderProcessingTest` |
| Step 2 | Yes | `runStage11Step2RequirementSetupTest`, `runStage11Step2RequirementPayloadTest` |
| Quote | Yes | `runQuoteGatingTest`, `runStage3QuoteCreationTest`, `runStage3QuoteSetupValidation`, `runStage3QuoteStatusWorkflowTest` |
| Vendor eligibility/project | Yes | `runStage4VendorEligibilityTest`, `runStage4ProjectCreationTest` |
| Vendor pricing | Yes | `runStage45VendorPricingSetupValidation`, `runStage45VendorPricingWorkflowTest`, `runStage45VendorPricingWebhookPayloadTest`, `runStage45VendorAssignmentEmailTest` |
| Payment | Yes | `runStage5PaymentSetupValidation`, `runStage5PaymentTrackingTest` |
| Drive | Yes | `runStage6DriveSetupValidation`, `runStage6DriveAccessWorkflowTest` |
| Email | Yes | `runStage7EmailSetupValidation`, `runStage7BrevoEmailTest` |
| Slack | Yes | `runStage8SlackSetupValidation`, `runStage8SlackAlertTest` |
| Dashboard setup | Yes | `runStage9DashboardSetupValidation` |
| Dashboard UI/browser behavior | Partial/manual | Dashboard smoke test required |
| Deployment/manifest/clasp | No runner | Manual deployment checklist required |

## Coverage Gaps Before Future Restructure

These areas need stronger proof before any future code movement, rename, split, refactor, or folder restructure:

- Deployment binding and manifest behavior: no runner covers `.clasp.json` or `appsscript.json`.
- Dashboard browser behavior: Stage 9 covers setup/read path, but UI render and `google.script.run` behavior need manual smoke proof.
- HTML template movement: `Index.html`, `ClientJS.html`, and `Styles.html` depend on Apps Script include/render names.
- Error failure paths: `ErrorLogger` is broadly used but needs explicit failure-path proof before movement.
- ID generation edge cases: `UtilsService` needs duplicate/fallback/lock behavior proof before movement.
- Live public web app behavior: simulated payload runners exist, but deployment changes need deployed smoke tests.
- Frontend/backend contract drift: `website-integration/**` needs payload contract checks against current webhook aliases and keys.
- Email templates/recipients: Stage 7 dry-run is required before any communication restructure.
- Drive permissions: Stage 6 runner must be paired with manual permission inspection.

## Manual Apps Script Tests Required Before Deployment

Before any future deployment-affecting change, run or verify the relevant subset below. For broad restructure, run all.

| Required before deployment | Runner/manual test | Must verify |
|---|---|---|
| Foundation still works | `runStage1Validation`, `runStage1SmokeTest` | Required sheets/settings/ID/error logging are valid |
| Lead capture works | `runStage2LeadCaptureTest` | Test lead row is created correctly |
| Qualification works | `runStage2NurtureQualificationTest` and reminder runners as relevant | Lead qualification/reminder state behaves as expected |
| Quote gates work | `runQuoteGatingTest`, `runStage3QuoteCreationTest`, `runStage3QuoteStatusWorkflowTest` | Quotes require proper prerequisites and status transitions |
| Vendor gates work | `runStage4VendorEligibilityTest`, `runStage4ProjectCreationTest` | Ineligible vendors are blocked and projects require prerequisites |
| Vendor pricing works | Stage 4.5 runners | Pricing row/log/email behavior is intact |
| Payment works | Stage 5 runners | Payment setup/tracking remains valid |
| Drive works | Stage 6 runners | Drive logs and permissions are correct |
| Email works | Stage 7 runners | Controlled test email and `Email Logs` row exist |
| Slack works | Stage 8 runners | Slack alert and `Slack Logs` row exist |
| Dashboard works | `runStage9DashboardSetupValidation` plus browser smoke test | Dashboard renders and server calls work |
| Step 1 webhook works | `runStage10WebsiteWebhookPayloadTest` | Lead and `Website Webhook Logs` row exist |
| Step 2 webhook works | `runStage11Step2RequirementPayloadTest` | Existing lead update and `Step 2 Requirement Logs` row exist |
| Vendor pricing webhook works | `runStage45VendorPricingWebhookPayloadTest` | `Vendor Pricing` and `Vendor Pricing Logs` rows exist |
| Deployment route works | Live web app smoke test | `doPost(e)` and/or `doGet(e)` respond as expected |

## Coverage Control Note

This map documents proof coverage only. It does not permit any runtime change. Future restructure PRs must update this map when coverage changes.