# MIDTS Website Webhook Fix

## Purpose

This folder contains the concrete website-side change needed for `zeeshankhanminhas/NEW-MIDTS`: stop posting from browser JavaScript directly to Apps Script with public `NEXT_PUBLIC_*` secrets, and instead post to a same-origin Next.js API route.

## Why this fixes the form

The live website error:

```text
Something went wrong. Please email intake@midts.com instead.
```

means the browser submit handler hit its error path. Keeping the webhook token and Apps Script URL in browser `NEXT_PUBLIC_*` values is fragile because those values must be embedded during the website build. A server-side API route avoids that problem and also prevents the MIDTS webhook token from being exposed in the browser.

## Files to copy into the website repository

Copy these files/changes into `zeeshankhanminhas/NEW-MIDTS`:

1. Copy `website-integration/app/api/enquiry/route.ts` to:

```text
app/api/enquiry/route.ts
```

2. Update `components/EnquiryForm.tsx` so its submit handler posts to:

```text
/api/enquiry
```

Use `website-integration/components/EnquiryForm-submit-handler.example.tsx` as the replacement handler shape.

## Required website environment variables

Set these in the environment that actually builds/runs the website server:

```text
MIDTS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
MIDTS_WEBHOOK_TOKEN=the exact WEBSITE_WEBHOOK_TOKEN value from Apps Script
```

Do not use `NEXT_PUBLIC_` for the token in the fixed flow. `MIDTS_WEBHOOK_TOKEN` should remain server-only.

## Deployment checklist

1. Add `app/api/enquiry/route.ts` to the website repo.
2. Update `components/EnquiryForm.tsx` to call `/api/enquiry`.
3. Add `MIDTS_WEBHOOK_URL` and `MIDTS_WEBHOOK_TOKEN` to the production website server environment.
4. Rebuild/redeploy the website.
5. Submit the form.
6. Check Apps Script **Executions** for a new `doPost` run.
7. Confirm the Leads sheet receives the new lead.

## Known limitation

These files are integration helpers stored in the Apps Script repository so they can be reviewed with the MIDTS automation work. They must be copied or applied to the separate `NEW-MIDTS` website repository to change the live website.
