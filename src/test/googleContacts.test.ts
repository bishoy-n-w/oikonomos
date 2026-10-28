import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, transformKidToGooglePerson } from '../services/googleContacts';
import type { Kid } from '../types';

describe('Google Contacts Synchronization Service', () => {
  describe('normalizePhoneNumber', () => {
    it('returns empty string for null or undefined phone numbers', () => {
      expect(normalizePhoneNumber(undefined)).toBe('');
      expect(normalizePhoneNumber('')).toBe('');
    });

    it('formats Egyptian mobile numbers with leading 0 to E.164 +20', () => {
      expect(normalizePhoneNumber('01221234567', '+20')).toBe('+201221234567');
      expect(normalizePhoneNumber('01009876543', '+20')).toBe('+201009876543');
    });

    it('preserves numbers already having country prefix with +', () => {
      expect(normalizePhoneNumber('+14155552671')).toBe('+14155552671');
      expect(normalizePhoneNumber('+201221234567')).toBe('+201221234567');
    });

    it('replaces double zero 00 prefix with +', () => {
      expect(normalizePhoneNumber('00201221234567')).toBe('+201221234567');
    });

    it('strips dashes, spaces, and brackets', () => {
      expect(normalizePhoneNumber('(012) 2123-4567', '+20')).toBe('+201221234567');
    });
  });

  describe('transformKidToGooglePerson', () => {
    const mockKid: Kid = {
      id: 'kid_123',
      active: true,
      info: {
        fullName: 'Fady Youssef',
        gender: 'male',
        school: 'St. Mark College',
      },
      contacts: {
        fatherName: 'Youssef Nabil',
        fatherMob: '01221112233',
        motherName: 'Mary George',
        motherMob: '01002223344',
        kidMob: '01113334455',
      },
      address: {
        region: 'Heliopolis',
      },
    };

    it('creates correct Person resource with givenName and organization', () => {
      const person = transformKidToGooglePerson(mockKid, 'St. Mark Church', 'Grade 4', '1743ش');

      expect(person.names[0].givenName).toBe('Fady Youssef');
      expect(person.organizations[0].name).toBe('St. Mark Church');
      expect(person.organizations[0].title).toBe('Grade 4 (1743ش)');
    });

    it('properly extracts and labels all family phone numbers in E.164 format', () => {
      const person = transformKidToGooglePerson(mockKid, 'St. Mark Church', 'Grade 4');

      expect(person.phoneNumbers).toHaveLength(3);
      expect(person.phoneNumbers[0]).toEqual({
        value: '+201221112233',
        type: 'Father (Youssef Nabil)',
      });
      expect(person.phoneNumbers[1]).toEqual({
        value: '+201002223344',
        type: 'Mother (Mary George)',
      });
      expect(person.phoneNumbers[2]).toEqual({
        value: '+201113334455',
        type: 'Mobile',
      });
    });

    it('omits biographies when student has no pastoral remarks', () => {
      const person = transformKidToGooglePerson(mockKid, 'St. Mark Church', 'Grade 4');
      expect(person.biographies).toBeUndefined();
    });

    it('maps native birthdays, relations, genders, full address, standalone urls and userDefined fields', () => {
      const richKid: Kid = {
        id: 'kid_rich',
        active: true,
        info: {
          fullName: 'Adrian Rami',
          gender: 'male',
          dob: '2014-10-15',
          school: 'Collège de la Salle',
          schoolType: 'National',
          deacon: true,
          fatherOfConfession: 'Fr. Daoud Lamei',
        },
        contacts: {
          fatherName: 'Rami',
          fatherProfession: 'Engineer',
          fatherMob: '01220000001',
          fatherDOB: '1980-05-20',
          motherName: 'Sara',
          motherProfession: 'Pharmacist',
          motherMob: '01090000002',
          motherDOB: '1985-08-14',
          kidMob: '01223344556',
        },
        address: {
          street: 'Shubra St',
          building: '14',
          floor: '3',
          apartment: '12',
          region: 'Cairo',
          landmark: 'Opposite Metro',
          geoLocation: 'geo:30.05,31.24',
        },
        notes: 'Memorized Psalm 23; attentive in class.',
      };

      const person = transformKidToGooglePerson(richKid, 'St. Mark Church', 'Grade 4', '1743ش');

      // Clean Name (no [SS] clutter)
      expect(person.names[0].givenName).toBe('Adrian Rami');

      // Title includes academic year
      expect(person.organizations[0].title).toBe('Grade 4 (1743ش)');

      // Native Birthdays
      expect(person.birthdays).toEqual([
        {
          date: {
            year: 2014,
            month: 10,
            day: 15,
          },
        },
      ]);

      // Standalone Parent Birthday Events
      expect(person.events).toEqual([
        {
          type: 'other',
          formattedType: 'Father Birthday / عيد ميلاد الأب',
          date: { year: 1980, month: 5, day: 20 },
        },
        {
          type: 'other',
          formattedType: 'Mother Birthday / عيد ميلاد الأم',
          date: { year: 1985, month: 8, day: 14 },
        },
      ]);

      // Native Relations
      expect(person.relations).toEqual([
        { person: 'Rami (Engineer)', type: 'father' },
        { person: 'Sara (Pharmacist)', type: 'mother' },
      ]);

      // Native Genders
      expect(person.genders).toEqual([{ value: 'male' }]);

      // Standalone 1-Tap Home Navigation URL
      expect(person.urls).toHaveLength(1);
      expect(person.urls[0].formattedType).toBe('Home GPS / موقع المنزل');
      expect(person.urls[0].value).toContain('30.05');

      // Standalone Custom Fields (first-class attributes)
      expect(person.userDefined).toContainEqual({ key: 'Father of Confession / أب الاعتراف', value: 'Fr. Daoud Lamei' });
      expect(person.userDefined).toContainEqual({ key: 'School / المدرسة', value: 'Collège de la Salle (National)' });
      expect(person.userDefined).toContainEqual({ key: 'Church Rank / الرتبة الكنسية', value: 'Altar Deacon / شماس' });
      expect(person.userDefined).toContainEqual({ key: 'Father Profession / وظيفة الأب', value: 'Engineer' });
      expect(person.userDefined).toContainEqual({ key: 'Mother Profession / وظيفة الأم', value: 'Pharmacist' });
      expect(person.userDefined).toContainEqual({ key: 'Academic Term / السنة الدراسية', value: '1743ش' });

      // Phone labels with professions
      expect(person.phoneNumbers[0].type).toBe('Father (Rami - Engineer)');
      expect(person.phoneNumbers[1].type).toBe('Mother (Sara - Pharmacist)');

      // Address includes floor
      expect(person.addresses[0].formattedValue).toBe('Shubra St, Bldg 14, Flr 3, Apt 12, Cairo, (Near: Opposite Metro)');
      expect(person.addresses[0].streetAddress).toBe('Shubra St, Bldg 14, Flr 3, Apt 12');

      // Notes only contains genuine pastoral remarks
      expect(person.biographies[0].value).toBe('Pastoral Notes: Memorized Psalm 23; attentive in class.');
    });
  });
});
