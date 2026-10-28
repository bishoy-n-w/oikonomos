import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { 
  autoMapHeadersHeuristically, 
  normalizeDateValue,
  normalizeDateValueWithMeta,
  sanitizeFirestorePayload,
  autoDetectHeaderRow,
  parseSpreadsheetFile 
} from '../services/smartImport';
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

    it('maps new attributes (schoolType, deacon, landmark, fatherDOB, motherDOB) in English and Arabic with zero collisions', () => {
      const headers = [
        'School Type',
        'Deacon',
        'Landmark',
        'Father DOB',
        'Mother DOB',
        'نوع المدرسة',
        'شماس',
        'علامة مميزة',
        'تاريخ ميلاد الأب',
        'تاريخ ميلاد الأم',
        'المدرسة',
        'تاريخ ميلاد الطالب',
      ];

      const mapped = autoMapHeadersHeuristically(headers);

      expect(mapped['School Type']).toBe('schoolType');
      expect(mapped['Deacon']).toBe('deacon');
      expect(mapped['Landmark']).toBe('landmark');
      expect(mapped['Father DOB']).toBe('fatherDOB');
      expect(mapped['Mother DOB']).toBe('motherDOB');
      expect(mapped['نوع المدرسة']).toBe('schoolType');
      expect(mapped['شماس']).toBe('deacon');
      expect(mapped['علامة مميزة']).toBe('landmark');
      expect(mapped['تاريخ ميلاد الأب']).toBe('fatherDOB');
      expect(mapped['تاريخ ميلاد الأم']).toBe('motherDOB');
      expect(mapped['المدرسة']).toBe('school');
      expect(mapped['تاريخ ميلاد الطالب']).toBe('dob');
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

    it('safely handles numeric phone values from Excel cells without TypeError', () => {
      // Excel frequently parses phone numbers as raw numbers, stripping the leading 0
      const numericPhone = 1223344556;
      expect(normalizePhoneNumber(numericPhone, '+20')).toBe('+201223344556');

      const numericWithCountry = 201009876543;
      expect(normalizePhoneNumber(numericWithCountry, '+20')).toBe('+201009876543');
    });

    it('gracefully handles null, undefined, empty, and non-numeric inputs', () => {
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber('   ')).toBe('');
      expect(normalizePhoneNumber('---')).toBe('');
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

  describe('Arabic CSV & Excel File Encoding Resilience (parseSpreadsheetFile)', () => {
    it('parses UTF-8 Arabic CSV files without BOM without mojibake', async () => {
      const arabicCsv = 'الاسم بالكامل,تاريخ الميلاد,النوع\nجليل سامي,2015-11-10,ولد\nكيرلس مينا,2016-01-05,ولد';
      const encoded = new TextEncoder().encode(arabicCsv);
      const file = new File([encoded], 'كشوفات مدارس الأحد.csv', { type: 'text/csv' });

      const parsed = await parseSpreadsheetFile(file);

      expect(parsed.isCsv).toBe(true);
      expect(parsed.detectedEncoding).toBe('utf-8');
      expect(parsed.sheetNames).toEqual(['Sheet1']);
      expect(parsed.rawRows).toHaveLength(3);
      expect(parsed.rawRows[0]).toEqual(['الاسم بالكامل', 'تاريخ الميلاد', 'النوع']);
      expect(parsed.rawRows[1][0]).toBe('جليل سامي');
      expect(parsed.rawRows[2][0]).toBe('كيرلس مينا');

      // Verify header auto-detection and heuristic mapping succeed seamlessly on Arabic headers
      const headerIdx = autoDetectHeaderRow(parsed.rawRows);
      expect(headerIdx).toBe(0);
      const mapping = autoMapHeadersHeuristically(parsed.rawRows[0]);
      expect(mapping['الاسم بالكامل']).toBe('fullName');
      expect(mapping['تاريخ الميلاد']).toBe('dob');
      expect(mapping['النوع']).toBe('gender');
    });

    it('parses UTF-8 Arabic CSV files with BOM properly', async () => {
      const arabicCsv = 'اسم الطالب,موبايل الأب\nمارينا سامي,01221112233';
      const utf8Bytes = new TextEncoder().encode(arabicCsv);
      const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8Bytes]);
      const file = new File([withBom], 'students_bom.csv', { type: 'text/csv' });

      const parsed = await parseSpreadsheetFile(file);

      expect(parsed.isCsv).toBe(true);
      expect(parsed.detectedEncoding).toBe('utf-8');
      expect(parsed.rawRows[0]).toEqual(['اسم الطالب', 'موبايل الأب']);
      expect(parsed.rawRows[1][0]).toBe('مارينا سامي');
    });

    it('auto-detects and parses Windows-1256 (Arabic Excel ANSI) CSV files', async () => {
      // Windows-1256 bytes for "الاسم,النوع\nجليل,ولد"
      const win1256Bytes = new Uint8Array([
        0xc7, 0xe1, 0xc7, 0xd3, 0xe3, 0x2c, 0xc7, 0xe1, 0xe4, 0xe6, 0xda, 0x0a,
        0xcc, 0xe1, 0xed, 0xe1, 0x2c, 0xe6, 0xe1, 0xcf
      ]);
      const file = new File([win1256Bytes], 'excel_ansi_arabic.csv', { type: 'text/csv' });

      const parsed = await parseSpreadsheetFile(file);

      expect(parsed.isCsv).toBe(true);
      expect(parsed.detectedEncoding).toBe('windows-1256');
      expect(parsed.rawRows[0]).toEqual(['الاسم', 'النوع']);
      expect(parsed.rawRows[1]).toEqual(['جليل', 'ولد']);
    });

    it('respects explicit encodingOverride when passed', async () => {
      const win1256Bytes = new Uint8Array([
        0xc7, 0xe1, 0xc7, 0xd3, 0xe3, 0x2c, 0xc7, 0xe1, 0xe4, 0xe6, 0xda, 0x0a,
        0xcc, 0xe1, 0xed, 0xe1, 0x2c, 0xe6, 0xe1, 0xcf
      ]);
      const file = new File([win1256Bytes], 'excel_ansi_override.csv', { type: 'text/csv' });

      const parsed = await parseSpreadsheetFile(file, 'windows-1256');

      expect(parsed.isCsv).toBe(true);
      expect(parsed.detectedEncoding).toBe('windows-1256');
      expect(parsed.rawRows[0]).toEqual(['الاسم', 'النوع']);
      expect(parsed.rawRows[1]).toEqual(['جليل', 'ولد']);
    });

    it('parses binary .xlsx files with isCsv: false', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['الاسم بالكامل', 'تاريخ الميلاد'],
        ['مارك أمير', '2014-06-15']
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'فصل داود');
      const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const file = new File([u8], 'boys_class.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const parsed = await parseSpreadsheetFile(file);

      expect(parsed.isCsv).toBe(false);
      expect(parsed.sheetNames).toEqual(['فصل داود']);
      expect(parsed.rawRows[0]).toEqual(['الاسم بالكامل', 'تاريخ الميلاد']);
      expect(parsed.rawRows[1][0]).toBe('مارك أمير');
    });
  });

  describe('Arabic Month Names & Year 2000 Default Date Parsing', () => {
    it('normalizes Arabic month names without year to default year 2000', () => {
      expect(normalizeDateValue('8 فبراير')).toBe('2000-02-08');
      expect(normalizeDateValue('1-ديسمبر')).toBe('2000-12-01');
      expect(normalizeDateValue('6-يوليو')).toBe('2000-07-06');
      expect(normalizeDateValue('15 نوفمبر')).toBe('2000-11-15');
      expect(normalizeDateValue('20 يناير')).toBe('2000-01-20');
      expect(normalizeDateValue('11- اغسطس')).toBe('2000-08-11');
      expect(normalizeDateValue('18 مايو')).toBe('2000-05-18');
      expect(normalizeDateValue('24 نوفمبر')).toBe('2000-11-24');
      expect(normalizeDateValue('10 يناير ')).toBe('2000-01-10');
      expect(normalizeDateValue('10 اغسطس ')).toBe('2000-08-10');
    });

    it('normalizes Arabic month names with explicit year accurately', () => {
      expect(normalizeDateValue('15 فبراير 2012')).toBe('2012-02-15');
      expect(normalizeDateValue('2014-مارس-25')).toBe('2014-03-25');
      expect(normalizeDateValue('٢٢ أكتوبر ٢٠١٠')).toBe('2010-10-22');
      expect(normalizeDateValue('5 إبريل 2015')).toBe('2015-04-05');
    });

    it('returns metadata indicating whether default year was applied via normalizeDateValueWithMeta', () => {
      const yearLess = normalizeDateValueWithMeta('8 فبراير', '2000');
      expect(yearLess.date).toBe('2000-02-08');
      expect(yearLess.usedDefaultYear).toBe(true);

      const withYear = normalizeDateValueWithMeta('8 فبراير 2013', '2000');
      expect(withYear.date).toBe('2013-02-08');
      expect(withYear.usedDefaultYear).toBe(false);

      const standardIso = normalizeDateValueWithMeta('2014-05-19');
      expect(standardIso.date).toBe('2014-05-19');
      expect(standardIso.usedDefaultYear).toBe(false);
    });
  });

  describe('Header Disambiguation: Academic Year vs. Birth Dates', () => {
    it('does NOT map academic year / grade headers to dob', () => {
      const academicHeaders = [
        'السنة الدراسية ',
        'المرحلة الدراسية',
        'الصف الدراسي',
        'السنة الدراسية',
      ];
      const mapping = autoMapHeadersHeuristically(academicHeaders);
      expect(mapping['السنة الدراسية ']).toBeUndefined();
      expect(mapping['المرحلة الدراسية']).toBeUndefined();
      expect(mapping['الصف الدراسي']).toBeUndefined();
      expect(mapping['السنة الدراسية']).toBeUndefined();
    });

    it('accurately maps all genuine birth date variants to dob', () => {
      const birthHeaders = [
        'تاريخ الميلاد ',
        'سنة الميلاد',
        'عيد الميلاد',
        'ميلاد',
        'السن',
        'سن الطالب',
        'تاريخ ميلاد الطالب',
      ];
      const mapping = autoMapHeadersHeuristically(birthHeaders);
      expect(mapping['تاريخ الميلاد ']).toBe('dob');
      expect(mapping['سنة الميلاد']).toBe('dob');
      expect(mapping['عيد الميلاد']).toBe('dob');
      expect(mapping['ميلاد']).toBe('dob');
      expect(mapping['السن']).toBe('dob');
      expect(mapping['سن الطالب']).toBe('dob');
      expect(mapping['تاريخ ميلاد الطالب']).toBe('dob');
    });

    it('correctly maps the exact columns from the Sunday School weekly sheet', () => {
      const actualHeaders = [
        'الاسم ',
        'السنة الدراسية ',
        'تليفون شخصي ',
        'تليفون الام ',
        'اب الاعتراف ',
        'العنوان ',
        'المدرسة ',
        'تاريخ الميلاد ',
        'عمل الاب ',
        'اسم الام',
      ];
      const mapping = autoMapHeadersHeuristically(actualHeaders);

      expect(mapping['الاسم ']).toBe('fullName');
      expect(mapping['السنة الدراسية ']).toBeUndefined(); // Should NOT collide with dob!
      expect(mapping['تليفون شخصي ']).toBe('kidMob');
      expect(mapping['تليفون الام ']).toBe('motherMob');
      expect(mapping['اب الاعتراف ']).toBe('fatherOfConfession');
      expect(mapping['العنوان ']).toBe('region');
      expect(mapping['المدرسة ']).toBe('school');
      expect(mapping['تاريخ الميلاد ']).toBe('dob');
      expect(mapping['عمل الاب ']).toBe('fatherProfession');
      expect(mapping['اسم الام']).toBe('motherName');
    });
  });

  describe('Firestore Payload Sanitization (sanitizeFirestorePayload)', () => {
    it('recursively removes undefined fields preventing WriteBatch.set() crashes', () => {
      const rawPayload = {
        fullName: 'كارن اسامة',
        info: {
          dob: '2000-02-08',
          schoolType: undefined,
          deacon: undefined,
          photoUrl: undefined,
        },
        address: {
          region: 'ش خليف المأمون',
          landmark: undefined,
          geoLocation: undefined,
        },
        contacts: {
          fatherDOB: undefined,
          motherDOB: undefined,
          fatherMob: '+201299925403',
        },
        nullField: null,
        numField: 42,
        boolField: false,
      };

      const clean = sanitizeFirestorePayload(rawPayload);

      expect(clean.info).toEqual({ dob: '2000-02-08' });
      expect('schoolType' in clean.info).toBe(false);
      expect('deacon' in clean.info).toBe(false);
      expect('photoUrl' in clean.info).toBe(false);

      expect(clean.address).toEqual({ region: 'ش خليف المأمون' });
      expect('landmark' in clean.address).toBe(false);
      expect('geoLocation' in clean.address).toBe(false);

      expect(clean.contacts).toEqual({ fatherMob: '+201299925403' });
      expect('fatherDOB' in clean.contacts).toBe(false);
      expect('motherDOB' in clean.contacts).toBe(false);

      expect(clean.nullField).toBeNull();
      expect(clean.numField).toBe(42);
      expect(clean.boolField).toBe(false);
    });
  });

  describe('Class Roster Reconciliation & Defensive State Resilience', () => {
    it('prunes reassigned kid IDs from previous classroom rosters without affecting untouched students', () => {
      const classA_KidIds = ['kid_1', 'kid_2', 'kid_3'];
      const reassignedIds = ['kid_2'];

      const updatedClassA_KidIds = classA_KidIds.filter((id) => !reassignedIds.includes(id));

      expect(updatedClassA_KidIds).toEqual(['kid_1', 'kid_3']);
      expect(updatedClassA_KidIds.includes('kid_2')).toBe(false);
    });

    it('safely handles kids records with missing or partial info without crashing', () => {
      const partialKids = [
        { id: 'k1', info: { fullName: 'George Michael' } },
        { id: 'k2', info: undefined },
        { id: 'k3', info: { fullName: null } },
      ];

      const query = 'george';
      const results = partialKids.filter((k) =>
        (k.info?.fullName || '').toLowerCase().includes(query)
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('k1');
    });

    it('evaluates active status correctly where undefined is treated as active', () => {
      const kids = [
        { id: 'k1', active: true },
        { id: 'k2', active: undefined },
        { id: 'k3', active: false },
      ];

      const activeKids = kids.filter((k) => k.active !== false);

      expect(activeKids.map((k) => k.id)).toEqual(['k1', 'k2']);
      expect(activeKids.some((k) => k.id === 'k3')).toBe(false);
    });
  });
});
