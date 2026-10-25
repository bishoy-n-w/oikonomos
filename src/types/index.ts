export type UserRole = 'owner' | 'Admin' | 'viewer';

export interface GradeItem {
  name: string;
  serviceGroupId: string;
}

export const DEFAULT_EVENT_TYPES = [
  'Sunday School',
  'Liturgy',
  'Bible Study',
  'Hymns',
  'Conference',
  'Trip',
  'Activity',
  'Other',
] as const;

export interface GroupEventType {
  id: string;
  name: string;
  isCore: boolean; // Core events count towards pastoral care consecutive absence alerts
}

export interface Church {
  id: string;
  displayName: string;
  active: boolean;
  activeAcademicYearId?: string;
  grades?: Record<string, GradeItem>; // e.g. { "1": { name: "Grade 1", serviceGroupId: "..." } }
  defaultEventTypes?: string[]; // Configurable church-wide initial template for newly created groups
  createdAt?: string;
  createdBy?: string;
}

export interface AcademicYear {
  id: string;
  displayName: string;
  active: boolean;
  startDate?: string; // YYYY-MM
  createdAt?: string;
  createdBy?: string;
}

export interface ServiceGroup {
  id: string;
  displayName: string;
  active: boolean;
  misters?: Record<string, 'admin' | 'servant'>; // email -> 'admin' | 'servant'
  admins?: string[]; // compatibility helper
  servants?: string[]; // compatibility helper
  eventTypes?: GroupEventType[]; // Custom event types for this group
  createdAt?: string;
  createdBy?: string;
}

export interface ClassYearData {
  displayName: string;
  name?: string; // fallback helper
  serviceGroupId: string;
  gradeId?: string;
  KidIds?: string[];
  kids?: string[]; // fallback helper
  MistersIds?: string[];
  servants?: string[]; // fallback helper
}

export interface ClassDoc {
  id: string;
  active: boolean;
  serviceGroupId?: string; // default group
  academicYears: Record<string, ClassYearData>;
  createdAt?: string;
  createdBy?: string;
}

export interface KidContacts {
  kidMob?: string;
  fatherName?: string;
  fatherProfession?: string;
  fatherMob?: string;
  fatherDOB?: string;
  motherName?: string;
  motherProfession?: string;
  motherMob?: string;
  motherDOB?: string;
  otherMob?: string;
}

export interface KidAddress {
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  region?: string;
  landmark?: string;
}

export interface KidInfo {
  fullName: string;
  gender: 'male' | 'female';
  dob?: string;
  school?: string;
  schoolType?: 'National' | 'International' | string;
  deacon?: boolean;
  fatherOfConfession?: string;
}

export interface KidActiveAssignment {
  academicYearId?: string;
  serviceGroupId?: string;
  classId?: string;
}

export interface KidVersion {
  changes: Record<string, any>;
  editAt: string;
  editBy: string;
}

export interface Kid {
  id: string;
  active: boolean;
  activeAssignment?: KidActiveAssignment;
  info: KidInfo;
  address?: KidAddress;
  contacts?: KidContacts;
  notes?: string;
  versions?: Record<string, KidVersion>;
  createdAt?: string;
  createdBy?: string;
  lastEditAt?: string;
  lastEditBy?: string;
  // Flattened helpers for backward compatibility
  academicYearId?: string;
  serviceGroupId?: string;
  classId?: string;
}

export interface MisterPersonalInfo {
  phone?: string;
  gender?: 'male' | 'female';
  dob?: string;
  job?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
  lastEditAt?: string;
  lastEditBy?: string;
}

export interface Mister {
  id: string; // usually email
  authUid?: string;
  email: string;
  displayName: string;
  active: boolean;
  churchRole: 'admin' | 'viewer';
  personalInfo?: MisterPersonalInfo;
  adminInGroups?: string[];
  servantInGroups?: string[];
  servantInClasses?: string[];
  createdAt?: string;
  createdBy?: string;
  lastEditAt?: string;
  lastEditBy?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type AttendanceEventType = string;

export interface AttendanceEvent {
  id: string; // eventId
  academicYearId: string;
  serviceGroupId?: string;
  classId: string;
  title: string;
  type: AttendanceEventType;
  eventDate: string; // YYYY-MM-DD
  takenAt?: string; // ISO string
  takenBy?: string; // email / displayName
  statuses: Record<string, AttendanceStatus>; // { [kidId]: 'present' | 'absent' | 'excused' }
  notesByKid: Record<string, string>; // { [kidId]: 'note text' }
  recurringSeriesId?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  records: Record<string, {
    status: AttendanceStatus;
    notes?: string;
  }>;
}

export interface DropdownItem {
  id: string;
  displayName: string;
  data?: any;
  isActiveYear?: boolean;
}
