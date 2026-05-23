# MIDTS Automation Engine - Trigger Registry

Status: documentation-only operational control document. This file does not authorize Apps Script edits, file moves, renames, sheet changes, webhook changes, deployment changes, or functional changes.

## Purpose

This is the canonical owner for execution wiring: **when something happens, what wakes up, what handles it, what state changes, what gets logged, and what proves it works**.

Use this document before changing webhook routing, dashboard calls, manual runners, email dispatches, vendor pricing flows, quote gates, payment flows, Drive access behavior, or document-generation behavior.

## Trigger Ownership Rule

- `07_EVENT_CHAIN_MAP.md` keeps the high-level chain.
- This file owns the precise trigger-to-handler registry.
- If a new event or automation trigger is added, update this file in the same PR.
- If a trigger changes handler, payload shape, state mutation, audit log, or proof runner, update this file in the same PR.

## Trigger Registry

| Event ID | Event/source | Trigger type | Router/entry point | Handler/service | State mutation | Audit log | Failure behavior | Proof runner/check |
|---|---|---|---|---|---|---|---|---|
| EVT-001 | Website Step 1 form submission | Public HTTP POST | `doPost(e)` -> `routeWebsiteWebhookPost_(e)` | `WebsiteWebhookService.handlePostEvent(e)` | Creates `Leads` row | `Website Webhook Logs`; `Email Logs` if acknowledgement is sent | Reject/log invalid token, honeypot, missing required fields, sheet failure | `runStage10WebsiteWebhookPayloadTest` |
| EVT-002 | Client Step 2 requirements form | Public HTTP POST | `doPost(e)` -> `routeWebsiteWebhookPost_(e)` | `Step2RequirementService.handlePostEvent(e)` | Updates existing `Leads` row with Step 2/qualification data | `Step 2 Requirement Logs` | Reject/log invalid token, missing lead, invalid required fields, sheet failure | `runStage11Step2RequirementPayloadTest` |
| EVT-003 | Vendor pricing form submission | Public HTTP POST | `doPost(e)` -> `routeWebsiteWebhookPost_(e)` | `VendorPricingService.handlePostEvent(e)` | Updates active `Vendor Pricing` request to submitted state | `Vendor Pricing Logs` | Reject/log invalid token, no active request, duplicate submission, invalid cost/ETA | `runStage45VendorPricingWebhookPayloadTest` |
| EVT-004 | Dashboard load | Web app GET | `doGet(e)` | `CodeStage9.js` HTML template rendering | No lifecycle mutation | Apps Script execution logs; Error Logs on failure path | Render failure or missing template/dependency | `runStage9DashboardSetupValidation`; dashboard smoke test |
| EVT-005 | Dashboard data refresh | Dashboard client call | `google.script.run.getDashboardData()` | `DashboardService` | Read-only metrics returned | Error Logs on failure path | Sheet/header read failure | `runStage9DashboardSetupValidation` |
| EVT-006 | Dashboard manual lead creation | Dashboard client call | `google.script.run.createDashboardLead(input)` | `DashboardService` -> `LeadService` | Creates `Leads` row | Error Logs on failure path | Reject invalid input or sheet failure | Manual dashboard smoke test plus lead row check |
| EVT-007 | Vendor assigned to lead | Manual/operator workflow or runner | Service call | `VendorService.assignVendorToLead(...)` | Updates vendor assignment and may create `Vendor Pricing` dispatch record | `Vendor Pricing Logs`; `Email Logs` if email sent | Block ineligible vendor, duplicate active request, missing vendor email, email failure | `runStage45VendorAssignmentEmailTest`; `runStage45VendorPricingDispatchReliabilityTest` |
| EVT-008 | Vendor pricing dispatch record created | Service-internal call | `VendorService.assignVendorToLead(...)` | `VendorPricingService.createVendorPricingDispatchRecord(...)` | Appends `Vendor Pricing` row with `Requested` status | `Vendor Pricing Logs` | Block duplicate active pricing request or missing lead/vendor | `runStage45VendorPricingDispatchReliabilityTest` |
| EVT-009 | Vendor pricing approved for quote | Manual/operator workflow or runner | Service call | `VendorPricingService.approveVendorPricingForQuote(...)` | Updates `Vendor Pricing` review/pricing status | Vendor Pricing row/state; Error Logs on failure | Block if pricing is not submitted or row not found | `runStage45VendorPricingWorkflowTest` |
| EVT-010 | Quote record created | Manual/operator workflow or runner | Service call | `QuoteService.createQuoteForLead(...)` | Creates `Quotes` row | Error Logs on failure path | Block unqualified lead or missing approved vendor pricing | `runStage3QuoteCreationTest`; `runQuoteGatingTest` |
| EVT-011 | Quote status changed | Manual/operator workflow or runner | Service call | `QuoteService.updateQuoteStatus(...)` | Updates `Quotes` status | Error Logs on failure path | Block invalid transition | `runStage3QuoteStatusWorkflowTest` |
| EVT-012 | Project record created from quote | Manual/operator workflow or runner | Service call | `ProjectService.createProjectFromQuote(...)` | Creates `Projects` row only | Error Logs on failure path | Block unqualified lead, ineligible vendor, non-accepted quote | `runStage4ProjectCreationTest` |
| EVT-013 | Payment record created/updated | Manual/operator workflow or runner | Service call | `PaymentService` | Creates/updates `Payments` row | Error Logs on failure path | Block non-accepted quote or invalid payment state | `runStage5PaymentTrackingTest` |
| EVT-014 | Drive project folder created | Manual/operator workflow or Stage 6 runner; also called lazily by Drive access grant if folder missing | Service call | `DriveService.createProjectFolder(...)` | Creates Drive folder and saves `Drive Folder ID` on `Projects` | `Drive Access Logs` | Block missing `ROOT_DRIVE_FOLDER_ID`, missing project, Drive API failure | `runStage6DriveAccessWorkflowTest` |
| EVT-015 | Vendor Drive access granted/removed | Manual/operator workflow or Stage 6 runner | Service call | `DriveService.grantVendorProjectFolderAccess(...)`; `DriveService.removeVendorProjectFolderAccess(...)` | Grants/removes vendor folder access | `Drive Access Logs` | Block ineligible vendor, unassigned vendor, missing/invalid folder, Drive API failure | `runStage6DriveAccessWorkflowTest` |
| EVT-016 | Lead acknowledgement email | Service-internal call after Step 1 | `sendWebsiteLeadAcknowledgement_(...)` | `EmailService.sendLeadReceivedEmail(...)` | Communication only; lead already exists | `Email Logs` | Email failure should be visible in logs; core lead may already exist | `runStage10WebsiteWebhookPayloadTest`; Stage 7 email validation |
| EVT-017 | Slack alert sent | Manual/operator workflow or service caller | Service call | `SlackService` | Communication only | `Slack Logs` | Alert failure usually does not block lifecycle | `runStage8SlackAlertTest` |
| EVT-018 | Foundation/setup validation | Manual Apps Script execution | Apps Script runner | Stage runner functions | May create proof ID/log rows | Relevant setup/log sheets | Stop if required sheets/settings missing | `runStage1Validation`; `runStage1SmokeTest` |
| EVT-019 | Customer quote document/PDF generated | **Not wired yet** | Future service call or workflow trigger | Future `DocumentService` / template generation service | Future document row, Drive file, quote attachment/link | Future `Document Logs` or Quote/Drive log | Must block if template ID, quote, lead, Drive folder, or PDF export fails | Future runner required |
| EVT-020 | Project document pack generated | **Not wired yet** | Future service call or project creation follow-up | Future `DocumentService` / project pack generator | Future Drive files linked to `Projects` | Future `Document Logs`; `Drive Access Logs` if sharing changes | Must block if project/quote/vendor linkage is unsafe | Future runner required |

## Drive Wiring Note

Drive is currently wired as a service-level/manual workflow, not a fully automatic post-project trigger.

Current behavior:

- `ProjectService.createProjectFromQuote(...)` creates a project row only.
- `DriveService.createProjectFolder(...)` creates or returns the project Drive folder and writes the folder ID back to `Projects`.
- `DriveService.grantVendorProjectFolderAccess(...)` can create the folder lazily if missing, then grant access after vendor/project eligibility checks.
- `DriveService.removeVendorProjectFolderAccess(...)` removes vendor access and logs the action.

If the desired behavior is `project created -> Drive folder created -> vendor access prepared`, that is a future runtime change and must be implemented behind this registry, Stage 6 proof, and Drive access logs.

## Document Creation Wiring Note

Document creation is not currently wired as a runtime trigger in the inspected repository state.

No current canonical runtime service has been identified for:

- Google Docs template copy;
- Quote PDF generation;
- invoice/document pack creation;
- customer quote PDF attachment;
- project document pack creation;
- `DocumentApp` / Docs template merge workflow;
- `Document Logs` audit sheet.

Document creation should be introduced as a dedicated future stage, not hidden inside `QuoteService`, `ProjectService`, or `DriveService` without a control document and proof runner.

## Trigger Change Checklist

Before changing any trigger:

1. Identify the Event ID in this registry.
2. Confirm the public contract in `01_DEPENDENCY_LOCK_MAP.md`.
3. Confirm risk class in `02_RISK_REGISTER.md`.
4. Confirm stage permission in `04_STAGE_RULES.md`.
5. Select the matching proof runner before coding.
6. Update this registry in the same PR.

## Stop Conditions

Stop and do not continue runtime work if:

- the trigger creates state but no audit log;
- the trigger reaches the wrong handler;
- Step 2 creates a new lead instead of updating an existing one;
- vendor pricing attaches to the wrong lead/vendor;
- email/Slack/Drive action fires without a log;
- a document is created without a source record and audit trail;
- a test passes but the expected sheet row is missing.
