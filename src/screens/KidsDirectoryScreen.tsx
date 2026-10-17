import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { GoogleContactsSyncModal } from '../components/kids/GoogleContactsSyncModal';
import { normalizePhoneNumber } from '../services/googleContacts';
import { normalizeDateStr, safeRender } from '../utils/formatters';
import type { Kid, ClassDoc, KidVersion } from '../types';
import { 
  Plus, 
  Phone, 
  MessageSquare, 
  BookUser, 
  Trash2, 
  Edit3, 
  Download, 
  X, 
  Layers 
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

  // 5 Foldable Column Groups state (Mandated by PRD):
  // 1. Assignment Group
  // 2. General Profile Group
  // 3. Address Group
  // 4. Contacts Group
  // 5. Notes Group
  const [foldAssignments, setFoldAssignments] = useState(false); // unfold by default
  const [foldProfile, setFoldProfile] = useState(false); // unfold by default
  const [foldAddress, setFoldAddress] = useState(true); // folded by default
  const [foldContacts, setFoldContacts] = useState(false); // unfold by default
  const [foldNotes, setFoldNotes] = useState(true); // folded by default

  // Header Filtering Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeKid, setActiveKid] = useState<Kid | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

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
            fatherOfConfession: String(d.info?.fatherOfConfession || d.fatherOfConfession || ''),
          },
          address: d.address || {},
          contacts: d.contacts || {},
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

  // Build dynamic FilterConfigs matching visible folded/unfolded columns
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    // Assignments Group
    ...(!foldAssignments ? [
      { key: 'year', type: 'text', placeholder: 'Year...' } as ColumnFilterConfig,
      { key: 'group', type: 'text', placeholder: 'Group...' } as ColumnFilterConfig,
      { key: 'class', type: 'text', placeholder: 'Class...' } as ColumnFilterConfig,
    ] : []),
    // Profile Group
    ...(!foldProfile ? [
      { key: 'fullName', type: 'text', placeholder: 'Full Name...' } as ColumnFilterConfig,
      { key: 'gender', type: 'select', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] } as ColumnFilterConfig,
      { key: 'dob', type: 'text', placeholder: 'DOB...' } as ColumnFilterConfig,
      { key: 'school', type: 'text', placeholder: 'School...' } as ColumnFilterConfig,
      { key: 'fatherOfConfession', type: 'text', placeholder: 'Father Confession...' } as ColumnFilterConfig,
    ] : []),
    // Address Group
    ...(!foldAddress ? [
      { key: 'street', type: 'text', placeholder: 'Street...' } as ColumnFilterConfig,
      { key: 'building', type: 'text', placeholder: 'Building...' } as ColumnFilterConfig,
      { key: 'floor', type: 'text', placeholder: 'Floor...' } as ColumnFilterConfig,
      { key: 'apartment', type: 'text', placeholder: 'Apt...' } as ColumnFilterConfig,
      { key: 'region', type: 'text', placeholder: 'Region...' } as ColumnFilterConfig,
    ] : []),
    // Contacts Group
    ...(!foldContacts ? [
      { key: 'kidMob', type: 'text', placeholder: 'Kid Mobile...' } as ColumnFilterConfig,
      { key: 'fatherName', type: 'text', placeholder: 'Father Name...' } as ColumnFilterConfig,
      { key: 'fatherProfession', type: 'text', placeholder: 'Father Job...' } as ColumnFilterConfig,
      { key: 'fatherMob', type: 'text', placeholder: 'Father Mobile...' } as ColumnFilterConfig,
      { key: 'motherName', type: 'text', placeholder: 'Mother Name...' } as ColumnFilterConfig,
      { key: 'motherProfession', type: 'text', placeholder: 'Mother Job...' } as ColumnFilterConfig,
      { key: 'motherMob', type: 'text', placeholder: 'Mother Mobile...' } as ColumnFilterConfig,
      { key: 'otherMob', type: 'text', placeholder: 'Other Mobile...' } as ColumnFilterConfig,
    ] : []),
    // Notes Group
    ...(!foldNotes ? [
      { key: 'notes', type: 'text', placeholder: 'Notes...' } as ColumnFilterConfig,
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
    if (filters.year) {
      if (!resolveYearName(asgn.academicYearId).toLowerCase().includes(filters.year.toLowerCase())) return false;
    }
    if (filters.group) {
      if (!resolveGroupName(asgn.serviceGroupId).toLowerCase().includes(filters.group.toLowerCase())) return false;
    }
    if (filters.class) {
      if (!resolveClassName(asgn.classId).toLowerCase().includes(filters.class.toLowerCase())) return false;
    }
    if (filters.fullName) {
      if (!kid.info.fullName.toLowerCase().includes(filters.fullName.toLowerCase())) return false;
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
    if (filters.fatherOfConfession) {
      if (!kid.info.fatherOfConfession?.toLowerCase().includes(filters.fatherOfConfession.toLowerCase())) return false;
    }
    if (filters.region) {
      if (!kid.address?.region?.toLowerCase().includes(filters.region.toLowerCase())) return false;
    }
    if (filters.fatherName) {
      if (!kid.contacts?.fatherName?.toLowerCase().includes(filters.fatherName.toLowerCase())) return false;
    }
    if (filters.fatherMob) {
      if (!kid.contacts?.fatherMob?.includes(filters.fatherMob)) return false;
    }
    if (filters.motherName) {
      if (!kid.contacts?.motherName?.toLowerCase().includes(filters.motherName.toLowerCase())) return false;
    }
    if (filters.motherMob) {
      if (!kid.contacts?.motherMob?.includes(filters.motherMob)) return false;
    }
    if (filters.notes) {
      if (!kid.notes?.toLowerCase().includes(filters.notes.toLowerCase())) return false;
    }

    return true;
  });

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
    setEditModalOpen(false);
    setActiveKid(null);
  };

  const handleDeleteKid = async (kidId: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Delete student "${name}"? This action cannot be undone.`)) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'kids', kidId));
    }
  };

  const handleExportExcel = () => {
    const rows = filteredKids.map((k) => ({
      'Active': k.active ? 'Yes' : 'No',
      'Year': resolveYearName(k.activeAssignment?.academicYearId),
      'Group': resolveGroupName(k.activeAssignment?.serviceGroupId),
      'Class': resolveClassName(k.activeAssignment?.classId),
      'Full Name': k.info.fullName,
      'Gender': k.info.gender,
      'DOB': k.info.dob || '',
      'School': k.info.school || '',
      'Father of Confession': k.info.fatherOfConfession || '',
      'Street': k.address?.street || '',
      'Building': k.address?.building || '',
      'Floor': k.address?.floor || '',
      'Apartment': k.address?.apartment || '',
      'Region': k.address?.region || '',
      'Kid Mobile': k.contacts?.kidMob || '',
      'Father Name': k.contacts?.fatherName || '',
      'Father Profession': k.contacts?.fatherProfession || '',
      'Father Mobile': k.contacts?.fatherMob || '',
      'Mother Name': k.contacts?.motherName || '',
      'Mother Profession': k.contacts?.motherProfession || '',
      'Mother Mobile': k.contacts?.motherMob || '',
      'Other Mobile': k.contacts?.otherMob || '',
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
            {activeChurchName} • {activeClassName}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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
              <span>{translate('add')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Foldable Column Categories Bar (Desktop Table Toggle) */}
      <div className="hidden md:flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs shadow-xs">
        <span className="font-bold text-zinc-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Foldable Column Groups:</span>
        </span>
        <div className="flex items-center gap-2">
          {/* 1. Assignment Group */}
          <button
            onClick={() => setFoldAssignments(!foldAssignments)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldAssignments ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldAssignments ? '[+]' : '[-]'} Assignment</span>
          </button>

          {/* 2. General Profile Group */}
          <button
            onClick={() => setFoldProfile(!foldProfile)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldProfile ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldProfile ? '[+]' : '[-]'} General Profile</span>
          </button>

          {/* 3. Address Group */}
          <button
            onClick={() => setFoldAddress(!foldAddress)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldAddress ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldAddress ? '[+]' : '[-]'} Address</span>
          </button>

          {/* 4. Contacts Group */}
          <button
            onClick={() => setFoldContacts(!foldContacts)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldContacts ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldContacts ? '[+]' : '[-]'} Contacts</span>
          </button>

          {/* 5. Notes Group */}
          <button
            onClick={() => setFoldNotes(!foldNotes)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
              !foldNotes ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <span>{foldNotes ? '[+]' : '[-]'} Notes</span>
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
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {kid.info.fullName}
                    </h3>
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
                    href={`https://wa.me/${primaryPhone.replace(/\+/g, '')}`}
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
                <th className="px-5 py-3.5 text-start w-20">Active</th>

                {/* 1. Assignment Group */}
                {!foldAssignments && (
                  <>
                    <th className="px-4 py-3.5 text-start">Academic Year</th>
                    <th className="px-4 py-3.5 text-start">Service Group</th>
                    <th className="px-4 py-3.5 text-start">Class</th>
                  </>
                )}

                {/* 2. Profile Group */}
                {!foldProfile && (
                  <>
                    <th className="px-5 py-3.5 text-start">Full Name</th>
                    <th className="px-3 py-3.5 text-start">Gender</th>
                    <th className="px-4 py-3.5 text-start">DOB</th>
                    <th className="px-4 py-3.5 text-start">School</th>
                    <th className="px-4 py-3.5 text-start">Father of Confession</th>
                  </>
                )}

                {/* 3. Address Group */}
                {!foldAddress && (
                  <>
                    <th className="px-4 py-3.5 text-start">Street</th>
                    <th className="px-3 py-3.5 text-start">Building</th>
                    <th className="px-3 py-3.5 text-start">Floor</th>
                    <th className="px-3 py-3.5 text-start">Apt</th>
                    <th className="px-4 py-3.5 text-start">Region</th>
                  </>
                )}

                {/* 4. Contacts Group */}
                {!foldContacts && (
                  <>
                    <th className="px-4 py-3.5 text-start">Kid Mobile</th>
                    <th className="px-4 py-3.5 text-start">Father Name</th>
                    <th className="px-4 py-3.5 text-start">Father Job</th>
                    <th className="px-4 py-3.5 text-start">Father Mobile</th>
                    <th className="px-4 py-3.5 text-start">Mother Name</th>
                    <th className="px-4 py-3.5 text-start">Mother Job</th>
                    <th className="px-4 py-3.5 text-start">Mother Mobile</th>
                    <th className="px-4 py-3.5 text-start">Other Mobile</th>
                  </>
                )}

                {/* 5. Notes Group */}
                {!foldNotes && (
                  <th className="px-5 py-3.5 text-start">Pastoral Notes</th>
                )}

                <th className="px-5 py-3.5 text-end w-24">Actions</th>
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

                return (
                  <tr
                    key={kid.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* Active */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        kid.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${kid.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {kid.active ? 'Active' : 'Inactive'}
                      </span>
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
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">{kid.info.fullName}</td>
                        <td className="px-3 py-4 whitespace-nowrap capitalize">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            kid.info.gender === 'female' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60'
                          }`}>
                            {kid.info.gender}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{safeRender(kid.info.dob)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{kid.info.school || '-'}</td>
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
                            <a href={`tel:${kid.contacts.fatherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                              {kid.contacts.fatherMob}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{kid.contacts?.motherName || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{kid.contacts?.motherProfession || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono">
                          {kid.contacts?.motherMob ? (
                            <a href={`tel:${kid.contacts.motherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                              {kid.contacts.motherMob}
                            </a>
                          ) : '-'}
                        </td>
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
  const asgn = existingKid?.activeAssignment || {};

  const [fullName, setFullName] = useState(existingKid?.info.fullName || '');
  const [gender, setGender] = useState<'male' | 'female'>(existingKid?.info.gender || 'male');
  const [dob, setDob] = useState(existingKid?.info.dob || '');
  const [school, setSchool] = useState(existingKid?.info.school || '');
  const [fatherOfConfession, setFatherOfConfession] = useState(existingKid?.info.fatherOfConfession || '');

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

  // Contacts
  const [kidMob, setKidMob] = useState(existingKid?.contacts?.kidMob || '');
  const [fatherName, setFatherName] = useState(existingKid?.contacts?.fatherName || '');
  const [fatherProfession, setFatherProfession] = useState(existingKid?.contacts?.fatherProfession || '');
  const [fatherMob, setFatherMob] = useState(existingKid?.contacts?.fatherMob || '');
  const [motherName, setMotherName] = useState(existingKid?.contacts?.motherName || '');
  const [motherProfession, setMotherProfession] = useState(existingKid?.contacts?.motherProfession || '');
  const [motherMob, setMotherMob] = useState(existingKid?.contacts?.motherMob || '');
  const [otherMob, setOtherMob] = useState(existingKid?.contacts?.otherMob || '');

  // Notes
  const [notes, setNotes] = useState(existingKid?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Student Full Name is required.');
      return;
    }

    onSave({
      info: {
        fullName,
        gender,
        dob,
        school,
        fatherOfConfession,
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
      },
      contacts: {
        kidMob,
        fatherName,
        fatherProfession,
        fatherMob,
        motherName,
        motherProfession,
        motherMob,
        otherMob,
      },
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingKid ? `Edit Student: ${existingKid.info.fullName}` : 'Add New Student'}
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
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
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">School</label>
                <input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="School name"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Father of Confession</label>
                <input
                  value={fatherOfConfession}
                  onChange={(e) => setFatherOfConfession(e.target.value)}
                  placeholder="Abouna name"
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Family Contacts */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 space-y-2">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-300">Family Contacts (Auto-formatted E.164)</h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Father Name</label>
                <input
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Father Profession</label>
                <input
                  value={fatherProfession}
                  onChange={(e) => setFatherProfession(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Father Mobile</label>
                <input
                  value={fatherMob}
                  onChange={(e) => setFatherMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Mother Name</label>
                <input
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Mother Profession</label>
                <input
                  value={motherProfession}
                  onChange={(e) => setMotherProfession(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Mother Mobile</label>
                <input
                  value={motherMob}
                  onChange={(e) => setMotherMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Kid Mobile</label>
                <input
                  value={kidMob}
                  onChange={(e) => setKidMob(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Other Mobile / Emergency</label>
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
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Street</label>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Building</label>
                <input
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Floor</label>
                <input
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Apt</label>
                <input
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Region / District</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Heliopolis, Nasr City, Shoubra"
                className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              />
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
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer"
            >
              Save Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
