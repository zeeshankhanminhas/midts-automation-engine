# MIDTS Production Messaging and Document Templates

## Sprint scope

This sprint prepares MIDTS communication and generated documents for real client/vendor use without changing workflow logic, sheet schemas, webhook routing, pricing logic, Drive folder logic, or sending live emails.

## Phase 1 — Communication audit

### Outbound communication points found

| Communication point | Current owner | Audience | Production action |
|---|---|---:|---|
| Step 1 enquiry acknowledgement | `EmailService.sendLeadReceivedEmail`, patched by `ZZ_EmailProductionCopyPatch.js` | Client | Mapped to `STEP_1_ENQUIRY_RECEIVED` |
| Step 2 technical requirement reminders | `EmailService.sendStep2ReminderEmail`, patched by `ZZ_EmailProductionCopyPatch.js` | Client | Mapped to `STEP_2_TECHNICAL_REQUIREMENT_REQUEST` tone |
| Website lead acknowledgement bridge | `sendWebsiteLeadAcknowledgement_` in `CodeStage10.js` | Client | Uses patched Step 1 acknowledgement |
| Vendor pricing request | `EmailService.sendVendorPricingRequestEmail`, patched by `ZZ_EmailProductionCopyPatch.js` | Vendor | Mapped to `VENDOR_PRICING_REQUEST` |
| Client quote issued | `sendCustomerQuoteEmail_` in `CodeStage3QuoteDelivery.js` | Client | Mapped to `CLIENT_QUOTE_ISSUED` |
| Quote acceptance response | `QuoteAcceptanceService.js` | Client/system | Template added; send workflow not changed |
| Payment request/status | `PaymentService.js` | Client/internal | Template added; send workflow not changed |
| Project start/handoff | `ProjectService.js` | Client/internal | Template added; send workflow not changed |
| File intake receipt | `FileIntakeService.js` and file review services | Client/internal | Template added; send workflow not changed |
| Delivery/final handoff | Project/delivery workflow | Client | Template added; send workflow not changed |
| Revision/clarification | Project/delivery workflow | Client/vendor as needed | Template added; send workflow not changed |
| Unable to quote/decline | Lead/quote review workflow | Client | Template added; send workflow not changed |
| Slack internal alerts | `SlackService.js` | Internal | Webhook routing unchanged |
| Error/fallback logs | `ErrorLogger.js` and service return messages | Internal | Not client/vendor-facing by default |
| Stage runners and verification helpers | `CodeStage*.js`, `CommercialWorkflowSmokeTest.js` | Internal | Retained as operational validation only |

### Wording findings

The repository still contains internal runner and historical documentation wording such as `test`, `dry-run`, `sample`, `placeholder`, `demo`, `fake`, `TODO`, and `debug`. Those terms are expected in verification runners, repository documentation, code comments, and examples. They must not be used in client/vendor-facing rendered content.

Production-facing templates in `ProductionTemplateService.js` are audited separately by `auditProductionCommunicationTemplates()`.

## Phase 2 — Production email template inventory

| Key | Lifecycle stage | Audience | Purpose |
|---|---|---:|---|
| `STEP_1_ENQUIRY_RECEIVED` | Step 1 enquiry received | Client | Acknowledge intake and request technical details |
| `STEP_2_TECHNICAL_REQUIREMENT_REQUEST` | Step 2 requirement request | Client | Request technical details needed for qualification |
| `STEP_2_RECEIVED_CONFIRMATION` | Step 2 received | Client | Confirm technical detail receipt and next review step |
| `INTERNAL_LEAD_REVIEW_NOTIFICATION` | Internal lead review | Internal | Notify MIDTS that qualification review is needed |
| `VENDOR_PRICING_REQUEST` | Vendor pricing request | Vendor | Request cost, ETA, assumptions, and exclusions |
| `VENDOR_PRICING_RECEIVED_CONFIRMATION` | Vendor pricing received | Vendor | Confirm pricing receipt before internal review |
| `CLIENT_QUOTE_ISSUED` | Client quote issued | Client | Present quote and acceptance path |
| `QUOTE_ACCEPTED_CONFIRMATION` | Quote accepted | Client | Confirm quote acceptance has been recorded |
| `DEPOSIT_PAYMENT_REQUEST` | Deposit/payment request | Client | Request payment before delivery activity proceeds |
| `PROJECT_STARTED_CONFIRMATION` | Project started | Client | Confirm project start and operating status |
| `FILE_RECEIVED_CONFIRMATION` | File received | Client | Confirm files are received and subject to review |
| `DELIVERY_FINAL_HANDOFF_NOTIFICATION` | Delivery/final handoff | Client | Notify controlled delivery readiness |
| `REVISION_CLARIFICATION_REQUEST` | Revision/clarification | Client | Request clarification needed to continue work |
| `UNABLE_TO_QUOTE_DECLINED_PROJECT` | Unable to quote/declined | Client | Close enquiry professionally when MIDTS cannot quote |

All email template content is defined in `ProductionTemplateService.getEmailTemplates()` and rendered through `ProductionTemplateService.renderEmailTemplate()`.

## Phase 3 and 4 — Document template inventory and content

Each document template includes purpose, audience, generation timing, source fields, required fields, optional fields, output format, Drive location, owner, approval gate, failure handling, and body content in `ProductionTemplateService.getDocumentTemplates()`.

| Template | Purpose | Audience | When generated | Source data fields | Required fields | Optional fields | Output format | Drive folder location | Owner | Approval gate | Failure handling |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Initial Enquiry Record | Intake governance | Client intake and internal review | After Step 1 enquiry capture | `{{lead_id}}`, `{{timestamp}}`, `{{client_name}}`, `{{company_name}}`, `{{project_type}}`, `{{source}}` | `{{lead_id}}`, `{{timestamp}}`, `{{client_name}}`, `{{client_email}}` | `{{company_name}}`, `{{project_type}}`, `{{initial_notes}}` | Google Doc, optional PDF after approval | `Leads/{{lead_id}}/01 Intake` | MIDTS Intake | Lead ID exists | Do not dispatch externally; log failure and retry after required fields are corrected |
| Technical Requirement Brief | Requirement governance | MIDTS review team and approved vendors after safe packaging | After Step 2 details are received | `{{lead_id}}`, `{{timestamp}}`, `{{technical_summary}}`, `{{files_received}}`, `{{deadline}}` | `{{lead_id}}`, `{{timestamp}}`, `{{technical_summary}}` | `{{files_received}}`, `{{deadline}}`, `{{software_requirements}}` | Google Doc, optional PDF after approval | `Leads/{{lead_id}}/02 Requirements` | MIDTS Operations | Step 2 submitted | Do not dispatch externally; log failure and retry after required fields are corrected |
| Internal Review Sheet | Qualification governance | MIDTS internal approver | During qualification review | `{{lead_id}}`, `{{timestamp}}`, `{{qualification_status}}`, `{{review_notes}}` | `{{lead_id}}`, `{{timestamp}}`, `{{qualification_status}}` | `{{review_notes}}`, `{{risk_notes}}` | Google Doc, optional PDF after approval | `Leads/{{lead_id}}/03 Internal Review` | MIDTS Approver | MIDTS approval before vendor pricing | Log failure; do not request vendor pricing until review record is corrected |
| Vendor Pricing Request | Vendor pricing governance | Approved vendor | Before vendor pricing dispatch | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_name}}`, `{{technical_summary}}`, `{{files_received}}` | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_name}}`, `{{technical_summary}}` | `{{vendor_eta}}`, `{{vendor_notes}}` | Google Doc/PDF package note | `Leads/{{lead_id}}/04 Vendor Pricing` | MIDTS Operations | Vendor eligibility and vendor-safe package approved | Do not dispatch to vendor; log failure and retry |
| Vendor Quote Comparison | Commercial review | MIDTS internal approver | After vendor submissions | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_name}}`, `{{vendor_price}}`, `{{vendor_eta}}` | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_price}}` | `{{vendor_notes}}`, `{{comparison_notes}}` | Google Doc/table | `Leads/{{lead_id}}/04 Vendor Pricing` | MIDTS Approver | Vendor pricing submitted | Do not issue client quote; log failure and retry |
| Client Quote | Client commercial quote | Client | After approved vendor pricing or manual approval | `{{quote_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{client_quote_amount}}`, `{{quote_valid_until}}` | `{{quote_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{client_quote_amount}}` | `{{scope_summary}}`, `{{quote_terms}}` | Google Doc/PDF | `Leads/{{lead_id}}/05 Quote` | MIDTS Commercial | Approved vendor pricing or documented manual approval | Keep quote in Draft; log failure |
| Scope of Work | Delivery scope | Client and MIDTS delivery | With or after client quote | `{{quote_id}}`, `{{lead_id}}`, `{{technical_summary}}`, `{{deliverables}}` | `{{quote_id}}`, `{{lead_id}}`, `{{technical_summary}}`, `{{deliverables}}` | `{{exclusions}}`, `{{assumptions}}` | Google Doc/PDF | `Leads/{{lead_id}}/05 Quote` | MIDTS Commercial | Scope reviewed before acceptance | Do not start project; log failure |
| Project Handoff Brief | Delivery handoff | MIDTS delivery team | After quote acceptance and project creation | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{project_status}}`, `{{technical_summary}}` | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}` | `{{vendor_name}}`, `{{delivery_notes}}` | Google Doc | `Projects/{{project_id}}/01 Handoff` | MIDTS Delivery | Quote accepted and project created | Do not start active delivery; log failure |
| File Intake Register | File governance | MIDTS internal file reviewer | When files are received | `{{lead_id}}`, `{{timestamp}}`, `{{files_received}}`, `{{file_review_status}}` | `{{lead_id}}`, `{{timestamp}}`, `{{files_received}}` | `{{file_notes}}` | Google Sheet/Doc register | `Leads/{{lead_id}}/06 Files` | MIDTS File Reviewer | Files uploaded or manually recorded | Do not share files; log failure |
| Vendor Safe File Package Note | Vendor-safe dispatch note | Approved vendor | Before vendor package dispatch | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_name}}`, `{{files_received}}` | `{{lead_id}}`, `{{timestamp}}`, `{{vendor_name}}` | `{{package_notes}}` | Google Doc/PDF | `Leads/{{lead_id}}/06 Files/Vendor Safe Packages` | MIDTS File Reviewer | Vendor-safe package reviewed and access rules passed | Do not grant/share vendor package; log failure |
| Payment Record | Payment governance | MIDTS finance and client if shared | When payment is requested or updated | `{{payment_id}}`, `{{quote_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{payment_status}}` | `{{payment_id}}`, `{{quote_id}}`, `{{lead_id}}`, `{{timestamp}}` | `{{payment_notes}}` | Google Doc/PDF | `Leads/{{lead_id}}/07 Payments` | MIDTS Finance | Quote accepted | Do not advance payment-gated workflow; log failure |
| Delivery Note | Delivery release governance | Client | When delivery is ready for release | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{delivery_summary}}`, `{{payment_status}}` | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{delivery_summary}}` | `{{handoff_notes}}` | Google Doc/PDF | `Projects/{{project_id}}/02 Delivery` | MIDTS Delivery | Payment gate allows release | Do not release final files; log failure |
| Revision Request Record | Revision governance | Client, MIDTS delivery, and vendor if applicable | When revision/clarification is requested | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{clarification_request}}` | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{clarification_request}}` | `{{revision_notes}}` | Google Doc | `Projects/{{project_id}}/03 Revisions` | MIDTS Delivery | Project active | Pause affected work; log failure |
| Project Closure Summary | Closure governance | MIDTS internal and client if shared | After final handoff and closure checks | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}`, `{{project_status}}`, `{{delivery_summary}}` | `{{project_id}}`, `{{lead_id}}`, `{{timestamp}}` | `{{closure_notes}}` | Google Doc/PDF | `Projects/{{project_id}}/04 Closure` | MIDTS Delivery | Delivery complete and payment gate satisfied | Keep project open; log failure |
| Audit Log Summary | Governance audit | MIDTS internal governance | On demand for operational review | `{{lead_id}}`, `{{timestamp}}`, `{{email_log_summary}}`, `{{drive_log_summary}}`, `{{error_log_summary}}` | `{{lead_id}}`, `{{timestamp}}` | `{{email_log_summary}}`, `{{drive_log_summary}}`, `{{error_log_summary}}` | Google Doc/Sheet export | `Leads/{{lead_id}}/99 Audit` | MIDTS Operations | Internal request for audit summary | Log failure and do not overwrite audit source rows |

## Phase 5 — Governance rules

1. No client raw files go directly to vendors.
2. Vendor-safe packages must be reviewed before dispatch.
3. Client quotes cannot be issued without approved vendor pricing or documented manual approval.
4. Projects cannot start until quote acceptance is recorded.
5. Final delivery cannot release unless the payment gate allows release.
6. All generated documents must include lead ID and timestamp.
7. All communication must be logged.
8. Vendors must not receive final customer price, MIDTS margin, or MIDTS profit.
9. Vendor pricing is an internal prerequisite for client quote generation unless MIDTS explicitly records an override.

## Phase 6 — Safe preview runners

Use these Apps Script runners to verify templates without live dispatch:

- `runProductionTemplateDryRunPreview(options)` renders a selected email and document template without sending email or creating files.
- `auditProductionCommunicationTemplates()` scans the production template catalogues for unsafe production-facing wording.

Expected dry-run output includes selected template, subject line, recipient type, placeholder values used, rendered preview, and production-safety status.

## Phase 7 — Final sprint report

### Files changed

- `ProductionTemplateService.js` added central production email/document template catalogues and safe preview runners.
- `ZZ_EmailProductionCopyPatch.js` updated active Step 1, Step 2, and vendor pricing email wrappers to render central templates.
- `CodeStage3QuoteDelivery.js` updated customer quote email dispatch to render the central client quote template.
- `docs/03-communication/PRODUCTION_MESSAGING_AND_DOCUMENT_TEMPLATES.md` added this audit, inventory, governance, and preview guide.

### Templates added or updated

- 14 production email templates.
- 15 document templates with metadata and body content.

### Remaining repository wording

Internal verification runners and historical docs still contain validation wording. These are not intended for client/vendor communication. The production template catalogue should be treated as the source of truth for external copy.

### Workflow risks

- Some lifecycle email templates are now available before a sending workflow exists for that event.
- Existing live send functions still send through Brevo when called by production workflows; the sprint did not add live sends.
- Quote, payment, project, and Drive gates were not changed in this sprint.

### Schema changes required but not made

No sheet schema changes were required or made.

### Recommended next sprint

Wire each newly added lifecycle template to the appropriate service event behind existing gates, keeping all sends logged and adding dry-run-first checks before enabling live dispatch.
