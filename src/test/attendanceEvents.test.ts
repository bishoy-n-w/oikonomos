import { describe, it, expect } from 'vitest';
import { generateRecurringDates } from '../utils/recurringEvents';
import { computeConsecutiveAbsences, buildPastoralWhatsAppUrl } from '../utils/pastoralCare';
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

  describe('Pastoral Care Engine (computeConsecutiveAbsences & WhatsApp link)', () => {
    const mockKids: any[] = [
      {
        id: 'kid_1',
        info: { fullName: 'Mark Youssef' },
        contacts: { fatherName: 'Youssef', fatherMob: '01012345678' },
      },
      {
        id: 'kid_2',
        info: { fullName: 'Fady Mina' },
        contacts: { fatherName: 'Mina', fatherMob: '+20 12 98765432' },
      },
      {
        id: 'kid_3',
        info: { fullName: 'George Samy' },
        contacts: { fatherName: 'Samy', fatherMob: '01123456789' },
      },
    ];

    const mockEvents: AttendanceEvent[] = [
      {
        id: 'evt_1',
        academicYearId: 'year_2026',
        serviceGroupId: 'group_boys',
        classId: 'class_5',
        title: 'Session 1',
        type: 'lesson',
        eventDate: '2026-10-04',
        takenAt: '2026-10-04T10:00:00Z',
        statuses: { kid_1: 'absent', kid_2: 'present', kid_3: 'present' },
        notesByKid: {},
        createdAt: '2026-10-04T10:00:00Z',
        createdBy: 'admin',
      },
      {
        id: 'evt_2',
        academicYearId: 'year_2026',
        serviceGroupId: 'group_boys',
        classId: 'class_5',
        title: 'Session 2',
        type: 'lesson',
        eventDate: '2026-10-11',
        takenAt: '2026-10-11T10:00:00Z',
        statuses: { kid_1: 'absent', kid_2: 'absent', kid_3: 'present' },
        notesByKid: {},
        createdAt: '2026-10-11T10:00:00Z',
        createdBy: 'admin',
      },
      {
        id: 'evt_3',
        academicYearId: 'year_2026',
        serviceGroupId: 'group_boys',
        classId: 'class_5',
        title: 'Session 3',
        type: 'lesson',
        eventDate: '2026-10-18',
        takenAt: '2026-10-18T10:00:00Z',
        statuses: { kid_1: 'absent', kid_2: 'absent', kid_3: 'absent' },
        notesByKid: {},
        createdAt: '2026-10-18T10:00:00Z',
        createdBy: 'admin',
      },
    ];

    it('identifies students with 2 or more consecutive absences', () => {
      const alerts = computeConsecutiveAbsences(mockEvents, mockKids);

      // kid_1 missed 3 sessions in a row
      // kid_2 missed 2 sessions in a row (sessions 2 & 3)
      // kid_3 only missed 1 session (session 3) -> NOT flagged
      expect(alerts).toHaveLength(2);
      expect(alerts[0].kid.id).toBe('kid_1');
      expect(alerts[0].consecutiveCount).toBe(3);
      expect(alerts[1].kid.id).toBe('kid_2');
      expect(alerts[1].consecutiveCount).toBe(2);
    });

    it('builds a sanitized WhatsApp pastoral checkup URL with pre-filled message', () => {
      const urlArabic = buildPastoralWhatsAppUrl(
        '+20 10 1234 5678',
        'مارك يوسف',
        'يوسف',
        true
      );
      expect(urlArabic).toContain('https://wa.me/201012345678?text=');
      expect(decodeURIComponent(urlArabic)).toContain('أستاذ يوسف');
      expect(decodeURIComponent(urlArabic)).toContain('مارك يوسف');

      const urlEnglish = buildPastoralWhatsAppUrl(
        '01012345678',
        'Mark Youssef',
        'Youssef',
        false
      );
      expect(urlEnglish).toContain('https://wa.me/01012345678?text=');
      expect(decodeURIComponent(urlEnglish)).toContain('Mr. Youssef');
      expect(decodeURIComponent(urlEnglish)).toContain('Mark Youssef');
    });

    it('returns empty string if phone number is invalid or empty', () => {
      const url = buildPastoralWhatsAppUrl('', 'Mark');
      expect(url).toBe('');
    });

    it('respects coreEventTypes and excludes voluntary trips/activities from pastoral absence alerts', () => {
      const mixedEvents: AttendanceEvent[] = [
        {
          id: 'evt_1',
          academicYearId: 'year_2026',
          classId: 'class_5',
          title: 'Sunday School',
          type: 'Sunday School',
          eventDate: '2026-10-04',
          takenAt: '2026-10-04T10:00:00Z',
          statuses: { kid_3: 'present' },
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
        {
          id: 'evt_2',
          academicYearId: 'year_2026',
          classId: 'class_5',
          title: 'Church Trip',
          type: 'Trip', // Optional event
          eventDate: '2026-10-11',
          takenAt: '2026-10-11T10:00:00Z',
          statuses: { kid_3: 'absent' }, // Absent from trip
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
        {
          id: 'evt_3',
          academicYearId: 'year_2026',
          classId: 'class_5',
          title: 'Sunday School',
          type: 'Sunday School',
          eventDate: '2026-10-18',
          takenAt: '2026-10-18T10:00:00Z',
          statuses: { kid_3: 'absent' }, // Absent from 1 Sunday School
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
      ];

      // With coreEventTypes = ['Sunday School']
      const alerts = computeConsecutiveAbsences(mixedEvents, mockKids, ['Sunday School']);
      // kid_3 has only 1 absence in Sunday School -> NOT flagged
      expect(alerts.find((a) => a.kid.id === 'kid_3')).toBeUndefined();
    });
  });

  describe('3-Tier Role-Based Access Control for Classes & Attendance', () => {
    // Pure RBAC resolver function mimicking FilterContext logic
    const resolveClassAccess = (
      userEmail: string,
      userRole: 'owner' | 'Admin' | 'viewer',
      userGroupRoles: Record<string, 'admin' | 'servant'>,
      classDoc: {
        id: string;
        serviceGroupId: string;
        misters: string[];
      }
    ) => {
      const email = userEmail.toLowerCase().trim();
      const isGlobalOrChurchAdmin = userRole === 'owner' || userRole === 'Admin';
      const isGroupAdmin = userGroupRoles[classDoc.serviceGroupId] === 'admin';
      const isClassMister = classDoc.misters.map((e) => e.toLowerCase().trim()).includes(email);
      const isGroupServant = isGroupAdmin || userGroupRoles[classDoc.serviceGroupId] === 'servant';

      const canEdit = isGlobalOrChurchAdmin || isGroupAdmin || isClassMister;
      const canView = canEdit || isGroupServant;

      return { canEdit, canView };
    };

    const mockClass = {
      id: 'class_grade_5',
      serviceGroupId: 'group_elementary',
      misters: ['mister_mark@gmail.com'],
    };

    it('grants full Edit access to Church Admin or Global Owner', () => {
      const access = resolveClassAccess('admin@church.org', 'Admin', {}, mockClass);
      expect(access.canEdit).toBe(true);
      expect(access.canView).toBe(true);
    });

    it('grants full Edit access to Group Admin of that class service group', () => {
      const access = resolveClassAccess('group_admin@gmail.com', 'viewer', { group_elementary: 'admin' }, mockClass);
      expect(access.canEdit).toBe(true);
      expect(access.canView).toBe(true);
    });

    it('grants full Edit access to designated Class Mister', () => {
      const access = resolveClassAccess('mister_mark@gmail.com', 'viewer', { group_elementary: 'servant' }, mockClass);
      expect(access.canEdit).toBe(true);
      expect(access.canView).toBe(true);
    });

    it('grants View-Only access to other servants in the same service group', () => {
      const access = resolveClassAccess('substitute_servant@gmail.com', 'viewer', { group_elementary: 'servant' }, mockClass);
      expect(access.canEdit).toBe(false);
      expect(access.canView).toBe(true);
    });

    it('grants Zero access (No View, No Edit) to church servants in a different service group', () => {
      const access = resolveClassAccess('high_school_servant@gmail.com', 'viewer', { group_high_school: 'servant' }, mockClass);
      expect(access.canEdit).toBe(false);
      expect(access.canView).toBe(false);
    });

    it('grants Zero access to unassigned servants', () => {
      const access = resolveClassAccess('unassigned@gmail.com', 'viewer', {}, mockClass);
      expect(access.canEdit).toBe(false);
      expect(access.canView).toBe(false);
    });
  });

  describe('Toggle-to-Clear, 4-State Cycle & Session Reset Logic', () => {
    // Pure toggle-to-clear reducer
    const toggleKidStatus = (
      currentStatuses: Record<string, 'present' | 'absent' | 'excused'>,
      kidId: string,
      newStatus: 'present' | 'absent' | 'excused'
    ) => {
      const updated = { ...currentStatuses };
      if (updated[kidId] === newStatus) {
        delete updated[kidId]; // Toggle-to-clear!
      } else {
        updated[kidId] = newStatus;
      }
      return updated;
    };

    // Pure 4-state matrix cycle
    const cycleMatrixStatus = (
      currentStatus: 'present' | 'absent' | 'excused' | undefined
    ): 'present' | 'absent' | 'excused' | undefined => {
      if (!currentStatus) return 'present';
      if (currentStatus === 'present') return 'absent';
      if (currentStatus === 'absent') return 'excused';
      return undefined; // cycle back to unrecorded
    };

    it('sets status when clicking an unselected status', () => {
      const res = toggleKidStatus({}, 'kid_1', 'present');
      expect(res.kid_1).toBe('present');
    });

    it('clears status when clicking the currently active status (Toggle-to-Clear)', () => {
      const initial = { kid_1: 'present' as const };
      const res = toggleKidStatus(initial, 'kid_1', 'present');
      expect(res.kid_1).toBeUndefined();
      expect(Object.keys(res)).toHaveLength(0);
    });

    it('switches status when clicking a different status', () => {
      const initial = { kid_1: 'present' as const };
      const res = toggleKidStatus(initial, 'kid_1', 'absent');
      expect(res.kid_1).toBe('absent');
    });

    it('correctly cycles 4 matrix states: unrecorded -> P -> A -> E -> unrecorded', () => {
      let state: 'present' | 'absent' | 'excused' | undefined = undefined;

      state = cycleMatrixStatus(state);
      expect(state).toBe('present');

      state = cycleMatrixStatus(state);
      expect(state).toBe('absent');

      state = cycleMatrixStatus(state);
      expect(state).toBe('excused');

      state = cycleMatrixStatus(state);
      expect(state).toBeUndefined(); // Back to unrecorded!
    });

    it('resets session attendance and clears takenAt and takenBy', () => {
      const initialEvent: AttendanceEvent = {
        id: 'evt_1',
        academicYearId: 'year_2026',
        classId: 'class_5',
        title: 'Sunday Lesson',
        type: 'Sunday School',
        eventDate: '2026-10-18',
        takenAt: '2026-10-18T10:00:00Z',
        takenBy: 'Mina Servant',
        statuses: { kid_1: 'present', kid_2: 'absent' },
        notesByKid: { kid_2: 'Sick' },
        createdAt: '',
        createdBy: '',
      };

      // Reset reducer
      const resetEvent = (evt: AttendanceEvent): Partial<AttendanceEvent> => ({
        ...evt,
        statuses: {},
        takenAt: undefined,
        takenBy: undefined,
      });

      const updated = resetEvent(initialEvent);
      expect(Object.keys(updated.statuses || {})).toHaveLength(0);
      expect(updated.takenAt).toBeUndefined();
      expect(updated.takenBy).toBeUndefined();
    });

    it('calculates unrecorded metric accurately alongside present, absent, and excused', () => {
      const totalRoster = 10;
      const currentStatuses: Record<string, 'present' | 'absent' | 'excused'> = {
        k1: 'present',
        k2: 'present',
        k3: 'present',
        k4: 'absent',
        k5: 'excused',
      };

      const present = Object.values(currentStatuses).filter((s) => s === 'present').length;
      const absent = Object.values(currentStatuses).filter((s) => s === 'absent').length;
      const excused = Object.values(currentStatuses).filter((s) => s === 'excused').length;
      const recorded = Object.keys(currentStatuses).length;
      const unrecorded = Math.max(0, totalRoster - recorded);
      const rate = Math.round((present / totalRoster) * 100);

      expect(present).toBe(3);
      expect(absent).toBe(1);
      expect(excused).toBe(1);
      expect(unrecorded).toBe(5);
      expect(rate).toBe(30);
    });
  });

  describe('Timeline Horizon & Ribbon Status Determination', () => {
    const resolveHorizon = (eventDate: string, todayDate: string): 'past' | 'today' | 'upcoming' => {
      if (eventDate < todayDate) return 'past';
      if (eventDate === todayDate) return 'today';
      return 'upcoming';
    };

    const resolveRibbonStatus = (
      eventDate: string,
      todayDate: string,
      statuses: Record<string, string>,
      totalRoster: number
    ): 'complete' | 'in_progress' | 'unrecorded_past' | 'not_started' => {
      const count = Object.keys(statuses).length;
      if (totalRoster > 0 && count >= totalRoster) return 'complete';
      if (count > 0 && count < totalRoster) return 'in_progress';
      if (count === 0 && eventDate < todayDate) return 'unrecorded_past';
      return 'not_started';
    };

    const today = '2026-10-18';

    it('correctly categorizes past, today, and upcoming dates', () => {
      expect(resolveHorizon('2026-10-04', today)).toBe('past');
      expect(resolveHorizon('2026-10-18', today)).toBe('today');
      expect(resolveHorizon('2026-10-25', today)).toBe('upcoming');
    });

    it('determines ribbon status correctly across all lifecycle phases', () => {
      // 1. Complete session (all 5 roster taken)
      expect(resolveRibbonStatus('2026-10-04', today, { k1: 'present', k2: 'absent', k3: 'present', k4: 'present', k5: 'excused' }, 5)).toBe('complete');

      // 2. In progress session (only 2 out of 5 taken)
      expect(resolveRibbonStatus('2026-10-18', today, { k1: 'present', k2: 'present' }, 5)).toBe('in_progress');

      // 3. Past unrecorded session (past date, 0 taken)
      expect(resolveRibbonStatus('2026-10-11', today, {}, 5)).toBe('unrecorded_past');

      // 4. Future session not started (future date, 0 taken)
      expect(resolveRibbonStatus('2026-10-25', today, {}, 5)).toBe('not_started');
    });
  });

  describe('Attendance Statistics & Analytics Engine (computeAttendanceAnalytics)', () => {
    const testKids: any[] = [
      { id: 'k1', info: { fullName: 'Faithful Student' } },
      { id: 'k2', info: { fullName: 'Irregular Student' } },
      { id: 'k3', info: { fullName: 'At-Risk Student' } },
    ];

    const testEvents: AttendanceEvent[] = [
      {
        id: 'e1',
        academicYearId: 'y1',
        classId: 'c1',
        title: 'Session 1 - Sunday School',
        type: 'Sunday School',
        eventDate: '2026-10-04',
        takenAt: '2026-10-04T10:00:00Z',
        statuses: { k1: 'present', k2: 'present', k3: 'absent' }, // 2/3 = 67%
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      },
      {
        id: 'e2',
        academicYearId: 'y1',
        classId: 'c1',
        title: 'Session 2 - Liturgy',
        type: 'Liturgy',
        eventDate: '2026-10-11',
        takenAt: '2026-10-11T10:00:00Z',
        statuses: { k1: 'present', k2: 'absent', k3: 'absent' }, // 1/3 = 33%
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      },
      {
        id: 'e3',
        academicYearId: 'y1',
        classId: 'c1',
        title: 'Session 3 - Sunday School',
        type: 'Sunday School',
        eventDate: '2026-10-18',
        takenAt: '2026-10-18T10:00:00Z',
        statuses: { k1: 'present', k2: 'present', k3: 'absent' }, // 2/3 = 67%
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      },
    ];

    it('computes accurate overall term analytics and KPIs', async () => {
      const { computeAttendanceAnalytics } = await import('../utils/attendanceStats');
      const stats = computeAttendanceAnalytics(testEvents, testKids);

      expect(stats.totalRoster).toBe(3);
      expect(stats.totalScheduledSessions).toBe(3);
      expect(stats.conductedSessions).toBe(3);

      // Total presences: k1 = 3, k2 = 2, k3 = 0 -> 5 presences out of 9 opportunities -> 56%
      expect(stats.averageRate).toBe(56);
      expect(stats.bestSession?.rate).toBe(67);
    });

    it('accurately brackets students into Faithful, Irregular, and At-Risk categories', async () => {
      const { computeAttendanceAnalytics } = await import('../utils/attendanceStats');
      const stats = computeAttendanceAnalytics(testEvents, testKids);

      // k1: 3/3 (100%) -> Faithful
      expect(stats.faithfulKids).toHaveLength(1);
      expect(stats.faithfulKids[0].kid.id).toBe('k1');
      expect(stats.faithfulKids[0].attendanceRate).toBe(100);

      // k2: 2/3 (67%) -> Irregular (50%-79%)
      expect(stats.irregularKids).toHaveLength(1);
      expect(stats.irregularKids[0].kid.id).toBe('k2');
      expect(stats.irregularKids[0].attendanceRate).toBe(67);

      // k3: 0/3 (0%) -> At-Risk (<50%)
      expect(stats.atRiskKids).toHaveLength(1);
      expect(stats.atRiskKids[0].kid.id).toBe('k3');
      expect(stats.atRiskKids[0].attendanceRate).toBe(0);
    });

    it('computes event type comparison breakdown', async () => {
      const { computeAttendanceAnalytics } = await import('../utils/attendanceStats');
      const stats = computeAttendanceAnalytics(testEvents, testKids);

      // Sunday School: 2 sessions (e1, e3). Presences = 2 + 2 = 4 out of 6 -> 67%
      const ssStats = stats.typeComparison.find((t) => t.type === 'Sunday School');
      expect(ssStats?.sessionCount).toBe(2);
      expect(ssStats?.averageRate).toBe(67);

      // Liturgy: 1 session (e2). Presences = 1 out of 3 -> 33%
      const litStats = stats.typeComparison.find((t) => t.type === 'Liturgy');
      expect(litStats?.sessionCount).toBe(1);
      expect(litStats?.averageRate).toBe(33);
    });

    it('computes top and lowest attendees ranking sort order accurately', async () => {
      const { computeAttendanceAnalytics } = await import('../utils/attendanceStats');
      const stats = computeAttendanceAnalytics(testEvents, testKids);

      // Top attendees should have k1 first (3 presences), k2 second (2 presences), k3 last (0)
      expect(stats.topAttendees[0].kid.id).toBe('k1');
      expect(stats.topAttendees[1].kid.id).toBe('k2');
      expect(stats.topAttendees[2].kid.id).toBe('k3');

      // Lowest attendees should have k3 first (0% rate), k2 second (67%), k1 last (100%)
      expect(stats.lowestAttendees[0].kid.id).toBe('k3');
      expect(stats.lowestAttendees[1].kid.id).toBe('k2');
      expect(stats.lowestAttendees[2].kid.id).toBe('k1');
    });

    it('handles partial kids objects without info gracefully without throwing exceptions', async () => {
      const { computeAttendanceAnalytics } = await import('../utils/attendanceStats');
      const partialKids: any[] = [
        { id: 'pk1', info: undefined },
        { id: 'pk2', info: { fullName: null } },
      ];

      const stats = computeAttendanceAnalytics(testEvents, partialKids);
      expect(stats.totalRoster).toBe(2);
      expect(stats.faithfulKids).toHaveLength(0);
    });
  });

  describe('Core-Event Horizon in Pastoral Care Alerts', () => {
    it('ignores non-core events (isCore === false) when evaluating consecutive absences', () => {
      const events: AttendanceEvent[] = [
        {
          id: 'ev1',
          academicYearId: 'y1',
          classId: 'c1',
          title: 'Sunday School',
          type: 'Sunday School',
          eventDate: '2026-10-04',
          statuses: { kid1: 'absent' },
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
        {
          id: 'ev2',
          academicYearId: 'y1',
          classId: 'c1',
          title: 'Church Picnic Trip',
          type: 'Trip',
          eventDate: '2026-10-11',
          statuses: { kid1: 'absent' }, // Absent on voluntary trip
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
        {
          id: 'ev3',
          academicYearId: 'y1',
          classId: 'c1',
          title: 'Sunday School',
          type: 'Sunday School',
          eventDate: '2026-10-18',
          statuses: { kid1: 'present' }, // Present in next core lesson
          notesByKid: {},
          createdAt: '',
          createdBy: '',
        },
      ];

      const groupTypes = ['Sunday School'];
      const kidsList: any[] = [{ id: 'kid1', info: { fullName: 'Kid One' } }];

      const alerts = computeConsecutiveAbsences(events, kidsList, groupTypes);
      // Because kid1 was present on Oct 18, their latest consecutive absence count is 0 and they are not flagged
      expect(alerts.find((a) => a.kid.id === 'kid1')).toBeUndefined();
    });
  });
});
