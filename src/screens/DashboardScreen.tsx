import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDocs 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { ActiveTab } from '../components/layout/MainShell';
import type { Kid, AttendanceEvent, HomeVisit, Mister } from '../types';
import { 
  Baby, 
  Users, 
  GraduationCap, 
  CheckCircle, 
  XCircle, 
  Clock,
  Cake,
  AlertTriangle,
  MessageSquare,
  Phone,
  Sparkles,
  ArrowRight,
  Sun,
  Sunrise,
  Sunset
} from 'lucide-react';

interface DashboardScreenProps {
  onNavigate: (tab: ActiveTab) => void;
}

interface BirthdayStudent {
  kid: Kid;
  isToday: boolean;
  turningAge?: number;
  formattedDate: string;
  className: string;
}

interface UrgentStudent {
  kid: Kid;
  className: string;
  reasons: string[];
  phone?: string;
}

interface SessionReadiness {
  classId: string;
  className: string;
  event: AttendanceEvent;
  isToday: boolean;
  isUnrecordedPast: boolean;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { user, userRole } = useAuth();
  const { translate, language } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    classes, 
    userAssignedClassIds, 
    setClass 
  } = useFilter();

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  // State
  const [kids, setKids] = useState<Kid[]>([]);
  const [misters, setMisters] = useState<Mister[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Time of day greeting
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return { key: 'good_morning', icon: Sunrise, color: 'text-amber-500' };
    }
    if (hour < 17) {
      return { key: 'good_afternoon', icon: Sun, color: 'text-yellow-500' };
    }
    return { key: 'good_evening', icon: Sunset, color: 'text-indigo-400' };
  }, []);

  // 1. Listen to Servants (including pending join requests for admins)
  useEffect(() => {
    if (!selectedChurchId) {
      setMisters([]);
      setPendingRequests([]);
      return;
    }

    const mistersRef = collection(db, 'churches', selectedChurchId, 'misters');
    const unsub = onSnapshot(mistersRef, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mister));
      setMisters(all.filter((m) => m.active !== false));
      setPendingRequests(all.filter((m) => m.active === false));
    });

    return () => unsub();
  }, [selectedChurchId]);

  // 2. Fetch Kids in scope
  useEffect(() => {
    if (!selectedChurchId) {
      setKids([]);
      return;
    }

    const baseKidsRef = collection(db, 'churches', selectedChurchId, 'kids');

    // If admin: query all church kids; if servant: query assigned classes
    const kidsQuery = isAdmin
      ? baseKidsRef
      : (userAssignedClassIds && userAssignedClassIds.length > 0
          ? query(baseKidsRef, where('activeAssignment.classId', 'in', userAssignedClassIds.slice(0, 30)))
          : null);

    if (!kidsQuery) {
      setKids([]);
      return;
    }

    const unsub = onSnapshot(kidsQuery, (snap) => {
      const items: Kid[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((k) => k.active !== false);
      setKids(items);
    }, (err) => {
      console.warn('Dashboard kids query error:', err);
      setKids([]);
    });

    return () => unsub();
  }, [selectedChurchId, isAdmin, userAssignedClassIds]);

  // 3. Fetch Events & Visits for accessible classes
  useEffect(() => {
    if (!selectedChurchId || !selectedAcademicYearId || classes.length === 0) {
      setEvents([]);
      setVisits([]);
      return;
    }

    let active = true;

    const loadData = async () => {
      try {
        const eventsPromises = classes.map(async (cls) => {
          const eventsQ = query(
            collection(
              db,
              'churches',
              selectedChurchId,
              'academicYears',
              selectedAcademicYearId,
              'classes',
              cls.id,
              'attendanceEvents'
            )
          );
          const snap = await getDocs(eventsQ);
          return snap.docs.map((d) => ({ id: d.id, classId: cls.id, ...d.data() } as AttendanceEvent));
        });

        const visitsPromises = classes.map(async (cls) => {
          const visitsQ = query(
            collection(
              db,
              'churches',
              selectedChurchId,
              'academicYears',
              selectedAcademicYearId,
              'classes',
              cls.id,
              'visits'
            )
          );
          const snap = await getDocs(visitsQ);
          return snap.docs.map((d) => ({ id: d.id, classId: cls.id, ...d.data() } as HomeVisit));
        });

        const [allEventsNested, allVisitsNested] = await Promise.all([
          Promise.all(eventsPromises),
          Promise.all(visitsPromises),
        ]);

        if (active) {
          setEvents(allEventsNested.flat());
          setVisits(allVisitsNested.flat());
        }
      } catch (err) {
        console.warn('Error loading dashboard events & visits:', err);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [selectedChurchId, selectedAcademicYearId, classes]);

  // 4. Calculate Birthdays This Week (Next 7 Days)
  const birthdaysThisWeek = useMemo<BirthdayStudent[]>(() => {
    if (kids.length === 0) return [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfWeek = startOfToday + (7 * 24 * 60 * 60 * 1000);
    const thisYear = now.getFullYear();

    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const list: BirthdayStudent[] = [];

    kids.forEach((kid) => {
      const dob = kid.info?.dob;
      if (!dob) return;

      const parts = dob.split(/[-/]/);
      if (parts.length < 2) return;

      let birthYear: number | undefined;
      let month: number;
      let day: number;

      if (parts.length === 3) {
        birthYear = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
      }

      if (isNaN(month) || isNaN(day)) return;

      let bdayDate = new Date(thisYear, month, day);
      if (bdayDate.getTime() < startOfToday) {
        bdayDate = new Date(thisYear + 1, month, day);
      }

      const bdayMs = bdayDate.getTime();
      if (bdayMs >= startOfToday && bdayMs < endOfWeek) {
        const isToday = bdayMs === startOfToday;
        let turningAge: number | undefined;
        if (birthYear && birthYear > 1900 && birthYear < thisYear) {
          turningAge = bdayDate.getFullYear() - birthYear;
        }

        const className = classes.find((c) => c.id === kid.activeAssignment?.classId)?.displayName || '-';
        const formattedDate = language === 'ar'
          ? `${day} ${monthNamesAr[month]}`
          : `${monthNamesEn[month]} ${day}`;

        list.push({
          kid,
          isToday,
          turningAge,
          formattedDate,
          className,
        });
      }
    });

    // Sort: birthdays today first, then chronologically
    return list.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      return (a.kid.info?.fullName || '').localeCompare(b.kid.info?.fullName || '');
    });
  }, [kids, classes, language]);

  // 5. Session Readiness (Today & Last Unrecorded Session)
  const sessionReadiness = useMemo<SessionReadiness | null>(() => {
    if (events.length === 0) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // A: Is there a session scheduled for today?
    const todayEvt = events.find((e) => e.eventDate === todayStr);
    if (todayEvt) {
      const cls = classes.find((c) => c.id === todayEvt.classId);
      return {
        classId: todayEvt.classId,
        className: cls?.displayName || 'Class',
        event: todayEvt,
        isToday: true,
        isUnrecordedPast: false,
      };
    }

    // B: Is there a recent session in the last 7 days where attendance was not taken?
    const sevenDaysAgoMs = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const unrecordedPast = events
      .filter((e) => {
        const evtMs = new Date(e.eventDate).getTime();
        if (evtMs < sevenDaysAgoMs || evtMs > now.getTime()) return false;
        const recorded = Object.keys(e.statuses || {}).length;
        return recorded === 0;
      })
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];

    if (unrecordedPast) {
      const cls = classes.find((c) => c.id === unrecordedPast.classId);
      return {
        classId: unrecordedPast.classId,
        className: cls?.displayName || 'Class',
        event: unrecordedPast,
        isToday: false,
        isUnrecordedPast: true,
      };
    }

    // C: Closest upcoming session
    const upcoming = events
      .filter((e) => e.eventDate > todayStr)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];

    if (upcoming) {
      const cls = classes.find((c) => c.id === upcoming.classId);
      return {
        classId: upcoming.classId,
        className: cls?.displayName || 'Class',
        event: upcoming,
        isToday: false,
        isUnrecordedPast: false,
      };
    }

    return null;
  }, [events, classes]);

  // 6. Urgent Pastoral Care Radar
  const urgentStudents = useMemo<UrgentStudent[]>(() => {
    if (kids.length === 0) return [];
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Latest visit by kid
    const latestVisitByKid: Record<string, HomeVisit> = {};
    visits.forEach((v) => {
      if (!latestVisitByKid[v.kidId]) latestVisitByKid[v.kidId] = v;
    });

    // Core events sorted descending by date per class
    const coreEventsByClass: Record<string, AttendanceEvent[]> = {};
    events.forEach((e) => {
      if (!coreEventsByClass[e.classId]) coreEventsByClass[e.classId] = [];
      coreEventsByClass[e.classId].push(e);
    });
    Object.keys(coreEventsByClass).forEach((cId) => {
      coreEventsByClass[cId].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    });

    const list: UrgentStudent[] = [];

    kids.forEach((k) => {
      const reasons: string[] = [];
      const cId = k.activeAssignment?.classId;
      const classEvts = cId ? coreEventsByClass[cId] || [] : [];

      // Check consecutive absences in core events
      let consecutive = 0;
      for (const evt of classEvts) {
        const st = evt.statuses?.[k.id];
        if (st === 'absent') {
          consecutive++;
        } else if (st === 'present' || st === 'excused') {
          break;
        }
      }

      if (consecutive >= 2) {
        reasons.push(translate('consecutive_absences_count').replace('{count}', String(consecutive)));
      }

      // Check overdue home visit (>60 days or never)
      const lastV = latestVisitByKid[k.id];
      if (!lastV) {
        reasons.push(translate('never_visited'));
      } else {
        const diffDays = Math.floor((todayMs - new Date(lastV.visitDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 60) {
          reasons.push(translate('days_since_visit').replace('{days}', String(diffDays)));
        }
      }

      if (reasons.length > 0) {
        const className = classes.find((c) => c.id === cId)?.displayName || '-';
        const phone = k.contacts?.fatherMob || k.contacts?.motherMob || k.contacts?.kidMob;
        list.push({
          kid: k,
          className,
          reasons,
          phone,
        });
      }
    });

    return list.slice(0, 15);
  }, [kids, visits, events, classes, translate]);

  // Admin approval handlers
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

  const GreetingIcon = greetingData.icon;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner & Today's Readiness Pulse */}
      <div className="bg-gradient-to-br from-white via-zinc-50 to-teal-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-teal-950/20 p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GreetingIcon className={`w-5 h-5 ${greetingData.color}`} />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {translate(greetingData.key)}, {user?.displayName?.split(' ')[0] || 'Servant'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {userRole}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {translate('command_center')}
            </h2>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
              {translate('command_center_subtitle')}
            </p>
          </div>

          {/* Today's Readiness Hero Card */}
          {sessionReadiness && (
            <div className={`p-4 rounded-2xl border transition shadow-xs flex items-center justify-between gap-4 max-w-md w-full shrink-0 ${
              sessionReadiness.isToday
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                : sessionReadiness.isUnrecordedPast
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                  : 'bg-white/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700'
            }`}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    sessionReadiness.isToday ? 'bg-emerald-500 animate-pulse' : sessionReadiness.isUnrecordedPast ? 'bg-amber-500' : 'bg-teal-500'
                  }`} />
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    {sessionReadiness.isToday
                      ? translate('todays_session')
                      : sessionReadiness.isUnrecordedPast
                        ? translate('last_session_unrecorded')
                        : translate('upcoming_session')}
                  </span>
                </div>
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {sessionReadiness.event.title}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {sessionReadiness.className} • {sessionReadiness.event.eventDate}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setClass(sessionReadiness.classId);
                  onNavigate('attendance');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/30 transition shrink-0 cursor-pointer"
              >
                <span>{translate('start_roll_call')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Admin Pending Join Requests Queue */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Pending Servant Join Requests ({pendingRequests.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('servants')}
              className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
            >
              View in Servants Directory ➔
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-xs"
              >
                <div className="truncate me-2">
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{req.displayName || req.email}</p>
                  <p className="text-xs text-zinc-400 truncate font-mono">{req.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => approveRequest(req.id)}
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                    title="Approve Servant"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
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

      {/* 3. Two Main Command Pillars: Birthdays & Urgent Pastoral Care */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pillar 1: 🎂 Birthdays This Week (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {translate('birthdays_this_week')}
                </h3>
                <p className="text-[11px] text-zinc-400">Next 7 days celebration window</p>
              </div>
            </div>

            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
              {birthdaysThisWeek.length}
            </span>
          </div>

          {birthdaysThisWeek.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <Sparkles className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <p className="text-xs">{translate('no_birthdays_this_week')}</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pe-1">
              {birthdaysThisWeek.map((bday) => {
                const phone = bday.kid.contacts?.fatherMob || bday.kid.contacts?.motherMob || bday.kid.contacts?.kidMob;
                const greetingMsg = language === 'ar'
                  ? `سلام ونعمة، كل سنة وحبيبنا ${bday.kid.info.fullName} طيب وبخير بمناسبة عيد ميلاده! عقبال 100 سنة حلوة وجميلة في حضن الكنيسة وبابا يسوع! 🎉🎂✨`
                  : `Happy Birthday to dear ${bday.kid.info.fullName}! Wishing you a wonderful, blessed year filled with joy, peace, and God's abundant grace! 🎉🎂✨`;

                return (
                  <div
                    key={bday.kid.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                      bday.isToday
                        ? 'bg-pink-50/60 dark:bg-pink-950/30 border-pink-300 dark:border-pink-800 shadow-xs'
                        : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {bday.kid.info.photoUrl ? (
                        <img
                          src={bday.kid.info.photoUrl}
                          alt={bday.kid.info.fullName}
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {bday.kid.info.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            {bday.kid.info.fullName}
                          </p>
                          {bday.isToday && (
                            <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-pink-500 text-white animate-pulse">
                              {translate('birthday_today_badge')}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {bday.formattedDate} • {bday.className}
                          {bday.turningAge ? ` • ${translate('turning_age').replace('{age}', String(bday.turningAge))}` : ''}
                        </p>
                      </div>
                    </div>

                    {phone && (
                      <div className="flex items-center gap-1.5 shrink-0 ms-2">
                        <a
                          href={`https://wa.me/${String(phone).replace(/\+/g, '')}?text=${encodeURIComponent(greetingMsg)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-2xs"
                          title="WhatsApp Birthday Greeting"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{translate('send_birthday_wishes')}</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pillar 2: 🚨 Urgent Pastoral Care Radar (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {translate('urgent_pastoral_radar')}
                </h3>
                <p className="text-[11px] text-zinc-400">Chronic absentees & overdue home visits</p>
              </div>
            </div>

            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              {urgentStudents.length}
            </span>
          </div>

          {urgentStudents.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs">{translate('no_urgent_pastoral')}</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pe-1">
              {urgentStudents.map((item) => (
                <div
                  key={item.kid.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {item.kid.info.fullName}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {item.className}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {item.reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {item.phone && (
                    <div className="flex items-center gap-1 shrink-0 ms-2">
                      <a
                        href={`https://wa.me/${String(item.phone).replace(/\+/g, '')}?text=${encodeURIComponent(
                          `سلام ونعمة، بنفتقد جداً ${item.kid.info.fullName} في مدارس الأحد، لعله بخير ومستنينه الأسبوع الجاي بنعمة ربنا!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-2xs"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                      <a
                        href={`tel:${item.phone}`}
                        className="p-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition shadow-2xs"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Core Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total Kids */}
        <div 
          onClick={() => onNavigate('kids')}
          className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between hover:border-teal-400 transition cursor-pointer group"
        >
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {translate('total_kids')}
            </p>
            <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
              {kids.length}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">View Directory ➔</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition">
            <Baby className="w-6 h-6" />
          </div>
        </div>

        {/* 2. Active Servants */}
        <div 
          onClick={() => onNavigate('servants')}
          className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between hover:border-blue-400 transition cursor-pointer group"
        >
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {translate('active_servants')}
            </p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {misters.length}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">View Roster ➔</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* 3. Class Groups */}
        <div 
          onClick={() => onNavigate('classes')}
          className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between hover:border-violet-400 transition cursor-pointer group"
        >
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {translate('class_groups')}
            </p>
            <p className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">
              {classes.length}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">View Classrooms ➔</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-105 transition">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
