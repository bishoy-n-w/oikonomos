import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import { KidDetailsModal } from '../components/kids/KidDetailsModal';
import { ClassDetailsModal } from '../components/classes/ClassDetailsModal';
import { ServiceGroupDetailsModal } from '../components/groups/ServiceGroupDetailsModal';
import { ServantDetailsModal } from '../components/servants/ServantDetailsModal';
import { ChurchDetailsModal } from '../components/churches/ChurchDetailsModal';
import type { Kid, ClassDoc, ServiceGroup, Mister, Church } from '../types';

describe('Read-Only Entity Details Modals & Role-Gated Transitions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockKid: Kid = {
    id: 'kid-123',
    active: true,
    info: {
      fullName: 'Bishoy Fakhry',
      gender: 'male',
      dob: '2015-05-10',
      school: 'St. Mark College',
      schoolType: 'National',
      deacon: true,
      fatherOfConfession: 'Fr. Daoud Lamei',
    },
    contacts: {
      fatherName: 'Fakhry Aziz',
      fatherProfession: 'Architect',
      fatherMob: '+201234567890',
      motherName: 'Mary George',
      motherProfession: 'Doctor',
      motherMob: '+201098765432',
      kidMob: '+201122334455',
    },
    address: {
      building: '15',
      floor: '4',
      apartment: '402',
      street: 'Baghdad Street',
      region: 'Heliopolis',
      landmark: 'Near St. George Church',
      geoLocation: 'geo:30.0890,31.3250',
    },
    notes: 'Very attentive and loves hymn chanting.',
    activeAssignment: {
      academicYearId: 'ay-2026',
      serviceGroupId: 'grp-primary',
      classId: 'cls-5a',
    },
  };

  const mockClassDoc: ClassDoc = {
    id: 'cls-5a',
    active: true,
    academicYears: {
      'ay-2026': {
        displayName: '5th Primary (St. Mary)',
        serviceGroupId: 'grp-primary',
        gradeId: '5',
        KidIds: ['kid-123'],
        MistersIds: ['mister.peter@church.org'],
      },
    },
    createdAt: '2026-01-01',
    createdBy: 'admin@church.org',
  };

  const mockGroup: ServiceGroup = {
    id: 'grp-primary',
    displayName: 'Primary Stage Ministry',
    active: true,
    admins: ['admin.mina@church.org'],
    servants: ['mister.peter@church.org'],
    eventTypes: [
      { id: 'evt-1', name: 'Sunday School', isCore: true },
      { id: 'evt-2', name: 'Bible Study', isCore: false },
    ],
  };

  const mockMister: Mister = {
    id: 'mister.peter@church.org',
    email: 'mister.peter@church.org',
    displayName: 'Peter Samir',
    active: true,
    churchRole: 'viewer',
    personalInfo: {
      phone: '+201200000001',
      job: 'Software Engineer',
      dob: '1992-03-15',
      address: 'Nasr City, Cairo',
      notes: 'Lead hymn teacher for 5th primary.',
    },
    servantInGroups: ['grp-primary'],
    assignedClasses: ['cls-5a'],
  };

  const mockChurch: Church = {
    id: 'church-st-mary',
    displayName: 'St. Mary Coptic Church',
    active: true,
    activeAcademicYearId: 'ay-2026',
    grades: {
      '5': { name: 'Grade 5 Primary', serviceGroupId: 'grp-primary' },
    },
  };

  describe('KidDetailsModal', () => {
    it('renders all student information, contact channels, and age', () => {
      render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={false}
            onClose={vi.fn()}
            classes={[{ id: 'cls-5a', displayName: '5th Primary (St. Mary)' }]}
            serviceGroups={[{ id: 'grp-primary', displayName: 'Primary Stage Ministry' }]}
          />
        </AppProvider>
      );

      expect(screen.getByText('Bishoy Fakhry')).toBeTruthy();
      expect(screen.getAllByText('Deacon').length).toBeGreaterThan(0);
      expect(screen.getByText('St. Mark College')).toBeTruthy();
      expect(screen.getByText('National')).toBeTruthy();
      expect(screen.getByText('Fakhry Aziz')).toBeTruthy();
      expect(screen.getByText('Mary George')).toBeTruthy();
      expect(screen.getByText('+201234567890')).toBeTruthy();
      expect(screen.getByText('Fr. Daoud Lamei')).toBeTruthy();
      expect(screen.getByText('Very attentive and loves hymn chanting.')).toBeTruthy();
    });

    it('renders "Edit Student" button only when canEdit is true and handles transition', () => {
      const handleEdit = vi.fn();
      const { rerender } = render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={false}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      // When canEdit is false, Edit button is NOT in the document
      expect(screen.queryByLabelText(/Edit Student/i)).toBeNull();

      // When canEdit is true, Edit button appears and triggers onEdit
      rerender(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={true}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const editBtn = screen.getByLabelText(/Edit Student/i);
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });

    it('triggers onPrintBadge when badge button is pressed', () => {
      const handlePrint = vi.fn();
      render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={false}
            onClose={vi.fn()}
            onPrintBadge={handlePrint}
          />
        </AppProvider>
      );

      const badgeBtn = screen.getByRole('button', { name: /ID Badge/i });
      fireEvent.click(badgeBtn);
      expect(handlePrint).toHaveBeenCalledTimes(1);
    });
  });

  describe('ClassDetailsModal', () => {
    it('renders class header, enrolled kids, and assigned servants', () => {
      render(
        <AppProvider>
          <ClassDetailsModal
            classDoc={mockClassDoc}
            activeAcademicYearId="ay-2026"
            allKids={[mockKid]}
            allMisters={[mockMister]}
            serviceGroups={[mockGroup]}
            currentChurch={mockChurch}
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText('5th Primary (St. Mary)')).toBeTruthy();
      expect(screen.getByText('#5')).toBeTruthy();
      expect(screen.getByText('Bishoy Fakhry')).toBeTruthy();

      // Switch to servants tab
      const servantsTab = screen.getByText(/Servants/i);
      fireEvent.click(servantsTab);
      expect(screen.getByText('Peter Samir')).toBeTruthy();
      expect(screen.getByText('mister.peter@church.org')).toBeTruthy();
    });

    it('gates "Edit Class" button strictly on canEdit permission', () => {
      const handleEdit = vi.fn();
      const { rerender } = render(
        <AppProvider>
          <ClassDetailsModal
            classDoc={mockClassDoc}
            allKids={[mockKid]}
            allMisters={[mockMister]}
            serviceGroups={[mockGroup]}
            canEdit={false}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.queryByLabelText(/Edit Class/i)).toBeNull();

      rerender(
        <AppProvider>
          <ClassDetailsModal
            classDoc={mockClassDoc}
            allKids={[mockKid]}
            allMisters={[mockMister]}
            serviceGroups={[mockGroup]}
            canEdit={true}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const editBtn = screen.getByLabelText(/Edit Class/i);
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('ServiceGroupDetailsModal', () => {
    it('renders group details, admins, and event types', () => {
      render(
        <AppProvider>
          <ServiceGroupDetailsModal
            group={mockGroup}
            allMisters={[mockMister, { ...mockMister, id: 'admin.mina@church.org', email: 'admin.mina@church.org', displayName: 'Mina Nabil' }]}
            churchGrades={mockChurch.grades}
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText('Primary Stage Ministry')).toBeTruthy();
      expect(screen.getByText('Sunday School')).toBeTruthy();
      expect(screen.getByText('Bible Study')).toBeTruthy();
    });

    it('gates "Edit Service Group" button on canEdit permission', () => {
      const handleEdit = vi.fn();
      const { rerender } = render(
        <AppProvider>
          <ServiceGroupDetailsModal
            group={mockGroup}
            allMisters={[mockMister]}
            canEdit={false}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.queryByLabelText(/Edit Service Group/i)).toBeNull();

      rerender(
        <AppProvider>
          <ServiceGroupDetailsModal
            group={mockGroup}
            allMisters={[mockMister]}
            canEdit={true}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const editBtn = screen.getByLabelText(/Edit Service Group/i);
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('ServantDetailsModal', () => {
    it('renders servant profile, ministry roles, and assignments', () => {
      render(
        <AppProvider>
          <ServantDetailsModal
            mister={mockMister}
            allGroups={[mockGroup]}
            allClasses={[mockClassDoc]}
            activeAcademicYearId="ay-2026"
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText('Peter Samir')).toBeTruthy();
      expect(screen.getByText('Software Engineer')).toBeTruthy();
      expect(screen.getByText('+201200000001')).toBeTruthy();
      expect(screen.getByText('Nasr City, Cairo')).toBeTruthy();
      expect(screen.getByText('Primary Stage Ministry')).toBeTruthy();
      expect(screen.getByText('5th Primary (St. Mary)')).toBeTruthy();
    });

    it('gates "Edit Profile" button on canEdit permission', () => {
      const handleEdit = vi.fn();
      const { rerender } = render(
        <AppProvider>
          <ServantDetailsModal
            mister={mockMister}
            canEdit={false}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.queryByLabelText(/Edit Profile/i)).toBeNull();

      rerender(
        <AppProvider>
          <ServantDetailsModal
            mister={mockMister}
            canEdit={true}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const editBtn = screen.getByLabelText(/Edit Profile/i);
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('ChurchDetailsModal', () => {
    it('renders church name, active academic year, and grades', () => {
      render(
        <AppProvider>
          <ChurchDetailsModal
            church={mockChurch}
            activeAcademicYearName="2025/2026 Academic Term"
            serviceGroups={[mockGroup]}
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText('St. Mary Coptic Church')).toBeTruthy();
      expect(screen.getByText('Grade 5 Primary')).toBeTruthy();
      expect(screen.getByText('Primary Stage Ministry')).toBeTruthy();
    });

    it('gates "Edit Church" button on canEdit permission', () => {
      const handleEdit = vi.fn();
      const { rerender } = render(
        <AppProvider>
          <ChurchDetailsModal
            church={mockChurch}
            canEdit={false}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.queryByLabelText(/Edit Church/i)).toBeNull();

      rerender(
        <AppProvider>
          <ChurchDetailsModal
            church={mockChurch}
            canEdit={true}
            onEdit={handleEdit}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const editBtn = screen.getByLabelText(/Edit Church/i);
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });
  });
});
