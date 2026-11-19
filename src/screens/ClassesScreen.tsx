import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { MobileViewToggle } from '../components/common/MobileViewToggle';
import { useModalEscape } from '../utils/useModalEscape';
import type { ClassDoc, Church, Mister, Kid, ClassYearData, DropdownItem } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Search, 
  Check, 
  Users, 
  Baby,
  RefreshCw,
  Eye
} from 'lucide-react';

export const ClassesScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate, mobileViewMode } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    serviceGroups, 
    academicYears,
    canEditClass,
    canViewClass
  } = useFilter();

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [allMisters, setAllMisters] = useState<Mister[]>([]);
  const [allKids, setAllKids] = useState<Kid[]>([]);

  // Header Filter Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassDoc | null>(null);
  const [rosterPreview, setRosterPreview] = useState<{ className: string; kidIds: string[]; misterIds: string[] } | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  useModalEscape(() => setEditClass(null), !!editClass);
  useModalEscape(() => setAddModalOpen(false), addModalOpen);
  useModalEscape(() => setRosterPreview(null), !!rosterPreview);

  // 1. Listen to Church (for grades taxonomy)
  useEffect(() => {
    if (!selectedChurchId) {
      setCurrentChurch(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'churches', selectedChurchId), (snap) => {
      if (snap.exists()) {
        setCurrentChurch({ id: snap.id, ...snap.data() } as Church);
      }
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to Misters
  useEffect(() => {
    if (!selectedChurchId) {
      setAllMisters([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'misters'), (snap) => {
      setAllMisters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mister)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to Kids in Church
  useEffect(() => {
    if (!selectedChurchId) {
      setAllKids([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'kids'), (snap) => {
      setAllKids(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Kid)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 4. Listen to Classes
  useEffect(() => {
    if (!selectedChurchId) {
      setClasses([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'classes'), (snap) => {
      const items: ClassDoc[] = snap.docs.map((d) => ({
        id: d.id,
        active: d.data().active !== false,
        academicYears: d.data().academicYears || {},
        serviceGroupId: d.data().serviceGroupId,
        createdAt: d.data().createdAt,
        createdBy: d.data().createdBy,
      }));
      setClasses(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'className', type: 'text', placeholder: `${translate('search')} ${translate('class_name')}...` },
    { key: 'groupName', type: 'text', placeholder: `${translate('search')} ${translate('service_group')}...` },
    { key: 'gradeName', type: 'text', placeholder: `${translate('search')} ${translate('grade_level')}...` },
    { key: 'kidsCount', type: 'number', placeholder: translate('min_kids') },
    { key: 'mistersCount', type: 'number', placeholder: translate('min_servants') },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper to extract year data based on selectedAcademicYearId
  const getYearData = (cls: ClassDoc): ClassYearData | null => {
    if (!selectedAcademicYearId) return Object.values(cls.academicYears)[0] || null;
    return cls.academicYears[selectedAcademicYearId] || null;
  };

  // Filtered classes: respects Top Filters (Church, AcademicYear, Service Group) AND Header Filter Matrix!
  const filteredClasses = classes.filter((cls) => {
    // 3-Tier Security: Servants in church but not in this service group have ZERO access
    if (!canViewClass(cls.id)) return false;

    const yearData = getYearData(cls);
    if (!yearData) return false;

    // Mobile Quick Search
    if (mobileSearchQuery.trim()) {
      const q = mobileSearchQuery.toLowerCase().trim();
      const name = (yearData.displayName || yearData.name || '').toLowerCase();
      const gName = (serviceGroups.find((g) => g.id === yearData.serviceGroupId)?.displayName || yearData.serviceGroupId || '').toLowerCase();
      const grade = (currentChurch?.grades?.[yearData.gradeId || '']?.name || yearData.gradeId || '').toLowerCase();
      if (!name.includes(q) && !gName.includes(q) && !grade.includes(q)) return false;
    }

    // Top filter: Service Group filter
    if (selectedServiceGroupId && yearData.serviceGroupId !== selectedServiceGroupId) {
      return false;
    }

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      if (String(cls.active) !== filters.active) return false;
    }
    if (filters.className) {
      const name = yearData.displayName || yearData.name || '';
      if (!name.toLowerCase().includes(filters.className.toLowerCase())) return false;
    }
    if (filters.groupName) {
      const gName = serviceGroups.find((g) => g.id === yearData.serviceGroupId)?.displayName || yearData.serviceGroupId;
      if (!gName.toLowerCase().includes(filters.groupName.toLowerCase())) return false;
    }
    if (filters.gradeName) {
      const grade = currentChurch?.grades?.[yearData.gradeId || '']?.name || yearData.gradeId || '';
      if (!grade.toLowerCase().includes(filters.gradeName.toLowerCase())) return false;
    }
    if (filters.kidsCount) {
      const count = allKids.filter((k) =>
        k.active !== false && (
          k.activeAssignment?.classId === cls.id ||
          (yearData.KidIds || yearData.kids || []).includes(k.id)
        )
      ).length;
      if (count < parseInt(filters.kidsCount, 10)) return false;
    }
    if (filters.mistersCount) {
      const count = (yearData.MistersIds || yearData.servants || []).length;
      if (count < parseInt(filters.mistersCount, 10)) return false;
    }
    return true;
  });

  // Save Add/Edit Class
  const handleSaveClass = async (
    classId: string | null,
    academicYearId: string,
    displayName: string,
    serviceGroupId: string,
    gradeId: string,
    kidIds: string[],
    misterIds: string[],
    active: boolean
  ) => {
    if (!selectedChurchId) return;

    const docId = classId || displayName.trim().toLowerCase().replace(/\s+/g, '_');
    const classRef = doc(db, 'churches', selectedChurchId, 'classes', docId);

    const targetClass = classes.find((c) => c.id === docId);
    const existingYears = targetClass?.academicYears || {};

    const payload = {
      active,
      serviceGroupId,
      academicYears: {
        ...existingYears,
        [academicYearId]: {
          displayName,
          name: displayName,
          serviceGroupId,
          gradeId,
          KidIds: kidIds,
          kids: kidIds,
          MistersIds: misterIds,
          servants: misterIds,
        },
      },
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
      ...(!targetClass && {
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      }),
    };

    const batch = writeBatch(db);
    batch.set(classRef, payload, { merge: true });

    // Step 2: Ensure any servants assigned to this class are strictly members of the parent group
    if (misterIds.length > 0 && serviceGroupId) {
      const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', serviceGroupId);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        const groupAdmins = (groupData.admins || []).map((e: string) => e.toLowerCase().trim());
        const groupServants = (groupData.servants || []).map((e: string) => e.toLowerCase().trim());
        const groupMistersMap = { ...(groupData.misters || {}) };

        let groupUpdated = false;

        misterIds.forEach((misterId) => {
          const normalized = misterId.toLowerCase().trim();
          const hasAdminRole = groupAdmins.includes(normalized) || groupMistersMap[normalized] === 'admin';
          const hasServantRole = groupServants.includes(normalized) || groupMistersMap[normalized] === 'servant';

          // If they have NO role in the group at all, enroll them as a default 'servant'
          if (!hasAdminRole && !hasServantRole) {
            groupMistersMap[normalized] = 'servant';
            groupUpdated = true;
          }
        });

        if (groupUpdated) {
          batch.set(groupRef, {
            misters: groupMistersMap,
            lastEditAt: new Date().toISOString(),
            lastEditBy: user?.email,
          }, { merge: true });
        }
      }
    }

    // Step 3: Bidirectional sync with Kids collection
    const previouslyAssignedKids = allKids.filter((k) => k.activeAssignment?.classId === docId);
    
    const kidOperations: Array<{ ref: any, payload: any }> = [];

    // Update newly assigned kids
    kidIds.forEach((kId) => {
      const kRef = doc(db, 'churches', selectedChurchId, 'kids', kId);
      kidOperations.push({
        ref: kRef,
        payload: {
          'activeAssignment.academicYearId': academicYearId,
          'activeAssignment.serviceGroupId': serviceGroupId,
          'activeAssignment.classId': docId,
          academicYearId,
          serviceGroupId,
          classId: docId,
          lastEditAt: new Date().toISOString(),
          lastEditBy: user?.email,
        }
      });
    });

    // Clear classId for any kids removed from this class
    previouslyAssignedKids
      .filter((k) => !kidIds.includes(k.id))
      .forEach((k) => {
        const kRef = doc(db, 'churches', selectedChurchId, 'kids', k.id);
        kidOperations.push({
          ref: kRef,
          payload: {
            'activeAssignment.classId': '',
            classId: '',
            lastEditAt: new Date().toISOString(),
            lastEditBy: user?.email,
          }
        });
      });

    // Process all kid updates in chunked 400-op batches (reserving space for class/group)
    const BATCH_LIMIT = 400;
    
    // Commit the primary batch (Class + Group)
    await batch.commit();

    // Commit kid assignment chunks sequentially
    for (let i = 0; i < kidOperations.length; i += BATCH_LIMIT) {
      const chunk = kidOperations.slice(i, i + BATCH_LIMIT);
      const chunkBatch = writeBatch(db);
      chunk.forEach((op) => {
        chunkBatch.update(op.ref, op.payload);
      });
      await chunkBatch.commit();
    }

    setAddModalOpen(false);
    setEditClass(null);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm('Delete this class? This will remove its configurations.')) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'classes', classId));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('classes')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredClasses.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {translate('classes_subtitle')}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add_class')}</span>
          </button>
        )}
      </div>

      {/* 1. Mobile Adaptive Touch Cards (< md) */}
      <div className="md:hidden space-y-3">
        {/* Mobile Quick Search & View Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              placeholder={`${translate('search')} ${translate('classes')}...`}
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
          <MobileViewToggle />
        </div>

        {mobileViewMode === 'list' ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            {filteredClasses.map((cls) => {
              const yearData = getYearData(cls);
              if (!yearData) return null;

              const group = serviceGroups.find((g) => g.id === yearData.serviceGroupId);
              const gradeItem = currentChurch?.grades?.[yearData.gradeId || ''];
              const storedKidIds = yearData.KidIds || yearData.kids || [];
              const assignedFromDirectory = allKids
                .filter((k) => k.active !== false && k.activeAssignment?.classId === cls.id)
                .map((k) => k.id);
              const effectiveKidIds = Array.from(new Set([...storedKidIds, ...assignedFromDirectory]));
              const kidsCount = effectiveKidIds.length;
              const servantsCount = (yearData.MistersIds || yearData.servants || []).length;

              return (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 gap-2 transition hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cls.active !== false ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canEditClass(cls.id) ? (
                          <button
                            type="button"
                            onClick={() => setEditClass(cls)}
                            className="font-bold text-xs text-zinc-900 dark:text-zinc-100 hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer text-start truncate"
                          >
                            {yearData.displayName || cls.id}
                          </button>
                        ) : (
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            {yearData.displayName || cls.id}
                          </span>
                        )}
                        {gradeItem && (
                          <span className="text-[9px] font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-1 py-0.2 rounded border border-teal-200 dark:border-teal-800 shrink-0">
                            #{yearData.gradeId}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {group?.displayName || yearData.serviceGroupId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRosterPreview({
                        className: yearData.displayName || cls.id,
                        kidIds: effectiveKidIds,
                        misterIds: yearData.MistersIds || yearData.servants || [],
                      })}
                      className="px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[11px] font-bold border border-teal-200 dark:border-teal-800 cursor-pointer"
                    >
                      {kidsCount} {translate('kids')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterPreview({
                        className: yearData.displayName || cls.id,
                        kidIds: effectiveKidIds,
                        misterIds: yearData.MistersIds || yearData.servants || [],
                      })}
                      className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      {servantsCount} {translate('servants')}
                    </button>
                    {canEditClass(cls.id) && (
                      <button
                        type="button"
                        onClick={() => setEditClass(cls)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-teal-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
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
        filteredClasses.map((cls) => {
          const yearData = getYearData(cls);
          if (!yearData) return null;

          const group = serviceGroups.find((g) => g.id === yearData.serviceGroupId);
          const gradeItem = currentChurch?.grades?.[yearData.gradeId || ''];
          const storedKidIds = yearData.KidIds || yearData.kids || [];
          const assignedFromDirectory = allKids
            .filter((k) => k.active !== false && k.activeAssignment?.classId === cls.id)
            .map((k) => k.id);
          const effectiveKidIds = Array.from(new Set([...storedKidIds, ...assignedFromDirectory]));
          const kidsCount = effectiveKidIds.length;
          const servantsCount = (yearData.MistersIds || yearData.servants || []).length;

          return (
            <div
              key={cls.id}
              className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
            >
              {/* Header: Class Name, Status & Group */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEditClass(cls.id) ? (
                      <button
                        type="button"
                        onClick={() => setEditClass(cls)}
                        className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer text-start"
                      >
                        {yearData.displayName || cls.id}
                      </button>
                    ) : (
                      <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                        {yearData.displayName || cls.id}
                      </h3>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cls.active !== false
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {cls.active !== false ? translate('active_badge') : translate('inactive_badge')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {group?.displayName || yearData.serviceGroupId}
                  </p>
                </div>

                {gradeItem && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold shrink-0">
                    <span className="font-mono text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-900/60 text-[10px]" dir="ltr">
                      #{yearData.gradeId}
                    </span>
                    <bdi>{gradeItem.name}</bdi>
                  </span>
                )}
              </div>

              {/* Counts & Badges */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setRosterPreview({
                    className: yearData.displayName || cls.id,
                    kidIds: effectiveKidIds,
                    misterIds: yearData.MistersIds || yearData.servants || [],
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold text-xs text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                  title="View enrolled students"
                >
                  <Baby className="w-3.5 h-3.5 text-teal-600" />
                  <span>{kidsCount} {translate('kids')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterPreview({
                    className: yearData.displayName || cls.id,
                    kidIds: effectiveKidIds,
                    misterIds: yearData.MistersIds || yearData.servants || [],
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 font-bold text-xs text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                  title="View assigned servants"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>{servantsCount} {translate('servants')}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                {canEditClass(cls.id) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditClass(cls)}
                      className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 transition active:scale-95 touch-manipulation"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{translate('edit')}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition touch-manipulation"
                        title="Delete Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold">
                    <Eye className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{translate('view_only_mode')}</span>
                  </span>
                )}
              </div>
            </div>
          );
        }))}
      </div>

      {/* 2. Desktop High-Density Table (>= md) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 text-start w-24">{translate('active_badge')}</th>
                <th className="px-6 py-3.5 text-start">{translate('class_name')}</th>
                <th className="px-6 py-3.5 text-start">{translate('service_group')}</th>
                <th className="px-6 py-3.5 text-start">{translate('grade_level')}</th>
                <th className="px-6 py-3.5 text-start">{translate('enrolled_kids')}</th>
                <th className="px-6 py-3.5 text-start">{translate('servants')}</th>
                <th className="px-6 py-3.5 text-end w-28">{translate('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredClasses.map((cls) => {
                const yearData = getYearData(cls);
                if (!yearData) return null;

                const groupName = serviceGroups.find((g) => g.id === yearData.serviceGroupId)?.displayName || yearData.serviceGroupId;
                const gradeItem = currentChurch?.grades?.[yearData.gradeId || ''];
                const storedKidIds = yearData.KidIds || yearData.kids || [];
                const assignedFromDirectory = allKids
                  .filter((k) => k.active !== false && k.activeAssignment?.classId === cls.id)
                  .map((k) => k.id);
                const effectiveKidIds = Array.from(new Set([...storedKidIds, ...assignedFromDirectory]));
                const kidsCount = effectiveKidIds.length;
                const servantsCount = (yearData.MistersIds || yearData.servants || []).length;

                return (
                  <tr
                    key={cls.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        cls.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cls.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {cls.active ? translate('active_badge') : translate('inactive_badge')}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {canEditClass(cls.id) ? (
                        <button
                          type="button"
                          onClick={() => setEditClass(cls)}
                          className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer transition text-start truncate block max-w-xs"
                        >
                          {yearData.displayName || yearData.name || cls.id}
                        </button>
                      ) : (
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {yearData.displayName || yearData.name || cls.id}
                        </span>
                      )}
                    </td>

                    {/* 3. ServiceGroupId DisplayName */}
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-zinc-600 dark:text-zinc-300">
                      {groupName}
                    </td>

                    {/* 4. GradeId DisplayName with Pre-ID badge and bdi isolation */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {gradeItem ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold">
                          <span
                            className="font-mono text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-900/60 text-[10px]"
                            dir="ltr"
                          >
                            #{yearData.gradeId}
                          </span>
                          <bdi>{gradeItem.name}</bdi>
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">-</span>
                      )}
                    </td>

                    {/* 5. KidIds (sum of total) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setRosterPreview({
                          className: yearData.displayName || yearData.name || cls.id,
                          kidIds: effectiveKidIds,
                          misterIds: yearData.MistersIds || yearData.servants || [],
                        })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                        title="Click to view enrolled students"
                      >
                        <Baby className="w-3.5 h-3.5 text-teal-600" />
                        <span>{kidsCount} {translate('kids')}</span>
                      </button>
                    </td>

                    {/* 6. MistersIds (sum of total) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setRosterPreview({
                          className: yearData.displayName || yearData.name || cls.id,
                          kidIds: effectiveKidIds,
                          misterIds: yearData.MistersIds || yearData.servants || [],
                        })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 font-bold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                        title="Click to view assigned servants"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{servantsCount} {translate('servants')}</span>
                      </button>
                    </td>

                    {/* 7. Actions */}
                    <td className="px-6 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditClass(cls.id) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditClass(cls)}
                              className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                              title="Edit Class"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(cls.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Delete Class"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold">
                            <Eye className="w-3 h-3 text-zinc-400" />
                            <span>{translate('view_only_mode')}</span>
                          </span>
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

      {/* Class Modal (Add & Edit) */}
      {(addModalOpen || editClass) && (
        <ClassFormModal
          existingClass={editClass}
          academicYears={academicYears}
          serviceGroups={serviceGroups}
          currentChurch={currentChurch}
          allMisters={allMisters}
          allKids={allKids}
          initialYearId={selectedAcademicYearId || academicYears[0]?.id || ''}
          initialGroupId={selectedServiceGroupId || serviceGroups[0]?.id || ''}
          onClose={() => {
            setAddModalOpen(false);
            setEditClass(null);
          }}
          onSave={handleSaveClass}
        />
      )}

      {/* Roster Preview Modal */}
      {rosterPreview && (
        <RosterPreviewModal
          data={rosterPreview}
          allKids={allKids}
          allMisters={allMisters}
          onClose={() => setRosterPreview(null)}
        />
      )}
    </div>
  );
};

// Modal for viewing enrolled kids and servants in a class
interface RosterPreviewModalProps {
  data: { className: string; kidIds: string[]; misterIds: string[] };
  allKids: Kid[];
  allMisters: Mister[];
  onClose: () => void;
}

const RosterPreviewModal: React.FC<RosterPreviewModalProps> = ({
  data,
  allKids,
  allMisters,
  onClose,
}) => {
  const { translate } = useApp();
  const [activeTab, setActiveTab] = useState<'kids' | 'servants'>('kids');
  const [search, setSearch] = useState('');

  useModalEscape(onClose, true);

  const enrolledKids = allKids.filter((k) => data.kidIds.includes(k.id));
  const assignedServants = allMisters.filter((m) => {
    const email = (m.email || m.id || '').toLowerCase().trim();
    return data.misterIds.some((id) => id.toLowerCase().trim() === email);
  });

  const filteredKids = enrolledKids.filter((k) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (k.info.fullName || '').toLowerCase().includes(q) ||
      (k.contacts?.fatherName || '').toLowerCase().includes(q) ||
      (k.contacts?.fatherMob || '').includes(q)
    );
  });

  const filteredServants = assignedServants.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85dvh] flex flex-col cursor-default"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
              {data.className}
            </h3>
            <p className="text-xs text-zinc-400">Class Roster & Servants</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 my-3 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('kids')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'kids'
                ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>{translate('enrolled_kids')} ({enrolledKids.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('servants')}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'servants'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{translate('servants')} ({assignedServants.length})</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within class..."
            className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pe-1">
          {activeTab === 'kids' ? (
            filteredKids.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">No students found</div>
            ) : (
              filteredKids.map((kid) => (
                <div
                  key={kid.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
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
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{kid.info.fullName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : (kid.address?.region || 'Sunday School')}
                      </p>
                    </div>
                  </div>
                  {kid.contacts?.fatherMob && (
                    <a
                      href={`tel:${kid.contacts.fatherMob}`}
                      className="px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-[11px] shrink-0"
                    >
                      Call
                    </a>
                  )}
                </div>
              ))
            )
          ) : (
            filteredServants.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">No servants found</div>
            ) : (
              filteredServants.map((mister) => (
                <div
                  key={mister.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-blue-50 text-blue-700 font-bold text-xs">
                      {mister.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{mister.displayName}</p>
                      <p className="text-[10px] text-zinc-400 truncate font-mono">{mister.email}</p>
                    </div>
                  </div>
                  {mister.personalInfo?.phone && (
                    <a
                      href={`tel:${mister.personalInfo.phone}`}
                      className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px] shrink-0"
                    >
                      Call
                    </a>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

// Modal for Adding or Editing a Class with dynamic grade selection and chips for servants and kids
interface ClassFormModalProps {
  existingClass: ClassDoc | null;
  academicYears: DropdownItem[];
  serviceGroups: DropdownItem[];
  currentChurch: Church | null;
  allMisters: Mister[];
  allKids: Kid[];
  initialYearId: string;
  initialGroupId: string;
  onClose: () => void;
  onSave: (
    classId: string | null,
    academicYearId: string,
    displayName: string,
    serviceGroupId: string,
    gradeId: string,
    kidIds: string[],
    misterIds: string[],
    active: boolean
  ) => void;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({
  existingClass,
  academicYears,
  serviceGroups,
  currentChurch,
  allMisters,
  allKids,
  initialYearId,
  initialGroupId,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  const existingYearData = existingClass ? (existingClass.academicYears[initialYearId] || Object.values(existingClass.academicYears)[0]) : null;

  const [active, setActive] = useState(existingClass ? existingClass.active !== false : true);
  const [selectedYearId, setSelectedYearId] = useState(initialYearId);
  const [displayName, setDisplayName] = useState(existingYearData?.displayName || existingYearData?.name || '');
  const [selectedGroupId, setSelectedGroupId] = useState(existingYearData?.serviceGroupId || initialGroupId);
  const [selectedGradeId, setSelectedGradeId] = useState(existingYearData?.gradeId || '');
  const [isSaving, setIsSaving] = useState(false);

  // Misters & Kids chips state
  const [selectedMisterIds, setSelectedMisterIds] = useState<string[]>(
    existingYearData?.MistersIds || existingYearData?.servants || []
  );
  // Derive initially assigned kids: merges stored KidIds on class doc with activeAssignment.classId on kids
  const assignedFromKids = allKids
    .filter((k) => k.active !== false && k.activeAssignment?.classId === existingClass?.id)
    .map((k) => k.id);
  const storedKidIds = existingYearData?.KidIds || existingYearData?.kids || [];
  const initialKidIds = Array.from(new Set([...storedKidIds, ...assignedFromKids]));

  const [selectedKidIds, setSelectedKidIds] = useState<string[]>(initialKidIds);

  // Derive allowed servants based on selected Service Group
  const allowedMisterEmails = useMemo(() => {
    const set = new Set<string>();
    const targetGroup = serviceGroups.find((g) => g.id === selectedGroupId);
    if (targetGroup?.data) {
      const data = targetGroup.data;
      Object.keys(data.misters || {}).forEach((e) => set.add(e.toLowerCase().trim()));
      (data.admins || []).forEach((e: string) => set.add(e.toLowerCase().trim()));
      (data.servants || []).forEach((e: string) => set.add(e.toLowerCase().trim()));
    }
    return set;
  }, [selectedGroupId, serviceGroups]);
  
  const availableGroupMisters = allMisters.filter((m) => {
    const email = (m.email || m.id || '').toLowerCase().trim();
    return allowedMisterEmails.has(email);
  });

  // Auto-clean selected misters if service group changes
  useEffect(() => {
    setSelectedMisterIds((prev) => prev.filter((id) => allowedMisterEmails.has(id.toLowerCase().trim())));
  }, [selectedGroupId, allowedMisterEmails]);

  // Popups for selecting misters and kids
  const [misterPickerOpen, setMisterPickerOpen] = useState(false);
  const [kidPickerOpen, setKidPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Dynamically filter grades based on the selected serviceGroupId from currentChurch.grades!
  const availableGrades = Object.entries(currentChurch?.grades || {})
    .filter(([, item]) => item.serviceGroupId === selectedGroupId)
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
    .map(([intKey, item]) => ({ id: intKey, displayName: `#${intKey} - ${item.name}` }));

  // Auto-set gradeId if not valid for selected group
  useEffect(() => {
    if (availableGrades.length > 0 && !availableGrades.some((g) => g.id === selectedGradeId)) {
      setSelectedGradeId(availableGrades[0].id);
    }
  }, [selectedGroupId, availableGrades, selectedGradeId]);

  const handleToggleMister = (email: string) => {
    const key = email.toLowerCase();
    if (selectedMisterIds.includes(key)) {
      setSelectedMisterIds(selectedMisterIds.filter((e) => e !== key));
    } else {
      setSelectedMisterIds([...selectedMisterIds, key]);
    }
  };

  const handleToggleKid = (kidId: string) => {
    if (selectedKidIds.includes(kidId)) {
      setSelectedKidIds(selectedKidIds.filter((k) => k !== kidId));
    } else {
      setSelectedKidIds([...selectedKidIds, kidId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      alert('Class name is mandatory.');
      return;
    }
    if (!selectedGroupId) {
      alert('Service group selection is mandatory.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        existingClass ? existingClass.id : null,
        selectedYearId,
        displayName,
        selectedGroupId,
        selectedGradeId,
        selectedKidIds,
        selectedMisterIds,
        active
      );
    } catch (err: any) {
      console.error('Save class failed:', err);
      alert(`Error saving class: ${err.message || 'Unknown error'}`);
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
        className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto cursor-default"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingClass ? `${translate('edit')} ${translate('class_label')}` : translate('add_class')}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <fieldset disabled={isSaving} className="space-y-4">
          {/* Active Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('active_badge')} *</label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                <option value="true">{translate('active_badge')}</option>
                <option value="false">{translate('inactive_badge')}</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('academic_year')} *</label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Class Display Name */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('class_name')} *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Grade 4 St. George"
              required
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
            />
          </div>

          {/* Service Group & Dynamically Bound Grade Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('service_group')} *</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {serviceGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {translate('grade_level')} *
              </label>
              <select
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {availableGrades.length === 0 && (
                  <option value="" disabled>{translate('no_grades_linked')}</option>
                )}
                {availableGrades.map((gr) => (
                  <option key={gr.id} value={gr.id}>
                    {gr.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Misters Chips Section */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{translate('servants')} ({selectedMisterIds.length})</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setMisterPickerOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{translate('add')} {translate('servant')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/60 max-h-32 overflow-y-auto">
              {selectedMisterIds.length === 0 && (
                <span className="text-zinc-400 text-xs my-auto">{translate('no_servants')}</span>
              )}
              {selectedMisterIds.map((email) => {
                const m = allMisters.find((mis) => mis.email.toLowerCase() === email.toLowerCase());
                const name = m?.displayName || email;
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 text-xs font-semibold"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleMister(email)}
                      className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Kids Chips Section */}
          <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <Baby className="w-4 h-4 text-teal-600" />
                <span>{translate('enrolled_kids')} ({selectedKidIds.length})</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setKidPickerOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{translate('add')} {translate('kids')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-800/60 max-h-36 overflow-y-auto">
              {selectedKidIds.length === 0 && (
                <span className="text-zinc-400 text-xs my-auto">{translate('no_kids_assigned')}</span>
              )}
              {selectedKidIds.map((kId) => {
                const k = allKids.find((kid) => kid.id === kId);
                const name = k?.info?.fullName || kId;
                return (
                  <span
                    key={kId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 text-xs font-semibold"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleKid(kId)}
                      className="p-0.5 rounded-full hover:bg-teal-200 dark:hover:bg-teal-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
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

      {/* Mister Picker Modal (Part of selected group above) */}
      {misterPickerOpen && (
        <div 
          onClick={() => setMisterPickerOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Select Servants for Class
                </h4>
                <p className="text-[11px] text-zinc-400">Filtered to servants in this church</p>
              </div>
              <button onClick={() => setMisterPickerOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative my-3">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search servant name or email..."
                className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pe-1">
              {availableGroupMisters.length === 0 && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center space-y-2 mt-2">
                  <Users className="w-6 h-6 text-blue-600 mx-auto" />
                  <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold leading-relaxed">
                    {translate('no_servants_in_group_hint')}
                  </p>
                </div>
              )}

              {availableGroupMisters
                .filter((m) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase().trim();
                  const email = (m.email || m.id || '').toLowerCase();
                  return m.displayName.toLowerCase().includes(q) || email.includes(q);
                })
                .map((mister) => {
                  const mEmail = (mister.email || mister.id || '').toLowerCase().trim();
                  const isSelected = selectedMisterIds.some(
                    (id) => id.toLowerCase().trim() === mEmail
                  );

                  return (
                    <div
                      key={mister.id}
                      onClick={() => handleToggleMister(mEmail)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700'
                          : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {mister.personalInfo?.photoUrl ? (
                          <img
                            src={mister.personalInfo.photoUrl}
                            alt={mister.displayName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {mister.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{mister.displayName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{mister.email}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setMisterPickerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kid Picker Modal */}
      {kidPickerOpen && (
        <div 
          onClick={() => setKidPickerOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Select Kids for Class
                </h4>
                <p className="text-[11px] text-zinc-400">Search by student name or father name</p>
              </div>
              <button onClick={() => setKidPickerOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative my-3">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search kid name or father name..."
                className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pe-1">
              {allKids
                .filter((k) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase();
                  return (
                    k.info?.fullName?.toLowerCase().includes(q) ||
                    k.contacts?.fatherName?.toLowerCase().includes(q)
                  );
                })
                .map((kid) => {
                  const isSelected = selectedKidIds.includes(kid.id);

                  return (
                    <div
                      key={kid.id}
                      onClick={() => handleToggleKid(kid.id)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700'
                          : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{kid.info.fullName}</p>
                        <p className="text-[10px] text-zinc-400">
                          {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : 'Student'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setKidPickerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
