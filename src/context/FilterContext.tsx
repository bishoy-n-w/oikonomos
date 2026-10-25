import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import type { DropdownItem, UserRole } from '../types';
import { 
  parseCurrentRoute, 
  syncRouteToUrl, 
  saveFilterToStorage, 
  getFilterFromStorage 
} from '../utils/navigation';

interface FilterContextType {
  selectedChurchId: string | null;
  selectedAcademicYearId: string | null;
  selectedServiceGroupId: string | null;
  selectedClassId: string | null;
  churches: DropdownItem[];
  academicYears: DropdownItem[];
  serviceGroups: DropdownItem[];
  classes: DropdownItem[];
  isLoading: boolean;
  userRole: UserRole;
  userGroupRoles: Record<string, 'admin' | 'servant'>;
  canEditClass: (classId: string) => boolean;
  canViewClass: (classId: string) => boolean;
  setChurch: (id: string) => void;
  setAcademicYear: (id: string) => void;
  setServiceGroup: (id: string | null) => void;
  setClass: (id: string | null) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGlobalAdmin, checkChurchAuthorization } = useAuth();

  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [selectedServiceGroupId, setSelectedServiceGroupId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [churches, setChurches] = useState<DropdownItem[]>([]);
  const [churchRolesMap, setChurchRolesMap] = useState<Record<string, UserRole>>({});
  const [userGroupRoles, setUserGroupRoles] = useState<Record<string, 'admin' | 'servant'>>({});
  const [academicYears, setAcademicYears] = useState<DropdownItem[]>([]);
  const [serviceGroups, setServiceGroups] = useState<DropdownItem[]>([]);
  const [classes, setClasses] = useState<DropdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize active church with AuthContext for real-time permission evaluation
  useEffect(() => {
    if (selectedChurchId) {
      checkChurchAuthorization(selectedChurchId);
    }
  }, [selectedChurchId, checkChurchAuthorization]);

  // 1. Listen to active churches and filter to churches where the user belongs (unless Global Admin)
  useEffect(() => {
    if (!user) {
      setChurches([]);
      setChurchRolesMap({});
      setIsLoading(false);
      return;
    }

    const churchesRef = collection(db, 'churches');
    const q = query(churchesRef, where('active', '==', true));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allActiveChurches = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          displayName: data.displayName || 'Unknown Church',
          data: data.activeAcademicYearId,
        };
      });

      let allowedChurches: DropdownItem[] = [];
      const rolesMap: Record<string, UserRole> = {};

      if (isGlobalAdmin) {
        allowedChurches = allActiveChurches;
        allActiveChurches.forEach((c) => {
          rolesMap[c.id] = 'owner';
        });
      } else {
        // Filter by user's membership in churches/{id}/misters/{email}
        const userEmail = (user.email || '').toLowerCase().trim();
        const checkPromises = allActiveChurches.map(async (church): Promise<DropdownItem | null> => {
          try {
            const misterRef = doc(db, 'churches', church.id, 'misters', userEmail);
            const misterSnap = await getDoc(misterRef);
            if (misterSnap.exists() && misterSnap.data()?.active === true) {
              const role = misterSnap.data()?.churchRole?.toLowerCase() === 'admin' ? 'Admin' : 'viewer';
              rolesMap[church.id] = role;
              return church;
            }
          } catch {
            // Not permitted or doesn't exist
          }
          return null;
        });

        const results = await Promise.all(checkPromises);
        allowedChurches = results.filter((c): c is DropdownItem => c !== null);
      }

      setChurches(allowedChurches);
      setChurchRolesMap(rolesMap);
      setIsLoading(false);

      if (allowedChurches.length > 0) {
        setSelectedChurchId((prev) => {
          if (!prev || !allowedChurches.some((c) => c.id === prev)) {
            const urlChurch = parseCurrentRoute().filters.churchId;
            if (urlChurch && allowedChurches.some((c) => c.id === urlChurch)) {
              return urlChurch;
            }
            const cachedChurch = getFilterFromStorage('churchId');
            if (cachedChurch && allowedChurches.some((c) => c.id === cachedChurch)) {
              return cachedChurch;
            }
            return allowedChurches[0].id;
          }
          return prev;
        });
      } else {
        setSelectedChurchId(null);
      }
    }, (error) => {
      console.warn('Error loading churches:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isGlobalAdmin]);

  // 2. When church changes, listen to its academic years and service groups
  useEffect(() => {
    if (!selectedChurchId) {
      setAcademicYears([]);
      setServiceGroups([]);
      setClasses([]);
      setSelectedAcademicYearId(null);
      setSelectedServiceGroupId(null);
      setSelectedClassId(null);
      return;
    }

    const churchItem = churches.find((c) => c.id === selectedChurchId);
    const activeYearId = churchItem?.data as string | undefined;

    // Academic Years
    const yearsRef = collection(db, 'churches', selectedChurchId, 'academicYears');
    const unsubscribeYears = onSnapshot(yearsRef, (snapshot) => {
      const items: DropdownItem[] = snapshot.docs.map((docSnap) => {
        const isCurrentActive = docSnap.id === activeYearId;
        return {
          id: docSnap.id,
          displayName: docSnap.data().displayName || docSnap.id,
          isActiveYear: isCurrentActive,
        };
      });

      // Fallback: If subcollection has 0 documents, but church document has activeAcademicYearId
      if (items.length === 0 && activeYearId) {
        items.push({
          id: activeYearId,
          displayName: activeYearId,
          isActiveYear: true,
        });
      }

      setAcademicYears(items);

      if (items.length > 0) {
        setSelectedAcademicYearId((prev) => {
          if (prev && items.some((y) => y.id === prev)) return prev;

          const urlYear = parseCurrentRoute().filters.academicYearId;
          if (urlYear && items.some((y) => y.id === urlYear)) return urlYear;

          const cachedYear = getFilterFromStorage('academicYearId');
          if (cachedYear && items.some((y) => y.id === cachedYear)) return cachedYear;

          if (activeYearId && items.some((y) => y.id === activeYearId)) return activeYearId;

          return items[0].id;
        });
      } else {
        setSelectedAcademicYearId(null);
      }
    }, (error) => {
      console.warn('Could not read academicYears subcollection, using fallback:', error);
      if (activeYearId) {
        setAcademicYears([{
          id: activeYearId,
          displayName: activeYearId,
          isActiveYear: true,
        }]);
        setSelectedAcademicYearId(activeYearId);
      }
    });

    // Service Groups with 3-tier membership tracking
    const groupsRef = collection(db, 'churches', selectedChurchId, 'serviceGroups');
    const unsubscribeGroups = onSnapshot(groupsRef, (snapshot) => {
      const userEmail = (user?.email || '').toLowerCase().trim();
      const rolesMap: Record<string, 'admin' | 'servant'> = {};
      const allItems: DropdownItem[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const misters = data.misters || {};
        const admins = (data.admins || []).map((e: string) => e.toLowerCase().trim());
        const servants = (data.servants || []).map((e: string) => e.toLowerCase().trim());

        let userGroupRole: 'admin' | 'servant' | undefined = undefined;
        if (misters[userEmail] === 'admin' || admins.includes(userEmail)) {
          userGroupRole = 'admin';
        } else if (misters[userEmail] === 'servant' || servants.includes(userEmail)) {
          userGroupRole = 'servant';
        }

        if (userGroupRole) {
          rolesMap[docSnap.id] = userGroupRole;
        }

        allItems.push({
          id: docSnap.id,
          displayName: data.displayName || docSnap.id,
          data: {
            ...data,
            misters,
            admins,
            servants,
            userRole: userGroupRole,
          },
        });
      });

      setUserGroupRoles(rolesMap);

      const isChurchManager = isGlobalAdmin || churchRolesMap[selectedChurchId] === 'Admin' || churchRolesMap[selectedChurchId] === 'owner';
      const visibleGroups = isChurchManager
        ? allItems
        : allItems.filter((g) => rolesMap[g.id] !== undefined);

      setServiceGroups(visibleGroups);

      setSelectedServiceGroupId((prev) => {
        if (prev && visibleGroups.some((g) => g.id === prev)) return prev;

        const urlGroup = parseCurrentRoute().filters.serviceGroupId;
        if (urlGroup && visibleGroups.some((g) => g.id === urlGroup)) return urlGroup;

        const cachedGroup = getFilterFromStorage('serviceGroupId');
        if (cachedGroup && visibleGroups.some((g) => g.id === cachedGroup)) return cachedGroup;

        return null;
      });
    });

    return () => {
      unsubscribeYears();
      unsubscribeGroups();
    };
  }, [selectedChurchId, churches, isGlobalAdmin, churchRolesMap, user]);

  // 3. Listen to Classes for the selected church (respecting 3-tier group access)
  useEffect(() => {
    if (!selectedChurchId) {
      setClasses([]);
      return;
    }

    const classesRef = collection(db, 'churches', selectedChurchId, 'classes');
    const unsubscribeClasses = onSnapshot(classesRef, (snapshot) => {
      const userEmail = (user?.email || '').toLowerCase().trim();
      const isChurchManager = isGlobalAdmin || churchRolesMap[selectedChurchId] === 'Admin' || churchRolesMap[selectedChurchId] === 'owner';

      const items: DropdownItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const yearsMap = data.academicYears || {};
        const yearData = selectedAcademicYearId ? yearsMap[selectedAcademicYearId] : Object.values(yearsMap)[0];
        const resolvedName = (yearData as any)?.displayName || (yearData as any)?.name || docSnap.id;
        const serviceGroupId = (yearData as any)?.serviceGroupId || data.serviceGroupId;
        const misters = (yearData as any)?.Misters || {};
        const mistersIds = ((yearData as any)?.MistersIds || []).map((e: string) => e.toLowerCase().trim());
        const isMister = Object.keys(misters).map((e) => e.toLowerCase().trim()).includes(userEmail) || mistersIds.includes(userEmail);

        return {
          id: docSnap.id,
          displayName: resolvedName,
          data: {
            serviceGroupId,
            gradeId: (yearData as any)?.gradeId || data.gradeLevelId,
            isClassMister: isMister,
            academicYears: yearsMap,
          },
        };
      });

      // Filter: servants not in the group have NO access to the class
      const accessibleClasses = isChurchManager
        ? items
        : items.filter((c) => c.data?.serviceGroupId && userGroupRoles[c.data.serviceGroupId] !== undefined);

      // Filter classes by selected service group if specified
      const currentClasses = selectedServiceGroupId
        ? accessibleClasses.filter((c) => c.data?.serviceGroupId === selectedServiceGroupId)
        : accessibleClasses;

      setClasses(currentClasses);

      setSelectedClassId((prev) => {
        if (prev && currentClasses.some((c) => c.id === prev)) return prev;

        const urlClass = parseCurrentRoute().filters.classId;
        if (urlClass && currentClasses.some((c) => c.id === urlClass)) return urlClass;

        const cachedClass = getFilterFromStorage('classId');
        if (cachedClass && currentClasses.some((c) => c.id === cachedClass)) return cachedClass;

        return null;
      });
    });

    return () => unsubscribeClasses();
  }, [selectedChurchId, selectedAcademicYearId, selectedServiceGroupId, isGlobalAdmin, churchRolesMap, userGroupRoles, user]);

  // Synchronize filter selections with localStorage and URL query string
  useEffect(() => {
    if (!selectedChurchId) return;

    saveFilterToStorage('churchId', selectedChurchId);
    saveFilterToStorage('academicYearId', selectedAcademicYearId);
    saveFilterToStorage('serviceGroupId', selectedServiceGroupId);
    saveFilterToStorage('classId', selectedClassId);

    const currentTab = parseCurrentRoute().tab;
    syncRouteToUrl(currentTab, {
      churchId: selectedChurchId,
      academicYearId: selectedAcademicYearId,
      serviceGroupId: selectedServiceGroupId,
      classId: selectedClassId,
    }, false);
  }, [selectedChurchId, selectedAcademicYearId, selectedServiceGroupId, selectedClassId]);

  // Synchronize filters when URL hash changes externally (e.g. Back/Forward button)
  useEffect(() => {
    const handleHashChange = () => {
      const { filters } = parseCurrentRoute();
      if (filters.churchId && filters.churchId !== selectedChurchId) {
        if (churches.some((c) => c.id === filters.churchId)) {
          setSelectedChurchId(filters.churchId);
        }
      }
      if (filters.academicYearId && filters.academicYearId !== selectedAcademicYearId) {
        if (academicYears.some((y) => y.id === filters.academicYearId)) {
          setSelectedAcademicYearId(filters.academicYearId);
        }
      }
      if (filters.serviceGroupId !== undefined && filters.serviceGroupId !== selectedServiceGroupId) {
        if (!filters.serviceGroupId || serviceGroups.some((g) => g.id === filters.serviceGroupId)) {
          setSelectedServiceGroupId(filters.serviceGroupId || null);
        }
      }
      if (filters.classId !== undefined && filters.classId !== selectedClassId) {
        if (!filters.classId || classes.some((c) => c.id === filters.classId)) {
          setSelectedClassId(filters.classId || null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [churches, academicYears, serviceGroups, classes, selectedChurchId, selectedAcademicYearId, selectedServiceGroupId, selectedClassId]);

  const setChurch = (id: string) => {
    setSelectedChurchId(id);
    setSelectedAcademicYearId(null);
    setSelectedServiceGroupId(null);
    setSelectedClassId(null);
  };

  const setAcademicYear = (id: string) => {
    setSelectedAcademicYearId(id);
  };

  const setServiceGroup = (id: string | null) => {
    setSelectedServiceGroupId(id);
    setSelectedClassId(null);
  };

  const setClass = (id: string | null) => {
    setSelectedClassId(id);
  };

  const activeUserRole: UserRole = isGlobalAdmin
    ? 'owner'
    : selectedChurchId
    ? churchRolesMap[selectedChurchId] || 'viewer'
    : 'viewer';

  const canEditClass = (classId: string): boolean => {
    if (isGlobalAdmin) return true;
    if (selectedChurchId && (churchRolesMap[selectedChurchId] === 'Admin' || churchRolesMap[selectedChurchId] === 'owner')) return true;
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return false;
    const groupId = targetClass.data?.serviceGroupId;
    if (groupId && userGroupRoles[groupId] === 'admin') return true;
    if (targetClass.data?.isClassMister) return true;
    return false;
  };

  const canViewClass = (classId: string): boolean => {
    if (canEditClass(classId)) return true;
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return false;
    const groupId = targetClass.data?.serviceGroupId;
    return !!(groupId && userGroupRoles[groupId] !== undefined);
  };

  return (
    <FilterContext.Provider
      value={{
        selectedChurchId,
        selectedAcademicYearId,
        selectedServiceGroupId,
        selectedClassId,
        churches,
        academicYears,
        serviceGroups,
        classes,
        isLoading,
        userRole: activeUserRole,
        userGroupRoles,
        canEditClass,
        canViewClass,
        setChurch,
        setAcademicYear,
        setServiceGroup,
        setClass,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export function useFilter(): FilterContextType {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
