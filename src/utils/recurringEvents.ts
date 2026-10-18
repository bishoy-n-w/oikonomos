export interface RecurringScheduleConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 for Sunday, 1 for Monday, ..., 5 for Friday, 6 for Saturday
  skipDates?: string[]; // array of YYYY-MM-DD to exclude
}

/**
 * Generates an array of ISO date strings (YYYY-MM-DD) matching a specific day of the week
 * between start and end dates, skipping any excluded dates.
 */
export function generateRecurringDates(config: RecurringScheduleConfig): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = config.startDate.split('-').map(Number);
  const [ey, em, ed] = config.endDate.split('-').map(Number);

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const skips = new Set(config.skipDates || []);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() === config.dayOfWeek) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      if (!skips.has(dateStr)) {
        dates.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
