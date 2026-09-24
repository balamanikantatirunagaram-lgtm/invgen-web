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
//   → 200 { taxpayerInfo... } on success (registry data, cached 24h on client)
//   → 4xx/5xx { error:true, code:"INVALID_GSTIN"|"GST_SERVICE_UNAVAILABLE"|"GST_TIMEOUT" } on failure
//     Never forwards raw provider text/URLs/phone to client; provider payloads are logged server-side.

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

function classifyProviderError(msg: string): 'GST_SERVICE_UNAVAILABLE' | 'INVALID_GSTIN' {
  const m = msg.toLowerCase();
  if (
    m.includes('limit exceed') ||
    m.includes('limit exceeded') ||
    m.includes('quota') ||
    m.includes('exceed') ||
    m.includes('auth') ||
    m.includes('unauthorized') ||
    m.includes('forbidden') ||
    m.includes('invalid key') ||
    m.includes('key_secret')
  ) {
    return 'GST_SERVICE_UNAVAILABLE';
  }
  return 'INVALID_GSTIN';
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
    console.error('[verify-gst] APPYFLOW_KEY not configured');
    return json({ error: true, code: 'GST_SERVICE_UNAVAILABLE' }, 503);
  }

  let gstin = '';
  try {
    const body = (await req.json()) as { gstin?: unknown };
    gstin = String(body.gstin ?? '').trim().toUpperCase();
  } catch {
    return json({ error: true, code: 'INVALID_GSTIN' }, 400);
  }
  if (!GSTIN_RE.test(gstin)) {
    return json({ error: true, code: 'INVALID_GSTIN' }, 400);
  }

  const url =
    `${APPYFLOW_URL}?key_secret=${encodeURIComponent(keySecret)}&gstNo=${encodeURIComponent(gstin)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    console.error('[verify-gst] network/timeout', e);
    return json({ error: true, code: 'GST_TIMEOUT' }, 504);
  }
  if (!res.ok) {
    console.error('[verify-gst] AppyFlow HTTP', res.status);
    return json({ error: true, code: 'GST_SERVICE_UNAVAILABLE' }, 503);
  }
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.error('[verify-gst] invalid JSON', e);
    return json({ error: true, code: 'GST_TIMEOUT' }, 504);
  }

  // Never forward raw provider text/URLs/phone to client. Map to codes.
  if (data['error'] === true) {
    const rawMsg = String(data['message'] ?? data['msg'] ?? '');
    const code = classifyProviderError(rawMsg);
    if (code === 'GST_SERVICE_UNAVAILABLE') {
      console.error('[verify-gst] provider unavailable', JSON.stringify(data).slice(0, 2000));
      return json({ error: true, code }, 503);
    }
    return json({ error: true, code }, 400);
  }

  // Validate that response looks like taxpayer data; empty gstin means not found
  const info = (data['taxpayerInfo'] as Record<string, unknown> | undefined) ?? data;
  const returnedGstin = String(info['gstin'] ?? '').trim();
  if (returnedGstin === '') {
    return json({ error: true, code: 'INVALID_GSTIN' }, 400);
  }

  return json(data, 200);
});
