# InvGen Web — Marketing Site + GST Invoice Web App

React 19 + TypeScript + Vite + Tailwind v4 + React Router 7.

- **Marketing site** (`/`, `/privacy-policy`, `/terms`): landing page with
  Get Started / Login entry points.
- **Web app** (`/app/*`): full GST invoicing workspace — same features as the
  Flutter mobile app (`INVGEN-APP`), different (desktop SaaS) UI, **same
  Supabase database + auth**.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest (83 tests)
npm run build        # tsc -b && vite build
npm run lint         # oxlint
```

## Backend setup (same Supabase project as mobile)

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (never commit `.env.local`).
2. Apply the mobile app's migrations (`../INVGEN-APP/supabase/migrations/`
   `0001_init.sql`, `0002_counter_rpc.sql`, `0003_realtime.sql`) — schema,
   RLS, `next_invoice_seq` RPC and realtime publication are shared.
3. Supabase Dashboard → Auth → Google provider ON (same Web Client ID as
   mobile) + redirect URL `<site>/app/dashboard`.
4. Deploy the GST verification proxy (keeps the Appyflow `key_secret`
   server-side):
   ```bash
   supabase secrets set APPYFLOW_KEY=<key_secret>
   supabase functions deploy verify-gst   # source: ./supabase/functions/verify-gst
   ```
    Local dev fallback: `VITE_APPYFLOW_KEY` (exposes the key in the bundle —
    local dev only; never set in Vercel/production — remove it before deploy).

## App routes

`/app/login` → `/app/verify-gst` (one-time GSTIN check) →
`/app/dashboard`, `/app/invoices/new`, `/app/invoices/:id/edit`,
`/app/invoices`, `/app/invoices/:id` (PDF), `/app/clients`,
`/app/products`, `/app/settings*`.

## Architecture notes

- `src/app/lib/` — single-source GST math (`gst.ts`), Indian amount words,
  validators, constants, formatting. UI and PDF both call it; formulas are
  never duplicated.
- `src/app/api/` — thin Supabase wrappers mirroring the mobile
  repositories (atomic `createInvoiceAtomic` with 23505 retries, draft-only
  delete, append-only cancel audit).
- `src/app/hooks/queries.ts` — React Query hooks + realtime invalidation
  with 15s poll fallback.
- `src/app/pdf/` — 4 `@react-pdf/renderer` templates (classic, modern,
  minimal, bold). The renderer is code-split and loads on demand.
- GST rules: intra-state `CGST=SGST=rate/2`, inter-state `IGST=full`,
  `grandTotal=round(exact)`, auto-detected from GSTIN state codes with
  manual override.
