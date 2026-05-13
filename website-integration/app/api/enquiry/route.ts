/**
 * MIDTS website integration helper
 * STAGE: 10 website webhook handoff
 *
 * WHAT THIS FILE DOES:
 * - Receives website enquiry submissions from the browser at /api/enquiry.
 * - Adds the private MIDTS webhook token on the server, not in browser JavaScript.
 * - Forwards the normalized form payload to the Apps Script Web App /exec URL.
 *
 * DEPENDENCIES:
 * - Next.js App Router route handlers.
 * - REQUIRED: Set MIDTS_WEBHOOK_URL in the website host environment before deploying.
 *   Example: MIDTS_WEBHOOK_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
 * - REQUIRED: Set MIDTS_WEBHOOK_TOKEN in the website host environment before deploying.
 *   Example: MIDTS_WEBHOOK_TOKEN = "same value as WEBSITE_WEBHOOK_TOKEN in Apps Script"
 * - Uses Apps Script doPost(e) in the MIDTS Automation Engine.
 */

import { NextResponse } from 'next/server';

const MAX_FIELD_LENGTH = 3000;

/**
 * FUNCTION: POST
 * PURPOSE: Accept one browser enquiry submission and forward it to Apps Script server-side.
 * INPUT: request (Next.js Request containing JSON or form data)
 * OUTPUT: JSON response with { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: Sends one POST request to the configured Apps Script webhook URL.
 */
export async function POST(request: Request) {
  // ===== MAIN LOGIC =====
  try {
    const webhookUrl = cleanText(process.env.MIDTS_WEBHOOK_URL || '');
    const webhookToken = cleanText(process.env.MIDTS_WEBHOOK_TOKEN || '');

    if (!webhookUrl || !webhookToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'MIDTS enquiry webhook is not configured on the website server.'
        },
        { status: 500 }
      );
    }

    const payload = await parseRequestPayload(request);
    const body = new URLSearchParams();

    // The Apps Script webhook requires this token; keep it server-side so it is not exposed in browser bundles.
    body.set('webhookToken', webhookToken);
    body.set('source', cleanText(payload.source || 'Website'));

    copyField(body, payload, 'full_name');
    copyField(body, payload, 'work_email');
    copyField(body, payload, 'company');
    copyField(body, payload, 'project_type');
    copyField(body, payload, 'timeline_urgency');
    copyField(body, payload, 'files_drawings_ready');
    copyField(body, payload, 'requirement_complexity');
    copyField(body, payload, 'brief_requirement');
    copyField(body, payload, 'pageUrl');
    copyField(body, payload, 'consent');

    const appsScriptResponse = await fetch(webhookUrl, {
      method: 'POST',
      body,
      redirect: 'follow'
    });

    const responseText = await appsScriptResponse.text();
    const result = parseAppsScriptResponse(responseText);

    if (!appsScriptResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'MIDTS enquiry could not be submitted.',
          data: result.data || {}
        },
        { status: appsScriptResponse.ok ? 400 : appsScriptResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'MIDTS enquiry submitted successfully.',
      data: result.data || {}
    });
  } catch (error) {
    // ===== ERROR HANDLING =====
    console.error('MIDTS enquiry API failed', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong. Please email intake@midts.com instead.'
      },
      { status: 500 }
    );
  }
}

/**
 * FUNCTION: parseRequestPayload
 * PURPOSE: Read JSON or browser FormData into a simple object for forwarding.
 * INPUT: request (Request)
 * OUTPUT: Promise<Record<string, string>>
 * SIDE EFFECTS: Consumes the request body.
 */
async function parseRequestPayload(request: Request): Promise<Record<string, string>> {
  // ===== MAIN LOGIC =====
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await request.json();
    return normalizeObject(json || {});
  }

  const formData = await request.formData();
  const payload: Record<string, string> = {};
  formData.forEach((value, key) => {
    payload[key] = typeof value === 'string' ? value : value.name;
  });
  return normalizeObject(payload);
}

/**
 * FUNCTION: normalizeObject
 * PURPOSE: Convert unknown input values into trimmed string fields.
 * INPUT: input (record-like object)
 * OUTPUT: Record<string, string>
 * SIDE EFFECTS: none
 */
function normalizeObject(input: Record<string, unknown>): Record<string, string> {
  // ===== MAIN LOGIC =====
  const output: Record<string, string> = {};
  Object.keys(input).forEach((key) => {
    output[key] = cleanText(input[key]);
  });
  return output;
}

/**
 * FUNCTION: copyField
 * PURPOSE: Copy one optional field into the Apps Script URL-encoded payload.
 * INPUT: body (URLSearchParams), payload (object), key (string)
 * OUTPUT: void
 * SIDE EFFECTS: Mutates body when payload[key] has a value.
 */
function copyField(body: URLSearchParams, payload: Record<string, string>, key: string): void {
  // ===== MAIN LOGIC =====
  const value = cleanText(payload[key]);
  if (value) {
    body.set(key, value);
  }
}

/**
 * FUNCTION: parseAppsScriptResponse
 * PURPOSE: Safely parse the Apps Script JSON response into the shared result shape.
 * INPUT: responseText (string)
 * OUTPUT: { success: boolean, message: string, data?: object }
 * SIDE EFFECTS: none
 */
function parseAppsScriptResponse(responseText: string): { success: boolean; message: string; data?: object } {
  // ===== MAIN LOGIC =====
  try {
    const parsed = JSON.parse(responseText || '{}');
    return {
      success: Boolean(parsed.success),
      message: cleanText(parsed.message || ''),
      data: parsed.data || {}
    };
  } catch (_error) {
    return {
      success: false,
      message: 'Apps Script returned a non-JSON response.',
      data: { responsePreview: cleanText(responseText).slice(0, 500) }
    };
  }
}

/**
 * FUNCTION: cleanText
 * PURPOSE: Remove control characters and cap submitted text length before forwarding.
 * INPUT: value (unknown)
 * OUTPUT: string
 * SIDE EFFECTS: none
 */
function cleanText(value: unknown): string {
  // ===== MAIN LOGIC =====
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}
