/**
 * MIDTS website integration helper
 * STAGE: 10 website webhook handoff
 *
 * WHAT THIS FILE DOES:
 * - Shows the replacement browser submit handler for NEW-MIDTS components/EnquiryForm.tsx.
 * - Posts to the same-origin /api/enquiry route instead of posting directly to Apps Script.
 * - Keeps MIDTS_WEBHOOK_TOKEN off the public browser bundle.
 *
 * DEPENDENCIES:
 * - website-integration/app/api/enquiry/route.ts copied into the website repository as app/api/enquiry/route.ts.
 * - The existing EnquiryForm.tsx state variables and form data shape.
 */

/**
 * FUNCTION: handleSubmit
 * PURPOSE: Submit the website enquiry to the same-origin Next.js API route.
 * INPUT: event (React form submit event)
 * OUTPUT: Promise<void>
 * SIDE EFFECTS: Updates component status state and sends one POST to /api/enquiry.
 */
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  // ===== MAIN LOGIC =====
  event.preventDefault();
  setStatus('submitting');

  try {
    const body = new URLSearchParams({
      ...formData,
      source: 'Website',
      pageUrl: typeof window !== 'undefined' ? window.location.href : ''
    });

    const response = await fetch('/api/enquiry', {
      method: 'POST',
      body
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'MIDTS enquiry submission failed.');
    }

    setStatus('submitted');
  } catch (error) {
    // ===== ERROR HANDLING =====
    console.error('MIDTS enquiry form failed', error);
    setStatus('error');
  }
}
