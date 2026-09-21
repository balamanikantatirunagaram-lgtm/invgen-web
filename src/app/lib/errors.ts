/**
 * Unified app error — TypeScript port of INVGEN-APP
 * `lib/core/error/app_exception.dart` + `lib/data/datasources/supabase_errors.dart`.
 * Repositories throw AppError; UI maps it via userMessage().
 */

export type AppErrorKind =
  | 'network'
  | 'permission'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly cause?: unknown;

  constructor(kind: AppErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.cause = cause;
  }

  static network(msg = 'No internet. Check your connection and retry.'): AppError {
    return new AppError('network', msg);
  }
  static permission(msg = 'Permission denied.'): AppError {
    return new AppError('permission', msg);
  }
  static notFound(msg = 'Record not found.'): AppError {
    return new AppError('notFound', msg);
  }
  static validation(msg: string): AppError {
    return new AppError('validation', msg);
  }
  static conflict(msg: string): AppError {
    return new AppError('conflict', msg);
  }
  static unknown(cause?: unknown): AppError {
    return new AppError('unknown', 'Something went wrong. Try again.', cause);
  }
}

interface PostgrestLike {
  code?: string;
  message?: string;
}

function asPostgrest(e: unknown): PostgrestLike | null {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return e as PostgrestLike;
  }
  return null;
}

/** True when Postgres rejected a duplicate (unique owner+number, etc.). */
export function isUniqueViolation(e: unknown): boolean {
  return asPostgrest(e)?.code === '23505';
}

/** Map any Supabase/network failure to AppError. Never throws. */
export function mapSupabase(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const pg = asPostgrest(e);
  if (pg) {
    if (pg.code === '23505') {
      return AppError.conflict('That number already exists. Try the next one.');
    }
    const m = `${pg.code ?? ''} ${pg.message ?? ''}`.toLowerCase();
    if (
      pg.code === '42501' ||
      pg.code === '401' ||
      pg.code === 'PGRST301' ||
      m.includes('jwt') ||
      m.includes('permission') ||
      m.includes('policy') ||
      m.includes('rls') ||
      m.includes('unauthorized') ||
      m.includes('auth')
    ) {
      return AppError.permission();
    }
    return AppError.unknown(e);
  }
  const s = String(e instanceof Error ? e.message : e).toLowerCase();
  if (
    s.includes('network') ||
    s.includes('failed to fetch') ||
    s.includes('connection refused') ||
    s.includes('timed out') ||
    s.includes('network is unreachable')
  ) {
    return AppError.network();
  }
  return AppError.unknown(e);
}

/** Convert any error to user-friendly text for toasts. */
export function userMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const s = String(e instanceof Error ? e.message : e);
  if (s.includes('permission-denied')) return 'Permission denied. Check login / rules.';
  if (s.includes('unavailable') || s.includes('network')) {
    return 'Network unavailable. Try again when online.';
  }
  if (s.includes('not-found')) return 'Record not found.';
  if (s.includes('already-exists') || s.includes('already exists')) {
    return 'Duplicate entry. Use a different number.';
  }
  return 'Something went wrong. Try again.';
}
