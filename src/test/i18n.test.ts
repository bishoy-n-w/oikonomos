import { describe, it, expect } from 'vitest';
import { t, isRtl, translations } from '../services/i18n';

describe('i18n translation service', () => {
  it('should return correct English translations', () => {
    expect(t('kids', 'en')).toBe('Kids Directory');
    expect(t('attendance', 'en')).toBe('Attendance Tracker');
    expect(t('sync_contacts', 'en')).toBe('Sync to Google Contacts');
  });

  it('should return correct Arabic translations', () => {
    expect(t('kids', 'ar')).toBe('دليل الأطفال');
    expect(t('attendance', 'ar')).toBe('متابعة الحضور');
    expect(t('sync_contacts', 'ar')).toBe('مزامنة جهات اتصال جوجل');
  });

  it('should fallback to key if translation is missing', () => {
    expect(t('unknown_key_xyz', 'en')).toBe('unknown_key_xyz');
  });

  it('should correctly flag Arabic as RTL and English as LTR', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('should have matching keys between English and Arabic dictionaries', () => {
    const enKeys = Object.keys(translations.en).sort();
    const arKeys = Object.keys(translations.ar).sort();
    expect(enKeys).toEqual(arKeys);
  });
});
