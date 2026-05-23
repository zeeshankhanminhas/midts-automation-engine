# 13 File Intake and Upload Architecture

## Purpose
Establish governed intake for IP-sensitive engineering files from NEW-MIDTS Step 2, with strict lead linkage and auditability.

## Upload Lifecycle
`Not Started -> Awaiting Upload -> Upload Received -> Stored -> Internal Review -> Vendor Safe Package Ready -> Released To Vendor -> Rejected -> Archived`

## Drive Architecture
`FILE_INTAKE_ROOT_FOLDER_ID/{Lead ID - Company}/01_RAW_CLIENT_UPLOADS|02_INTERNAL_REVIEW|03_VENDOR_SAFE_PACKAGE`

## Security Boundaries
- Raw client uploads go only to `01_RAW_CLIENT_UPLOADS`.
- No public sharing and no Drive links in outbound email from intake flow.
- Vendors must never access raw uploads directly.

## File Logs Schema
`File ID, Timestamp, Lead ID, Original Filename, Stored Filename, Mime Type, File Size Bytes, Drive File ID, Drive Folder ID, Upload Source, Upload Status, Notes`

## Lead Linkage
Leads store summary and linkage only: Has Files, File Intake Status, File Count, Lead Intake Folder ID, Lead Intake Folder URL, Last File Upload At, Vendor Safe Package Ready.

## Validation Rules
- webhook token required
- leadId must exist
- <=15 files
- <=50MB each
- <=250MB total
- allowed extension allowlist only
- non-empty base64 payload

## Operational Risks
Invalid token, missing lead, malformed payload, oversized payload, invalid extension/base64, Drive write failures, log write failures, and vendor exposure risk must be explicitly handled and logged.

## Relationships
- **Step 2:** consumes Step 2 file-upload payloads.
- **DriveService:** intake folders are separate from project folders and project sharing logic.
- **ProjectService:** no automatic promotion from intake to project.
- **Future DocumentService:** document lifecycle and packaging/export are separate future stages.

## Future Vendor-Safe Release Flow
Manual or controlled automation should copy/sanitize selected files into `03_VENDOR_SAFE_PACKAGE`, then govern release with explicit approval state transitions.

## Archive and Retention Concepts
Archived state should preserve lead linkage and logs while preventing new vendor release without re-approval.

## Test Runner Expectations
- `runStage12FileIntakeSetupValidation()` for setup.
- `runStage12FileUploadPayloadTest()` for payload success/failure paths, folder creation, file write, log write, and lead linkage.
