-- R4: per-user quota overrides for admin-granted extensions
-- Web reads via getEffectiveLimit() in src/app/api/usage.ts:10
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quota_override_invoices int CHECK (quota_override_invoices IS NULL OR quota_override_invoices > 0),
  ADD COLUMN IF NOT EXISTS quota_override_quotations int CHECK (quota_override_quotations IS NULL OR quota_override_quotations > 0);
COMMENT ON COLUMN public.profiles.quota_override_invoices IS 'Admin-granted invoice limit for this month (NULL = default 20)';
COMMENT ON COLUMN public.profiles.quota_override_quotations IS 'Admin-granted quotation limit for this month (NULL = default 20)';
