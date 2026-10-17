export type UserRole = 'owner' | 'Admin' | 'viewer';

export interface Church {
  id: string;
  displayName: string;
  active: boolean;
  activeAcademicYearId?: string;
  grades?: Record<string, { name: string; serviceGroupId: string }>;
}

export interface AcademicYear {
  id: string;
  displayName: string;
  active: boolean;
  startDate?: string;
}

export interface ServiceGroup {
  id: string;
  displayName: string;
  active: boolean;
  admins: string[]; // list of emails
  servants: string[]; // list of emails
}

export interface ClassDoc {
  id: string;
  serviceGroupId: string;
  gradeLevelId?: string;
  active: boolean;
  academicYears: Record<string, {
    name: string;
    kids: string[];
    servants: string[];
  }>;
}

export interface KidContacts {
  kidMob?: string;
  fatherName?: string;
  fatherProfession?: string;
  fatherMob?: string;
  motherName?: string;
  motherProfession?: string;
  motherMob?: string;
  otherMob?: string;
}

export interface KidAddress {
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  region?: string;
}

export interface KidInfo {
  fullName: string;
  gender: 'male' | 'female';
  dob?: string;
  school?: string;
  fatherOfConfession?: string;
}

export interface Kid {
  id: string;
  active: boolean;
  info: KidInfo;
  address?: KidAddress;
  contacts?: KidContacts;
  notes?: string;
  // Dynamic current assignments
  academicYearId?: string;
  serviceGroupId?: string;
  classId?: string;
}

export interface Mister {
  id: string; // usually email
  email: string;
  displayName: string;
  active: boolean;
  churchRole: 'admin' | 'viewer';
  personalInfo?: {
    phone?: string;
    dob?: string;
    job?: string;
    address?: string;
    notes?: string;
    gender?: 'male' | 'female';
  };
  adminInGroups?: string[];
  servantInGroups?: string[];
  servantInClasses?: string[];
}

export type AttendanceStatus = 'present' | 'absent' | 'excused';

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
}
