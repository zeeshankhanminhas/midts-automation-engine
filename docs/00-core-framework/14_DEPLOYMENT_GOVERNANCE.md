# MIDTS Automation Engine - Deployment Governance

Status: Stage 8 documentation-only deployment and environment governance. This document does not move, rename, delete, refactor, optimize, or modify functional code.

## Purpose

Deployment is one of the highest-risk surfaces in the MIDTS Automation Engine because Apps Script execution depends on global function names, the bound Apps Script project, the deployed web app version, spreadsheet bindings, settings keys, and frontend webhook URLs.

This document defines the governance rules for future deployment-affecting work.

## Local vs Apps Script Environment Behavior

| Area | Local repository behavior | Apps Script behavior | Governance rule |
|---|---|---|---|
| Runtime execution | Files are text in GitHub/local workspace | Apps Script loads globals into the script project runtime | Do not assume local file organization equals runtime module boundaries |
| Global functions | Function names are inert until pushed/deployed | `doPost(e)`, `doGet(e)`, runners, and service globals must resolve at runtime | Preserve global names unless a migration wrapper exists |
| File paths/folders | Git can organize files freely | Apps Script historically treats script files as project files, with limited module semantics | Do not move runtime files until Apps Script behavior is proven |
| Secrets/settings | Local repo must not contain secrets | Settings may live in `Settings` sheet and/or Apps Script properties | Never commit secrets or tokens |
| Webhooks | Local code cannot receive production form traffic | Deployed Web App URL receives website, Step 2, and vendor pricing POSTs | Verify deployed URL after any deployment |
| Sheets | Local repo has no spreadsheet state | Runtime reads/writes bound Google Sheets tabs | Validate sheet binding before production deployment |
| External services | Local docs/examples only | Runtime may call Brevo, Slack, Google Drive | Use controlled test recipients and explicit verification |

## Clasp Push Governance

`clasp push` is a deployment-adjacent action. It can change the Apps Script project even before a new web app deployment is created.

Before any future `clasp push`:

- Confirm the intended repository branch.
- Confirm `.clasp.json` points to the intended Apps Script project.
- Confirm no unrelated runtime files are in the diff.
- Confirm no secrets are present in files being pushed.
- Confirm the current Apps Script version/deployment can be rolled back.
- Confirm the required runner proof for the changed area is planned.
- Confirm the user/operator approves pushing to that Apps Script project.

Never push when:

- `.clasp.json` target is uncertain.
- The branch includes unreviewed functional changes.
- Public entry points changed without compatibility proof.
- Settings keys, sheet names, or webhook aliases changed without migration plan.
- Rollback version is unknown.

## Deployment Sequencing

Recommended sequence for future deployment-affecting changes:

1. Create a branch and PR.
2. Identify affected files, sheets, settings, webhooks, and integrations.
3. Review dependency lock, risk register, coverage map, and execution gate checklist.
4. Make the smallest approved code change.
5. Run local/static review where applicable.
6. Push only to the intended Apps Script project after approval.
7. Run setup and workflow runners in Apps Script.
8. Inspect expected sheet/log rows.
9. Create or update Apps Script deployment only after runner proof passes.
10. Verify deployed web app routes.
11. Verify frontend environment points to the correct deployment URL when relevant.
12. Open or update PR with proof evidence.
13. Merge only after approval and rollback notes are documented.

## Rollback Procedures

Rollback must be planned before deployment.

| Failure area | Immediate rollback action | Verification after rollback |
|---|---|---|
| Apps Script code regression | Restore previous Apps Script project version or redeploy prior known-good version | Run affected runner and inspect log row |
| Public webhook failure | Repoint frontend to previous web app URL/version if available, or redeploy previous version | Submit controlled webhook test and inspect matching log sheet |
| Dashboard failure | Restore previous deployment or revert dashboard files | Open dashboard and run `runStage9DashboardSetupValidation` |
| Email failure | Revert email code/template/settings change; disable uncontrolled send path if needed | Run Stage 7 controlled dry-run and inspect `Email Logs` |
| Slack failure | Revert Slack setting/code change | Run Stage 8 alert test and inspect `Slack Logs` |
| Drive failure | Revert Drive code/settings change and manually review permissions | Run Stage 6 proof and inspect `Drive Access Logs` |
| Sheet/schema failure | Restore backup or run approved migration rollback | Run setup validation and inspect affected rows |
| Token/settings failure | Restore previous setting key/value or dual-read fallback | Run relevant setup/webhook proof |

Rollback notes must include:

- Previous known-good commit or Apps Script version.
- Previous deployment URL/version when applicable.
- Affected sheet backup or restoration plan when sheet structure changed.
- Exact runner(s) used to verify rollback.

## Webhook Deployment Verification

Public webhook routes must be verified after any deployment that could affect `doPost(e)`, route selection, token validation, payload parsing, or service handlers.

Required checks:

- Confirm deployed Web App URL.
- Confirm frontend environment uses the intended URL.
- Confirm `WEBSITE_WEBHOOK_TOKEN` is present in the expected settings source.
- Confirm Step 1 controlled payload creates a `Website Webhook Logs` row.
- Confirm Step 1 controlled payload creates a lead row when expected.
- Confirm Step 2 controlled payload updates an existing lead and writes `Step 2 Requirement Logs`.
- Confirm vendor pricing controlled payload writes `Vendor Pricing` and `Vendor Pricing Logs` rows.
- Confirm failed/invalid token test rejects safely where appropriate.
- Confirm JSON responses match frontend expectations.

Runner proof:

- `runStage10WebsiteWebhookSetupValidation`
- `runStage10WebsiteWebhookLogSetupTest`
- `runStage10WebsiteWebhookPayloadTest`
- `runStage11Step2RequirementSetupTest`
- `runStage11Step2RequirementPayloadTest`
- `runStage45VendorPricingWebhookPayloadTest`

## Spreadsheet Binding Governance

Google Sheets is the production state layer. Deployment must never assume a sheet binding is correct without verification.

Before deployment:

- Confirm the Apps Script project is bound to or configured for the intended spreadsheet.
- Confirm `Settings` tab exists.
- Confirm required settings keys exist.
- Confirm `Leads`, `Quotes`, `Vendors`, `Projects`, `Payments`, and log sheets exist where required.
- Confirm `ID Counters` exists before ID-generating flows.
- Confirm no test spreadsheet is being used for production deployment.
- Confirm no production spreadsheet is being used for destructive testing.

Required setup proof:

- `runStage1Validation`
- `runStage1SmokeTest`
- Stage-specific setup validation runner for affected area

## Token And Secret Handling Rules

Never commit secrets to Git.

Protected values include:

- `WEBSITE_WEBHOOK_TOKEN`
- `BREVO_API_KEY`
- `SLACK_WEBHOOK_URL`
- Apps Script project IDs if treated as sensitive by the operator
- Web app URLs if the operator treats them as restricted
- Google Drive folder IDs if access-sensitive
- Client/vendor emails used for uncontrolled live workflows

Rules:

- Store runtime tokens in `Settings` and/or Apps Script properties, not source files.
- Use test keys/recipients only in test environments.
- Use `TEST_EMAIL_RECIPIENT` and `TEST_VENDOR_EMAIL` for dry-run email proof.
- Do not paste tokens into PR descriptions, docs, comments, screenshots, or logs.
- Redact secrets in diagnostic output.
- Rotate a token immediately if it is accidentally exposed.
- Any token rename requires dual-read migration and webhook proof.

## Required Deployment Verification Tests

| Area | Required verification |
|---|---|
| Foundation | `runStage1Validation`, `runStage1SmokeTest` |
| Lead capture | `runStage2LeadCaptureTest` and `runStage10WebsiteWebhookPayloadTest` |
| Step 2 | `runStage11Step2RequirementPayloadTest` |
| Vendor pricing | `runStage45VendorPricingWebhookPayloadTest` and pricing row/log inspection |
| Quote | `runQuoteGatingTest`, `runStage3QuoteCreationTest`, `runStage3QuoteStatusWorkflowTest` |
| Vendor/project | `runStage4VendorEligibilityTest`, `runStage4ProjectCreationTest` |
| Payment | `runStage5PaymentSetupValidation`, `runStage5PaymentTrackingTest` |
| Drive | `runStage6DriveSetupValidation`, `runStage6DriveAccessWorkflowTest` |
| Email | `runStage7EmailSetupValidation`, `runStage7BrevoEmailTest` |
| Slack | `runStage8SlackSetupValidation`, `runStage8SlackAlertTest` |
| Dashboard | `runStage9DashboardSetupValidation` plus dashboard browser smoke test |
| Public web app | Controlled live `doPost(e)` and/or `doGet(e)` smoke test as applicable |

## Release Approval Flow

A future release that changes runtime behavior must pass this approval flow:

1. Author identifies risk and affected contracts.
2. Author completes relevant execution gates.
3. Author documents runner proof and manual inspection evidence.
4. Reviewer confirms PR scope matches evidence.
5. Operator confirms intended Apps Script project and spreadsheet binding.
6. Operator confirms token/secret handling is safe.
7. Operator approves `clasp push` if needed.
8. Operator approves deployment version update if needed.
9. Post-deployment webhook/dashboard/integration verification is recorded.
10. PR is merged only after rollback notes are present.

## Deployment Governance Stop Rules

Stop deployment immediately if:

- `.clasp.json` target is uncertain.
- The Apps Script project or spreadsheet binding is uncertain.
- Required setting keys are missing.
- A public webhook test creates no matching log row.
- A live smoke test writes to the wrong sheet or wrong lead.
- Brevo sends to an uncontrolled recipient.
- Drive access is granted to the wrong account.
- Dashboard server calls fail.
- Rollback version or previous deployment is unknown.
- Secrets appear in the diff, PR, logs, screenshots, or documentation.

## Documentation Control Note

This document describes deployment governance only. It does not permit deployment, pushing, moving files, changing Apps Script code, or changing any production configuration.