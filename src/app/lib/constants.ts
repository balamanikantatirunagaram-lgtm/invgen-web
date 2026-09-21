/**
 * GST constants shared across UI, hooks and PDF — TypeScript port of
 * INVGEN-APP `lib/core/constants/gst_slabs.dart`.
 * Keep slabs in ONE place so dropdowns and validators never drift.
 */

/** Allowed GST slabs in % (plus Custom handled at form level). */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;

/** Allowed units for line items. */
export const UNITS = ['Nos', 'Kgs', 'litre', 'Pac', 'Box', 'Mtr', 'Custom'] as const;

/** Allowed invoice copy types (Indian GST guideline wording). */
export const COPY_TYPES = [
  'Original for Recipient',
  'Duplicate for Transporter',
  'Triplicate for Supplier',
] as const;

/** Invoice statuses. */
export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'cancelled'] as const;

export type GstSlab = (typeof GST_SLABS)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
