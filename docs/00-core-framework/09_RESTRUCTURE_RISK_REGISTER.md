# MIDTS Automation Engine - Future Restructure Risk Register

Status: Stage 5 documentation-only risk register for future restructuring. This document does not authorize moving, renaming, deleting, refactoring, optimizing, or modifying functional code.

## Purpose

This register identifies the main risks that would apply if the MIDTS Automation Engine is restructured in a later stage. It should be used before any future proposal to move files, rename services, introduce folders, split services, change sheet schemas, alter webhook routes, or change deployment behavior.

## Restructure Risk Scale

| Severity | Meaning | Minimum control |
|---|---|---|
| Critical | Can stop public intake, corrupt core lifecycle state, break deployment, expose access/security risk, or lose production data | Migration plan, backup, compatibility shim/dual-read where needed, runner proof, rollback plan |
| High | Can block quote/vendor/project/payment/email/Drive workflows or break operational diagnosis | Focused migration plan, runner proof, log verification, rollback notes |
| Medium | Can reduce visibility, break manual validation, or create misleading docs/tests | Targeted validation and documentation update |
| Low | Documentation or reference risk only | Documentation review |

## Future Restructure Risk Register

| Risk area | Severity | Components affected | Failure mode | Required control before restructuring |
|---|---|---|---|---|
| Public webhook entry point movement | Critical | `CodeStage10.js`, `doPost(e)`, `routeWebsiteWebhookPost_(e)` | Website, Step 2, or vendor pricing submissions stop reaching the correct handler | Preserve global `doPost(e)`, run Stage 10, Stage 11, and Stage 4.5 payload tests, inspect log sheets |
| Webhook route alias changes | Critical | Step 2 aliases, vendor pricing aliases, default Step 1 route | Payloads route to wrong service or silently reject | Alias compatibility matrix and payload runner proof for every route |
| Token validation changes | Critical | `WEBSITE_WEBHOOK_TOKEN`, `WebsiteWebhookService`, `ConfigService`, public forms | Public submissions fail or unauthenticated submissions are accepted | Dual-read migration if key changes, token validation proof, log inspection |
| Honeypot behavior changes | High | `WebsiteWebhookService`, frontend forms | Bot submissions accepted or real users rejected | Preserve accepted honeypot field names, run Step 1 payload tests, inspect `Website Webhook Logs` |
| Lead sheet schema movement/change | Critical | `Leads`, `LeadService`, Step 2, quote, vendor, project, dashboard | Lead creation/update corrupts core lifecycle data | Sheet backup, setup validation, row compatibility check, full lead/quote/project regression |
| Settings key rename | Critical | `Settings`, `ConfigService`, all integrations | Runtime config missing; webhooks/email/Slack/Drive/form links fail | Dual-read migration, setup validation, integration-specific proof |
| ID counter change | Critical | `UtilsService`, `ID Counters`, all ID-creating services | Duplicate or malformed lead/quote/project/payment IDs | Lock/ID validation and lifecycle smoke tests |
| Database layer restructure | Critical | `DatabaseService`, all sheet-backed services | Broad sheet read/write failures across system | No movement without full test matrix, backup, and rollback path |
| Error logging restructure | High | `ErrorLogger`, `Error Logs` | Failures become invisible, slowing incident response | Failure-path test and `Error Logs` inspection |
| Step 2 qualification restructure | Critical | `Step2RequirementService`, `LeadService`, `Leads`, `Step 2 Requirement Logs` | Existing leads not updated, wrong leads updated, quote gate bypassed or blocked | Stage 11 payload proof and lead row inspection |
| Vendor pricing restructure | Critical | `VendorPricingService`, `Vendor Pricing`, `Vendor Pricing Logs`, `QuoteService` | Quotes created without correct vendor pricing or pricing attaches incorrectly | Stage 4.5 webhook/workflow proof and pricing row inspection |
| Quote gate restructure | Critical | `QuoteService`, `LeadService`, `VendorPricingService`, `Quotes` | Quotes blocked forever or created before prerequisites | Stage 3 quote setup/creation/status proof |
| Vendor eligibility restructure | Critical | `VendorService`, `Vendors`, `DriveService`, `EmailService` | Ineligible vendor receives work, eligible vendor blocked, wrong vendor emailed | Stage 4 and Stage 4.5 proof, email dry-run where relevant |
| Project creation restructure | Critical | `ProjectService`, `Projects`, `LeadService`, `VendorService`, `QuoteService` | Project created too early or not created after valid acceptance | Stage 4 project creation proof and downstream Drive check |
| Payment restructure | High | `PaymentService`, `Payments`, `Quotes` | Payment tracking misstates financial readiness | Stage 5 payment setup/tracking proof |
| Drive workflow restructure | Critical | `DriveService`, `Projects`, `Vendors`, `Drive Access Logs`, `ROOT_DRIVE_FOLDER_ID` | Unauthorized access or missing project access | Stage 6 Drive access proof, root folder validation, access log inspection |
| Brevo/email restructure | Critical | `EmailService`, `Email Logs`, Brevo settings, Step 2/vendor emails | Clients/vendors receive no email or wrong email; audit missing | Stage 7 dry-run, controlled test recipient, `Email Logs` inspection |
| Slack restructure | Medium | `SlackService`, `Slack Logs`, `SLACK_WEBHOOK_URL` | Alerts missing while core workflow continues | Stage 8 alert proof and `Slack Logs` inspection |
| Dashboard restructure | High | `CodeStage9.js`, `DashboardService`, `Index.html`, `ClientJS.html`, `Styles.html` | Operators lose visibility or dashboard calls fail | Stage 9 validation plus dashboard smoke test |
| HTML template rename | High | `Index.html`, `ClientJS.html`, `Styles.html`, `include(filename)` | Dashboard render breaks | Template migration and dashboard render proof |
| Manual runner rename | High | `Code.js`, `CodeStage*.js`, all `runStage*` functions | Validation proof becomes unavailable or misleading | Preserve old runner names or document migration with operator guidance |
| Manifest/deployment change | Critical | `appsscript.json`, Apps Script deployment | Runtime/deployment behavior changes unexpectedly | Deployment review, manifest diff, deployed smoke test |
| Clasp binding change | Critical | `.clasp.json` | Push/deploy targets wrong Apps Script project | Confirm script ID before any push and record target |
| External frontend contract drift | Critical | Website forms, Step 2 form, vendor pricing form, `website-integration/**` | Frontend sends wrong payload keys or URL/token | Payload contract review and live/runner webhook proof |
| Documentation drift | Medium | `docs/**`, governance maps | Operators trust outdated dependency maps | Update docs in same PR as any approved runtime change |

## Files That Require Migration Plans Before Movement

These files must not be moved or renamed during any future restructure without a migration plan and matching proof:

- `CodeStage10.js`
- `CodeStage9.js`
- `Code.js`
- `CodeStage45VendorPricing.js`
- `CodeStage5.js`
- `CodeStage6.js`
- `CodeStage7.js`
- `CodeStage8.js`
- `WebsiteWebhookService.js`
- `Step2RequirementService.js`
- `VendorPricingService.js`
- `LeadService.js`
- `VendorService.js`
- `QuoteService.js`
- `ProjectService.js`
- `PaymentService.js`
- `DriveService.js`
- `EmailService.js`
- `SlackService.js`
- `DashboardService.js`
- `DatabaseService.js`
- `Config.js`
- `Utils.js`
- `ErrorLogger.js`
- `Index.html`
- `ClientJS.html`
- `Styles.html`
- `appsscript.json`
- `.clasp.json`

## Sheet Contracts That Require Migration Plans

Any restructure involving these tabs requires backup, setup validation, and row compatibility proof:

- `Settings`
- `Error Logs`
- `ID Counters`
- `Leads`
- `Quotes`
- `Vendors`
- `Projects`
- `Payments`
- `Website Webhook Logs`
- `Step 2 Requirement Logs`
- `Vendor Pricing`
- `Vendor Pricing Logs`
- `Email Logs`
- `Slack Logs`
- `Drive Access Logs`

## Required Future Restructure Evidence

| Restructure type | Minimum evidence before merge |
|---|---|
| Public webhook change | Stage 10, Stage 11, and/or Stage 4.5 payload proof, matching log rows, expected JSON response |
| Service file movement | Compatibility proof that global service object names still resolve, matching service runner proof |
| Sheet schema change | Backup note, setup validation, migration plan, before/after row compatibility |
| Settings key change | Dual-read or migration plan, setup validation, integration proof |
| Email/template change | Dry-run to controlled recipient, `Email Logs` row, no uncontrolled send |
| Drive/access change | Stage 6 proof, `Drive Access Logs` row, manual permission inspection |
| Dashboard/template change | Stage 9 proof and dashboard smoke test |
| Runner rename/change | Old/new runner map and operator migration note |
| Deployment/clasp change | Script ID confirmation, manifest review, deployed smoke test |

## Stop Conditions For Future Restructure

A future restructure PR must stop and not merge if:

- The diff includes unplanned runtime files.
- `doPost(e)` or `doGet(e)` changes without explicit proof.
- A public webhook creates no matching log row.
- A lead/pricing/quote/project row is created without expected audit evidence.
- A settings key is missing, renamed, or moved without migration.
- A sheet setup validation fails.
- A Brevo dry-run sends to the wrong recipient or creates no email log.
- Drive access is granted to the wrong account or not logged.
- The deployment target is uncertain.
- Rollback requires manual guessing instead of documented steps.

## Restructure Governance Rule

Future restructuring must start with the safest surface first: documentation, read-only maps, low-risk references, and compatibility wrappers. Critical and High Risk files should only move after proof shows their public names, sheet contracts, settings keys, event chains, and audit trails remain stable.