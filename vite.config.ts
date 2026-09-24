import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function failIfAppyflowKeyInProd() {
  return {
    name: 'fail-if-appyflow-key-in-prod',
    config(_config: unknown, { mode }: { mode: string }) {
      // Fail only on Vercel Production (VERCEL_ENV=production) or explicit CI check.
      // Local `npm run build` with a dev key in .env.local is allowed (still warns at runtime).
      const isVercelProd = process.env.VERCEL_ENV === 'production';
      const shouldFail = isVercelProd || process.env.FAIL_ON_VITE_APPYFLOW_KEY === '1';
      if (mode === 'production' && shouldFail && process.env.VITE_APPYFLOW_KEY?.trim()) {
        throw new Error(
          'VITE_APPYFLOW_KEY is set in Vercel Production — key_secret would be exposed in the bundle. ' +
            'Remove VITE_APPYFLOW_KEY from Vercel Production env and use `supabase secrets set APPYFLOW_KEY=<rotated_key>` + `supabase functions deploy verify-gst` instead.',
        );
      }
      if (mode === 'production' && process.env.VITE_APPYFLOW_KEY?.trim() && !isVercelProd) {
        console.warn(
          '[InvGen] WARNING: VITE_APPYFLOW_KEY is set in production bundle (local build). Key is exposed. Remove before Vercel deploy.',
        );
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), failIfAppyflowKeyInProd()],
})
