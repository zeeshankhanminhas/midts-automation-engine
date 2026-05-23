# MIDTS Automation Engine - Wiring, State, And Redundancy Audit

Status: documentation-only framework cleanup. This document does not authorize Apps Script edits, file moves, renames, sheet changes, webhook changes, deployment changes, or functional changes.

## CTO Assessment

The Core Master Framework is strong, but it currently spreads wiring, state, trigger, and failure knowledge across several documents. That makes the system look more complete than it is while still leaving operators and future agents without one canonical control surface for execution behavior.

The missing issue is not a lack of documentation. The missing issue is a lack of **first-class operational control documents**.

## What Already Exists

| Existing area | Current source | Keep? | Notes |
|---|---|---|---|
| Repository inventory | `docs/00_RESTRUCTURE_MAP.md` | Yes | Canonical map of files, services, sheets, settings, runners, and gates. |
| Dependency lock | `docs/00-core-framework/01_DEPENDENCY_LOCK_MAP.md` | Yes | Canonical source for public contracts and rename hazards. |
| Risk classification | `docs/00-core-framework/02_RISK_REGISTER.md` | Yes | Canonical source for change severity and control expectations. |
| Operating process | `docs/00-core-framework/03_OPERATING_MANUAL.md` | Yes | Canonical source for PR, review, testing, and merge rules. |
| Stage rules | `docs/00-core-framework/04_STAGE_RULES.md` | Yes | Canonical source for what each framework stage allows and blocks. |
| System topology | `docs/00-core-framework/05_SYSTEM_TOPOLOGY.md` | Yes | Canonical source for component topology and service relationships. |
| Data movement | `docs/00-core-framework/06_DATA_FLOW_MAP.md` | Yes | Canonical source for current data movement and lifecycle flow. |
| Event chain map | `docs/00-core-framework/07_EVENT_CHAIN_MAP.md` | Yes, but split later | Useful, but it currently mixes triggers, states, blocking chains, and failure notes. |

## What Is Missing Big

The framework needs these first-class documents before more runtime features are added.

| Missing document | Exact location | Purpose | Why it matters |
|---|---|---|---|
| Trigger Registry | `docs/00-core-framework/09_TRIGGER_REGISTRY.md` | One row per event: source, trigger type, router, handler, state mutation, audit log, failure handling, proof runner. | Prevents isolated modules that do not fire end-to-end. |
| State Machine | `docs/00-core-framework/10_STATE_MACHINE.md` | Allowed lifecycle states and legal transitions for Lead, Vendor Pricing, Quote, Project, Payment, Drive Access. | Prevents invalid workflow jumps and silent state corruption. |
| Failure Handling Matrix | `docs/00-core-framework/11_FAILURE_HANDLING_MATRIX.md` | Failure mode, severity, first check, retry behavior, manual intervention, audit requirement. | Prevents silent failures and unclear recovery. |
| Human Intervention Map | `docs/00-core-framework/12_HUMAN_INTERVENTION_MAP.md` | Where MIDTS must manually approve, override, review, or stop automation. | Keeps human-in-the-loop control explicit. |
| Runtime Configuration Map | `docs/00-core-framework/13_RUNTIME_CONFIGURATION_MAP.md` | Settings keys, config values, script properties, safe defaults, migration rules. | Stops hardcoded logic and protects future changes. |
| Redundancy Control Index | `docs/00-core-framework/14_REDUNDANCY_CONTROL_INDEX.md` | Defines the canonical owner of each repeated topic and where duplicates should link instead of repeat. | Removes framework drift. |

## Exact Redundancy To Remove

Do not delete important governance content yet. Reduce redundancy by assigning one canonical owner per topic and making other files reference that owner.

| Topic | Canonical owner | Other files should do this |
|---|---|---|
| File inventory and layer mapping | `00_RESTRUCTURE_MAP.md` | Link to it instead of repeating full file lists. |
| Entry points and locked names | `01_DEPENDENCY_LOCK_MAP.md` | Link to it instead of repeating all locked function/sheet/settings names. |
| Risk severity | `02_RISK_REGISTER.md` | Reference risk class only; do not repeat full risk explanation. |
| Change process | `03_OPERATING_MANUAL.md` | Keep PR/testing/merge rules here only. |
| Stage permissions | `04_STAGE_RULES.md` | Keep allowed/blocked work here only. |
| Component topology | `05_SYSTEM_TOPOLOGY.md` | Keep service relationship maps here only. |
| Data movement | `06_DATA_FLOW_MAP.md` | Keep lifecycle data movement here only. |
| Trigger/event routing | `09_TRIGGER_REGISTRY.md` | Move precise event-to-handler ownership here. |
| State transitions | `10_STATE_MACHINE.md` | Move legal/illegal status transitions here. |
| Failure recovery | `11_FAILURE_HANDLING_MATRIX.md` | Move recovery, retry, escalation, and first-check rules here. |

## Redundancy Cleanup Rule

When updating existing docs:

1. Do not paste the same table into multiple files.
2. Keep detail in the canonical owner document.
3. In secondary documents, use a one-line summary plus a link to the canonical owner.
4. If a topic appears in more than two documents, create or update the canonical owner.
5. If a runtime change alters triggers, states, failure handling, sheets, settings, or gates, update the relevant canonical document in the same PR.

## Immediate Framework Fix Order

### Step 1 - Update the framework index

Update `docs/00-core-framework/README.md` so it lists Stage 4 documents and this audit. This fixes the current stale index problem.

### Step 2 - Create Trigger Registry

Create `09_TRIGGER_REGISTRY.md` with this minimum table:

| Event ID | Event source | Trigger type | Router | Handler/service | State mutation | Audit log | Failure behavior | Proof runner |
|---|---|---|---|---|---|---|---|---|
| EVT-001 | Website Step 1 form | Public HTTP POST | `doPost(e)` / `routeWebsiteWebhookPost_(e)` | `WebsiteWebhookService.handlePostEvent(e)` | Creates `Leads` row | `Website Webhook Logs` | Reject/log token, honeypot, validation, sheet failure | `runStage10WebsiteWebhookPayloadTest` |
| EVT-002 | Step 2 form | Public HTTP POST | `doPost(e)` / `routeWebsiteWebhookPost_(e)` | `Step2RequirementService.handlePostEvent(e)` | Updates existing `Leads` row | `Step 2 Requirement Logs` | Reject/log token, missing lead, validation, sheet failure | `runStage11Step2RequirementPayloadTest` |
| EVT-003 | Vendor pricing form | Public HTTP POST | `doPost(e)` / `routeWebsiteWebhookPost_(e)` | `VendorPricingService.handlePostEvent(e)` | Updates `Vendor Pricing` row | `Vendor Pricing Logs` | Reject/log token, wrong link, duplicate, invalid cost | `runStage45VendorPricingWebhookPayloadTest` |
| EVT-004 | Dashboard manual lead | Dashboard client call | `google.script.run` | `createDashboardLead(input)` / `DashboardService` | Creates `Leads` row | Error log on failure | Reject invalid input/sheet failure | `runStage9DashboardSetupValidation` plus manual dashboard smoke test |
| EVT-005 | Vendor assignment | Manual/operator workflow | Service call | `VendorService.assignVendorToLead(...)` | Updates `Vendors` / creates pricing dispatch record | `Vendor Pricing Logs`, `Email Logs` | Block ineligible vendor, duplicate request, missing email | `runStage45VendorAssignmentEmailTest` |

### Step 3 - Create State Machine

Create `10_STATE_MACHINE.md` with separate state tables for:

- Lead lifecycle
- Vendor pricing lifecycle
- Quote lifecycle
- Project lifecycle
- Payment lifecycle
- Drive access lifecycle

Each table must include:

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|

### Step 4 - Create Failure Handling Matrix

Create `11_FAILURE_HANDLING_MATRIX.md` with:

| Failure area | Severity | First place to check | Retry? | Manual intervention | Audit required |
|---|---|---|---|---|---|

### Step 5 - Refactor duplication only after the new control docs exist

Do not delete repeated content immediately. First create canonical docs. Then replace duplicate sections with short references in a later documentation-only PR.

## Runtime Safety Note

No Apps Script runtime files should be touched for this cleanup. The correct cleanup path is:

1. Add canonical control documents.
2. Update the framework index.
3. Replace duplicate documentation blocks with links.
4. Only later consider code wrappers, if the trigger/state docs prove the behavior is stable.

## Decision

The framework should not be rebuilt. It should be tightened.

The next safe move is documentation-only:

- keep the existing working repo stable;
- promote wiring, state, and failure recovery into first-class control documents;
- remove redundancy by assigning canonical ownership, not by deleting useful evidence too early.
