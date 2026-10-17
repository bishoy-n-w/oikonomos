import { useEffect } from 'react';

// Global stack of active modal close handlers
const modalCloseStack: Array<() => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCloseStack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      // Dismiss the top-most active modal
      const dismissTop = modalCloseStack[modalCloseStack.length - 1];
      dismissTop();
    }
  });
}

/**
 * Registers an onClose handler for the Escape key.
 * If multiple nested modals are open, only the top-most modal is dismissed.
 */
export function useModalEscape(onClose?: () => void, isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen || !onClose) return;

    modalCloseStack.push(onClose);
    return () => {
      const idx = modalCloseStack.lastIndexOf(onClose);
      if (idx !== -1) {
        modalCloseStack.splice(idx, 1);
      }
    };
  }, [onClose, isOpen]);
}
