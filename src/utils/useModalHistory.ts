import { useEffect, useRef } from 'react';

/**
 * Synchronizes a modal with the browser / device Back button.
 * When the modal is open, pressing the device back button (or browser back)
 * dismisses the modal instead of navigating away from the web app.
 */
export function useModalHistory(id: string, isOpen: boolean, onClose: () => void) {
  const isPushedRef = useRef(false);
  const isClosingFromPopStateRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false;
        if (typeof window !== 'undefined' && window.history.state?.modalId === id) {
          window.history.back();
        }
      }
      return;
    }

    if (typeof window === 'undefined') return;

    // Push history entry for this active modal
    window.history.pushState({ modalId: id }, '');
    isPushedRef.current = true;
    isClosingFromPopStateRef.current = false;

    const handlePopState = () => {
      // User pressed back button
      isClosingFromPopStateRef.current = true;
      isPushedRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false;
        if (typeof window !== 'undefined' && window.history.state?.modalId === id) {
          window.history.back();
        }
      }
    };
  }, [id, isOpen, onClose]);
}
