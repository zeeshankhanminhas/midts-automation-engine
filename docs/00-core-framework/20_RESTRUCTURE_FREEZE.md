# MIDTS Automation Engine - Restructure Freeze

Status: final governance-stage restructure freeze documentation. This document establishes a freeze policy for the current architecture. It does not authorize code movement, renames, refactors, webhook changes, sheet changes, email/template changes, deployment changes, or functional changes.

## Freeze Policy

The current MIDTS Automation Engine architecture is frozen as the known-good baseline.

Freeze means:

- Runtime files stay in their current locations.
- Public Apps Script global functions stay unchanged.
- Service object names stay unchanged.
- Sheet names stay unchanged.
- Settings keys stay unchanged.
- Webhook aliases and payload contracts stay unchanged.
- Deployment files stay unchanged.
- Email/template behavior stays unchanged.
- Functional logic stays unchanged unless a future approved runtime task explicitly permits it.

## Rules Preventing Uncontrolled Restructuring

The following are not allowed without explicit future approval:

- Moving Apps Script files into folders.
- Renaming Apps Script files.
- Renaming services, functions, runner functions, or public entry points.
- Splitting large services.
- Refactoring operational logic for style or cleanliness.
- Changing webhook routing or response shape.
- Changing sheet structure or tab names.
- Changing settings key names.
- Changing Brevo/email templates or recipient logic.
- Changing Drive access behavior.
- Changing `.clasp.json` or `appsscript.json`.
- Combining restructure with feature work.

## Rules For Future Migrations

Any future migration must:

- Start from the documented baseline.
- Identify affected files, services, sheets, settings, webhooks, runners, and integrations.
- Use the restructure candidate map.
- Use the safe migration sequence.
- Preserve existing public contracts unless compatibility wrappers are approved.
- Move the lowest-risk surfaces first.
- Move one risk area at a time.
- Include rollback notes.
- Include runner proof and manual inspection evidence.
- Update governance documentation in the same PR if dependencies change.

## Approval Requirements Before Code Movement

Before any code movement, human approval must explicitly confirm:

- Code movement is authorized.
- The affected files are listed.
- The migration plan is accepted.
- Compatibility wrappers are planned where needed.
- Required runner proof is defined.
- Manual sheet/log inspection is defined.
- Rollback path is defined.
- Deployment impact is reviewed.

Documentation-only approval does not authorize code movement.

## Mandatory Testing Before Structural Change

Before any structural change, run the relevant execution gates from the test coverage map and execution gate checklist.

Minimum broad restructure proof:

- `runStage1Validation`
- `runStage1SmokeTest`
- `runStage2LeadCaptureTest`
- `runStage2NurtureQualificationTest`
- `runQuoteGatingTest`
- `runStage3QuoteCreationTest`
- `runStage3QuoteStatusWorkflowTest`
- `runStage4VendorEligibilityTest`
- `runStage4ProjectCreationTest`
- Stage 4.5 setup/workflow/webhook/email tests where vendor pricing or email is affected
- Stage 5 payment tests where payment is affected
- Stage 6 Drive tests where project/Drive access is affected
- Stage 7 email tests where email is affected
- Stage 8 Slack tests where Slack is affected
- `runStage9DashboardSetupValidation` and dashboard smoke test where dashboard is affected
- Stage 10 website webhook tests where intake is affected
- Stage 11 Step 2 tests where qualification is affected

Manual inspection is required for affected sheets and logs.

## Rollback Expectations

Every future restructure PR must include rollback instructions.

Rollback expectations:

- Restore previous known-good commit if source code movement fails.
- Restore previous Apps Script deployment/version if deployment is affected.
- Restore previous settings values if configuration changes fail.
- Restore sheet backup or migration rollback if sheet structure changes fail.
- Verify rollback using the same runner or smoke test that exposed failure.
- Record rollback evidence in the PR or incident notes.

## Conditions Required Before Future Modularisation

Modularisation may only be considered when:

- Current runner functions are fully inventoried and callable.
- Coverage gaps are closed or explicitly accepted.
- Public Apps Script globals can be preserved through wrappers.
- Test and production environments are clearly separated.
- Deployment rollback path is known.
- Sheet contracts are backed up and validated.
- Settings key migration strategy exists where needed.
- External integrations can be dry-run tested safely.
- Human approval explicitly authorizes modularisation.

## Stability Before Optimisation Policy

Operational stability is more important than structural elegance.

Do not optimize if optimization risks:

- Public lead intake.
- Step 2 qualification.
- Vendor pricing collection.
- Quote readiness.
- Project creation.
- Payment tracking.
- Drive access control.
- Email delivery.
- Audit visibility.
- Deployment confidence.

A working, well-documented system is preferred over a cleaner repo that weakens operational proof.

## Operational-First Priority Going Forward

Future priorities should be ordered as:

1. Keep intake working.
2. Keep audit logs reliable.
3. Keep sheet data safe.
4. Keep tokens and secrets protected.
5. Keep email and vendor communication controlled.
6. Keep quote/project/payment/Drive gates accurate.
7. Keep deployment rollback possible.
8. Improve test proof.
9. Improve documentation.
10. Consider restructuring only after stability is proven.

## Freeze Stop Conditions

Do not proceed with restructure if:

- Any public webhook route is failing.
- Any required log sheet is missing or not writing.
- Any required settings key is missing.
- Any runner function is missing or unverified.
- Any deployment target is uncertain.
- Any production spreadsheet binding is uncertain.
- Any rollback path is unclear.
- Any secret has been exposed.
- Any stakeholder approval is missing.

## Freeze Control Note

This freeze protects the current known-good architecture. It can be lifted only for a specific approved migration with documented proof, rollback, and human approval.