import { describe, it, expect } from 'vitest';
import { autoMapHeadersHeuristically, normalizeDateValue, autoDetectHeaderRow } from '../services/smartImport';
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

  describe('Multi-Sheet Workbook Tab Selection & Switching', () => {
    const mockSheetsData: Record<string, any[][]> = {
      'Primary 4': [
        ['اسم الطالب', 'موبايل الأب', 'العنوان'],
        ['Mark Youssef', '01221112233', 'Nasr City'],
      ],
      'Primary 5': [
        ['Student Name', 'Father Phone', 'Street'],
        ['Sarah Nabil', '01004445566', 'Heliopolis'],
        ['John Peter', '01115556677', 'Maadi'],
      ],
      'حضانة': [
        ['اسم الطفل', 'تليفون ماما'],
        ['Fady Mina', '01228889900'],
      ],
    };

    it('identifies all sheet names in workbook', () => {
      const sheetNames = Object.keys(mockSheetsData);
      expect(sheetNames).toEqual(['Primary 4', 'Primary 5', 'حضانة']);
      expect(sheetNames).toHaveLength(3);
    });

    it('switches active sheet rows and re-maps headers accurately', () => {
      const sheetNames = Object.keys(mockSheetsData);
      
      // Select first sheet (Arabic)
      let activeSheet = sheetNames[0];
      let rows = mockSheetsData[activeSheet];
      let headers = rows[0];
      let mapping = autoMapHeadersHeuristically(headers);

      expect(activeSheet).toBe('Primary 4');
      expect(mapping['اسم الطالب']).toBe('fullName');
      expect(mapping['موبايل الأب']).toBe('fatherMob');
      expect(rows.length).toBe(2);

      // Switch to second sheet (English)
      activeSheet = sheetNames[1];
      rows = mockSheetsData[activeSheet];
      headers = rows[0];
      mapping = autoMapHeadersHeuristically(headers);

      expect(activeSheet).toBe('Primary 5');
      expect(mapping['Student Name']).toBe('fullName');
      expect(mapping['Father Phone']).toBe('fatherMob');
      expect(mapping['Street']).toBe('street');
      expect(rows.length).toBe(3);

      // Switch to third sheet (Arabic KG)
      activeSheet = sheetNames[2];
      rows = mockSheetsData[activeSheet];
      headers = rows[0];
      mapping = autoMapHeadersHeuristically(headers);

      expect(activeSheet).toBe('حضانة');
      expect(mapping['اسم الطفل']).toBe('fullName');
      expect(mapping['تليفون ماما']).toBe('motherMob');
      expect(rows.length).toBe(2);
    });
  });

  describe('Comprehensive Excel Date Normalizer (normalizeDateValue)', () => {
    it('normalizes native JS Date instances', () => {
      const d = new Date(2015, 6, 25); // July 25, 2015
      expect(normalizeDateValue(d)).toBe('2015-07-25');
    });

    it('normalizes Excel numeric serial dates', () => {
      // Excel serial 42568 = July 17, 2016
      expect(normalizeDateValue(42568)).toBe('2016-07-17');
      expect(normalizeDateValue('42568')).toBe('2016-07-17');
    });

    it('normalizes DD/MM/YYYY, DD-MM-YYYY, and DD.MM.YYYY string formats', () => {
      expect(normalizeDateValue('15/07/2012')).toBe('2012-07-15');
      expect(normalizeDateValue('5/3/2014')).toBe('2014-03-05');
      expect(normalizeDateValue('22-11-2010')).toBe('2010-11-22');
      expect(normalizeDateValue('01.09.2018')).toBe('2018-09-01');
    });

    it('normalizes ISO string formats YYYY-MM-DD and YYYY/MM/DD', () => {
      expect(normalizeDateValue('2013-04-19')).toBe('2013-04-19');
      expect(normalizeDateValue('2013/04/19')).toBe('2013-04-19');
    });

    it('normalizes Arabic-Indic digits in dates', () => {
      expect(normalizeDateValue('١٥/٠٧/٢٠١٢')).toBe('2012-07-15');
      expect(normalizeDateValue('٢٠١٤-٠٥-٠١')).toBe('2014-05-01');
    });

    it('returns empty string for invalid/blank dates', () => {
      expect(normalizeDateValue('')).toBe('');
      expect(normalizeDateValue(null)).toBe('');
      expect(normalizeDateValue(undefined)).toBe('');
      expect(normalizeDateValue('not-a-date')).toBe('');
    });
  });

  describe('Smart Sunday School Header Row Detection (autoDetectHeaderRow)', () => {
    it('automatically skips title rows and selects the real header row', () => {
      const sheetWithTitleBanner = [
        ['كشف أسماء مخدومي فصل مارجرجس لعام 2026', '', ''],
        ['', '', ''],
        ['اسم الطالب', 'تاريخ الميلاد', 'النوع', 'موبايل الأب', 'العنوان'],
        ['كيرلس مينا', '15/07/2014', 'ولد', '01223344556', 'مصر الجديدة'],
        ['مارينا سامي', '20/11/2015', 'بنت', '01009988776', 'مدينة نصر'],
      ];

      const detected = autoDetectHeaderRow(sheetWithTitleBanner);
      expect(detected).toBe(2); // Row index 2 (the 3rd row) has the real headers!
    });

    it('defaults to row 0 when headers start immediately on row 0', () => {
      const cleanSheet = [
        ['Full Name', 'DOB', 'Gender', 'Father Mobile'],
        ['Mark Youssef', '2016-01-01', 'Male', '01221112233'],
      ];

      const detected = autoDetectHeaderRow(cleanSheet);
      expect(detected).toBe(0);
    });
  });
});
