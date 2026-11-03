import { describe, it, expect } from 'vitest';
import { buildVCardString, exportKidsToVCard } from '../utils/vcardExport';
import type { Kid } from '../types';

describe('vCard Export Utility', () => {
  const sampleKid: Kid = {
    id: 'kid_123',
    active: true,
    info: {
      fullName: 'Adrian Rami',
      gender: 'male',
      dob: '2014-06-15',
      school: 'St. George Language School',
      schoolType: 'National',
      deacon: true,
      fatherOfConfession: 'Abouna Daoud',
      photoUrl: 'data:image/webp;base64,UklGRu4AAABXRUJQVlA4TCEAAAAvAUAAEB8wAiMw',
    },
    contacts: {
      fatherName: 'Rami Nabil',
      fatherProfession: 'Civil Engineer',
      fatherMob: '01223344556',
      fatherDOB: '1980-04-10',
      motherName: 'Sara Youssef',
      motherProfession: 'Dentist',
      motherMob: '01229988776',
      motherDOB: '1984-09-20',
      kidMob: '01011122233',
      otherMob: '01122233344',
    },
    address: {
      street: '12 Nile Avenue',
      building: '4',
      floor: '3',
      apartment: '5',
      region: 'Heliopolis',
      landmark: 'Near Maryland Park',
      geoLocation: '30.0912, 31.3214',
    },
    notes: 'Very attentive in hymns and liturgy.\nFavorite saint is St. Mina.',
  };

  it('builds a complete vCard 3.0 string with physical embedded photo and Google Contacts alignment', () => {
    const vcard = buildVCardString(sampleKid, 'St. Mark Church', 'Grade 5', '2026-2027');

    // Header & Footer
    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('END:VCARD');

    // Name & Organization
    expect(vcard).toContain('FN:Adrian Rami');
    expect(vcard).toContain('N:;Adrian Rami;;;');
    expect(vcard).toContain('ORG:St. Mark Church;Grade 5 (2026-2027)');
    expect(vcard).toContain('TITLE:Grade 5 (2026-2027)');

    // Normalized Phones with Custom Labels (E.164 Egyptian mobile +20...)
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+201223344556');
    expect(vcard).toContain('X-ABLabel:Father (Rami Nabil - Civil Engineer)');
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+201229988776');
    expect(vcard).toContain('X-ABLabel:Mother (Sara Youssef - Dentist)');
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+201011122233');
    expect(vcard).toContain('X-ABLabel:Mobile');
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+201122233344');
    expect(vcard).toContain('X-ABLabel:Other');

    // Address
    expect(vcard).toContain('ADR;TYPE=HOME:;;12 Nile Avenue, Bldg 4, Flr 3, Apt 5;Heliopolis;;;');

    // Student & Parent Birthdays
    expect(vcard).toContain('BDAY:2014-06-15');
    expect(vcard).toContain('X-ABDATE:1980-04-10');
    expect(vcard).toContain('X-ABLabel:Father Birthday / عيد ميلاد الأب');
    expect(vcard).toContain('X-ABDATE:1984-09-20');
    expect(vcard).toContain('X-ABLabel:Mother Birthday / عيد ميلاد الأم');

    // Relations & Gender
    expect(vcard).toContain('X-ABRELATEDNAMES;TYPE=father:Rami Nabil (Civil Engineer)');
    expect(vcard).toContain('X-ABLabel:_$!<Father>!$_');
    expect(vcard).toContain('X-ABRELATEDNAMES;TYPE=mother:Sara Youssef (Dentist)');
    expect(vcard).toContain('X-ABLabel:_$!<Mother>!$_');
    expect(vcard).toContain('X-GENDER:M');

    // GPS Navigation URL
    expect(vcard).toContain('URL:https://');
    expect(vcard).toContain('X-ABLabel:Home GPS / موقع المنزل');

    // Pastoral Notes (multiline escaped)
    expect(vcard).toContain('NOTE:Pastoral Notes: Very attentive in hymns and liturgy.\\nFavorite saint is St. Mina.');

    // Custom Pastoral Schema
    expect(vcard).toContain('X-FATHER-OF-CONFESSION:Abouna Daoud');
    expect(vcard).toContain('X-SCHOOL:St. George Language School (National)');
    expect(vcard).toContain('X-CHURCH-RANK:Altar Deacon / شماس');

    // Physical Photo (stripped base64 payload)
    expect(vcard).toContain('PHOTO;ENCODING=b;TYPE=WEBP:UklGRu4AAABXRUJQVlA4TCEAAAAvAUAAEB8wAiMw');
  });

  it('builds a valid minimal vCard string when optional fields are absent', () => {
    const minimalKid: Kid = {
      id: 'kid_min',
      active: true,
      info: {
        fullName: 'Mary George',
        gender: 'female',
      },
    };

    const vcard = buildVCardString(minimalKid, 'St. Mary Church', 'Nursery');

    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('FN:Mary George');
    expect(vcard).toContain('ORG:St. Mary Church;Nursery');
    expect(vcard).toContain('X-GENDER:F');
    expect(vcard).not.toContain('PHOTO');
    expect(vcard).not.toContain('TEL');
    expect(vcard).not.toContain('ADR');
    expect(vcard).toContain('END:VCARD');
  });

  it('safely runs exportKidsToVCard in Node test environment without crash', () => {
    expect(() => {
      exportKidsToVCard([sampleKid], 'St. Mark', 'Grade 5', '2026-2027');
    }).not.toThrow();
  });
});
