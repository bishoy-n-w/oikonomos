import type { AttendanceEvent, Kid } from '../types';

export interface ConsecutiveAbsenceAlert {
  kid: Kid;
  consecutiveCount: number;
  lastPresentDate?: string;
  fatherPhone?: string;
  motherPhone?: string;
}

/**
 * Evaluates chronological attendance events to find students who missed 2 or more consecutive sessions.
 * Optionally restricts evaluation to core event types (e.g. Sunday School, Liturgy),
 * ignoring voluntary trips or social activities.
 */
export function computeConsecutiveAbsences(
  events: AttendanceEvent[],
  kids: Kid[],
  coreEventTypes?: string[]
): ConsecutiveAbsenceAlert[] {
  if (events.length < 2 || kids.length === 0) return [];

  const isCoreEvent = (evt: AttendanceEvent) => {
    if (coreEventTypes && coreEventTypes.length > 0) {
      return coreEventTypes.includes(evt.type);
    }
    const tLower = (evt.type || '').toLowerCase();
    return tLower !== 'trip' && tLower !== 'activity';
  };

  // Sort events chronologically (oldest to newest)
  const recordedEvents = [...events]
    .filter((e) => isCoreEvent(e) && (e.takenAt || Object.keys(e.statuses || {}).length > 0))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  if (recordedEvents.length < 2) return [];

  const alerts: ConsecutiveAbsenceAlert[] = [];

  kids.forEach((kid) => {
    let consecutiveCount = 0;
    let lastPresentDate: string | undefined = undefined;

    // Scan backward from the most recent recorded session
    for (let i = recordedEvents.length - 1; i >= 0; i--) {
      const evt = recordedEvents[i];
      const status = evt.statuses?.[kid.id];

      if (status === 'absent') {
        consecutiveCount++;
      } else if (status === 'present') {
        lastPresentDate = evt.eventDate;
        break; // consecutive streak ended
      } else if (status === 'excused') {
        // Excused does not break streak
        continue;
      } else {
        // Unrecorded does not count
        continue;
      }
    }

    if (consecutiveCount >= 2) {
      alerts.push({
        kid,
        consecutiveCount,
        lastPresentDate,
        fatherPhone: kid.contacts?.fatherMob || kid.contacts?.kidMob,
        motherPhone: kid.contacts?.motherMob,
      });
    }
  });

  // Sort by highest consecutive absences first
  return alerts.sort((a, b) => b.consecutiveCount - a.consecutiveCount);
}

/**
 * Builds a direct WhatsApp link with pre-filled pastoral care message in Arabic or English.
 */
export function buildPastoralWhatsAppUrl(
  phone: string,
  kidName: string,
  parentName: string = '',
  isArabic: boolean = true
): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';

  const parentGreeting = parentName ? (isArabic ? `أستاذ ${parentName}` : `Mr. ${parentName}`) : (isArabic ? 'ولي الأمر العزيز' : 'Dear Parent');
  const message = isArabic
    ? `سلام ونعمة يا ${parentGreeting}، بنفتقد جداً ${kidName} في مدارس الأحد، لعله بخير وبنصلي تكون كل أموره طيبة ومستنينه الأسبوع الجاي بنعمة ربنا!`
    : `Peace and grace, ${parentGreeting}! We really missed ${kidName} in Sunday School. Hope all is well and looking forward to seeing him next week!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
