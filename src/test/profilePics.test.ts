import { describe, it, expect } from 'vitest';
import { getInitials, extractBase64Payload, compressProfileImage } from '../utils/profilePics';
import { TARGET_FIELDS, autoMapHeadersHeuristically } from '../services/smartImport';

describe('Profile Picture Utilities & Integration Tests', () => {
  describe('getInitials', () => {
    it('extracts two characters for single word names', () => {
      expect(getInitials('Bishoy')).toBe('BI');
      expect(getInitials('Mark')).toBe('MA');
    });

    it('extracts first and last initials for multi-word names', () => {
      expect(getInitials('Bishoy Wasef')).toBe('BW');
      expect(getInitials('Mark Amir Youssef')).toBe('MY');
      expect(getInitials('كيرلس مينا')).toBe('كم');
    });

    it('returns question mark fallback when name is empty or undefined', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials(undefined)).toBe('?');
      expect(getInitials('   ')).toBe('?');
    });
  });

  describe('extractBase64Payload', () => {
    it('extracts raw base64 payload from data URLs for Google People API photo sync', () => {
      const dataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//739//g';
      expect(extractBase64Payload(dataUrl)).toBe('UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//739//g');
    });

    it('returns empty string when data URL is invalid or missing', () => {
      expect(extractBase64Payload('')).toBe('');
      expect(extractBase64Payload(undefined)).toBe('');
      expect(extractBase64Payload('not-a-data-url')).toBe('');
    });
  });

  describe('compressProfileImage', () => {
    it('returns string input gracefully in node environments', async () => {
      const result = await compressProfileImage('https://example.com/avatar.jpg');
      expect(result).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Smart Import photoUrl Integration', () => {
    it('includes photoUrl in TARGET_FIELDS schema', () => {
      const photoField = TARGET_FIELDS.find((f) => f.key === 'photoUrl');
      expect(photoField).toBeDefined();
      expect(photoField?.category).toBe('profile');
    });

    it('heuristically maps photo headers in English and Arabic', () => {
      const headers = ['Photo URL', 'Avatar', 'صورة الطالب', 'رابط الصورة'];
      const mapped = autoMapHeadersHeuristically(headers);

      expect(mapped['Photo URL']).toBe('photoUrl');
      expect(mapped['Avatar']).toBe('photoUrl');
      expect(mapped['صورة الطالب']).toBe('photoUrl');
      expect(mapped['رابط الصورة']).toBe('photoUrl');
    });
  });
});
