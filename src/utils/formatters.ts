/**
 * Normalizes Firestore Timestamp, Date, or string to a YYYY-MM-DD string.
 */
export function normalizeDateStr(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString().split('T')[0];
      } catch {
        return '';
      }
    }
    if ('seconds' in val && typeof val.seconds === 'number') {
      try {
        return new Date(val.seconds * 1000).toISOString().split('T')[0];
      } catch {
        return '';
      }
    }
  }
  return '';
}

/**
 * Safely renders any value into a string, preventing React from crashing
 * when receiving raw Firestore Timestamp objects { seconds, nanoseconds }.
 */
export function safeRender(val: any, fallback: string = '-'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    const dateStr = normalizeDateStr(val);
    if (dateStr) return dateStr;
    return fallback;
  }
  return String(val);
}
