# 00 Core Framework

The Core Master Framework is the governance-first operating model for the MIDTS Automation Engine. It exists to protect the active production-stage Apps Script system while gradually turning the repository into a reusable operational architecture.

This folder is an index and control point. It does not contain runtime Apps Script code and does not authorize code movement by itself.

## Current Stage

Stage 3: governance documentation only.

Permitted work in this stage:

- Expand framework documentation.
- Clarify operating rules.
- Define review, testing, and merge expectations.
- Preserve all dependency locks and risk classifications from Stage 2.

Not permitted in this stage:

- Apps Script code edits.
- File moves or renames.
- Webhook behavior changes.
- Sheet structure changes.
- Deployment or clasp changes.
- Email/template behavior changes.

## Framework Layers

| Layer | Folder | Purpose | Current posture |
|---|---|---|---|
| 1. Intake Layer | `docs/01-intake/` | Website intake, manual intake, lead creation, public lead submission flow | Map current behavior before changing anything |
| 2. Qualification Layer | `docs/02-qualification/` | Lead scoring, Step 2 requirements, readiness checks, qualification gates | Preserve current lead and quote readiness gates |
| 3. Communication Layer | `docs/03-communication/` | Brevo email, Slack alerts, client/vendor messaging, communication logs | Treat outbound communication as high-risk until dry-run proof exists |
| 4. Vendor Pricing Layer | `docs/04-vendor-pricing/` | Vendor assignment, pricing requests, vendor pricing webhook, pricing logs | Preserve vendor pricing dependencies and quote prerequisites |
| 5. Quote Layer | `docs/05-quotes/` | Quote creation, status transitions, approval readiness, quote records | Protect quote gate logic and status transitions |
| 6. Project Execution Layer | `docs/06-projects/` | Project creation, Drive access, payments, project lifecycle execution | Protect Drive/payment/project gates |
| 7. Audit & Governance Layer | `docs/07-audit-governance/` | Logs, risk controls, operating rules, validation evidence, change records | Primary control layer during restructuring |
| 8. Intelligence Layer | `docs/08-intelligence/` | Future analytics, AI assistance, scoring intelligence, reporting intelligence | Future/dormant until explicitly promoted |
| 9. Config & Utilities Layer | `docs/09-config-utilities/` | Settings, config keys, ID counters, shared utilities, deployment bindings | Critical dependency layer; no rename without migration |
| 10. Testing & Validation Layer | `docs/10-testing-validation/` | Stage runners, setup validation, payload tests, smoke tests, regression proof | Required evidence layer before risky changes |

## Core Governance Documents

| Document | Purpose |
|---|---|
| `docs/00_RESTRUCTURE_MAP.md` | Stage 1 map of current repository structure, services, runners, sheets, webhooks, audit systems, gates, and validations |
| `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md` | Stage 2 lock map for public entry points, service dependencies, sheet names, settings keys, security dependencies, and rename hazards |
| `docs/00-core-framework/02_RISK_REGISTER.md` | Stage 2 risk classification for critical, high-risk, medium-risk, low-risk, and future/dormant components |
| `docs/00-core-framework/03_OPERATING_MANUAL.md` | Stage 3 manual for planning, reviewing, testing, and merging future changes |
| `docs/00-core-framework/04_STAGE_RULES.md` | Stage-by-stage rules for controlled framework evolution |

## Change Control Summary

Every future change must follow these controls unless a later approved governance document makes the rule stricter:

- No direct changes to `main`.
- Every change must go through a pull request.
- No high-risk file movement without a migration plan.
- No webhook changes without matching runner proof.
- No sheet structure changes without setup validation.
- No email/template changes without dry-run verification.
- No deployment or clasp changes without explicit deployment review.

## Relationship To Runtime Code

The framework folders describe the system. They do not replace the existing Apps Script files.

Runtime code remains in its current location until the dependency lock map and risk register allow a controlled migration. Any future movement must preserve global Apps Script function names, public webhook contracts, sheet tab names, settings keys, and runner function availability unless a migration explicitly proves compatibility.

## How To Use This Folder

1. Start with `docs/00_RESTRUCTURE_MAP.md` to understand what exists.
2. Check `01_DEPENDENCY_LOCK_MAP.md` before proposing any structural change.
3. Check `02_RISK_REGISTER.md` before touching any service, sheet, webhook, or settings key.
4. Use `03_OPERATING_MANUAL.md` to plan the work and review evidence.
5. Use `04_STAGE_RULES.md` to confirm whether the requested work is allowed in the current stage.

When in doubt, document first and change runtime behavior later.

## Stage 12 Controlled Runtime Layer

- Stage 12 introduces a controlled technical file intake runtime layer for NEW-MIDTS Step 2 uploads.
- Ownership: File Intake lifecycle and controls are owned by `FileIntakeService` and documented in `13_FILE_INTAKE_AND_UPLOAD_ARCHITECTURE.md`.
- Canonical ownership rule: Step 2 file upload routing and storage governance must remain in the File Intake layer, not in generic project folder services.
- Reference: `docs/00-core-framework/13_FILE_INTAKE_AND_UPLOAD_ARCHITECTURE.md`.
