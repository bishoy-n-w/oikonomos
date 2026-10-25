import { describe, it, expect } from 'vitest';
import type { UserRole } from '../types';

describe('Role & Authorization Evaluation Logic', () => {
  function evaluateUserRole(
    isGlobalAdmin: boolean,
    churchRole?: string | null
  ): UserRole {
    if (isGlobalAdmin) return 'owner';
    if (churchRole === 'admin') return 'Admin';
    return 'viewer';
  }

  function sanitizeSelfServiceMisterUpdate(
    currentEmail: string,
    targetMisterEmail: string,
    isAdmin: boolean,
    incomingPayload: Record<string, any>
  ): Record<string, any> {
    const isSelfEditing = currentEmail.toLowerCase() === targetMisterEmail.toLowerCase();
    const result = { ...incomingPayload };

    if (isSelfEditing && !isAdmin) {
      delete result.churchRole;
      delete result.active;
    }
    return result;
  }

  it('assigns owner role when user is in global_admins regardless of church role', () => {
    expect(evaluateUserRole(true, 'viewer')).toBe('owner');
    expect(evaluateUserRole(true, undefined)).toBe('owner');
    expect(evaluateUserRole(true, 'admin')).toBe('owner');
  });

  it('assigns Admin role when user has churchRole admin and is not global admin', () => {
    expect(evaluateUserRole(false, 'admin')).toBe('Admin');
  });

  it('assigns viewer role for non-admin servants', () => {
    expect(evaluateUserRole(false, 'viewer')).toBe('viewer');
    expect(evaluateUserRole(false, null)).toBe('viewer');
  });

  it('prevents non-admin servants from modifying churchRole and active status on their own profile', () => {
    const payload = {
      displayName: 'Peter Nabil',
      churchRole: 'admin',
      active: true,
      personalInfo: { phone: '+20122334455' },
    };

    const sanitized = sanitizeSelfServiceMisterUpdate(
      'peter@gmail.com',
      'peter@gmail.com',
      false, // not admin
      payload
    );

    expect(sanitized.displayName).toBe('Peter Nabil');
    expect(sanitized.personalInfo.phone).toBe('+20122334455');
    expect(sanitized.churchRole).toBeUndefined();
    expect(sanitized.active).toBeUndefined();
  });

  it('allows admins to modify churchRole and active status on any servant profile', () => {
    const payload = {
      displayName: 'Peter Nabil',
      churchRole: 'admin',
      active: true,
    };

    const sanitized = sanitizeSelfServiceMisterUpdate(
      'admin@gmail.com',
      'peter@gmail.com',
      true, // is admin
      payload
    );

    expect(sanitized.churchRole).toBe('admin');
    expect(sanitized.active).toBe(true);
  });

  describe('Firestore Self-Service Update Rules Validation', () => {
    const ALLOWED_SELF_SERVICE_KEYS = new Set([
      'personalInfo',
      'displayName',
      'lastEditAt',
      'lastEditBy',
      'email',
    ]);

    function isSelfServiceUpdatePermitted(
      misterEmail: string,
      authEmail: string,
      affectedKeys: string[]
    ): boolean {
      const emailMatches = misterEmail.toLowerCase() === authEmail.toLowerCase();
      if (!emailMatches) return false;
      return affectedKeys.every((key) => ALLOWED_SELF_SERVICE_KEYS.has(key));
    }

    it('permits self-service updates with personalInfo, displayName, and lastEdit timestamps', () => {
      const permitted = isSelfServiceUpdatePermitted(
        'bishoy.n.wasef@gmail.com',
        'bishoy.n.wasef@gmail.com',
        ['personalInfo', 'displayName', 'lastEditAt', 'lastEditBy']
      );
      expect(permitted).toBe(true);
    });

    it('matches emails case-insensitively', () => {
      const permitted = isSelfServiceUpdatePermitted(
        'bishoy.n.wasef@gmail.com',
        'Bishoy.N.Wasef@gmail.com',
        ['personalInfo', 'lastEditAt']
      );
      expect(permitted).toBe(true);
    });

    it('rejects self-service updates containing churchRole or active status', () => {
      const permittedRole = isSelfServiceUpdatePermitted(
        'bishoy.n.wasef@gmail.com',
        'bishoy.n.wasef@gmail.com',
        ['personalInfo', 'churchRole']
      );
      expect(permittedRole).toBe(false);

      const permittedActive = isSelfServiceUpdatePermitted(
        'bishoy.n.wasef@gmail.com',
        'bishoy.n.wasef@gmail.com',
        ['personalInfo', 'active']
      );
      expect(permittedActive).toBe(false);
    });

    it('rejects updates when emails do not match', () => {
      const permitted = isSelfServiceUpdatePermitted(
        'other@gmail.com',
        'bishoy.n.wasef@gmail.com',
        ['personalInfo']
      );
      expect(permitted).toBe(false);
    });
  });
});
