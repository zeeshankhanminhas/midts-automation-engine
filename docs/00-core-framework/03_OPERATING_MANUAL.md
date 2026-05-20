# Core Master Framework Operating Manual

Status: Stage 3 governance documentation only. This manual defines how future changes must be planned, reviewed, tested, and merged. It does not authorize functional changes by itself.

## Operating Principle

The MIDTS Automation Engine is an active production-stage automation system. The framework must grow around the working system first, then guide change only when dependency locks, risk classifications, and test evidence make the change safe.

The goal is controlled evolution, not cosmetic cleanup.

## Required Change Path

Every change must follow this path:

1. Identify the affected layer, service, file, sheet, settings key, webhook, and runner functions.
2. Check `docs/00_RESTRUCTURE_MAP.md` for current responsibility and dependencies.
3. Check `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md` for locked entry points, sheet names, settings keys, and rename hazards.
4. Check `docs/00-core-framework/02_RISK_REGISTER.md` for risk classification.
5. Write a change plan before touching runtime code.
6. Make the smallest possible change on a branch.
7. Run the matching validation or runner proof.
8. Open a pull request with summary, risk notes, and validation evidence.
9. Merge only after the PR proves that behavior is preserved or the migration is intentional.

## Branch And PR Rules

- No direct commits to `main`.
- Every change must go through a pull request.
- Branches should be scoped to one stage or one operational change.
- Documentation-only PRs must say they are documentation-only.
- Runtime PRs must list affected services, sheets, settings keys, webhooks, and runner functions.
- A PR that touches Critical or High Risk components must include rollback notes.
- A PR must not combine unrelated runtime changes with documentation cleanup.

## Planning Requirements

Before runtime work begins, the plan must answer:

| Question | Required answer |
|---|---|
| What layer is affected? | Use the ten Core Master Framework layers |
| What files are affected? | List exact files and risk classification |
| What public contracts are affected? | Entry points, webhook aliases, payload keys, sheet names, settings keys, global functions |
| What sheets are affected? | Tab names and any column/field assumptions |
| What settings keys are affected? | Existing keys, new keys, migration behavior |
| What tests prove safety? | Runner names, setup validations, payload tests, dry-runs, or manual checks |
| What is the rollback path? | How to restore previous behavior if the change fails |

## Review Requirements

Review must focus on operational safety first:

- Does the change alter a public Apps Script entry point?
- Does the change alter a public webhook route, token check, payload key, or response shape?
- Does the change alter a sheet tab name, column order, or required field?
- Does the change alter a settings key or config fallback path?
- Does the change alter a gate that protects quote, vendor, project, payment, Drive, or email flow?
- Does the change alter email recipients, templates, sender settings, or Brevo behavior?
- Does the change alter `.clasp.json`, `appsscript.json`, or deployment assumptions?
- Does the PR include validation evidence that matches the risk level?

## Testing Requirements By Change Type

| Change type | Required proof |
|---|---|
| Documentation only | Diff shows Markdown/docs changes only |
| Webhook behavior | Matching payload runner proof plus log sheet inspection |
| Step 1 website intake | Stage 10 setup/log/payload proof and lead row verification |
| Step 2 requirements | Stage 11 setup/payload proof and existing lead update verification |
| Vendor pricing | Stage 4.5 setup/workflow/webhook proof and vendor pricing row verification |
| Sheet structure | Setup validation, backup confirmation, migration notes, row compatibility check |
| Settings key | Setup validation and old/new key migration plan if renamed |
| Brevo/email behavior | Dry-run verification, test recipient proof, Email Logs inspection |
| Slack alert behavior | Stage 8 setup/alert proof and Slack Logs inspection |
| Drive access behavior | Stage 6 setup/access proof and Drive Access Logs inspection |
| Quote gate behavior | Stage 3 quote setup/creation/status proof |
| Vendor gate behavior | Stage 4 and Stage 4.5 proof |
| Project/payment behavior | Stage 4 project proof plus Stage 5 payment proof where applicable |
| Dashboard behavior | Stage 9 validation and dashboard smoke test |
| Deployment behavior | Manifest review, script binding verification, deployed web app smoke test |

## Merge Requirements

A PR can be merged only when:

- The branch is up to date enough to avoid stale dependency assumptions.
- The diff matches the declared scope.
- The PR does not include accidental Apps Script code edits for documentation-only work.
- Required tests or manual proofs are listed in the PR.
- Critical and High Risk changes include rollback notes.
- Any unresolved risk is explicitly accepted before merge.

## Documentation-Only Merge Checklist

Use this checklist for Stage 1, Stage 2, Stage 3, and other docs-only changes:

- Markdown/docs files only.
- No `.js`, `.html`, `.json`, `.clasp.json`, or manifest changes.
- No sheet names, settings keys, or webhook aliases changed in runtime code.
- PR description says documentation-only.
- No deployment action required.

## Runtime Change Checklist

Use this checklist before any future runtime PR:

- Affected layer identified.
- Affected risk classification identified.
- Dependency lock reviewed.
- Migration plan written for any rename, move, sheet change, settings key change, webhook change, or public function change.
- Runner proof selected before implementation.
- Rollback path written before merge.

## Strict Control Rules

- No direct `main` changes.
- No movement of Critical or High Risk files without a migration plan.
- No webhook changes without test runner proof.
- No sheet structure changes without setup validation.
- No email/template changes without dry-run verification.
- No deployment changes without deployment review.
- No security/token changes without explicit token validation proof.
- No broad refactors bundled with feature or bug fixes.

## Evidence Standards

Validation evidence should be specific. Prefer naming exact runner functions and observed outputs.

Good evidence examples:

- `runStage10WebsiteWebhookPayloadTest` created a lead row and wrote to `Website Webhook Logs`.
- `runStage11Step2RequirementPayloadTest` updated an existing lead and wrote to `Step 2 Requirement Logs`.
- `runStage45VendorPricingWebhookPayloadTest` wrote a vendor pricing row and a `Vendor Pricing Logs` row.
- Stage 7 dry-run sent to `TEST_EMAIL_RECIPIENT` and wrote to `Email Logs`.

Weak evidence examples:

- It looks fine.
- Code compiles.
- No visible error.
- I tested something manually but did not record which runner or sheet changed.

## Handling Incidents During Change

If a change causes missing leads, missing logs, broken email, or broken webhook behavior:

1. Stop making additional runtime changes.
2. Identify the last deployed version and branch/commit.
3. Check the relevant audit log sheet first.
4. Check the matching runner output second.
5. Check settings keys and token values third.
6. Roll back or revert only the responsible change.
7. Document the incident in the governance notes before continuing.

## Future Framework Evolution

Future framework folders may become operating manuals, adapters, migration plans, or wrappers. They must not become the new runtime home for Critical or High Risk code until Stage 6 rules allow movement and the dependency lock confirms that movement is safe.

The framework should make the system easier to reason about before it tries to make the repo look cleaner.