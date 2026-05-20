# MIDTS Automation Engine - Event Chain Map

Status: Stage 4 documentation-only operational intelligence. This document maps trigger relationships and progression blockers. It does not authorize functional changes.

## Event Chain Classes

| Chain class | Meaning | Examples |
|---|---|---|
| Synchronous chains | A caller triggers a service and receives an immediate result | Public `doPost(e)` webhook handling, dashboard server calls, runner execution |
| Asynchronous chains | A state change causes a later human or external action rather than immediate code continuation | Client receives Step 2 link, vendor receives pricing link, quote awaits acceptance/payment |
| Manual approval chains | Progression depends on operator/vendor/client decision or review | Vendor eligibility, vendor pricing approval, quote acceptance, payment review |
| Blocking chains | A failed validation intentionally stops downstream progression | Token failure, missing Step 2, no approved vendor pricing, ineligible vendor |
| Audit-only chains | Event is recorded for diagnosis but does not itself progress lifecycle | Error logs, webhook logs, email logs, Slack logs, Drive access logs |

## Top-Level Event Chain

```text
Website Step 1 submit
-> public webhook validation
-> lead created
-> acknowledgement/Step 2 communication
-> client Step 2 submit
-> lead updated and qualified
-> vendor assignment/pricing request
-> vendor pricing submit
-> pricing approval/review
-> quote creation
-> quote acceptance/status progression
-> project creation
-> payment tracking
-> Drive access
-> dashboard/audit visibility
```

## Trigger Matrix

| Event/source | Trigger type | Triggered system | State change | Chain class | Stops when |
|---|---|---|---|---|---|
| Website Step 1 form POST | Public HTTP POST | `doPost(e)` -> `WebsiteWebhookService` | New lead row and webhook log | Synchronous / blocking | Token missing, honeypot triggered, required fields missing, sheet write failure |
| Step 2 form POST | Public HTTP POST | `doPost(e)` -> `Step2RequirementService` | Existing lead updated, Step 2 log row | Synchronous / blocking | Token invalid, lead not found, required technical fields missing, sheet write failure |
| Vendor pricing form POST | Public HTTP POST | `doPost(e)` -> `VendorPricingService` | Vendor pricing row and log row | Synchronous / blocking | Token invalid, route mismatch, missing lead/vendor/price fields, sheet write failure |
| Dashboard load | Public/private web app GET | `doGet(e)` -> HTML dashboard | Dashboard view rendered | Synchronous / read-only | Template/render failure, missing dashboard dependencies |
| Dashboard data refresh | Client-side dashboard call | `getDashboardData()` -> `DashboardService` | Read-only metrics returned | Synchronous / read-only | Sheet read failure or missing headers |
| Dashboard manual lead creation | Client-side dashboard call | `createDashboardLead(input)` -> `DashboardService`/`LeadService` | New lead row | Synchronous / mutation | Invalid input or lead sheet failure |
| Foundation runner | Manual Apps Script execution | Stage 1 runners | Validation result, possible ID/log proof | Manual validation | Missing settings/sheets or ID/log failure |
| Lead runners | Manual Apps Script execution | Stage 2 runners | Test lead/reminder/qualification state | Manual validation | Lead validation or sheet update failure |
| Quote runners | Manual Apps Script execution | Stage 3 runners | Quote setup/status proof | Manual validation / blocking proof | Quote gate or sheet setup failure |
| Vendor/project runners | Manual Apps Script execution | Stage 4 runners | Vendor eligibility/project proof | Manual validation / blocking proof | Vendor/project gate failure |
| Vendor pricing runners | Manual Apps Script execution | Stage 4.5 runners | Pricing/log/email proof | Manual validation / blocking proof | Pricing sheet, email, or gate failure |
| Payment runners | Manual Apps Script execution | Stage 5 runners | Payment setup/status proof | Manual validation | Payment sheet or quote prerequisite failure |
| Drive runners | Manual Apps Script execution | Stage 6 runners | Drive folder/access/log proof | Manual validation / external integration | Missing root folder, permission failure, vendor/project gate failure |
| Email runners | Manual Apps Script execution | Stage 7 runners | Brevo email/log proof | Manual validation / external integration | Missing Brevo settings, bad recipient, API failure |
| Slack runners | Manual Apps Script execution | Stage 8 runners | Slack alert/log proof | Manual validation / external integration | Missing webhook URL or Slack API failure |
| Dashboard runner | Manual Apps Script execution | Stage 9 runner | Dashboard setup/read proof | Manual validation / read-only | Sheet read/header failure |
| Website webhook runners | Manual Apps Script execution | Stage 10 runners | Webhook log/test lead/email proof | Manual validation / mutation | Missing token, log sheet issue, payload validation failure |
| Step 2 runners | Manual Apps Script execution | Stage 11 runners | Step 2 update/log proof | Manual validation / mutation | Missing lead, validation failure, log failure |

## Service Trigger Relationships

| Service | Triggered by | Triggers/calls | State mutation | Failure behavior |
|---|---|---|---|---|
| `WebsiteWebhookService` | `doPost(e)`, Stage 10 runners | `LeadService`, `DatabaseService`, `ErrorLogger` | Creates lead and webhook log | Blocking for lead creation; logs failures when log path available |
| `Step2RequirementService` | `doPost(e)`, Stage 11 runners | `LeadService`, `DatabaseService`, `ErrorLogger` | Updates lead and Step 2 log | Blocking for quote readiness; logs failures when available |
| `VendorPricingService` | `doPost(e)`, Stage 4.5 runners | `DatabaseService`, `QuoteService` gate helpers, `ErrorLogger` | Creates pricing/log rows | Blocking for quote readiness; wrong linkage is high risk |
| `LeadService` | Webhooks, dashboard, runners, quote/project/vendor services | `DatabaseService`, `UtilsService`, `ErrorLogger` | Creates/updates lead state | Blocks dependent lifecycle gates when lead invalid |
| `VendorService` | Stage 4/4.5 runners, project/vendor workflows | `EmailService`, `LeadService`, `DatabaseService` | Assigns/checks vendor state; may trigger vendor email | Blocks vendor pricing/project/Drive when vendor ineligible |
| `QuoteService` | Stage 3 runners, operator/workflow calls | `LeadService`, `VendorPricingService`, `DatabaseService` | Creates/updates quote state | Blocks project/payment when quote invalid or not accepted |
| `ProjectService` | Stage 4 runners, accepted quote workflow | `LeadService`, `VendorService`, `QuoteService`, `DatabaseService` | Creates project state | Blocks Drive/payment execution when prerequisites missing |
| `PaymentService` | Stage 5 runners, accepted quote workflow | `QuoteService`, `LeadService`, `DatabaseService` | Creates/updates payment state | Blocks or misstates payment readiness if invalid |
| `DriveService` | Stage 6 runners, project/vendor access workflow | Google Drive, `DatabaseService`, `ErrorLogger` | Creates folders/grants/removes access/logs | External integration failure; requires manual review for access errors |
| `EmailService` | Lead acknowledgement, Step 2/vendor workflows, Stage 7 runners | Brevo API, `DatabaseService`, `ErrorLogger` | Sends email and logs attempt | Communication may fail while core state may already exist |
| `SlackService` | Alert callers, Stage 8 runners | Slack webhook, `DatabaseService`, `ErrorLogger` | Sends alert and logs attempt | Alert failure usually does not block core lifecycle |
| `DashboardService` | `doGet(e)`/client wrappers, Stage 9 runner | Sheet read services and `LeadService` for manual creation | Mostly read-only; manual lead creation mutates `Leads` | Dashboard failure affects visibility, not public intake |
| `DatabaseService` | All sheet-backed services | Google Sheets | Creates/reads/writes sheet records | Broad failure can stop entire system |
| `ConfigService` | All config-dependent services | `Settings`, Script Properties | Reads config; validates settings | Missing config blocks dependent integrations |
| `UtilsService` | ID-creating services | `ID Counters`, lock service | Mutates counters | ID failure can block or corrupt identity creation |
| `ErrorLogger` | Service failure paths | `Error Logs` | Writes failure audit | If logging fails, failures can appear silent |

## State Change Triggers

| State change | Triggered by | Downstream systems unlocked | Downstream systems still blocked until |
|---|---|---|---|
| Lead row created | Step 1 webhook or dashboard manual lead creation | Step 2 link/process, dashboard visibility, qualification path | Step 2 completion and qualification criteria are met |
| Step 2 completed | Step 2 webhook | Quote readiness evaluation, richer lead qualification | Lead is qualified and required gates pass |
| Lead qualified | Lead qualification service/runners | Vendor assignment, quote gate checks | Vendor pricing and quote prerequisites are met |
| Vendor assigned/eligible | Vendor service/operator setup | Vendor pricing request, project vendor gate, Drive vendor gate | Pricing submitted/approved and quote accepted |
| Vendor pricing submitted | Vendor pricing webhook | Pricing review/approval, quote pricing input | Pricing is approved where approval gate applies |
| Vendor pricing approved | Vendor pricing review/workflow | Quote creation/finalization | Quote status moves through allowed path |
| Quote created | Quote service | Quote status workflow and client commercial process | Quote is accepted or moved to required status |
| Quote accepted | Quote status workflow | Project creation, payment tracking | Project and payment prerequisites pass |
| Project created | Project service | Drive folder/access workflow, project dashboard visibility | Drive root and vendor access gates pass |
| Payment record created/updated | Payment service | Financial tracking and project readiness visibility | Payment status reaches required downstream state if enforced |
| Drive access granted | Drive service | Vendor execution access | Access remains compliant and auditable |
| Audit log row written | Service-specific logger | Diagnosis, governance review, proof evidence | No lifecycle unlock by itself |

## Blocking Chains

| Chain | Blocking condition | System that enforces it | Operational meaning |
|---|---|---|---|
| Public webhook chain | Missing/invalid `WEBSITE_WEBHOOK_TOKEN` | Webhook validation path | Reject unauthenticated submissions |
| Bot suppression chain | Honeypot triggered | `WebsiteWebhookService` | Prevent bot lead creation |
| Intake quality chain | Required lead fields missing | `WebsiteWebhookService`, `LeadService` | Prevent incomplete lead creation/progression |
| Step 2 chain | Existing lead not found or Step 2 incomplete | `Step2RequirementService`, `LeadService` | Prevent quote readiness without technical requirements |
| Quote readiness chain | Lead not qualified or no approved vendor pricing | `LeadService`, `VendorPricingService`, `QuoteService` | Prevent premature quote creation |
| Vendor eligibility chain | Vendor not approved/eligible | `VendorService` | Prevent unsafe assignment/access |
| Project chain | Lead/vendor/quote prerequisites missing | `ProjectService` | Prevent premature project creation |
| Payment chain | Quote not accepted or payment prerequisites missing | `PaymentService` | Prevent invalid payment tracking |
| Drive access chain | Project/vendor/root folder prerequisites missing | `DriveService` | Prevent unauthorized or broken file access |
| Deployment chain | `.clasp.json`/manifest target uncertain | Operator/governance process | Prevent push/deploy to wrong Apps Script project |

## Silent Or Semi-Silent Failure Areas

These areas can appear as “nothing happened” unless audit sheets and executions are checked.

| Area | Why it can look silent | First place to check | Manual intervention |
|---|---|---|---|
| `doPost(e)` route not reached | Wrong web app URL, frontend wiring issue, deployment version mismatch | Apps Script Executions | Verify frontend URL and deployment |
| Token validation failure | Handler rejects before lead creation | `Website Webhook Logs` or service-specific log | Verify `WEBSITE_WEBHOOK_TOKEN` in Settings/properties and frontend payload |
| Missing log sheet | Runtime may fail before visible business row | Setup validation runner | Run log setup validation and inspect sheet tabs |
| Email failure after lead creation | Lead exists but client/vendor gets no message | `Email Logs`, Brevo response | Verify Brevo settings and test recipient |
| Slack failure | Core workflow may continue without alert | `Slack Logs` | Verify webhook URL |
| Dashboard stale/empty | Read-only surface may fail while core data exists | Stage 9 runner and dashboard console | Verify headers and dashboard functions |
| Error logging failure | Primary error happens, then logger also fails | Apps Script Executions | Inspect execution error directly |
| Drive permission failure | Project exists but access not granted | `Drive Access Logs`, Drive runner output | Verify root folder and vendor email/access |

## Manual Intervention Chains

| Manual action | Required after | Why manual intervention matters |
|---|---|---|
| Check Apps Script Executions | Any public webhook appears silent | Confirms whether `doPost(e)` ran and whether code threw |
| Inspect log sheet rows | Any missing lead/update/pricing/email/access event | Confirms validation stage and error message |
| Verify settings keys | Token/email/Slack/Drive/form link failures | Missing keys block integrations without code changes |
| Review vendor pricing | Pricing submitted before quote creation | Prevents wrong commercial quote basis |
| Approve/verify vendor eligibility | Before assignment/project/Drive access | Prevents privacy/access issues |
| Accept/update quote status | Before project/payment progression | Commercial gate for execution |
| Review Drive access | After project setup or vendor changes | Access control is security-sensitive |
| Confirm deployment target | Before clasp/deployment operations | Prevents production project mismatch |

## Audit-Only Chains

Audit-only events should not unlock lifecycle progression by themselves.

| Audit event | Writer | Should unlock downstream flow? | Purpose |
|---|---|---|---|
| Website webhook log row | `WebsiteWebhookService` | No | Show intake validation/result |
| Step 2 log row | `Step2RequirementService` | No | Show requirement update/result |
| Vendor pricing log row | `VendorPricingService` | No | Show pricing submission/result |
| Email log row | `EmailService` | No | Show communication attempt/result |
| Slack log row | `SlackService` | No | Show alert attempt/result |
| Drive access log row | `DriveService` | No | Show access grant/remove event |
| Error log row | `ErrorLogger` | No | Show failure context |

## Synchronous Chains

| Chain | Starts with | Ends with | Notes |
|---|---|---|---|
| Step 1 webhook | Website POST | JSON response and lead/log writes | Email may be attempted within same flow depending current implementation |
| Step 2 webhook | Step 2 POST | JSON response and lead/log update | Blocks quote readiness when invalid |
| Vendor pricing webhook | Vendor POST | JSON response and pricing/log writes | Quote uses pricing later through gate checks |
| Dashboard read | Dashboard client call | Dashboard data response | Primarily read-only |
| Runner execution | Manual Apps Script run | Runner result/log/test state | Used as validation proof |

## Asynchronous Chains

| Chain | Initial event | Later event | Dependency |
|---|---|---|---|
| Lead acknowledgement to Step 2 | Lead created and email sent | Client completes Step 2 form | Email delivery and correct Step 2 URL |
| Vendor assignment to pricing | Vendor pricing request email sent | Vendor submits pricing form | Vendor receives link and understands required data |
| Quote creation to acceptance | Quote created/sent/reviewed | Quote accepted or status updated | Client/operator commercial decision |
| Project creation to Drive work | Project created | Folder/access granted and vendor begins work | Drive setup and vendor access gates |
| Payment tracking | Quote/project reaches payment stage | Payment status updated | Manual or external payment confirmation |

## Event Chain Control Note

If a future PR changes any trigger, state change, blocker, failure mode, manual intervention point, or audit-only behavior listed here, it must update this map and include the matching proof required by the operating manual and stage rules.