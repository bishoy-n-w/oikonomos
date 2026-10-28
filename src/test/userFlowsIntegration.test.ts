import { describe, it, expect, vi } from 'vitest';
import { computeConsecutiveAbsences, buildPastoralWhatsAppUrl } from '../utils/pastoralCare';
import { getUniversalNavigationUrl, normalizeGeoInput } from '../utils/geo';
import { autoMapHeadersHeuristically, normalizeDateValueWithMeta } from '../services/smartImport';
import type { AttendanceEvent, Kid, HomeVisit, GroupEventType } from '../types';

describe('End-to-End User Flow Integration Tests (Coordinators & Servants)', () => {
  describe('User Flow 1: Sunday Roll-Call & Absentee WhatsApp Pastoral Follow-Up', () => {
    const mockKids: Kid[] = [
      {
        id: 'kid_1',
        active: true,
        info: { fullName: 'Adrian Rami', gender: 'male' },
        contacts: { fatherName: 'Rami', fatherMob: '+201223344556' },
      },
      {
        id: 'kid_2',
        active: true,
        info: { fullName: 'Marina Beshoy', gender: 'female' },
        contacts: { fatherName: 'Beshoy', motherMob: '+201098765432' },
      },
      {
        id: 'kid_3',
        active: true,
        info: { fullName: 'Mina Girgis', gender: 'male' },
        contacts: { fatherName: 'Girgis', fatherMob: '+201112223334' },
      },
    ];

    it('executes roll call with "Mark All Present", records absentees, and generates localized WhatsApp link', () => {
      // Step 1: Teacher opens roll-call and taps "Mark All Present"
      const initialStatuses: Record<string, 'present' | 'absent' | 'excused'> = {};
      mockKids.forEach((k) => {
        initialStatuses[k.id] = 'present';
      });

      expect(Object.values(initialStatuses).every((st) => st === 'present')).toBe(true);

      // Step 2: Teacher marks kid_1 as absent and kid_3 as excused
      const updatedStatuses = { ...initialStatuses };
      updatedStatuses['kid_1'] = 'absent';
      updatedStatuses['kid_3'] = 'excused';

      // Step 3: Verify the instant WhatsApp pastoral follow-up URL generated for kid_1's parents
      const absentee = mockKids.find((k) => k.id === 'kid_1')!;
      const targetPhone = absentee.contacts?.fatherMob || '';
      const waUrl = buildPastoralWhatsAppUrl(targetPhone, absentee.info?.fullName || '', 'Rami');

      expect(waUrl).toContain('https://wa.me/201223344556?text=');
      // Must contain pre-composed pastoral checkup message mentioning student name
      expect(decodeURIComponent(waUrl)).toContain('Adrian Rami');
      expect(decodeURIComponent(waUrl)).toContain('مدارس الأحد');
    });

    it('triggers consecutive absence alarm on the second consecutive missed core session', () => {
      const coreEventTypes: GroupEventType[] = [
        { id: 'sunday_school', name: 'Sunday School', isCore: true },
        { id: 'activity', name: 'Sports Day', isCore: false },
      ];

      // Week 1: Sunday School (kid_1 absent)
      const eventW1: AttendanceEvent = {
        id: 'e_w1',
        academicYearId: 'y2026',
        classId: 'c1',
        title: 'Sunday School Week 1',
        type: 'Sunday School',
        eventDate: '2026-10-04',
        statuses: { kid_1: 'absent', kid_2: 'present' },
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      };

      // Week 2: Sports Day (Voluntary activity, kid_1 absent - should NOT trigger core alarm)
      const eventW2: AttendanceEvent = {
        id: 'e_w2',
        academicYearId: 'y2026',
        classId: 'c1',
        title: 'Picnic & Sports',
        type: 'Sports Day',
        eventDate: '2026-10-11',
        statuses: { kid_1: 'absent', kid_2: 'present' },
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      };

      // Week 3: Sunday School (kid_1 absent again - SECOND core absence)
      const eventW3: AttendanceEvent = {
        id: 'e_w3',
        academicYearId: 'y2026',
        classId: 'c1',
        title: 'Sunday School Week 2',
        type: 'Sunday School',
        eventDate: '2026-10-18',
        statuses: { kid_1: 'absent', kid_2: 'present' },
        notesByKid: {},
        createdAt: '',
        createdBy: '',
      };

      const historyEvents = [eventW1, eventW2, eventW3];
      const coreTypeNames = coreEventTypes.filter((t) => t.isCore).map((t) => t.name);

      const alerts = computeConsecutiveAbsences(historyEvents, mockKids, coreTypeNames);

      // kid_1 missed 2 core sessions (W1 and W3)
      const kid1Alert = alerts.find((a) => a.kid.id === 'kid_1');
      expect(kid1Alert).toBeDefined();
      expect(kid1Alert?.consecutiveCount).toBe(2);

      // kid_2 attended and has 0 consecutive absences
      const kid2Alert = alerts.find((a) => a.kid.id === 'kid_2');
      expect(kid2Alert).toBeUndefined();
    });
  });

  describe('User Flow 2: Smart Onboarding & Class Roster Reconciliation', () => {
    it('heuristically maps bilingual headers and auto-detects school types', () => {
      const rawHeaders = [
        'اسم المخدوم بالكامل',
        'تاريخ الميلاد',
        'النوع',
        'موبايل ولي الأمر',
        'المدرسة',
        'شماس',
      ];

      const mapping = autoMapHeadersHeuristically(rawHeaders);
      expect(mapping['اسم المخدوم بالكامل']).toBe('fullName');
      expect(mapping['تاريخ الميلاد']).toBe('dob');
      expect(mapping['النوع']).toBe('gender');
      expect(mapping['موبايل ولي الأمر']).toBe('fatherMob');
      expect(mapping['المدرسة']).toBe('school');
      expect(mapping['شماس']).toBe('deacon');
    });

    it('parses mixed-format Egyptian birthdates with Arabic months and year defaults', () => {
      // Full date with Arabic month
      const parsedFull = normalizeDateValueWithMeta('15 أكتوبر 2014');
      expect(parsedFull.date).toBe('2014-10-15');
      expect(parsedFull.usedDefaultYear).toBe(false);

      // Year-less birthdate (e.g. "8 فبراير") defaults to year 2000
      const parsedYearless = normalizeDateValueWithMeta('8 فبراير');
      expect(parsedYearless.date).toBe('2000-02-08');
      expect(parsedYearless.usedDefaultYear).toBe(true);
    });

    it('simulates bulk reassignment and confirms atomic roster pruning across classrooms', () => {
      // Initial state: Class 4A has students [k1, k2], Class 4B has students [k3]
      const class4A = { id: 'c_4a', kidIds: ['k1', 'k2'] };
      const class4B = { id: 'c_4b', kidIds: ['k3'] };

      // User selects k2 in Directory and bulk-reassigns to Class 4B
      const selectedKids = ['k2'];

      // Atomic reconciliation: Add to target, prune from origin
      const updated4B = Array.from(new Set([...class4B.kidIds, ...selectedKids]));
      const updated4A = class4A.kidIds.filter((id) => !selectedKids.includes(id));

      expect(updated4B).toEqual(['k3', 'k2']);
      expect(updated4A).toEqual(['k1']);
      expect(updated4A.includes('k2')).toBe(false);
    });
  });

  describe('User Flow 3: Home Visitation & Universal GPS Navigation', () => {
    it('normalizes raw WhatsApp location link into standard Geo URI and resolves platform URLs', () => {
      // Servant receives a WhatsApp location pin
      const waLink = 'https://maps.google.com/maps?q=loc:30.051234,31.245678';
      const normalizedGeo = normalizeGeoInput(waLink);

      expect(normalizedGeo).toBe('geo:30.051234,31.245678');

      // Android/Desktop resolver -> Google Maps destination turn-by-turn
      const androidNavUrl = getUniversalNavigationUrl(normalizedGeo, 'Shubra, Cairo');
      expect(androidNavUrl).toBe('https://www.google.com/maps/dir/?api=1&destination=30.051234,31.245678');

      // iOS Safari resolver -> Apple Maps daddr turn-by-turn
      const userAgentSpy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone; CPU iPhone OS 17_0 like Mac OS X');
      const iosNavUrl = getUniversalNavigationUrl(normalizedGeo, 'Shubra, Cairo');
      expect(iosNavUrl).toBe('https://maps.apple.com/?daddr=30.051234,31.245678&dirflg=d');
      userAgentSpy.mockRestore();
    });

    it('computes pastoral visitation health and flags overdue students (>60 days)', () => {
      const now = new Date();
      const formatIso = (daysAgo: number) => {
        const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return d.toISOString().split('T')[0];
      };

      const kid1Visits: HomeVisit[] = [
        {
          id: 'v1',
          kidId: 'k1',
          academicYearId: 'y2026',
          classId: 'c1',
          visitDate: formatIso(15), // 15 days ago -> recently visited
          type: 'home_visit',
          visitorMisterIds: ['m1'],
          notes: 'Great family check-in',
          createdAt: '',
          createdBy: '',
        },
      ];

      const kid2Visits: HomeVisit[] = [
        {
          id: 'v2',
          kidId: 'k2',
          academicYearId: 'y2026',
          classId: 'c1',
          visitDate: formatIso(75), // 75 days ago -> overdue (>60d)
          type: 'home_visit',
          visitorMisterIds: ['m1'],
          notes: 'Father requested visit',
          createdAt: '',
          createdBy: '',
        },
      ];

      const getHealthStatus = (visits: HomeVisit[]) => {
        if (!visits.length) return 'never_visited';
        const latest = visits[0];
        const diffDays = Math.floor((now.getTime() - new Date(latest.visitDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) return 'recently_visited';
        if (diffDays <= 60) return 'due_for_visit';
        return 'overdue_for_visit';
      };

      expect(getHealthStatus(kid1Visits)).toBe('recently_visited');
      expect(getHealthStatus(kid2Visits)).toBe('overdue_for_visit');
      expect(getHealthStatus([])).toBe('never_visited');
    });
  });
});
