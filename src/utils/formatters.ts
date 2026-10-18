/**
 * Normalizes Firestore Timestamp, Date, or string to a strict YYYY-MM-DD string.
 */
export function normalizeDateStr(val: any): string {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
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
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1920 && parsed.getFullYear() < 2100) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return trimmed;
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
