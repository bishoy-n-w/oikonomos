import { describe, it, expect } from 'vitest';
import { generateRecurringDates } from '../utils/recurringEvents';
import type { AttendanceEvent } from '../types';

describe('Event-Based Attendance & Recurring Schedule Tests', () => {
  describe('Recurring Schedule Date Generator (generateRecurringDates)', () => {
    it('generates all Sundays in a given date range', () => {
      // October 2026:
      // Oct 4 is Sunday, Oct 11 is Sunday, Oct 18 is Sunday, Oct 25 is Sunday
      const dates = generateRecurringDates({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dayOfWeek: 0, // Sunday
      });

      expect(dates).toEqual([
        '2026-10-04',
        '2026-10-11',
        '2026-10-18',
        '2026-10-25',
      ]);
    });

    it('generates all Fridays in a given range', () => {
      // October 2026:
      // Oct 2, Oct 9, Oct 16, Oct 23, Oct 30 are Fridays
      const dates = generateRecurringDates({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dayOfWeek: 5, // Friday
      });

      expect(dates).toHaveLength(5);
      expect(dates[0]).toBe('2026-10-02');
      expect(dates[4]).toBe('2026-10-30');
    });

    it('skips designated feast / vacation dates', () => {
      const dates = generateRecurringDates({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dayOfWeek: 0, // Sunday
        skipDates: ['2026-10-18'], // Exclude 3rd Sunday
      });

      expect(dates).toEqual([
        '2026-10-04',
        '2026-10-11',
        '2026-10-25',
      ]);
    });

    it('returns empty array when startDate is after endDate', () => {
      const dates = generateRecurringDates({
        startDate: '2026-11-01',
        endDate: '2026-10-01',
        dayOfWeek: 0,
      });

      expect(dates).toEqual([]);
    });
  });

  describe('AttendanceEvent Data Structure & Metrics Calculation', () => {
    const mockEvent: AttendanceEvent = {
      id: 'evt_20261018_sunday_lesson',
      academicYearId: 'year_2026',
      serviceGroupId: 'group_boys',
      classId: 'class_grade_5',
      title: 'Weekly Sunday School Lesson',
      type: 'lesson',
      eventDate: '2026-10-18',
      takenAt: '2026-10-18T11:30:00.000Z',
      takenBy: 'Mina Servant',
      statuses: {
        kid_1: 'present',
        kid_2: 'present',
        kid_3: 'absent',
        kid_4: 'excused',
      },
      notesByKid: {
        kid_3: 'Called father: traveling to Alexandria',
        kid_4: 'Excused: doctor appointment',
      },
    };

    it('matches the exact event data schema', () => {
      expect(mockEvent.id).toBe('evt_20261018_sunday_lesson');
      expect(mockEvent.type).toBe('lesson');
      expect(mockEvent.eventDate).toBe('2026-10-18');
      expect(mockEvent.takenBy).toBe('Mina Servant');
      expect(mockEvent.statuses.kid_1).toBe('present');
      expect(mockEvent.statuses.kid_3).toBe('absent');
      expect(mockEvent.notesByKid.kid_3).toContain('Alexandria');
    });

    it('calculates metrics and attendance percentage correctly', () => {
      const statuses = mockEvent.statuses;
      const totalRoster = 5; // 4 recorded + 1 unrecorded

      const presentCount = Object.values(statuses).filter((s) => s === 'present').length;
      const absentCount = Object.values(statuses).filter((s) => s === 'absent').length;
      const excusedCount = Object.values(statuses).filter((s) => s === 'excused').length;
      const attendanceRate = Math.round((presentCount / totalRoster) * 100);

      expect(presentCount).toBe(2);
      expect(absentCount).toBe(1);
      expect(excusedCount).toBe(1);
      expect(attendanceRate).toBe(40); // 2 out of 5 = 40%
    });
  });
});
