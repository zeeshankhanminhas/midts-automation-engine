# 11 Failure Handling Matrix

## File Intake (Stage 12)
- **Invalid token:** reject request, log `Rejected` row in File Logs.
- **Missing lead:** reject request, log lead linkage failure.
- **Invalid extension:** reject request, log unsupported extension.
- **Oversized payload:** reject when file > 50MB, files > 15, or total > 250MB.
- **Invalid base64:** reject and log decoding failure.
- **Drive folder creation failure:** return failure and write Error Logs entry.
- **Drive file creation failure:** return failure and write Error Logs entry.
- **File Logs write failure:** do not silently fail; write Error Logs when possible.
- **Accidental vendor exposure risk:** block by design (raw folder isolation, no vendor sharing from intake path).
