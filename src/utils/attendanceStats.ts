import * as XLSX from 'xlsx';
import type { Kid, AttendanceEvent, GroupEventType } from '../types';
import { sanitizeExcelCell } from './formatters';

export interface StudentStatsSummary {
  kid: Kid;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  unrecordedCount: number;
  attendanceRate: number; // 0 - 100
  lastAttendedDate?: string;
}

export interface AttendanceAnalytics {
  totalRoster: number;
  totalScheduledSessions: number;
  conductedSessions: number;
  averageRate: number; // 0 - 100
  bestSession?: {
    id: string;
    title: string;
    eventDate: string;
    type: string;
    rate: number;
    presentCount: number;
  };
  weeklyTrend: Array<{
    eventId: string;
    eventDate: string;
    title: string;
    type: string;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    unrecordedCount: number;
    rate: number;
  }>;
  typeComparison: Array<{
    type: string;
    sessionCount: number;
    averageRate: number;
  }>;
  faithfulKids: StudentStatsSummary[]; // >= 80%
  irregularKids: StudentStatsSummary[]; // 50% - 79%
  atRiskKids: StudentStatsSummary[]; // < 50%
  topAttendees: StudentStatsSummary[];
  lowestAttendees: StudentStatsSummary[];
}

/**
 * Computes high-level and granular attendance analytics for a class.
 */
export function computeAttendanceAnalytics(
  events: AttendanceEvent[],
  kids: Kid[],
  groupEventTypes: GroupEventType[] = []
): AttendanceAnalytics {
  const totalRoster = kids.length;
  const sortedEvents = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const conductedEvents = sortedEvents.filter(
    (e) => e.takenAt || Object.keys(e.statuses || {}).length > 0
  );

  const conductedSessionsCount = conductedEvents.length;

  // 1. Per-Student Breakdown
  const studentSummaries: StudentStatsSummary[] = kids.map((kid) => {
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let lastAttendedDate: string | undefined = undefined;

    conductedEvents.forEach((evt) => {
      const status = evt.statuses?.[kid.id];
      if (status === 'present') {
        presentCount++;
        lastAttendedDate = evt.eventDate;
      } else if (status === 'absent') {
        absentCount++;
      } else if (status === 'excused') {
        excusedCount++;
      }
    });

    const recordedCount = presentCount + absentCount + excusedCount;
    const unrecordedCount = Math.max(0, conductedSessionsCount - recordedCount);
    const attendanceRate = conductedSessionsCount > 0
      ? Math.round((presentCount / conductedSessionsCount) * 100)
      : 0;

    return {
      kid,
      presentCount,
      absentCount,
      excusedCount,
      unrecordedCount,
      attendanceRate,
      lastAttendedDate,
    };
  });

  // 2. Average Term Rate
  let totalPresentSum = 0;
  studentSummaries.forEach((s) => {
    totalPresentSum += s.presentCount;
  });

  const totalPossiblePresences = totalRoster * conductedSessionsCount;
  const averageRate = totalPossiblePresences > 0
    ? Math.round((totalPresentSum / totalPossiblePresences) * 100)
    : 0;

  // 3. Weekly Trend & Best Session
  let bestSession: AttendanceAnalytics['bestSession'] = undefined;
  let highestRate = -1;

  const weeklyTrend = conductedEvents.map((evt) => {
    const presentCount = Object.values(evt.statuses || {}).filter((s) => s === 'present').length;
    const absentCount = Object.values(evt.statuses || {}).filter((s) => s === 'absent').length;
    const excusedCount = Object.values(evt.statuses || {}).filter((s) => s === 'excused').length;
    const recorded = presentCount + absentCount + excusedCount;
    const unrecordedCount = Math.max(0, totalRoster - recorded);
    const rate = totalRoster > 0 ? Math.round((presentCount / totalRoster) * 100) : 0;

    if (rate > highestRate) {
      highestRate = rate;
      bestSession = {
        id: evt.id,
        title: evt.title,
        eventDate: evt.eventDate,
        type: evt.type,
        rate,
        presentCount,
      };
    }

    return {
      eventId: evt.id,
      eventDate: evt.eventDate,
      title: evt.title,
      type: evt.type,
      presentCount,
      absentCount,
      excusedCount,
      unrecordedCount,
      rate,
    };
  });

  // 4. Type Comparison
  const typesToScan = groupEventTypes.length > 0
    ? groupEventTypes.map((t) => t.name)
    : Array.from(new Set(conductedEvents.map((e) => e.type)));

  const typeComparison = typesToScan.map((tName) => {
    const matchingEvts = conductedEvents.filter((e) => e.type === tName);
    let pSum = 0;
    matchingEvts.forEach((e) => {
      pSum += Object.values(e.statuses || {}).filter((s) => s === 'present').length;
    });
    const possible = matchingEvts.length * totalRoster;
    const rate = possible > 0 ? Math.round((pSum / possible) * 100) : 0;

    return {
      type: tName,
      sessionCount: matchingEvts.length,
      averageRate: rate,
    };
  }).filter((tc) => tc.sessionCount > 0);

  // 5. Pastoral Distribution Brackets
  const faithfulKids = studentSummaries.filter((s) => s.attendanceRate >= 80);
  const irregularKids = studentSummaries.filter((s) => s.attendanceRate >= 50 && s.attendanceRate < 80);
  const atRiskKids = studentSummaries.filter((s) => s.attendanceRate < 50);

  // 6. Rankings
  const topAttendees = [...studentSummaries].sort((a, b) => b.presentCount - a.presentCount);
  const lowestAttendees = [...studentSummaries].sort((a, b) => a.attendanceRate - b.attendanceRate);

  return {
    totalRoster,
    totalScheduledSessions: sortedEvents.length,
    conductedSessions: conductedSessionsCount,
    averageRate,
    bestSession,
    weeklyTrend,
    typeComparison,
    faithfulKids,
    irregularKids,
    atRiskKids,
    topAttendees,
    lowestAttendees,
  };
}

/**
 * Generates and downloads a multi-sheet Excel report for church leadership.
 */
export function exportAttendanceReportExcel(
  churchName: string,
  className: string,
  academicYear: string,
  events: AttendanceEvent[],
  kids: Kid[],
  stats: AttendanceAnalytics
) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Executive Summary ---
  const summaryData = [
    ['Oikonomos Sunday School CRM - Attendance Report'],
    ['Church:', churchName],
    ['Class:', className],
    ['Academic Term:', academicYear],
    ['Generated Date:', new Date().toLocaleDateString()],
    [''],
    ['--- Executive Metrics ---'],
    ['Enrolled Students:', stats.totalRoster],
    ['Total Scheduled Sessions:', stats.totalScheduledSessions],
    ['Conducted Sessions:', stats.conductedSessions],
    ['Average Attendance Rate:', `${stats.averageRate}%`],
    ['Best Attended Session:', stats.bestSession ? `${stats.bestSession.title} (${stats.bestSession.eventDate}) - ${stats.bestSession.rate}%` : 'N/A'],
    [''],
    ['--- Pastoral Care Distribution ---'],
    ['Faithful (80%-100%):', stats.faithfulKids.length],
    ['Irregular (50%-79%):', stats.irregularKids.length],
    ['At-Risk (<50%):', stats.atRiskKids.length],
    [''],
    ['--- Ministry Type Breakdown ---'],
    ['Event Type', 'Sessions Conducted', 'Average Attendance Rate'],
    ...stats.typeComparison.map((tc) => [tc.type, tc.sessionCount, `${tc.averageRate}%`]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // --- Sheet 2: Complete Attendance Matrix & Student Summary ---
  const conductedEvents = [...events]
    .filter((e) => e.takenAt || Object.keys(e.statuses || {}).length > 0)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const headers = [
    'Student Name',
    'Father Name',
    'Father Mobile',
    ...conductedEvents.map((e) => `${e.eventDate} (${e.type})`),
    'Present Total',
    'Absent Total',
    'Excused Total',
    'Attendance %',
  ];

  const rows = kids.map((kid) => {
    let p = 0;
    let a = 0;
    let exc = 0;

    const sessionValues = conductedEvents.map((evt) => {
      const st = evt.statuses?.[kid.id];
      if (st === 'present') {
        p++;
        return 'P';
      }
      if (st === 'absent') {
        a++;
        return 'A';
      }
      if (st === 'excused') {
        exc++;
        return 'E';
      }
      return '-';
    });

    const rate = conductedEvents.length > 0 ? Math.round((p / conductedEvents.length) * 100) : 0;

    return [
      sanitizeExcelCell(kid.info?.fullName || ''),
      sanitizeExcelCell(kid.contacts?.fatherName || ''),
      sanitizeExcelCell(kid.contacts?.fatherMob || kid.contacts?.kidMob || ''),
      ...sessionValues,
      p,
      a,
      exc,
      `${rate}%`,
    ];
  });

  const matrixSheetData = [headers, ...rows];
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixSheetData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Attendance Register');

  // File download
  const cleanChurch = churchName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const cleanClass = className.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const fileName = `${cleanChurch}_${cleanClass}_Attendance_Report.xlsx`;

  XLSX.writeFile(wb, fileName);
}
