# MIDTS Automation Engine - System Baseline

Status: final governance-stage baseline documentation. This document establishes the current known-good architecture baseline before future operational scaling or controlled restructuring. It does not authorize code movement, renames, refactors, webhook changes, sheet changes, email/template changes, deployment changes, or functional changes.

## Baseline Purpose

The MIDTS Automation Engine is now documented as an active production-stage Apps Script automation system with governance, dependency, risk, topology, testing, deployment, AI, and change-control layers mapped.

This baseline freezes the current architecture as the official reference point for future work.

## Current Operational Architecture Summary

The system is a Google Apps Script automation engine backed by Google Sheets, integrated with public website forms, Brevo email, Slack alerts, and Google Drive project access.

Current core architecture:

- Public intake enters through `doPost(e)` in `CodeStage10.js`.
- Dashboard access enters through `doGet(e)` in `CodeStage9.js`.
- Operational state is stored in Google Sheets tabs.
- Settings and runtime configuration are controlled through the `Settings` sheet and/or Apps Script properties.
- Lifecycle services manage lead intake, qualification, vendor pricing, quotes, projects, payments, Drive access, email, Slack, and audit logs.
- Manual runner functions provide proof surfaces for setup, workflows, payloads, and integrations.
- Governance documentation under `docs/00-core-framework/` defines dependency locks, risk controls, topology, data flow, event chains, testing, deployment, AI usage, and change control.

## Active Workflow Layers

| Layer | Current active behavior |
|---|---|
| Intake | Website Step 1 form payloads route through `doPost(e)` to `WebsiteWebhookService` and create `Leads` rows with webhook audit logs |
| Qualification | Step 2 requirement payloads route through `doPost(e)` to `Step2RequirementService` and update existing lead readiness |
| Communication | `EmailService` handles Brevo-backed email and `SlackService` handles Slack alerts with audit logs |
| Vendor Pricing | Vendor pricing payloads route through `doPost(e)` to `VendorPricingService` and create `Vendor Pricing` / `Vendor Pricing Logs` records |
| Quotes | `QuoteService` controls quote creation and status transitions with qualification and vendor pricing gates |
| Projects | `ProjectService`, `PaymentService`, and `DriveService` manage project creation, payment tracking, and Drive access gates |
| Audit & Governance | `ErrorLogger`, service log sheets, dashboard visibility, and governance docs provide traceability |
| Intelligence-ready | Dashboard metrics, lead scoring fields, quote/pricing records, and audit logs are documented as future intelligence seeds |
| Config & Utilities | `ConfigService`, `DatabaseService`, `UtilsService`, `.clasp.json`, and `appsscript.json` remain critical infrastructure surfaces |
| Testing & Validation | Stage runner functions provide controlled proof for setup, payloads, workflow gates, and integrations |

## Currently Deployed Flow Baseline

Known deployed or deployment-sensitive flow contracts:

- Website Step 1 intake: website form -> `doPost(e)` -> `WebsiteWebhookService` -> `LeadService` -> `Leads` and `Website Webhook Logs`.
- Step 2 requirements: Step 2 form -> `doPost(e)` -> `Step2RequirementService` -> existing `Leads` row and `Step 2 Requirement Logs`.
- Vendor pricing: vendor pricing form -> `doPost(e)` -> `VendorPricingService` -> `Vendor Pricing` and `Vendor Pricing Logs`.
- Quote creation: qualified lead plus approved vendor pricing -> `QuoteService` -> `Quotes`.
- Project creation: qualified lead plus eligible vendor plus accepted quote -> `ProjectService` -> `Projects`.
- Payment tracking: accepted quote/project state -> `PaymentService` -> `Payments`.
- Drive access: valid project/vendor/access state -> `DriveService` -> Google Drive and `Drive Access Logs`.
- Dashboard: `doGet(e)` -> dashboard HTML -> `DashboardService` -> read-heavy operational visibility and controlled manual lead creation.

## Current Governance Layers

The framework now includes these governance documents:

- Restructure map.
- Dependency lock map.
- Risk register.
- Operating manual.
- Stage rules.
- System topology map.
- Data flow map.
- Event chain map.
- Apps Script dependency inventory.
- Future restructure risk register.
- Restructure candidate map.
- Safe migration sequence.
- Test coverage map.
- Execution gate checklist.
- Deployment governance.
- Environment matrix and release checklist.
- AI engineering protocol.
- Codex tasking standard.
- Change control policy.

Together these documents define the current known-good operating model and the controls required before any future runtime work.

## Current Deployment Model

The deployment model is Apps Script-first:

- GitHub repository stores source and governance documentation.
- `.clasp.json` binds the repository to the Apps Script project.
- `appsscript.json` controls Apps Script manifest/runtime behavior.
- `clasp push` is deployment-adjacent and must be approved before production use.
- Apps Script deployment versions control web app behavior.
- Public website forms must point to the intended Web App URL.
- Production runtime depends on correct spreadsheet binding, settings values, and external integration configuration.

## Current Testing Model

Testing is runner-based and manual-inspection-based:

- Stage 1 validates foundation, settings, IDs, and error logging.
- Stage 2 validates lead capture, qualification, reminder state, and nurture defaults.
- Stage 3 validates quote gates, quote creation, setup, and status workflow.
- Stage 4 validates vendor eligibility and project creation.
- Stage 4.5 validates vendor pricing setup, workflow, webhook payload, and vendor assignment email.
- Stage 5 validates payment setup and tracking.
- Stage 6 validates Drive setup and access workflow.
- Stage 7 validates Brevo/email setup and controlled test email.
- Stage 8 validates Slack setup and test alert.
- Stage 9 validates dashboard setup/read behavior.
- Stage 10 validates website webhook setup, logging, and Step 1 payload.
- Stage 11 validates Step 2 requirement setup and payload update behavior.

Deployment-affecting work also requires manual smoke tests and log/sheet inspection.

## Current AI Governance Model

AI/Codex usage is governed by:

- Documentation-first engineering.
- Explicit task scope and branch naming standards.
- Human approval gates before runtime changes.
- Mandatory review of dependency, risk, coverage, deployment, and change-control docs before code changes.
- No direct production edits.
- No invented test results.
- No deployment without approval.
- Required documentation-only confirmation when applicable.
- Change-control separation between documentation, test, functional, deployment, and restructure work.

## Known Stable Operational State

The stable baseline is defined by the existing runtime files remaining in place, existing public function names remaining available, current sheet names remaining unchanged, current settings keys remaining unchanged, and current runner functions remaining callable.

Stable baseline assumptions:

- `doPost(e)` remains the public webhook entry point.
- `doGet(e)` remains the dashboard entry point.
- `WebsiteWebhookService`, `Step2RequirementService`, and `VendorPricingService` remain public webhook service handlers.
- `Leads`, `Settings`, `Vendor Pricing`, and log sheets remain the state/audit backbone.
- Brevo, Slack, and Drive are external integrations requiring controlled verification.
- Governance docs are the source of truth for future change planning.

## Assumptions And Operational Constraints

- Apps Script global names are production contracts.
- Sheet tab names and settings keys are runtime contracts.
- Public webhook aliases and payload keys are integration contracts.
- Deployment target and spreadsheet binding must be verified before production changes.
- Runners provide proof but do not replace manual sheet/log inspection.
- Documentation-only stages do not grant permission for runtime restructuring.
- Production safety takes priority over repo cleanliness.

## Intentionally Unfinished Or Deferred

The following are intentionally deferred:

- Runtime folder restructuring.
- Moving Apps Script files into framework layer folders.
- Splitting large services.
- Renaming services or runners.
- Changing public webhook contracts.
- Changing sheet schemas.
- Changing settings key names.
- Changing deployment model.
- Adding AI/intelligence runtime behavior.
- Replacing Apps Script runner proof with automated CI.
- Modularizing Critical and High Risk services.

These items require future approval, migration planning, test proof, and rollback discipline.

## Baseline Control Note

This baseline is the official current-state reference. Future work should compare proposed changes against this baseline before planning, coding, deployment, or restructuring.