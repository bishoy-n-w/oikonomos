import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { normalizePhoneNumber } from './googleContacts';

export interface TargetFieldDef {
  key: string;
  label: string;
  category: 'profile' | 'assignment' | 'address' | 'contacts' | 'notes';
  type: 'text' | 'select' | 'date' | 'tel';
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'fullName', label: 'Full Name (الاسم بالكامل)', category: 'profile', type: 'text' },
  { key: 'gender', label: 'Gender (النوع)', category: 'profile', type: 'select' },
  { key: 'dob', label: 'Date of Birth (تاريخ الميلاد)', category: 'profile', type: 'date' },
  { key: 'school', label: 'School (المدرسة)', category: 'profile', type: 'text' },
  { key: 'fatherOfConfession', label: 'Father of Confession (أب الاعتراف)', category: 'profile', type: 'text' },
  
  { key: 'street', label: 'Street (الشارع)', category: 'address', type: 'text' },
  { key: 'building', label: 'Building (العمارة)', category: 'address', type: 'text' },
  { key: 'floor', label: 'Floor (الدور)', category: 'address', type: 'text' },
  { key: 'apartment', label: 'Apartment (الشقة)', category: 'address', type: 'text' },
  { key: 'region', label: 'Region / Area (المنطقة)', category: 'address', type: 'text' },

  { key: 'kidMob', label: 'Kid Mobile (موبايل الطالب)', category: 'contacts', type: 'tel' },
  { key: 'fatherName', label: 'Father Name (اسم الأب)', category: 'contacts', type: 'text' },
  { key: 'fatherProfession', label: 'Father Job (وظيفة الأب)', category: 'contacts', type: 'text' },
  { key: 'fatherMob', label: 'Father Mobile (موبايل الأب)', category: 'contacts', type: 'tel' },
  { key: 'motherName', label: 'Mother Name (اسم الأم)', category: 'contacts', type: 'text' },
  { key: 'motherProfession', label: 'Mother Job (وظيفة الأم)', category: 'contacts', type: 'text' },
  { key: 'motherMob', label: 'Mother Mobile (موبايل الأم)', category: 'contacts', type: 'tel' },
  { key: 'otherMob', label: 'Other Mobile (تليفون آخر)', category: 'contacts', type: 'tel' },

  { key: 'notes', label: 'Notes (ملاحظات)', category: 'notes', type: 'text' },
];

/**
 * Normalizes header strings by stripping spaces, symbols, and normalizing Arabic letters.
 */
function cleanHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '') // strip Arabic diacritics
    .replace(/[أإآ]/g, 'ا') // normalize Alef
    .replace(/[ة]/g, 'ه') // normalize Ta Marbuta
    .replace(/[ى]/g, 'ي') // normalize Ya
    .replace(/[^\w\u0621-\u064A]/g, '') // keep letters, numbers, and Arabic
    .trim();
}

/**
 * Bilingual heuristic mapping dictionary (Option 3 - Fast Offline Layer).
 */
const HEURISTIC_PATTERNS: Record<string, string[]> = {
  // Specific composite names first
  fatherName: ['fathername', 'father name', 'اسم الاب', 'اسم الوالد', 'والد الطالب', 'اسم ولي الامر', 'اسم ولي أمر'],
  fatherProfession: ['fatherprofession', 'fatherjob', 'fatheroccupation', 'وظيفة الاب', 'مهنة الاب', 'عمل الاب', 'شغل الاب'],
  fatherMob: ['fathermob', 'fatherphone', 'موبايل الاب', 'تليفون الاب', 'رقم الاب', 'موبايل ولي الامر', 'تليفون ولي الامر', 'تليفون بابا', 'موبايل بابا', 'هاتف الاب', 'ولي الامر', 'موبايل ولي أمر', 'رقم ولي الامر', 'تليفون ولي الأمر'],
  motherName: ['mothername', 'mother name', 'اسم الام', 'اسم الوالدة', 'والدة الطالب'],
  motherProfession: ['motherprofession', 'motherjob', 'motheroccupation', 'وظيفة الام', 'مهنة الام', 'عمل الام', 'شغل الام'],
  motherMob: ['mothermob', 'motherphone', 'موبايل الام', 'تليفون الام', 'رقم الام', 'تليفون ماما', 'موبايل ماما', 'هاتف الام', 'تليفون والدة'],
  otherMob: ['othermob', 'otherphone', 'emergencyphone', 'تليفون اخر', 'موبايل اخر', 'رقم طوارئ', 'هاتف اخر'],
  kidMob: ['kidmob', 'kidphone', 'studentmobile', 'studentphone', 'موبايل الطالب', 'تليفون الطالب', 'رقم الطالب', 'موبايل الطفل', 'هاتف الطالب', 'موبايل', 'تليفون'],
  
  // Student profile
  fullName: ['fullname', 'studentname', 'kidname', 'اسم الطالب', 'الاسم بالكامل', 'اسم الطفل', 'اسم المخدوم', 'full name', 'name', 'الاسم', 'اسم التلميذ', 'الاسم رباعي', 'الاسم ثلاثي', 'الاسم ثنائي', 'اسم الطالب/الطالبة', 'student full name'],
  gender: ['gender', 'sex', 'النوع', 'الجنس', 'بنت ولد', 'ولد بنت', 'النوع (بنت/ولد)', 'بنت/ولد'],
  dob: ['dob', 'birthdate', 'dateofbirth', 'birth date', 'تاريخ الميلاد', 'الميلاد', 'تاريخ ميلاد', 'تاريخ', 'السن', 'تاريخ_الميلاد', 'تاريخ_ميلاد', 'ميلاد', 'date of birth', 'bdate', 'birthday'],
  school: ['school', 'المدرسة', 'مدرسة'],
  fatherOfConfession: ['fatherofconfession', 'confessionfather', 'abouna', 'اب الاعتراف', 'اسم اب الاعتراف', 'ابونا', 'كاهن الاعتراف', 'اب اعتراف الطالب'],
  
  // Address
  street: ['street', 'الشارع', 'اسم الشارع'],
  building: ['building', 'bldg', 'العمارة', 'رقم العمارة', 'عمارة'],
  floor: ['floor', 'الدور', 'رقم الدور'],
  apartment: ['apartment', 'apt', 'الشقة', 'رقم الشقة'],
  region: ['region', 'district', 'area', 'city', 'المنطقة', 'الحي', 'المدينة', 'العنوان', 'السكن'],
  notes: ['notes', 'comments', 'remarks', 'ملاحظات', 'ملاحظة', 'تعليقات'],
};

/**
 * Normalizes various raw date inputs (Date objects, Excel serial numbers, DD/MM/YYYY, YYYY-MM-DD, Arabic numerals)
 * into ISO standard YYYY-MM-DD format.
 */
export function normalizeDateValue(raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // 1. Native Date instance (from XLSX cellDates: true)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Convert Arabic-Indic digits (٠-٩) to ASCII digits (0-9)
  const str = String(raw).trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // 3. Numeric Excel serial date (e.g. 42568, 44197 or string representing one)
  const num = Number(str);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const excelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(excelDate.getTime())) {
      const y = excelDate.getFullYear();
      const m = String(excelDate.getMonth() + 1).padStart(2, '0');
      const d = String(excelDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 4. ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 5. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 6. DD/MM/YY or MM/DD/YY (2-digit year)
  const dmyShort = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const d = dmyShort[1].padStart(2, '0');
    const m = dmyShort[2].padStart(2, '0');
    const yearPrefix = parseInt(dmyShort[3], 10) > 30 ? '19' : '20';
    const y = `${yearPrefix}${dmyShort[3]}`;
    return `${y}-${m}-${d}`;
  }

  // 7. General JS Date parsing fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1920 && parsed.getFullYear() < 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Scans the first 10 rows of a spreadsheet to automatically identify the most probable
 * header row by matching known Sunday School CRM keywords.
 */
export function autoDetectHeaderRow(rows: any[][]): number {
  if (!rows || rows.length === 0) return 0;

  const maxScan = Math.min(rows.length, 10);
  let bestRowIdx = 0;
  let maxScore = -1;

  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach((cell) => {
      if (!cell) return;
      const str = cleanHeader(String(cell));
      if (!str) return;

      // Check if matches known patterns
      for (const patterns of Object.values(HEURISTIC_PATTERNS)) {
        if (patterns.some((p) => {
          const cp = cleanHeader(p);
          return cp === str || (cp.length >= 3 && str.includes(cp));
        })) {
          score += 2;
          break;
        }
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestRowIdx = r;
    }
  }

  return maxScore >= 2 ? bestRowIdx : 0;
}

/**
 * Runs the heuristic mapping on a list of sheet header strings.
 */
export function autoMapHeadersHeuristically(sheetHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  sheetHeaders.forEach((rawHeader) => {
    if (!rawHeader) return;
    const cleaned = cleanHeader(rawHeader);
    let matchedKey = '';

    // Pass 1: Try exact clean match
    for (const [fieldKey, patterns] of Object.entries(HEURISTIC_PATTERNS)) {
      const exactMatch = patterns.some((p) => cleanHeader(p) === cleaned);
      if (exactMatch) {
        matchedKey = fieldKey;
        break;
      }
    }

    // Pass 2: Substring matching if no exact match found
    if (!matchedKey) {
      for (const [fieldKey, patterns] of Object.entries(HEURISTIC_PATTERNS)) {
        // Prevent generic fullName from grabbing parent fields
        if (fieldKey === 'fullName' && (cleaned.includes('اب') || cleaned.includes('ام') || cleaned.includes('father') || cleaned.includes('mother'))) {
          continue;
        }

        const subMatch = patterns.some((p) => {
          const cp = cleanHeader(p);
          return cp.length >= 3 && (cleaned.includes(cp) || cp.includes(cleaned));
        });
        if (subMatch) {
          matchedKey = fieldKey;
          break;
        }
      }
    }

    if (matchedKey) {
      mapping[rawHeader] = matchedKey;
    }
  });

  return mapping;
}

/**
 * Option 3: Enhances column mapping using the free Google Gemini API if provided.
 */
export async function enhanceMappingWithGemini(
  sheetHeaders: string[],
  sampleRows: any[][],
  apiKey?: string
): Promise<Record<string, string>> {
  // If no API key is provided, gracefully return the heuristic mapping
  if (!apiKey) {
    return autoMapHeadersHeuristically(sheetHeaders);
  }

  const prompt = `You are a Sunday School CRM data assistant. Map the following spreadsheet column headers to target schema keys.
Target keys allowed:
${TARGET_FIELDS.map((f) => `- "${f.key}": ${f.label}`).join('\n')}

Input spreadsheet column headers:
${JSON.stringify(sheetHeaders)}

Sample rows for context:
${JSON.stringify(sampleRows.slice(0, 2))}

Return ONLY a valid JSON object mapping each spreadsheet header to the exact target key or "ignore". Example:
{"اسم الطالب": "fullName", "تليفون ولي الأمر": "fatherMob"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        // Clean and validate returned keys
        const validKeys = new Set(TARGET_FIELDS.map((f) => f.key));
        const finalMap: Record<string, string> = {};
        for (const [header, mappedKey] of Object.entries(parsed)) {
          if (validKeys.has(mappedKey as string)) {
            finalMap[header] = mappedKey as string;
          }
        }
        return finalMap;
      }
    }
  } catch (err) {
    console.warn('Gemini AI mapping failed, falling back to heuristics:', err);
  }

  return autoMapHeadersHeuristically(sheetHeaders);
}

export interface ParsedSpreadsheet {
  sheetNames: string[];
  sheets: Record<string, any[][]>;
  rawRows: any[][];
}

/**
 * Parses an Excel or CSV file into raw 2D row arrays per sheet tab.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets: Record<string, any[][]> = {};
        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          sheets[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        }
        const firstSheetName = workbook.SheetNames[0] || '';
        resolve({
          sheetNames: workbook.SheetNames,
          sheets,
          rawRows: sheets[firstSheetName] || [],
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export interface ImportResult {
  success: boolean;
  batchId: string;
  totalProcessed: number;
  totalCreated: number;
  totalSkipped: number;
  totalUpdated: number;
  errors: string[];
  attributeCounts: Record<string, number>;
  sampleImportedRecords: Array<{
    fullName: string;
    gender: string;
    dob: string;
    fatherMob: string;
    motherMob: string;
    address: string;
  }>;
}

/**
 * Executes a batch import into Firestore with an assigned importBatchId for one-click rollback.
 */
export async function executeImportBatch(
  churchId: string,
  rows: any[][],
  headerRowIndex: number,
  mapping: Record<string, string>,
  assignment: {
    academicYearId: string;
    serviceGroupId: string;
    classId: string;
  },
  userEmail: string,
  defaultValues?: {
    gender?: string;
    fatherOfConfession?: string;
    school?: string;
    region?: string;
    street?: string;
    notes?: string;
  }
): Promise<ImportResult> {
  const batchId = `import_${Date.now()}`;
  const headers = rows[headerRowIndex].map((h: any) => String(h || '').trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];
  const attributeCounts: Record<string, number> = {};
  const sampleImportedRecords: ImportResult['sampleImportedRecords'] = [];

  // Group into batches of 400 (Firestore limit is 500 operations per batch)
  const batchSize = 400;
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const chunk = dataRows.slice(i, i + batchSize);
    const firestoreBatch = writeBatch(db);

    chunk.forEach((row, rowIdx) => {
      // Build row data object - keep raw cell values to preserve Date instances and types
      const record: Record<string, any> = {};
      headers.forEach((hdr, colIdx) => {
        const targetField = mapping[hdr];
        if (targetField && targetField !== 'ignore') {
          record[targetField] = row[colIdx];
        }
      });

      const fullName = String(record.fullName || '').trim();
      if (!fullName) {
        // Skip empty / blank rows
        totalSkipped++;
        return;
      }

      const docId = fullName.toLowerCase().replace(/\s+/g, '_') + `_${Date.now()}_${rowIdx}`;
      const kidRef = doc(db, 'churches', churchId, 'kids', docId);

      const parsedDob = normalizeDateValue(record.dob);

      // Gender calculation with fallback to batch default
      let parsedGender: 'male' | 'female' = 'male';
      if (defaultValues?.gender === 'female') {
        parsedGender = 'female';
      } else if (defaultValues?.gender === 'male') {
        parsedGender = 'male';
      } else {
        const rawGender = String(record.gender || '').trim().toLowerCase();
        parsedGender =
          rawGender.includes('بنت') || rawGender.includes('أنثى') || rawGender.includes('انثى') || rawGender === 'female' || rawGender === 'f'
            ? 'female'
            : 'male';
      }

      // Check if fatherName or motherName received a Date instance or date string accidentally
      let safeFatherName = record.fatherName;
      if (safeFatherName instanceof Date || (typeof safeFatherName === 'string' && /GMT|\d{4}-\d{2}-\d{2}/i.test(safeFatherName))) {
        safeFatherName = '';
      }
      let safeMotherName = record.motherName;
      if (safeMotherName instanceof Date || (typeof safeMotherName === 'string' && /GMT|\d{4}-\d{2}-\d{2}/i.test(safeMotherName))) {
        safeMotherName = '';
      }

      // Auto-extract father's name from student's name if fatherName is missing
      let fatherNameStr = String(safeFatherName || '').trim();
      if (!fatherNameStr && fullName) {
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        if (nameParts.length >= 2) {
          fatherNameStr = nameParts.slice(1).join(' ');
        }
      }

      const normKidMob = normalizePhoneNumber(record.kidMob);
      const normFatherMob = normalizePhoneNumber(record.fatherMob);
      const normMotherMob = normalizePhoneNumber(record.motherMob);
      const normOtherMob = normalizePhoneNumber(record.otherMob);

      // Fallback defaults for unmapped / empty fields
      const finalSchool = String(record.school || defaultValues?.school || '').trim();
      const finalConfession = String(record.fatherOfConfession || defaultValues?.fatherOfConfession || '').trim();
      const finalRegion = String(record.region || defaultValues?.region || '').trim();
      const finalStreet = String(record.street || defaultValues?.street || '').trim();
      const finalNotes = String(record.notes || defaultValues?.notes || '').trim();

      // Track attribute counts
      attributeCounts.fullName = (attributeCounts.fullName || 0) + 1;
      if (parsedDob) attributeCounts.dob = (attributeCounts.dob || 0) + 1;
      attributeCounts.gender = (attributeCounts.gender || 0) + 1;
      if (fatherNameStr) attributeCounts.fatherName = (attributeCounts.fatherName || 0) + 1;
      if (normFatherMob) attributeCounts.fatherMob = (attributeCounts.fatherMob || 0) + 1;
      if (safeMotherName) attributeCounts.motherName = (attributeCounts.motherName || 0) + 1;
      if (normMotherMob) attributeCounts.motherMob = (attributeCounts.motherMob || 0) + 1;
      if (normKidMob) attributeCounts.kidMob = (attributeCounts.kidMob || 0) + 1;
      if (finalStreet || finalRegion || record.building) attributeCounts.address = (attributeCounts.address || 0) + 1;
      if (finalSchool) attributeCounts.school = (attributeCounts.school || 0) + 1;
      if (finalConfession) attributeCounts.fatherOfConfession = (attributeCounts.fatherOfConfession || 0) + 1;
      if (finalNotes) attributeCounts.notes = (attributeCounts.notes || 0) + 1;

      // Sample records for visual confirmation in completion report
      if (sampleImportedRecords.length < 10) {
        sampleImportedRecords.push({
          fullName,
          gender: parsedGender,
          dob: parsedDob,
          fatherMob: normFatherMob,
          motherMob: normMotherMob,
          address: [finalStreet, finalRegion].filter(Boolean).join(', ') || String(finalStreet || finalRegion || ''),
        });
      }

      const kidPayload = {
        active: true,
        importBatchId: batchId,
        info: {
          fullName,
          gender: parsedGender,
          dob: parsedDob,
          school: finalSchool,
          fatherOfConfession: finalConfession,
        },
        activeAssignment: {
          academicYearId: assignment.academicYearId,
          serviceGroupId: assignment.serviceGroupId,
          classId: assignment.classId,
        },
        address: {
          street: finalStreet,
          building: String(record.building || '').trim(),
          floor: String(record.floor || '').trim(),
          apartment: String(record.apartment || '').trim(),
          region: finalRegion,
        },
        contacts: {
          kidMob: normKidMob,
          fatherName: fatherNameStr,
          fatherProfession: String(record.fatherProfession || '').trim(),
          fatherMob: normFatherMob,
          motherName: String(safeMotherName || '').trim(),
          motherProfession: String(record.motherProfession || '').trim(),
          motherMob: normMotherMob,
          otherMob: normOtherMob,
        },
        notes: finalNotes,
        createdAt: new Date().toISOString(),
        createdBy: userEmail,
        lastEditAt: new Date().toISOString(),
        lastEditBy: userEmail,
      };

      firestoreBatch.set(kidRef, kidPayload);
      totalCreated++;
    });

    try {
      await firestoreBatch.commit();
    } catch (err: any) {
      console.error('Firestore batch commit error:', err);
      errors.push(err.message || 'Error writing batch chunk');
    }
  }

  return {
    success: errors.length === 0,
    batchId,
    totalProcessed: dataRows.length,
    totalCreated,
    totalSkipped,
    totalUpdated: 0,
    errors,
    attributeCounts,
    sampleImportedRecords,
  };
}

/**
 * Reverts all records created in a specific import batch.
 */
export async function revertImportBatch(churchId: string, batchId: string): Promise<number> {
  const kidsRef = collection(db, 'churches', churchId, 'kids');
  const q = query(kidsRef, where('importBatchId', '==', batchId));
  const snap = await getDocs(q);

  let deletedCount = 0;
  const docs = snap.docs;
  const batchSize = 400;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const firestoreBatch = writeBatch(db);
    chunk.forEach((d) => {
      firestoreBatch.delete(d.ref);
      deletedCount++;
    });
    await firestoreBatch.commit();
  }

  return deletedCount;
}
