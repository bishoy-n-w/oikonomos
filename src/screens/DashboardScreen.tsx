import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { ActiveTab } from '../components/layout/MainShell';
import { 
  Baby, 
  Users, 
  GraduationCap, 
  CalendarCheck, 
  Home, 
  CheckCircle, 
  XCircle, 
  Clock 
} from 'lucide-react';

interface DashboardScreenProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId } = useFilter();

  const [kidsCount, setKidsCount] = useState(0);
  const [servantsCount, setServantsCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  // Listen to stats from Firestore
  useEffect(() => {
    if (!selectedChurchId) {
      setKidsCount(0);
      setServantsCount(0);
      setClassesCount(0);
      setPendingRequests([]);
      return;
    }

    // Kids count
    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsubKids = onSnapshot(kidsRef, (snap) => {
      setKidsCount(snap.docs.filter(d => d.data().active !== false).length);
    });

    // Servants count
    const mistersRef = collection(db, 'churches', selectedChurchId, 'misters');
    const unsubMisters = onSnapshot(mistersRef, (snap) => {
      const docs = snap.docs;
      setServantsCount(docs.filter(d => d.data().active === true).length);
      // Collect pending join requests (active == false)
      setPendingRequests(
        docs
          .filter(d => d.data().active === false)
          .map(d => ({ id: d.id, ...d.data() }))
      );
    });

    // Classes count
    const classesRef = collection(db, 'churches', selectedChurchId, 'classes');
    const unsubClasses = onSnapshot(classesRef, (snap) => {
      setClassesCount(snap.docs.filter(d => d.data().active !== false).length);
    });

    return () => {
      unsubKids();
      unsubMisters();
      unsubClasses();
    };
  }, [selectedChurchId]);

  const approveRequest = async (misterEmail: string) => {
    if (!selectedChurchId) return;
    try {
      const misterRef = doc(db, 'churches', selectedChurchId, 'misters', misterEmail);
      await updateDoc(misterRef, { active: true });
    } catch (err) {
      console.error('Failed to approve request:', err);
    }
  };

  const rejectRequest = async (misterEmail: string) => {
    if (!selectedChurchId) return;
    try {
      const misterRef = doc(db, 'churches', selectedChurchId, 'misters', misterEmail);
      await updateDoc(misterRef, { active: false, rejected: true });
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {translate('welcome')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {translate('subtitle')}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 w-fit">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span>{userRole}</span>
        </div>
      </div>

      {/* Admin Pending Join Requests Panel */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
              Pending Servant Join Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-xs"
              >
                <div className="truncate me-2">
                  <p className="font-semibold text-sm truncate">{req.displayName || req.email}</p>
                  <p className="text-xs text-zinc-400 truncate">{req.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => approveRequest(req.id)}
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                    title="Approve Servant"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Decline Servant"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Stats Grid (Responsive 1 -> 3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Total Kids */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {translate('total_kids')}
            </p>
            <p className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
              {kidsCount}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Baby className="w-7 h-7" />
          </div>
        </div>

        {/* 2. Active Servants */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {translate('active_servants')}
            </p>
            <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {servantsCount}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
        </div>

        {/* 3. Classes */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {translate('class_groups')}
            </p>
            <p className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 mt-1">
              {classesCount}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <GraduationCap className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Quick Task Shortcuts */}
      <div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          {translate('quick_tasks')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Take Attendance */}
          <button
            onClick={() => onNavigate('attendance')}
            className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-teal-500 hover:shadow-md transition text-start group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                {translate('take_attendance')}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {translate('log_attendance_desc')}
              </p>
            </div>
          </button>

          {/* Log Home Visit */}
          <button
            onClick={() => onNavigate('home_visits')}
            className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 hover:shadow-md transition text-start group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {translate('log_visit')}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {translate('log_visit_desc')}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
