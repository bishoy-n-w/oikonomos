import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { ProfilePhotoUploader } from '../components/common/ProfilePhotoUploader';
import { normalizeDateStr, safeRender } from '../utils/formatters';
import { useModalEscape } from '../utils/useModalEscape';
import type { Mister, ServiceGroup, ClassDoc } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Lock,
  RefreshCw,
  Phone,
  MessageSquare,
  Mail 
} from 'lucide-react';

export const ServantsDirectoryScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId 
  } = useFilter();

  const [servants, setServants] = useState<Mister[]>([]);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [classes, setClasses] = useState<ClassDoc[]>([]);

  // Header Filter Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editMister, setEditMister] = useState<Mister | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';
  const currentUserEmail = user?.email?.toLowerCase() || '';

  useModalEscape(() => setEditMister(null), !!editMister);
  useModalEscape(() => setAddModalOpen(false), addModalOpen);

  // 1. Listen to misters
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'misters'), (snap) => {
      const items: Mister[] = snap.docs.map((d) => ({
        id: d.id,
        email: d.data().email || d.id,
        displayName: d.data().displayName || d.id,
        active: d.data().active !== false,
        churchRole: d.data().churchRole || 'viewer',
        personalInfo: {
          ...(d.data().personalInfo || {}),
          dob: normalizeDateStr(d.data().personalInfo?.dob),
        },
        createdAt: d.data().createdAt,
        createdBy: d.data().createdBy,
        lastEditAt: d.data().lastEditAt,
        lastEditBy: d.data().lastEditBy,
      }));
      setServants(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to service groups (to resolve adminInGroups & servantInGroups across all groups)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'serviceGroups'), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ServiceGroup)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to classes (to resolve servantInClasses based on top selected academic year)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'classes'), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassDoc)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // Helper: Find groups where mister is Admin (ignoring top groups filter)
  const getAdminGroups = (email: string): string[] => {
    const key = email.toLowerCase();
    return groups
      .filter((g) => {
        if (g.misters && g.misters[key] === 'admin') return true;
        return (g.admins || []).map((e) => e.toLowerCase()).includes(key);
      })
      .map((g) => g.displayName);
  };

  // Helper: Find groups where mister is Servant (ignoring top groups filter)
  const getServantGroups = (email: string): string[] => {
    const key = email.toLowerCase();
    return groups
      .filter((g) => {
        if (g.misters && g.misters[key] === 'servant') return true;
        return (g.servants || []).map((e) => e.toLowerCase()).includes(key);
      })
      .map((g) => g.displayName);
  };

  // Helper: Find classes where mister is Servant in selected academic year (ignoring top groups/classes filter)
  const getServantClasses = (email: string): string[] => {
    const key = email.toLowerCase();
    return classes
      .filter((cls) => {
        const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
        if (!yearData) return false;
        const misters = (yearData.MistersIds || yearData.servants || []).map((e) => e.toLowerCase());
        return misters.includes(key);
      })
      .map((cls) => {
        const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
        return yearData?.displayName || yearData?.name || cls.id;
      });
  };

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'displayName', type: 'text', placeholder: `${translate('search')} ${translate('student_full_name')}...` },
    { key: 'churchRole', type: 'select', options: [{ value: 'admin', label: 'Admin' }, { value: 'viewer', label: 'Viewer' }] },
    { key: 'adminGroups', type: 'text', placeholder: `${translate('search')} ${translate('admin_in_groups')}...` },
    { key: 'servantGroups', type: 'text', placeholder: `${translate('search')} ${translate('servant_in_groups')}...` },
    { key: 'servantClasses', type: 'text', placeholder: `${translate('search')} ${translate('servant_in_classes')}...` },
    { key: 'email', type: 'text', placeholder: `${translate('search')} ${translate('google_email')}...` },
    { key: 'phone', type: 'text', placeholder: `${translate('search')} ${translate('phone')}...` },
    { key: 'dob', type: 'text', placeholder: `${translate('search')} ${translate('dob')}...` },
    { key: 'job', type: 'text', placeholder: `${translate('search')} ${translate('job')}...` },
    { key: 'address', type: 'text', placeholder: `${translate('search')} ${translate('address')}...` },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Filtered Servants list: filtered by top filters AND Header Filter Matrix
  const filteredServants = servants.filter((m) => {
    const emailKey = m.email.toLowerCase();

    // Top Filter: Service Group Filter
    if (selectedServiceGroupId) {
      const inAdmin = groups.some((g) => g.id === selectedServiceGroupId && ((g.admins || []).includes(m.email) || g.misters?.[emailKey] === 'admin'));
      const inServant = groups.some((g) => g.id === selectedServiceGroupId && ((g.servants || []).includes(m.email) || g.misters?.[emailKey] === 'servant'));
      if (!inAdmin && !inServant) return false;
    }

    // Top Filter: Class Filter
    if (selectedClassId) {
      const targetClass = classes.find((c) => c.id === selectedClassId);
      const yearData = selectedAcademicYearId ? targetClass?.academicYears?.[selectedAcademicYearId] : Object.values(targetClass?.academicYears || {})[0];
      const mistersInClass = (yearData?.MistersIds || yearData?.servants || []).map((e) => e.toLowerCase());
      if (!mistersInClass.includes(emailKey)) return false;
    }

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      if (String(m.active) !== filters.active) return false;
    }
    if (filters.displayName) {
      if (!m.displayName.toLowerCase().includes(filters.displayName.toLowerCase())) return false;
    }
    if (filters.churchRole) {
      if (m.churchRole !== filters.churchRole) return false;
    }
    if (filters.adminGroups) {
      const ag = getAdminGroups(m.email).join(' ').toLowerCase();
      if (!ag.includes(filters.adminGroups.toLowerCase())) return false;
    }
    if (filters.servantGroups) {
      const sg = getServantGroups(m.email).join(' ').toLowerCase();
      if (!sg.includes(filters.servantGroups.toLowerCase())) return false;
    }
    if (filters.servantClasses) {
      const sc = getServantClasses(m.email).join(' ').toLowerCase();
      if (!sc.includes(filters.servantClasses.toLowerCase())) return false;
    }
    if (filters.email) {
      if (!m.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
    }
    if (filters.phone) {
      if (!m.personalInfo?.phone?.includes(filters.phone)) return false;
    }
    if (filters.dob) {
      if (!m.personalInfo?.dob?.includes(filters.dob)) return false;
    }
    if (filters.job) {
      if (!m.personalInfo?.job?.toLowerCase().includes(filters.job.toLowerCase())) return false;
    }
    if (filters.address) {
      if (!m.personalInfo?.address?.toLowerCase().includes(filters.address.toLowerCase())) return false;
    }

    return true;
  });

  // Save Add/Edit Mister
  const handleSaveMister = async (
    targetMister: Mister | null,
    email: string,
    displayName: string,
    churchRole: 'admin' | 'viewer',
    active: boolean,
    personalInfo: any
  ) => {
    if (!selectedChurchId) return;

    const emailKey = email.toLowerCase().trim();
    const isGoogleEmail = emailKey.includes('@') && (emailKey.endsWith('@gmail.com') || emailKey.includes('.'));
    if (!isGoogleEmail) {
      alert('Please enter a valid Google email address.');
      return;
    }

    const misterRef = doc(db, 'churches', selectedChurchId, 'misters', emailKey);
    const isSelfEditing = emailKey === currentUserEmail;

    const payload: any = {
      email: emailKey,
      displayName,
      personalInfo,
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
      ...(!targetMister && {
        authUid: '',
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      }),
    };

    // Self-service safety guard: non-admins cannot change churchRole or active status on own profile
    if (!isSelfEditing || isAdmin) {
      payload.churchRole = churchRole;
      payload.active = active;
    }

    await setDoc(misterRef, payload, { merge: true });
    setAddModalOpen(false);
    setEditMister(null);
  };

  const handleDeleteMister = async (email: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Delete servant "${name}"? This action cannot be undone.`)) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'misters', email.toLowerCase()));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('servants')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredServants.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {translate('servants_subtitle')}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add_servant')}</span>
          </button>
        )}
      </div>

      {/* 1. Mobile Adaptive Touch Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredServants.map((mister) => {
          const adminGroups = getAdminGroups(mister.email);
          const servantClasses = getServantClasses(mister.email);
          const isSelf = mister.email.toLowerCase() === currentUserEmail;
          const phone = mister.personalInfo?.phone;

          return (
            <div
              key={mister.id}
              className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
            >
              {/* Top row: Avatar, Name, Role & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {mister.personalInfo?.photoUrl ? (
                    <img
                      src={mister.personalInfo.photoUrl}
                      alt={mister.displayName}
                      className="w-11 h-11 rounded-2xl object-cover shrink-0 shadow-xs border border-zinc-200 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-bold text-base flex items-center justify-center shrink-0">
                      {mister.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {mister.displayName}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-1.5 py-0.2 rounded-full border border-teal-200 dark:border-teal-800">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 font-mono truncate">{mister.email}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mister.active
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {mister.active ? translate('active_badge') : translate('inactive_badge')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    mister.churchRole === 'admin'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {mister.churchRole}
                  </span>
                </div>
              </div>

              {/* Assignments Tags */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
                {adminGroups.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">{translate('admin_in_groups')}:</span>
                    {adminGroups.map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {servantClasses.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">{translate('servant_in_classes')}:</span>
                    {servantClasses.map((cls) => (
                      <span key={cls} className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                        {cls}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Contact & Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                {phone ? (
                  <>
                    <a
                      href={`tel:${phone}`}
                      className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 transition active:scale-95 touch-manipulation"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{translate('phone')}</span>
                    </a>
                    <a
                      href={`https://wa.me/${phone.replace(/\+/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 transition active:scale-95 touch-manipulation"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                ) : (
                  <a
                    href={`mailto:${mister.email}`}
                    className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition active:scale-95 touch-manipulation"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>Email</span>
                  </a>
                )}

                {(isAdmin || isSelf) && (
                  <button
                    onClick={() => setEditMister(mister)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition touch-manipulation"
                    title="Edit Servant"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && !isSelf && (
                  <button
                    onClick={() => handleDeleteMister(mister.email, mister.displayName)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition touch-manipulation"
                    title="Delete Servant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Desktop High-Density 12-Column Table (>= md) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 text-start w-20">{translate('active_badge')}</th>
                <th className="px-5 py-3.5 text-start">{translate('student_full_name')}</th>
                <th className="px-4 py-3.5 text-start">{translate('church_role')}</th>
                <th className="px-5 py-3.5 text-start">{translate('admin_in_groups')}</th>
                <th className="px-5 py-3.5 text-start">{translate('servant_in_groups')}</th>
                <th className="px-5 py-3.5 text-start">{translate('servant_in_classes')}</th>
                <th className="px-5 py-3.5 text-start">{translate('google_email')}</th>
                <th className="px-4 py-3.5 text-start">{translate('phone')}</th>
                <th className="px-4 py-3.5 text-start">{translate('dob')}</th>
                <th className="px-4 py-3.5 text-start">{translate('job')}</th>
                <th className="px-5 py-3.5 text-start">{translate('address')}</th>
                <th className="px-4 py-3.5 text-end w-24">{translate('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredServants.map((mister) => {
                const adminGroups = getAdminGroups(mister.email);
                const servantGroups = getServantGroups(mister.email);
                const servantClasses = getServantClasses(mister.email);
                const isSelf = mister.email.toLowerCase() === currentUserEmail;

                return (
                  <tr
                    key={mister.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        mister.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${mister.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {mister.active ? translate('active_badge') : translate('inactive_badge')}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {mister.personalInfo?.photoUrl ? (
                          <img
                            src={mister.personalInfo.photoUrl}
                            alt={mister.displayName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 shadow-xs border border-zinc-200 dark:border-zinc-700"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {mister.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span>{mister.displayName}</span>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-1.5 py-0.2 rounded-full border border-teal-200 dark:border-teal-800">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. ChurchRole */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        mister.churchRole === 'admin'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {mister.churchRole}
                      </span>
                    </td>

                    {/* 4. Admin in groups (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {adminGroups.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {adminGroups.map((g) => (
                          <span key={g} className="inline-block px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-semibold truncate">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 5. Servant in groups (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {servantGroups.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {servantGroups.map((g) => (
                          <span key={g} className="inline-block px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold truncate">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 6. Servant in classes (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {servantClasses.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {servantClasses.map((cls) => (
                          <span key={cls} className="inline-block px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[10px] font-semibold truncate">
                            {cls}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 7. Email */}
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {mister.email}
                    </td>

                    {/* 8. Phone */}
                    <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px]">
                      {mister.personalInfo?.phone ? (
                        <a href={`tel:${mister.personalInfo.phone}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                          {mister.personalInfo.phone}
                        </a>
                      ) : '-'}
                    </td>

                    {/* 9. DOB */}
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-500">
                      {safeRender(mister.personalInfo?.dob)}
                    </td>

                    {/* 10. Job */}
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {mister.personalInfo?.job || '-'}
                    </td>

                    {/* 11. Address */}
                    <td className="px-5 py-4 whitespace-nowrap text-zinc-500">
                      {mister.personalInfo?.address || '-'}
                    </td>

                    {/* 12. Actions */}
                    <td className="px-4 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {(isAdmin || isSelf) && (
                          <button
                            onClick={() => setEditMister(mister)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit Servant"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => handleDeleteMister(mister.email, mister.displayName)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Servant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add / Edit Mister Modal */}
      {(addModalOpen || editMister) && (
        <MisterFormModal
          existingMister={editMister}
          isAdmin={isAdmin}
          isSelf={editMister?.email.toLowerCase() === currentUserEmail}
          onClose={() => {
            setAddModalOpen(false);
            setEditMister(null);
          }}
          onSave={handleSaveMister}
        />
      )}
    </div>
  );
};

// Sub-component: Form modal for Add / Edit Mister
interface MisterFormModalProps {
  existingMister: Mister | null;
  isAdmin: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSave: (
    targetMister: Mister | null,
    email: string,
    displayName: string,
    churchRole: 'admin' | 'viewer',
    active: boolean,
    personalInfo: any
  ) => void;
}

const MisterFormModal: React.FC<MisterFormModalProps> = ({
  existingMister,
  isAdmin,
  isSelf,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  const [email, setEmail] = useState(existingMister?.email || '');
  const [displayName, setDisplayName] = useState(existingMister?.displayName || '');
  const [churchRole, setChurchRole] = useState<'admin' | 'viewer'>(existingMister?.churchRole || 'viewer');
  const [active, setActive] = useState(existingMister ? existingMister.active !== false : true);
  const [isSaving, setIsSaving] = useState(false);

  // Personal Info state
  const [phone, setPhone] = useState(existingMister?.personalInfo?.phone || '');
  const [gender, setGender] = useState<'male' | 'female'>(existingMister?.personalInfo?.gender || 'male');
  const [dob, setDob] = useState(existingMister?.personalInfo?.dob || '');
  const [job, setJob] = useState(existingMister?.personalInfo?.job || '');
  const [address, setAddress] = useState(existingMister?.personalInfo?.address || '');
  const [notes, setNotes] = useState(existingMister?.personalInfo?.notes || '');
  const [photoUrl, setPhotoUrl] = useState(existingMister?.personalInfo?.photoUrl || '');

  const canEditRoleAndActive = isAdmin && (!isSelf || existingMister === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) {
      alert('Email and Full Name are mandatory.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        existingMister,
        email,
        displayName,
        churchRole,
        active,
        {
          phone,
          gender,
          dob,
          job,
          address,
          notes,
          photoUrl: photoUrl || undefined,
        }
      );
    } catch (err: any) {
      console.error('Save servant failed:', err);
      alert(`Error saving servant: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingMister ? `${translate('edit')} ${translate('servant')}: ${existingMister.displayName}` : translate('add_servant')}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <fieldset disabled={isSaving} className="space-y-4">
          {/* Profile Photo Uploader */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
            <ProfilePhotoUploader
              photoUrl={photoUrl}
              name={displayName}
              gender={gender}
              onPhotoChange={(url) => setPhotoUrl(url || '')}
              size="md"
            />
            <div className="text-xs">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{translate('profile_photo')}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Click photo to upload from device or capture with camera.</p>
            </div>
          </div>

          {/* Mandated Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('servant_full_name')} *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('google_email')} *</label>
              <input
                type="email"
                value={email}
                disabled={!!existingMister}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@gmail.com"
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono disabled:opacity-60"
              />
            </div>
          </div>

          {/* Role and Active Status (Locked for non-admin self-service) */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>{translate('church_role')} *</span>
                {!canEditRoleAndActive && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <select
                value={churchRole}
                disabled={!canEditRoleAndActive}
                onChange={(e) => setChurchRole(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold disabled:opacity-50"
              >
                <option value="viewer">Viewer / Teacher</option>
                <option value="admin">Church Admin</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>{translate('active_badge')} *</span>
                {!canEditRoleAndActive && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <select
                value={active ? 'true' : 'false'}
                disabled={!canEditRoleAndActive}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold disabled:opacity-50"
              >
                <option value="true">{translate('active_badge')}</option>
                <option value="false">{translate('inactive_badge')}</option>
              </select>
            </div>
          </div>

          {/* Optional Personal Info */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs uppercase text-zinc-400">Personal Information (Optional)</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('phone')}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('gender')}</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                >
                  <option value="male">{translate('male')}</option>
                  <option value="female">{translate('female')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('dob')}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('job')}</label>
                <input
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('address')}</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Building, City..."
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{translate('notes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
              />
            </div>
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
