/**
 * GST verification — TypeScript port of INVGEN-APP
 * `lib/services/gst/appyflow_gst_service.dart`.
 *
 * Lookup order (key safety):
 *  1. Supabase Edge Function `verify-gst` (recommended — key_secret stays
 *     server-side; deploy with `supabase functions deploy verify-gst`).
 *  2. Direct Appyflow GET fallback ONLY when VITE_APPYFLOW_KEY is set
 *     (dev convenience; exposes the key in the browser bundle).
 *
 * Results cached 24h per GSTIN in localStorage (bounds paid-API cost).
 * Used by signup (requireActive) + add-client flows.
 */
import { getSupabase } from '../supabase/client';
import { AppError, mapSupabase } from '../lib/errors';

/** Normalized taxpayer details used to prefill company/client forms. */
export interface GstVerificationResult {
  gstin: string;
  /** lgnm */
  legalName: string;
  /** tradeNam */
  tradeName: string;
  /** sts e.g. Active */
  status: string;
  /** ctb e.g. Proprietorship */
  constitution: string;
  /** rgdt */
  registrationDate: string;
  /** composed from pradr.addr */
  address: string;
  state: string;
  pincode: string;
  district: string;
}

/** Display name prefers trade name, falls back to legal name. */
export function gstDisplayName(r: Pick<GstVerificationResult, 'tradeName' | 'legalName'>): string {
  return r.tradeName !== '' ? r.tradeName : r.legalName;
}

function s(v: unknown): string {
  return (v ?? '').toString().trim();
}

/** Parse Appyflow (or proxy) JSON into a normalized result. Pure — unit tested. */
export function parseGstResult(root: Record<string, unknown>): GstVerificationResult {
  const info =
    (root['taxpayerInfo'] as Record<string, unknown> | undefined) ?? root;
  const pradr = (info['pradr'] as Record<string, unknown> | undefined) ?? {};
  const addr = (pradr['addr'] as Record<string, unknown> | undefined) ?? {};

  const parts = [
    s(addr['bno']),
    s(addr['flno']),
    s(addr['bnm']),
    s(addr['st']),
    s(addr['loc']),
    s(addr['city']),
    s(addr['dst']),
    s(addr['stcd']),
    s(addr['pncd']),
  ].filter((e) => e !== '');

  return {
    gstin: s(info['gstin']),
    legalName: s(info['lgnm']),
    tradeName: s(info['tradeNam']),
    status: s(info['sts']),
    constitution: s(info['ctb']),
    registrationDate: s(info['rgdt']),
    address: parts.join(', '),
    state: s(addr['stcd']),
    pincode: s(addr['pncd']),
    district: s(addr['dst']),
  };
}

/** Enforce Active status for signup. Pure — unit tested. */
export function assertActiveIfRequired(
  result: GstVerificationResult,
  requireActive: boolean,
): void {
  if (requireActive && result.status.toLowerCase() !== 'active') {
    throw AppError.validation(
      `GSTIN is ${result.status === '' ? 'not Active' : result.status}. Only Active GSTINs can be used for signup.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 24h cache (localStorage, per GSTIN, on-device only)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(gst: string): string {
  return `gst_verify_${gst}`;
}

interface CacheEntry {
  at: string;
  payload: Record<string, unknown>;
}

interface MiniStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
  clear?(): void;
}

const memStore = new Map<string, string>();
const memStorage: MiniStorage = {
  getItem: (k) => memStore.get(k) ?? null,
  setItem: (k, v) => {
    memStore.set(k, v);
  },
  removeItem: (k) => {
    memStore.delete(k);
  },
  clear: () => {
    memStore.clear();
  },
};

/** localStorage when available (browser), in-memory shim otherwise (node/tests). */
function storage(): MiniStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('__invgen_probe__');
      return localStorage;
    }
  } catch {
    // private mode / non-browser
  }
  return memStorage;
}

export function readGstCache(gst: string): GstVerificationResult | null {
  try {
    const raw = storage().getItem(cacheKey(gst));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    const at = new Date(entry.at).getTime();
    if (Number.isNaN(at) || Date.now() - at > CACHE_TTL_MS) return null;
    const result = parseGstResult(entry.payload);
    return result.gstin === '' ? null : result;
  } catch {
    return null; // corrupt cache must never block verification
  }
}

export function writeGstCache(gst: string, payload: Record<string, unknown>): void {
  try {
    const entry: CacheEntry = { at: new Date().toISOString(), payload };
    storage().setItem(cacheKey(gst), JSON.stringify(entry));
  } catch {
    // cache is best-effort only
  }
}

// ---------------------------------------------------------------------------
// Lookup transports
// ---------------------------------------------------------------------------

async function viaEdgeFunction(gst: string): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().functions.invoke('verify-gst', {
    body: { gstin: gst },
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function viaDirectKey(gst: string): Promise<Record<string, unknown>> {
  const key = (import.meta.env.VITE_APPYFLOW_KEY as string | undefined)?.trim();
  if (!key) {
    throw AppError.validation(
      'GST verification is not configured. Deploy the verify-gst Edge Function or set VITE_APPYFLOW_KEY.',
    );
  }
  const url = `https://appyflow.in/api/verifyGST?key_secret=${encodeURIComponent(key)}&gstNo=${encodeURIComponent(gst)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw AppError.network('GST lookup failed (network). Check connection and retry.');
  }
  if (!res.ok) {
    throw AppError.unknown(`GST lookup failed (HTTP ${res.status}).`);
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw AppError.unknown('Invalid GST response.');
  }
}

/**
 * Verify a GSTIN and return normalized taxpayer info.
 * Serves fresh cache first; throws AppError on validation / network / API error.
 */
export async function verifyGst(
  gstNo: string,
  opts: { requireActive?: boolean } = {},
): Promise<GstVerificationResult> {
  const gst = gstNo.trim().toUpperCase();
  if (gst.length !== 15) {
    throw AppError.validation('Enter valid 15-character GSTIN.');
  }
  const cached = readGstCache(gst);
  if (cached) {
    assertActiveIfRequired(cached, opts.requireActive ?? false);
    return cached;
  }

  // Prefer the secure proxy; fall back to direct key for local dev.
  let json: Record<string, unknown>;
  try {
    json = await viaEdgeFunction(gst);
  } catch (edgeError) {
    if ((import.meta.env.VITE_APPYFLOW_KEY as string | undefined)?.trim()) {
      json = await viaDirectKey(gst);
    } else {
      throw mapSupabase(edgeError);
    }
  }

  // Appyflow signals errors via `error: true` + `message`.
  if (json['error'] === true) {
    const msg = s(json['message'] ?? json['msg'] ?? 'GST not found.');
    throw AppError.validation(msg);
  }
  const result = parseGstResult(json);
  if (result.gstin === '') {
    throw AppError.validation(`GST details not found for ${gst}.`);
  }
  assertActiveIfRequired(result, opts.requireActive ?? false);
  writeGstCache(gst, json);
  return result;
}
