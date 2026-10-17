import type { Kid } from '../types';
import { getGoogleAccessToken, requestContactsPermission } from './auth';

export interface SyncResult {
  success: boolean;
  totalSynced: number;
  groupName: string;
  error?: string;
}

/**
 * Normalizes phone numbers to standard E.164-compatible strings.
 */
export function normalizePhoneNumber(phone?: string, defaultCountryCode: string = '+20'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '').trim();
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode + cleaned;
  }
  return cleaned;
}

/**
 * Transforms a Kid document into a Google People API Person resource.
 */
export function transformKidToGooglePerson(kid: Kid, churchName: string, className: string): any {
  const phoneNumbers: Array<{ value: string; type: string }> = [];

  if (kid.contacts?.fatherMob) {
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.fatherMob),
      type: kid.contacts.fatherName ? `Father (${kid.contacts.fatherName})` : 'Father',
    });
  }

  if (kid.contacts?.motherMob) {
    phoneNumbers.push({
      value: normalizePhoneNumber(kid.contacts.motherMob),
      type: kid.contacts.motherName ? `Mother (${kid.contacts.motherName})` : 'Mother',
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

  return {
    names: [
      {
        givenName: `[SS] ${kid.info.fullName}`,
        familyName: '',
      },
    ],
    organizations: [
      {
        name: churchName,
        title: `Sunday School - ${className}`,
      },
    ],
    biographies: [
      {
        value: `Sunday School Student - ${kid.info.fullName}. Father: ${kid.contacts?.fatherName || 'N/A'}, Mother: ${kid.contacts?.motherName || 'N/A'}. Address: ${kid.address?.region || ''}`,
        contentType: 'TEXT_PLAIN',
      },
    ],
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
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
          const personPayload = transformKidToGooglePerson(kid, churchName, className);
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
