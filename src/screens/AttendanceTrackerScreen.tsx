import React, { useState, useEffect } from 'react';
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
import type { Kid, AttendanceStatus, AttendanceEvent, AttendanceEventType } from '../types';
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
  ArrowLeft,
  CalendarCheck
} from 'lucide-react';

export const AttendanceTrackerScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId, 
    classes 
  } = useFilter();

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  // Roster of kids
  const [kids, setKids] = useState<Kid[]>([]);
  
  // Events state
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Active event attendance & note state
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notesByKid, setNotesByKid] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [rosterSearch, setRosterSearch] = useState('');

  // Modals
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  // Loading states (Approach 2)
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Modal Escape hooks
  useModalEscape(() => setDeleteEventId(null), !!deleteEventId);

  // 1. Listen to Kids for the selected class
  useEffect(() => {
    if (!selectedChurchId) return;

    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsubKids = onSnapshot(kidsRef, (snap) => {
      const items: Kid[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((k) => {
          if (k.active === false) return false;
          const asgn = k.activeAssignment || {};
          const cId = asgn.classId || k.classId;
          return !selectedClassId || cId === selectedClassId;
        });
      setKids(items);
    });

    return () => unsubKids();
  }, [selectedChurchId, selectedClassId]);

  // 2. Listen to Attendance Events for this class & year
  useEffect(() => {
    if (!selectedChurchId || !selectedClassId) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    const eventsRef = collection(db, 'churches', selectedChurchId, 'attendanceEvents');
    const unsubEvents = onSnapshot(eventsRef, (snap) => {
      const items: AttendanceEvent[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AttendanceEvent))
        .filter((evt) => {
          if (evt.classId !== selectedClassId) return false;
          if (selectedAcademicYearId && evt.academicYearId && evt.academicYearId !== selectedAcademicYearId) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate)); // Most recent first

      setEvents(items);

      // Auto-select first event if none selected or if previously selected was deleted
      if (items.length > 0) {
        setSelectedEventId((prev) => (prev && items.some((e) => e.id === prev) ? prev : items[0].id));
      } else {
        setSelectedEventId(null);
      }
    });

    return () => unsubEvents();
  }, [selectedChurchId, selectedClassId, selectedAcademicYearId]);

  // 3. Sync local state when selected event changes
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  useEffect(() => {
    if (selectedEvent) {
      setStatuses(selectedEvent.statuses || {});
      setNotesByKid(selectedEvent.notesByKid || {});
      setSavedSuccess(false);
    } else {
      setStatuses({});
      setNotesByKid({});
    }
  }, [selectedEventId]);

  // Handle single status change
  const handleSetKidStatus = (kidId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [kidId]: status,
    }));
    setSavedSuccess(false);
  };

  // Shortcut: Mark all currently absent/unrecorded kids as present
  const handleMarkAllPresent = () => {
    const updated = { ...statuses };
    filteredKids.forEach((k) => {
      if (!updated[k.id] || updated[k.id] === 'absent') {
        updated[k.id] = 'present';
      }
    });
    setStatuses(updated);
    setSavedSuccess(false);
  };

  // Toggle note input visibility for a kid
  const toggleKidNote = (kidId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [kidId]: !prev[kidId],
    }));
  };

  // Update note text for a kid
  const handleSetKidNote = (kidId: string, note: string) => {
    setNotesByKid((prev) => ({
      ...prev,
      [kidId]: note,
    }));
    setSavedSuccess(false);
  };

  // Save Attendance (Approach 2 loading)
  const handleSaveAttendance = async () => {
    if (!selectedChurchId || !selectedEvent) return;

    setSavingAttendance(true);
    try {
      const eventRef = doc(db, 'churches', selectedChurchId, 'attendanceEvents', selectedEvent.id);
      await setDoc(eventRef, {
        statuses,
        notesByKid,
        takenAt: new Date().toISOString(),
        takenBy: user?.displayName || user?.email || 'Servant',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Save attendance failed:', err);
      alert(`Error saving attendance: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingAttendance(false);
    }
  };

  // Create single event
  const handleCreateSingleEvent = async (data: { title: string; type: AttendanceEventType; eventDate: string }) => {
    if (!selectedChurchId || !selectedClassId) return;

    const eventId = `evt_${Date.now()}`;
    const eventRef = doc(db, 'churches', selectedChurchId, 'attendanceEvents', eventId);

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
    if (!selectedChurchId || !selectedClassId || eventList.length === 0) return;

    const batchSize = 400;
    for (let i = 0; i < eventList.length; i += batchSize) {
      const chunk = eventList.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach((item, idx) => {
        const eventId = `evt_${seriesId}_${i + idx}`;
        const eventRef = doc(db, 'churches', selectedChurchId, 'attendanceEvents', eventId);

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
    if (!selectedChurchId || !deleteEventId) return;

    setIsDeletingEvent(true);
    try {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'attendanceEvents', deleteEventId));
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

  // Filtered Events
  const filteredEvents = events.filter((evt) => {
    if (typeFilter !== 'all' && evt.type !== typeFilter) return false;
    return true;
  });

  // Filtered Kids Roster
  const filteredKids = kids.filter((k) => {
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return (
      k.info.fullName.toLowerCase().includes(q) ||
      (k.contacts?.fatherName && k.contacts.fatherName.toLowerCase().includes(q))
    );
  });

  // Metrics calculation
  const presentCount = Object.values(statuses).filter((s) => s === 'present').length;
  const absentCount = Object.values(statuses).filter((s) => s === 'absent').length;
  const excusedCount = Object.values(statuses).filter((s) => s === 'excused').length;
  const totalRoster = kids.length;
  const attendancePercent = totalRoster > 0 ? Math.round((presentCount / totalRoster) * 100) : 0;

  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'Select Class';

  // Helper: event type badge styling
  const getTypeBadge = (type: AttendanceEventType) => {
    switch (type) {
      case 'liturgy':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'hymns':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'trip':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'activity':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'lesson':
      default:
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('attendance')}</span>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
              {activeClassName}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Event-based Sunday School sessions, automated recurring schedules, and per-student pastoral notes
          </p>
        </div>

        {/* Action Buttons */}
        {selectedClassId && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Warning if no specific class is chosen */}
      {!selectedClassId && (
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-2">
          <Calendar className="w-8 h-8 text-amber-600 mx-auto" />
          <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">Please Select a Specific Class</h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
            Use the top navigation bar to select a specific <strong>Class</strong>. Attendance events, schedules, and student rosters are managed per classroom.
          </p>
        </div>
      )}

      {/* OPTION A: Split-Pane Master-Detail View */}
      {selectedClassId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANE: Scheduled Events List (4 cols on lg) */}
          <div className={`lg:col-span-4 space-y-3 ${selectedEventId ? 'hidden lg:block' : 'block'}`}>
            {/* Filter Pills */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-zinc-500">
                {translate('events')} ({filteredEvents.length})
              </span>
              <div className="flex gap-1 overflow-x-auto text-[11px] font-semibold">
                {['all', 'lesson', 'liturgy', 'activity'].map((tKey) => (
                  <button
                    key={tKey}
                    onClick={() => setTypeFilter(tKey)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer ${
                      typeFilter === tKey
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {tKey === 'all' ? translate('all') : translate(tKey) || tKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Cards List */}
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pe-1">
              {filteredEvents.length === 0 && (
                <div className="p-8 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <Calendar className="w-6 h-6 text-zinc-300 mx-auto" />
                  <p className="text-xs text-zinc-400 font-semibold">{translate('no_events_scheduled')}</p>
                  <button
                    onClick={() => setRecurringModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline pt-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Schedule</span>
                  </button>
                </div>
              )}

              {filteredEvents.map((evt) => {
                const isSelected = evt.id === selectedEventId;
                const isTaken = !!evt.takenAt;
                const presentCountInEvt = Object.values(evt.statuses || {}).filter((s) => s === 'present').length;
                const rate = totalRoster > 0 ? Math.round((presentCountInEvt / totalRoster) * 100) : 0;

                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer relative group flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-900 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                        : 'bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Date Block */}
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                        <span className="text-[9px] font-bold uppercase text-zinc-400">
                          {new Date(evt.eventDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-base font-black text-zinc-800 dark:text-zinc-200">
                          {new Date(evt.eventDate + 'T00:00:00').getDate()}
                        </span>
                      </div>

                      {/* Event Meta */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getTypeBadge(evt.type)}`}>
                            {translate(evt.type) || evt.type}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate">
                            {evt.title}
                          </span>
                        </div>

                        {/* Status / Rate Badge */}
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                          {isTaken ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{rate}% Present ({presentCountInEvt}/{totalRoster})</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Not Recorded Yet</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete action (visible on hover) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteEventId(evt.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANE: Attendance & Notes Logger (8 cols on lg) */}
          <div className={`lg:col-span-8 space-y-4 ${selectedEventId ? 'block' : 'hidden lg:block'}`}>
            {!selectedEvent ? (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <CalendarCheck className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">No Event Selected</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Select an attendance session from the left schedule list or create a new event to begin logging student attendance and pastoral notes.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mobile Back to Events button */}
                <div className="lg:hidden">
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:underline mb-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Events List</span>
                  </button>
                </div>

                {/* Session Banner */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getTypeBadge(selectedEvent.type)}`}>
                        {translate(selectedEvent.type) || selectedEvent.type}
                      </span>
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

                  {/* Save button (Approach 2 loading) */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={handleSaveAttendance}
                      disabled={savingAttendance}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
                    >
                      {savingAttendance ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{savingAttendance ? translate('saving') : savedSuccess ? 'Saved!' : translate('save')}</span>
                    </button>
                  </div>
                </div>

                {/* Live Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs text-center">
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
                  <div className="col-span-2 sm:col-span-1 p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
                    <p className="text-[10px] sm:text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase">{translate('attendance_rate')}</p>
                    <p className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">{attendancePercent}%</p>
                  </div>
                </div>

                {/* Roster Controls: Search & Mark All Present Shortcut */}
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

                  <button
                    onClick={handleMarkAllPresent}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>{translate('mark_all_present')}</span>
                  </button>
                </div>

                {/* Students Roster Cards */}
                <div className="space-y-2.5">
                  {filteredKids.length === 0 && (
                    <div className="p-8 text-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                      No students enrolled or found in this class.
                    </div>
                  )}

                  {filteredKids.map((kid) => {
                    const currentStatus = statuses[kid.id];
                    const kidNote = notesByKid[kid.id] || '';
                    const hasNote = !!kidNote.trim();
                    const isNoteOpen = expandedNotes[kid.id] || hasNote;

                    return (
                      <div
                        key={kid.id}
                        className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-2 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Student Info */}
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              kid.info.gender === 'female'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60'
                                : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60'
                            }`}>
                              {kid.info.fullName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                <bdi>{kid.info.fullName}</bdi>
                              </h4>
                              <p className="text-[11px] text-zinc-400">
                                {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : 'Student'}
                              </p>
                            </div>
                          </div>

                          {/* 3-State Touch Control Bar + Note Button */}
                          <div className="flex items-center gap-2">
                            <div className="grid grid-cols-3 gap-1.5 w-64 sm:w-72">
                              {/* Present */}
                              <button
                                type="button"
                                onClick={() => handleSetKidStatus(kid.id, 'present')}
                                className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{translate('present')}</span>
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                onClick={() => handleSetKidStatus(kid.id, 'absent')}
                                className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                                  currentStatus === 'absent'
                                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{translate('absent')}</span>
                              </button>

                              {/* Excused */}
                              <button
                                type="button"
                                onClick={() => handleSetKidStatus(kid.id, 'excused')}
                                className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                                  currentStatus === 'excused'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{translate('excused')}</span>
                              </button>
                            </div>

                            {/* Note Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleKidNote(kid.id)}
                              className={`p-2 rounded-xl transition cursor-pointer relative ${
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
                              onChange={(e) => handleSetKidNote(kid.id, e.target.value)}
                              placeholder={translate('kid_note_placeholder')}
                              className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-xs"
                            />
                            {hasNote && (
                              <button
                                type="button"
                                onClick={() => handleSetKidNote(kid.id, '')}
                                className="p-1 text-zinc-400 hover:text-rose-500 transition"
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
          </div>
        </div>
      )}

      {/* New Event Modal */}
      <NewEventModal
        isOpen={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        onSave={handleCreateSingleEvent}
      />

      {/* Recurring Schedule Modal */}
      <RecurringEventModal
        isOpen={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        onGenerate={handleGenerateRecurring}
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
    </div>
  );
};
