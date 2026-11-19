import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { ProfilePhotoUploader } from '../components/common/ProfilePhotoUploader';
import { GoogleContactsSyncModal } from '../components/kids/GoogleContactsSyncModal';
import { BulkAssignmentModal } from '../components/kids/BulkAssignmentModal';
import { SmartImportModal } from '../components/kids/SmartImportModal';
import { PrintIdCardsModal } from '../components/kids/PrintIdCardsModal';
import { MobileViewToggle } from '../components/common/MobileViewToggle';
import { normalizePhoneNumber } from '../services/googleContacts';
import { normalizeDateStr, safeRender, sanitizeExcelCell } from '../utils/formatters';
import { useModalEscape } from '../utils/useModalEscape';
import { exportKidsToVCard } from '../utils/vcardExport';
import { 
  parseGeoCoordinates, 
  captureDeviceGpsLocation, 
  getUniversalNavigationUrl, 
  normalizeGeoInput 
} from '../utils/geo';
import type { Kid, ClassDoc, KidVersion } from '../types';
import { 
  Plus, 
  Phone, 
  MessageSquare, 
  BookUser, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  X, 
  Layers,
  RefreshCw,
  Users,
  Navigation,
  UserMinus,
  Contact,
  IdCard,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckSquare,
  Square,
  MoreHorizontal
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const KidsDirectoryScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate, mobileViewMode } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId, 
    churches, 
    classes, 
    serviceGroups, 
    academicYears,
    canEditClass,
    canViewClass,
    userGroupRoles 
  } = useFilter();

  const [kids, setKids] = useState<Kid[]>([]);
  const [classesList, setClassesList] = useState<ClassDoc[]>([]);

  // 5 Foldable Column Groups state:
  // Note: fullName is permanently visible / fixed (cannot be folded/hidden)!
  const [foldAssignments, setFoldAssignments] = useState(false);
  const [foldProfile, setFoldProfile] = useState(false);
  const [foldAddress, setFoldAddress] = useState(true);
  const [foldContacts, setFoldContacts] = useState(false);
  const [foldNotes, setFoldNotes] = useState(true);

  // Multi-select state
  const [selectedKidIds, setSelectedKidIds] = useState<string[]>([]);

  // Header Filtering Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [displayLimit, setDisplayLimit] = useState(60);

  // Mobile Search & Ministry Quick Filter state
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileQuickFilter, setMobileQuickFilter] = useState<string>('all');
  const [expandedKidDetails, setExpandedKidDetails] = useState<Record<string, boolean>>({});

  // Reset mobile quick filter when service group or class filter changes
  useEffect(() => {
    setMobileQuickFilter('all');
  }, [selectedServiceGroupId, selectedClassId]);

  // Available classes in currently selected Service Group (for dynamic quick-filter chips)
  const availableClassesInGroup = useMemo(() => {
    if (!selectedServiceGroupId) return [];
    return classesList.filter((c) => {
      const yearData = selectedAcademicYearId ? c.academicYears?.[selectedAcademicYearId] : Object.values(c.academicYears || {})[0];
      return yearData?.serviceGroupId === selectedServiceGroupId;
    });
  }, [classesList, selectedServiceGroupId, selectedAcademicYearId]);

  // Modals
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [mobileActionsSheetOpen, setMobileActionsSheetOpen] = useState(false);
  const [kidsToPrint, setKidsToPrint] = useState<Kid[]>([]);
  const [activeKid, setActiveKid] = useState<Kid | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';
  const isChurchAdminOrOwner = isAdmin;

  const canManageKid = (kid: Kid) => {
    if (isChurchAdminOrOwner) return true;
    const kidClassId = kid.activeAssignment?.classId;
    if (!kidClassId) return false;
    return canEditClass(kidClassId);
  };

  const canSeeKid = (kid: Kid) => {
    if (isChurchAdminOrOwner) return true;
    const kidClassId = kid.activeAssignment?.classId;
    if (!kidClassId) return false;
    return canViewClass(kidClassId);
  };

  const canAddStudent = isChurchAdminOrOwner || classes.some((c) => canEditClass(c.id));
  const canBulkReassign = Boolean(isChurchAdminOrOwner || (selectedServiceGroupId && userGroupRoles[selectedServiceGroupId] === 'admin'));
  const canBulkDelete = Boolean(isChurchAdminOrOwner);

  const handleRemoveFromClass = async (kid: Kid) => {
    if (!selectedChurchId || !canManageKid(kid)) return;
    if (!window.confirm(translate('remove_from_class_confirm'))) return;

    const oldClassId = kid.activeAssignment?.classId;
    const yearId = kid.activeAssignment?.academicYearId || selectedAcademicYearId;

    const kidRef = doc(db, 'churches', selectedChurchId, 'kids', kid.id);
    await setDoc(kidRef, {
      activeAssignment: {
        ...kid.activeAssignment,
        classId: '',
      },
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
    }, { merge: true });

    if (oldClassId && yearId) {
      try {
        const classRef = doc(db, 'churches', selectedChurchId, 'classes', oldClassId);
        const snap = await getDoc(classRef);
        if (snap.exists()) {
          const data = snap.data();
          const yearsMap = data.academicYears || {};
          const yData = yearsMap[yearId] || {};
          const curIds: string[] = yData.KidIds || yData.kids || [];
          const filtered = curIds.filter((id) => id !== kid.id);
          await setDoc(classRef, {
            academicYears: {
              ...yearsMap,
              [yearId]: { ...yData, KidIds: filtered, kids: filtered },
            },
          }, { merge: true });
        }
      } catch (err) {
        console.warn('Could not remove kid from class doc:', err);
      }
    }
  };

  useModalEscape(() => setBulkDeleteConfirmOpen(false), bulkDeleteConfirmOpen);
  useModalEscape(() => setBulkModalOpen(false), bulkModalOpen && !bulkDeleteConfirmOpen);
  useModalEscape(() => setImportModalOpen(false), importModalOpen);
  useModalEscape(() => setSyncModalOpen(false), syncModalOpen);
  useModalEscape(() => setEditModalOpen(false), editModalOpen && !bulkModalOpen && !importModalOpen && !syncModalOpen && !bulkDeleteConfirmOpen);

  // 1. Listen to Kids
  useEffect(() => {
    if (!selectedChurchId) return;

    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'kids'), (snapshot) => {
      const items: Kid[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          active: d.active !== false,
          activeAssignment: d.activeAssignment || {
            academicYearId: d.academicYearId,
            serviceGroupId: d.serviceGroupId,
            classId: d.classId,
          },
          info: {
            fullName: String(d.info?.fullName || d.fullName || 'Unknown'),
            gender: (d.info?.gender || d.gender || 'male') as 'male' | 'female',
            dob: normalizeDateStr(d.info?.dob || d.dob),
            school: String(d.info?.school || d.school || ''),
            schoolType: d.info?.schoolType || d.schoolType || '',
            deacon: typeof d.info?.deacon === 'boolean' ? d.info.deacon : typeof d.deacon === 'boolean' ? d.deacon : undefined,
            fatherOfConfession: String(d.info?.fatherOfConfession || d.fatherOfConfession || ''),
            photoUrl: d.info?.photoUrl || d.photoUrl || '',
          },
          address: {
            ...(d.address || {}),
            landmark: d.address?.landmark || d.landmark || '',
            geoLocation: d.address?.geoLocation || d.geoLocation || '',
          },
          contacts: {
            ...(d.contacts || {}),
            fatherDOB: normalizeDateStr(d.contacts?.fatherDOB || d.fatherDOB),
            motherDOB: normalizeDateStr(d.contacts?.motherDOB || d.motherDOB),
          },
          notes: typeof d.notes === 'string' ? d.notes : '',
          versions: d.versions || {},
          createdAt: d.createdAt,
          createdBy: d.createdBy,
          lastEditAt: d.lastEditAt,
          lastEditBy: d.lastEditBy,
        };
      });
      setKids(items);
    });

    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to classes
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'classes'), (snap) => {
      setClassesList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassDoc)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // Resolve assignment names
  const resolveYearName = (yearId?: string) => academicYears.find((y) => y.id === yearId)?.displayName || yearId || '-';
  const resolveGroupName = (groupId?: string) => serviceGroups.find((g) => g.id === groupId)?.displayName || groupId || '-';
  const resolveClassName = (classId?: string) => {
    const c = classesList.find((cls) => cls.id === classId);
    if (!c) return classId || '-';
    const yearData = selectedAcademicYearId ? c.academicYears?.[selectedAcademicYearId] : Object.values(c.academicYears || {})[0];
    return yearData?.displayName || yearData?.name || c.id;
  };

  // Build dynamic FilterConfigs matching requested column order:
  // 1. active, 2. fullName (permanently visible), 3. Assignments, 4. Profile, 5. Address, 6. Contacts, 7. Notes
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'fullName', type: 'text', placeholder: `${translate('search')} ${translate('student_full_name')}...` },
    // Assignments Group
    ...(!foldAssignments ? [
      { key: 'year', type: 'text', placeholder: `${translate('search')} ${translate('academic_year')}...` } as ColumnFilterConfig,
      { key: 'group', type: 'text', placeholder: `${translate('search')} ${translate('service_group')}...` } as ColumnFilterConfig,
      { key: 'class', type: 'text', placeholder: `${translate('search')} ${translate('class_label')}...` } as ColumnFilterConfig,
    ] : []),
    // Profile Group (Gender, DOB, School, School Type, Deacon, Father of Confession)
    ...(!foldProfile ? [
      { key: 'gender', type: 'select', options: [
        { value: 'male', label: translate('male') }, 
        { value: 'female', label: translate('female') },
        { value: 'empty', label: `⚠️ ${translate('filter_empty')}` }
      ] } as ColumnFilterConfig,
      { key: 'dob', type: 'text', placeholder: `${translate('search')} ${translate('dob')}...` } as ColumnFilterConfig,
      { key: 'school', type: 'text', placeholder: `${translate('search')} ${translate('school')}...` } as ColumnFilterConfig,
      { key: 'schoolType', type: 'select', options: [
        { value: 'National', label: translate('school_type_national') }, 
        { value: 'International', label: translate('school_type_international') }, 
        { value: 'other', label: translate('school_type_other') },
        { value: 'empty', label: `⚠️ ${translate('filter_empty')}` }
      ] } as ColumnFilterConfig,
      { key: 'deacon', type: 'select', options: [
        { value: 'true', label: `${translate('deacon')} (${translate('yes')})` }, 
        { value: 'false', label: translate('no') }
      ] } as ColumnFilterConfig,
      { key: 'fatherOfConfession', type: 'text', placeholder: `${translate('search')} ${translate('father_of_confession')}...` } as ColumnFilterConfig,
    ] : []),
    // Address Group
    ...(!foldAddress ? [
      { key: 'street', type: 'text', placeholder: `${translate('search')} ${translate('street')}...` } as ColumnFilterConfig,
      { key: 'building', type: 'text', placeholder: `${translate('search')} ${translate('building')}...` } as ColumnFilterConfig,
      { key: 'floor', type: 'text', placeholder: `${translate('search')} ${translate('floor')}...` } as ColumnFilterConfig,
      { key: 'apartment', type: 'text', placeholder: `${translate('search')} ${translate('apartment')}...` } as ColumnFilterConfig,
      { key: 'region', type: 'text', placeholder: `${translate('search')} ${translate('region')}...` } as ColumnFilterConfig,
      { key: 'landmark', type: 'text', placeholder: `${translate('search')} ${translate('landmark')}...` } as ColumnFilterConfig,
    ] : []),
    // Contacts Group
    ...(!foldContacts ? [
      { key: 'kidMob', type: 'text', placeholder: `${translate('search')} ${translate('kid_mobile')}...` } as ColumnFilterConfig,
      { key: 'fatherName', type: 'text', placeholder: `${translate('search')} ${translate('father_name')}...` } as ColumnFilterConfig,
      { key: 'fatherProfession', type: 'text', placeholder: `${translate('search')} ${translate('father_job')}...` } as ColumnFilterConfig,
      { key: 'fatherMob', type: 'text', placeholder: `${translate('search')} ${translate('father_mobile')}...` } as ColumnFilterConfig,
      { key: 'fatherDOB', type: 'text', placeholder: `${translate('search')} ${translate('father_dob')}...` } as ColumnFilterConfig,
      { key: 'motherName', type: 'text', placeholder: `${translate('search')} ${translate('mother_name')}...` } as ColumnFilterConfig,
      { key: 'motherProfession', type: 'text', placeholder: `${translate('search')} ${translate('mother_job')}...` } as ColumnFilterConfig,
      { key: 'motherMob', type: 'text', placeholder: `${translate('search')} ${translate('mother_mobile')}...` } as ColumnFilterConfig,
      { key: 'motherDOB', type: 'text', placeholder: `${translate('search')} ${translate('mother_dob')}...` } as ColumnFilterConfig,
      { key: 'otherMob', type: 'text', placeholder: `${translate('search')} ${translate('other_mobile')}...` } as ColumnFilterConfig,
    ] : []),
    // Notes Group
    ...(!foldNotes ? [
      { key: 'notes', type: 'text', placeholder: `${translate('search')} ${translate('pastoral_notes')}...` } as ColumnFilterConfig,
    ] : []),
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Filtered Kids: respects Top Cascading Filters AND Header Filter Matrix
  const filteredKids = kids.filter((kid) => {
    // 0. Permission check: Class teachers and group servants only see students they are authorized for
    if (!canSeeKid(kid)) return false;

    const asgn = kid.activeAssignment || {};

    // Top Filter: Academic Year
    if (selectedAcademicYearId && asgn.academicYearId && asgn.academicYearId !== selectedAcademicYearId) {
      return false;
    }

    // Top Filter: Service Group
    if (selectedServiceGroupId && asgn.serviceGroupId && asgn.serviceGroupId !== selectedServiceGroupId) {
      return false;
    }

    // Top Filter: Class
    if (selectedClassId && asgn.classId && asgn.classId !== selectedClassId) {
      return false;
    }

    // Mobile-Specific Filters (Instant Quick Search & Quick Filter Chips)
    if (mobileSearchQuery.trim()) {
      const q = mobileSearchQuery.toLowerCase().trim();
      const matchName = (kid.info?.fullName || '').toLowerCase().includes(q);
      const matchFather = (kid.contacts?.fatherName || '').toLowerCase().includes(q);
      const matchMother = (kid.contacts?.motherName || '').toLowerCase().includes(q);
      const matchFatherPhone = (kid.contacts?.fatherMob || '').includes(q);
      const matchMotherPhone = (kid.contacts?.motherMob || '').includes(q);
      const matchKidPhone = (kid.contacts?.kidMob || '').includes(q);
      const matchSchool = (kid.info?.school || '').toLowerCase().includes(q);
      const matchRegion = (kid.address?.region || '').toLowerCase().includes(q);
      const matchConfession = (kid.info?.fatherOfConfession || '').toLowerCase().includes(q);
      if (!matchName && !matchFather && !matchMother && !matchFatherPhone && !matchMotherPhone && !matchKidPhone && !matchSchool && !matchRegion && !matchConfession) {
        return false;
      }
    }

    // Mobile Ministry & Dynamic Class Quick Filters
    if (mobileQuickFilter.startsWith('class:')) {
      const targetClassId = mobileQuickFilter.replace('class:', '');
      if (asgn.classId !== targetClassId && kid.classId !== targetClassId) return false;
    } else if (mobileQuickFilter === 'deacon') {
      if (!kid.info?.deacon) return false;
    } else if (mobileQuickFilter === 'birthdays') {
      const dobStr = normalizeDateStr(kid.info?.dob);
      if (!dobStr) return false;
      const parts = dobStr.split('-');
      const dobMonth = parseInt(parts[1], 10);
      const currentMonth = new Date().getMonth() + 1;
      if (dobMonth !== currentMonth) return false;
    } else if (mobileQuickFilter === 'missing_phone') {
      const hasPhone = Boolean(
        kid.contacts?.fatherMob?.trim() ||
        kid.contacts?.motherMob?.trim() ||
        kid.contacts?.kidMob?.trim() ||
        kid.contacts?.otherMob?.trim()
      );
      if (hasPhone) return false;
    }

    // Text filter matching helper supporting 'empty' / 'بدون' / 'فارغ' keywords
    const matchesTextFilter = (val: string | undefined | null, filterQuery?: string): boolean => {
      if (!filterQuery) return true;
      const q = filterQuery.trim().toLowerCase();
      if (!q) return true;
      if (q === 'empty' || q === 'بدون' || q === 'فارغ') {
        return !val || val.trim() === '';
      }
      return (val || '').toLowerCase().includes(q);
    };

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      const isKidActive = kid.active !== false;
      if (String(isKidActive) !== filters.active) return false;
    }
    if (filters.fullName) {
      if (!matchesTextFilter(kid.info?.fullName, filters.fullName)) return false;
    }
    if (filters.year) {
      if (!matchesTextFilter(resolveYearName(asgn.academicYearId), filters.year)) return false;
    }
    if (filters.group) {
      if (!matchesTextFilter(resolveGroupName(asgn.serviceGroupId), filters.group)) return false;
    }
    if (filters.class) {
      if (!matchesTextFilter(asgn.classId ? resolveClassName(asgn.classId) : '', filters.class)) return false;
    }
    if (filters.gender) {
      if (filters.gender === 'empty') {
        if (kid.info?.gender && String(kid.info.gender).trim() !== '') return false;
      } else {
        if (kid.info?.gender !== filters.gender) return false;
      }
    }
    if (filters.dob) {
      if (!matchesTextFilter(kid.info?.dob, filters.dob)) return false;
    }
    if (filters.school) {
      if (!matchesTextFilter(kid.info?.school, filters.school)) return false;
    }
    if (filters.schoolType) {
      if (filters.schoolType === 'empty') {
        if (kid.info?.schoolType && kid.info.schoolType.trim() !== '') return false;
      } else if (filters.schoolType === 'other') {
        const st = (kid.info?.schoolType || '').toLowerCase();
        if (st === 'national' || st === 'international' || !st) return false;
      } else {
        if ((kid.info?.schoolType || '').toLowerCase() !== filters.schoolType.toLowerCase()) return false;
      }
    }
    if (filters.deacon !== undefined && filters.deacon !== '') {
      const isDeacon = filters.deacon === 'true' || filters.deacon === 'yes';
      if (Boolean(kid.info?.deacon) !== isDeacon) return false;
    }
    if (filters.fatherOfConfession) {
      if (!matchesTextFilter(kid.info?.fatherOfConfession, filters.fatherOfConfession)) return false;
    }
    if (filters.street) {
      if (!matchesTextFilter(kid.address?.street, filters.street)) return false;
    }
    if (filters.building) {
      if (!matchesTextFilter(kid.address?.building, filters.building)) return false;
    }
    if (filters.floor) {
      if (!matchesTextFilter(kid.address?.floor, filters.floor)) return false;
    }
    if (filters.apartment) {
      if (!matchesTextFilter(kid.address?.apartment, filters.apartment)) return false;
    }
    if (filters.region) {
      if (!matchesTextFilter(kid.address?.region, filters.region)) return false;
    }
    if (filters.landmark) {
      if (!matchesTextFilter(kid.address?.landmark, filters.landmark)) return false;
    }
    if (filters.kidMob) {
      if (!matchesTextFilter(kid.contacts?.kidMob, filters.kidMob)) return false;
    }
    if (filters.fatherName) {
      if (!matchesTextFilter(kid.contacts?.fatherName, filters.fatherName)) return false;
    }
    if (filters.fatherProfession) {
      if (!matchesTextFilter(kid.contacts?.fatherProfession, filters.fatherProfession)) return false;
    }
    if (filters.fatherMob) {
      if (!matchesTextFilter(kid.contacts?.fatherMob, filters.fatherMob)) return false;
    }
    if (filters.fatherDOB) {
      if (!matchesTextFilter(kid.contacts?.fatherDOB, filters.fatherDOB)) return false;
    }
    if (filters.motherName) {
      if (!matchesTextFilter(kid.contacts?.motherName, filters.motherName)) return false;
    }
    if (filters.motherProfession) {
      if (!matchesTextFilter(kid.contacts?.motherProfession, filters.motherProfession)) return false;
    }
    if (filters.motherMob) {
      if (!matchesTextFilter(kid.contacts?.motherMob, filters.motherMob)) return false;
    }
    if (filters.motherDOB) {
      if (!matchesTextFilter(kid.contacts?.motherDOB, filters.motherDOB)) return false;
    }
    if (filters.otherMob) {
      if (!matchesTextFilter(kid.contacts?.otherMob, filters.otherMob)) return false;
    }
    if (filters.notes) {
      if (!matchesTextFilter(kid.notes, filters.notes)) return false;
    }

    return true;
  });

  // Multi-select helpers
  const allFilteredSelected = filteredKids.length > 0 && filteredKids.every((k) => selectedKidIds.includes(k.id));
  const displayedKids = filteredKids.slice(0, displayLimit);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedKidIds([]);
    } else {
      setSelectedKidIds(filteredKids.map((k) => k.id));
    }
  };

  const toggleSelectKid = (kidId: string) => {
    if (selectedKidIds.includes(kidId)) {
      setSelectedKidIds(selectedKidIds.filter((id) => id !== kidId));
    } else {
      setSelectedKidIds([...selectedKidIds, kidId]);
    }
  };

  // Save Add/Edit Kid with version audit trail and E.164 phone formatting
  const handleSaveKid = async (kidData: Partial<Kid>) => {
    if (!selectedChurchId) return;

    const docId = activeKid ? activeKid.id : (kidData.info?.fullName?.trim().toLowerCase().replace(/\s+/g, '_') || `kid_${Date.now()}`);
    const kidRef = doc(db, 'churches', selectedChurchId, 'kids', docId);

    // Normalize all contacts phone numbers to international E.164
    const normalizedContacts = {
      ...kidData.contacts,
      kidMob: normalizePhoneNumber(kidData.contacts?.kidMob),
      fatherMob: normalizePhoneNumber(kidData.contacts?.fatherMob),
      motherMob: normalizePhoneNumber(kidData.contacts?.motherMob),
      otherMob: normalizePhoneNumber(kidData.contacts?.otherMob),
    };

    // Version tracking audit trail (changes map, editAt, editBy)
    const existingVersions = activeKid?.versions || {};
    const versionKey = `v_${Date.now()}`;
    const newVersion: KidVersion = {
      changes: {
        info: kidData.info,
        contacts: normalizedContacts,
        address: kidData.address,
        activeAssignment: kidData.activeAssignment,
      },
      editAt: new Date().toISOString(),
      editBy: user?.email || 'unknown',
    };

    const payload = {
      ...kidData,
      contacts: normalizedContacts,
      active: true,
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
      versions: {
        ...existingVersions,
        [versionKey]: newVersion,
      },
      ...(!activeKid && {
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      }),
    };

    await setDoc(kidRef, payload, { merge: true });

    // Sync class document's KidIds
    const oldClassId = activeKid?.activeAssignment?.classId;
    const newClassId = kidData.activeAssignment?.classId;
    const targetYearId = kidData.activeAssignment?.academicYearId || selectedAcademicYearId;

    if (targetYearId && oldClassId !== newClassId) {
      // 1. Remove from old class
      if (oldClassId) {
        try {
          const oldClassRef = doc(db, 'churches', selectedChurchId, 'classes', oldClassId);
          const oldSnap = await getDoc(oldClassRef);
          if (oldSnap.exists()) {
            const data = oldSnap.data();
            const yearsMap = data.academicYears || {};
            const yData = yearsMap[targetYearId] || {};
            const curIds: string[] = yData.KidIds || yData.kids || [];
            const filtered = curIds.filter((id) => id !== docId);
            await setDoc(oldClassRef, {
              academicYears: {
                ...yearsMap,
                [targetYearId]: { ...yData, KidIds: filtered, kids: filtered },
              },
            }, { merge: true });
          }
        } catch (err) {
          console.warn('Could not update old class during kid edit:', err);
        }
      }

      // 2. Add to new class
      if (newClassId) {
        try {
          const newClassRef = doc(db, 'churches', selectedChurchId, 'classes', newClassId);
          const newSnap = await getDoc(newClassRef);
          if (newSnap.exists()) {
            const data = newSnap.data();
            const yearsMap = data.academicYears || {};
            const yData = yearsMap[targetYearId] || {};
            const curIds: string[] = yData.KidIds || yData.kids || [];
            const merged = Array.from(new Set([...curIds, docId]));
            await setDoc(newClassRef, {
              academicYears: {
                ...yearsMap,
                [targetYearId]: { ...yData, KidIds: merged, kids: merged },
              },
            }, { merge: true });
          }
        } catch (err) {
          console.warn('Could not update new class during kid edit:', err);
        }
      }
    }

    setEditModalOpen(false);
    setActiveKid(null);
  };

  const handleDeleteKid = async (kidId: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Delete student "${name}"? This action cannot be undone.`)) {
      const kid = kids.find((k) => k.id === kidId);
      const classId = kid?.activeAssignment?.classId;
      const yearId = kid?.activeAssignment?.academicYearId || selectedAcademicYearId;

      await deleteDoc(doc(db, 'churches', selectedChurchId, 'kids', kidId));

      if (classId && yearId) {
        try {
          const classRef = doc(db, 'churches', selectedChurchId, 'classes', classId);
          const classSnap = await getDoc(classRef);
          if (classSnap.exists()) {
            const data = classSnap.data();
            const yearsMap = data.academicYears || {};
            const yData = yearsMap[yearId] || {};
            const curIds: string[] = yData.KidIds || yData.kids || [];
            const filtered = curIds.filter((id) => id !== kidId);
            await setDoc(classRef, {
              academicYears: {
                ...yearsMap,
                [yearId]: { ...yData, KidIds: filtered, kids: filtered },
              },
            }, { merge: true });
          }
        } catch (err) {
          console.warn('Could not remove kid from class during delete:', err);
        }
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedChurchId || !isAdmin || selectedKidIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const batchSize = 400;
      let _deletedCount = 0;
      for (let i = 0; i < selectedKidIds.length; i += batchSize) {
        const chunk = selectedKidIds.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((kId) => {
          const kidRef = doc(db, 'churches', selectedChurchId, 'kids', kId);
          batch.delete(kidRef);
          _deletedCount++;
        });
        await batch.commit();
      }

      // Sync class documents to remove deleted kids
      const impactedClasses = new Set<string>();
      kids.filter((k) => selectedKidIds.includes(k.id)).forEach((k) => {
        if (k.activeAssignment?.classId) impactedClasses.add(k.activeAssignment.classId);
      });

      await Promise.all(
        Array.from(impactedClasses).map(async (cId) => {
          try {
            const classRef = doc(db, 'churches', selectedChurchId, 'classes', cId);
            const snap = await getDoc(classRef);
            if (snap.exists()) {
              const data = snap.data();
              const yearsMap = { ...(data.academicYears || {}) };
              let changed = false;
              Object.keys(yearsMap).forEach((yId) => {
                const yData = yearsMap[yId] || {};
                const curIds: string[] = yData.KidIds || yData.kids || [];
                const filtered = curIds.filter((id) => !selectedKidIds.includes(id));
                if (filtered.length !== curIds.length) {
                  yearsMap[yId] = { ...yData, KidIds: filtered, kids: filtered };
                  changed = true;
                }
              });
              if (changed) {
                await setDoc(classRef, { academicYears: yearsMap }, { merge: true });
              }
            }
          } catch (err) {
            console.warn('Could not update class during bulk delete:', err);
          }
        })
      );

      setSelectedKidIds([]);
      setBulkDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert(`Error deleting students: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleExportExcel = () => {
    const rows = filteredKids.map((k) => ({
      'Active': k.active ? 'Yes' : 'No',
      'Full Name': sanitizeExcelCell(k.info.fullName),
      'Year': sanitizeExcelCell(resolveYearName(k.activeAssignment?.academicYearId)),
      'Group': sanitizeExcelCell(resolveGroupName(k.activeAssignment?.serviceGroupId)),
      'Class': sanitizeExcelCell(resolveClassName(k.activeAssignment?.classId)),
      'Gender': sanitizeExcelCell(k.info.gender),
      'DOB': sanitizeExcelCell(k.info.dob || ''),
      'School': sanitizeExcelCell(k.info.school || ''),
      'School Type': sanitizeExcelCell(k.info.schoolType || ''),
      'Deacon': k.info.deacon ? 'Yes' : 'No',
      'Father of Confession': sanitizeExcelCell(k.info.fatherOfConfession || ''),
      'Street': sanitizeExcelCell(k.address?.street || ''),
      'Building': sanitizeExcelCell(k.address?.building || ''),
      'Floor': sanitizeExcelCell(k.address?.floor || ''),
      'Apartment': sanitizeExcelCell(k.address?.apartment || ''),
      'Region': sanitizeExcelCell(k.address?.region || ''),
      'Landmark': sanitizeExcelCell(k.address?.landmark || ''),
      'GPS Location': sanitizeExcelCell(k.address?.geoLocation || ''),
      'Kid Mobile': sanitizeExcelCell(k.contacts?.kidMob || ''),
      'Father Name': sanitizeExcelCell(k.contacts?.fatherName || ''),
      'Father Profession': sanitizeExcelCell(k.contacts?.fatherProfession || ''),
      'Father Mobile': sanitizeExcelCell(k.contacts?.fatherMob || ''),
      'Father DOB': sanitizeExcelCell(k.contacts?.fatherDOB || ''),
      'Mother Name': sanitizeExcelCell(k.contacts?.motherName || ''),
      'Mother Profession': sanitizeExcelCell(k.contacts?.motherProfession || ''),
      'Mother Mobile': sanitizeExcelCell(k.contacts?.motherMob || ''),
      'Mother DOB': sanitizeExcelCell(k.contacts?.motherDOB || ''),
      'Other Mobile': sanitizeExcelCell(k.contacts?.otherMob || ''),
      'Photo URL': sanitizeExcelCell(k.info.photoUrl || ''),
      'Notes': sanitizeExcelCell(k.notes || ''),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kids Roster');
    XLSX.writeFile(workbook, `Oikonomos_Kids_${selectedChurchId}.xlsx`);
  };

  const activeChurchName = churches.find((c) => c.id === selectedChurchId)?.displayName || 'Church';
  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'All Classes';
  const activeYearName = academicYears.find((y) => y.id === selectedAcademicYearId)?.displayName || 'Term';

  const handleExportVCard = () => {
    exportKidsToVCard(filteredKids, activeChurchName, activeClassName, activeYearName);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('kids')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredKids.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {translate('kids_subtitle')}
          </p>
        </div>

        {/* Desktop Action Buttons Toolbar (>= sm) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {/* Smart Excel / CSV Import (Option 3 Hybrid AI) */}
          {isAdmin && (
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{translate('import_excel')}</span>
            </button>
          )}

          {/* Sync to Google Contacts (Star Feature) */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition shadow-md shadow-teal-600/20 cursor-pointer"
          >
            <BookUser className="w-4 h-4" />
            <span>{translate('sync_contacts')}</span>
          </button>

          {/* Grouped Export Split Button (Excel & vCard) */}
          <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xs overflow-hidden divide-x divide-zinc-200 dark:divide-zinc-700 rtl:divide-x-reverse">
            <button
              type="button"
              onClick={handleExportExcel}
              title={translate('export_excel')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>{translate('export_excel_short')}</span>
            </button>
            <button
              type="button"
              onClick={handleExportVCard}
              title={translate('export_vcard')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
            >
              <Contact className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{translate('export_vcard_short')}</span>
            </button>
          </div>

          {/* Print ID Badges Button */}
          <button
            type="button"
            onClick={() => {
              const targets = selectedKidIds.length > 0
                ? filteredKids.filter((k) => selectedKidIds.includes(k.id))
                : filteredKids;
              setKidsToPrint(targets);
              setPrintModalOpen(true);
            }}
            title={translate('print_id_cards')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition cursor-pointer shadow-xs"
          >
            <IdCard className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">{translate('print_id_cards')}</span>
          </button>

          {/* Add Kid */}
          {canAddStudent && (
            <button
              onClick={() => {
                setActiveKid(null);
                setEditModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{translate('add_student')}</span>
            </button>
          )}
        </div>

        {/* Mobile Actions Button & Prominent View Mode Switcher (< sm) */}
        <div className="flex sm:hidden items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={() => setMobileActionsSheetOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 active:scale-95 transition cursor-pointer shadow-2xs"
          >
            <MoreHorizontal className="w-4 h-4" />
            <span>{translate('actions')}</span>
          </button>

          {/* Prominent View Mode Switcher (Tiles vs List) */}
          <MobileViewToggle />
        </div>
      </div>

      {/* 5 Foldable Column Categories Bar (Note: Full Name is permanently visible / fixed) */}
      <div className="hidden md:flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs shadow-xs">
        <span className="font-bold text-zinc-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-teal-600" />
          <span>{translate('foldable_groups')}</span>
        </span>
        <div className="flex items-center gap-2">
          {/* 1. Assignment Group */}
          <button
            onClick={() => setFoldAssignments(!foldAssignments)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldAssignments ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldAssignments ? '[+]' : '[-]'} {translate('assignment_group')}</span>
          </button>

          {/* 2. General Profile Group */}
          <button
            onClick={() => setFoldProfile(!foldProfile)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldProfile ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldProfile ? '[+]' : '[-]'} {translate('profile_group')}</span>
          </button>

          {/* 3. Address Group */}
          <button
            onClick={() => setFoldAddress(!foldAddress)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldAddress ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldAddress ? '[+]' : '[-]'} {translate('address_group')}</span>
          </button>

          {/* 4. Contacts Group */}
          <button
            onClick={() => setFoldContacts(!foldContacts)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldContacts ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldContacts ? '[+]' : '[-]'} {translate('contacts_group')}</span>
          </button>

          {/* 5. Notes Group */}
          <button
            onClick={() => setFoldNotes(!foldNotes)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldNotes ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldNotes ? '[+]' : '[-]'} {translate('notes_group')}</span>
          </button>
        </div>
      </div>

      {/* 1. MOBILE ADAPTIVE TOUCH CARDS (< md) */}
      <div className="md:hidden space-y-3">
        {/* Mobile Quick Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={mobileSearchQuery}
            onChange={(e) => setMobileSearchQuery(e.target.value)}
            placeholder={`${translate('search')} ${translate('student_full_name')}, ${translate('father_name')}, ${translate('phone')}...`}
            className="w-full ps-10 pe-9 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {mobileSearchQuery && (
            <button
              type="button"
              onClick={() => setMobileSearchQuery('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Ministry & Dynamic Class Filter Chips */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 'All' Chip */}
            <button
              type="button"
              onClick={() => setMobileQuickFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                mobileQuickFilter === 'all'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {translate('filter_all') || 'All'}
            </button>

            {/* Dynamic Class Chips when a Service Group is selected and no specific class is chosen */}
            {selectedServiceGroupId && !selectedClassId && availableClassesInGroup.map((cls) => {
              const chipId = `class:${cls.id}`;
              const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
              const label = yearData?.displayName || yearData?.name || cls.id;
              return (
                <button
                  key={chipId}
                  type="button"
                  onClick={() => setMobileQuickFilter(mobileQuickFilter === chipId ? 'all' : chipId)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                    mobileQuickFilter === chipId
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}

            {/* Deacons Chip */}
            <button
              type="button"
              onClick={() => setMobileQuickFilter(mobileQuickFilter === 'deacon' ? 'all' : 'deacon')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                mobileQuickFilter === 'deacon'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
              }`}
            >
              ✠ {translate('filter_deacons') || 'Deacons'}
            </button>

            {/* Birthdays this month Chip */}
            <button
              type="button"
              onClick={() => setMobileQuickFilter(mobileQuickFilter === 'birthdays' ? 'all' : 'birthdays')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                mobileQuickFilter === 'birthdays'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
              }`}
            >
              🎂 {translate('filter_birthdays_month') || 'Birthdays'}
            </button>

            {/* Missing Phone Chip */}
            <button
              type="button"
              onClick={() => setMobileQuickFilter(mobileQuickFilter === 'missing_phone' ? 'all' : 'missing_phone')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                mobileQuickFilter === 'missing_phone'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
              }`}
            >
              📞 {translate('filter_missing_phone') || 'Missing Phone'}
            </button>
          </div>

          {/* Master Select All Button on Mobile */}
          <div className="flex items-center gap-1.5 shrink-0 ms-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                allFilteredSelected
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : selectedKidIds.length > 0
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {allFilteredSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span>{selectedKidIds.length > 0 ? `${selectedKidIds.length}` : 'Select'}</span>
            </button>
          </div>
        </div>

        {mobileViewMode === 'list' ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            {displayedKids.map((kid) => {
              const fatherPhone = kid.contacts?.fatherMob;
              const motherPhone = kid.contacts?.motherMob;
              const kidPhone = kid.contacts?.kidMob;
              const primaryPhone = fatherPhone || motherPhone || kidPhone;
              const isSelected = selectedKidIds.includes(kid.id);

              return (
                <div
                  key={kid.id}
                  className={`flex items-center justify-between p-3 gap-2.5 transition ${
                    isSelected ? 'bg-purple-50/40 dark:bg-purple-950/30' : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSelectKid(kid.id)}
                      className="p-1 -ms-1 text-zinc-400 hover:text-purple-600 shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
                      )}
                    </button>

                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                      {kid.info.photoUrl ? (
                        <img src={kid.info.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className={`w-full h-full flex items-center justify-center font-bold text-xs ${
                          kid.info.gender === 'female' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'
                        }`}>
                          {kid.info.fullName.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div
                      className="min-w-0 cursor-pointer flex-1"
                      onClick={() => {
                        setActiveKid(kid);
                        setEditModalOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {kid.info.fullName}
                        </span>
                        {kid.info.deacon && <span className="text-[10px] text-amber-500 font-bold shrink-0">✠</span>}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {kid.contacts?.fatherName ? `${kid.contacts.fatherName}` : (kid.address?.region || 'Sunday School')}
                        {primaryPhone && ` • ${primaryPhone}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions Strip */}
                  <div className="flex items-center gap-1 shrink-0">
                    {primaryPhone && (
                      <a
                        href={`tel:${primaryPhone}`}
                        className="p-2 rounded-xl text-blue-600 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 active:scale-95 transition"
                        title={translate('phone')}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {primaryPhone && (
                      <a
                        href={`https://wa.me/${String(primaryPhone).replace(/\+/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 active:scale-95 transition"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setKidsToPrint([kid]);
                        setPrintModalOpen(true);
                      }}
                      className="p-2 rounded-xl text-zinc-400 hover:text-teal-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                      title={translate('print_id_badge')}
                    >
                      <IdCard className="w-3.5 h-3.5" />
                    </button>
                    {canManageKid(kid) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveKid(kid);
                          setEditModalOpen(true);
                        }}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                        title={translate('edit')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          displayedKids.map((kid) => {
          const fatherPhone = kid.contacts?.fatherMob;
          const motherPhone = kid.contacts?.motherMob;
          const kidPhone = kid.contacts?.kidMob;
          const primaryPhone = fatherPhone || motherPhone || kidPhone;
          const isSelected = selectedKidIds.includes(kid.id);
          const isExpanded = !!expandedKidDetails[kid.id];

          const fullAddress = [
            kid.address?.building ? `Bldg ${kid.address.building}` : '',
            kid.address?.floor ? `Flr ${kid.address.floor}` : '',
            kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
            kid.address?.street,
            kid.address?.region,
          ].filter(Boolean).join(', ');

          return (
            <div
              key={kid.id}
              className={`p-4 rounded-3xl bg-white dark:bg-zinc-900 border transition shadow-xs space-y-3 ${
                isSelected 
                  ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20 dark:bg-purple-950/20' 
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mobile Selection Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelectKid(kid.id)}
                    className="p-1 -ms-1 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
                    title="Select student"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
                    )}
                  </button>

                  {/* Real Profile Photo Avatar */}
                  <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                    {kid.info.photoUrl ? (
                      <img
                        src={kid.info.photoUrl}
                        alt={kid.info.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-bold text-base ${
                        kid.info.gender === 'female' 
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                          : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'
                      }`}>
                        {kid.info.fullName.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    {/* Click on Name opens Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKid(kid);
                        setEditModalOpen(true);
                      }}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-teal-600 text-start truncate block max-w-[170px] sm:max-w-xs"
                    >
                      {kid.info.fullName}
                    </button>
                    <p className="text-xs text-zinc-400 truncate">
                      {kid.contacts?.fatherName ? `${translate('father_name')}: ${kid.contacts.fatherName}` : (kid.address?.region || 'Sunday School')}
                    </p>
                  </div>
                </div>

                {canManageKid(kid) && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setKidsToPrint([kid]);
                        setPrintModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                      title={translate('print_id_badge')}
                    >
                      <IdCard className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveKid(kid);
                        setEditModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                      title={translate('edit')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {kid.activeAssignment?.classId && (
                      <button
                        onClick={() => handleRemoveFromClass(kid)}
                        className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                        title={translate('remove_from_class')}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteKid(kid.id, kid.info.fullName)}
                      className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title={translate('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Clean Inline Contact Strip (Only renders channels that actually exist!) */}
              {(fatherPhone || motherPhone || primaryPhone) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {fatherPhone && (
                    <a
                      href={`tel:${fatherPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 active:scale-95 transition"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{translate('father') || 'Father'}</span>
                    </a>
                  )}
                  {motherPhone && (
                    <a
                      href={`tel:${motherPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 active:scale-95 transition"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{translate('mother') || 'Mother'}</span>
                    </a>
                  )}
                  {primaryPhone && (
                    <a
                      href={`https://wa.me/${String(primaryPhone).replace(/\+/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 active:scale-95 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              {/* Expandable Details Accordion Button */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setExpandedKidDetails((prev) => ({ ...prev, [kid.id]: !prev[kid.id] }))}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 py-1 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <span>{isExpanded ? 'Hide Details' : 'View Profile Details'}</span>
                    {kid.info.deacon && <span className="text-amber-500 font-bold">✠ Deacon</span>}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-xs space-y-2.5 animate-in fade-in duration-150">
                    {/* Education & Spiritual */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">{translate('school')}</span>
                        <div className="flex items-center gap-1.5 flex-wrap font-semibold text-zinc-800 dark:text-zinc-200">
                          <span>{kid.info.school || '-'}</span>
                          {kid.info.schoolType && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              kid.info.schoolType === 'International'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : kid.info.schoolType === 'National'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}>
                              {kid.info.schoolType === 'National' ? translate('school_type_national') : kid.info.schoolType === 'International' ? translate('school_type_international') : kid.info.schoolType}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">{translate('father_of_confession')}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {kid.info.fatherOfConfession || '-'}
                        </span>
                      </div>
                    </div>

                    {/* DOB & Parents Profession */}
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">{translate('dob')}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {safeRender(kid.info.dob)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">{translate('father_job')}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {kid.contacts?.fatherProfession || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Address & GPS Navigation */}
                    {fullAddress && (
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="min-w-0">
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-teal-600" />
                            <span>{translate('address_group')}</span>
                          </span>
                          <p className="text-zinc-700 dark:text-zinc-300 font-medium text-[11px] mt-0.5 leading-snug">
                            {fullAddress}
                            {kid.address?.landmark && <span className="text-zinc-400 block text-[10px]">Near: {kid.address.landmark}</span>}
                          </p>
                        </div>
                        {kid.address?.geoLocation && (
                          <a
                            href={getUniversalNavigationUrl(kid.address.geoLocation, fullAddress)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-bold shrink-0 shadow-2xs hover:bg-teal-100"
                            title="Open in Maps / GPS"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>GPS</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Pastoral Notes */}
                    {kid.notes && (
                      <div>
                        <span className="text-[10px] text-zinc-400 block">{translate('pastoral_notes')}</span>
                        <p className="text-zinc-600 dark:text-zinc-300 text-[11px] italic bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-1">
                          "{kid.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
        )}

        {filteredKids.length > displayLimit && (
          <div className="flex items-center justify-center p-2">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 60)}
              className="w-full py-2.5 rounded-2xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-teal-600 hover:bg-zinc-50 transition cursor-pointer"
            >
              Show More ({displayedKids.length} of {filteredKids.length})
            </button>
          </div>
        )}
      </div>

      {/* 2. DESKTOP HIGH-DENSITY 22-COLUMN TABLE (>= md) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {/* 1. Active + Master Checkbox */}
                <th className="px-4 py-3.5 text-start w-28">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      title="Select / Deselect all"
                    />
                    <span>{translate('active_badge')}</span>
                  </div>
                </th>

                {/* 2. Full Name: Permanently visible / fixed (cannot be folded or hidden) */}
                <th className="px-5 py-3.5 text-start font-black text-zinc-900 dark:text-zinc-100">
                  {translate('student_full_name')}
                </th>

                {/* 3. Assignment Group */}
                {!foldAssignments && (
                  <>
                    <th className="px-4 py-3.5 text-start">{translate('academic_year')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('service_group')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('class_label')}</th>
                  </>
                )}

                {/* 4. Profile Group */}
                {!foldProfile && (
                  <>
                    <th className="px-3 py-3.5 text-start">{translate('gender')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('dob')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('school')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('school_type')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('deacon')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('father_of_confession')}</th>
                  </>
                )}

                {/* 5. Address Group */}
                {!foldAddress && (
                  <>
                    <th className="px-4 py-3.5 text-start">{translate('street')}</th>
                    <th className="px-3 py-3.5 text-start">{translate('building')}</th>
                    <th className="px-3 py-3.5 text-start">{translate('floor')}</th>
                    <th className="px-3 py-3.5 text-start">{translate('apartment')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('region')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('landmark')}</th>
                  </>
                )}

                {/* 6. Contacts Group */}
                {!foldContacts && (
                  <>
                    <th className="px-4 py-3.5 text-start">{translate('kid_mobile')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('father_name')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('father_job')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('father_mobile')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('father_dob')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('mother_name')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('mother_job')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('mother_mobile')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('mother_dob')}</th>
                    <th className="px-4 py-3.5 text-start">{translate('other_mobile')}</th>
                  </>
                )}

                {/* 7. Notes Group */}
                {!foldNotes && (
                  <th className="px-5 py-3.5 text-start">{translate('pastoral_notes')}</th>
                )}

                <th className="px-5 py-3.5 text-end w-24">{translate('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {displayedKids.map((kid) => {
                const asgn = kid.activeAssignment || {};
                const isSelected = selectedKidIds.includes(kid.id);

                return (
                  <tr
                    key={kid.id}
                    className={`border-b border-zinc-100 dark:border-zinc-800/80 transition ${
                      isSelected
                        ? 'bg-purple-50/60 dark:bg-purple-950/30'
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Active + Checkbox */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectKid(kid.id)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          kid.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          {kid.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Full Name: Permanently visible, click to edit! */}
                    <td className="px-5 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2.5">
                        {kid.info.photoUrl ? (
                          <img
                            src={kid.info.photoUrl}
                            alt={kid.info.fullName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 shadow-xs border border-zinc-200 dark:border-zinc-700"
                          />
                        ) : (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            kid.info.gender === 'female'
                              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300'
                          }`}>
                            {kid.info.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveKid(kid);
                            setEditModalOpen(true);
                          }}
                          className="hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer text-start font-bold"
                          title="Click to edit student profile"
                        >
                          {kid.info.fullName}
                        </button>
                      </div>
                    </td>

                    {/* Assignment Columns */}
                    {!foldAssignments && (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap font-medium">{resolveYearName(asgn.academicYearId)}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-medium">{resolveGroupName(asgn.serviceGroupId)}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-semibold text-teal-600 dark:text-teal-400">{resolveClassName(asgn.classId)}</td>
                      </>
                    )}

                    {/* Profile Columns */}
                    {!foldProfile && (
                      <>
                        <td className="px-3 py-4 whitespace-nowrap capitalize">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            kid.info.gender === 'female' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60'
                          }`}>
                            {kid.info.gender}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{safeRender(kid.info.dob)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{kid.info.school || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                          {kid.info.schoolType ? (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              kid.info.schoolType === 'International'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : kid.info.schoolType === 'National'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}>
                              {kid.info.schoolType === 'National' ? translate('school_type_national') : kid.info.schoolType === 'International' ? translate('school_type_international') : kid.info.schoolType}
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {kid.info.deacon ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              {translate('deacon')}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{translate('no')}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{kid.info.fatherOfConfession || '-'}</td>
                      </>
                    )}

                    {/* Address Columns */}
                    {!foldAddress && (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{kid.address?.street || '-'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-zinc-500">{kid.address?.building || '-'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-zinc-500">{kid.address?.floor || '-'}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-zinc-500">{kid.address?.apartment || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-700 dark:text-zinc-300 font-medium">{kid.address?.region || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <span>{kid.address?.landmark || '-'}</span>
                            {kid.address?.geoLocation && (
                              <a
                                href={getUniversalNavigationUrl(kid.address.geoLocation, [kid.address.street, kid.address.region].filter(Boolean).join(', '))}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-md text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition shrink-0"
                                title="Open GPS Location / Directions"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Contacts Columns */}
                    {!foldContacts && (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap font-mono">{kid.contacts?.kidMob || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{kid.contacts?.fatherName || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{kid.contacts?.fatherProfession || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono">
                          {kid.contacts?.fatherMob ? (
                            <a href={`tel:${kid.contacts?.fatherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                              {kid.contacts.fatherMob}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-zinc-500">{safeRender(kid.contacts?.fatherDOB)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{kid.contacts?.motherName || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{kid.contacts?.motherProfession || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono">
                          {kid.contacts?.motherMob ? (
                            <a href={`tel:${kid.contacts?.motherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                              {kid.contacts.motherMob}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-zinc-500">{safeRender(kid.contacts?.motherDOB)}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono">{kid.contacts?.otherMob || '-'}</td>
                      </>
                    )}

                    {/* Notes Column */}
                    {!foldNotes && (
                      <td className="px-5 py-4 max-w-xs truncate text-zinc-500">{kid.notes || '-'}</td>
                    )}

                    {/* Actions */}
                    <td className="px-5 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageKid(kid) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setKidsToPrint([kid]);
                                setPrintModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title={translate('print_id_badge')}
                            >
                              <IdCard className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setActiveKid(kid);
                                setEditModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title={translate('edit')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {kid.activeAssignment?.classId && (
                              <button
                                onClick={() => handleRemoveFromClass(kid)}
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                                title={translate('remove_from_class')}
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteKid(kid.id, kid.info.fullName)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title={translate('delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredKids.length > displayLimit && (
          <div className="flex items-center justify-center p-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 60)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition cursor-pointer"
            >
              Show More Students ({displayedKids.length} of {filteredKids.length})
            </button>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar (Visible when >= 1 student selected) */}
      {selectedKidIds.length > 0 && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-[max(1.5rem,env(safe-area-inset-bottom))] inset-x-4 max-w-xl mx-auto z-40 p-3 sm:p-4 rounded-3xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xl flex items-center justify-between border border-zinc-700 dark:border-zinc-300 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-extrabold text-xs">
              {selectedKidIds.length}
            </span>
            <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
              {selectedKidIds.length} {translate('students_selected')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {canBulkReassign && (
              <button
                onClick={() => setBulkModalOpen(true)}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white transition active:scale-95 shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{translate('change_assignment')}</span>
              </button>
            )}

            {canBulkDelete && (
              <button
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="flex items-center gap-1 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{translate('delete_selected')}</span>
              </button>
            )}

            <button
              onClick={() => setSelectedKidIds([])}
              className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white dark:hover:text-zinc-900 transition cursor-pointer"
            >
              {translate('clear')}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Adding Student */}
      {canAddStudent && (
        <button
          type="button"
          onClick={() => {
            setActiveKid(null);
            setEditModalOpen(true);
          }}
          className="sm:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-4 z-30 w-13 h-13 rounded-full bg-teal-600 text-white shadow-xl shadow-teal-600/40 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          aria-label={translate('add_student')}
          title={translate('add_student')}
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Mobile Action Bottom Sheet */}
      {mobileActionsSheetOpen && (
        <div
          onClick={() => setMobileActionsSheetOpen(false)}
          className="sm:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-5 shadow-2xl border-t border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[85dvh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] cursor-default animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                {translate('actions')}
              </h3>
              <button
                type="button"
                onClick={() => setMobileActionsSheetOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileActionsSheetOpen(false);
                    setImportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-start transition cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{translate('import_excel')}</h4>
                    <p className="text-[11px] text-zinc-400">Onboard students from Excel or CSV spreadsheet</p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileActionsSheetOpen(false);
                  setSyncModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-start transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <BookUser className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{translate('sync_contacts')}</h4>
                  <p className="text-[11px] text-zinc-400">Sync students to phone contacts via Google Cloud</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileActionsSheetOpen(false);
                  handleExportExcel();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-start transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{translate('export_excel')}</h4>
                  <p className="text-[11px] text-zinc-400">Download formatted .xlsx spreadsheet</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileActionsSheetOpen(false);
                  handleExportVCard();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-start transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <Contact className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{translate('export_vcard')}</h4>
                  <p className="text-[11px] text-zinc-400">Download offline .vcf contact cards with photos</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileActionsSheetOpen(false);
                  const targets = selectedKidIds.length > 0
                    ? filteredKids.filter((k) => selectedKidIds.includes(k.id))
                    : filteredKids;
                  setKidsToPrint(targets);
                  setPrintModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-start transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <IdCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{translate('print_id_cards')}</h4>
                  <p className="text-[11px] text-zinc-400">8 cards per A4 sheet with QR codes</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmOpen && (
        <div 
          onClick={() => { if (!isDeletingBulk) setBulkDeleteConfirmOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 cursor-default"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {translate('bulk_delete_confirm_title')}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {translate('bulk_delete_confirm_desc')}
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {selectedKidIds.length} {translate('students_selected')}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                {translate('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingBulk && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isDeletingBulk ? translate('saving') : translate('delete_selected')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {bulkModalOpen && selectedChurchId && (
        <BulkAssignmentModal
          churchId={selectedChurchId}
          selectedKidIds={selectedKidIds}
          academicYears={academicYears}
          serviceGroups={serviceGroups}
          classes={classesList}
          defaultYearId={selectedAcademicYearId || academicYears[0]?.id || ''}
          defaultGroupId={selectedServiceGroupId || serviceGroups[0]?.id || ''}
          defaultClassId={selectedClassId || ''}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={(count) => {
            setBulkModalOpen(false);
            setSelectedKidIds([]);
            alert(`Successfully reassigned ${count} students.`);
          }}
        />
      )}

      {/* Smart Import Wizard Modal (Option 3 Hybrid AI) */}
      {importModalOpen && selectedChurchId && (
        <SmartImportModal
          churchId={selectedChurchId}
          academicYears={academicYears}
          serviceGroups={serviceGroups}
          classes={classesList}
          defaultYearId={selectedAcademicYearId || academicYears[0]?.id || ''}
          defaultGroupId={selectedServiceGroupId || serviceGroups[0]?.id || ''}
          defaultClassId={selectedClassId || ''}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            // refresh happens automatically via snapshot
          }}
        />
      )}

      {/* Batch Print ID Badges Modal */}
      {printModalOpen && selectedChurchId && (
        <PrintIdCardsModal
          kids={kidsToPrint}
          churchId={selectedChurchId}
          churchName={activeChurchName}
          churchLogoUrl={churches.find((c) => c.id === selectedChurchId)?.logoUrl}
          classes={classes}
          serviceGroups={serviceGroups}
          yearName={activeYearName}
          yearBadgeColor={academicYears.find((y) => y.id === selectedAcademicYearId)?.badgeColor}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* Google Contacts Sync Modal */}
      <GoogleContactsSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        kids={filteredKids}
        churchName={activeChurchName}
        className={activeClassName}
        yearName={activeYearName}
      />

      {/* Add / Edit Kid Modal */}
      {editModalOpen && (
        <KidFormModal
          existingKid={activeKid}
          academicYears={academicYears}
          serviceGroups={serviceGroups}
          classes={classes}
          initialYearId={selectedAcademicYearId || academicYears[0]?.id || ''}
          initialGroupId={selectedServiceGroupId || serviceGroups[0]?.id || ''}
          initialClassId={selectedClassId || classes[0]?.id || ''}
          canChangeAssignment={canBulkReassign}
          onClose={() => {
            setEditModalOpen(false);
            setActiveKid(null);
          }}
          onSave={handleSaveKid}
        />
      )}
    </div>
  );
};

// Sub-component: Kid Form Modal
interface KidFormModalProps {
  existingKid: Kid | null;
  academicYears: Array<{ id: string; displayName: string }>;
  serviceGroups: Array<{ id: string; displayName: string }>;
  classes: Array<{ id: string; displayName: string }>;
  initialYearId: string;
  initialGroupId: string;
  initialClassId: string;
  canChangeAssignment?: boolean;
  onClose: () => void;
  onSave: (kidData: Partial<Kid>) => void;
}

const KidFormModal: React.FC<KidFormModalProps> = ({
  existingKid,
  academicYears,
  serviceGroups,
  classes,
  initialYearId,
  initialGroupId,
  initialClassId,
  canChangeAssignment = true,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  const asgn = existingKid?.activeAssignment || {};

  const [fullName, setFullName] = useState(existingKid?.info?.fullName || '');
  const [gender, setGender] = useState<'male' | 'female'>(existingKid?.info?.gender || 'male');
  const [dob, setDob] = useState(existingKid?.info?.dob || '');
  const [school, setSchool] = useState(existingKid?.info?.school || '');
  const initialSchoolType = existingKid?.info?.schoolType || '';
  const [schoolTypeCategory, setSchoolTypeCategory] = useState<'National' | 'International' | 'other' | ''>(
    initialSchoolType === 'National' || initialSchoolType === 'International'
      ? initialSchoolType
      : initialSchoolType ? 'other' : ''
  );
  const [customSchoolType, setCustomSchoolType] = useState(
    initialSchoolType && initialSchoolType !== 'National' && initialSchoolType !== 'International' ? initialSchoolType : ''
  );
  const [deacon, setDeacon] = useState<boolean>(Boolean(existingKid?.info?.deacon));
  const [fatherOfConfession, setFatherOfConfession] = useState(existingKid?.info?.fatherOfConfession || '');
  const [photoUrl, setPhotoUrl] = useState(existingKid?.info?.photoUrl || '');

  // Assignment
  const [academicYearId, setAcademicYearId] = useState(asgn.academicYearId || initialYearId);
  const [serviceGroupId, setServiceGroupId] = useState(asgn.serviceGroupId || initialGroupId);
  const [classId, setClassId] = useState(asgn.classId || initialClassId);

  // Address
  const [street, setStreet] = useState(existingKid?.address?.street || '');
  const [building, setBuilding] = useState(existingKid?.address?.building || '');
  const [floor, setFloor] = useState(existingKid?.address?.floor || '');
  const [apartment, setApartment] = useState(existingKid?.address?.apartment || '');
  const [region, setRegion] = useState(existingKid?.address?.region || '');
  const [landmark, setLandmark] = useState(existingKid?.address?.landmark || '');
  const [geoLocation, setGeoLocation] = useState(existingKid?.address?.geoLocation || '');
  const [isCapturingGps, setIsCapturingGps] = useState(false);

  // Contacts
  const [kidMob, setKidMob] = useState(existingKid?.contacts?.kidMob || '');
  const [fatherName, setFatherName] = useState(existingKid?.contacts?.fatherName || '');
  const [fatherProfession, setFatherProfession] = useState(existingKid?.contacts?.fatherProfession || '');
  const [fatherMob, setFatherMob] = useState(existingKid?.contacts?.fatherMob || '');
  const [fatherDOB, setFatherDOB] = useState(existingKid?.contacts?.fatherDOB || '');
  const [motherName, setMotherName] = useState(existingKid?.contacts?.motherName || '');
  const [motherProfession, setMotherProfession] = useState(existingKid?.contacts?.motherProfession || '');
  const [motherMob, setMotherMob] = useState(existingKid?.contacts?.motherMob || '');
  const [motherDOB, setMotherDOB] = useState(existingKid?.contacts?.motherDOB || '');
  const [otherMob, setOtherMob] = useState(existingKid?.contacts?.otherMob || '');

  // Notes
  const [notes, setNotes] = useState(existingKid?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Student Full Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const computedSchoolType = schoolTypeCategory === 'other' ? customSchoolType.trim() : schoolTypeCategory;

      await onSave({
        info: {
          fullName,
          gender,
          dob,
          school,
          schoolType: computedSchoolType || undefined,
          deacon,
          fatherOfConfession,
          photoUrl: photoUrl || undefined,
        },
        activeAssignment: {
          academicYearId,
          serviceGroupId,
          classId,
        },
        address: {
          street,
          building,
          floor,
          apartment,
          region,
          landmark: landmark.trim() || undefined,
          geoLocation: normalizeGeoInput(geoLocation) || undefined,
        },
        contacts: {
          kidMob,
          fatherName,
          fatherProfession,
          fatherMob,
          fatherDOB: fatherDOB || undefined,
          motherName,
          motherProfession,
          motherMob,
          motherDOB: motherDOB || undefined,
          otherMob,
        },
        notes,
      });
    } catch (err: any) {
      console.error('Save kid failed:', err);
      alert(`Error saving student: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto cursor-default"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingKid ? `${translate('edit')} ${translate('kids')}: ${existingKid.info.fullName}` : translate('add_student')}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-600 rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <fieldset disabled={isSaving} className="space-y-5">
          {/* Profile Photo Uploader */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
            <ProfilePhotoUploader
              photoUrl={photoUrl}
              name={fullName}
              gender={gender}
              onPhotoChange={(url) => setPhotoUrl(url || '')}
              size="md"
            />
            <div className="text-xs">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{translate('profile_photo')}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Click photo to upload from device or capture with camera.</p>
            </div>
          </div>

          {/* Section 1: Active Assignment */}
          <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 space-y-2">
            <h4 className="font-bold text-purple-900 dark:text-purple-300">Classroom Assignment</h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Academic Year</label>
                <select
                  value={academicYearId}
                  disabled={!canChangeAssignment}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Service Group</label>
                <select
                  value={serviceGroupId}
                  disabled={!canChangeAssignment}
                  onChange={(e) => setServiceGroupId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {serviceGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Class</label>
                <select
                  value={classId}
                  disabled={!canChangeAssignment}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
                {!canChangeAssignment && (
                  <p className="text-[10px] text-zinc-400 mt-1">Assignment managed by Church/Group Admin</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: General Profile Info */}
          <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 space-y-2">
            <h4 className="font-bold text-teal-900 dark:text-teal-300">General Profile</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Full Name *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Student Full Name"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('dob')}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('school')}</label>
                <input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="School name"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('father_of_confession')}</label>
                <input
                  value={fatherOfConfession}
                  onChange={(e) => setFatherOfConfession(e.target.value)}
                  placeholder="Abouna name"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('school_type')}</label>
                <div className="flex gap-2">
                  <select
                    value={schoolTypeCategory}
                    onChange={(e) => setSchoolTypeCategory(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                  >
                    <option value="">-- {translate('school_type')} --</option>
                    <option value="National">{translate('school_type_national')}</option>
                    <option value="International">{translate('school_type_international')}</option>
                    <option value="other">{translate('school_type_other')}</option>
                  </select>
                  {schoolTypeCategory === 'other' && (
                    <input
                      value={customSchoolType}
                      onChange={(e) => setCustomSchoolType(e.target.value)}
                      placeholder={translate('specify_other')}
                      className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('deacon')}</label>
                <select
                  value={deacon ? 'true' : 'false'}
                  onChange={(e) => setDeacon(e.target.value === 'true')}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                >
                  <option value="false">{translate('no')}</option>
                  <option value="true">{translate('yes')} ({translate('deacon')})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Family Contacts */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 space-y-2">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-300">Family Contacts (Auto-formatted E.164)</h4>
            <div className="grid grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('father_name')}</label>
                <input
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('father_job')}</label>
                <input
                  value={fatherProfession}
                  onChange={(e) => setFatherProfession(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('father_mobile')}</label>
                <input
                  value={fatherMob}
                  onChange={(e) => setFatherMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('father_dob')}</label>
                <input
                  type="date"
                  value={fatherDOB}
                  onChange={(e) => setFatherDOB(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('mother_name')}</label>
                <input
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('mother_job')}</label>
                <input
                  value={motherProfession}
                  onChange={(e) => setMotherProfession(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('mother_mobile')}</label>
                <input
                  value={motherMob}
                  onChange={(e) => setMotherMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('mother_dob')}</label>
                <input
                  type="date"
                  value={motherDOB}
                  onChange={(e) => setMotherDOB(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('kid_mobile')}</label>
                <input
                  value={kidMob}
                  onChange={(e) => setKidMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('other_mobile')}</label>
                <input
                  value={otherMob}
                  onChange={(e) => setOtherMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Address */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <h4 className="font-bold text-blue-900 dark:text-blue-300">Home Address</h4>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('street')}</label>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('building')}</label>
                <input
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('floor')}</label>
                <input
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('apartment')}</label>
                <input
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('region')}</label>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Heliopolis, Nasr City, Shoubra"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{translate('landmark')}</label>
                <input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near St. George Church / بجوار ..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            {/* GeoLocation with GPS Capture and Map Preview */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  {translate('geo_location')}
                </label>
                <div className="flex items-center gap-2">
                  {parseGeoCoordinates(geoLocation) && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      ✓ {translate('valid_gps_coords')}
                    </span>
                  )}
                  {geoLocation && (
                    <a
                      href={getUniversalNavigationUrl(geoLocation)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-teal-600 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>{translate('navigate')}</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={geoLocation}
                  onChange={(e) => setGeoLocation(e.target.value)}
                  placeholder="e.g. geo:30.0444,31.2357 or paste Google/Apple Maps / WhatsApp link"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={isCapturingGps}
                  onClick={async () => {
                    setIsCapturingGps(true);
                    try {
                      const captured = await captureDeviceGpsLocation();
                      setGeoLocation(captured.geoUri);
                    } catch (err: any) {
                      alert(err.message || translate('location_permission_denied'));
                    } finally {
                      setIsCapturingGps(false);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-bold text-xs border border-teal-200 dark:border-teal-800 transition cursor-pointer disabled:opacity-50 shrink-0"
                  title="Capture current location from phone/device GPS"
                >
                  {isCapturingGps ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5" />
                  )}
                  <span>{translate('capture_current_location')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Notes */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Pastoral Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              {translate('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? translate('saving') : translate('save')}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
