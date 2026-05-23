# MIDTS Automation Engine - Failure Handling Matrix

Status: documentation-only operational control document. This file centralizes failure diagnosis and recovery governance.

## Purpose

This is the canonical owner for:

- failure recovery;
- retry behavior;
- first-check diagnosis;
- escalation expectations;
- silent-failure handling;
- operational rollback guidance.

## Failure Governance Rules

- Every critical workflow must have a first-check location.
- Every external integration failure must become visible through logs or validation proof.
- A workflow must never silently mutate state without audit evidence.
- If a failure affects customer/vendor trust, the system should stop safely rather than continue partially.
- If a workflow reaches an unknown state, escalation is preferred over automation.

## Failure Matrix

| Failure area | Severity | First place to check | Retry? | Manual intervention | Audit required |
|---|---|---|---|---|---|
| Website form submission creates no lead | Critical | Apps Script executions; `Website Webhook Logs` | No automatic retry until root cause known | Verify deployment URL, token, webhook payload, sheet access | `Website Webhook Logs`; `Error Logs` |
| Invalid or missing webhook token | Critical | `Website Webhook Logs`; `Settings` | No | Verify `WEBSITE_WEBHOOK_TOKEN` alignment between frontend and Apps Script | `Website Webhook Logs` |
| Honeypot triggered unexpectedly | Medium | `Website Webhook Logs` | No | Verify frontend field names and spam behavior | `Website Webhook Logs` |
| Step 2 updates wrong lead | Critical | `Step 2 Requirement Logs`; affected `Leads` rows | No | Freeze Step 2 workflow until linkage issue confirmed | `Step 2 Requirement Logs`; `Error Logs` |
| Vendor pricing attached to wrong lead/vendor | Critical | `Vendor Pricing Logs`; `Vendor Pricing` rows | No | Freeze quote creation until corrected | `Vendor Pricing Logs`; `Error Logs` |
| Quote created without approved vendor pricing | Critical | `Quotes`; quote runner outputs | No | Review quote gate logic and manually block progression | `Quotes`; `Error Logs` |
| Invalid quote state transition | High | `Quotes`; runner outputs | No | Manual review required before correction | `Quotes`; `Error Logs` |
| Project created before accepted quote | Critical | `Projects`; `Quotes` | No | Freeze downstream Drive/payment workflows | `Projects`; `Error Logs` |
| Payment state mismatch | High | `Payments`; `Quotes` | Conditional | Manual reconciliation required | `Payments`; `Error Logs` |
| Drive access granted to wrong vendor | Critical | `Drive Access Logs`; Drive sharing panel | No | Immediately revoke access and investigate assignment chain | `Drive Access Logs`; `Error Logs` |
| Drive folder creation failure | High | `Drive Access Logs`; Apps Script executions | Conditional | Verify root folder and Drive permissions | `Drive Access Logs` |
| Lead acknowledgement email not delivered | Medium | `Email Logs`; Brevo API response | Conditional | Verify sender config and recipient email | `Email Logs` |
| Vendor assignment email not delivered | High | `Email Logs`; Brevo API response | Conditional | Verify vendor email and pricing link | `Email Logs` |
| Slack alert failure | Medium | `Slack Logs`; webhook settings | Conditional | Verify `SLACK_WEBHOOK_URL` and Slack availability | `Slack Logs` |
| Missing audit log row | Critical | Relevant log sheet; Apps Script executions | No | Stop and investigate before trusting workflow state | Relevant log sheet; `Error Logs` |
| Duplicate IDs generated | Critical | `ID Counters`; generated rows | No | Freeze affected workflow and inspect `LockService` behavior | `Error Logs`; ID validation proof |
| Missing sheet/header | Critical | Setup validation runners | No | Restore sheet/header before resuming operations | Setup validation proof |
| Wrong Apps Script deployment target | Critical | `.clasp.json`; deployment URL | No | Stop deployment activity immediately | Deployment review notes |
| Dashboard fails to load | Medium | Apps Script executions; HTML templates | Conditional | Verify `Index.html`, `ClientJS.html`, `Styles.html` linkage | `Error Logs` |
| Dashboard metrics incorrect | Medium | `DashboardService`; sheet reads | Conditional | Verify aggregation logic and sheet contracts | `Error Logs` |
| Runner passes but expected rows missing | Critical | Relevant sheets and logs | No | Treat validation as failed and investigate silent failure | Relevant logs; validation evidence |

## Silent Failure Rule

Treat these as dangerous:

- workflow success with no log row;
- state mutation with no audit proof;
- successful runner output with missing sheet evidence;
- webhook execution with no matching lifecycle mutation.

## Retry Guidance

| Failure type | Retry strategy |
|---|---|
| External email/Slack API transient failure | Conditional retry after config verification |
| Token validation failure | No retry until payload/config corrected |
| Sheet/header missing | No retry until setup repaired |
| Wrong lifecycle linkage | No retry; requires investigation |
| Drive permission failure | Conditional retry after permission review |
| Deployment mismatch | No retry until deployment target confirmed |

## Escalation Rule

Escalate to operator/manual review when:

- quote/vendor/project/payment linkage becomes uncertain;
- audit visibility disappears;
- external access may have been granted incorrectly;
- the same failure repeats after retry;
- the workflow reaches an undefined state.

## Canonical Ownership Rule

- This file owns failure recovery governance.
- `07_EVENT_CHAIN_MAP.md` should reference this file for recovery behavior.
- `02_RISK_REGISTER.md` owns severity classification only.
- Runtime code should not implement silent recovery behavior that is undocumented here.
