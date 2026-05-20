# MIDTS Automation Engine - Change Control Policy

Status: Stage 9 documentation-only change control policy. This document does not authorize code movement, renames, refactors, webhook changes, sheet changes, email/template changes, deployment changes, or functional changes.

## Purpose

This policy defines how changes are controlled for the MIDTS Automation Engine. It separates documentation changes, test changes, functional logic changes, deployment changes, and restructure work so production safety remains clear.

## Production Safety Rules

- No direct production edits.
- No direct commits to `main`.
- No Apps Script push without explicit approval.
- No production deployment without release approval.
- No production sheet structure changes without backup and validation.
- No production token or secret changes without rollback plan.
- No production email/template changes without dry-run proof.
- No production Drive access changes without permission verification.
- No public webhook changes without payload runner proof and log inspection.

## Change Categories

| Category | Description | Approval required | Required proof |
|---|---|---|---|
| Documentation-only | Markdown/docs changes only | PR review | Diff confirms docs-only scope |
| Test documentation | Test maps, checklists, proof docs | PR review | Diff confirms docs-only scope |
| Test code | New or changed test/runner behavior | Human approval | Runner proof and affected log/sheet inspection |
| Functional logic | Apps Script service, webhook, gate, email, Drive, dashboard, or sheet behavior | Human approval and PR review | Matching execution gates and rollback notes |
| Deployment | `clasp push`, Apps Script deployment, manifest, project binding, web app URL | Release approval | Deployment checklist and post-deployment smoke proof |
| Restructure | Move, rename, split, or reorganize runtime files/modules | Explicit restructure approval | Migration plan, wrappers where needed, runner proof, rollback notes |

## Merge Approval Rules

A PR may be merged only when:

- The diff matches the declared task scope.
- Required verification is complete.
- Documentation-only PRs contain no runtime edits.
- Runtime PRs list affected files, sheets, settings, webhooks, integrations, and tests.
- Critical and High Risk runtime PRs include rollback notes.
- The PR does not combine unrelated changes.
- Human approval is present when required.

A PR must not be merged when:

- Required runner proof is missing.
- Required manual inspection is missing.
- Any expected log row is missing.
- Secrets are exposed.
- Deployment target is uncertain.
- The rollback path is unclear.
- The diff includes unapproved runtime files.

## Deployment Approval Rules

Deployment approval is required before:

- `clasp push` to production Apps Script.
- Creating or changing Apps Script deployment versions.
- Changing `.clasp.json`.
- Changing `appsscript.json`.
- Changing production Web App URL usage.
- Changing production frontend webhook configuration.
- Changing production settings keys or secret values.

Deployment approval must record:

- Target Apps Script project.
- Target spreadsheet.
- Deployment version or URL.
- Affected public entry points.
- Required verification tests.
- Rollback version or rollback path.

## Emergency Freeze Conditions

Freeze runtime changes immediately if:

- New leads stop appearing after website submissions.
- Webhook logs stop appearing after controlled payload tests.
- Step 2 submissions update the wrong lead or no lead.
- Vendor pricing attaches to the wrong lead/vendor.
- Quote/project/payment gates release work too early.
- Brevo sends to the wrong recipient or no Email Logs row is written.
- Drive access is granted to the wrong account.
- Dashboard cannot load after deployment.
- Sheet setup validation fails.
- Required settings keys are missing.
- Apps Script deployment target is uncertain.
- A secret/token is exposed.

During a freeze:

- Stop all runtime edits.
- Do not deploy new versions.
- Inspect Apps Script Executions and relevant log sheets.
- Identify last known-good commit/deployment.
- Roll back the responsible change only.
- Document incident notes before resuming work.

## Rollback Triggers

Rollback must be considered when:

- Public webhook verification fails.
- A deployment routes traffic to the wrong Apps Script project.
- Production frontend points to the wrong Web App URL.
- Sheet writes go to the wrong spreadsheet or tab.
- Lead, quote, vendor, project, payment, pricing, or Drive state is corrupted.
- Email or Slack sends to an unintended destination.
- Runner proof passed in testing but fails in production.
- Error logging fails during an incident.

Rollback must be verified with the same runner or smoke test that exposed the failure when possible.

## Restructure Approval Requirements

Before any future restructure:

- A migration plan must exist.
- Affected files must be classified using the restructure candidate map.
- Affected dependencies must be listed.
- Compatibility wrappers must be planned where Apps Script globals must remain stable.
- Required runner proof must be listed.
- Sheet, settings, webhook, email, Drive, and deployment impacts must be reviewed.
- Rollback path must be documented.
- Human approval must explicitly say restructure implementation is allowed.

Restructure is not approved by a documentation-only stage.

## No Direct Production Edits

The following are forbidden without PR and approval:

- Editing production Apps Script code directly in the Apps Script editor.
- Changing production sheet structure manually.
- Editing production settings keys without recording the change.
- Updating production tokens without rollback notes.
- Changing production deployment URLs without frontend verification.
- Changing production email templates or recipients without dry-run proof.
- Changing Drive access rules without permission review.

Emergency manual changes must be documented afterward with cause, action, rollback, and verification notes.

## Separation Of Change Types

Documentation changes:

- May add or update Markdown.
- Must not include runtime files unless explicitly approved.
- Must state documentation-only in PR.

Test changes:

- Must be separated from functional logic changes when possible.
- Must not alter production behavior unless explicitly approved.
- Must include expected proof and logs.

Functional logic changes:

- Must be scoped narrowly.
- Must include runner proof.
- Must update documentation if dependencies change.
- Must include rollback notes for Critical or High Risk areas.

Deployment changes:

- Must not be bundled casually with feature/refactor work.
- Must follow deployment governance and environment checklist.
- Must include post-deployment verification.

Restructure changes:

- Must be separated from feature work.
- Must preserve behavior first.
- Must move the lowest-risk surfaces first.
- Must retain compatibility for public Apps Script globals.

## Change Control Evidence

Every future runtime PR should include evidence for:

- Scope reviewed.
- Risk classification reviewed.
- Required gates completed.
- Runner proof completed.
- Manual sheet/log inspection completed.
- Deployment target confirmed if relevant.
- Rollback path documented.

## Policy Control Note

This policy governs future change control. It does not authorize code changes, deployment changes, or restructuring by itself.