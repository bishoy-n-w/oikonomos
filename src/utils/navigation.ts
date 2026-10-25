import type { ActiveTab } from '../components/layout/MainShell';

export const TAB_TO_ROUTE: Record<ActiveTab, string> = {
  dashboard: 'dashboard',
  kids: 'kids',
  servants: 'servants',
  attendance: 'attendance',
  classes: 'classes',
  service_groups: 'service-groups',
  home_visits: 'home-visits',
  churches_config: 'church-admin',
};

export const ROUTE_TO_TAB: Record<string, ActiveTab> = {
  dashboard: 'dashboard',
  kids: 'kids',
  servants: 'servants',
  attendance: 'attendance',
  classes: 'classes',
  'service-groups': 'service_groups',
  'home-visits': 'home_visits',
  'church-admin': 'churches_config',
};

export const STORAGE_KEYS = {
  churchId: 'oikonomos_selected_church_id',
  academicYearId: 'oikonomos_selected_academic_year_id',
  serviceGroupId: 'oikonomos_selected_service_group_id',
  classId: 'oikonomos_selected_class_id',
  lastTab: 'oikonomos_last_active_tab',
};

export interface RouteFilters {
  churchId?: string | null;
  academicYearId?: string | null;
  serviceGroupId?: string | null;
  classId?: string | null;
}

export interface ParsedRoute {
  tab: ActiveTab;
  filters: RouteFilters;
}

/**
 * Parses current window.location.hash into activeTab and route filters.
 * Falls back to localStorage for last tab if no hash is present.
 */
export function parseCurrentRoute(): ParsedRoute {
  if (typeof window === 'undefined') {
    return { tab: 'dashboard', filters: {} };
  }

  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  const [routePart, queryPart] = rawHash.split('?');
  const cleanRoute = (routePart || '').toLowerCase().trim();

  let tab: ActiveTab | undefined = ROUTE_TO_TAB[cleanRoute];
  if (!tab) {
    try {
      const savedTab = localStorage.getItem(STORAGE_KEYS.lastTab) as ActiveTab | null;
      if (savedTab && TAB_TO_ROUTE[savedTab]) {
        tab = savedTab;
      } else {
        tab = 'dashboard';
      }
    } catch {
      tab = 'dashboard';
    }
  }

  // Parse query parameters from hash or search
  const searchParams = new URLSearchParams(queryPart || (window.location.search ? window.location.search.slice(1) : ''));
  const churchId = searchParams.get('church') || undefined;
  const academicYearId = searchParams.get('year') || undefined;
  const serviceGroupId = searchParams.get('group') || undefined;
  const classId = searchParams.get('class') || undefined;

  return {
    tab,
    filters: {
      churchId,
      academicYearId,
      serviceGroupId,
      classId,
    },
  };
}

/**
 * Constructs a hash URL string from a tab and active filter selections.
 */
export function buildHashUrl(tab: ActiveTab, filters?: RouteFilters): string {
  const route = TAB_TO_ROUTE[tab] || 'dashboard';
  const params = new URLSearchParams();

  if (filters?.churchId) params.set('church', filters.churchId);
  if (filters?.academicYearId) params.set('year', filters.academicYearId);
  if (filters?.serviceGroupId) params.set('group', filters.serviceGroupId);
  if (filters?.classId) params.set('class', filters.classId);

  const queryStr = params.toString();
  return `#/${route}${queryStr ? `?${queryStr}` : ''}`;
}

/**
 * Updates the browser's URL hash and caches current tab in localStorage.
 * Uses replaceState by default so minor filter changes don't spam browser history.
 */
export function syncRouteToUrl(tab: ActiveTab, filters?: RouteFilters, pushHistory: boolean = false) {
  if (typeof window === 'undefined') return;

  const targetHash = buildHashUrl(tab, filters);
  if (window.location.hash !== targetHash) {
    if (pushHistory) {
      window.location.hash = targetHash;
    } else {
      window.history.replaceState(null, '', targetHash);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEYS.lastTab, tab);
  } catch {
    // Ignore storage quota / private mode errors
  }
}

/**
 * Caches a filter selection to localStorage.
 */
export function saveFilterToStorage(key: keyof typeof STORAGE_KEYS, value: string | null | undefined) {
  if (typeof localStorage === 'undefined') return;
  try {
    const storageKey = STORAGE_KEYS[key];
    if (value) {
      localStorage.setItem(storageKey, value);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Ignore
  }
}

/**
 * Reads a cached filter selection from localStorage.
 */
export function getFilterFromStorage(key: keyof typeof STORAGE_KEYS): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEYS[key]);
  } catch {
    return null;
  }
}
