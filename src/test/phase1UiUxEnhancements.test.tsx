import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { useBottomSheetDrag } from '../utils/useBottomSheetDrag';
import { TableSkeleton, CardSkeleton, DashboardSkeleton } from '../components/common/SkeletonLoader';
import { AppProvider } from '../context/AppContext';
import { AuthProvider } from '../context/AuthContext';
import { FilterProvider } from '../context/FilterContext';
import { BreadcrumbFilterBar } from '../components/layout/BreadcrumbFilterBar';

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

  describe('Skeleton Loaders (TableSkeleton, CardSkeleton, DashboardSkeleton)', () => {
    it('renders TableSkeleton with animated pulse container and row shimmers', () => {
      const { container } = render(<TableSkeleton rows={4} />);
      expect(container.querySelector('.animate-pulse')).toBeTruthy();
      expect(container.querySelectorAll('.w-8.h-8').length).toBe(4);
    });

    it('renders CardSkeleton with specified count', () => {
      const { container } = render(<CardSkeleton count={3} />);
      expect(container.querySelectorAll('.w-11.h-11').length).toBe(3);
    });

    it('renders DashboardSkeleton without errors', () => {
      const { container } = render(<DashboardSkeleton />);
      expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  describe('Sub-Header Breadcrumb Filter Bar (BreadcrumbFilterBar)', () => {
    it('renders breadcrumb filter without crashing', () => {
      const handleOpen = vi.fn();
      render(
        <AuthProvider>
          <AppProvider>
            <FilterProvider>
              <BreadcrumbFilterBar onOpenMobileFilters={handleOpen} />
            </FilterProvider>
          </AppProvider>
        </AuthProvider>
      );
      // Renders cleanly
      expect(document.body).toBeTruthy();
    });
  });
});
