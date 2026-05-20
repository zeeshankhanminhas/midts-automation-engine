# MIDTS Automation Engine - Restructure Candidate Map

Status: Stage 6 documentation-only candidate map. This document does not move, rename, delete, refactor, optimize, or modify functional code.

Source baseline:

- `docs/00-core-framework/05_SYSTEM_TOPOLOGY.md`
- `docs/00-core-framework/08_APPS_SCRIPT_DEPENDENCY_INVENTORY.md`
- `docs/00-core-framework/09_RESTRUCTURE_RISK_REGISTER.md`

## Classification Key

| Classification | Meaning |
|---|---|
| KEEP IN PLACE | Do not plan movement; current name/location is part of production safety or deployment binding |
| SAFE TO GROUP LATER | Can be conceptually grouped in documentation or future low-risk folders after proof, but not moved now |
| DO NOT MOVE YET | High-risk runtime component; movement should wait until compatibility wrappers and tests exist |
| NEEDS TEST COVERAGE BEFORE MOVE | Movement may be possible later, but only after stronger runner/proof coverage exists |
| POSSIBLE FUTURE SPLIT | File/module may eventually be split into smaller pieces, but only after dependency and behavior tests prove safety |

## Current File Candidate Map

| Current file/module | Classification | Current role | Why | Possible future framework grouping | Required proof before any movement |
|---|---|---|---|---|---|
| `.clasp.json` | KEEP IN PLACE | Clasp project binding | Moving or changing can target the wrong Apps Script project | Deployment/config governance only | Script ID confirmation and explicit deployment review |
| `appsscript.json` | KEEP IN PLACE | Apps Script manifest/runtime config | Manifest changes affect runtime/deployment behavior | Deployment/config governance only | Manifest review and deployed smoke test |
| `CodeStage10.js` | DO NOT MOVE YET | Public `doPost(e)` router plus Stage 10/11 runners | Contains public webhook entry point and routing logic | Intake/qualification/vendor-pricing/testing documentation only | Stage 10, Stage 11, and Stage 4.5 payload proof with log rows |
| `CodeStage9.js` | DO NOT MOVE YET | Dashboard `doGet(e)`, HTML include helper, dashboard wrappers | Dashboard globals and HTML Service entry points are externally invoked | Audit-governance/dashboard layer | Stage 9 validation and dashboard smoke test |
| `Code.js` | NEEDS TEST COVERAGE BEFORE MOVE | Stage 1-4 runners and validation proofs | Runner names are operator proof contracts; splitting can hide validations | Testing-validation layer | Runner availability map and Stage 1-4 runner proof |
| `CodeStage45VendorPricing.js` | NEEDS TEST COVERAGE BEFORE MOVE | Vendor pricing setup/workflow/webhook/email runners | High-value proof surface for vendor pricing and email | Testing-validation / vendor-pricing layer | Stage 4.5 setup, workflow, webhook, and email proof |
| `CodeStage5.js` | SAFE TO GROUP LATER | Payment setup/tracking runners | Validation-only surface with narrower blast radius | Testing-validation / project execution layer | Stage 5 setup/tracking proof after any movement |
| `CodeStage6.js` | NEEDS TEST COVERAGE BEFORE MOVE | Drive setup/access runners | External Drive access is security-sensitive | Testing-validation / project execution / audit layer | Stage 6 setup/access proof and Drive log inspection |
| `CodeStage7.js` | SAFE TO GROUP LATER | Email setup/Brevo test runners | Validation-only but sends external email | Testing-validation / communication layer | Stage 7 dry-run proof to controlled recipient |
| `CodeStage8.js` | SAFE TO GROUP LATER | Slack setup/alert runners | Validation-only with lower lifecycle blast radius | Testing-validation / communication layer | Stage 8 alert proof and Slack log inspection |
| `Config.js` | DO NOT MOVE YET | Settings keys, sheet names, config lookup | Central config and settings contract across the system | Config-utilities layer | Full setup validation and all integration key checks |
| `DatabaseService.js` | DO NOT MOVE YET | Shared sheet access and sheet setup | Every sheet-backed service depends on it | Config-utilities / persistence layer | Full test matrix, sheet backup, setup validation |
| `Utils.js` | NEEDS TEST COVERAGE BEFORE MOVE | ID generation and utilities | ID counters affect every lifecycle identity | Config-utilities layer | ID generation proof and lifecycle smoke tests |
| `ErrorLogger.js` | SAFE TO GROUP LATER | Central error logging | Audit-only writer, but failure visibility depends on it | Audit-governance layer | Failure-path proof and `Error Logs` inspection |
| `LeadService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Lead creation, validation, qualification, reminders, Step 2 readiness | Central lifecycle state and gate dependency | Intake and qualification layers | Lead capture, Step 2, quote gate, vendor/project regression proof |
| `WebsiteWebhookService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Step 1 webhook intake, token/honeypot validation, logging | Public intake and security-sensitive token logic | Intake and audit-governance layers | Stage 10 payload/log proof and token/honeypot proof |
| `Step2RequirementService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Step 2 technical requirement intake and qualification update | Updates existing leads and unlocks quote readiness | Qualification layer | Stage 11 setup/payload proof and lead row inspection |
| `VendorPricingService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Vendor pricing webhook, pricing storage, quote gate helper | Pricing is quote prerequisite and public webhook target | Vendor-pricing layer | Stage 4.5 webhook/workflow proof and pricing row inspection |
| `VendorService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Vendor eligibility, assignment, vendor pricing email path | Vendor privacy/access and pricing workflow dependency | Vendor-pricing layer | Stage 4 and Stage 4.5 proof plus email dry-run where relevant |
| `QuoteService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Quote creation and quote status lifecycle | Commercial gate for project/payment progression | Quote layer | Stage 3 quote setup/creation/status proof |
| `ProjectService.js` | DO NOT MOVE YET | Project creation from lead/vendor/quote readiness | Project is downstream of multiple gates | Project execution layer | Stage 4 project proof and downstream Drive/payment check |
| `PaymentService.js` | NEEDS TEST COVERAGE BEFORE MOVE | Payment record/status tracking | High-value lifecycle state but narrower than lead/quote/project | Project execution / finance future layer | Stage 5 setup/tracking proof |
| `DriveService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Drive folder/access control and access logs | Security-sensitive external access layer | Project execution and audit-governance layers | Stage 6 proof, Drive access log, manual permission inspection |
| `EmailService.js` | DO NOT MOVE YET / POSSIBLE FUTURE SPLIT | Brevo email send and email logging | External communication can affect clients/vendors | Communication layer | Stage 7 dry-run, `Email Logs`, controlled recipients |
| `SlackService.js` | SAFE TO GROUP LATER | Slack alerts and alert logs | External alerting, lower core lifecycle risk | Communication layer | Stage 8 proof and `Slack Logs` inspection |
| `DashboardService.js` | NEEDS TEST COVERAGE BEFORE MOVE / POSSIBLE FUTURE SPLIT | Dashboard aggregation and manual lead wrapper | Mostly read-heavy but touches many sheets and can create leads | Audit-governance / intelligence-ready layer | Stage 9 validation, dashboard smoke test, manual lead test |
| `Index.html` | DO NOT MOVE YET | Dashboard template | Template name and include/render path are Apps Script contracts | Dashboard/audit-governance layer | Dashboard render proof after any template path/name change |
| `ClientJS.html` | DO NOT MOVE YET | Dashboard client behavior | Calls server-side wrapper names through `google.script.run` | Dashboard/audit-governance layer | Dashboard interaction proof |
| `Styles.html` | SAFE TO GROUP LATER | Dashboard styles | Lower logic risk, but still included by template name | Dashboard/audit-governance layer | Dashboard render proof |
| `WEBSITE_FORM_WEBHOOK_DIAGNOSTIC.md` | SAFE TO GROUP LATER | Operator diagnostic documentation | Documentation/reference only | Audit-governance or integration docs | Documentation review only |
| `website-integration/README.md` | SAFE TO GROUP LATER | Frontend integration reference | Reference material can be grouped after contract review | Intake/integration docs | Payload contract review |
| `website-integration/app/api/enquiry/route.ts` | SAFE TO GROUP LATER | Frontend example/API reference | Not Apps Script runtime, but can affect external contract understanding | Intake/integration docs | Payload contract review and frontend/backend alignment |
| `website-integration/components/EnquiryForm-submit-handler.example.tsx` | SAFE TO GROUP LATER | Frontend form submit example | Reference material; contract drift risk if inaccurate | Intake/integration docs | Payload contract review |
| `docs/**` | SAFE TO GROUP LATER | Governance documentation | Documentation-only and low runtime risk | Framework documentation | Documentation review only |
| `AGENTS.md` | KEEP IN PLACE | Contributor/agent operating guidance | Guides future work; bad movement can reduce visibility | Repo root governance | Governance review |

## Future Split Candidates

These files may eventually benefit from splitting, but only after tests and compatibility wrappers exist.

| File | Possible split | Why not now |
|---|---|---|
| `LeadService.js` | Intake creation, qualification readiness, reminders, sanitized vendor lead snapshots | Central lifecycle dependency; too many downstream gates read lead state |
| `WebsiteWebhookService.js` | Token/security validation, payload normalization, Step 1 lead creation, webhook audit logging | Public webhook behavior and audit trail must remain stable |
| `Step2RequirementService.js` | Payload validation, lead update, qualification scoring, Step 2 logging | Wrong split can update wrong lead or break quote readiness |
| `VendorPricingService.js` | Public pricing intake, pricing row storage, pricing approval/gate helper, logging | Quote gate depends on pricing state and public webhook payloads |
| `VendorService.js` | Vendor eligibility, assignment, vendor email/request preparation | Vendor privacy/access and email workflows are coupled operationally |
| `QuoteService.js` | Quote creation, status transition rules, pricing snapshot logic | Quote lifecycle gates project/payment execution |
| `DriveService.js` | Folder creation, access grants/removals, access logging | Security-sensitive external permission changes |
| `EmailService.js` | Brevo transport, template/body building, email audit logging | Outbound communication must be dry-run proven before template/transport split |
| `DashboardService.js` | Metrics aggregation, recent records, manual lead creation wrapper | Read paths and mutation wrapper should be separated only after dashboard proof |

## Candidate Grouping By Future Framework Layer

| Future layer | Candidate files/modules | Current movement posture |
|---|---|---|
| Intake | `WebsiteWebhookService.js`, intake parts of `LeadService.js`, `CodeStage10.js` Step 1 route, website integration docs | Do not move runtime yet; docs/reference can group later |
| Qualification | `Step2RequirementService.js`, qualification parts of `LeadService.js`, Stage 11 runners | Do not move runtime yet |
| Communication | `EmailService.js`, `SlackService.js`, `CodeStage7.js`, `CodeStage8.js` | Slack/email runners may group later; `EmailService` stays put for now |
| Vendor Pricing | `VendorService.js`, `VendorPricingService.js`, `CodeStage45VendorPricing.js` | Do not move core runtime yet; runners need coverage proof |
| Quotes | `QuoteService.js`, quote runners in `Code.js` | Do not move runtime yet |
| Projects | `ProjectService.js`, `PaymentService.js`, `DriveService.js`, Stage 5/6 runners | Payment runner can group later; Drive/project runtime stays put |
| Audit & Governance | `ErrorLogger.js`, `DashboardService.js`, logs, diagnostic docs | Docs can group; `DashboardService` needs coverage before movement |
| Intelligence | Dashboard read models, metrics docs, future analytics docs | Documentation-only for now |
| Config & Utilities | `Config.js`, `DatabaseService.js`, `Utils.js`, manifests | Keep in place until test matrix is strong |
| Testing & Validation | `Code.js`, `CodeStage*.js` runners | Group later only after runner availability map and proof |

## Stage 6 Control Note

This map classifies candidates only. It is not approval to move files. The safest immediate restructure remains documentation grouping, not runtime movement.