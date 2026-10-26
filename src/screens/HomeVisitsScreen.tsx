import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { Kid, Mister, HomeVisit, ClassDoc } from '../types';
import { LogVisitModal } from '../components/visits/LogVisitModal';
import { 
  Home, 
  MapPin, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Trash2, 
  Edit3, 
  Users, 
  MessageSquare,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const HomeVisitsScreen: React.FC = () => {
  const { user } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedClassId, 
    classes, 
    churches,
    canEditClass 
  } = useFilter();

  const [viewMode, setViewMode] = useState<'roster' | 'timeline' | 'insights'>('roster');
  const [kids, setKids] = useState<Kid[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [misters, setMisters] = useState<Mister[]>([]);
  const [classDoc, setClassDoc] = useState<ClassDoc | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [careFilter, setCareFilter] = useState<'all' | 'overdue' | 'due' | 'recent' | 'never'>('all');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<string>('all');
  const [expandedKidHistories, setExpandedKidHistories] = useState<Record<string, boolean>>({});

  // Modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [preselectedKidId, setPreselectedKidId] = useState<string | undefined>(undefined);
  const [editingVisit, setEditingVisit] = useState<HomeVisit | null>(null);

  const canEdit = selectedClassId ? canEditClass(selectedClassId) : false;

  // 1. Listen to Class Document to extract roster student IDs
  useEffect(() => {
    if (!selectedChurchId || !selectedClassId) {
      setClassDoc(null);
      return;
    }
    const classRef = doc(db, 'churches', selectedChurchId, 'classes', selectedClassId);
    const unsub = onSnapshot(classRef, (snap) => {
      if (snap.exists()) {
        setClassDoc({ id: snap.id, ...snap.data() } as ClassDoc);
      } else {
        setClassDoc(null);
      }
    });
    return () => unsub();
  }, [selectedChurchId, selectedClassId]);

  // 2. Listen to Kids for the active church
  useEffect(() => {
    if (!selectedChurchId) {
      setKids([]);
      return;
    }
    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsub = onSnapshot(kidsRef, (snap) => {
      const items: Kid[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setKids(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to Misters
  useEffect(() => {
    if (!selectedChurchId) {
      setMisters([]);
      return;
    }
    const mistersRef = collection(db, 'churches', selectedChurchId, 'misters');
    const unsub = onSnapshot(mistersRef, (snap) => {
      setMisters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mister)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 4. Listen to Visits for the selected Academic Year and Class
  useEffect(() => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId) {
      setVisits([]);
      return;
    }

    const visitsRef = collection(
      db,
      'churches',
      selectedChurchId,
      'academicYears',
      selectedAcademicYearId,
      'classes',
      selectedClassId,
      'visits'
    );
    const q = query(visitsRef, orderBy('visitDate', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const items: HomeVisit[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setVisits(items);
    });

    return () => unsub();
  }, [selectedChurchId, selectedAcademicYearId, selectedClassId]);

  // Filter kids enrolled in this classroom (combines classDoc.KidIds and activeAssignment)
  const enrolledKids = useMemo(() => {
    if (!selectedClassId) return [];

    const enrolledSet = new Set<string>();
    if (classDoc && selectedAcademicYearId) {
      const yearData = classDoc.academicYears?.[selectedAcademicYearId];
      const directIds = yearData?.KidIds || yearData?.kids || [];
      directIds.forEach((id) => enrolledSet.add(id));
    }

    return kids.filter((k) => {
      if (!k.active) return false;
      const matchesAssignment = k.activeAssignment?.classId === selectedClassId;
      const matchesDirect = enrolledSet.has(k.id);
      return matchesAssignment || matchesDirect;
    });
  }, [kids, classDoc, selectedAcademicYearId, selectedClassId]);

  // Group visits per kid
  const visitsByKid = useMemo(() => {
    const map: Record<string, HomeVisit[]> = {};
    visits.forEach((v) => {
      if (!map[v.kidId]) map[v.kidId] = [];
      map[v.kidId].push(v);
    });
    // Sort descending by date
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    });
    return map;
  }, [visits]);

  // Compute pastoral health per enrolled kid
  const kidsWithCareStatus = useMemo(() => {
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return enrolledKids.map((kid) => {
      const kidVisits = visitsByKid[kid.id] || [];
      const latestVisit = kidVisits[0] || null;

      let daysAgo = Infinity;
      let status: 'recently_visited' | 'due_for_visit' | 'overdue_for_visit' | 'never_visited' = 'never_visited';

      if (latestVisit) {
        const visitMs = new Date(latestVisit.visitDate).getTime();
        daysAgo = Math.max(0, Math.floor((todayMs - visitMs) / (1000 * 60 * 60 * 24)));

        if (daysAgo <= 30) {
          status = 'recently_visited';
        } else if (daysAgo <= 60) {
          status = 'due_for_visit';
        } else {
          status = 'overdue_for_visit';
        }
      }

      return {
        kid,
        visits: kidVisits,
        latestVisit,
        daysAgo,
        status,
      };
    });
  }, [enrolledKids, visitsByKid]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return kidsWithCareStatus.filter(({ kid, status }) => {
      // Care status filter
      if (careFilter === 'overdue' && status !== 'overdue_for_visit') return false;
      if (careFilter === 'due' && status !== 'due_for_visit') return false;
      if (careFilter === 'recent' && status !== 'recently_visited') return false;
      if (careFilter === 'never' && status !== 'never_visited') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = kid.info.fullName.toLowerCase();
        const landmark = (kid.address?.landmark || '').toLowerCase();
        const region = (kid.address?.region || '').toLowerCase();
        const fatherName = (kid.contacts?.fatherName || '').toLowerCase();
        const phone = (kid.contacts?.fatherMob || kid.contacts?.motherMob || '').toLowerCase();
        if (!fullName.includes(q) && !landmark.includes(q) && !region.includes(q) && !fatherName.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [kidsWithCareStatus, careFilter, searchQuery]);

  // Filtered Timeline
  const filteredTimeline = useMemo(() => {
    return visits.filter((v) => {
      if (timelineTypeFilter !== 'all' && v.type !== timelineTypeFilter) return false;
      return true;
    });
  }, [visits, timelineTypeFilter]);

  // Misters Map for quick name resolution
  const mistersMap = useMemo(() => {
    const map: Record<string, string> = {};
    misters.forEach((m) => {
      map[(m.email || m.id || '').toLowerCase().trim()] = m.displayName;
    });
    return map;
  }, [misters]);

  // Kids Map for quick name and photo resolution
  const kidsMap = useMemo(() => {
    const map: Record<string, Kid> = {};
    kids.forEach((k) => {
      map[k.id] = k;
    });
    return map;
  }, [kids]);

  // Statistics & KPI
  const stats = useMemo(() => {
    const totalKids = enrolledKids.length;
    const visitedKidsCount = kidsWithCareStatus.filter((k) => k.latestVisit !== null).length;
    const coverageRate = totalKids > 0 ? Math.round((visitedKidsCount / totalKids) * 100) : 0;
    const totalInteractions = visits.length;
    const homeVisitsCount = visits.filter((v) => v.type === 'home_visit').length;
    const phoneCallsCount = visits.filter((v) => v.type === 'phone_call').length;
    const overdueCount = kidsWithCareStatus.filter((k) => k.status === 'overdue_for_visit' || k.status === 'never_visited').length;

    // Servants participation count
    const servantCountMap: Record<string, number> = {};
    visits.forEach((v) => {
      v.visitorMisterIds.forEach((mId) => {
        const key = mId.toLowerCase().trim();
        servantCountMap[key] = (servantCountMap[key] || 0) + 1;
      });
    });

    return {
      totalKids,
      visitedKidsCount,
      coverageRate,
      totalInteractions,
      homeVisitsCount,
      phoneCallsCount,
      overdueCount,
      servantCountMap,
    };
  }, [enrolledKids, kidsWithCareStatus, visits]);

  // Handle Save Visit
  const handleSaveVisit = async (
    visitData: Omit<HomeVisit, 'id' | 'createdAt' | 'createdBy'>,
    existingId?: string
  ) => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId) return;

    const visitsColRef = collection(
      db,
      'churches',
      selectedChurchId,
      'academicYears',
      selectedAcademicYearId,
      'classes',
      selectedClassId,
      'visits'
    );

    const targetDoc = existingId ? doc(visitsColRef, existingId) : doc(visitsColRef);
    const nowIso = new Date().toISOString();

    const payload: HomeVisit = {
      id: targetDoc.id,
      kidId: visitData.kidId,
      academicYearId: selectedAcademicYearId,
      classId: selectedClassId,
      visitDate: visitData.visitDate,
      type: visitData.type,
      visitorMisterIds: visitData.visitorMisterIds,
      notes: visitData.notes,
      needsFollowUp: visitData.needsFollowUp,
      followUpDate: visitData.followUpDate,
      createdAt: editingVisit?.createdAt || nowIso,
      createdBy: editingVisit?.createdBy || user?.email || '',
      lastEditAt: nowIso,
      lastEditBy: user?.email || '',
    };

    await setDoc(targetDoc, payload, { merge: true });
    setEditingVisit(null);
  };

  // Handle Delete Visit
  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm(translate('delete_visit_confirm'))) return;
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId) return;

    const targetDoc = doc(
      db,
      'churches',
      selectedChurchId,
      'academicYears',
      selectedAcademicYearId,
      'classes',
      selectedClassId,
      'visits',
      visitId
    );
    await deleteDoc(targetDoc);
  };

  // Export Home Visits Excel Report
  const handleExportExcel = () => {
    const churchName = churches.find((c) => c.id === selectedChurchId)?.displayName || 'Church';
    const className = classes.find((c) => c.id === selectedClassId)?.displayName || 'Class';

    const wb = XLSX.utils.book_new();

    // Sheet 1: Student Care Roster
    const rosterSheetData = kidsWithCareStatus.map(({ kid, status, latestVisit, daysAgo }) => ({
      'Student Name': kid.info.fullName,
      'Gender': kid.info.gender,
      'Care Status': status === 'recently_visited' ? 'Recently Visited' : status === 'due_for_visit' ? 'Due for Care' : status === 'overdue_for_visit' ? 'Overdue for Care' : 'Never Visited',
      'Days Ago': daysAgo === Infinity ? 'Never' : daysAgo,
      'Last Visit Date': latestVisit ? latestVisit.visitDate : 'Never',
      'Last Interaction Type': latestVisit ? latestVisit.type : '-',
      'Region': kid.address?.region || '',
      'Street': kid.address?.street || '',
      'Landmark': kid.address?.landmark || '',
      'Father Mobile': kid.contacts?.fatherMob || '',
      'Mother Mobile': kid.contacts?.motherMob || '',
    }));
    const wsRoster = XLSX.utils.json_to_sheet(rosterSheetData);
    XLSX.utils.book_append_sheet(wb, wsRoster, 'Student Care Status');

    // Sheet 2: Visits Timeline Log
    const visitsSheetData = visits.map((v) => ({
      'Visit Date': v.visitDate,
      'Interaction Type': v.type === 'home_visit' ? 'Home Visit' : v.type === 'phone_call' ? 'Phone Call' : v.type,
      'Student Name': kidsMap[v.kidId]?.info.fullName || v.kidId,
      'Attending Servants': v.visitorMisterIds.map((id) => mistersMap[id] || id).join(', '),
      'Pastoral Notes': v.notes || '',
      'Needs Follow-Up': v.needsFollowUp ? 'Yes' : 'No',
      'Follow-Up Date': v.followUpDate || '',
      'Recorded By': v.createdBy || '',
    }));
    const wsVisits = XLSX.utils.json_to_sheet(visitsSheetData);
    XLSX.utils.book_append_sheet(wb, wsVisits, 'Visits Log');

    XLSX.writeFile(wb, `${churchName}_${className}_Home_Visits_Report.xlsx`);
  };

  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'Class';

  // Empty state if class is not selected
  if (!selectedClassId) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('home_visits')}</span>
          </h2>
        </div>

        <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Home className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {translate('select_class_to_view_visits')}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Select your Church, Academic Year, and Class from the top bar to track pastoral care and record home visits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Tri-Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('home_visits')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {activeClassName}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Pastoral home visits, telephone care, and family engagement tracking
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('roster')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'roster'
                ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{translate('roster_view')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{translate('timeline_view')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('insights')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'insights'
                ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{translate('insights_view')}</span>
          </button>
        </div>
      </div>

      {/* Action Bar (Search & Log Visit) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, landmark, area, or parent..."
            className="w-full ps-9 pe-4 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-2xs cursor-pointer"
            title="Download formatted Excel report"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>{translate('export_excel')}</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setPreselectedKidId(undefined);
                setEditingVisit(null);
                setLogModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{translate('log_visit')}</span>
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: STUDENT CARE ROSTER */}
      {viewMode === 'roster' && (
        <div className="space-y-4">
          {/* Care Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCareFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                careFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {translate('all')} ({enrolledKids.length})
            </button>
            <button
              type="button"
              onClick={() => setCareFilter('overdue')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                careFilter === 'overdue'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{translate('overdue_for_visit')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCareFilter('due')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                careFilter === 'due'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{translate('due_for_visit')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCareFilter('recent')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                careFilter === 'recent'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{translate('recently_visited')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCareFilter('never')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                careFilter === 'never'
                  ? 'bg-zinc-600 text-white shadow-2xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {translate('never_visited')}
            </button>
          </div>

          {/* Roster Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRoster.map(({ kid, visits: kidVisits, daysAgo, status }) => {
              const addressParts = [
                kid.address?.building ? `Bldg ${kid.address.building}` : '',
                kid.address?.floor ? `Fl ${kid.address.floor}` : '',
                kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
                kid.address?.street,
                kid.address?.region,
              ].filter(Boolean);

              const fullAddress = addressParts.join(', ');
              const mapsQuery = [kid.address?.landmark, fullAddress].filter(Boolean).join(', ');
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

              const isHistoryOpen = !!expandedKidHistories[kid.id];

              return (
                <div
                  key={kid.id}
                  className={`rounded-3xl bg-white dark:bg-zinc-900 border p-4 shadow-2xs flex flex-col justify-between transition hover:shadow-sm ${
                    status === 'overdue_for_visit'
                      ? 'border-rose-200 dark:border-rose-900/60 border-s-4 border-s-rose-500'
                      : status === 'due_for_visit'
                      ? 'border-amber-200 dark:border-amber-900/60 border-s-4 border-s-amber-500'
                      : status === 'recently_visited'
                      ? 'border-emerald-200 dark:border-emerald-900/60 border-s-4 border-s-emerald-500'
                      : 'border-zinc-200 dark:border-zinc-800 border-s-4 border-s-zinc-300 dark:border-s-zinc-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar, Name & Care Status Pill */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {kid.info.photoUrl ? (
                          <img
                            src={kid.info.photoUrl}
                            alt={kid.info.fullName}
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            kid.info.gender === 'female'
                              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300'
                          }`}>
                            {kid.info.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            <bdi>{kid.info.fullName}</bdi>
                          </h4>
                          <p className="text-[11px] text-zinc-400">
                            {kid.info.gender === 'female' ? translate('female') : translate('male')}
                            {kid.info.deacon && <span className="ms-1.5 text-amber-600 dark:text-amber-400 font-bold">★ {translate('deacon')}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="shrink-0">
                        {status === 'recently_visited' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{daysAgo === 0 ? translate('today') : `${daysAgo} ${translate('days_ago')}`}</span>
                          </span>
                        )}
                        {status === 'due_for_visit' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{daysAgo} {translate('days_ago')}</span>
                          </span>
                        )}
                        {status === 'overdue_for_visit' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>&gt;60 {translate('days_ago')}</span>
                          </span>
                        )}
                        {status === 'never_visited' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                            <span>{translate('never_visited')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Address & Landmark */}
                    <div className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 text-xs space-y-1">
                      <div className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{fullAddress || 'No address registered'}</span>
                      </div>
                      {kid.address?.landmark && (
                        <p className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold ps-5">
                          📍 {translate('landmark')}: {kid.address.landmark}
                        </p>
                      )}
                    </div>

                    {/* Parents Contact shortcuts */}
                    <div className="flex items-center gap-2 pt-0.5">
                      {kid.contacts?.fatherMob && (
                        <a
                          href={`https://wa.me/${kid.contacts.fatherMob.replace(/\+/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition"
                          title="WhatsApp Father"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{translate('call_father')}</span>
                        </a>
                      )}
                      {kid.contacts?.motherMob && (
                        <a
                          href={`https://wa.me/${kid.contacts.motherMob.replace(/\+/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition"
                          title="WhatsApp Mother"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{translate('call_mother')}</span>
                        </a>
                      )}
                      {mapsQuery && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition"
                          title={translate('directions_map')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedKidHistories({ ...expandedKidHistories, [kid.id]: !isHistoryOpen })}
                      className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                    >
                      {kidVisits.length} {kidVisits.length === 1 ? 'visit' : 'visits'} {isHistoryOpen ? '▲' : '▼'}
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedKidId(kid.id);
                          setEditingVisit(null);
                          setLogModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{translate('log_visit')}</span>
                      </button>
                    )}
                  </div>

                  {/* Expandable Kid Visit History Drawer */}
                  {isHistoryOpen && (
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs">
                      {kidVisits.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 italic">{translate('no_visits_logged')}</p>
                      ) : (
                        kidVisits.map((v) => (
                          <div key={v.id} className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-zinc-900 dark:text-zinc-100">
                                {v.type === 'home_visit' ? '🏠 Home Visit' : v.type === 'phone_call' ? '📞 Phone Call' : v.type}
                              </span>
                              <span className="text-zinc-400">{v.visitDate}</span>
                            </div>
                            {v.notes && <p className="text-[11px] text-zinc-600 dark:text-zinc-300">{v.notes}</p>}
                            {v.visitorMisterIds.length > 0 && (
                              <p className="text-[10px] text-teal-600 dark:text-teal-400">
                                Visitors: {v.visitorMisterIds.map((id) => mistersMap[id] || id).join(', ')}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: PASTORAL TIMELINE FEED */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {/* Interaction Type Filter Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimelineTypeFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                timelineTypeFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {translate('all')} ({visits.length})
            </button>
            <button
              type="button"
              onClick={() => setTimelineTypeFilter('home_visit')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                timelineTypeFilter === 'home_visit'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              🏠 {translate('visit_type_home')}
            </button>
            <button
              type="button"
              onClick={() => setTimelineTypeFilter('phone_call')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                timelineTypeFilter === 'phone_call'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              📞 {translate('visit_type_phone')}
            </button>
          </div>

          {/* Timeline Stream */}
          {filteredTimeline.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
              {translate('no_visits_logged')}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTimeline.map((v) => {
                const targetKid = kidsMap[v.kidId];
                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Kid Avatar */}
                      {targetKid?.info.photoUrl ? (
                        <img
                          src={targetKid.info.photoUrl}
                          alt={targetKid.info.fullName}
                          className="w-11 h-11 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {targetKid?.info.fullName ? targetKid.info.fullName.slice(0, 2).toUpperCase() : '?'}
                        </div>
                      )}

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                            <bdi>{targetKid?.info.fullName || 'Unknown Student'}</bdi>
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.type === 'home_visit'
                              ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                          }`}>
                            {v.type === 'home_visit' ? '🏠 Home Visit' : v.type === 'phone_call' ? '📞 Phone Call' : v.type}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {v.visitDate}
                          </span>
                        </div>

                        {/* Pastoral Notes */}
                        {v.notes && (
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {v.notes}
                          </p>
                        )}

                        {/* Visitors & Follow-up tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {v.visitorMisterIds.map((mId) => (
                            <span
                              key={mId}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                            >
                              👤 {mistersMap[mId] || mId}
                            </span>
                          ))}
                          {v.needsFollowUp && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                              ⚠️ Follow-Up {v.followUpDate ? `due ${v.followUpDate}` : 'needed'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVisit(v);
                            setPreselectedKidId(v.kidId);
                            setLogModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                          title="Edit Visit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVisit(v.id)}
                          className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Delete Visit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: CARE INSIGHTS & STATISTICS */}
      {viewMode === 'insights' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-zinc-400">{translate('coverage_rate')}</p>
              <h3 className="text-2xl font-black text-teal-600 dark:text-teal-400">
                {stats.coverageRate}%
              </h3>
              <p className="text-[10px] text-zinc-400">
                {stats.visitedKidsCount} of {stats.totalKids} kids visited
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-zinc-400">{translate('total_visits')}</p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                {stats.totalInteractions}
              </h3>
              <p className="text-[10px] text-zinc-400">Logged interactions</p>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-zinc-400">{translate('visit_type_home')}</p>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {stats.homeVisitsCount}
              </h3>
              <p className="text-[10px] text-zinc-400">In-person visits</p>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-zinc-400">{translate('overdue_for_visit')}</p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {stats.overdueCount}
              </h3>
              <p className="text-[10px] text-zinc-400">&gt;60 days or never</p>
            </div>
          </div>

          {/* Servants Participation Leaderboard */}
          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span>Servants Pastoral Care Participation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.servantCountMap)
                .sort(([, a], [, b]) => b - a)
                .map(([email, count]) => (
                  <div
                    key={email}
                    className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {mistersMap[email] || email}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono truncate">{email}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 font-extrabold text-xs">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Log Visit Modal */}
      {logModalOpen && (
        <LogVisitModal
          isOpen={logModalOpen}
          onClose={() => {
            setLogModalOpen(false);
            setEditingVisit(null);
            setPreselectedKidId(undefined);
          }}
          onSave={handleSaveVisit}
          preselectedKidId={preselectedKidId}
          existingVisit={editingVisit}
          kids={enrolledKids}
          misters={misters}
          currentServantEmail={user?.email || undefined}
        />
      )}
    </div>
  );
};
