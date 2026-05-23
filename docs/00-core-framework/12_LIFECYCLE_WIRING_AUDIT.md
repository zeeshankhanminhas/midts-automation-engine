# MIDTS Automation Engine - Lifecycle Wiring Audit

Status: CTO documentation-only audit. This document does not authorize Apps Script edits, file moves, renames, sheet changes, webhook changes, deployment changes, or functional changes.

## Purpose

This document walks the MIDTS lifecycle step by step and checks each stage for:

- trigger;
- handler;
- approval gate;
- notification;
- document generation;
- audit log;
- missing wiring.

## Executive Summary

The current MIDTS engine has strong intake, qualification, vendor pricing, quote gating, Drive access, and audit foundations. It is not yet a complete end-to-end ERP-style operating system because several lifecycle moments still depend on manual/operator calls or are not implemented yet.

Most important missing runtime layers:

1. Document generation service.
2. Customer quote approval/acceptance trigger.
3. Payment provider webhook integration.
4. Automatic post-project Drive orchestration.
5. Admin/operator notifications for key lifecycle changes.
6. Delivery/completion workflow.
7. Customer/vendor document pack lifecycle.

## Lifecycle Audit Table

| Step | Lifecycle moment | Trigger status | Handler/service | Approval/gate | Notification | Document generator | Audit log | CTO verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | Website Step 1 lead submitted | Wired | `doPost(e)` -> `WebsiteWebhookService.handlePostEvent(e)` | Webhook token, honeypot, required fields | Lead received/Step 2 email when configured | Missing | `Website Webhook Logs`, `Email Logs` | Strong intake, but no lead intake PDF/snapshot document. |
| 2 | Lead created | Wired | `LeadService.createLead(...)` | Required lead fields | Step 2 link email via `EmailService` | Missing | `Leads`, `Website Webhook Logs` | Good. Needs optional admin Slack alert if live ops require it. |
| 3 | Step 2 technical requirements submitted | Wired | `Step2RequirementService.handlePostEvent(e)` | Token, lead ID, scoring, lead qualification | Not clearly customer-facing after completion | Missing | `Step 2 Requirement Logs` | Strong. Needs client confirmation and internal review notification. |
| 4 | Post-Step-2 vendor dispatch | Partially wired / controlled | `VendorAssignmentDispatcherService.dispatchAfterStep2(...)` | Lead must be qualified; auto-dispatch setting; default vendor setting; duplicate pricing check | Vendor email if enabled | Missing | `Vendor Assignment Logs`, `Vendor Pricing Logs`, `Email Logs` | Strong controlled dispatcher, but live auto-dispatch depends on settings and approval. |
| 5 | Vendor pricing request created | Wired | `VendorPricingService.createVendorPricingDispatchRecord(...)` | No duplicate active request | Vendor pricing request email when `sendEmail` true | Missing | `Vendor Pricing Logs`, `Email Logs` | Good. Needs document/file pack for vendor only if safe and sanitized. |
| 6 | Vendor pricing submitted | Wired | `VendorPricingService.handlePostEvent(e)` | Token, active request, vendor/lead linkage, valid cost/ETA | Not clearly notifying MIDTS operator | Missing | `Vendor Pricing Logs`, `Vendor Pricing` | Good intake. Needs operator notification for pricing review. |
| 7 | MIDTS reviews vendor pricing | Manual/service-level | `VendorPricingService.approveVendorPricingForQuote(...)` | Pricing must be submitted; margin/final price must exist | Not clearly wired | Missing | `Vendor Pricing` | Approval gate exists, but approval workflow needs clearer dashboard/operator notification. |
| 8 | Customer quote record created | Wired as service call | `QuoteService.createQuoteForLead(...)` | Qualified lead and approved vendor pricing with final customer price | Not automatic unless separate send call | Missing | `Quotes`, Error Logs on failure | Quote record exists, but quote document/PDF generation is missing. |
| 9 | Customer quote sent | Wired as email service call | `QuoteService.sendQuoteToCustomer(...)` -> `EmailService` | Quote must be Draft or Sent; valid lead email | Customer quote email | Missing quote PDF/attachment | `Email Logs`, `Quotes` status | Email exists, but document output is missing. |
| 10 | Customer quote accepted | Wired only as service/manual call | `QuoteService.acceptCustomerQuote(...)` | Quote must be Sent | Not clearly notifying operations | Missing acceptance record/PDF/e-sign | `Quotes` | Needs customer-facing acceptance trigger/form/e-sign and acceptance audit document. |
| 11 | Payment record created | Wired as service/manual call | `PaymentService.createPaymentForQuote(...)` | Quote must be Accepted | Not clearly wired | Missing invoice/payment request document | `Payments` | Payment tracking exists; payment collection/webhook does not. |
| 12 | Payment confirmed | Wired as manual service call | `PaymentService.markPaymentPaid(...)` | Amount must be valid; not already paid | Not clearly notifying operations/client | Missing receipt/invoice PDF | `Payments` | Manual tracking exists; Stripe/payment webhook missing. |
| 13 | Project created | Wired as service/manual call | `ProjectService.createProjectFromQuote(...)` | Qualified lead, eligible vendor, accepted quote | Not clearly wired | Missing project kickoff pack | `Projects` | Project record works; automatic downstream orchestration is partial. |
| 14 | Drive folder created | Wired as service/manual call | `DriveService.createProjectFolder(...)` | Project exists; root folder configured | Not clearly wired | Folder only, no document pack | `Drive Access Logs`, `Projects` Drive Folder ID | Good service-level wiring, not automatic after project creation. |
| 15 | Vendor Drive access granted | Wired as service/manual call | `DriveService.grantVendorProjectFolderAccess(...)` | Vendor eligible and assigned to project | Not clearly wired | Missing vendor work pack | `Drive Access Logs` | Good security gate. Needs notification and possibly access expiry/review. |
| 16 | Project delivery / completion | Missing | Future `DeliveryService` / `ProjectService` extension | Client/vendor/project checks | Missing | Missing delivery pack | Missing | Major missing lifecycle area. |
| 17 | Project archive / closeout | Missing | Future archive workflow | Completion, payment, access revoked | Missing | Missing archive pack | Missing | Major missing governance area. |

## Missing Wiring By Category

### 1. Trigger Gaps

| Gap | Why it matters | Recommended owner |
|---|---|---|
| Customer quote acceptance trigger | Client acceptance currently appears service/manual, not customer-facing | `QuoteAcceptanceService` or QuoteService web endpoint |
| Payment provider webhook | Manual payment tracking cannot confirm real payment automatically | `PaymentWebhookService` |
| Automatic project-to-Drive orchestration | Project creation does not automatically create folder/access | `ProjectOrchestratorService` |
| Document generation triggers | Quotes/projects/payments do not produce documents | `DocumentService` |
| Project delivery/completion trigger | No delivery lifecycle yet | `DeliveryService` or ProjectService extension |
| Archive/closeout trigger | No final lifecycle governance | `ArchiveService` or ProjectService extension |

### 2. Approval Gaps

| Gap | Current state | Recommended control |
|---|---|---|
| Vendor pricing review approval | Exists as service-level approval | Add dashboard/operator review queue and approval log |
| Quote approval before sending | Quote can be created and sent by service call | Add `Approved To Send` state or operator confirmation if needed |
| Customer acceptance proof | Service call exists | Add customer-facing acceptance token/e-sign/approval log |
| Payment reconciliation | Manual status update exists | Add provider webhook and manual override log |
| Drive access approval | Vendor eligibility gate exists | Add access expiry/review policy if files are sensitive |

### 3. Notification Gaps

| Lifecycle moment | Recommended notification |
|---|---|
| Step 1 lead received | Internal Slack alert to operations |
| Step 2 completed | Internal Slack/email alert: qualified lead ready |
| Vendor dispatch skipped | Internal alert if skipped because default vendor or auto setting missing |
| Vendor pricing submitted | Internal alert: pricing awaiting review |
| Vendor pricing approved | Internal alert: quote ready to create/send |
| Quote sent | Internal audit note plus optional customer confirmation |
| Quote accepted | Internal urgent alert: prepare payment/project |
| Payment paid | Internal alert and customer receipt |
| Project created | Internal kickoff alert |
| Drive access granted | Vendor notification and internal audit alert |
| Project delivered | Customer delivery email |
| Project closed | Client closeout email and access review reminder |

### 4. Document Generator Gaps

Recommended future `DocumentService` functions:

| Function | Trigger | Output | Storage |
|---|---|---|---|
| `generateLeadIntakeSnapshot(leadId)` | After Step 1 or Step 2 | Internal intake PDF/doc | Lead/project Drive folder |
| `generateVendorPricingBrief(leadId, vendorId)` | Before vendor email | Sanitized vendor brief | Project/vendor-safe folder |
| `generateCustomerQuotePdf(quoteId)` | Before quote email | Customer quote PDF | Quote/customer folder |
| `generateInvoice(paymentId)` | After quote acceptance/payment request | Invoice PDF | Finance/project folder |
| `generateReceipt(paymentId)` | After payment paid | Receipt PDF | Finance/project folder |
| `generateProjectKickoffPack(projectId)` | After project creation | Internal/vendor project pack | Project folder |
| `generateDeliveryPack(projectId)` | At delivery | Final delivery document pack | Project folder |
| `generateCloseoutPack(projectId)` | At archive | Closeout/QA/access record | Archive folder |

Required support sheets/settings:

- `Document Logs`
- `Quote Template ID`
- `Invoice Template ID`
- `Receipt Template ID`
- `Project Pack Template ID`
- `Delivery Pack Template ID`
- `DOCUMENT_OUTPUT_ROOT_FOLDER_ID` or use project folder when available

### 5. Audit Gaps

| Gap | Recommended audit sheet/log |
|---|---|
| Document generation attempts | `Document Logs` |
| Customer quote acceptance | `Quote Acceptance Logs` or `Quote Logs` |
| Payment provider webhook events | `Payment Webhook Logs` |
| Project lifecycle changes | `Project Logs` |
| Manual overrides | `Manual Override Logs` |
| Access review/expiry | `Drive Access Review Logs` |

## CTO Priority Order

Do not build everything at once. Recommended sequence:

1. Add lifecycle audit documentation and keep runtime stable.
2. Add `DocumentService` as a future-stage design doc before code.
3. Add customer quote acceptance trigger design.
4. Add payment webhook design.
5. Add Project Orchestrator design: accepted quote/payment -> project -> Drive -> notifications.
6. Add delivery/closeout lifecycle.
7. Only then implement runtime stages one by one with test runners.

## Immediate Decision

The system is not missing basic structure. It is missing the last operating-system layer:

- document artifacts;
- customer approval triggers;
- payment confirmation triggers;
- automatic project orchestration;
- delivery and closeout lifecycle.

This should be treated as the next major framework stage, not as scattered patches inside existing services.
