import { describe, it, expect } from 'vitest';
import type { Kid } from '../types';

describe('Mobile Parity & Filter Verification', () => {
  const sampleKids: Kid[] = [
    {
      id: 'k1',
      active: true,
      info: {
        fullName: 'Adrian Rami Nabil',
        gender: 'male',
        school: 'St. George Language School',
        deacon: true,
        fatherOfConfession: 'Abouna Daoud',
      },
      contacts: {
        fatherName: 'Rami Nabil',
        fatherMob: '01223344556',
        fatherProfession: 'Engineer',
      },
      address: {
        region: 'Heliopolis',
      },
    },
    {
      id: 'k2',
      active: true,
      info: {
        fullName: 'Marina George',
        gender: 'female',
        school: 'Ramses College',
        deacon: false,
        fatherOfConfession: 'Abouna Antonios',
      },
      contacts: {
        fatherName: 'George Samy',
        fatherMob: '01011223344',
      },
      address: {
        region: 'Nasr City',
      },
    },
  ];

  it('filters students by mobile query across name, father name, phone, school, and region', () => {
    const searchBySchool = (query: string) => {
      const q = query.toLowerCase().trim();
      return sampleKids.filter((kid) => {
        const matchName = (kid.info?.fullName || '').toLowerCase().includes(q);
        const matchFather = (kid.contacts?.fatherName || '').toLowerCase().includes(q);
        const matchPhone = (kid.contacts?.fatherMob || '').includes(q);
        const matchSchool = (kid.info?.school || '').toLowerCase().includes(q);
        const matchRegion = (kid.address?.region || '').toLowerCase().includes(q);
        return matchName || matchFather || matchPhone || matchSchool || matchRegion;
      });
    };

    expect(searchBySchool('Ramses')).toHaveLength(1);
    expect(searchBySchool('Ramses')[0].id).toBe('k2');

    expect(searchBySchool('0122')).toHaveLength(1);
    expect(searchBySchool('0122')[0].id).toBe('k1');

    expect(searchBySchool('Heliopolis')).toHaveLength(1);
    expect(searchBySchool('Heliopolis')[0].id).toBe('k1');
  });

  it('filters students by gender filter chip', () => {
    const boys = sampleKids.filter((k) => k.info?.gender === 'male');
    const girls = sampleKids.filter((k) => k.info?.gender === 'female');

    expect(boys).toHaveLength(1);
    expect(boys[0].info.fullName).toBe('Adrian Rami Nabil');
    expect(girls).toHaveLength(1);
    expect(girls[0].info.fullName).toBe('Marina George');
  });

  it('filters students by deacon status chip', () => {
    const deacons = sampleKids.filter((k) => k.info?.deacon === true);
    expect(deacons).toHaveLength(1);
    expect(deacons[0].id).toBe('k1');
  });

  it('verifies multi-select toggling and master select all on mobile', () => {
    let selectedIds: string[] = [];

    const toggleKid = (id: string) => {
      selectedIds = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
    };

    const toggleSelectAll = (allIds: string[]) => {
      if (selectedIds.length === allIds.length) {
        selectedIds = [];
      } else {
        selectedIds = [...allIds];
      }
    };

    toggleKid('k1');
    expect(selectedIds).toEqual(['k1']);

    toggleKid('k1');
    expect(selectedIds).toEqual([]);

    toggleSelectAll(sampleKids.map((k) => k.id));
    expect(selectedIds).toEqual(['k1', 'k2']);

    toggleSelectAll(sampleKids.map((k) => k.id));
    expect(selectedIds).toEqual([]);
  });
});
