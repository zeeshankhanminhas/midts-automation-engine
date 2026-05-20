# MIDTS Automation Engine - Codex Tasking Standard

Status: Stage 9 documentation-only Codex governance. This document does not authorize code movement, renames, refactors, webhook changes, sheet changes, email/template changes, deployment changes, or functional changes.

## Purpose

This standard defines how tasks should be given to Codex or any AI engineering assistant working on the MIDTS Automation Engine. Its goal is to make task scope, safety boundaries, verification evidence, and PR expectations explicit.

## Standard Task Format

Use this structure for future tasks:

```text
Stage / Task name:

Task type:
- Documentation only
- Test only
- Functional code change
- Deployment change
- Restructure planning
- Approved restructure implementation

Scope:
- Files/folders allowed
- Files/folders forbidden

Required reading:
- Governance docs
- Dependency docs
- Risk docs
- Test coverage docs

Required output:
- Exact files to create or edit
- Expected PR title
- Expected verification notes

Hard constraints:
- No direct main changes
- No Apps Script edits unless explicitly allowed
- No deployment changes unless explicitly allowed
- No webhook changes unless explicitly allowed
- No sheet changes unless explicitly allowed
- No email/template changes unless explicitly allowed

Verification before PR:
- Exact diff expectations
- Required runner proof
- Required manual inspection
```

## Branch Naming Rules

Use branch names that describe the stage and scope.

Recommended pattern:

```text
codex/stageN-short-purpose
```

Examples:

- `codex/stage9-ai-governance`
- `codex/stage8-deployment-governance`
- `codex/stage7-test-coverage-map`

Rules:

- Use the `codex/` prefix unless the operator asks otherwise.
- Use one branch per task.
- Do not reuse old branches for unrelated work.
- Do not combine documentation-only and runtime changes on the same branch.

## PR Title Expectations

The PR title must match the task when the user provides one.

If no title is provided, use:

```text
Add Stage N [short governance scope]
```

For documentation-only PRs, the title should avoid implying runtime behavior changed.

## PR Body Expectations

Every PR body should include:

- Summary of added/changed files.
- Safety statement.
- Verification statement.
- Explicit documentation-only confirmation when applicable.
- Runner proof and manual inspection evidence for runtime changes.
- Rollback notes for Critical or High Risk runtime changes.

Documentation-only PR safety language:

```text
Documentation-only change.

No Apps Script code changes, file moves, renames, deletions, refactors, webhook changes, sheet structure changes, email/template changes, deployment changes, or functional changes.
```

## Verification Checklist

Before opening a documentation-only PR:

- [ ] Confirm only requested Markdown files were added or edited.
- [ ] Confirm no `.js` files changed.
- [ ] Confirm no `.html` files changed.
- [ ] Confirm no `.json`, `.clasp.json`, or manifest files changed.
- [ ] Confirm no existing files were modified when the task says only add files.
- [ ] Confirm no functional behavior changed.
- [ ] Confirm PR body states documentation-only.

Before opening a code-change PR:

- [ ] Confirm human approval for functional work.
- [ ] Identify affected risk areas.
- [ ] Complete the execution gate checklist.
- [ ] Run required Apps Script runners.
- [ ] Inspect required sheets/logs.
- [ ] Record rollback notes.
- [ ] Update governance docs if dependencies changed.

## Stage-Based Delivery Rules

| Stage type | Codex behavior |
|---|---|
| Documentation/mapping | Add or update Markdown only within requested scope |
| Dependency/risk mapping | Identify contracts and risks; do not alter runtime |
| Governance documentation | Define process, gates, and policies; do not alter runtime |
| Test coverage documentation | Map proof and gaps; do not add tests unless explicitly approved |
| Deployment governance | Document release controls; do not deploy |
| Functional code change | Only proceed with explicit approval and matching gates |
| Restructure implementation | Only proceed when migration plan, wrappers, and proof are approved |

## Documentation-Only Task Rules

For documentation-only tasks, Codex must:

- Treat the task as non-runtime.
- Add only the requested Markdown files when exact paths are provided.
- Avoid changing existing files unless explicitly requested.
- Avoid editing Apps Script, HTML templates, manifest, clasp files, or frontend examples.
- Verify the diff before PR.
- State that no functional code was touched.

## Code-Change Task Rules

For code-change tasks, Codex must:

- Confirm the user explicitly authorized code changes.
- Read the dependency and risk docs first.
- Identify affected runtime contracts.
- Use the smallest possible change.
- Preserve public Apps Script globals unless a migration wrapper is approved.
- Preserve sheet names, settings keys, webhook aliases, and runner names unless migration is approved.
- Run or request the required proof.
- Update documentation when dependencies or gates change.

## Forbidden Prompt Patterns

These task patterns are unsafe and should be rejected or clarified:

- “Clean up the repo” without explicit scope.
- “Refactor everything” without risk review.
- “Move files into folders” without migration plan.
- “Push to Apps Script” without target confirmation.
- “Deploy it” without release checklist.
- “Fix the webhook” without identifying affected route and proof.
- “Update the sheet” without schema and backup plan.
- “Change the email” without dry-run recipient and Email Logs proof.
- “Use the production token in the file.”
- “Skip tests.”
- “Just merge it” for runtime changes without evidence.

## Required Documentation-Only Confirmation

When a task is documentation-only, Codex must confirm before PR and in the final response:

- Exactly what Markdown files were added or modified.
- No Apps Script files changed.
- No deployment files changed.
- No existing files were modified if the task required only additions.
- No webhook behavior changed.
- No sheet structure changed.
- No email/template behavior changed.
- No functional logic changed.

## Final Response Standard

Final responses should include:

- Files created or changed.
- PR link.
- Merge commit if merged.
- Verification summary.
- Clear confirmation that documentation-only constraints were honored when applicable.