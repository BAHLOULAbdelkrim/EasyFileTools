// EasyFile Tools V1 — anonymous, server-side contact reports.
// Receives NO required name/email/upload and NEVER accesses CF-Connecting-IP.
// Secrets belong in Cloudflare Pages Environment Variables (encrypted secrets).
const BODY_LIMIT = 12 * 1024;
const KINDS = new Set(['problem', 'suggestion', 'question', 'privacy']);
const BROWSERS = new Set(['Chrome', 'Firefox', 'Edge', 'Safari', 'Other', 'Not sure', '']);
const SYSTEMS = new Set(['Windows', 'macOS', 'Linux', 'Android', 'iOS', 'Other', 'Not sure', '']);
const textValue = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : null;
const words = (value) => value.trim().split(/\s+/u).filter(Boolean).length;
const response = (status, message) => new Response(JSON.stringify({ message }), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  },
});

async function boundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) throw new Error('too-large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const part of chunks) { merged.set(part, offset); offset += part.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(merged);
}

function validate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const kind = textValue(payload.kind, 20);
  const tool = textValue(payload.tool, 100);
  const browser = textValue(payload.browser, 30);
  const os = textValue(payload.os, 30);
  const inputFormat = textValue(payload.inputFormat, 40);
  const outputFormat = textValue(payload.outputFormat, 40);
  const description = textValue(payload.description, 600);
  const steps = textValue(payload.steps, 2000);
  const errorMessage = textValue(payload.errorMessage, 1500);
  const token = textValue(payload.turnstileToken, 2048);
  const website = textValue(payload.website ?? '', 200);
  if ([kind, tool, browser, os, inputFormat, outputFormat, description, steps, errorMessage, token, website].some(x => x === null)) return null;
  if (!KINDS.has(kind) || !BROWSERS.has(browser) || !SYSTEMS.has(os)) return null;
  if (!description || words(description) > 30 || description.length > 600 || !token) return null;
  if (kind === 'problem' && (!tool || !steps)) return null;
  if (!/^[a-z\d]{1,12}$/i.test(inputFormat) && inputFormat) return null;
  if (!/^[a-z\d]{1,12}$/i.test(outputFormat) && outputFormat) return null;
  return { kind, tool, browser, os, inputFormat, outputFormat, description, steps, errorMessage, token, website };
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    // Reject cross-origin submissions and ambiguous originless requests.
    if (request.headers.get('Origin') !== url.origin) return response(403, 'Request not allowed.');
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return response(415, 'Invalid request format.');
    }
    if (Number(request.headers.get('Content-Length') || 0) > BODY_LIMIT) return response(413, 'Message too long.');
    if (!env?.TURNSTILE_SECRET_KEY || !env?.RESEND_API_KEY || !env?.CONTACT_TO_EMAIL || !env?.CONTACT_FROM_EMAIL) {
      return response(503, 'Contact reporting is not yet available. Please try again later.');
    }
    const raw = await boundedBody(request);
    const payload = validate(JSON.parse(raw));
    if (!payload) return response(400, 'Please review the form fields and the 30-word description limit.');
    // Honeypot: do not send an email. Never include or log the submitted content.
    if (payload.website) return response(200, 'Thank you.');

    const verifyBody = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: payload.token });
    // remoteip intentionally omitted; Cloudflare still sees network IP on HTTP requests.
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: verifyBody,
    });
    if (!verification.ok) return response(502, 'Verification is unavailable. Try again later.');
    const result = await verification.json();
    if (!result.success || result.hostname !== url.hostname) {
      return response(403, 'Verification expired or failed. Please try again.');
    }

    const plainText = [
      'EasyFile Tools — anonymous website message',
      `Type: ${payload.kind}`,
      `Tool: ${payload.tool || 'Not specified'}`,
      `Browser (visitor-selected): ${payload.browser || 'Not specified'}`,
      `Operating system (visitor-selected): ${payload.os || 'Not specified'}`,
      `Input format: ${payload.inputFormat || 'Not specified'}`,
      `Output format: ${payload.outputFormat || 'Not specified'}`,
      '', 'Description:', payload.description,
      '', 'Steps to reproduce:', payload.steps || 'Not supplied',
      '', 'Error message:', payload.errorMessage || 'Not supplied',
      '', 'No visitor name, email, screenshot or IP is included by this application.',
    ].join('\n');

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL],
        subject: `EasyFile Tools: ${payload.kind === 'problem' ? 'Problem report' : payload.kind === 'privacy' ? 'Privacy inquiry' : payload.kind === 'suggestion' ? 'Suggestion' : 'Question'}`,
        text: plainText,
      }),
    });
    if (!sent.ok) return response(502, 'Your message could not be delivered. Please try later.');
    return response(200, 'Thank you. Your message has been submitted.');
  } catch (error) {
    if (error?.message === 'too-large') return response(413, 'Message too long.');
    // Deliberately avoid logging request bodies, visitor network addresses or provider errors.
    return response(400, 'Unable to process this request. Please check the fields and try again.');
  }
}

export function onRequest() {
  return response(405, 'Method not allowed.');
}
