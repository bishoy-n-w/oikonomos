import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { Kid, AttendanceStatus } from '../types';
import { 
  Check, 
  X, 
  Clock, 
  Save,
  RefreshCw 
} from 'lucide-react';

export const AttendanceTrackerScreen: React.FC = () => {
  const { translate } = useApp();
  const { selectedChurchId, selectedClassId, classes } = useFilter();

  const [kids, setKids] = useState<Kid[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; notes?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 1. Listen to Kids for the selected class
  useEffect(() => {
    if (!selectedChurchId) return;

    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsubKids = onSnapshot(kidsRef, (snap) => {
      const items: Kid[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((k) => k.active !== false && (!selectedClassId || k.classId === selectedClassId));
      setKids(items);
    });

    return () => unsubKids();
  }, [selectedChurchId, selectedClassId]);

  // 2. Listen to existing attendance records for this date and class
  useEffect(() => {
    if (!selectedChurchId || !selectedClassId || !selectedDate) return;

    const docId = `${selectedDate}_${selectedClassId}`;
    const attendanceDocRef = doc(db, 'churches', selectedChurchId, 'attendance', docId);

    const unsubAttendance = onSnapshot(attendanceDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAttendanceMap(data.records || {});
      } else {
        setAttendanceMap({});
      }
    });

    return () => unsubAttendance();
  }, [selectedChurchId, selectedClassId, selectedDate]);

  const setKidStatus = (kidId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [kidId]: {
        ...prev[kidId],
        status,
      },
    }));
    setSavedSuccess(false);
  };

  const handleSaveAttendance = async () => {
    if (!selectedChurchId || !selectedClassId) {
      alert('Please select a specific class before logging attendance.');
      return;
    }

    setSaving(true);
    try {
      const docId = `${selectedDate}_${selectedClassId}`;
      const attendanceDocRef = doc(db, 'churches', selectedChurchId, 'attendance', docId);
      await setDoc(attendanceDocRef, {
        date: selectedDate,
        classId: selectedClassId,
        records: attendanceMap,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save attendance:', err);
    } finally {
      setSaving(false);
    }
  };

  // Metrics
  const presentCount = Object.values(attendanceMap).filter((r) => r.status === 'present').length;
  const absentCount = Object.values(attendanceMap).filter((r) => r.status === 'absent').length;
  const excusedCount = Object.values(attendanceMap).filter((r) => r.status === 'excused').length;
  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'All Classes';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('attendance')}</span>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
              {activeClassName}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Record and review student attendance checklists
          </p>
        </div>

        {/* Date Selector & Save Button */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-2xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            onClick={handleSaveAttendance}
            disabled={saving || !selectedClassId}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition shadow-md shadow-teal-600/30 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? translate('saving') : savedSuccess ? 'Saved!' : translate('save')}</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs text-center">
        <div className="p-2">
          <p className="text-[11px] font-bold text-zinc-400 uppercase">Roster</p>
          <p className="text-xl sm:text-2xl font-extrabold text-zinc-800 dark:text-zinc-200">{kids.length}</p>
        </div>
        <div className="p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{translate('present')}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{presentCount}</p>
        </div>
        <div className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">{translate('absent')}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400">{absentCount}</p>
        </div>
        <div className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">{translate('excused')}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400">{excusedCount}</p>
        </div>
      </div>

      {/* Warning if no specific class is chosen */}
      {!selectedClassId && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          Tip: Select a specific <strong>Class</strong> from the top bar to record and persist attendance for that classroom.
        </div>
      )}

      {/* Roster Checklist */}
      <div className="space-y-2">
        {kids.map((kid) => {
          const currentStatus = attendanceMap[kid.id]?.status;

          return (
            <div
              key={kid.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  kid.info.gender === 'female' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60'
                }`}>
                  {kid.info.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {kid.info.fullName}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : 'Student'}
                  </p>
                </div>
              </div>

              {/* 3-State Touch Control Bar */}
              <div className="grid grid-cols-3 gap-1.5 sm:w-80">
                {/* Present */}
                <button
                  type="button"
                  onClick={() => setKidStatus(kid.id, 'present')}
                  className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
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
                  onClick={() => setKidStatus(kid.id, 'absent')}
                  className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
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
                  onClick={() => setKidStatus(kid.id, 'excused')}
                  className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                    currentStatus === 'excused'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{translate('excused')}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
