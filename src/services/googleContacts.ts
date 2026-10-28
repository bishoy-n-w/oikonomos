import type { Kid } from '../types';
import { getGoogleAccessToken, requestContactsPermission } from './auth';
import { getUniversalNavigationUrl } from '../utils/geo';

export interface SyncResult {
  success: boolean;
  totalSynced: number;
  groupName: string;
  error?: string;
}

/**
 * Normalizes phone numbers to standard E.164-compatible strings.
 * Safely accepts string, number (e.g. from Excel numeric cells), or null/undefined.
 */
export function normalizePhoneNumber(phone?: string | number | null, defaultCountryCode: string = '+20'): string {
  if (phone === undefined || phone === null) return '';
  const phoneStr = String(phone).trim();
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  if (!cleaned.startsWith('+')) {
    const rawCode = defaultCountryCode.replace(/[^\d]/g, '');
    if (rawCode && cleaned.startsWith(rawCode) && cleaned.length > rawCode.length + 8) {
      cleaned = '+' + cleaned;
    } else {
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      cleaned = defaultCountryCode + cleaned;
    }
  }
  return cleaned;
}

/**
 * Parses diverse date formats (YYYY-MM-DD, DD/MM/YYYY, etc.) into a Google People API Date object.
 */
export function parseDateToGoogleDate(dateStr?: string | null): { year?: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/.]/).map(Number);
    y = parts[0];
    m = parts[1];
    d = parts[2];
  } else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/.]/).map(Number);
    d = parts[0];
    m = parts[1];
    y = parts[2];
  }

  if (m && d && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
    return {
      year: y && y > 1900 ? y : undefined,
      month: m,
      day: d,
    };
  }
  return null;
}

/**
 * Transforms a Kid document into a rich Google People API Person resource.
 */
export function transformKidToGooglePerson(
  kid: Kid,
  churchName: string,
  className: string,
  yearName?: string
): any {
  const phoneNumbers: Array<{ value: string; type: string }> = [];

  if (kid.contacts?.fatherMob) {
    const fatherLabel = kid.contacts.fatherName
      ? `Father (${kid.contacts.fatherName}${kid.contacts.fatherProfession ? ` - ${kid.contacts.fatherProfession}` : ''})`
      : 'Father';
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.fatherMob),
      type: fatherLabel,
    });
  }

  if (kid.contacts?.motherMob) {
    const motherLabel = kid.contacts.motherName
      ? `Mother (${kid.contacts.motherName}${kid.contacts.motherProfession ? ` - ${kid.contacts.motherProfession}` : ''})`
      : 'Mother';
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.motherMob),
      type: motherLabel,
    });
  }

  if (kid.contacts?.kidMob) {
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.kidMob),
      type: 'Mobile',
    });
  }

  if (kid.contacts?.otherMob) {
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.otherMob),
      type: 'Other',
    });
  }

  const navUrl = kid.address?.geoLocation
    ? getUniversalNavigationUrl(kid.address.geoLocation)
    : '';

  const addressText = [
    kid.address?.street,
    kid.address?.building ? `Bldg ${kid.address.building}` : '',
    kid.address?.floor ? `Flr ${kid.address.floor}` : '',
    kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
    kid.address?.region,
    kid.address?.landmark ? `(Near: ${kid.address.landmark})` : '',
  ].filter(Boolean).join(', ');

  const studentName = kid.info?.fullName || 'Student';

  // 1. Native Student Birthday (creates automatic birthday notifications on phone/calendar)
  const birthdays: Array<{ date: { year?: number; month?: number; day?: number } }> = [];
  const studentBday = parseDateToGoogleDate(kid.info?.dob);
  if (studentBday) {
    birthdays.push({ date: studentBday });
  }

  // 2. Standalone Parent Birthdays (native Google Calendar events)
  const events: Array<{ type: string; formattedType?: string; date: { year?: number; month?: number; day?: number } }> = [];
  const fatherBday = parseDateToGoogleDate(kid.contacts?.fatherDOB);
  if (fatherBday) {
    events.push({
      type: 'other',
      formattedType: 'Father Birthday / عيد ميلاد الأب',
      date: fatherBday,
    });
  }
  const motherBday = parseDateToGoogleDate(kid.contacts?.motherDOB);
  if (motherBday) {
    events.push({
      type: 'other',
      formattedType: 'Mother Birthday / عيد ميلاد الأم',
      date: motherBday,
    });
  }

  // 3. Native Relations (Father and Mother linked contacts)
  const relations: Array<{ person: string; type: string }> = [];
  if (kid.contacts?.fatherName) {
    const fatherDesc = [
      kid.contacts.fatherName,
      kid.contacts.fatherProfession ? `(${kid.contacts.fatherProfession})` : '',
    ].filter(Boolean).join(' ');
    relations.push({
      person: fatherDesc,
      type: 'father',
    });
  }

  if (kid.contacts?.motherName) {
    const motherDesc = [
      kid.contacts.motherName,
      kid.contacts.motherProfession ? `(${kid.contacts.motherProfession})` : '',
    ].filter(Boolean).join(' ');
    relations.push({
      person: motherDesc,
      type: 'mother',
    });
  }

  // 4. Native Genders
  const genders: Array<{ value: string }> = [];
  if (kid.info?.gender) {
    genders.push({ value: kid.info.gender });
  }

  // 5. Standalone 1-Tap Home Navigation URL
  const urls: Array<{ value: string; type: string; formattedType?: string }> = [];
  if (navUrl) {
    urls.push({
      value: navUrl,
      type: 'other',
      formattedType: 'Home GPS / موقع المنزل',
    });
  }

  // 6. Standalone Custom Fields (first-class dedicated attributes on contact card)
  const userDefined: Array<{ key: string; value: string }> = [];
  if (kid.info?.fatherOfConfession) {
    userDefined.push({ key: 'Father of Confession / أب الاعتراف', value: kid.info.fatherOfConfession });
  }
  if (kid.info?.school) {
    const schoolVal = kid.info.schoolType ? `${kid.info.school} (${kid.info.schoolType})` : kid.info.school;
    userDefined.push({ key: 'School / المدرسة', value: schoolVal });
  }
  if (kid.info?.deacon) {
    userDefined.push({ key: 'Church Rank / الرتبة الكنسية', value: 'Altar Deacon / شماس' });
  }
  if (kid.contacts?.fatherProfession) {
    userDefined.push({ key: 'Father Profession / وظيفة الأب', value: kid.contacts.fatherProfession });
  }
  if (kid.contacts?.motherProfession) {
    userDefined.push({ key: 'Mother Profession / وظيفة الأم', value: kid.contacts.motherProfession });
  }
  if (yearName) {
    userDefined.push({ key: 'Academic Term / السنة الدراسية', value: yearName });
  }

  // 7. Clean Pastoral Remarks (Notes only contains actual remarks without redundant repeated metadata)
  const biographies: Array<{ value: string; contentType: string }> = [];
  if (kid.notes && kid.notes.trim()) {
    biographies.push({
      value: `Pastoral Notes: ${kid.notes.trim()}`,
      contentType: 'TEXT_PLAIN',
    });
  }

  return {
    names: [
      {
        givenName: studentName,
        familyName: '',
      },
    ],
    organizations: [
      {
        name: churchName,
        title: yearName ? `${className} (${yearName})` : className,
      },
    ],
    biographies: biographies.length > 0 ? biographies : undefined,
    addresses: addressText ? [
      {
        type: 'home',
        formattedValue: addressText,
        streetAddress: [
          kid.address?.street,
          kid.address?.building ? `Bldg ${kid.address.building}` : '',
          kid.address?.floor ? `Flr ${kid.address.floor}` : '',
          kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
        ].filter(Boolean).join(', ') || undefined,
        city: kid.address?.region || undefined,
      }
    ] : undefined,
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    birthdays: birthdays.length > 0 ? birthdays : undefined,
    events: events.length > 0 ? events : undefined,
    relations: relations.length > 0 ? relations : undefined,
    genders: genders.length > 0 ? genders : undefined,
    urls: urls.length > 0 ? urls : undefined,
    userDefined: userDefined.length > 0 ? userDefined : undefined,
  };
}

/**
 * Syncs a list of kids to the authenticated user's Google Contacts via the People API.
 */
export async function syncKidsToGoogleContacts(
  kids: Kid[],
  churchName: string,
  className: string,
  yearName: string
): Promise<SyncResult> {
  let accessToken = getGoogleAccessToken();
  if (!accessToken) {
    accessToken = await requestContactsPermission();
  }

  if (!accessToken) {
    return {
      success: false,
      totalSynced: 0,
      groupName: '',
      error: 'Google Contacts permission was not granted.',
    };
  }

  const groupTitle = `[Oikonomos] ${churchName} - ${className} (${yearName})`;

  try {
    // 1. Find or create Contact Group in Google People API
    let contactGroupResourceName: string | undefined;

    const groupListRes = await fetch(
      'https://people.googleapis.com/v1/contactGroups?groupFields=name,memberCount',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (groupListRes.ok) {
      const groupListData = await groupListRes.json();
      const existingGroup = (groupListData.contactGroups || []).find(
        (g: any) => g.name === groupTitle || g.formattedName === groupTitle
      );
      if (existingGroup) {
        contactGroupResourceName = existingGroup.resourceName;
      }
    }

    if (!contactGroupResourceName) {
      const createGroupRes = await fetch(
        'https://people.googleapis.com/v1/contactGroups',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contactGroup: { name: groupTitle },
          }),
        }
      );

      if (createGroupRes.ok) {
        const newGroup = await createGroupRes.json();
        contactGroupResourceName = newGroup.resourceName;
      }
    }

    // 2. Batch create/update contacts
    let successCount = 0;
    const batchSize = 10;
    for (let i = 0; i < kids.length; i += batchSize) {
      const slice = kids.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (kid) => {
          const personPayload = transformKidToGooglePerson(kid, churchName, className, yearName);
          if (contactGroupResourceName) {
            personPayload.memberships = [
              {
                contactGroupMembership: {
                  contactGroupResourceName,
                },
              },
            ];
          }

          const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(personPayload),
          });

          if (res.ok) {
            successCount++;
            // If student has a profile picture, sync photo to Google Contact
            if (kid.info?.photoUrl) {
              try {
                const createdPerson = await res.json();
                const photoBytes = kid.info.photoUrl.includes(',')
                  ? kid.info.photoUrl.split(',')[1]
                  : kid.info.photoUrl;

                if (createdPerson.resourceName && photoBytes) {
                  await fetch(
                    `https://people.googleapis.com/v1/${createdPerson.resourceName}:updateContactPhoto`,
                    {
                      method: 'PATCH',
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ photoBytes }),
                    }
                  );
                }
              } catch {
                // Non-fatal if photo sync fails
              }
            }
          } else if (res.status === 401 || res.status === 403) {
            throw new Error('Google Contacts authorization expired. Please reconnect Google Contacts.');
          }
        })
      );
    }

    return {
      success: true,
      totalSynced: successCount,
      groupName: groupTitle,
    };
  } catch (err: any) {
    console.error('Error syncing contacts to Google People API:', err);
    return {
      success: false,
      totalSynced: 0,
      groupName: groupTitle,
      error: err.message || 'Unknown network error occurred while syncing contacts.',
    };
  }
}
