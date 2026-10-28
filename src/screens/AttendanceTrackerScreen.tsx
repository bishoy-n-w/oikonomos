import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { NewEventModal } from '../components/attendance/NewEventModal';
import { RecurringEventModal } from '../components/attendance/RecurringEventModal';
import { useModalEscape } from '../utils/useModalEscape';
import { computeConsecutiveAbsences, buildPastoralWhatsAppUrl } from '../utils/pastoralCare';
import { 
  computeAttendanceAnalytics, 
  exportAttendanceReportExcel 
} from '../utils/attendanceStats';
import { 
  DEFAULT_EVENT_TYPES, 
  type Kid, 
  type AttendanceStatus, 
  type AttendanceEvent, 
  type AttendanceEventType,
  type GroupEventType
} from '../types';
import { 
  Calendar, 
  Plus, 
  Sparkles, 
  Check, 
  X, 
  Clock, 
  Save, 
  RefreshCw, 
  MessageSquare, 
  Trash2, 
  Search, 
  CheckCircle2, 
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Phone,
  LayoutList,
  Table as TableIcon,
  Filter,
  Navigation,
  BookOpen,
  Church,
  Scroll,
  Music,
  Users as UsersIcon,
  Compass,
  Trophy,
  Eye,
  Lock,
  RotateCcw,
  BarChart3,
  FileSpreadsheet,
  Award,
  TrendingUp
} from 'lucide-react';

export const AttendanceTrackerScreen: React.FC = () => {
  const { user } = useAuth();
  const { translate, isRtl } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId, 
    churches,
    classes,
    canEditClass,
    canViewClass
  } = useFilter();

  const canEdit = selectedClassId ? canEditClass(selectedClassId) : false;
  const canView = selectedClassId ? canViewClass(selectedClassId) : false;

  // View Mode: 'checklist' (Weekly Roll Call) vs 'matrix' (Term Grid) vs 'stats' (Statistics & Insights)
  const [viewMode, setViewMode] = useState<'checklist' | 'matrix' | 'stats'>('checklist');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Horizon Filter: 'all' | 'past' | 'today' | 'upcoming'
  const [horizonFilter, setHorizonFilter] = useState<'all' | 'past' | 'today' | 'upcoming'>('all');

  // Event Type Filter: 'all' | specific type name
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Group Event Types (from active service group or default)
  const [groupEventTypes, setGroupEventTypes] = useState<GroupEventType[]>([]);

  // Kids Roster
  const [kids, setKids] = useState<Kid[]>([]);
  
  // Events state
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Active event state
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notesByKid, setNotesByKid] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [rosterSearch, setRosterSearch] = useState('');

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialSyncRef = useRef<boolean>(true);
  const isMountedRef = useRef<boolean>(true);

  // Unmount cleanup to prevent memory leaks and state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Pastoral Care Alert state
  const [pastoralAlertsDismissed, setPastoralAlertsDismissed] = useState(false);

  // Modals
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Reset Session modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Ribbon scroll ref
  const ribbonRef = useRef<HTMLDivElement | null>(null);

  useModalEscape(() => setDeleteEventId(null), !!deleteEventId);
  useModalEscape(() => setResetModalOpen(false), resetModalOpen);

  const todayDateStr = new Date().toISOString().split('T')[0];

  // Helper for event type icon & styling
  const getEventTypeMeta = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('school') || t.includes('أحد') || t.includes('lesson')) {
      return { icon: BookOpen, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800' };
    }
    if (t.includes('liturgy') || t.includes('قداس')) {
      return { icon: Church, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800' };
    }
    if (t.includes('bible') || t.includes('كتاب')) {
      return { icon: Scroll, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' };
    }
    if (t.includes('hymn') || t.includes('لحن') || t.includes('ألحان') || t.includes('تسبحة')) {
      return { icon: Music, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' };
    }
    if (t.includes('conference') || t.includes('مؤتمر')) {
      return { icon: UsersIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800' };
    }
    if (t.includes('trip') || t.includes('رحلة')) {
      return { icon: Compass, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800' };
    }
    if (t.includes('activity') || t.includes('رياض') || t.includes('نشاط')) {
      return { icon: Trophy, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800' };
    }
    return { icon: Calendar, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' };
  };

  // 1. Listen to Kids for the selected class
  useEffect(() => {
    if (!selectedChurchId) {
      setKids([]);
      return;
    }

    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsubKids = onSnapshot(kidsRef, (snap) => {
      const items: Kid[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((k) => {
          if (k.active === false) return false;
          const asgn = k.activeAssignment || {};
          const cId = asgn.classId || k.classId;
          return !selectedClassId || cId === selectedClassId;
        })
        .sort((a, b) => (a.info?.fullName || '').localeCompare(b.info?.fullName || ''));
      setKids(items);
    });

    return () => unsubKids();
  }, [selectedChurchId, selectedClassId]);

  // 2. Listen to service group for this class to get custom event types
  useEffect(() => {
    if (!selectedChurchId) return;

    const activeClass = classes.find((c) => c.id === selectedClassId);
    const targetGroupId = selectedServiceGroupId || (activeClass?.data as any)?.serviceGroupId;

    if (!targetGroupId) {
      setGroupEventTypes(
        DEFAULT_EVENT_TYPES.map((t) => ({
          id: t.toLowerCase().replace(/\s+/g, '_'),
          name: t,
          isCore: t !== 'Trip' && t !== 'Activity',
        }))
      );
      return;
    }

    const unsubGroup = onSnapshot(
      doc(db, 'churches', selectedChurchId, 'serviceGroups', targetGroupId),
      (snap) => {
        if (snap.exists() && snap.data().eventTypes && snap.data().eventTypes.length > 0) {
          setGroupEventTypes(snap.data().eventTypes);
        } else {
          setGroupEventTypes(
            DEFAULT_EVENT_TYPES.map((t) => ({
              id: t.toLowerCase().replace(/\s+/g, '_'),
              name: t,
              isCore: t !== 'Trip' && t !== 'Activity',
            }))
          );
        }
      }
    );

    return () => unsubGroup();
  }, [selectedChurchId, selectedClassId, selectedServiceGroupId, classes]);

  // 3. Listen to Attendance Events for this class & year (under academicYears/{yearId}/classes/{classId}/attendanceEvents)
  useEffect(() => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    const eventsRef = collection(
      db,
      'churches',
      selectedChurchId,
      'academicYears',
      selectedAcademicYearId,
      'classes',
      selectedClassId,
      'attendanceEvents'
    );
    const unsubEvents = onSnapshot(eventsRef, (snap) => {
      const items: AttendanceEvent[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AttendanceEvent))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)); // Chronological order

      setEvents(items);

      // Select today's event or closest event if none selected
      if (items.length > 0) {
        const todayEvt = items.find((e) => e.eventDate === todayDateStr);
        setSelectedEventId((prev) => {
          if (prev && items.some((e) => e.id === prev)) return prev;
          return todayEvt ? todayEvt.id : items[items.length - 1].id;
        });
      } else {
        setSelectedEventId(null);
      }
    });

    return () => unsubEvents();
  }, [selectedChurchId, selectedClassId, selectedAcademicYearId, todayDateStr]);

  // Active event
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  // 4. Sync local state when selected event changes
  useEffect(() => {
    isInitialSyncRef.current = true;
    if (selectedEvent) {
      setStatuses(selectedEvent.statuses || {});
      setNotesByKid(selectedEvent.notesByKid || {});
      setAutoSaveStatus('idle');
    } else {
      setStatuses({});
      setNotesByKid({});
    }
  }, [selectedEvent]);

  // 5. Background Auto-Save Engine (Debounced 900ms)
  const persistAttendance = useCallback(
    async (
      targetEventId: string,
      targetStatuses: Record<string, AttendanceStatus>,
      targetNotes: Record<string, string>
    ) => {
      if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId || !targetEventId) return;

      setAutoSaveStatus('saving');
      try {
        const eventRef = doc(
          db,
          'churches',
          selectedChurchId,
          'academicYears',
          selectedAcademicYearId,
          'classes',
          selectedClassId,
          'attendanceEvents',
          targetEventId
        );

        const hasAnyRecords = Object.keys(targetStatuses).length > 0;

        await setDoc(eventRef, {
          statuses: targetStatuses,
          notesByKid: targetNotes,
          takenAt: hasAnyRecords ? new Date().toISOString() : null,
          takenBy: hasAnyRecords ? (user?.displayName || user?.email || 'Servant') : null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } catch (err: any) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('idle');
      }
    },
    [selectedChurchId, selectedAcademicYearId, selectedClassId, user]
  );

  const triggerAutoSave = (
    newStatuses: Record<string, AttendanceStatus>,
    newNotes: Record<string, string>
  ) => {
    if (!selectedEventId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      persistAttendance(selectedEventId, newStatuses, newNotes);
    }, 900);
  };

  // Status Change handler: Toggle to select, click again to unselect/clear
  const handleSetKidStatus = (kidId: string, status: AttendanceStatus) => {
    if (!canEdit) return;
    const updated = { ...statuses };
    if (updated[kidId] === status) {
      // Toggle-to-clear: removes status taken by mistake
      delete updated[kidId];
    } else {
      updated[kidId] = status;
    }
    setStatuses(updated);
    triggerAutoSave(updated, notesByKid);
  };

  // Shortcut: ⚡ Mark All Present
  const handleMarkAllPresent = () => {
    if (!canEdit) return;
    const updated = { ...statuses };
    filteredKids.forEach((k) => {
      if (!updated[k.id] || updated[k.id] === 'absent') {
        updated[k.id] = 'present';
      }
    });
    setStatuses(updated);
    triggerAutoSave(updated, notesByKid);
  };

  // Session-Wide Reset: Clear all attendance records for this session
  const handleResetSessionAttendance = async () => {
    if (!canEdit || !selectedChurchId || !selectedAcademicYearId || !selectedClassId || !selectedEventId) return;

    setIsResetting(true);
    try {
      const eventRef = doc(
        db,
        'churches',
        selectedChurchId,
        'academicYears',
        selectedAcademicYearId,
        'classes',
        selectedClassId,
        'attendanceEvents',
        selectedEventId
      );
      await setDoc(eventRef, {
        statuses: {},
        takenAt: null,
        takenBy: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatuses({});
      setResetModalOpen(false);
      setAutoSaveStatus('idle');
    } catch (err: any) {
      console.error('Reset attendance failed:', err);
      alert(`Error resetting session: ${err.message || 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Toggle note input visibility
  const toggleKidNote = (kidId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [kidId]: !prev[kidId],
    }));
  };

  // Update note text
  const handleSetKidNote = (kidId: string, note: string) => {
    if (!canEdit) return;
    const updated = { ...notesByKid, [kidId]: note };
    setNotesByKid(updated);
    triggerAutoSave(statuses, updated);
  };

  // Matrix Cell Quick-Toggle: Unrecorded (-) -> Present (P) -> Absent (A) -> Excused (E) -> Unrecorded (-)
  const handleMatrixCellToggle = async (eventId: string, kidId: string) => {
    if (!canEdit) return;
    const targetEvt = events.find((e) => e.id === eventId);
    if (!targetEvt || !selectedChurchId || !selectedAcademicYearId || !selectedClassId) return;

    const currentStatus = targetEvt.statuses?.[kidId];
    const updatedStatuses = { ...(targetEvt.statuses || {}) };

    if (!currentStatus) {
      updatedStatuses[kidId] = 'present';
    } else if (currentStatus === 'present') {
      updatedStatuses[kidId] = 'absent';
    } else if (currentStatus === 'absent') {
      updatedStatuses[kidId] = 'excused';
    } else if (currentStatus === 'excused') {
      delete updatedStatuses[kidId]; // Reset to unrecorded!
    }

    if (eventId === selectedEventId) {
      setStatuses(updatedStatuses);
    }

    try {
      const eventRef = doc(
        db,
        'churches',
        selectedChurchId,
        'academicYears',
        selectedAcademicYearId,
        'classes',
        selectedClassId,
        'attendanceEvents',
        eventId
      );

      const hasAnyRecords = Object.keys(updatedStatuses).length > 0;

      await setDoc(eventRef, {
        statuses: updatedStatuses,
        takenAt: hasAnyRecords ? (targetEvt.takenAt || new Date().toISOString()) : null,
        takenBy: hasAnyRecords ? (targetEvt.takenBy || user?.displayName || user?.email || 'Servant') : null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err: any) {
      console.error('Matrix cell update failed:', err);
    }
  };

  // 🎯 Jump to Today shortcut
  const handleJumpToToday = () => {
    const todayEvt = events.find((e) => e.eventDate === todayDateStr);
    const closestUpcoming = events.find((e) => e.eventDate >= todayDateStr);
    const target = todayEvt || closestUpcoming || events[events.length - 1];

    if (target) {
      setSelectedEventId(target.id);
      setHorizonFilter('all');
      setTypeFilter('all');
      setTimeout(() => {
        const el = document.getElementById(`ribbon_evt_${target.id}`);
        if (el && ribbonRef.current) {
          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 50);
    }
  };

  // Create single event
  const handleCreateSingleEvent = async (data: { title: string; type: AttendanceEventType; eventDate: string }) => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId) return;

    const eventId = `evt_${Date.now()}`;
    const eventRef = doc(
      db,
      'churches',
      selectedChurchId,
      'academicYears',
      selectedAcademicYearId,
      'classes',
      selectedClassId,
      'attendanceEvents',
      eventId
    );

    const payload: AttendanceEvent = {
      id: eventId,
      academicYearId: selectedAcademicYearId || '',
      serviceGroupId: selectedServiceGroupId || '',
      classId: selectedClassId,
      title: data.title,
      type: data.type,
      eventDate: data.eventDate,
      statuses: {},
      notesByKid: {},
      createdAt: new Date().toISOString(),
      createdBy: user?.email || 'admin',
    };

    await setDoc(eventRef, payload);
    setSelectedEventId(eventId);
  };

  // Generate recurring schedule
  const handleGenerateRecurring = async (
    eventList: Array<{ title: string; type: AttendanceEventType; eventDate: string }>,
    seriesId: string
  ) => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId || eventList.length === 0) return;

    const batchSize = 400;
    for (let i = 0; i < eventList.length; i += batchSize) {
      const chunk = eventList.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach((item, idx) => {
        const eventId = `evt_${seriesId}_${i + idx}`;
        const eventRef = doc(
          db,
          'churches',
          selectedChurchId,
          'academicYears',
          selectedAcademicYearId,
          'classes',
          selectedClassId,
          'attendanceEvents',
          eventId
        );

        const payload: AttendanceEvent = {
          id: eventId,
          academicYearId: selectedAcademicYearId || '',
          serviceGroupId: selectedServiceGroupId || '',
          classId: selectedClassId,
          title: item.title,
          type: item.type,
          eventDate: item.eventDate,
          statuses: {},
          notesByKid: {},
          recurringSeriesId: seriesId,
          createdAt: new Date().toISOString(),
          createdBy: user?.email || 'admin',
        };

        batch.set(eventRef, payload);
      });

      await batch.commit();
    }
  };

  // Delete event
  const handleConfirmDeleteEvent = async () => {
    if (!selectedChurchId || !selectedAcademicYearId || !selectedClassId || !deleteEventId) return;

    setIsDeletingEvent(true);
    try {
      const eventRef = doc(
        db,
        'churches',
        selectedChurchId,
        'academicYears',
        selectedAcademicYearId,
        'classes',
        selectedClassId,
        'attendanceEvents',
        deleteEventId
      );
      await deleteDoc(eventRef);
      if (selectedEventId === deleteEventId) {
        setSelectedEventId(null);
      }
      setDeleteEventId(null);
    } catch (err: any) {
      console.error('Delete event failed:', err);
      alert(`Error deleting event: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // Ribbon scroll buttons
  const scrollRibbon = (offset: number) => {
    if (ribbonRef.current) {
      ribbonRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Filtered Kids Roster
  const filteredKids = kids.filter((k) => {
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return (
      (k.info?.fullName || '').toLowerCase().includes(q) ||
      (k.contacts?.fatherName && k.contacts.fatherName.toLowerCase().includes(q))
    );
  });

  // Filter events by Horizon and by Type for Ribbon & Matrix
  const ribbonEvents = events.filter((evt) => {
    if (horizonFilter === 'past' && evt.eventDate >= todayDateStr) return false;
    if (horizonFilter === 'today' && evt.eventDate !== todayDateStr) return false;
    if (horizonFilter === 'upcoming' && evt.eventDate <= todayDateStr) return false;
    if (typeFilter !== 'all' && evt.type !== typeFilter) return false;
    return true;
  });

  // Calculate consecutive absence alerts strictly for CORE event types
  const coreTypeNames = groupEventTypes.filter((t) => t.isCore).map((t) => t.name);
  const consecutiveAbsenceAlerts = computeConsecutiveAbsences(events, kids, coreTypeNames);

  // Metrics calculation for currently selected event
  const presentCount = Object.values(statuses).filter((s) => s === 'present').length;
  const absentCount = Object.values(statuses).filter((s) => s === 'absent').length;
  const excusedCount = Object.values(statuses).filter((s) => s === 'excused').length;
  const recordedCount = Object.keys(statuses).length;
  const totalRoster = kids.length;
  const unrecordedCount = Math.max(0, totalRoster - recordedCount);
  const attendancePercent = totalRoster > 0 ? Math.round((presentCount / totalRoster) * 100) : 0;

  // Per-Type Engagement Analytics Bar
  const perTypeStats = groupEventTypes.map((gt) => {
    const typeEvents = events.filter((e) => e.type === gt.name && (e.takenAt || Object.keys(e.statuses || {}).length > 0));
    let totalP = 0;
    let totalR = 0;
    typeEvents.forEach((te) => {
      totalP += Object.values(te.statuses || {}).filter((s) => s === 'present').length;
      totalR += totalRoster;
    });
    const avg = totalR > 0 ? Math.round((totalP / totalR) * 100) : 0;
    return {
      name: gt.name,
      count: typeEvents.length,
      avgRate: avg,
    };
  }).filter((s) => s.count > 0);

  // Full Term Attendance Analytics Engine
  const analytics = computeAttendanceAnalytics(events, kids, groupEventTypes);

  // 1-Click Formatted Excel Export Handler
  const handleExportExcel = () => {
    if (!selectedChurchId || !selectedClassId) return;
    setIsExportingExcel(true);
    try {
      const churchName = churches.find((c) => c.id === selectedChurchId)?.displayName || 'Church';
      const className = classes.find((c) => c.id === selectedClassId)?.displayName || 'Class';
      const yearName = selectedAcademicYearId || 'Term';
      exportAttendanceReportExcel(churchName, className, yearName, events, kids, analytics);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Export error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'Select Class';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & VIEW MODE SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('attendance')}</span>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
              {activeClassName}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Pastoral Sunday School session attendance, instant WhatsApp follow-up, and term-wide insights
          </p>
        </div>

        {/* View Mode Toggle & Event Actions */}
        {selectedClassId && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 🎯 Jump to Today Button */}
            <button
              type="button"
              onClick={handleJumpToToday}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer shadow-2xs"
              title="Jump to today's active session"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{translate('jump_to_today')}</span>
            </button>

            {/* View Switcher Pill (Checklist vs Matrix vs Stats) */}
            <div className="flex items-center p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('checklist')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  viewMode === 'checklist'
                    ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>{translate('checklist_view')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  viewMode === 'matrix'
                    ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{translate('matrix_view')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  viewMode === 'stats'
                    ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{translate('stats_view')}</span>
              </button>
            </div>

            {/* 1-Click Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Export full term attendance register and statistics as Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isExportingExcel ? translate('exporting') : translate('export_attendance_report')}</span>
            </button>

            {/* Event Modals (only if canEdit) */}
            {canEdit && (
              <>
                <button
                  onClick={() => setNewEventOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition shadow-sm shadow-teal-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{translate('new_event')}</span>
                </button>
                <button
                  onClick={() => setRecurringModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition shadow-sm shadow-purple-600/30 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{translate('recurring_schedule')}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Warning if no class selected */}
      {!selectedClassId && (
        <div className="p-8 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-2">
          <Calendar className="w-8 h-8 text-amber-600 mx-auto" />
          <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">Please Select a Specific Class</h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
            Use the top navigation bar to select a specific <strong>Class</strong>. Attendance events, schedules, and student rosters are managed per classroom.
          </p>
        </div>
      )}

      {/* Access Restricted if not member of this service group */}
      {selectedClassId && !canView && (
        <div className="p-8 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-2">
          <Lock className="w-8 h-8 text-amber-600 mx-auto" />
          <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">{translate('class_access_restricted')}</h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
            {translate('class_access_restricted_desc')}
          </p>
        </div>
      )}

      {selectedClassId && canView && (
        <>
          {/* View-Only Mode Banner */}
          {!canEdit && (
            <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              <Eye className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{translate('view_only_mode')}:</span>
              <span>{translate('view_only_desc')}</span>
            </div>
          )}

          {/* 2. TIMELINE HORIZON & TYPE FILTER CONTROL BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs shadow-2xs">
            {/* Horizon Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-zinc-400 me-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Timeline:</span>
              </span>
              {[
                { id: 'all', label: translate('timeline_all') },
                { id: 'past', label: translate('timeline_past') },
                { id: 'today', label: `⭐ ${translate('timeline_today')}` },
                { id: 'upcoming', label: translate('timeline_upcoming') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHorizonFilter(tab.id as any)}
                  className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                    horizonFilter === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Event Type Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>{translate('event_types')}:</span>
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
              >
                <option value="all">{translate('all_types')}</option>
                {groupEventTypes.map((gt) => (
                  <option key={gt.id} value={gt.name}>
                    {translate(gt.name.toLowerCase().replace(/\s+/g, '_')) || gt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. HORIZONTAL DATE / SESSION RIBBON */}
          <div className="relative p-2 rounded-3xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 flex items-center">
            {/* Scroll Left */}
            <button
              type="button"
              onClick={() => scrollRibbon(isRtl ? 260 : -260)}
              className="p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition cursor-pointer shrink-0 z-10"
              title="Scroll timeline"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable Ribbon */}
            <div
              ref={ribbonRef}
              className="flex-1 flex items-center gap-2.5 overflow-x-auto px-2 scroll-smooth py-1 no-scrollbar"
            >
              {ribbonEvents.length === 0 && (
                <div className="py-2 px-4 text-xs text-zinc-400 italic">
                  No attendance sessions matching the active timeline/type filters.
                </div>
              )}

              {ribbonEvents.map((evt) => {
                const isSelected = evt.id === selectedEventId;
                const isToday = evt.eventDate === todayDateStr;
                const isPast = evt.eventDate < todayDateStr;

                const recordedInEvt = Object.keys(evt.statuses || {}).length;
                const isEvtComplete = totalRoster > 0 && recordedInEvt >= totalRoster;
                const isEvtInProgress = recordedInEvt > 0 && recordedInEvt < totalRoster;
                const isEvtEmpty = recordedInEvt === 0;

                const pCount = Object.values(evt.statuses || {}).filter((s) => s === 'present').length;
                const rate = totalRoster > 0 ? Math.round((pCount / totalRoster) * 100) : 0;
                const dObj = new Date(evt.eventDate + 'T00:00:00');
                const meta = getEventTypeMeta(evt.type);
                const TypeIcon = meta.icon;

                return (
                  <div
                    key={evt.id}
                    id={`ribbon_evt_${evt.id}`}
                    onClick={() => {
                      setSelectedEventId(evt.id);
                      if (viewMode === 'matrix') setViewMode('checklist');
                    }}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition cursor-pointer shrink-0 group ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/30'
                        : isToday
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                        : isPast && isEvtEmpty
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-teal-500 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {/* Date Block */}
                    <div className="text-center">
                      <span className={`block text-[9px] font-black uppercase ${isSelected ? 'text-teal-200' : 'text-zinc-400'}`}>
                        {dObj.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="block text-sm font-black leading-tight">
                        {dObj.getDate()}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="space-y-0.5 text-start">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className={`w-3 h-3 ${isSelected ? 'text-teal-200' : meta.color}`} />
                        <span className="text-xs font-bold truncate max-w-[120px]">
                          {isToday && <span className="me-1">⭐</span>}
                          {evt.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {isEvtComplete && (
                          <span className={`block text-[10px] font-bold ${
                            isSelected ? 'text-teal-100' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            ✓ {translate('status_complete')} ({rate}%)
                          </span>
                        )}
                        {isEvtInProgress && (
                          <span className={`block text-[10px] font-semibold ${
                            isSelected ? 'text-teal-100' : 'text-teal-600 dark:text-teal-400'
                          }`}>
                            ⏳ {recordedInEvt}/{totalRoster} {translate('status_in_progress')}
                          </span>
                        )}
                        {isEvtEmpty && isPast && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            isSelected ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300'
                          }`}>
                            ⚠️ {translate('attendance_not_taken')}
                          </span>
                        )}
                        {isEvtEmpty && !isPast && (
                          <span className={`block text-[10px] ${
                            isSelected ? 'text-teal-200' : 'text-zinc-400'
                          }`}>
                            ⚪ {translate('status_not_started')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete session button (canEdit only on hover) */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteEventId(evt.id);
                        }}
                        className={`p-1 rounded-lg transition opacity-0 group-hover:opacity-100 ${
                          isSelected ? 'text-teal-100 hover:text-white' : 'text-zinc-400 hover:text-rose-500'
                        }`}
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scroll Right */}
            <button
              type="button"
              onClick={() => scrollRibbon(isRtl ? -260 : 260)}
              className="p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition cursor-pointer shrink-0 z-10"
              title="Scroll timeline"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4. PER-TYPE ENGAGEMENT ANALYTICS BAR */}
          {perTypeStats.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs no-scrollbar">
              <span className="font-bold text-zinc-400 shrink-0 text-[11px]">Type Averages:</span>
              {perTypeStats.map((st) => {
                const meta = getEventTypeMeta(st.name);
                const TypeIcon = meta.icon;
                return (
                  <span
                    key={st.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0 shadow-2xs font-semibold text-[11px]"
                  >
                    <TypeIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span>{translate(st.name.toLowerCase().replace(/\s+/g, '_')) || st.name}:</span>
                    <strong className="text-teal-600 dark:text-teal-400">{st.avgRate}%</strong>
                    <span className="text-zinc-400 text-[10px]">({st.count})</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* 5. PASTORAL CARE ABSENCE ALERT BANNER (يحتاج افتقاد) */}
          {consecutiveAbsenceAlerts.length > 0 && !pastoralAlertsDismissed && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/40 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {translate('needs_pastoral_care')} ({consecutiveAbsenceAlerts.length} {translate('consecutive_absences_warning')}):
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPastoralAlertsDismissed(true)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  title="Dismiss alert banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List of flagged students */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {consecutiveAbsenceAlerts.map(({ kid, consecutiveCount, fatherPhone, motherPhone }) => {
                  const targetPhone = fatherPhone || motherPhone || '';
                  const waUrl = buildPastoralWhatsAppUrl(
                    targetPhone,
                    kid.info.fullName,
                    kid.contacts?.fatherName || '',
                    isRtl
                  );

                  return (
                    <div
                      key={kid.id}
                      className="p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {kid.info.photoUrl ? (
                          <img
                            src={kid.info.photoUrl}
                            alt={kid.info.fullName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-rose-200 dark:border-rose-800"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {kid.info.fullName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            <bdi>{kid.info.fullName}</bdi>
                          </p>
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                            Missed {consecutiveCount} consecutive sessions
                          </p>
                        </div>
                      </div>

                      {/* Instant Follow-up Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {targetPhone && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition active:scale-95 shadow-xs"
                            title="Open WhatsApp pastoral message"
                          >
                            <span className="text-[11px] font-bold px-1">WhatsApp</span>
                          </a>
                        )}
                        {targetPhone && (
                          <a
                            href={`tel:${targetPhone}`}
                            className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition"
                            title="Call parent"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. VIEW MODE: WEEKLY CHECKLIST VIEW */}
          {viewMode === 'checklist' && selectedEvent && (
            <div className="space-y-4">
              {/* Upcoming Session Notice Guardrail */}
              {selectedEvent.eventDate > todayDateStr && (
                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{translate('upcoming_session_notice')}</span>
                </div>
              )}

              {/* Session Control Bar */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const meta = getEventTypeMeta(selectedEvent.type);
                      const TypeIcon = meta.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.bg}`}>
                          <TypeIcon className={`w-3 h-3 ${meta.color}`} />
                          <span>{translate(selectedEvent.type.toLowerCase().replace(/\s+/g, '_')) || selectedEvent.type}</span>
                        </span>
                      );
                    })()}
                    <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100">
                      {selectedEvent.title}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">
                    📅 {new Date(selectedEvent.eventDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {selectedEvent.takenBy && (
                      <span className="ms-2 ps-2 border-s border-zinc-200 dark:border-zinc-700">
                        {translate('taken_by')}: <strong className="text-zinc-700 dark:text-zinc-300">{selectedEvent.takenBy}</strong>
                      </span>
                    )}
                  </p>
                </div>

                {/* Auto-Save & Actions Trigger */}
                <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
                  {/* Auto-Save Status */}
                  <div className="text-xs font-semibold flex items-center gap-1.5 text-zinc-400">
                    {autoSaveStatus === 'saving' && (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                        <span>{translate('saving_changes')}</span>
                      </>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">{translate('auto_saved')}</span>
                      </>
                    )}
                  </div>

                  {/* Reset Attendance Button */}
                  {canEdit && recordedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setResetModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
                      title="Clear attendance taken by mistake for this session"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{translate('reset_session')}</span>
                    </button>
                  )}

                  {/* Manual Save Button */}
                  {canEdit && (
                    <button
                      onClick={() => persistAttendance(selectedEvent.id, statuses, notesByKid)}
                      disabled={autoSaveStatus === 'saving'}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{translate('save')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 6 Metrics Bar (Including Unrecorded count) */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 sm:gap-3 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs text-center">
                <div className="p-2">
                  <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase">Roster</p>
                  <p className="text-xl sm:text-2xl font-black text-zinc-800 dark:text-zinc-200">{totalRoster}</p>
                </div>
                <div className="p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{translate('present')}</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{presentCount}</p>
                </div>
                <div className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <p className="text-[10px] sm:text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">{translate('absent')}</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">{absentCount}</p>
                </div>
                <div className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                  <p className="text-[10px] sm:text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">{translate('excused')}</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{excusedCount}</p>
                </div>
                <div className={`p-2 rounded-2xl border ${
                  unrecordedCount > 0
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60'
                }`}>
                  <p className={`text-[10px] sm:text-[11px] font-bold uppercase ${unrecordedCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-400'}`}>
                    {translate('unrecorded')}
                  </p>
                  <p className={`text-xl sm:text-2xl font-black ${unrecordedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
                    {unrecordedCount}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1 p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
                  <p className="text-[10px] sm:text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase">{translate('attendance_rate')}</p>
                  <p className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">{attendancePercent}%</p>
                </div>
              </div>

              {/* Roster Controls: Search & ⚡ Mark All Present Shortcut */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search student or father name..."
                    className="w-full ps-9 pe-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                  />
                </div>

                {canEdit && (
                  <button
                    onClick={handleMarkAllPresent}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>⚡ {translate('mark_all_present')}</span>
                  </button>
                )}
              </div>

              {/* Full-Width Student Roll-Call Cards with High-Fidelity States */}
              <div className="space-y-2.5">
                {filteredKids.length === 0 && (
                  <div className="p-8 text-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                    No students enrolled or matching search in this class.
                  </div>
                )}

                {filteredKids.map((kid) => {
                  const currentStatus = statuses[kid.id];
                  const isPresent = currentStatus === 'present';
                  const isAbsent = currentStatus === 'absent';
                  const isExcused = currentStatus === 'excused';
                  const isUnrecorded = !currentStatus;

                  const kidNote = notesByKid[kid.id] || '';
                  const hasNote = !!kidNote.trim();
                  const isNoteOpen = expandedNotes[kid.id] || hasNote;
                  const targetPhone = kid.contacts?.fatherMob || kid.contacts?.motherMob || kid.contacts?.kidMob || '';
                  const waUrl = buildPastoralWhatsAppUrl(
                    targetPhone,
                    kid.info.fullName,
                    kid.contacts?.fatherName || '',
                    isRtl
                  );

                  return (
                    <div
                      key={kid.id}
                      className={`p-3.5 sm:p-4 rounded-3xl border shadow-2xs space-y-2 transition ${
                        isPresent
                          ? 'border-s-4 border-s-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/10 border-zinc-200 dark:border-zinc-800'
                          : isAbsent
                          ? 'border-s-4 border-s-rose-500 bg-rose-50/20 dark:bg-rose-950/15 border-zinc-200 dark:border-zinc-800'
                          : isExcused
                          ? 'border-s-4 border-s-amber-500 bg-amber-50/20 dark:bg-amber-950/15 border-zinc-200 dark:border-zinc-800'
                          : 'border-s-4 border-s-zinc-300 dark:border-s-zinc-700 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Student Name & Avatar with floating mini badge */}
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {kid.info.photoUrl ? (
                              <img
                                src={kid.info.photoUrl}
                                alt={kid.info.fullName}
                                className="w-11 h-11 rounded-2xl object-cover shrink-0 shadow-xs border border-zinc-200 dark:border-zinc-700"
                              />
                            ) : (
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                                isPresent
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isAbsent
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : isExcused
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : kid.info.gender === 'female'
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60'
                                  : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60'
                              }`}>
                                {kid.info.fullName.charAt(0)}
                              </div>
                            )}
                            {/* Floating mini badge on avatar */}
                            {isPresent && (
                              <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                            {isAbsent && (
                              <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                                <X className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                            {isExcused && (
                              <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                                <Clock className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                <bdi>{kid.info.fullName}</bdi>
                              </h4>
                              {/* Distinct Status Tag */}
                              {isPresent && (
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.2 rounded-md">
                                  ✓ {translate('present')}
                                </span>
                              )}
                              {isAbsent && (
                                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.2 rounded-md">
                                  ✕ {translate('absent')}
                                </span>
                              )}
                              {isExcused && (
                                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.2 rounded-md">
                                  ⏱ {translate('excused')}
                                </span>
                              )}
                              {isUnrecorded && (
                                <span className="text-[10px] text-zinc-400 italic">
                                  {translate('unrecorded')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : 'Student'}
                            </p>
                          </div>
                        </div>

                        {/* 3-State Tactile Selector + Absence WhatsApp Shortcut + Note Toggle */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 3-State Tactile Pills (Click active to unselect/clear) */}
                          <div className="grid grid-cols-3 gap-1.5 w-64 sm:w-72">
                            {/* Present */}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleSetKidStatus(kid.id, 'present')}
                              title={isPresent ? translate('reset_session') : translate('present')}
                              className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 py-2 sm:py-1.5 px-2.5 rounded-xl text-xs font-bold transition touch-manipulation ${
                                canEdit ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                              } ${
                                isPresent
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/40'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>{translate('present')}</span>
                            </button>

                            {/* Absent */}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleSetKidStatus(kid.id, 'absent')}
                              title={isAbsent ? translate('reset_session') : translate('absent')}
                              className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 py-2 sm:py-1.5 px-2.5 rounded-xl text-xs font-bold transition touch-manipulation ${
                                canEdit ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                              } ${
                                isAbsent
                                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500/40'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                              }`}
                            >
                              <X className="w-3.5 h-3.5 shrink-0" />
                              <span>{translate('absent')}</span>
                            </button>

                            {/* Excused */}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleSetKidStatus(kid.id, 'excused')}
                              title={isExcused ? translate('reset_session') : translate('excused')}
                              className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 py-2 sm:py-1.5 px-2.5 rounded-xl text-xs font-bold transition touch-manipulation ${
                                canEdit ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                              } ${
                                isExcused
                                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-500/40'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{translate('excused')}</span>
                            </button>
                          </div>

                          {/* Instant WhatsApp Shortcut on Absence */}
                          {isAbsent && targetPhone && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition active:scale-95 shadow-sm touch-manipulation"
                              title="Send WhatsApp pastoral checkup to parent"
                            >
                              <span>WhatsApp</span>
                            </a>
                          )}

                          {/* Note Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleKidNote(kid.id)}
                            className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl transition cursor-pointer relative touch-manipulation ${
                              hasNote
                                ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600'
                            }`}
                            title="Add session note"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {hasNote && (
                              <span className="w-2 h-2 rounded-full bg-teal-500 absolute -top-0.5 -end-0.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Pastoral Note Input */}
                      {isNoteOpen && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            value={kidNote}
                            disabled={!canEdit}
                            readOnly={!canEdit}
                            onChange={(e) => handleSetKidNote(kid.id, e.target.value)}
                            placeholder={canEdit ? translate('kid_note_placeholder') : 'No pastoral note'}
                            className="flex-1 p-2.5 sm:p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-base sm:text-xs disabled:opacity-75"
                          />
                          {canEdit && hasNote && (
                            <button
                              type="button"
                              onClick={() => handleSetKidNote(kid.id, '')}
                              className="p-1 text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                              title="Clear Note"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. VIEW MODE: FULL TERM MATRIX GRID VIEW (Spreadsheet Overview) */}
          {viewMode === 'matrix' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                    {translate('matrix_view')}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Full-term attendance spreadsheet. Tap any cell to cycle: Unrecorded ➔ Present ➔ Absent ➔ Excused ➔ Unrecorded.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> P: Present</span>
                  <span className="flex items-center gap-1 text-rose-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> A: Absent</span>
                  <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> E: Excused</span>
                  <span className="flex items-center gap-1 text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block" /> -: Unrecorded</span>
                </div>
              </div>

              {/* High-Density Spreadsheet Matrix Table */}
              <div className="border border-zinc-200 dark:border-zinc-700/80 rounded-2xl overflow-x-auto max-h-[70vh]">
                <table className="w-full text-start text-xs border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 font-bold text-[11px] sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-3 text-start sticky start-0 bg-zinc-50 dark:bg-zinc-800/90 z-30 shadow-xs min-w-[180px]">
                        Student Name
                      </th>
                      {ribbonEvents.map((evt) => {
                        const dObj = new Date(evt.eventDate + 'T00:00:00');
                        const meta = getEventTypeMeta(evt.type);
                        const TypeIcon = meta.icon;
                        return (
                          <th key={evt.id} className="px-2 py-2.5 text-center min-w-[75px] border-s border-zinc-200 dark:border-zinc-700/60">
                            <span className="flex items-center justify-center gap-1 text-[9px] uppercase text-zinc-400">
                              <TypeIcon className="w-2.5 h-2.5" />
                              <span>{dObj.toLocaleDateString(undefined, { month: 'short' })}</span>
                            </span>
                            <span className="block text-xs font-black">{dObj.getDate()}</span>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-center border-s border-zinc-200 dark:border-zinc-700 min-w-[90px]">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                    {kids.map((kid) => {
                      let pTotal = 0;
                      let recordedTotal = 0;

                      return (
                        <tr key={kid.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          {/* Fixed Student Name column */}
                          <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap sticky start-0 bg-white dark:bg-zinc-900 z-10 shadow-xs">
                            <bdi>{kid.info.fullName}</bdi>
                          </td>

                          {/* Event Session Cells */}
                          {ribbonEvents.map((evt) => {
                            const status = evt.statuses?.[kid.id];
                            if (status === 'present') pTotal++;
                            if (status) recordedTotal++;

                            return (
                              <td
                                key={evt.id}
                                onClick={() => canEdit && handleMatrixCellToggle(evt.id, kid.id)}
                                className={`px-1 py-2 text-center border-s border-zinc-100 dark:border-zinc-800/60 transition ${
                                  canEdit ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'cursor-default'
                                }`}
                              >
                                {status === 'present' && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px]">
                                    P
                                  </span>
                                )}
                                {status === 'absent' && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold text-[11px]">
                                    A
                                  </span>
                                )}
                                {status === 'excused' && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-extrabold text-[11px]">
                                    E
                                  </span>
                                )}
                                {!status && (
                                  <span className="text-zinc-300 dark:text-zinc-700 text-xs">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Overall Student Rate */}
                          <td className="px-3 py-2 text-center border-s border-zinc-200 dark:border-zinc-700 font-mono font-bold text-xs whitespace-nowrap">
                            {recordedTotal > 0 ? (
                              <span className={pTotal / recordedTotal >= 0.75 ? 'text-teal-600' : 'text-rose-600'}>
                                {Math.round((pTotal / recordedTotal) * 100)}%
                              </span>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. VIEW MODE: STATISTICS & INSIGHTS */}
          {viewMode === 'stats' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Executive 4-KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Average Term Attendance */}
                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {translate('average_term_attendance')}
                    </p>
                    <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-0.5">
                      {analytics.averageRate}%
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1 font-semibold">
                      <TrendingUp className="w-3 h-3 text-teal-600" />
                      <span>{analytics.totalRoster} enrolled students</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                </div>

                {/* 2. Sessions Conducted */}
                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {translate('conducted_sessions')}
                    </p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                      {analytics.conductedSessions}
                      <span className="text-sm font-semibold text-zinc-400 ms-1">/ {analytics.totalScheduledSessions}</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                      {analytics.totalScheduledSessions > 0
                        ? `${Math.round((analytics.conductedSessions / analytics.totalScheduledSessions) * 100)}% scheduled completed`
                        : 'No sessions scheduled'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                {/* 3. Best Attended Session */}
                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {translate('best_attended_session')}
                    </p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[170px]">
                      {analytics.bestSession ? `${analytics.bestSession.rate}%` : '-'}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-semibold truncate max-w-[170px]">
                      {analytics.bestSession ? `${analytics.bestSession.title} (${analytics.bestSession.eventDate})` : 'No sessions recorded'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                {/* 4. At-Risk (<50%) */}
                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {translate('at_risk_students')}
                    </p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                      {analytics.atRiskKids.length}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                      Need urgent pastoral visit
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Weekly Attendance Trend Visual Bar Chart */}
              <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-600" />
                      <span>{translate('attendance_trend')}</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Chronological attendance percentages across all conducted sessions this term
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ≥80% High</span>
                    <span className="flex items-center gap-1 text-teal-600"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> 60-79% Normal</span>
                    <span className="flex items-center gap-1 text-rose-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> &lt;60% Low</span>
                  </div>
                </div>

                {analytics.weeklyTrend.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400 italic">
                    No sessions recorded yet to generate attendance trend.
                  </div>
                ) : (
                  <div className="pt-6 pb-2 overflow-x-auto no-scrollbar">
                    <div className="flex items-end gap-3 min-w-max h-48 px-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                      {analytics.weeklyTrend.map((item) => {
                        const dObj = new Date(item.eventDate + 'T00:00:00');
                        const barColor = item.rate >= 80 ? 'bg-emerald-500' : item.rate >= 60 ? 'bg-teal-500' : 'bg-rose-500';

                        return (
                          <div key={item.eventId} className="flex flex-col items-center gap-1.5 group relative">
                            {/* Hover Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute bottom-full mb-2 z-30 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg whitespace-nowrap">
                              <p className="text-teal-400 dark:text-teal-600">{item.title}</p>
                              <p>{item.presentCount} / {analytics.totalRoster} Present ({item.rate}%)</p>
                              <p className="text-zinc-400 dark:text-zinc-500 text-[9px]">{item.eventDate} • {item.type}</p>
                            </div>

                            {/* Percentage Label */}
                            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">
                              {item.rate}%
                            </span>

                            {/* Bar Column */}
                            <div className="w-9 sm:w-11 bg-zinc-100 dark:bg-zinc-800 rounded-xl h-36 flex items-end p-1">
                              <div
                                style={{ height: `${Math.max(item.rate, 6)}%` }}
                                className={`w-full rounded-lg transition-all duration-500 shadow-2xs ${barColor}`}
                              />
                            </div>

                            {/* Date Label */}
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">
                              {dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pastoral Engagement Distribution Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Distribution 1: Faithful (80%-100%) */}
                <div className="p-4 rounded-3xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-extrabold text-xs">
                      <span>🟢</span>
                      <span>{translate('faithful_students')}</span>
                    </span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {analytics.faithfulKids.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Students attending consistently. Candidates for honors and rewards.
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                    {analytics.faithfulKids.length === 0 && <span className="text-xs text-zinc-400 italic">None yet</span>}
                    {analytics.faithfulKids.map((s) => (
                      <div key={s.kid.id} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate"><bdi>{s.kid.info.fullName}</bdi></span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">{s.attendanceRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Distribution 2: Irregular (50%-79%) */}
                <div className="p-4 rounded-3xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-extrabold text-xs">
                      <span>🟡</span>
                      <span>{translate('irregular_students')}</span>
                    </span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                      {analytics.irregularKids.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Fluctuating attendance. Require regular pastoral phone checkups.
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                    {analytics.irregularKids.length === 0 && <span className="text-xs text-zinc-400 italic">None</span>}
                    {analytics.irregularKids.map((s) => (
                      <div key={s.kid.id} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate"><bdi>{s.kid.info.fullName}</bdi></span>
                        <span className="font-black text-amber-600 dark:text-amber-400">{s.attendanceRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Distribution 3: At-Risk (<50%) with Instant Follow-up */}
                <div className="p-4 rounded-3xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-extrabold text-xs">
                      <span>🔴</span>
                      <span>{translate('at_risk_students')}</span>
                    </span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                      {analytics.atRiskKids.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    High absence rate. Immediate pastoral visitation candidate.
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                    {analytics.atRiskKids.length === 0 && <span className="text-xs text-zinc-400 italic">Zero at-risk students!</span>}
                    {analytics.atRiskKids.map((s) => {
                      const targetPhone = s.kid.contacts?.fatherMob || s.kid.contacts?.motherMob || s.kid.contacts?.kidMob || '';
                      const waUrl = buildPastoralWhatsAppUrl(
                        targetPhone,
                        s.kid.info.fullName,
                        s.kid.contacts?.fatherName || '',
                        isRtl
                      );

                      return (
                        <div key={s.kid.id} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs gap-1.5">
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate"><bdi>{s.kid.info.fullName}</bdi></p>
                            <p className="text-[10px] text-rose-600 font-semibold">{s.attendanceRate}% ({s.presentCount}/{analytics.conductedSessions})</p>
                          </div>
                          {targetPhone && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] transition shrink-0"
                              title="WhatsApp parent"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Event Type Engagement Comparison & Honor Roll Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Event Type Comparison Progress Bars */}
                <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    <span>{translate('engagement_by_type')}</span>
                  </h3>
                  <div className="space-y-3 pt-1">
                    {analytics.typeComparison.length === 0 && (
                      <p className="text-xs text-zinc-400 italic">No events recorded yet.</p>
                    )}
                    {analytics.typeComparison.map((tc) => {
                      const meta = getEventTypeMeta(tc.type);
                      const TypeIcon = meta.icon;

                      return (
                        <div key={tc.type} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                              <TypeIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                              <span>{translate(tc.type.toLowerCase().replace(/\s+/g, '_')) || tc.type}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">({tc.sessionCount} sessions)</span>
                            </span>
                            <span className="text-teal-600 dark:text-teal-400 font-black">{tc.averageRate}%</span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${tc.averageRate}%` }}
                              className="bg-teal-600 h-full rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 🌟 Honor Roll (Top Attendees) */}
                <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>{translate('honor_roll')}</span>
                  </h3>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {analytics.topAttendees.slice(0, 5).map((s, idx) => (
                      <div key={s.kid.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-zinc-200 text-zinc-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100"><bdi>{s.kid.info.fullName}</bdi></span>
                        </div>
                        <div className="text-end font-mono">
                          <span className="font-extrabold text-teal-600 dark:text-teal-400">{s.attendanceRate}%</span>
                          <span className="text-[10px] text-zinc-400 ms-1">({s.presentCount} attended)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 1-Click Excel Export Action Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                      {translate('export_attendance_report')}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Multi-sheet Excel report with complete metrics, student registers, and ministry breakdowns.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isExportingExcel ? translate('exporting') : translate('export_attendance_report')}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Event Modal */}
      <NewEventModal
        isOpen={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        onSave={handleCreateSingleEvent}
        availableEventTypes={groupEventTypes}
      />

      {/* Recurring Schedule Modal */}
      <RecurringEventModal
        isOpen={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        onGenerate={handleGenerateRecurring}
        availableEventTypes={groupEventTypes}
      />

      {/* Delete Event Confirmation Modal */}
      {deleteEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Delete Attendance Session?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {translate('delete_event_confirm')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeletingEvent}
                onClick={() => setDeleteEventId(null)}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                {translate('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeletingEvent}
                onClick={handleConfirmDeleteEvent}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingEvent && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isDeletingEvent ? translate('saving') : translate('delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Session Attendance Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {translate('reset_session')}?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {translate('reset_session_confirm')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                {translate('cancel')}
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetSessionAttendance}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isResetting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isResetting ? translate('saving') : translate('reset_session')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
