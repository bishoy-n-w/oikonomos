import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBottomSheetDrag } from '../utils/useBottomSheetDrag';

describe('Phase 1 UI/UX Enhancements Suite', () => {
  describe('Mobile Bottom-Sheet Drag Physics (useBottomSheetDrag)', () => {
    it('initializes with zero drag offset and not dragging', () => {
      const handleClose = vi.fn();
      const { result } = renderHook(() =>
        useBottomSheetDrag({ onClose: handleClose, threshold: 100 })
      );

      expect(result.current.dragY).toBe(0);
      expect(result.current.isDragging).toBe(false);
      expect(result.current.sheetStyle.transform).toBeUndefined();
    });

    it('tracks touch downward movement and applies translateY transform', () => {
      const handleClose = vi.fn();
      const { result } = renderHook(() =>
        useBottomSheetDrag({ onClose: handleClose, threshold: 100 })
      );

      // Touch start at Y=200
      act(() => {
        result.current.dragHandleProps.onTouchStart({
          touches: [{ clientY: 200 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // Drag downward to Y=260 (delta = 60px)
      act(() => {
        result.current.dragHandleProps.onTouchMove({
          touches: [{ clientY: 260 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      expect(result.current.dragY).toBe(60);
      expect(result.current.sheetStyle.transform).toBe('translateY(60px)');
    });

    it('resets drag when released below threshold without calling onClose', () => {
      const handleClose = vi.fn();
      const { result } = renderHook(() =>
        useBottomSheetDrag({ onClose: handleClose, threshold: 100 })
      );

      // Touch start at Y=200
      act(() => {
        result.current.dragHandleProps.onTouchStart({
          touches: [{ clientY: 200 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      // Move by 30px (below 100px threshold)
      act(() => {
        result.current.dragHandleProps.onTouchMove({
          touches: [{ clientY: 230 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      // Release
      act(() => {
        result.current.dragHandleProps.onTouchEnd();
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.dragY).toBe(0);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('triggers onClose when dragged past threshold', async () => {
      vi.useFakeTimers();
      const handleClose = vi.fn();
      const { result } = renderHook(() =>
        useBottomSheetDrag({ onClose: handleClose, threshold: 80 })
      );

      // Touch start at Y=100
      act(() => {
        result.current.dragHandleProps.onTouchStart({
          touches: [{ clientY: 100 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      // Drag by 150px (exceeds 80px threshold)
      act(() => {
        result.current.dragHandleProps.onTouchMove({
          touches: [{ clientY: 250 } as React.Touch],
        } as unknown as React.TouchEvent);
      });

      // Release
      act(() => {
        result.current.dragHandleProps.onTouchEnd();
      });

      // Advance timers for animation timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
