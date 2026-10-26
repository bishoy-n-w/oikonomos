import { describe, it, expect } from 'vitest';
import {
  parseGeoCoordinates,
  formatGeoUri,
  normalizeGeoInput,
  getUniversalNavigationUrl,
  isValidLatLng,
} from '../utils/geo';

describe('GeoLocation Utilities & Link Parsing', () => {
  describe('parseGeoCoordinates', () => {
    it('parses standard Geo URI scheme', () => {
      const res = parseGeoCoordinates('geo:30.0444,31.2357');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(30.0444);
      expect(res?.lng).toBeCloseTo(31.2357);
    });

    it('parses raw coordinate string with or without space', () => {
      const res1 = parseGeoCoordinates('30.0444, 31.2357');
      expect(res1?.lat).toBeCloseTo(30.0444);
      expect(res1?.lng).toBeCloseTo(31.2357);

      const res2 = parseGeoCoordinates('30.0444,31.2357');
      expect(res2?.lat).toBeCloseTo(30.0444);
      expect(res2?.lng).toBeCloseTo(31.2357);
    });

    it('parses WhatsApp shared location pin links', () => {
      const res = parseGeoCoordinates('https://maps.google.com/maps?q=loc:30.0444,31.2357');
      expect(res?.lat).toBeCloseTo(30.0444);
      expect(res?.lng).toBeCloseTo(31.2357);
    });

    it('parses Google Maps web query links', () => {
      const res = parseGeoCoordinates('https://www.google.com/maps?q=30.0444,31.2357');
      expect(res?.lat).toBeCloseTo(30.0444);
      expect(res?.lng).toBeCloseTo(31.2357);
    });

    it('parses Google Maps search API links', () => {
      const res = parseGeoCoordinates('https://www.google.com/maps/search/?api=1&query=30.0444,31.2357');
      expect(res?.lat).toBeCloseTo(30.0444);
      expect(res?.lng).toBeCloseTo(31.2357);
    });

    it('parses Google Maps path URLs with @lat,lng', () => {
      const res = parseGeoCoordinates('https://www.google.com/maps/place/Cairo/@30.0444,31.2357,17z');
      expect(res?.lat).toBeCloseTo(30.0444);
      expect(res?.lng).toBeCloseTo(31.2357);
    });

    it('parses Google Maps desktop share links with !3dlat!4dlng data', () => {
      const res = parseGeoCoordinates('https://www.google.com/maps/place/Church/data=!3m1!4b1!4m6!3m5!8m2!3d30.04441!4d31.23572');
      expect(res?.lat).toBeCloseTo(30.04441);
      expect(res?.lng).toBeCloseTo(31.23572);
    });

    it('parses Apple Maps query and ll links', () => {
      const res1 = parseGeoCoordinates('https://maps.apple.com/?q=30.0444,31.2357');
      expect(res1?.lat).toBeCloseTo(30.0444);
      expect(res1?.lng).toBeCloseTo(31.2357);

      const res2 = parseGeoCoordinates('https://maps.apple.com/?ll=30.0444,31.2357');
      expect(res2?.lat).toBeCloseTo(30.0444);
      expect(res2?.lng).toBeCloseTo(31.2357);
    });

    it('returns null for invalid strings or out-of-range coords', () => {
      expect(parseGeoCoordinates('')).toBeNull();
      expect(parseGeoCoordinates('random text without coords')).toBeNull();
      expect(parseGeoCoordinates('95.0000, 200.0000')).toBeNull(); // invalid lat/lng
    });
  });

  describe('formatGeoUri', () => {
    it('formats coordinates to 6 decimal places with geo: prefix', () => {
      expect(formatGeoUri(30.0444, 31.2357)).toBe('geo:30.044400,31.235700');
    });
  });

  describe('normalizeGeoInput', () => {
    it('normalizes raw coordinates or URLs into standard geo: URI', () => {
      expect(normalizeGeoInput('30.0444, 31.2357')).toBe('geo:30.044400,31.235700');
      expect(normalizeGeoInput('https://maps.google.com/?q=30.0444,31.2357')).toBe('geo:30.044400,31.235700');
    });

    it('preserves short links without coordinates', () => {
      const shortUrl = 'https://maps.app.goo.gl/xyz123';
      expect(normalizeGeoInput(shortUrl)).toBe(shortUrl);
    });

    it('handles empty input', () => {
      expect(normalizeGeoInput('')).toBe('');
      expect(normalizeGeoInput(undefined)).toBe('');
    });
  });

  describe('getUniversalNavigationUrl', () => {
    it('generates turn-by-turn navigation URL for valid coordinates', () => {
      const navUrl = getUniversalNavigationUrl('geo:30.0444,31.2357');
      expect(navUrl).toContain('30.0444');
      expect(navUrl).toContain('31.2357');
    });

    it('falls back to address query when no coordinates are present', () => {
      const navUrl = getUniversalNavigationUrl('', '10 Baghdad St, Heliopolis');
      expect(navUrl).toContain('https://www.google.com/maps/search/?api=1&query=');
      expect(navUrl).toContain('Heliopolis');
    });
  });

  describe('isValidLatLng', () => {
    it('validates boundaries correctly', () => {
      expect(isValidLatLng(30.0, 31.0)).toBe(true);
      expect(isValidLatLng(-90, -180)).toBe(true);
      expect(isValidLatLng(90, 180)).toBe(true);
      expect(isValidLatLng(91, 0)).toBe(false);
      expect(isValidLatLng(0, 181)).toBe(false);
    });
  });
});
