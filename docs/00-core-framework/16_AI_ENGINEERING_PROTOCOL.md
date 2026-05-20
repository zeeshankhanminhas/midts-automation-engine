# MIDTS Automation Engine - AI Engineering Protocol

Status: Stage 9 documentation-only AI governance. This document does not authorize code movement, renames, refactors, webhook changes, sheet changes, email/template changes, deployment changes, or functional changes.

## Purpose

This protocol defines how AI assistants, Codex, and human reviewers must work on the MIDTS Automation Engine. The system is production-sensitive, Apps Script-backed, sheet-backed, and externally connected. AI may help plan, document, inspect, and implement only when the proper gates are satisfied.

## Documentation-First Engineering Rules

- Start by reading the existing framework documentation before proposing code changes.
- Prefer mapping, dependency discovery, and risk classification before implementation.
- Update governance documentation when a future approved code change alters dependencies, sheets, settings, event chains, tests, or deployment behavior.
- Do not treat structural cleanliness as a reason to move working code.
- Do not simplify or refactor production code unless the task explicitly authorizes functional work and the execution gates are complete.
- For documentation-only tasks, add or edit only Markdown documentation explicitly in scope.

## Safe AI Usage Boundaries

AI may:

- Summarize current architecture.
- Create governance documentation.
- Identify dependencies and risks.
- Draft migration plans.
- Draft test plans and checklists.
- Review diffs for scope compliance.
- Prepare PR descriptions and verification notes.

AI must not, without explicit task approval:

- Move Apps Script files.
- Rename files, functions, services, sheets, settings keys, or webhook aliases.
- Change `doPost(e)`, `doGet(e)`, dashboard wrappers, or runner names.
- Change webhook behavior or response shape.
- Change sheet structure.
- Change Brevo/email templates, recipients, sender behavior, or routing.
- Change Slack, Drive, deployment, clasp, or manifest behavior.
- Push to Apps Script or deploy production changes.

## Human Approval Gates

Human approval is required before:

- Any functional code change.
- Any Apps Script push.
- Any production deployment.
- Any public webhook change.
- Any sheet structure or settings key change.
- Any email/template/recipient change.
- Any Drive access behavior change.
- Any `.clasp.json` or `appsscript.json` change.
- Any movement or rename of Critical or High Risk files.

Approval must include the intended scope, affected environment, verification plan, and rollback path.

## Mandatory Review Sequence Before Code Changes

Before Codex or any AI agent edits runtime code, complete this sequence:

1. Read `docs/00_RESTRUCTURE_MAP.md`.
2. Read `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md`.
3. Read `docs/00-core-framework/02_RISK_REGISTER.md`.
4. Read `docs/00-core-framework/08_APPS_SCRIPT_DEPENDENCY_INVENTORY.md`.
5. Read `docs/00-core-framework/12_TEST_COVERAGE_MAP.md`.
6. Read `docs/00-core-framework/13_EXECUTION_GATE_CHECKLIST.md`.
7. Read deployment governance docs if deployment, clasp, manifest, secrets, or environments are affected.
8. Identify affected files, services, sheets, settings keys, webhooks, runner functions, and integrations.
9. Select required tests and manual inspections.
10. Confirm human approval for the code-change scope.

Stop if the affected surface or required proof cannot be stated clearly.

## Rollback Discipline

Every AI-assisted runtime change must include rollback notes before merge.

Rollback notes must identify:

- Previous known-good commit.
- Previous Apps Script deployment/version if deployment is affected.
- Previous settings values if settings are changed.
- Sheet backup or restoration plan if sheet structure is changed.
- Runners and manual inspections required to verify rollback.

AI must not recommend merging a Critical or High Risk change without a rollback path.

## Rules For Future Restructuring

- Runtime restructuring must follow the safe migration sequence.
- Critical and High Risk files remain in place until compatibility and test proof exist.
- Public Apps Script global names must remain stable unless wrappers preserve them.
- Sheet names and settings keys must not change without migration.
- Runners must remain callable until replacements are proven and documented.
- Move one risk area at a time.
- Do not combine restructure with feature changes.

## Production-Sensitive Areas

Treat these as production-sensitive:

- `doPost(e)` and public webhook routing.
- `doGet(e)` and dashboard wrappers.
- `WebsiteWebhookService`, `Step2RequirementService`, and `VendorPricingService`.
- `LeadService`, `QuoteService`, `VendorService`, `ProjectService`, `PaymentService`, and `DriveService`.
- `DatabaseService`, `ConfigService`, `UtilsService`, and `ErrorLogger`.
- `EmailService`, Brevo settings, email templates, and recipients.
- `SlackService` and Slack webhook settings.
- `.clasp.json`, `appsscript.json`, and deployment versions.
- `Settings`, `Leads`, `Quotes`, `Vendors`, `Projects`, `Payments`, `Vendor Pricing`, and all log sheets.

## Forbidden AI Actions

AI must not:

- Make direct production edits.
- Push to Apps Script without explicit human approval.
- Deploy a new Apps Script version without explicit human approval.
- Expose tokens, API keys, webhooks, or secrets in docs, PRs, logs, or comments.
- Invent test results.
- Claim deployment success without verification evidence.
- Remove validation runners.
- Bypass PR review.
- Merge runtime changes without required proof.
- Treat documentation-only approval as approval for code changes.

## Documentation-Only Confirmation

For documentation-only tasks, the final response and PR must confirm:

- No Apps Script files changed.
- No deployment files changed.
- No existing functional files were modified.
- No webhook behavior changed.
- No sheet structure changed.
- No email/template behavior changed.
- The PR is documentation-only.