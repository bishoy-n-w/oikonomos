import { describe, it, expect, vi } from 'vitest';
import { normalizeDateStr, safeRender, sanitizeExcelCell } from '../utils/formatters';
import { useModalEscape } from '../utils/useModalEscape';
import { renderHook } from '@testing-library/react';

describe('Formatters, Security & Modal Escape LIFO Stack', () => {
  describe('OWASP A03 Formula Injection Defense (sanitizeExcelCell)', () => {
    it('prepends an apostrophe to values starting with "="', () => {
      expect(sanitizeExcelCell('=1+1')).toBe("'=1+1");
      expect(sanitizeExcelCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(sanitizeExcelCell(' =SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    });

    it('prepends an apostrophe to values starting with "+", "-", "@"', () => {
      expect(sanitizeExcelCell('+20123456789')).toBe("'+20123456789");
      expect(sanitizeExcelCell('-15')).toBe("'-15");
      expect(sanitizeExcelCell('@special')).toBe("'@special");
    });

    it('prepends an apostrophe to values starting with tab (\\t) or carriage return (\\r)', () => {
      expect(sanitizeExcelCell('\tDDE')).toBe("'\tDDE");
      expect(sanitizeExcelCell('\rALERT')).toBe("'\rALERT");
    });

    it('leaves standard benign text and numbers intact', () => {
      expect(sanitizeExcelCell('Mina Girgis')).toBe('Mina Girgis');
      expect(sanitizeExcelCell('Grade 4 St. George')).toBe('Grade 4 St. George');
      expect(sanitizeExcelCell(2026)).toBe('2026');
      expect(sanitizeExcelCell('Cairo, Egypt')).toBe('Cairo, Egypt');
    });

    it('returns empty string for null, undefined, or empty values', () => {
      expect(sanitizeExcelCell(null)).toBe('');
      expect(sanitizeExcelCell(undefined)).toBe('');
      expect(sanitizeExcelCell('')).toBe('');
      expect(sanitizeExcelCell('   ')).toBe('');
    });
  });

  describe('Date String Normalization (normalizeDateStr)', () => {
    it('returns strict YYYY-MM-DD for native Date objects', () => {
      const d = new Date(Date.UTC(2026, 9, 28));
      expect(normalizeDateStr(d)).toBe('2026-10-28');
    });

    it('normalizes Firestore Timestamp objects with .toDate() method', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-05-15T00:00:00.000Z'),
      };
      expect(normalizeDateStr(mockTimestamp)).toBe('2026-05-15');
    });

    it('normalizes Firestore Timestamp objects with seconds and nanoseconds', () => {
      // 1761400000 seconds = 2025-10-25
      const mockTimestamp = {
        seconds: 1761400000,
        nanoseconds: 0,
      };
      const result = normalizeDateStr(mockTimestamp);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('passes through already-valid YYYY-MM-DD strings', () => {
      expect(normalizeDateStr('2026-10-18')).toBe('2026-10-18');
      expect(normalizeDateStr('  2024-01-01  ')).toBe('2024-01-01');
    });

    it('parses valid date strings into YYYY-MM-DD', () => {
      expect(normalizeDateStr('10/28/2026')).toBe('2026-10-28');
    });

    it('returns empty string for invalid, null, or empty values', () => {
      expect(normalizeDateStr(null)).toBe('');
      expect(normalizeDateStr(undefined)).toBe('');
      expect(normalizeDateStr('')).toBe('');
      expect(normalizeDateStr(new Date('invalid-date'))).toBe('');
    });
  });

  describe('Safe Render Utility (safeRender)', () => {
    it('returns fallback string for null, undefined, or empty inputs', () => {
      expect(safeRender(null)).toBe('-');
      expect(safeRender(undefined)).toBe('-');
      expect(safeRender('', 'N/A')).toBe('N/A');
    });

    it('returns string representations of numbers and booleans', () => {
      expect(safeRender(100)).toBe('100');
      expect(safeRender(true)).toBe('true');
      expect(safeRender(false)).toBe('false');
    });

    it('safely renders Firestore Timestamp objects as formatted dates', () => {
      const mockTimestamp = {
        seconds: 1761400000,
        nanoseconds: 0,
      };
      const rendered = safeRender(mockTimestamp);
      expect(rendered).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('LIFO Modal Escape Dismissal Stack (useModalEscape)', () => {
    it('dismisses only the top-most modal when Escape key is pressed', () => {
      const parentClose = vi.fn();
      const childClose = vi.fn();

      // Render parent modal
      const { unmount: unmountParent } = renderHook(() => useModalEscape(parentClose, true));

      // Render nested child modal
      const { unmount: unmountChild } = renderHook(() => useModalEscape(childClose, true));

      // Simulate Escape key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Only childClose should have been called
      expect(childClose).toHaveBeenCalledTimes(1);
      expect(parentClose).not.toHaveBeenCalled();

      // Unmount child modal
      unmountChild();

      // Simulate second Escape key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Now parentClose should have been called
      expect(parentClose).toHaveBeenCalledTimes(1);

      unmountParent();
    });

    it('does not register close handler if isOpen is false', () => {
      const onClose = vi.fn();
      renderHook(() => useModalEscape(onClose, false));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
