import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildHashUrl,
  parseCurrentRoute,
  saveFilterToStorage,
  getFilterFromStorage,
  syncRouteToUrl,
  STORAGE_KEYS,
  TAB_TO_ROUTE,
  ROUTE_TO_TAB,
} from '../utils/navigation';
import type { ActiveTab } from '../components/layout/MainShell';

describe('Hash Navigation & Filter Persistence Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  afterEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  describe('buildHashUrl', () => {
    it('builds clean hash URL without parameters when no filters provided', () => {
      expect(buildHashUrl('dashboard')).toBe('#/dashboard');
      expect(buildHashUrl('kids')).toBe('#/kids');
      expect(buildHashUrl('attendance')).toBe('#/attendance');
      expect(buildHashUrl('churches_config')).toBe('#/church-admin');
      expect(buildHashUrl('service_groups')).toBe('#/service-groups');
      expect(buildHashUrl('home_visits')).toBe('#/home-visits');
    });

    it('builds hash URL with encoded filter parameters', () => {
      const url = buildHashUrl('attendance', {
        churchId: 'church_123',
        academicYearId: 'year_2026',
        serviceGroupId: 'group_elem',
        classId: 'class_grade4',
      });

      expect(url).toBe('#/attendance?church=church_123&year=year_2026&group=group_elem&class=class_grade4');
    });

    it('omits null and undefined filter parameters cleanly', () => {
      const url = buildHashUrl('kids', {
        churchId: 'church_1',
        academicYearId: null,
        serviceGroupId: undefined,
        classId: 'class_2',
      });

      expect(url).toBe('#/kids?church=church_1&class=class_2');
    });
  });

  describe('parseCurrentRoute', () => {
    it('parses active tab and query parameters from window.location.hash', () => {
      window.location.hash = '#/attendance?church=c1&year=y2026&group=g1&class=cl5';

      const parsed = parseCurrentRoute();
      expect(parsed.tab).toBe('attendance');
      expect(parsed.filters.churchId).toBe('c1');
      expect(parsed.filters.academicYearId).toBe('y2026');
      expect(parsed.filters.serviceGroupId).toBe('g1');
      expect(parsed.filters.classId).toBe('cl5');
    });

    it('parses kebab-case routes correctly (service-groups, church-admin, home-visits)', () => {
      window.location.hash = '#/service-groups?church=c1';
      expect(parseCurrentRoute().tab).toBe('service_groups');

      window.location.hash = '#/church-admin';
      expect(parseCurrentRoute().tab).toBe('churches_config');

      window.location.hash = '#/home-visits';
      expect(parseCurrentRoute().tab).toBe('home_visits');
    });

    it('falls back to localStorage lastTab when no hash is in URL', () => {
      window.location.hash = '';
      localStorage.setItem(STORAGE_KEYS.lastTab, 'servants');

      const parsed = parseCurrentRoute();
      expect(parsed.tab).toBe('servants');
    });

    it('defaults to dashboard when both hash and localStorage are empty or invalid', () => {
      window.location.hash = '';
      const parsed = parseCurrentRoute();
      expect(parsed.tab).toBe('dashboard');

      window.location.hash = '#/unknown-route-xyz';
      expect(parseCurrentRoute().tab).toBe('dashboard');
    });
  });

  describe('Storage Helpers & syncRouteToUrl', () => {
    it('saves and reads filter values from localStorage', () => {
      saveFilterToStorage('churchId', 'st_mark');
      expect(getFilterFromStorage('churchId')).toBe('st_mark');

      saveFilterToStorage('churchId', null);
      expect(getFilterFromStorage('churchId')).toBeNull();
    });

    it('syncRouteToUrl updates localStorage and replaces state without error', () => {
      syncRouteToUrl('classes', { churchId: 'c1', classId: 'cl2' }, false);

      expect(localStorage.getItem(STORAGE_KEYS.lastTab)).toBe('classes');
      expect(window.location.hash).toBe('#/classes?church=c1&class=cl2');
    });
  });

  describe('Route & Tab Bijective Mapping Parity', () => {
    it('has bijective mapping between all ActiveTab values and URL routes', () => {
      const allTabs: ActiveTab[] = [
        'dashboard',
        'kids',
        'servants',
        'attendance',
        'classes',
        'service_groups',
        'home_visits',
        'churches_config',
      ];

      allTabs.forEach((tab) => {
        const route = TAB_TO_ROUTE[tab];
        expect(route).toBeDefined();
        expect(ROUTE_TO_TAB[route]).toBe(tab);
      });
    });
  });
});
