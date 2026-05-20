# Core Master Framework Stage Rules

Status: Stage 3 governance documentation only. These rules define what each framework stage allows and blocks.

## Universal Rules

These rules apply to every stage:

- No direct changes to `main`.
- Every change must go through a pull request.
- Do not move, rename, refactor, or simplify working code unless the current stage explicitly allows it.
- Do not alter Apps Script deployment logic without explicit deployment review.
- Do not alter public webhook behavior without runner proof.
- Do not alter sheet structure without setup validation and migration notes.
- Do not alter Brevo/email templates, recipients, sender settings, or email routing without dry-run verification.
- Do not alter security/token behavior without token validation proof.
- Do not rename high-risk files, services, runner functions, sheets, settings keys, or public entry points without migration plan.
- Keep unrelated cleanup out of runtime changes.

## Stage 1 - Documentation And Mapping Only

Purpose: identify what exists.

Allowed:

- Create framework folders.
- Create `docs/00_RESTRUCTURE_MAP.md`.
- Map current repository structure.
- Map services, runners, workflows, sheets, webhooks, audit systems, gates, and validation logic.
- Classify components at a first-pass level.

Blocked:

- Runtime code changes.
- File moves.
- File renames.
- Apps Script deployment changes.
- Sheet structure changes.
- Webhook behavior changes.
- Email/template changes.
- Test runner behavior changes.

Exit criteria:

- Current system is mapped well enough to identify operational layers and major dependencies.
- PR diff is documentation-only.

## Stage 2 - Dependency And Risk Mapping Only

Purpose: lock public contracts and classify risk before governance work expands.

Allowed:

- Create `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md`.
- Create `docs/00-core-framework/02_RISK_REGISTER.md`.
- Identify Apps Script entry points.
- Identify public webhook handlers.
- Identify runner functions.
- Identify services called by `doPost(e)`.
- Identify sheet names used by each service.
- Identify required settings keys.
- Identify Brevo/email dependencies.
- Identify token/security dependencies.
- Identify quote/vendor/project gate dependencies.
- Identify high-risk files and safe-to-document files.
- Identify files that must not be renamed without migration.

Blocked:

- Runtime code changes.
- File moves or renames.
- Functional changes.
- Dependency rewiring.
- Sheet, webhook, email, deployment, or test runner behavior changes.

Exit criteria:

- Critical and High Risk components are visible.
- Locked names and contracts are documented.
- PR diff is documentation-only.

## Stage 3 - Governance Documentation Only

Purpose: define how future changes must be planned, reviewed, tested, and merged.

Allowed:

- Expand `docs/00-core-framework/README.md`.
- Create `docs/00-core-framework/03_OPERATING_MANUAL.md`.
- Create `docs/00-core-framework/04_STAGE_RULES.md`.
- Define PR, review, validation, and merge rules.
- Define evidence standards for webhook, sheet, email, and deployment changes.
- Clarify stage boundaries.

Blocked:

- Runtime code changes.
- Apps Script file edits.
- File moves or renames.
- Sheet structure changes.
- Webhook changes.
- Email/template changes.
- Test runner behavior changes.
- Deployment changes.

Exit criteria:

- Governance process is explicit.
- Future contributors know how to plan, prove, and merge changes.
- PR diff is Markdown-only.

## Stage 4 - Safe Folder Documentation

Purpose: add documentation inside layer folders without moving runtime code.

Allowed:

- Add or update README files inside framework layer folders.
- Document current responsibilities for each layer.
- Link existing runtime files to their future framework layer conceptually.
- Document future migration candidates.
- Document layer-specific validation requirements.

Blocked:

- Moving files into layer folders.
- Renaming files to match layers.
- Creating replacement runtime services.
- Runtime code edits.
- Sheet, webhook, email, deployment, or runner changes.

Exit criteria:

- Each framework layer explains current scope, current dependencies, and future migration caution.
- No runtime file moved or changed.

## Stage 5 - Test Harness Verification

Purpose: prove the existing test and runner surface before any code movement is considered.

Allowed:

- Document test harness expectations.
- Verify runner availability.
- Run existing setup and payload tests in Apps Script where appropriate.
- Record validation evidence in documentation.
- Add documentation describing required test order and expected proof.

Conditionally allowed:

- Add non-invasive test documentation or checklists.
- Add test harness code only if explicitly approved in a separate runtime PR and after risk review.

Blocked by default:

- Refactoring production services.
- Moving production code.
- Changing webhook routing.
- Changing sheet contracts.
- Changing email/template behavior.
- Changing deployment config.

Exit criteria:

- Existing runner functions and setup validations are known, callable, and documented.
- Critical workflows have named proof requirements.

## Stage 6 - Code Movement Only If Dependency Lock Allows It

Purpose: perform controlled movement only after prior stages prove that movement is safe.

Allowed only with explicit migration plan:

- Move low-risk or already-isolated files first.
- Add wrappers or compatibility shims where global Apps Script names must remain stable.
- Preserve public entry points and service object names unless migration proves otherwise.
- Use dual-read or dual-write behavior for settings/sheet migrations where needed.
- Update documentation and validation evidence in the same PR.

Strictly blocked without migration plan:

- Moving Critical or High Risk files.
- Renaming `doPost(e)`, `doGet(e)`, or dashboard callable wrappers.
- Renaming public service objects.
- Renaming runner functions still used for proof.
- Renaming sheet tabs.
- Renaming settings keys.
- Changing webhook aliases or payload contracts.
- Changing Brevo/email behavior.
- Changing deployment bindings.

Exit criteria:

- Dependency lock explicitly permits the movement.
- Risk register classification is reviewed.
- Migration plan is included in the PR.
- Runner proof demonstrates preserved behavior.
- Rollback path is documented.

## Required Proof Rules

| Change area | Required proof before merge |
|---|---|
| Webhook routing | Matching Stage 10, Stage 11, or Stage 4.5 payload runner proof |
| Website Step 1 intake | Lead row plus `Website Webhook Logs` row |
| Step 2 requirements | Existing lead update plus `Step 2 Requirement Logs` row |
| Vendor pricing | `Vendor Pricing` row plus `Vendor Pricing Logs` row |
| Sheet structure | Setup validation, backup note, and migration plan |
| Settings keys | Setup validation and migration plan for renamed keys |
| Brevo/email | Dry-run/test recipient proof plus `Email Logs` row |
| Slack | Stage 8 proof plus `Slack Logs` row |
| Drive access | Stage 6 proof plus `Drive Access Logs` row |
| Quote gates | Stage 3 quote proof |
| Vendor gates | Stage 4 and Stage 4.5 proof |
| Project/payment gates | Stage 4 project proof and Stage 5 payment proof where applicable |
| Dashboard | Stage 9 proof and dashboard smoke test |
| Deployment | Manifest review, clasp binding check, and deployed smoke test |

## Stop Conditions

Stop immediately and do not continue changing runtime code if:

- A webhook test creates no log row.
- A lead is created without the expected audit trail.
- Step 2 updates the wrong lead or creates an unexpected new lead.
- Vendor pricing attaches to the wrong lead/vendor.
- A settings key is missing or renamed without migration.
- A sheet setup validation fails.
- Brevo sends to the wrong recipient or no email log is written.
- A deployment or clasp target is uncertain.
- The PR diff includes files outside the approved stage scope.

## Stage Advancement Rule

Do not advance to the next stage because the repo looks ready. Advance only when the current stage exit criteria are met and merged through PR.

The framework must protect the working automation first. Structural cleanliness comes later.