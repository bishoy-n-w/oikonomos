import { describe, it, expect } from 'vitest';
import type { HomeVisit } from '../types';

describe('Home Visits Pastoral Care Logic & Metrics', () => {
  function computeCareStatus(
    todayStr: string,
    visits: Array<{ visitDate: string }>
  ): { status: 'recently_visited' | 'due_for_visit' | 'overdue_for_visit' | 'never_visited'; daysAgo: number } {
    if (!visits.length) {
      return { status: 'never_visited', daysAgo: Infinity };
    }

    const sorted = [...visits].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    const latest = sorted[0];

    const todayMs = new Date(todayStr).getTime();
    const visitMs = new Date(latest.visitDate).getTime();
    const daysAgo = Math.max(0, Math.floor((todayMs - visitMs) / (1000 * 60 * 60 * 24)));

    if (daysAgo <= 30) {
      return { status: 'recently_visited', daysAgo };
    } else if (daysAgo <= 60) {
      return { status: 'due_for_visit', daysAgo };
    } else {
      return { status: 'overdue_for_visit', daysAgo };
    }
  }

  function computeClassCareMetrics(
    totalKids: number,
    kidsWithVisitsCount: number,
    visits: HomeVisit[]
  ) {
    const coverageRate = totalKids > 0 ? Math.round((kidsWithVisitsCount / totalKids) * 100) : 0;
    const homeVisits = visits.filter((v) => v.type === 'home_visit').length;
    const phoneCalls = visits.filter((v) => v.type === 'phone_call').length;

    const servantCountMap: Record<string, number> = {};
    visits.forEach((v) => {
      v.visitorMisterIds.forEach((id) => {
        const key = id.toLowerCase().trim();
        servantCountMap[key] = (servantCountMap[key] || 0) + 1;
      });
    });

    return {
      coverageRate,
      homeVisits,
      phoneCalls,
      servantCountMap,
    };
  }

  describe('Pastoral Health Status Thresholds (60-Day Overdue Rule)', () => {
    const today = '2026-10-25';

    it('classifies visits within 30 days as recently_visited (green)', () => {
      const res = computeCareStatus(today, [{ visitDate: '2026-10-10' }]); // 15 days ago
      expect(res.status).toBe('recently_visited');
      expect(res.daysAgo).toBe(15);
    });

    it('classifies visits between 31 and 60 days as due_for_visit (yellow)', () => {
      const res = computeCareStatus(today, [{ visitDate: '2026-09-10' }]); // 45 days ago
      expect(res.status).toBe('due_for_visit');
      expect(res.daysAgo).toBe(45);
    });

    it('classifies visits older than 60 days as overdue_for_visit (red)', () => {
      const res = computeCareStatus(today, [{ visitDate: '2026-08-01' }]); // 85 days ago
      expect(res.status).toBe('overdue_for_visit');
      expect(res.daysAgo).toBe(85);
    });

    it('classifies students with 0 visits as never_visited', () => {
      const res = computeCareStatus(today, []);
      expect(res.status).toBe('never_visited');
      expect(res.daysAgo).toBe(Infinity);
    });

    it('picks the most recent visit when multiple visits exist', () => {
      const visits = [
        { visitDate: '2026-07-01' },
        { visitDate: '2026-10-20' }, // 5 days ago
        { visitDate: '2026-09-01' },
      ];
      const res = computeCareStatus(today, visits);
      expect(res.status).toBe('recently_visited');
      expect(res.daysAgo).toBe(5);
    });
  });

  describe('Care Insights KPI Calculations', () => {
    it('accurately computes coverage percentage and interactions breakdown', () => {
      const mockVisits: HomeVisit[] = [
        {
          id: 'v1',
          kidId: 'k1',
          academicYearId: 'y2026',
          classId: 'c1',
          visitDate: '2026-10-01',
          type: 'home_visit',
          visitorMisterIds: ['mark@gmail.com', 'mary@gmail.com'],
          notes: 'Great visit with family',
        },
        {
          id: 'v2',
          kidId: 'k2',
          academicYearId: 'y2026',
          classId: 'c1',
          visitDate: '2026-10-05',
          type: 'phone_call',
          visitorMisterIds: ['mark@gmail.com'],
          notes: 'Checkup call with mother',
        },
      ];

      const metrics = computeClassCareMetrics(10, 2, mockVisits);

      expect(metrics.coverageRate).toBe(20); // 2 of 10 = 20%
      expect(metrics.homeVisits).toBe(1);
      expect(metrics.phoneCalls).toBe(1);
      expect(metrics.servantCountMap['mark@gmail.com']).toBe(2);
      expect(metrics.servantCountMap['mary@gmail.com']).toBe(1);
    });
  });
});
