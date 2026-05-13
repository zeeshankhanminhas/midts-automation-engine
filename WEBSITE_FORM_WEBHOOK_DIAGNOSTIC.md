# MIDTS Website Form Webhook Diagnostic

## Scope

This diagnostic compares the Stage 10 Apps Script website webhook contract in this repository with the public website form implementation in `zeeshankhanminhas/NEW-MIDTS` as inspected on GitHub.

## Finding

The Apps Script Stage 10 payload test proves the backend can create a lead when it receives a valid payload with the configured `WEBSITE_WEBHOOK_TOKEN`. The live website form can still appear to submit successfully while no lead is created because the website uses a `fetch()` call with `mode: 'no-cors'` and never reads the Apps Script response.

That means any Apps Script rejection is hidden from the browser, including:

- wrong or old Apps Script Web App URL,
- using `/dev` instead of the public `/exec` deployment URL,
- missing production environment variables,
- token mismatch,
- Web App access/deployment permission issue,
- Apps Script returning `Website webhook token is missing or invalid.`,
- Apps Script returning validation errors.

## Evidence from this Apps Script repository

- `doPost(e)` is the real public entry point for website submissions and forwards requests to `WebsiteWebhookService.handlePostEvent(e)`.
- `runStage10WebsiteWebhookPayloadTest()` creates a fake internal Apps Script event and calls the handler directly, so it does not verify that the live website reaches the deployed Web App URL.
- The webhook requires a submitted token named `webhookToken`, `webhook_token`, `formToken`, `token`, or `WEBSITE_WEBHOOK_TOKEN` to exactly match the configured `WEBSITE_WEBHOOK_TOKEN`.
- The website's field names `full_name`, `work_email`, `company`, `project_type`, `timeline_urgency`, `files_drawings_ready`, `requirement_complexity`, and `brief_requirement` are already accepted by the Apps Script webhook, so the primary issue is not field-name mapping.

## Evidence from the website repository

In `components/EnquiryForm.tsx`, the website:

- reads `NEXT_PUBLIC_MIDTS_WEBHOOK_URL` and `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN`,
- throws only if those values are empty,
- creates a `URLSearchParams` body,
- sets `webhookToken`, `source`, and `pageUrl`,
- posts with `fetch(webhookUrl, { method: 'POST', mode: 'no-cors', body })`,
- immediately marks the submission as successful without checking Apps Script's JSON response.

Because `no-cors` returns an opaque response, the frontend cannot see whether Apps Script returned success or failure.


## Update: visible website error message

If the website shows:

```text
Something went wrong. Please email intake@midts.com instead.
```

then the website is entering the `catch` block in `components/EnquiryForm.tsx`. With the current website code, that normally means the browser-side submit handler failed before it could mark the form as submitted. The most likely immediate cause is missing or invalid public build-time environment configuration:

- `NEXT_PUBLIC_MIDTS_WEBHOOK_URL` is empty in the deployed website build, or
- `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN` is empty in the deployed website build, or
- the webhook URL is malformed/blocked so `fetch()` rejects.

The website code explicitly throws `Webhook configuration is missing.` when either public environment variable is missing. In a Next.js static/client component, `NEXT_PUBLIC_*` values are embedded when the site is built, so adding or changing those values in the hosting dashboard requires a fresh rebuild/redeploy before the browser receives them.

### Important: secrets are not automatically browser environment variables

Having `NEXT_PUBLIC_MIDTS_WEBHOOK_URL` and `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN` saved in a **secrets** store is not enough by itself. The website form runs in the browser, and the current implementation reads these values through `process.env.NEXT_PUBLIC_*` during the Next.js build. That only works when the deploy pipeline exposes the secrets as build-time environment variables.

Common failure patterns:

- GitHub Actions repository secrets exist, but the workflow does not map them into the build step with `env:`.
- Vercel/Netlify/hosting provider secrets exist in one environment, such as Preview, but not the Production environment used by the live site.
- The secrets were added after the last deployment, but the website was not rebuilt/redeployed, so the browser bundle still contains empty values.
- The live site is deployed by the hosting provider directly, not by GitHub Actions, so GitHub repository secrets are never seen by the production build.

If the live website still shows `Something went wrong`, open the browser DevTools console while submitting the form. If you see `Webhook configuration is missing.`, the browser bundle did not receive one or both `NEXT_PUBLIC_*` values at build time, even if they exist in a secrets screen.

### Immediate fix for the current website deployment

1. Identify what actually builds the live website: GitHub Actions, Vercel, Netlify, Cloudflare Pages, cPanel, or another host.
2. In that exact production build environment, expose both values as build-time environment variables, not just saved secrets:
   - `NEXT_PUBLIC_MIDTS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
   - `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN=the exact WEBSITE_WEBHOOK_TOKEN value from Apps Script Settings or Script Properties`
3. If using GitHub Actions, the build/deploy step must explicitly map secrets, for example:

```yaml
env:
  NEXT_PUBLIC_MIDTS_WEBHOOK_URL: ${{ secrets.NEXT_PUBLIC_MIDTS_WEBHOOK_URL }}
  NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN: ${{ secrets.NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN }}
```

4. Redeploy/rebuild the website after saving or mapping those values.
5. Hard-refresh the live website and submit the form again.
6. Open Apps Script **Executions** and confirm a new `doPost` execution appears.

If no `doPost` execution appears after this, the deployed website is still not posting to the correct Apps Script Web App URL.

## Most likely root cause

The most likely root cause is not `LeadService` or Google Sheets. The backend test creates a lead, so the Apps Script lead creation path works.

The live website is probably failing in one of these places while hiding the failure:

1. `NEXT_PUBLIC_MIDTS_WEBHOOK_URL` is missing, wrong, old, or points at `/dev` instead of `/exec`.
2. `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN` does not exactly match `WEBSITE_WEBHOOK_TOKEN` in the Apps Script Settings sheet or Script Properties.
3. The Apps Script Web App deployment has not been updated after Stage 10, or access is not set to `Anyone`.
4. The request reaches Apps Script but Apps Script returns a JSON error that the website cannot read because of `mode: 'no-cors'`.

## Fast verification checklist

1. In the deployed website environment, confirm:
   - `NEXT_PUBLIC_MIDTS_WEBHOOK_URL` is the Apps Script Web App URL ending in `/exec`.
   - `NEXT_PUBLIC_MIDTS_WEBHOOK_TOKEN` exactly matches the Apps Script `WEBSITE_WEBHOOK_TOKEN` value.
2. Submit the website form once.
3. Open Apps Script **Executions**.
   - If there is no recent `doPost` execution, the website is not reaching Apps Script.
   - If there is a `doPost` execution, inspect the returned message/error.
4. Run a direct deployed URL test with URL-encoded fields:

```bash
curl -L -X POST 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec' \
  -d 'webhookToken=YOUR_CONFIGURED_TOKEN' \
  -d 'full_name=Website Curl Test' \
  -d 'work_email=test@example.com' \
  -d 'company=MIDTS Test' \
  -d 'project_type=CAD Enquiry' \
  -d 'brief_requirement=Testing deployed website webhook directly'
```

Expected successful response:

```json
{
  "success": true,
  "message": "Website lead created successfully.",
  "data": {
    "leadId": "MIDTS-L-..."
  }
}
```

## Recommended website fix

For production debugging, temporarily remove `mode: 'no-cors'` and read the response body, or route submissions through a same-origin Next.js API route that posts to Apps Script server-side. The same-origin API route is preferred because it avoids exposing the webhook token in public `NEXT_PUBLIC_*` browser variables.

Recommended server-side shape:

1. Browser posts to `/api/enquiry`.
2. Next.js API route reads private environment variables:
   - `MIDTS_WEBHOOK_URL`
   - `MIDTS_WEBHOOK_TOKEN`
3. API route posts `URLSearchParams` to Apps Script.
4. API route reads Apps Script JSON and returns real success/failure to the browser.

This makes the website show the real Apps Script error instead of a false success state.


## Concrete change to apply to the website

This repository now includes a ready-to-copy website-side fix under `website-integration/`:

- `website-integration/app/api/enquiry/route.ts` adds a Next.js server route that reads private `MIDTS_WEBHOOK_URL` and `MIDTS_WEBHOOK_TOKEN` values and forwards the form to Apps Script.
- `website-integration/components/EnquiryForm-submit-handler.example.tsx` shows the replacement submit handler that posts to `/api/enquiry`.
- `website-integration/README.md` lists the copy steps and deployment checklist.

Apply those files to `zeeshankhanminhas/NEW-MIDTS` to change the live website behavior.

## Known limitation

The Apps Script production code is unchanged. The `website-integration/` files are ready-to-copy website implementation helpers and must be applied to the separate `NEW-MIDTS` repository before the live website behavior changes.
