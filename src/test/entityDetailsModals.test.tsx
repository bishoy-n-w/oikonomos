import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import { KidDetailsModal } from '../components/kids/KidDetailsModal';
import { ClassDetailsModal } from '../components/classes/ClassDetailsModal';
import { ServiceGroupDetailsModal } from '../components/groups/ServiceGroupDetailsModal';
import { ServantDetailsModal } from '../components/servants/ServantDetailsModal';
import { ChurchDetailsModal } from '../components/churches/ChurchDetailsModal';
import { PhoneActionGroup } from '../components/common/PhoneActionGroup';
import { CopyableField } from '../components/common/CopyableField';
import { PhotoLightboxModal } from '../components/common/PhotoLightboxModal';
import { ContactPickerPopover } from '../components/common/ContactPickerPopover';
import { useModalHistory } from '../utils/useModalHistory';
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

      const badgeBtn = screen.getByRole('button', { name: /ID/i });
      expect(badgeBtn).toBeTruthy();
      fireEvent.click(badgeBtn);
      expect(handlePrint).toHaveBeenCalledTimes(1);
    });

    it('renders the sleek quick action bar with Call, WhatsApp, and ID Card', () => {
      render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={false}
            onClose={vi.fn()}
            onPrintBadge={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByRole('button', { name: /Call/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /ID/i })).toBeTruthy();
    });

    it('opens PhotoLightboxModal when the header photo avatar is clicked', () => {
      render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const avatar = screen.getByTitle(/Tap to view photo/i);
      expect(avatar).toBeTruthy();
      fireEvent.click(avatar);

      expect(screen.getByRole('dialog', { name: /Photo of Bishoy Fakhry/i })).toBeTruthy();
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

    it('safely handles servants with undefined or missing email without throwing errors', () => {
      const incompleteMister = {
        id: 'servant-no-email',
        displayName: 'Peter No Email',
        active: true,
        churchRole: 'servant' as const,
      } as unknown as Mister;

      expect(() => {
        render(
          <AppProvider>
            <ClassDetailsModal
              classDoc={{
                ...mockClassDoc,
                academicYears: {
                  'ay-2026': {
                    name: '5th Primary',
                    displayName: '5th Primary',
                    gradeId: '5',
                    serviceGroupId: 'grp-primary',
                    MistersIds: ['servant-no-email'],
                  },
                },
              }}
              activeAcademicYearId="ay-2026"
              allKids={[mockKid]}
              allMisters={[incompleteMister]}
              serviceGroups={[mockGroup]}
              canEdit={false}
              onClose={vi.fn()}
            />
          </AppProvider>
        );
      }).not.toThrow();
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

    it('opens PhotoLightboxModal when the servant photo avatar is clicked', () => {
      render(
        <AppProvider>
          <ServantDetailsModal
            mister={mockMister}
            canEdit={false}
            onClose={vi.fn()}
          />
        </AppProvider>
      );

      const avatar = screen.getByTitle(/Tap to view photo/i);
      expect(avatar).toBeTruthy();
      fireEvent.click(avatar);

      expect(screen.getByRole('dialog', { name: /Photo of Peter Samir/i })).toBeTruthy();
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

  describe('Universal Communications (PhoneActionGroup)', () => {
    it('renders phone number, call link, whatsapp link, and copy button', () => {
      render(
        <PhoneActionGroup
          phone="+201234567890"
          label="Father Mobile"
          personName="Fakhry"
        />
      );

      expect(screen.getByText('+201234567890')).toBeTruthy();
      const callLink = screen.getByRole('link', { name: /Call/i });
      expect(callLink.getAttribute('href')).toBe('tel:+201234567890');

      const waLink = screen.getByRole('link', { name: /WhatsApp/i });
      expect(waLink.getAttribute('href')).toContain('https://wa.me/201234567890');

      const copyBtn = screen.getByRole('button', { name: /Copy/i });
      expect(copyBtn).toBeTruthy();
    });

    it('copies phone number to clipboard when Copy button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <PhoneActionGroup
          phone="+201098765432"
          label="Mother"
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Copy/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith('+201098765432');
    });
  });

  describe('Universal 1-Tap Copy (CopyableField)', () => {
    it('renders label, value, and copies to clipboard on click', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <CopyableField
          label="Address"
          value="15 Baghdad Street, Cairo"
        />
      );

      expect(screen.getByText('Address')).toBeTruthy();
      expect(screen.getByText('15 Baghdad Street, Cairo')).toBeTruthy();

      const copyBtn = screen.getByRole('button', { name: /Copy Address/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith('15 Baghdad Street, Cairo');
    });
  });

  describe('Device Back Button Dismissal (useModalHistory)', () => {
    it('pushes history state on mount and triggers onClose on popstate', () => {
      const handleClose = vi.fn();
      const pushStateSpy = vi.spyOn(window.history, 'pushState');

      const { unmount } = renderHook(() =>
        useModalHistory('test-modal', true, handleClose)
      );

      expect(pushStateSpy).toHaveBeenCalledWith({ modalId: 'test-modal' }, '');

      // Simulate device back button (popstate event)
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(handleClose).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('Cross-Entity Drill-Down Navigation', () => {
    it('triggers onSelectKid when an enrolled student is clicked in ClassDetailsModal', () => {
      const handleSelectKid = vi.fn();
      render(
        <AppProvider>
          <ClassDetailsModal
            classDoc={mockClassDoc}
            activeAcademicYearId="ay-2026"
            allKids={[mockKid]}
            allMisters={[mockMister]}
            serviceGroups={[mockGroup]}
            onClose={vi.fn()}
            onSelectKid={handleSelectKid}
          />
        </AppProvider>
      );

      const studentNameBtn = screen.getByText('Bishoy Fakhry');
      fireEvent.click(studentNameBtn);

      expect(handleSelectKid).toHaveBeenCalledWith(mockKid);
    });

    it('triggers onSelectServant when an assigned servant is clicked in ClassDetailsModal', () => {
      const handleSelectServant = vi.fn();
      render(
        <AppProvider>
          <ClassDetailsModal
            classDoc={mockClassDoc}
            activeAcademicYearId="ay-2026"
            allKids={[mockKid]}
            allMisters={[mockMister]}
            serviceGroups={[mockGroup]}
            onClose={vi.fn()}
            onSelectServant={handleSelectServant}
          />
        </AppProvider>
      );

      // Switch to servants tab
      fireEvent.click(screen.getByText(/Servants/i));

      const servantNameBtn = screen.getByText('Peter Samir');
      fireEvent.click(servantNameBtn);

      expect(handleSelectServant).toHaveBeenCalledWith(mockMister);
    });

    it('renders Back button in KidDetailsModal when onBack is provided', () => {
      const handleBack = vi.fn();
      render(
        <AppProvider>
          <KidDetailsModal
            kid={mockKid}
            onClose={vi.fn()}
            onBack={handleBack}
            backLabel="5th Primary"
          />
        </AppProvider>
      );

      const backBtn = screen.getByRole('button', { name: /Back to 5th Primary/i });
      expect(backBtn).toBeTruthy();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Photo Lightbox Modal (PhotoLightboxModal)', () => {
    it('renders centered photo viewer with name and deacon badge', () => {
      render(
        <PhotoLightboxModal
          photoUrl="https://example.com/photo.jpg"
          name="Bishoy Fakhry"
          isDeacon={true}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Bishoy Fakhry')).toBeTruthy();
      expect(screen.getByText('Deacon')).toBeTruthy();
      expect(screen.getByRole('img', { name: /Bishoy Fakhry/i })).toBeTruthy();
    });

    it('dismisses when close button or backdrop is clicked', () => {
      const handleClose = vi.fn();
      render(
        <PhotoLightboxModal
          name="Bishoy Fakhry"
          isOpen={true}
          onClose={handleClose}
        />
      );

      const closeBtn = screen.getByRole('button', { name: /Close photo/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contact Picker Popover (ContactPickerPopover)', () => {
    const mockContacts = [
      { role: 'father' as const, label: 'Father', name: 'Fakhry', phone: '+201234567890' },
      { role: 'mother' as const, label: 'Mother', name: 'Mary', phone: '+201098765432' },
    ];

    it('renders list of contacts with relationships for calling', () => {
      render(
        <ContactPickerPopover
          personName="Bishoy"
          actionType="call"
          contacts={mockContacts}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Call Bishoy/i)).toBeTruthy();
      expect(screen.getByText('+201234567890')).toBeTruthy();
      expect(screen.getByText('+201098765432')).toBeTruthy();
      expect(screen.getByText('(Fakhry)')).toBeTruthy();
      expect(screen.getByText('(Mary)')).toBeTruthy();
    });

    it('copies selected phone number to clipboard when actionType is copy', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <ContactPickerPopover
          personName="Bishoy"
          actionType="copy"
          contacts={mockContacts}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const fatherOption = screen.getByText('+201234567890');
      fireEvent.click(fatherOption);

      expect(writeTextMock).toHaveBeenCalledWith('+201234567890');
    });
  });
});
