import { describe, it, expect, vi } from 'vitest';
import { buildKidQrPayload, parseKidQrPayload, generateQrDataUrl } from '../utils/qrCode';
import { playSuccessChime, playNeutralTone, playWarningTone } from '../utils/audioChime';

describe('QR Code & Attendance Utilities', () => {
  describe('QR Payload Builder & Parser', () => {
    it('builds compact URI scheme with encoded IDs', () => {
      const payload = buildKidQrPayload('st_mark', 'kid_123');
      expect(payload).toBe('oik://k/st_mark/kid_123');
    });

    it('correctly handles spaces and non-ASCII church and kid IDs in payload', () => {
      const payload = buildKidQrPayload('كنيسة مارمرقس', 'kid_رامي');
      expect(payload).toContain('oik://k/');
      
      const parsed = parseKidQrPayload(payload);
      expect(parsed?.churchId).toBe('كنيسة مارمرقس');
      expect(parsed?.kidId).toBe('kid_رامي');
    });

    it('parses standard oik:// URI format correctly', () => {
      const parsed = parseKidQrPayload('oik://k/st_george/student_99');
      expect(parsed).toEqual({
        churchId: 'st_george',
        kidId: 'student_99',
      });
    });

    it('gracefully parses fallback direct kid ID without oik:// prefix', () => {
      const parsed = parseKidQrPayload('kid_abc_555');
      expect(parsed).toEqual({
        kidId: 'kid_abc_555',
      });
    });

    it('returns null for empty or invalid inputs', () => {
      expect(parseKidQrPayload('')).toBeNull();
      expect(parseKidQrPayload('   ')).toBeNull();
    });

    it('generates high-contrast data URL image from text payload', async () => {
      const url = await generateQrDataUrl('oik://k/c1/k1');
      expect(url).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('Audio Chime Synthesizer', () => {
    it('executes audio chimes without throwing even in test / mock DOM environment', () => {
      expect(() => playSuccessChime()).not.toThrow();
      expect(() => playNeutralTone()).not.toThrow();
      expect(() => playWarningTone()).not.toThrow();
    });

    it('handles simulated AudioContext oscillators safely', () => {
      const mockOscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      const mockCtx = {
        currentTime: 0,
        createOscillator: vi.fn(() => mockOscillator),
        createGain: vi.fn(() => mockGain),
        destination: {},
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
      };

      (window as any).AudioContext = vi.fn().mockImplementation(function() {
        return mockCtx;
      });

      playSuccessChime();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();

      playNeutralTone();
      expect(mockCtx.createOscillator).toHaveBeenCalled();

      playWarningTone();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });
  });
});
