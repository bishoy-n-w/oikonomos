import { describe, it, expect } from 'vitest';
import { autoMapHeadersHeuristically } from '../services/smartImport';
import { normalizePhoneNumber } from '../services/googleContacts';

describe('Smart Import & Bulk Operations Logic', () => {
  describe('Bilingual Heuristic Column Auto-Mapping (Option 3)', () => {
    it('maps English headers accurately', () => {
      const headers = [
        'Full Name',
        'Gender',
        'Date of Birth',
        'School',
        'Father of Confession',
        'Street',
        'Building',
        'Region',
        'Father Name',
        'Father Mobile',
        'Mother Name',
        'Mother Mobile',
        'Notes',
      ];

      const mapped = autoMapHeadersHeuristically(headers);

      expect(mapped['Full Name']).toBe('fullName');
      expect(mapped['Gender']).toBe('gender');
      expect(mapped['Date of Birth']).toBe('dob');
      expect(mapped['School']).toBe('school');
      expect(mapped['Father of Confession']).toBe('fatherOfConfession');
      expect(mapped['Street']).toBe('street');
      expect(mapped['Building']).toBe('building');
      expect(mapped['Region']).toBe('region');
      expect(mapped['Father Name']).toBe('fatherName');
      expect(mapped['Father Mobile']).toBe('fatherMob');
      expect(mapped['Mother Name']).toBe('motherName');
      expect(mapped['Mother Mobile']).toBe('motherMob');
      expect(mapped['Notes']).toBe('notes');
    });

    it('maps Arabic and Egyptian colloquial headers accurately', () => {
      const headers = [
        'اسم الطالب',
        'النوع',
        'تاريخ الميلاد',
        'المدرسة',
        'أب الاعتراف',
        'الشارع',
        'العمارة',
        'المنطقة',
        'اسم الأب',
        'موبايل ولي الأمر',
        'اسم الأم',
        'موبايل ماما',
        'ملاحظات',
      ];

      const mapped = autoMapHeadersHeuristically(headers);

      expect(mapped['اسم الطالب']).toBe('fullName');
      expect(mapped['النوع']).toBe('gender');
      expect(mapped['تاريخ الميلاد']).toBe('dob');
      expect(mapped['المدرسة']).toBe('school');
      expect(mapped['أب الاعتراف']).toBe('fatherOfConfession');
      expect(mapped['الشارع']).toBe('street');
      expect(mapped['العمارة']).toBe('building');
      expect(mapped['المنطقة']).toBe('region');
      expect(mapped['اسم الأب']).toBe('fatherName');
      expect(mapped['موبايل ولي الأمر']).toBe('fatherMob');
      expect(mapped['اسم الأم']).toBe('motherName');
      expect(mapped['موبايل ماما']).toBe('motherMob');
      expect(mapped['ملاحظات']).toBe('notes');
    });

    it('ignores unrecognized headers gracefully', () => {
      const headers = ['Random Column X', 'Serial Number #'];
      const mapped = autoMapHeadersHeuristically(headers);
      expect(mapped['Random Column X']).toBeUndefined();
      expect(mapped['Serial Number #']).toBeUndefined();
    });
  });

  describe('Header Row Selection & Slicing', () => {
    const mockSheet = [
      ['Church Report Title', '', ''],
      ['Student Name', 'Father Phone', 'Class'],
      ['Mark Youssef', '01221112233', 'Grade 4'],
      ['Sarah Nabil', '01004445566', 'Grade 4'],
    ];

    it('extracts headers correctly when headerRowIdx is 1', () => {
      const headerRowIdx = 1;
      const headers = mockSheet[headerRowIdx];
      const dataRows = mockSheet.slice(headerRowIdx + 1);

      expect(headers).toEqual(['Student Name', 'Father Phone', 'Class']);
      expect(dataRows).toHaveLength(2);
      expect(dataRows[0][0]).toBe('Mark Youssef');
    });
  });

  describe('Batch Phone Normalization on Import', () => {
    it('normalizes local phone numbers to E.164 standard during import', () => {
      const rawNumbers = ['01223344556', '01009876543', '+201112223334'];
      const normalized = rawNumbers.map((p) => normalizePhoneNumber(p, '+20'));

      expect(normalized).toEqual(['+201223344556', '+201009876543', '+201112223334']);
    });
  });
});
