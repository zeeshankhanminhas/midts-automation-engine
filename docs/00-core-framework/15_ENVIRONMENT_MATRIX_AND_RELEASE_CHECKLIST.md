# MIDTS Automation Engine - Environment Matrix And Release Checklist

Status: Stage 8 documentation-only environment governance. This document does not move, rename, delete, refactor, optimize, or modify functional code.

## Environment Matrix

| Area | Development | Testing | Production |
|---|---|---|---|
| Purpose | Draft, document, and prepare changes | Validate behavior against controlled data and settings | Run live MIDTS automation |
| Git branch | Feature/documentation branch | PR branch or controlled release branch | `main` after approved PR merge |
| Apps Script project | Optional sandbox project only | Dedicated test Apps Script project where available | Approved production Apps Script project only |
| Spreadsheet | Sandbox/test spreadsheet | Controlled test spreadsheet with representative tabs | Production MIDTS spreadsheet |
| Web app deployment | Optional/dev deployment | Test deployment URL | Production Web App URL used by frontend forms |
| Frontend webhook URL | Local/test endpoint only | Test Apps Script web app URL | Production Apps Script web app URL |
| Webhook token | Test token only | Test token only | Production `WEBSITE_WEBHOOK_TOKEN` |
| Brevo | Disabled or test key only | Test/safe dry-run recipient only | Production key only with approved templates/recipients |
| Slack | Disabled or test channel | Test channel/webhook | Production operational channel/webhook |
| Google Drive | Sandbox folder only | Test root folder | Production `ROOT_DRIVE_FOLDER_ID` |
| Test data | Free to create/discard | Controlled and labelled as test | Minimal controlled smoke data only |
| Deployment authority | Developer/operator for sandbox only | Operator-approved test deployment | Explicit release approval required |
| Rollback requirement | Low | Required for test deployment | Mandatory before release |

## Environment Rules

### Development

Allowed:

- Documentation work.
- Local planning.
- PR preparation.
- Non-production experiments in a sandbox only.

Blocked:

- Pushing unreviewed runtime code to production Apps Script.
- Using production secrets in local files.
- Sending live Brevo email.
- Granting production Drive access.
- Writing destructive test data to production sheets.

### Testing

Allowed:

- Controlled runner execution.
- Controlled webhook payload tests.
- Controlled Brevo dry-runs to `TEST_EMAIL_RECIPIENT` and `TEST_VENDOR_EMAIL`.
- Controlled Drive tests against a test root folder.
- Dashboard smoke testing.

Required:

- Test data must be identifiable.
- Test recipients must be controlled.
- Test spreadsheet must not be mistaken for production.
- Test deployment URL must not be wired to production frontend unless explicitly approved.

### Production

Allowed only after approval:

- `clasp push` to production Apps Script project.
- New Apps Script deployment/version.
- Production frontend webhook URL update.
- Production token/settings update.
- Production email/template change.
- Production Drive root/access change.

Required:

- PR approval.
- Rollback plan.
- Runner proof.
- Manual log/sheet inspection.
- Post-deployment smoke test.

## Production Deployment Checklist

Complete before any production deployment.

### Scope

- [ ] PR exists and is approved.
- [ ] Diff scope matches the declared change.
- [ ] No unrelated cleanup is included.
- [ ] Affected files are listed.
- [ ] Affected sheets are listed.
- [ ] Affected settings keys are listed.
- [ ] Affected webhook routes are listed.
- [ ] Affected external integrations are listed.

### Environment

- [ ] Production Apps Script project confirmed.
- [ ] `.clasp.json` script ID confirmed.
- [ ] Production spreadsheet confirmed.
- [ ] Production Web App URL confirmed.
- [ ] Production frontend environment impact reviewed.
- [ ] Production Drive root folder confirmed if Drive is affected.
- [ ] Brevo and Slack environments confirmed if communication is affected.

### Secrets

- [ ] No secrets in Git diff.
- [ ] No secrets in PR body/comments.
- [ ] `WEBSITE_WEBHOOK_TOKEN` present in production settings source.
- [ ] `BREVO_API_KEY` present only in approved settings source if email is affected.
- [ ] `SLACK_WEBHOOK_URL` present only in approved settings source if Slack is affected.
- [ ] Test recipients are controlled if dry-runs are required.

### Pre-Deployment Runner Proof

Run only the relevant subset for narrow changes. Run all for broad restructure or deployment changes.

- [ ] `runStage1Validation`
- [ ] `runStage1SmokeTest`
- [ ] `runStage2LeadCaptureTest`
- [ ] `runStage2NurtureQualificationTest` if qualification is affected
- [ ] Reminder runners if reminder fields are affected
- [ ] `runQuoteGatingTest`
- [ ] `runStage3QuoteCreationTest`
- [ ] `runStage3QuoteStatusWorkflowTest`
- [ ] `runStage4VendorEligibilityTest`
- [ ] `runStage4ProjectCreationTest`
- [ ] `runStage45VendorPricingSetupValidation`
- [ ] `runStage45VendorPricingWorkflowTest`
- [ ] `runStage45VendorPricingWebhookPayloadTest`
- [ ] `runStage45VendorAssignmentEmailTest` if vendor email is affected
- [ ] `runStage5PaymentSetupValidation`
- [ ] `runStage5PaymentTrackingTest`
- [ ] `runStage6DriveSetupValidation`
- [ ] `runStage6DriveAccessWorkflowTest` if Drive is affected
- [ ] `runStage7EmailSetupValidation`
- [ ] `runStage7BrevoEmailTest` if email is affected
- [ ] `runStage8SlackSetupValidation`
- [ ] `runStage8SlackAlertTest` if Slack is affected
- [ ] `runStage9DashboardSetupValidation` if dashboard/read paths are affected
- [ ] `runStage10WebsiteWebhookSetupValidation`
- [ ] `runStage10WebsiteWebhookLogSetupTest`
- [ ] `runStage10WebsiteWebhookPayloadTest` if Step 1 intake is affected
- [ ] `runStage11Step2RequirementSetupTest` if Step 2 is affected
- [ ] `runStage11Step2RequirementPayloadTest` if Step 2 is affected

### Manual Inspection

- [ ] `Settings` contains required keys.
- [ ] `Leads` row inspection completed for lead-affecting changes.
- [ ] `Website Webhook Logs` inspected for Step 1 changes.
- [ ] `Step 2 Requirement Logs` inspected for Step 2 changes.
- [ ] `Vendor Pricing` and `Vendor Pricing Logs` inspected for vendor pricing changes.
- [ ] `Quotes` inspected for quote changes.
- [ ] `Vendors` inspected for vendor changes.
- [ ] `Projects` inspected for project changes.
- [ ] `Payments` inspected for payment changes.
- [ ] `Drive Access Logs` inspected for Drive changes.
- [ ] `Email Logs` inspected for email changes.
- [ ] `Slack Logs` inspected for Slack changes.
- [ ] `Error Logs` inspected after runner execution.

### Deployment Action

- [ ] Approval to push to production Apps Script received.
- [ ] `clasp push` target confirmed immediately before push.
- [ ] Apps Script files reviewed after push if needed.
- [ ] New deployment/version created only after runner proof.
- [ ] Deployment version or URL recorded.
- [ ] Previous known-good deployment/version recorded for rollback.

### Post-Deployment Verification

- [ ] Live `doPost(e)` smoke test completed if webhooks are affected.
- [ ] Step 1 controlled live payload creates expected lead/log rows if intake is affected.
- [ ] Step 2 controlled live payload updates expected lead/log rows if Step 2 is affected.
- [ ] Vendor pricing controlled live payload writes expected pricing/log rows if vendor pricing is affected.
- [ ] Live `doGet(e)` dashboard smoke test completed if dashboard is affected.
- [ ] Email dry-run proof completed if email is affected.
- [ ] Slack alert proof completed if Slack is affected.
- [ ] Drive access proof completed if Drive is affected.
- [ ] Error logs reviewed after smoke tests.
- [ ] Frontend points to the intended production Web App URL.

### Release Record

- [ ] PR link recorded.
- [ ] Commit SHA recorded.
- [ ] Apps Script deployment version recorded.
- [ ] Spreadsheet environment recorded.
- [ ] Runner proof summarized.
- [ ] Manual inspection summarized.
- [ ] Rollback path recorded.
- [ ] Known residual risks recorded.

## Release Approval Flow

```text
Author prepares PR
-> scope and risk reviewed
-> execution gates selected
-> runner proof completed
-> manual inspection completed
-> deployment target confirmed
-> release approver approves push/deploy
-> production deployment performed
-> post-deployment smoke tests completed
-> release record updated
-> PR merged or deployment marked complete according to release plan
```

## Required Approvals

| Change type | Required approval |
|---|---|
| Documentation-only | Normal PR review |
| Test/docs governance | Normal PR review |
| Runtime Apps Script change | Operator/release approval |
| Public webhook change | Operator/release approval plus frontend owner confirmation |
| Sheet structure/settings change | Operator/release approval plus backup confirmation |
| Email/template change | Operator/release approval plus controlled dry-run evidence |
| Drive/access change | Operator/release approval plus access review |
| Deployment URL/version change | Operator/release approval plus rollback plan |
| `.clasp.json` or `appsscript.json` change | Explicit deployment governance approval |

## Environment Promotion Rules

- Development changes do not become testing changes without a PR and stated scope.
- Testing changes do not become production changes without runner proof and release approval.
- Production deployment does not happen from an unreviewed branch.
- Production secrets are never copied into development files.
- Production spreadsheet is not used for destructive test data.
- Production web app URL is not changed without frontend verification.

## Production Stop Rules

Stop the release if:

- Any required runner fails.
- Any expected log row is missing.
- Any controlled payload writes to the wrong row/sheet.
- Any email sends to the wrong recipient.
- Any Drive permission is unexpected.
- Any dashboard smoke test fails.
- Any public webhook response differs from expected shape.
- Any required setting key is missing.
- Any environment target is uncertain.
- Rollback information is missing.

## Environment Governance Control Note

This checklist is a release control document. It does not authorize production deployment or runtime changes by itself.