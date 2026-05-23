# MIDTS Automation Engine - State Machine

Status: documentation-only operational control document. This file defines canonical lifecycle states and legal transitions. It does not authorize Apps Script edits or workflow changes.

## Purpose

This is the canonical owner for lifecycle state governance.

Use this file before:

- adding statuses;
- changing quote/payment/project behavior;
- altering progression gates;
- introducing automation shortcuts;
- allowing manual overrides;
- adding new dashboard actions.

## State Governance Rules

- A state transition must have a known trigger.
- A state transition must have an allowed actor.
- A state transition must have audit visibility.
- Illegal transitions must fail safely.
- Manual overrides must remain visible.
- State transitions must never silently bypass operational gates.

## Lead Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `New` | `Under Review`, `Qualified`, `Rejected` | `Quoted`, `Project Active`, `Archived` | Automation, Operator | EVT-001, dashboard/manual review | `Leads`; `Website Webhook Logs` |
| `Under Review` | `Qualified`, `Rejected` | `Quoted`, `Project Active` | Operator | Qualification review | `Leads`; qualification logs |
| `Qualified` | `Vendor Pricing Pending`, `Quoted`, `Archived` | `Project Active` without quote acceptance | Automation, Operator | EVT-002; quote readiness checks | `Leads`; quote proof |
| `Vendor Pricing Pending` | `Quoted`, `Rejected` | `Project Active`, `Paid` | Operator | EVT-007 through EVT-010 | `Vendor Pricing Logs`; quote proof |
| `Quoted` | `Awaiting Payment`, `Rejected`, `Archived` | `Project Active` without accepted quote | Operator | EVT-010, EVT-011 | `Quotes`; quote status logs |
| `Awaiting Payment` | `Project Active`, `Archived` | `Delivered` | Operator | EVT-013 | `Payments`; `Projects` |
| `Project Active` | `Delivered`, `Archived` | `New`, `Quoted` | Operator | EVT-012 through EVT-014 | `Projects`; `Drive Access Logs` |
| `Delivered` | `Archived` | `Quoted`, `Project Active` | Operator | Project completion review | `Projects` |
| `Rejected` | `Archived` | `Project Active`, `Delivered` | Operator | Manual rejection | `Leads`; Error Logs if abnormal |
| `Archived` | None | All forward states | Operator only | Archival workflow | `Leads` |

## Vendor Pricing Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `Requested` | `Submitted`, `Expired`, `Cancelled` | `Approved` directly | Vendor, Operator | EVT-008 | `Vendor Pricing Logs` |
| `Submitted` | `Approved`, `Rejected`, `Revision Requested` | `Requested` | Operator | EVT-003, EVT-009 | `Vendor Pricing`; `Vendor Pricing Logs` |
| `Revision Requested` | `Submitted`, `Rejected` | `Approved` without resubmission | Vendor, Operator | Manual review workflow | `Vendor Pricing Logs` |
| `Approved` | `Consumed By Quote`, `Archived` | `Requested` | Operator | EVT-009, EVT-010 | Quote creation proof |
| `Rejected` | `Archived` | `Approved` without resubmission | Operator | Manual rejection | `Vendor Pricing Logs` |
| `Expired` | `Requested` | `Approved` | Operator | Time/manual review | `Vendor Pricing Logs` |
| `Consumed By Quote` | `Archived` | `Requested`, `Submitted` | Automation, Operator | EVT-010 | Quote linkage proof |

## Quote Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `Draft` | `Sent`, `Rejected` | `Accepted`, `Paid` directly | Operator | EVT-010 | `Quotes` |
| `Sent` | `Accepted`, `Rejected`, `Expired` | `Paid` without acceptance | Operator, Client | EVT-011 | Quote status proof |
| `Accepted` | `Awaiting Payment`, `Project Ready` | `Draft` | Operator | EVT-011 | Quote status proof |
| `Awaiting Payment` | `Paid`, `Cancelled` | `Project Active` without payment rule satisfaction | Operator | EVT-013 | `Payments` |
| `Paid` | `Project Ready`, `Archived` | `Draft` | Automation, Operator | EVT-013 | `Payments`; `Projects` |
| `Project Ready` | `Archived` | `Draft` | Operator | EVT-012 | `Projects` |
| `Rejected` | `Archived` | `Accepted` without resend/revision | Operator | Manual rejection | `Quotes` |
| `Expired` | `Archived` | `Accepted` without reopen | Operator | Expiry workflow | `Quotes` |

## Project Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `Created` | `Execution Ready`, `On Hold`, `Cancelled` | `Delivered` | Automation, Operator | EVT-012 | `Projects` |
| `Execution Ready` | `Active`, `On Hold`, `Cancelled` | `Delivered` | Operator | Drive/vendor readiness | `Drive Access Logs` |
| `Active` | `Delivered`, `On Hold`, `Cancelled` | `Created` | Operator | Project operations | `Projects` |
| `On Hold` | `Active`, `Cancelled` | `Delivered` | Operator | Manual review | `Projects` |
| `Delivered` | `Archived` | `Created`, `Execution Ready` | Operator | Delivery confirmation | `Projects` |
| `Cancelled` | `Archived` | `Active` | Operator | Manual cancellation | `Projects` |
| `Archived` | None | All forward states | Operator | Archival workflow | `Projects` |

## Payment Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `Pending` | `Paid`, `Failed`, `Refunded` | `Project Active` if payment required | Operator, Automation | EVT-013 | `Payments` |
| `Paid` | `Refunded`, `Archived` | `Pending` | Automation, Operator | Payment confirmation | `Payments` |
| `Failed` | `Pending`, `Archived` | `Paid` without retry/confirmation | Operator | Payment review | `Payments` |
| `Refunded` | `Archived` | `Paid` | Operator | Refund workflow | `Payments` |
| `Archived` | None | All forward states | Operator | Archival workflow | `Payments` |

## Drive Access Lifecycle

| Current state | Allowed next states | Blocked next states | Actor allowed | Trigger/event | Audit proof |
|---|---|---|---|---|---|
| `Not Provisioned` | `Provisioned` | `Access Granted` | Automation, Operator | EVT-014 | `Drive Access Logs` |
| `Provisioned` | `Access Granted`, `Archived` | `Delivered` | Automation, Operator | Drive folder setup | `Drive Access Logs` |
| `Access Granted` | `Access Revoked`, `Archived` | `Not Provisioned` | Automation, Operator | Vendor assignment/execution | `Drive Access Logs` |
| `Access Revoked` | `Archived` | `Access Granted` without reassignment | Operator | Security/offboarding | `Drive Access Logs` |
| `Archived` | None | All forward states | Operator | Archival workflow | `Drive Access Logs` |

## Illegal Transition Rule

If a transition is not explicitly listed as allowed, it is considered blocked by default.

## Manual Override Rule

Manual overrides should:

- require an operator;
- write audit evidence;
- preserve previous state visibility;
- never silently bypass quote/vendor/payment/Drive gates.
