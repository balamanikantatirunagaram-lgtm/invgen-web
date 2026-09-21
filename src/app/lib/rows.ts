/**
 * Supabase row helpers — TypeScript port of INVGEN-APP
 * `lib/data/datasources/row_helpers.dart`.
 * PostgREST returns timestamptz as ISO strings and numerics as
 * number-or-string. Never throws on unexpected shapes.
 */

export type Row = Record<string, unknown>;

export function rowString(v: unknown): string {
  return v == null ? '' : String(v);
}

export function rowDouble(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const d = Number(String(v ?? ''));
  return Number.isFinite(d) ? d : 0;
}

export function rowDateTime(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function rowDateTimeOrNow(v: unknown): Date {
  return rowDateTime(v) ?? new Date();
}

export function rowStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((e) => String(e));
  return [];
}

export function rowMap(v: unknown): Row {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as Row;
  }
  return {};
}

export function rowBool(v: unknown): boolean {
  return v === true;
}

export function isoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
