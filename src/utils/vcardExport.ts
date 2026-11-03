import type { Kid } from '../types';
import { normalizePhoneNumber, parseDateToGoogleDate } from '../services/googleContacts';
import { getUniversalNavigationUrl } from './geo';
import { extractBase64Payload } from './profilePics';

/**
 * Builds a valid vCard 3.0 string for a single kid record,
 * adhering to the exact schema and custom fields used by Oikonomos Google Contacts Sync.
 */
export function buildVCardString(
  kid: Kid,
  churchName: string,
  className: string,
  yearName?: string
): string {
  const lines: string[] = [];

  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');

  const fullName = kid.info?.fullName?.trim() || 'Student';
  lines.push(`FN:${fullName}`);
  lines.push(`N:;${fullName};;;`);

  // Organization & Class / Year
  const orgTitle = yearName ? `${className} (${yearName})` : className;
  lines.push(`ORG:${churchName};${orgTitle}`);
  lines.push(`TITLE:${orgTitle}`);

  // Phone Numbers with Custom Labels (Apple / Google / Android standard itemX.X-ABLabel notation)
  let itemCounter = 1;

  if (kid.contacts?.fatherMob) {
    const rawVal = normalizePhoneNumber(kid.contacts.fatherMob);
    if (rawVal) {
      const fatherLabel = kid.contacts.fatherName
        ? `Father (${kid.contacts.fatherName}${kid.contacts.fatherProfession ? ` - ${kid.contacts.fatherProfession}` : ''})`
        : 'Father';
      lines.push(`item${itemCounter}.TEL;TYPE=CELL,VOICE:${rawVal}`);
      lines.push(`item${itemCounter}.X-ABLabel:${fatherLabel}`);
      itemCounter++;
    }
  }

  if (kid.contacts?.motherMob) {
    const rawVal = normalizePhoneNumber(kid.contacts.motherMob);
    if (rawVal) {
      const motherLabel = kid.contacts.motherName
        ? `Mother (${kid.contacts.motherName}${kid.contacts.motherProfession ? ` - ${kid.contacts.motherProfession}` : ''})`
        : 'Mother';
      lines.push(`item${itemCounter}.TEL;TYPE=CELL,VOICE:${rawVal}`);
      lines.push(`item${itemCounter}.X-ABLabel:${motherLabel}`);
      itemCounter++;
    }
  }

  if (kid.contacts?.kidMob) {
    const rawVal = normalizePhoneNumber(kid.contacts.kidMob);
    if (rawVal) {
      lines.push(`item${itemCounter}.TEL;TYPE=CELL,VOICE:${rawVal}`);
      lines.push(`item${itemCounter}.X-ABLabel:Mobile`);
      itemCounter++;
    }
  }

  if (kid.contacts?.otherMob) {
    const rawVal = normalizePhoneNumber(kid.contacts.otherMob);
    if (rawVal) {
      lines.push(`item${itemCounter}.TEL;TYPE=CELL,VOICE:${rawVal}`);
      lines.push(`item${itemCounter}.X-ABLabel:Other`);
      itemCounter++;
    }
  }

  // Address
  const addressParts = [
    kid.address?.street,
    kid.address?.building ? `Bldg ${kid.address.building}` : '',
    kid.address?.floor ? `Flr ${kid.address.floor}` : '',
    kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
  ].filter(Boolean).join(', ');

  const region = kid.address?.region || '';
  if (addressParts || region) {
    // ADR format: P.O. Box; Extended Addr; Street; City; State/Province; Postal Code; Country
    lines.push(`ADR;TYPE=HOME:;;${addressParts};${region};;;`);
  }

  // Student Birthday
  const studentBday = parseDateToGoogleDate(kid.info?.dob);
  if (studentBday) {
    const y = studentBday.year ? String(studentBday.year) : '2000';
    const m = String(studentBday.month).padStart(2, '0');
    const d = String(studentBday.day).padStart(2, '0');
    lines.push(`BDAY:${y}-${m}-${d}`);
  }

  // Parent Birthdays (Calendar Events)
  const fatherBday = parseDateToGoogleDate(kid.contacts?.fatherDOB);
  if (fatherBday) {
    const y = fatherBday.year ? String(fatherBday.year) : '2000';
    const m = String(fatherBday.month).padStart(2, '0');
    const d = String(fatherBday.day).padStart(2, '0');
    lines.push(`item${itemCounter}.X-ABDATE:${y}-${m}-${d}`);
    lines.push(`item${itemCounter}.X-ABLabel:Father Birthday / عيد ميلاد الأب`);
    itemCounter++;
  }

  const motherBday = parseDateToGoogleDate(kid.contacts?.motherDOB);
  if (motherBday) {
    const y = motherBday.year ? String(motherBday.year) : '2000';
    const m = String(motherBday.month).padStart(2, '0');
    const d = String(motherBday.day).padStart(2, '0');
    lines.push(`item${itemCounter}.X-ABDATE:${y}-${m}-${d}`);
    lines.push(`item${itemCounter}.X-ABLabel:Mother Birthday / عيد ميلاد الأم`);
    itemCounter++;
  }

  // Relations (Father / Mother)
  if (kid.contacts?.fatherName) {
    const fatherDesc = [
      kid.contacts.fatherName,
      kid.contacts.fatherProfession ? `(${kid.contacts.fatherProfession})` : '',
    ].filter(Boolean).join(' ');
    lines.push(`item${itemCounter}.X-ABRELATEDNAMES;TYPE=father:${fatherDesc}`);
    lines.push(`item${itemCounter}.X-ABLabel:_$!<Father>!$_`);
    itemCounter++;
  }

  if (kid.contacts?.motherName) {
    const motherDesc = [
      kid.contacts.motherName,
      kid.contacts.motherProfession ? `(${kid.contacts.motherProfession})` : '',
    ].filter(Boolean).join(' ');
    lines.push(`item${itemCounter}.X-ABRELATEDNAMES;TYPE=mother:${motherDesc}`);
    lines.push(`item${itemCounter}.X-ABLabel:_$!<Mother>!$_`);
    itemCounter++;
  }

  // Gender
  if (kid.info?.gender) {
    const g = kid.info.gender.toLowerCase().startsWith('f') || kid.info.gender.includes('بنت') ? 'F' : 'M';
    lines.push(`X-GENDER:${g}`);
  }

  // GPS Navigation URL
  const navUrl = kid.address?.geoLocation
    ? getUniversalNavigationUrl(kid.address.geoLocation)
    : '';
  if (navUrl) {
    lines.push(`item${itemCounter}.URL:${navUrl}`);
    lines.push(`item${itemCounter}.X-ABLabel:Home GPS / موقع المنزل`);
    itemCounter++;
  }

  // Pastoral Notes
  if (kid.notes && kid.notes.trim()) {
    const safeNotes = kid.notes.trim().replace(/\r?\n/g, '\\n');
    lines.push(`NOTE:Pastoral Notes: ${safeNotes}`);
  }

  // Custom Metadata Fields (Matching Google Contacts userDefined fields)
  if (kid.info?.fatherOfConfession) {
    lines.push(`X-FATHER-OF-CONFESSION:${kid.info.fatherOfConfession}`);
  }
  if (kid.info?.school) {
    const schoolVal = kid.info.schoolType ? `${kid.info.school} (${kid.info.schoolType})` : kid.info.school;
    lines.push(`X-SCHOOL:${schoolVal}`);
  }
  if (kid.info?.deacon) {
    lines.push(`X-CHURCH-RANK:Altar Deacon / شماس`);
  }

  // Physical Photo (Base64 Binary)
  if (kid.info?.photoUrl) {
    const base64Bytes = extractBase64Payload(kid.info.photoUrl);
    if (base64Bytes) {
      const isJpeg = kid.info.photoUrl.includes('image/jpeg');
      const photoType = isJpeg ? 'JPEG' : 'WEBP';
      lines.push(`PHOTO;ENCODING=b;TYPE=${photoType}:${base64Bytes}`);
    }
  }

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * Generates a complete multi-contact vCard (.vcf) file from a list of kids
 * and triggers a browser download.
 */
export function exportKidsToVCard(
  kids: Kid[],
  churchName: string,
  className: string,
  yearName?: string
): void {
  const cards = kids.map((kid) => buildVCardString(kid, churchName, className, yearName));
  const vcfContent = cards.join('\r\n\r\n');

  if (typeof document === 'undefined') return;

  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const safeChurch = churchName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const safeClass = className.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const filename = `Oikonomos_${safeChurch}_${safeClass}.vcf`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
