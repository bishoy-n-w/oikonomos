import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { normalizePhoneNumber } from './googleContacts';

export interface TargetFieldDef {
  key: string;
  label: string;
  category: 'profile' | 'assignment' | 'address' | 'contacts' | 'notes';
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'fullName', label: 'Full Name (الاسم بالكامل)', category: 'profile' },
  { key: 'gender', label: 'Gender (النوع)', category: 'profile' },
  { key: 'dob', label: 'Date of Birth (تاريخ الميلاد)', category: 'profile' },
  { key: 'school', label: 'School (المدرسة)', category: 'profile' },
  { key: 'fatherOfConfession', label: 'Father of Confession (أب الاعتراف)', category: 'profile' },
  
  { key: 'street', label: 'Street (الشارع)', category: 'address' },
  { key: 'building', label: 'Building (العمارة)', category: 'address' },
  { key: 'floor', label: 'Floor (الدور)', category: 'address' },
  { key: 'apartment', label: 'Apartment (الشقة)', category: 'address' },
  { key: 'region', label: 'Region / Area (المنطقة)', category: 'address' },

  { key: 'kidMob', label: 'Kid Mobile (موبايل الطالب)', category: 'contacts' },
  { key: 'fatherName', label: 'Father Name (اسم الأب)', category: 'contacts' },
  { key: 'fatherProfession', label: 'Father Job (وظيفة الأب)', category: 'contacts' },
  { key: 'fatherMob', label: 'Father Mobile (موبايل الأب)', category: 'contacts' },
  { key: 'motherName', label: 'Mother Name (اسم الأم)', category: 'contacts' },
  { key: 'motherProfession', label: 'Mother Job (وظيفة الأم)', category: 'contacts' },
  { key: 'motherMob', label: 'Mother Mobile (موبايل الأم)', category: 'contacts' },
  { key: 'otherMob', label: 'Other Mobile (تليفون آخر)', category: 'contacts' },

  { key: 'notes', label: 'Notes (ملاحظات)', category: 'notes' },
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
  fatherName: ['fathername', 'father name', 'اسم الاب', 'اسم الوالد', 'والد الطالب'],
  fatherProfession: ['fatherprofession', 'fatherjob', 'fatheroccupation', 'وظيفة الاب', 'مهنة الاب', 'عمل الاب', 'شغل الاب'],
  fatherMob: ['fathermob', 'fatherphone', 'موبايل الاب', 'تليفون الاب', 'رقم الاب', 'موبايل ولي الامر', 'تليفون ولي الامر', 'تليفون بابا', 'موبايل بابا'],
  motherName: ['mothername', 'mother name', 'اسم الام', 'اسم الوالدة', 'والدة الطالب'],
  motherProfession: ['motherprofession', 'motherjob', 'motheroccupation', 'وظيفة الام', 'مهنة الام', 'عمل الام', 'شغل الام'],
  motherMob: ['mothermob', 'motherphone', 'موبايل الام', 'تليفون الام', 'رقم الام', 'تليفون ماما', 'موبايل ماما'],
  otherMob: ['othermob', 'otherphone', 'emergencyphone', 'تليفون اخر', 'موبايل اخر', 'رقم طوارئ', 'هاتف اخر'],
  kidMob: ['kidmob', 'kidphone', 'studentmobile', 'studentphone', 'موبايل الطالب', 'تليفون الطالب', 'رقم الطالب', 'موبايل الطفل'],
  
  // Student profile
  fullName: ['fullname', 'studentname', 'kidname', 'اسم الطالب', 'الاسم بالكامل', 'اسم الطفل', 'اسم المخدوم', 'full name', 'name', 'الاسم'],
  gender: ['gender', 'sex', 'النوع', 'الجنس', 'بنت ولد', 'ولد بنت'],
  dob: ['dob', 'birthdate', 'dateofbirth', 'birth date', 'تاريخ الميلاد', 'الميلاد', 'تاريخ ميلاد'],
  school: ['school', 'المدرسة', 'مدرسة'],
  fatherOfConfession: ['fatherofconfession', 'confessionfather', 'abouna', 'اب الاعتراف', 'اسم اب الاعتراف', 'ابونا', 'كاهن الاعتراف'],
  
  // Address
  street: ['street', 'الشارع', 'اسم الشارع'],
  building: ['building', 'bldg', 'العمارة', 'رقم العمارة', 'عمارة'],
  floor: ['floor', 'الدور', 'رقم الدور'],
  apartment: ['apartment', 'apt', 'الشقة', 'رقم الشقة'],
  region: ['region', 'district', 'area', 'city', 'المنطقة', 'الحي', 'المدينة', 'العنوان', 'السكن'],
  notes: ['notes', 'comments', 'remarks', 'ملاحظات', 'ملاحظة', 'تعليقات'],
};

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

/**
 * Parses an Excel or CSV file into raw 2D row arrays.
 */
export async function parseSpreadsheetFile(file: File): Promise<{ sheetNames: string[]; rawRows: any[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        resolve({ sheetNames: workbook.SheetNames, rawRows });
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
  totalUpdated: number;
  errors: string[];
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
  userEmail: string
): Promise<ImportResult> {
  const batchId = `import_${Date.now()}`;
  const headers = rows[headerRowIndex].map((h: any) => String(h || '').trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  let totalCreated = 0;
  const errors: string[] = [];

  // Group into batches of 400 (Firestore limit is 500 operations per batch)
  const batchSize = 400;
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const chunk = dataRows.slice(i, i + batchSize);
    const firestoreBatch = writeBatch(db);

    chunk.forEach((row, rowIdx) => {
      // Build row data object
      const record: Record<string, any> = {};
      headers.forEach((hdr, colIdx) => {
        const targetField = mapping[hdr];
        if (targetField && targetField !== 'ignore') {
          record[targetField] = String(row[colIdx] || '').trim();
        }
      });

      const fullName = record.fullName;
      if (!fullName) {
        // Skip empty rows
        return;
      }

      const docId = fullName.toLowerCase().replace(/\s+/g, '_') + `_${Date.now()}_${rowIdx}`;
      const kidRef = doc(db, 'churches', churchId, 'kids', docId);

      const kidPayload = {
        active: true,
        importBatchId: batchId,
        info: {
          fullName,
          gender: record.gender?.toLowerCase().includes('بنت') || record.gender?.toLowerCase() === 'female' ? 'female' : 'male',
          dob: record.dob || '',
          school: record.school || '',
          fatherOfConfession: record.fatherOfConfession || '',
        },
        activeAssignment: {
          academicYearId: assignment.academicYearId,
          serviceGroupId: assignment.serviceGroupId,
          classId: assignment.classId,
        },
        address: {
          street: record.street || '',
          building: record.building || '',
          floor: record.floor || '',
          apartment: record.apartment || '',
          region: record.region || '',
        },
        contacts: {
          kidMob: normalizePhoneNumber(record.kidMob),
          fatherName: record.fatherName || '',
          fatherProfession: record.fatherProfession || '',
          fatherMob: normalizePhoneNumber(record.fatherMob),
          motherName: record.motherName || '',
          motherProfession: record.motherProfession || '',
          motherMob: normalizePhoneNumber(record.motherMob),
          otherMob: normalizePhoneNumber(record.otherMob),
        },
        notes: record.notes || '',
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
    totalUpdated: 0,
    errors,
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
