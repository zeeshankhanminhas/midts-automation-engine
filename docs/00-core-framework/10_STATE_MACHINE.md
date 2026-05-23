# 10 State Machine

## File Intake Lifecycle (Stage 12)
1. Not Started
2. Awaiting Upload
3. Upload Received
4. Stored
5. Internal Review
6. Vendor Safe Package Ready
7. Released To Vendor
8. Rejected
9. Archived

### Control Rules
- Raw uploads are stored in `01_RAW_CLIENT_UPLOADS` and **cannot** be released directly to vendors.
- Vendor release requires transition through `Vendor Safe Package Ready` then controlled `Released To Vendor`.
- File intake lifecycle is separate from project lifecycle and quote lifecycle.
