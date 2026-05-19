# MIDTS Dependency Governance Matrix

## Purpose
This document establishes a governed operational baseline with verified dependencies before any additional workflow implementation is approved.

## Scope
- Governs cross-stage dependencies for lead, qualification, vendor pricing, quote, payment, project, Drive access, email, Slack, dashboard, and website webhook pathways.
- Defines verification status for each required operational dependency.

## Dependency Verification Status Key
- **Verified**: Dependency exists and has a documented validation method.
- **Partially Verified**: Dependency exists, but validation is incomplete or not yet repeatable.
- **Blocked**: Dependency missing, inconsistent, or not yet governable.

## Operational Dependency Matrix

| Domain | Dependency | Required Artifact / Key | Verification Method | Current Status | Owner Action |
|---|---|---|---|---|---|
| Governance | Master restructure map | `docs/core-master-framework/00_RESTRUCTURE_MAP.md` | File existence check in repo | Blocked | Restore or create document and version-control it. |
| Governance | Stage gate policy | Root `AGENTS.md` | Manual review against stage rules | Verified | Keep aligned to delivery stages. |
| Settings | Core configuration | `Settings` sheet keys (`BREVO_API_KEY`, `SLACK_WEBHOOK_URL`, `ROOT_DRIVE_FOLDER_ID`, `WEBSITE_WEBHOOK_TOKEN`, `STEP2_FORM_BASE_URL`) | Run `runStage1Validation()` and inspect response | Partially Verified | Complete Settings values in runtime environment and re-run validation. |
| Database | ID counter durability | `ID Counters` sheet | Run `runStage1Validation()` and verify sheet exists with counters | Partially Verified | Confirm per-type independent counters and audit snapshots. |
| Database | Vendor pricing schema completeness | `Vendor Pricing` sheet required governance headers | Header diff checklist against AGENTS schema | Blocked | Align headers to governance-required fields before logic changes. |
| Database | Fixed headers and append-only evolution | All managed Sheets tabs | Manual schema inspection + stage setup tests | Partially Verified | Add formal schema contract checklist per sheet. |
| Security | Secret isolation | No secrets in HTML/client files | Static scan of HTML/JS files | Partially Verified | Add recurring scan checklist before deploy. |
| Security | Vendor access controls | NDA/ID/Approval checks before Drive sharing | Run Stage 6 workflow test paths and inspect outcomes | Partially Verified | Add explicit negative-case test record and log assertion. |
| Workflow Contract | Quote gate dependency | Vendor Pricing Status `Submitted` + Review Status `Approved for Quote` | Run vendor pricing + quote path tests | Partially Verified | Add explicit contract test preventing quote generation pre-approval. |
| Pricing Governance | Margin model governance | Fixed margin or multiplier formula contract | Documentation review + unit-style test plan | Blocked | Publish margin contract and acceptance criteria before quote logic edits. |
| Integrations | Brevo readiness | `BREVO_API_KEY`, sender config, Email Logs sheet | `runStage7EmailSetupValidation()` + optional controlled send | Partially Verified | Validate non-prod sender + redact logs in evidence pack. |
| Integrations | Slack readiness | `SLACK_WEBHOOK_URL`, Slack Logs sheet | `runStage8SlackSetupValidation()` + controlled alert | Partially Verified | Verify webhook channel binding and log correlation IDs. |
| Integrations | Drive root and permissions | `ROOT_DRIVE_FOLDER_ID` and folder policy | `runStage6DriveSetupValidation()` | Partially Verified | Validate root ownership/admin continuity and sharing boundaries. |
| Integrations | Website webhook contract | `WEBSITE_WEBHOOK_TOKEN` + deployed Web App URL | `runStage10WebsiteWebhookSetupValidation()` + payload test | Partially Verified | Add end-to-end website-to-webapp confirmation evidence. |
| Integrations | Step 2 requirement flow | `STEP2_FORM_BASE_URL` + Step2 sheet contract | `runStage11Step2RequirementSetupTest()` | Partially Verified | Verify website form field contract and downstream gating map. |
| Auditability | Error and operational logs | Error/Email/Slack/Drive/System log sheets | Run stage tests and confirm log entries | Partially Verified | Add centralized audit report checklist per release. |

## Mandatory Gate Before New Implementation
All items marked **Blocked** must be moved to **Verified** before introducing new workflow code. Items marked **Partially Verified** must include reproducible evidence in a release checklist.

## Evidence Pack Requirements
For each dependency marked Verified, capture:
1. Date/time of verification (UTC).
2. Verifier identity.
3. Command/function executed.
4. Output summary.
5. Link to screenshot or log record.

## Recommended Next Controlled Step
1. Create/restore `docs/core-master-framework/00_RESTRUCTURE_MAP.md`.
2. Run all setup validation functions (Stages 1, 6, 7, 8, 10, 11) and capture evidence.
3. Reconcile Vendor Pricing headers to governance contract in documentation first.
4. Approve a margin governance contract document before quote logic revisions.


## Verification Runbook (Repository + Apps Script)

Use this sequence for repeatable verification evidence collection:

1. Repository checks (local):
   - Confirm required docs exist.
   - Confirm governance files are tracked in git.
2. Apps Script setup checks (runtime):
   - Run `runStage1Validation()`
   - Run `runStage6DriveSetupValidation()`
   - Run `runStage7EmailSetupValidation()`
   - Run `runStage8SlackSetupValidation()`
   - Run `runStage10WebsiteWebhookSetupValidation()`
   - Run `runStage11Step2RequirementSetupTest()`
3. Record evidence in the template below for each dependency.

## Evidence Record Template

| Field | Required Value |
|---|---|
| Verification Date (UTC) | ISO timestamp (for example `2026-05-19T14:30:00Z`) |
| Dependency ID | Matrix row identifier (for example `DEP-GOV-001`) |
| Verifier | Name or role |
| Method | Command or Apps Script function |
| Result | Verified / Partially Verified / Blocked |
| Evidence Link | Log row ID, screenshot path, or document link |
| Notes | Blocking detail or follow-up action |

## Dependency IDs

Use these IDs when recording evidence and release gates:

- `DEP-GOV-001` Master restructure map
- `DEP-GOV-002` Stage gate policy
- `DEP-SET-001` Core settings configuration
- `DEP-DB-001` ID counters durability
- `DEP-DB-002` Vendor pricing schema completeness
- `DEP-DB-003` Fixed header schema governance
- `DEP-SEC-001` Secret isolation
- `DEP-SEC-002` Vendor access controls
- `DEP-WF-001` Quote gate dependency
- `DEP-PRI-001` Margin model governance
- `DEP-INT-001` Brevo readiness
- `DEP-INT-002` Slack readiness
- `DEP-INT-003` Drive root and permissions
- `DEP-INT-004` Website webhook contract
- `DEP-INT-005` Step 2 requirement flow
- `DEP-AUD-001` Audit log coverage
