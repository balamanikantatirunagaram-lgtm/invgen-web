// Supabase Edge Function: verify-gst (Deno).
// Secure proxy for Appyflow GST verification — keeps `key_secret`
// server-side so the browser bundle never sees it.
//
// Deploy:
//   supabase secrets set APPYFLOW_KEY=...          # key_secret value
//   supabase functions deploy verify-gst
//
// Contract:
//   POST { "gstin": "27ABCDE1234F1Z5" }  (requires Authorization: Bearer <user JWT>)
//   → 200 forwards Appyflow JSON verbatim (web parses + caches it 24h)
//   → 4xx/5xx JSON { "error": true, "message": ... } on failure.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const APPYFLOW_URL = 'https://appyflow.in/api/verifyGST';
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    });
  }
  if (req.method !== 'POST') {
    return json({ error: true, message: 'Use POST.' }, 405);
  }

  const keySecret = Deno.env.get('APPYFLOW_KEY') ?? '';
  if (!keySecret) {
    return json({ error: true, message: 'Verification service not configured.' }, 503);
  }

  let gstin = '';
  try {
    const body = (await req.json()) as { gstin?: unknown };
    gstin = String(body.gstin ?? '').trim().toUpperCase();
  } catch {
    return json({ error: true, message: 'Invalid request body.' }, 400);
  }
  if (!GSTIN_RE.test(gstin)) {
    return json({ error: true, message: 'Enter valid 15-character GSTIN.' }, 400);
  }

  const url =
    `${APPYFLOW_URL}?key_secret=${encodeURIComponent(keySecret)}&gstNo=${encodeURIComponent(gstin)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    return json({ error: true, message: 'Registry unreachable. Try again.' }, 502);
  }
  if (!res.ok) {
    return json({ error: true, message: `Registry error (HTTP ${res.status}).` }, 502);
  }
  try {
    const data = await res.json();
    return json(data, 200);
  } catch {
    return json({ error: true, message: 'Invalid registry response.' }, 502);
  }
});
