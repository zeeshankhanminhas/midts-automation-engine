# MIDTS Automation Engine - Safe Migration Sequence

Status: Stage 6 documentation-only migration sequence. This document describes a possible future order for reorganization. It does not authorize moving, renaming, deleting, refactoring, optimizing, or modifying functional code.

## Migration Principle

Apps Script execution depends on global names, deployment entry points, file availability, sheet contracts, settings keys, and manually callable runner functions. A safe restructure must preserve behavior first and improve organization second.

The safest sequence is:

1. Improve documentation and indexes.
2. Group references and non-runtime docs.
3. Strengthen runner/test proof.
4. Introduce compatibility wrappers if needed.
5. Move only low-risk surfaces first.
6. Move high-risk runtime services only after proof is repeatable.

## Phase 0 - No Runtime Movement Baseline

Allowed:

- Add documentation maps and indexes.
- Keep all Apps Script files in their current root locations.
- Keep `.clasp.json`, `appsscript.json`, HTML templates, and global function names unchanged.

Required proof:

- Markdown-only diff.
- No `.js`, `.html`, `.json`, `.clasp.json`, manifest, or deployment changes.

Stop conditions:

- Any functional file appears in the diff.
- Any runtime behavior is changed.

## Phase 1 - Documentation Grouping Only

Candidate files/folders:

- `docs/**`
- `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md`
- `website-integration/**` as reference documentation only

Allowed:

- Add layer README files.
- Link current runtime files to future layers conceptually.
- Add diagrams, maps, and migration checklists.
- Clarify frontend/backend payload contracts in documentation.

Blocked:

- Moving Apps Script runtime files.
- Changing website payload behavior.
- Changing webhook URLs, tokens, sheet names, or settings keys.

Required proof:

- Markdown/reference-only diff.
- Payload contract review when website integration docs are changed.

## Phase 2 - Test Harness Visibility Before Movement

Candidate files:

- `Code.js`
- `CodeStage45VendorPricing.js`
- `CodeStage5.js`
- `CodeStage6.js`
- `CodeStage7.js`
- `CodeStage8.js`
- `CodeStage9.js`
- `CodeStage10.js`

Allowed:

- Document every runner and expected result.
- Create a runner execution checklist.
- Record which runner proves which dependency chain.
- Verify runner availability manually in Apps Script before movement is considered.

Blocked:

- Renaming runners.
- Moving runner files.
- Changing runner behavior.

Required proof:

- Stage 1 through Stage 11 runner inventory.
- Evidence expectations for each runner.
- Operator instructions for which sheets/logs to inspect after each runner.

Stop conditions:

- Any runner is missing from Apps Script function list.
- Any runner creates no expected audit/log row where one is required.
- Any runner sends live email or grants Drive access without controlled test settings.

## Phase 3 - Low-Risk Documentation/Reference Reorganization

Candidate files:

- `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md`
- `website-integration/README.md`
- `website-integration/app/api/enquiry/route.ts`
- `website-integration/components/EnquiryForm-submit-handler.example.tsx`
- Future docs under framework layer folders

Allowed later with PR:

- Move or copy reference material into clearer documentation folders if links are updated.
- Keep payload contracts explicit.
- Preserve old links or add redirect/index notes where needed.

Required proof:

- Documentation link check.
- Payload key comparison against webhook docs.
- No Apps Script runtime diff.

Stop conditions:

- Frontend examples diverge from backend payload aliases.
- Webhook URL/token instructions become ambiguous.

## Phase 4 - Validation Runner Grouping With Compatibility Preservation

Candidate files:

- `CodeStage5.js`
- `CodeStage7.js`
- `CodeStage8.js`
- selected validation-only sections of `Code.js`

Possible future approach:

- Keep existing global runner function names available.
- If code is ever moved or grouped, preserve wrapper functions with the original names.
- Move one runner group at a time.
- Validate immediately after each group.

Required proof:

| Runner group | Required proof |
|---|---|
| Stage 5 payment | `runStage5PaymentSetupValidation`, `runStage5PaymentTrackingTest` |
| Stage 7 email | `runStage7EmailSetupValidation`, `runStage7BrevoEmailTest` with controlled recipient |
| Stage 8 Slack | `runStage8SlackSetupValidation`, `runStage8SlackAlertTest` |
| Stage 1-4 selected runners | Matching Stage 1-4 runner output and expected sheet/log state |

Stop conditions:

- Any runner name disappears.
- Any runner cannot be selected from Apps Script.
- Any expected sheet/log output is missing.

## Phase 5 - Dashboard Template And Read Path Migration Planning

Candidate files:

- `Styles.html`
- eventually `Index.html`, `ClientJS.html`, `DashboardService.js`, `CodeStage9.js`

Recommended order:

1. Document dashboard template dependencies.
2. Validate `include(filename)` behavior.
3. If styling is ever reorganized, start with `Styles.html` only.
4. Keep `Index.html`, `ClientJS.html`, `doGet(e)`, `getDashboardData()`, and `createDashboardLead(input)` in place until dashboard smoke tests are repeatable.
5. Only consider `DashboardService.js` after manual lead creation and read-only dashboard paths are separately proven.

Required proof:

- `runStage9DashboardSetupValidation`.
- Dashboard page renders.
- Dashboard data refresh works.
- Manual dashboard lead creation works only in controlled test mode.

Stop conditions:

- Dashboard render fails.
- `google.script.run` cannot find server functions.
- Manual lead creation writes unexpected data.

## Phase 6 - Communication Service Migration Planning

Candidate files:

- `SlackService.js`
- later `EmailService.js`
- `CodeStage7.js`
- `CodeStage8.js`

Recommended order:

1. Treat `SlackService.js` as the lower-risk communication service.
2. Prove Slack logs before and after any future movement.
3. Keep `EmailService.js` in place until dry-run controls and templates are documented more deeply.
4. If `EmailService.js` is split later, preserve transport, template, and audit behavior through wrappers.

Required proof:

- Stage 8 Slack alert proof for Slack changes.
- Stage 7 Brevo dry-run proof for email changes.
- `Email Logs` and `Slack Logs` inspection.

Stop conditions:

- Dry-run sends to wrong recipient.
- No email/slack log row is written.
- Sender settings or recipient logic changes without approval.

## Phase 7 - Config, Persistence, And Utility Isolation Planning

Candidate files:

- `Config.js`
- `DatabaseService.js`
- `Utils.js`
- `ErrorLogger.js`

Recommended order:

1. Move nothing at first; document exact API usage and expected globals.
2. Consider `ErrorLogger.js` before config/database because it is an audit writer, but only after failure-path proof exists.
3. Consider `Utils.js` only after ID generation tests are repeatable.
4. Keep `Config.js` and `DatabaseService.js` in place until the full test matrix can run reliably.

Required proof:

- Stage 1 validation.
- Stage 1 smoke test.
- ID counter validation.
- Failure-path logging proof.
- Full sheet setup validation.

Stop conditions:

- Settings map cannot be read.
- Any required setting key becomes missing.
- ID counters duplicate or fail.
- Error logs stop writing.

## Phase 8 - Core Lifecycle Service Migration Planning

Candidate files:

- `LeadService.js`
- `WebsiteWebhookService.js`
- `Step2RequirementService.js`
- `VendorService.js`
- `VendorPricingService.js`
- `QuoteService.js`
- `ProjectService.js`
- `PaymentService.js`
- `DriveService.js`

Recommended order if runtime movement is ever approved:

1. `PaymentService.js` after Stage 5 proof.
2. `QuoteService.js` only after Stage 3 proof and vendor pricing gate proof.
3. `VendorPricingService.js` only after Stage 4.5 public webhook proof.
4. `VendorService.js` only after vendor eligibility, vendor email, and Drive gate proof.
5. `Step2RequirementService.js` only after Stage 11 proof.
6. `WebsiteWebhookService.js` only after Stage 10 proof and token/honeypot proof.
7. `ProjectService.js` only after quote/vendor/lead gates are stable.
8. `DriveService.js` only after access controls are proven.
9. `LeadService.js` last, because it anchors most lifecycle state and gates.

Required proof:

- Matching runner for each service.
- Sheet row inspection.
- Audit log inspection.
- Rollback path.
- Compatibility wrappers preserving old global names.

Stop conditions:

- Any public webhook route fails.
- Any lead/quote/project/payment/pricing row is written incorrectly.
- Any access or email action affects the wrong person.
- Any global service object is unavailable to existing callers.

## Phase 9 - Public Entry Point Migration Planning

Candidate files/functions:

- `doPost(e)` in `CodeStage10.js`
- `doGet(e)` in `CodeStage9.js`
- `include(filename)`
- `getDashboardData()`
- `createDashboardLead(input)`

Recommended stance:

- Keep public entry points in place for as long as the Apps Script deployment uses them.
- If later migration is required, create wrappers that preserve the exact global function names.
- Do not change function signatures.
- Do not change response shape without frontend and runner proof.

Required proof:

- Live/deployed web app smoke test.
- Stage 10, Stage 11, Stage 4.5 payload tests.
- Stage 9 dashboard validation.
- Frontend contract verification.

Stop conditions:

- Apps Script deployment cannot find entry point.
- Frontend receives unexpected JSON.
- Dashboard server calls fail.

## Phase 10 - Manifest And Deployment Work

Candidate files:

- `.clasp.json`
- `appsscript.json`

Recommended stance:

- Keep both files in place unless there is a specific deployment reason.
- Do not combine manifest/binding changes with service movement.
- Confirm target Apps Script project before any deployment-related PR.

Required proof:

- Script ID confirmation.
- Manifest diff review.
- Deployed smoke test.
- Rollback/deployment recovery note.

Stop conditions:

- Target Apps Script project is uncertain.
- Deployment version behavior is unclear.
- Web app URL changes without coordinated frontend update.

## Suggested Future Migration Order Summary

| Order | Candidate area | Why this order |
|---|---|---|
| 1 | Documentation and reference grouping | Lowest runtime risk |
| 2 | Runner/test harness documentation | Creates proof before runtime movement |
| 3 | Low-risk runner grouping with wrappers | Validation-only surface, if names preserved |
| 4 | Slack and selected communication helpers | Lower lifecycle blast radius than email/intake |
| 5 | Dashboard styling/read-only surfaces | Mostly read-only, but must preserve template names |
| 6 | Error logging and utility isolation | Needed for diagnosis and ID stability before bigger moves |
| 7 | Payment service | Narrower downstream state than lead/quote/vendor/project |
| 8 | Quote/vendor pricing services | Commercial gate; requires strong proof |
| 9 | Step 2 and website webhook services | Public webhook and lead qualification risk |
| 10 | Project/Drive services | Execution and access control risk |
| 11 | Lead service | Central lifecycle anchor; move last if ever |
| 12 | Public entry points and deployment files | Highest compatibility and deployment risk |

## Migration Control Note

The correct near-term action remains documentation and proof-building. Runtime movement should wait until a future PR can prove compatibility with existing Apps Script globals, sheet contracts, settings keys, event chains, audit trails, and external integrations.