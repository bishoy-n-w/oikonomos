import React, { useState, useRef, useCallback } from 'react';

interface UseBottomSheetDragOptions {
  onClose: () => void;
  threshold?: number;
}

export function useBottomSheetDrag({
  onClose,
  threshold = 100,
}: UseBottomSheetDragOptions) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touchY = e.touches[0].clientY;
    startYRef.current = touchY;
    currentYRef.current = touchY;
    startTimeRef.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === 0) return;
    const touchY = e.touches[0].clientY;
    currentYRef.current = touchY;
    const deltaY = touchY - startYRef.current;
    // Only allow downward dragging
    if (deltaY > 0) {
      setDragY(deltaY);
    } else {
      setDragY(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaY = currentYRef.current - startYRef.current;
    const duration = Date.now() - startTimeRef.current;
    const velocity = duration > 0 ? deltaY / duration : 0;

    // Reset tracking refs
    startYRef.current = 0;
    currentYRef.current = 0;
    setIsDragging(false);

    // Dismiss if pulled past threshold or fast downward flick (velocity > 0.65)
    if (deltaY > threshold || (velocity > 0.65 && deltaY > 40)) {
      setDragY(window.innerHeight || 800);
      setTimeout(() => {
        onClose();
        setDragY(0);
      }, 150);
    } else {
      setDragY(0);
    }
  }, [onClose, threshold]);

  const sheetStyle: React.CSSProperties = {
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: isDragging
      ? 'none'
      : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return {
    dragHandleProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    sheetStyle,
    isDragging,
    dragY,
  };
}
