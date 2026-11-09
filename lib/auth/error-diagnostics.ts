// Never log database queries, parameters, messages, stacks or account data.
const allowedCodes = new Set(['42P01', '42703', '42501', '23502', '23503', '23505', '23514', '40001', '40P01', '25P02', 'ECONNREFUSED', 'ETIMEDOUT', 'EACCES']);
export function safeErrorCode(error: unknown): string {
  const visited = new Set<unknown>();
  for (let depth = 0; depth < 6 && error && typeof error === 'object' && !visited.has(error); depth++) {
    visited.add(error);
    const value = error as { code?: unknown; cause?: unknown };
    if (typeof value.code === 'string' && allowedCodes.has(value.code)) return value.code;
    error = value.cause;
  }
  return 'UNEXPECTED';
}

