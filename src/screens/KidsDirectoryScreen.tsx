import React, { useState, useEffect } from 'react';
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
import { normalizePhoneNumber } from '../services/googleContacts';
import { normalizeDateStr, safeRender } from '../utils/formatters';
import { useModalEscape } from '../utils/useModalEscape';
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
  Navigation 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const KidsDirectoryScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId, 
    churches, 
    classes, 
    serviceGroups, 
    academicYears 
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

  // Modals
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activeKid, setActiveKid] = useState<Kid | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

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
      { key: 'gender', type: 'select', options: [{ value: 'male', label: translate('male') }, { value: 'female', label: translate('female') }] } as ColumnFilterConfig,
      { key: 'dob', type: 'text', placeholder: `${translate('search')} ${translate('dob')}...` } as ColumnFilterConfig,
      { key: 'school', type: 'text', placeholder: `${translate('search')} ${translate('school')}...` } as ColumnFilterConfig,
      { key: 'schoolType', type: 'select', options: [
        { value: 'National', label: translate('school_type_national') }, 
        { value: 'International', label: translate('school_type_international') }, 
        { value: 'other', label: translate('school_type_other') }
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

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      if (String(kid.active) !== filters.active) return false;
    }
    if (filters.fullName) {
      if (!kid.info.fullName.toLowerCase().includes(filters.fullName.toLowerCase())) return false;
    }
    if (filters.year) {
      if (!resolveYearName(asgn.academicYearId).toLowerCase().includes(filters.year.toLowerCase())) return false;
    }
    if (filters.group) {
      if (!resolveGroupName(asgn.serviceGroupId).toLowerCase().includes(filters.group.toLowerCase())) return false;
    }
    if (filters.class) {
      if (!resolveClassName(asgn.classId).toLowerCase().includes(filters.class.toLowerCase())) return false;
    }
    if (filters.gender) {
      if (kid.info.gender !== filters.gender) return false;
    }
    if (filters.dob) {
      if (!kid.info.dob?.includes(filters.dob)) return false;
    }
    if (filters.school) {
      if (!kid.info.school?.toLowerCase().includes(filters.school.toLowerCase())) return false;
    }
    if (filters.schoolType) {
      if (filters.schoolType === 'other') {
        const st = (kid.info.schoolType || '').toLowerCase();
        if (st === 'national' || st === 'international' || !st) return false;
      } else {
        if ((kid.info.schoolType || '').toLowerCase() !== filters.schoolType.toLowerCase()) return false;
      }
    }
    if (filters.deacon !== undefined && filters.deacon !== '') {
      const isDeacon = filters.deacon === 'true' || filters.deacon === 'yes';
      if (Boolean(kid.info.deacon) !== isDeacon) return false;
    }
    if (filters.fatherOfConfession) {
      if (!kid.info.fatherOfConfession?.toLowerCase().includes(filters.fatherOfConfession.toLowerCase())) return false;
    }
    if (filters.street) {
      if (!kid.address?.street?.toLowerCase().includes(filters.street.toLowerCase())) return false;
    }
    if (filters.building) {
      if (!kid.address?.building?.toLowerCase().includes(filters.building.toLowerCase())) return false;
    }
    if (filters.floor) {
      if (!kid.address?.floor?.toLowerCase().includes(filters.floor.toLowerCase())) return false;
    }
    if (filters.apartment) {
      if (!kid.address?.apartment?.toLowerCase().includes(filters.apartment.toLowerCase())) return false;
    }
    if (filters.region) {
      if (!kid.address?.region?.toLowerCase().includes(filters.region.toLowerCase())) return false;
    }
    if (filters.landmark) {
      if (!kid.address?.landmark?.toLowerCase().includes(filters.landmark.toLowerCase())) return false;
    }
    if (filters.kidMob) {
      if (!kid.contacts?.kidMob?.includes(filters.kidMob)) return false;
    }
    if (filters.fatherName) {
      if (!kid.contacts?.fatherName?.toLowerCase().includes(filters.fatherName.toLowerCase())) return false;
    }
    if (filters.fatherProfession) {
      if (!kid.contacts?.fatherProfession?.toLowerCase().includes(filters.fatherProfession.toLowerCase())) return false;
    }
    if (filters.fatherMob) {
      if (!kid.contacts?.fatherMob?.includes(filters.fatherMob)) return false;
    }
    if (filters.fatherDOB) {
      if (!kid.contacts?.fatherDOB?.toLowerCase().includes(filters.fatherDOB.toLowerCase())) return false;
    }
    if (filters.motherName) {
      if (!kid.contacts?.motherName?.toLowerCase().includes(filters.motherName.toLowerCase())) return false;
    }
    if (filters.motherProfession) {
      if (!kid.contacts?.motherProfession?.toLowerCase().includes(filters.motherProfession.toLowerCase())) return false;
    }
    if (filters.motherMob) {
      if (!kid.contacts?.motherMob?.includes(filters.motherMob)) return false;
    }
    if (filters.motherDOB) {
      if (!kid.contacts?.motherDOB?.toLowerCase().includes(filters.motherDOB.toLowerCase())) return false;
    }
    if (filters.otherMob) {
      if (!kid.contacts?.otherMob?.includes(filters.otherMob)) return false;
    }
    if (filters.notes) {
      if (!kid.notes?.toLowerCase().includes(filters.notes.toLowerCase())) return false;
    }

    return true;
  });

  // Multi-select helpers
  const allFilteredSelected = filteredKids.length > 0 && filteredKids.every((k) => selectedKidIds.includes(k.id));

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
      let deletedCount = 0;
      for (let i = 0; i < selectedKidIds.length; i += batchSize) {
        const chunk = selectedKidIds.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((kId) => {
          const kidRef = doc(db, 'churches', selectedChurchId, 'kids', kId);
          batch.delete(kidRef);
          deletedCount++;
        });
        await batch.commit();
      }

      // Sync class documents to remove deleted kids
      const impactedClasses = new Set<string>();
      kids.filter((k) => selectedKidIds.includes(k.id)).forEach((k) => {
        if (k.activeAssignment?.classId) impactedClasses.add(k.activeAssignment.classId);
      });

      impactedClasses.forEach(async (cId) => {
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
      });

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
      'Full Name': k.info.fullName,
      'Year': resolveYearName(k.activeAssignment?.academicYearId),
      'Group': resolveGroupName(k.activeAssignment?.serviceGroupId),
      'Class': resolveClassName(k.activeAssignment?.classId),
      'Gender': k.info.gender,
      'DOB': k.info.dob || '',
      'School': k.info.school || '',
      'School Type': k.info.schoolType || '',
      'Deacon': k.info.deacon ? 'Yes' : 'No',
      'Father of Confession': k.info.fatherOfConfession || '',
      'Street': k.address?.street || '',
      'Building': k.address?.building || '',
      'Floor': k.address?.floor || '',
      'Apartment': k.address?.apartment || '',
      'Region': k.address?.region || '',
      'Landmark': k.address?.landmark || '',
      'GPS Location': k.address?.geoLocation || '',
      'Kid Mobile': k.contacts?.kidMob || '',
      'Father Name': k.contacts?.fatherName || '',
      'Father Profession': k.contacts?.fatherProfession || '',
      'Father Mobile': k.contacts?.fatherMob || '',
      'Father DOB': k.contacts?.fatherDOB || '',
      'Mother Name': k.contacts?.motherName || '',
      'Mother Profession': k.contacts?.motherProfession || '',
      'Mother Mobile': k.contacts?.motherMob || '',
      'Mother DOB': k.contacts?.motherDOB || '',
      'Other Mobile': k.contacts?.otherMob || '',
      'Photo URL': k.info.photoUrl || '',
      'Notes': k.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kids Roster');
    XLSX.writeFile(workbook, `Oikonomos_Kids_${selectedChurchId}.xlsx`);
  };

  const activeChurchName = churches.find((c) => c.id === selectedChurchId)?.displayName || 'Church';
  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'All Classes';
  const activeYearName = academicYears.find((y) => y.id === selectedAcademicYearId)?.displayName || 'Term';

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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{translate('export_excel')}</span>
          </button>

          {/* Add Kid */}
          {isAdmin && (
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
        {filteredKids.map((kid) => {
          const fatherPhone = kid.contacts?.fatherMob;
          const motherPhone = kid.contacts?.motherMob;
          const kidPhone = kid.contacts?.kidMob;
          const primaryPhone = fatherPhone || motherPhone || kidPhone;

          return (
            <div
              key={kid.id}
              className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs ${
                    kid.info.gender === 'female' 
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'
                  }`}>
                    {kid.info.fullName.charAt(0)}
                  </div>
                  <div>
                    {/* Click on Name opens Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKid(kid);
                        setEditModalOpen(true);
                      }}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-teal-600 text-start"
                    >
                      {kid.info.fullName}
                    </button>
                    <p className="text-xs text-zinc-400">
                      {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : (kid.address?.region || 'Sunday School')}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveKid(kid);
                      setEditModalOpen(true);
                    }}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Actions (Call / WhatsApp) */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                {fatherPhone ? (
                  <a
                    href={`tel:${fatherPhone}`}
                    className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Father</span>
                  </a>
                ) : (
                  <div className="py-2 text-[11px] text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">No Father</div>
                )}

                {motherPhone ? (
                  <a
                    href={`tel:${motherPhone}`}
                    className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Mother</span>
                  </a>
                ) : (
                  <div className="py-2 text-[11px] text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">No Mother</div>
                )}

                {primaryPhone ? (
                  <a
                    href={`https://wa.me/${String(primaryPhone).replace(/\+/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 transition active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <div className="py-2 text-[11px] text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">No WA</div>
                )}
              </div>
            </div>
          );
        })}
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

              {filteredKids.map((kid) => {
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
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                              {kid.info.schoolType === 'National' ? translate('school_type_national') : kid.info.schoolType === 'International' ? translate('school_type_international') : kid.info.schoolType}
                            </span>
                          ) : '-'}
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
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setActiveKid(kid);
                                setEditModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title="Edit Kid"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteKid(kid.id, kid.info.fullName)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete Kid"
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
      </div>

      {/* Floating Bulk Action Bar (Visible when >= 1 student selected) */}
      {selectedKidIds.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 inset-x-4 max-w-xl mx-auto z-40 p-3 sm:p-4 rounded-3xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xl flex items-center justify-between border border-zinc-700 dark:border-zinc-300 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-extrabold text-xs">
              {selectedKidIds.length}
            </span>
            <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
              {selectedKidIds.length} {translate('students_selected')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white transition active:scale-95 shadow-md shadow-purple-600/30 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{translate('change_assignment')}</span>
            </button>

            {isAdmin && (
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

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
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
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  const asgn = existingKid?.activeAssignment || {};

  const [fullName, setFullName] = useState(existingKid?.info.fullName || '');
  const [gender, setGender] = useState<'male' | 'female'>(existingKid?.info.gender || 'male');
  const [dob, setDob] = useState(existingKid?.info.dob || '');
  const [school, setSchool] = useState(existingKid?.info.school || '');
  const initialSchoolType = existingKid?.info.schoolType || '';
  const [schoolTypeCategory, setSchoolTypeCategory] = useState<'National' | 'International' | 'other' | ''>(
    initialSchoolType === 'National' || initialSchoolType === 'International'
      ? initialSchoolType
      : initialSchoolType ? 'other' : ''
  );
  const [customSchoolType, setCustomSchoolType] = useState(
    initialSchoolType && initialSchoolType !== 'National' && initialSchoolType !== 'International' ? initialSchoolType : ''
  );
  const [deacon, setDeacon] = useState<boolean>(Boolean(existingKid?.info.deacon));
  const [fatherOfConfession, setFatherOfConfession] = useState(existingKid?.info.fatherOfConfession || '');
  const [photoUrl, setPhotoUrl] = useState(existingKid?.info.photoUrl || '');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingKid ? `${translate('edit')} ${translate('kids')}: ${existingKid.info.fullName}` : translate('add_student')}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
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
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                  onChange={(e) => setServiceGroupId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
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
