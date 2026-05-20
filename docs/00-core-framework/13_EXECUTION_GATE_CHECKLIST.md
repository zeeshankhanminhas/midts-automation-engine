# MIDTS Automation Engine - Execution Gate Checklist

Status: Stage 7 documentation-only execution gate checklist. This checklist must be completed before any future code move, rename, refactor, folder restructure, deployment-affecting change, or functional change.

## Gate Principle

No restructure should proceed because it looks clean. It should proceed only when the matching proof shows the current Apps Script execution flow, public entry points, sheet contracts, settings keys, audit logs, and external integrations still work.

## Gate 0 - Scope Gate

Complete before opening a runtime PR.

- [ ] Confirm the change is not documentation-only.
- [ ] Identify every affected file.
- [ ] Identify every affected service/global object.
- [ ] Identify every affected sheet tab.
- [ ] Identify every affected settings key.
- [ ] Identify every affected webhook route or payload key.
- [ ] Identify every affected runner function.
- [ ] Identify every affected external integration: Brevo, Slack, Drive, Apps Script Web App, Google Sheets, frontend forms.
- [ ] Confirm the change is on a branch, not direct to `main`.
- [ ] Confirm the PR will not combine unrelated cleanup with runtime work.

Stop if the affected surface cannot be listed clearly.

## Gate 1 - Risk Classification Gate

Use before editing any runtime file.

- [ ] Check `02_RISK_REGISTER.md`.
- [ ] Check `09_RESTRUCTURE_RISK_REGISTER.md`.
- [ ] Check `10_RESTRUCTURE_CANDIDATE_MAP.md`.
- [ ] Classify each affected file as Critical, High, Medium, Low, or Future/Dormant.
- [ ] Classify each affected file as KEEP IN PLACE, SAFE TO GROUP LATER, DO NOT MOVE YET, NEEDS TEST COVERAGE BEFORE MOVE, or POSSIBLE FUTURE SPLIT.
- [ ] Confirm Critical and High Risk files have a migration plan before movement.
- [ ] Confirm DO NOT MOVE YET files are not being moved unless an explicit later-stage approval exists.

Stop if a Critical or High Risk file is being moved without migration plan and proof.

## Gate 2 - Public Contract Gate

Complete if any public or semi-public contract could change.

- [ ] `doPost(e)` global name preserved.
- [ ] `doGet(e)` global name preserved.
- [ ] `include(filename)` global name preserved.
- [ ] `getDashboardData()` global name preserved.
- [ ] `createDashboardLead(input)` global name preserved.
- [ ] Public service object names preserved.
- [ ] Runner function names preserved.
- [ ] Sheet tab names preserved.
- [ ] Settings key names preserved or dual-read migration documented.
- [ ] Webhook route aliases preserved.
- [ ] Webhook JSON response shape preserved unless explicitly migrated.
- [ ] HTML template names preserved unless dashboard migration proof exists.

Stop if any public contract changes without compatibility wrapper or migration plan.

## Gate 3 - Sheet And Settings Gate

Complete before any change involving Sheets, config, setup, or settings.

- [ ] `Settings` sheet contract reviewed.
- [ ] Required settings keys reviewed.
- [ ] No key renamed without dual-read migration.
- [ ] Sheet backup plan documented for schema changes.
- [ ] Setup validation runner selected.
- [ ] Row compatibility check defined.
- [ ] Audit/log sheet impact identified.
- [ ] `ID Counters` impact identified if IDs are involved.

Required proof:

- [ ] `runStage1Validation` passes.
- [ ] `runStage1SmokeTest` passes where ID/log behavior is relevant.
- [ ] Relevant setup validation runner passes.

Stop if any required setting is missing or any setup validation fails.

## Gate 4 - Webhook Gate

Complete before any change involving `CodeStage10.js`, `WebsiteWebhookService.js`, `Step2RequirementService.js`, `VendorPricingService.js`, public forms, webhook aliases, token handling, or payload fields.

- [ ] `WEBSITE_WEBHOOK_TOKEN` behavior preserved.
- [ ] Honeypot behavior preserved for Step 1 forms.
- [ ] Step 1 route behavior preserved.
- [ ] Step 2 route aliases preserved: `step2`, `step_2`, `technical_requirement`, `requirements`.
- [ ] Vendor pricing route aliases preserved: `vendorPricing`, `vendor_pricing`, `vendor-pricing`, `pricing`, `vendor_price`.
- [ ] Payload keys reviewed against frontend/reference docs.
- [ ] Matching log sheet exists.
- [ ] JSON response behavior reviewed.

Required proof:

- [ ] `runStage10WebsiteWebhookSetupValidation` passes.
- [ ] `runStage10WebsiteWebhookLogSetupTest` passes.
- [ ] `runStage10WebsiteWebhookPayloadTest` creates expected lead and `Website Webhook Logs` row.
- [ ] `runStage11Step2RequirementSetupTest` passes if Step 2 is affected.
- [ ] `runStage11Step2RequirementPayloadTest` updates an existing lead and writes `Step 2 Requirement Logs` if Step 2 is affected.
- [ ] `runStage45VendorPricingWebhookPayloadTest` writes `Vendor Pricing` and `Vendor Pricing Logs` rows if vendor pricing is affected.

Stop if a webhook test creates no log row, updates the wrong record, or returns an unexpected response.

## Gate 5 - Lifecycle Gate

Complete before any change involving lead, quote, vendor, project, payment, or Drive lifecycle behavior.

Required proof by area:

- [ ] Lead capture: `runStage2LeadCaptureTest` passes and lead row is correct.
- [ ] Lead qualification: `runStage2NurtureQualificationTest` passes.
- [ ] Reminder behavior: relevant reminder runner passes if reminder fields are affected.
- [ ] Quote gating: `runQuoteGatingTest` passes.
- [ ] Quote creation: `runStage3QuoteCreationTest` passes.
- [ ] Quote status: `runStage3QuoteStatusWorkflowTest` passes.
- [ ] Vendor eligibility: `runStage4VendorEligibilityTest` passes.
- [ ] Project creation: `runStage4ProjectCreationTest` passes.
- [ ] Vendor pricing: Stage 4.5 setup/workflow/webhook tests pass.
- [ ] Payment: Stage 5 setup/tracking tests pass.
- [ ] Drive: Stage 6 setup/access workflow tests pass.

Stop if any lifecycle gate releases work too early, blocks valid work, or writes the wrong row.

## Gate 6 - Communication Gate

Complete before any change involving email, Slack, templates, recipients, sender settings, or notification flow.

Email proof:

- [ ] `BREVO_API_KEY` present in the expected settings source.
- [ ] `BREVO_SENDER_EMAIL` present.
- [ ] `BREVO_SENDER_NAME` present.
- [ ] `TEST_EMAIL_RECIPIENT` is controlled and safe.
- [ ] `runStage7EmailSetupValidation` passes.
- [ ] `runStage7BrevoEmailTest` sends only to the controlled recipient.
- [ ] `Email Logs` row is written.

Vendor email proof if affected:

- [ ] `TEST_VENDOR_EMAIL` is controlled and safe.
- [ ] `VENDOR_PRICING_FORM_BASE_URL` reviewed.
- [ ] `runStage45VendorAssignmentEmailTest` passes.
- [ ] `Email Logs` row is written.

Slack proof if affected:

- [ ] `SLACK_WEBHOOK_URL` present.
- [ ] `runStage8SlackSetupValidation` passes.
- [ ] `runStage8SlackAlertTest` passes.
- [ ] `Slack Logs` row is written.

Stop if email sends to an uncontrolled recipient or no communication log is written.

## Gate 7 - Dashboard Gate

Complete before any change involving `CodeStage9.js`, `DashboardService.js`, `Index.html`, `ClientJS.html`, `Styles.html`, `include(filename)`, dashboard wrappers, or dashboard-visible sheet fields.

- [ ] `runStage9DashboardSetupValidation` passes.
- [ ] Dashboard page renders.
- [ ] Dashboard data refresh works.
- [ ] `getDashboardData()` still resolves.
- [ ] `createDashboardLead(input)` still resolves.
- [ ] Manual lead creation from dashboard is tested only in controlled mode.
- [ ] `google.script.run` calls still match server function names.
- [ ] HTML partial names still match include calls.

Stop if dashboard render fails or client calls cannot find server functions.

## Gate 8 - External Integration Gate

Complete before any change involving external services.

- [ ] Apps Script Web App URL impact reviewed.
- [ ] Frontend payload contract reviewed.
- [ ] Google Sheets tab/header impact reviewed.
- [ ] Google Drive folder/access impact reviewed.
- [ ] Brevo API impact reviewed.
- [ ] Slack webhook impact reviewed.
- [ ] Apps Script Properties/settings fallback impact reviewed.

Required proof:

- [ ] Live web app smoke test for deployment-affecting changes.
- [ ] Stage 6 Drive proof for Drive changes.
- [ ] Stage 7 Brevo proof for email changes.
- [ ] Stage 8 Slack proof for Slack changes.

Stop if external target, recipient, folder, webhook URL, or Apps Script project is uncertain.

## Gate 9 - Deployment Gate

Complete before any change involving `.clasp.json`, `appsscript.json`, Apps Script deployment, or public web app URL.

- [ ] `.clasp.json` script ID confirmed.
- [ ] `appsscript.json` diff reviewed.
- [ ] Deployment target confirmed.
- [ ] Web app URL impact reviewed.
- [ ] Frontend environment/update impact reviewed.
- [ ] Rollback deployment/version noted.
- [ ] Smoke test plan written.

Required proof:

- [ ] Deployed `doPost(e)` route smoke test if public webhook is affected.
- [ ] Deployed `doGet(e)` dashboard smoke test if dashboard is affected.
- [ ] Matching log row appears for live webhook smoke test.

Stop if target project or deployed URL is uncertain.

## Gate 10 - PR Evidence Gate

Complete before requesting merge.

- [ ] PR summary lists affected files.
- [ ] PR summary lists affected sheets.
- [ ] PR summary lists affected settings keys.
- [ ] PR summary lists affected webhook routes.
- [ ] PR summary lists affected external integrations.
- [ ] PR summary lists runner proof completed.
- [ ] PR summary lists manual inspection completed.
- [ ] PR includes rollback plan for Critical or High Risk changes.
- [ ] PR diff matches declared scope.
- [ ] No unrelated cleanup included.
- [ ] Documentation maps updated if dependencies changed.

Stop if evidence is vague, missing, or does not match the changed files.

## Minimum Gate Bundles By Change Type

| Future change type | Required gates |
|---|---|
| Documentation-only | Gate 0, Gate 10 |
| Runner documentation or test docs | Gate 0, Gate 1, Gate 10 |
| Runner code movement | Gate 0, Gate 1, Gate 2, matching lifecycle/communication/dashboard gate, Gate 10 |
| Webhook code change | Gate 0, Gate 1, Gate 2, Gate 4, Gate 8, Gate 10 |
| Sheet/schema change | Gate 0, Gate 1, Gate 3, affected lifecycle gate, Gate 10 |
| Settings/config change | Gate 0, Gate 1, Gate 2, Gate 3, affected integration gate, Gate 10 |
| Email/template change | Gate 0, Gate 1, Gate 6, Gate 8, Gate 10 |
| Dashboard change | Gate 0, Gate 1, Gate 7, Gate 10 |
| Drive/access change | Gate 0, Gate 1, Gate 5, Gate 8, Gate 10 |
| Deployment change | Gate 0, Gate 1, Gate 2, Gate 8, Gate 9, Gate 10 |
| Folder restructure/code move | Gate 0 through Gate 10 as applicable to every affected file |

## Final Stop Rule

Do not merge a future move, rename, refactor, or restructure PR if any required runner proof, log inspection, manual smoke test, external integration check, or rollback note is missing.