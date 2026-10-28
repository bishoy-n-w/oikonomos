import { describe, it, expect } from 'vitest';

describe('Requirements Specifications & Logic Validation', () => {
  // 1. Church Year Deletion Safeguards
  describe('Academic Year Deletion Constraints', () => {
    function canDeleteAcademicYear(
      yearId: string,
      activeAcademicYearId: string,
      allYears: Array<{ id: string }>,
      classes: Array<{ academicYears?: Record<string, any> }>
    ): { allowed: boolean; reason?: string } {
      if (allYears.length <= 1) {
        return { allowed: false, reason: 'A church must retain at least one academic year.' };
      }
      if (yearId === activeAcademicYearId) {
        return { allowed: false, reason: 'Cannot delete: This is the currently active Academic Year.' };
      }
      const isReferenced = classes.some((cls) => cls.academicYears && cls.academicYears[yearId]);
      if (isReferenced) {
        return { allowed: false, reason: 'Cannot delete: This Academic Year is referenced in one or more classes.' };
      }
      return { allowed: true };
    }

    it('blocks deletion if only one academic year exists', () => {
      const res = canDeleteAcademicYear('y1', 'y1', [{ id: 'y1' }], []);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('at least one');
    });

    it('blocks deletion if target year is currently active', () => {
      const res = canDeleteAcademicYear('y1', 'y1', [{ id: 'y1' }, { id: 'y2' }], []);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('currently active');
    });

    it('blocks deletion if target year is referenced in classes', () => {
      const res = canDeleteAcademicYear(
        'y2',
        'y1',
        [{ id: 'y1' }, { id: 'y2' }],
        [{ academicYears: { y2: { displayName: 'Grade 4' } } }]
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('referenced in one or more classes');
    });

    it('allows deletion when year is inactive, not referenced, and another year exists', () => {
      const res = canDeleteAcademicYear(
        'y2',
        'y1',
        [{ id: 'y1' }, { id: 'y2' }],
        [{ academicYears: { y1: { displayName: 'Grade 4' } } }]
      );
      expect(res.allowed).toBe(true);
    });
  });

  // 2. Dynamic Grade-to-Group Mappings
  describe('Dynamic Grade-to-Group Filtering', () => {
    const gradesMap: Record<string, { name: string; serviceGroupId: string }> = {
      '1': { name: 'Grade 1', serviceGroupId: 'elementary' },
      '2': { name: 'Grade 2', serviceGroupId: 'elementary' },
      '3': { name: 'Grade 7', serviceGroupId: 'middle_school' },
    };

    function getGradesForGroup(groupId: string) {
      return Object.entries(gradesMap)
        .filter(([, item]) => item.serviceGroupId === groupId)
        .map(([intKey, item]) => ({ id: intKey, name: item.name }));
    }

    it('filters grades strictly by selected service group', () => {
      const elementaryGrades = getGradesForGroup('elementary');
      expect(elementaryGrades).toHaveLength(2);
      expect(elementaryGrades.map((g) => g.id)).toEqual(['1', '2']);

      const middleGrades = getGradesForGroup('middle_school');
      expect(middleGrades).toHaveLength(1);
      expect(middleGrades[0].id).toBe('3');
    });
  });

  // 3. Header Filtering Matrix Row Matching
  describe('Header Filter Matrix Row Filtering', () => {
    const items = [
      { id: '1', name: 'John Doe', active: true, role: 'admin' },
      { id: '2', name: 'Jane Smith', active: false, role: 'viewer' },
      { id: '3', name: 'Michael John', active: true, role: 'viewer' },
    ];

    it('matches text queries case-insensitively', () => {
      const query = 'john';
      const matches = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
      expect(matches).toHaveLength(2);
    });

    it('matches boolean status exactly', () => {
      const activeMatches = items.filter((i) => String(i.active) === 'true');
      expect(activeMatches).toHaveLength(2);

      const inactiveMatches = items.filter((i) => String(i.active) === 'false');
      expect(inactiveMatches).toHaveLength(1);
    });

    it('matches select option values', () => {
      const admins = items.filter((i) => i.role === 'admin');
      expect(admins).toHaveLength(1);
    });
  });

  // 4. Service Group Servants Derivation for Class Modal
  describe('Service Group Servants Derivation for Class Modal', () => {
    function deriveAvailableGroupMisters(
      targetGroupData: {
        misters?: Record<string, 'admin' | 'servant'>;
        admins?: string[];
        servants?: string[];
      } | undefined,
      allMisters: Array<{ id: string; email?: string; displayName: string }>
    ) {
      const allowedMisterEmails = new Set<string>();
      if (targetGroupData) {
        Object.keys(targetGroupData.misters || {}).forEach((e) => allowedMisterEmails.add(e.toLowerCase().trim()));
        (targetGroupData.admins || []).forEach((e) => allowedMisterEmails.add(e.toLowerCase().trim()));
        (targetGroupData.servants || []).forEach((e) => allowedMisterEmails.add(e.toLowerCase().trim()));
      }

      return allMisters.filter((m) => {
        const email = (m.email || m.id || '').toLowerCase().trim();
        return allowedMisterEmails.has(email);
      });
    }

    it('derives group servants from misters map, admins list, and servants list', () => {
      const groupData = {
        misters: { 'coord@example.com': 'admin' as const },
        admins: ['coord@example.com'],
        servants: ['servant1@example.com', 'servant2@example.com'],
      };

      const misters = [
        { id: 'coord@example.com', email: 'coord@example.com', displayName: 'Coordinator' },
        { id: 'servant1@example.com', email: 'servant1@example.com', displayName: 'Servant 1' },
        { id: 'other@example.com', email: 'other@example.com', displayName: 'Other Department' },
      ];

      const available = deriveAvailableGroupMisters(groupData, misters);
      expect(available).toHaveLength(2);
      expect(available.map((m) => m.displayName)).toEqual(['Coordinator', 'Servant 1']);
    });

    it('matches case-insensitively and falls back to id when email is undefined', () => {
      const groupData = {
        servants: ['JOHN@EXAMPLE.COM '],
      };

      const misters = [
        { id: 'john@example.com', displayName: 'John' },
      ];

      const available = deriveAvailableGroupMisters(groupData, misters);
      expect(available).toHaveLength(1);
      expect(available[0].displayName).toBe('John');
    });

    it('returns empty list when target group data has no members', () => {
      const available = deriveAvailableGroupMisters({}, [
        { id: 'servant@example.com', email: 'servant@example.com', displayName: 'Servant' },
      ]);
      expect(available).toHaveLength(0);
    });
  });
});
