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
      const person = transformKidToGooglePerson(mockKid, 'St. Mark Church', 'Grade 4');

      expect(person.names[0].givenName).toBe('[SS] Fady Youssef');
      expect(person.organizations[0].name).toBe('St. Mark Church');
      expect(person.organizations[0].title).toBe('Sunday School - Grade 4');
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

    it('populates notes/biography with family details', () => {
      const person = transformKidToGooglePerson(mockKid, 'St. Mark Church', 'Grade 4');

      expect(person.biographies[0].value).toContain('Father: Youssef Nabil');
      expect(person.biographies[0].value).toContain('Mother: Mary George');
      expect(person.biographies[0].value).toContain('Address: Heliopolis');
    });
  });
});
