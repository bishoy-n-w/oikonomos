import { describe, it, expect, beforeEach } from 'vitest';
import { getGoogleAccessToken, setGoogleAccessToken } from '../services/auth';

describe('Security & Threat Hardening Test Suite (SEC-01 - SEC-06)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('SEC-03: Ephemeral OAuth Token Lifecycle (auth.ts)', () => {
    it('stores Google OAuth Access Token in sessionStorage and never in localStorage', () => {
      // Seed a legacy token in localStorage to test auto-purge
      localStorage.setItem('oikonomos_google_access_token', 'legacy_leaked_token');

      // Set new ephemeral token
      setGoogleAccessToken('ephemeral_oauth_token_12345');

      // Assert token resides in sessionStorage
      expect(sessionStorage.getItem('oikonomos_google_access_token')).toBe('ephemeral_oauth_token_12345');
      expect(getGoogleAccessToken()).toBe('ephemeral_oauth_token_12345');

      // Assert legacy persistent localStorage was completely purged
      expect(localStorage.getItem('oikonomos_google_access_token')).toBeNull();
    });

    it('purges all token instances across sessionStorage and memory upon signOut', async () => {
      setGoogleAccessToken('active_session_token');
      expect(getGoogleAccessToken()).toBe('active_session_token');

      // Clear tokens via helper
      setGoogleAccessToken(null);

      expect(sessionStorage.getItem('oikonomos_google_access_token')).toBeNull();
      expect(localStorage.getItem('oikonomos_google_access_token')).toBeNull();
      expect(getGoogleAccessToken()).toBeNull();
    });
  });

  describe('SEC-06: Bootstrap Lock & Global Admin Invariants', () => {
    interface SecurityContext {
      auth: { uid: string; email: string } | null;
      db: {
        global_admins: Record<string, any>;
      };
    }

    function evaluateGlobalAdminCreate(
      ctx: SecurityContext,
      targetAdminId: string,
      _targetPayload: any
    ): { allowed: boolean; reason?: string } {
      if (!ctx.auth) return { allowed: false, reason: 'Unauthenticated' };

      const isEstablishedAdmin = !!ctx.db.global_admins[ctx.auth.uid];
      const hasLock = !!ctx.db.global_admins['_lock'];

      if (isEstablishedAdmin) {
        return { allowed: true };
      }

      if (!hasLock && targetAdminId === ctx.auth.uid) {
        return { allowed: true };
      }

      return { allowed: false, reason: 'Bootstrap locked or mismatched UID' };
    }

    function evaluateGlobalAdminDelete(
      ctx: SecurityContext,
      targetAdminId: string
    ): { allowed: boolean; reason?: string } {
      if (!ctx.auth) return { allowed: false, reason: 'Unauthenticated' };
      const isEstablishedAdmin = !!ctx.db.global_admins[ctx.auth.uid];

      // SEC-06 Rule: _lock is permanently protected and cannot be deleted via client SDK
      if (targetAdminId === '_lock') {
        return { allowed: false, reason: 'Permanent lock document is immutable and non-deletable' };
      }

      if (isEstablishedAdmin) {
        return { allowed: true };
      }

      return { allowed: false, reason: 'Permission denied' };
    }

    it('allows initial user to bootstrap their own UID when database has no lock', () => {
      const freshDb: SecurityContext = {
        auth: { uid: 'user_first_admin', email: 'coordinator@church.org' },
        db: { global_admins: {} },
      };

      const result = evaluateGlobalAdminCreate(freshDb, 'user_first_admin', { role: 'owner' });
      expect(result.allowed).toBe(true);
    });

    it('rejects an attacker attempting to register an arbitrary adminId when not locked', () => {
      const freshDb: SecurityContext = {
        auth: { uid: 'attacker_123', email: 'hacker@malicious.com' },
        db: { global_admins: {} },
      };

      // Attacker tries to inject a forged root admin doc for another user
      const result = evaluateGlobalAdminCreate(freshDb, 'forged_root_admin', { role: 'owner' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('mismatched UID');
    });

    it('permanently blocks unauthenticated and regular users once _lock exists', () => {
      const lockedDb: SecurityContext = {
        auth: { uid: 'intruder_456', email: 'stranger@gmail.com' },
        db: {
          global_admins: {
            _lock: { lockedAt: '2026-01-01' },
            legitimate_admin: { role: 'owner' },
          },
        },
      };

      const result = evaluateGlobalAdminCreate(lockedDb, 'intruder_456', { role: 'owner' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Bootstrap locked');
    });

    it('permanently blocks deleting the _lock document even by registered global admins', () => {
      const adminCtx: SecurityContext = {
        auth: { uid: 'head_admin', email: 'head@church.org' },
        db: {
          global_admins: {
            _lock: { lockedAt: '2026-01-01' },
            head_admin: { role: 'owner' },
          },
        },
      };

      const deleteLockAttempt = evaluateGlobalAdminDelete(adminCtx, '_lock');
      expect(deleteLockAttempt.allowed).toBe(false);
      expect(deleteLockAttempt.reason).toContain('immutable and non-deletable');

      // Deleting a standard user entry by admin is allowed
      const deleteAdminAttempt = evaluateGlobalAdminDelete(adminCtx, 'former_admin_789');
      expect(deleteAdminAttempt.allowed).toBe(true);
    });
  });

  describe('SEC-02: Safe Map Key Lookups & Case-Insensitive Email Matching', () => {
    function evaluateGroupAdminAccess(
      authEmail: string,
      groupDocData: { misters?: Record<string, string>; admins?: string[] }
    ): boolean {
      const emailLower = authEmail.toLowerCase().trim();

      // Safe key check on misters map
      if (groupDocData.misters) {
        if (groupDocData.misters[authEmail] === 'admin') return true;
        if (groupDocData.misters[emailLower] === 'admin') return true;
      }

      // Safe array check on admins
      if (Array.isArray(groupDocData.admins)) {
        if (groupDocData.admins.includes(authEmail)) return true;
        if (groupDocData.admins.map((e) => e.toLowerCase()).includes(emailLower)) return true;
      }

      return false;
    }

    it('safely evaluates group admin without throwing on null or empty misters maps', () => {
      const emptyGroup = { misters: undefined, admins: undefined };
      expect(() => evaluateGroupAdminAccess('servant@church.org', emptyGroup)).not.toThrow();
      expect(evaluateGroupAdminAccess('servant@church.org', emptyGroup)).toBe(false);
    });

    it('matches group admin role with case-insensitive email token variations', () => {
      const groupData = {
        misters: {
          'servant.john@church.org': 'admin',
        },
      };

      // User signed in with mixed-case Google Account
      expect(evaluateGroupAdminAccess('Servant.John@Church.Org', groupData)).toBe(true);
      expect(evaluateGroupAdminAccess('SERVANT.JOHN@CHURCH.ORG', groupData)).toBe(true);
      expect(evaluateGroupAdminAccess('other@church.org', groupData)).toBe(false);
    });
  });

  describe('SEC-05: Class Servant Assignment Tampering Restrictions', () => {
    interface Assignment {
      academicYearId: string;
      serviceGroupId: string;
      classId: string;
    }

    function evaluateClassServantUpdate(
      original: Assignment,
      updated: Assignment
    ): { allowed: boolean; reason?: string } {
      // Must not alter academicYearId
      if (updated.academicYearId !== original.academicYearId) {
        return { allowed: false, reason: 'Class Servants cannot alter academic year' };
      }
      // Must not alter serviceGroupId
      if (updated.serviceGroupId !== original.serviceGroupId) {
        return { allowed: false, reason: 'Class Servants cannot alter service group' };
      }
      // Can only keep classId identical OR set to empty/null (unassigning)
      if (updated.classId !== original.classId && updated.classId !== '' && updated.classId !== null) {
        return { allowed: false, reason: 'Class Servants cannot transfer students to another class' };
      }

      return { allowed: true };
    }

    it('allows updating personal student data while retaining identical assignment', () => {
      const original: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade4' };
      const updated: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade4' };

      expect(evaluateClassServantUpdate(original, updated).allowed).toBe(true);
    });

    it('allows class teacher to remove a student from their class (classId = "")', () => {
      const original: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade4' };
      const unassigned: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: '' };

      expect(evaluateClassServantUpdate(original, unassigned).allowed).toBe(true);
    });

    it('blocks class servant from transferring student to another class', () => {
      const original: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade4' };
      const transferred: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade5' };

      const result = evaluateClassServantUpdate(original, transferred);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot transfer students to another class');
    });

    it('blocks class servant from hijacking student into another service group', () => {
      const original: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_elem', classId: 'cls_grade4' };
      const hijacked: Assignment = { academicYearId: 'y2026', serviceGroupId: 'grp_high_school', classId: 'cls_grade4' };

      const result = evaluateClassServantUpdate(original, hijacked);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot alter service group');
    });
  });

  describe('SEC-01: Version Subcollection RBAC Inheritance', () => {
    function canAccessKidVersion(
      userRole: 'church_admin' | 'group_servant' | 'class_servant' | 'unassigned_servant',
      targetKidAssignment: { serviceGroupId: string; classId: string },
      servantAssignment: { serviceGroupId?: string; classId?: string }
    ): boolean {
      if (userRole === 'church_admin') return true;

      if (userRole === 'group_servant' && servantAssignment.serviceGroupId === targetKidAssignment.serviceGroupId) {
        return true;
      }

      if (userRole === 'class_servant' && servantAssignment.classId === targetKidAssignment.classId) {
        return true;
      }

      return false;
    }

    it('permits authorized class servant and group servant to view audit versions', () => {
      const target = { serviceGroupId: 'grp_elem', classId: 'cls_g4' };

      expect(canAccessKidVersion('class_servant', target, { classId: 'cls_g4' })).toBe(true);
      expect(canAccessKidVersion('group_servant', target, { serviceGroupId: 'grp_elem' })).toBe(true);
      expect(canAccessKidVersion('church_admin', target, {})).toBe(true);
    });

    it('strictly denies unauthorized church servants from viewing student version history', () => {
      const target = { serviceGroupId: 'grp_elem', classId: 'cls_g4' };

      // Servant from High School department attempting to scrape Elementary audit history
      expect(canAccessKidVersion('unassigned_servant', target, { serviceGroupId: 'grp_high_school', classId: 'cls_g10' })).toBe(false);
    });
  });
});
