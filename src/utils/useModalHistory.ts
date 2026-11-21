import { useEffect, useRef } from 'react';

/**
 * Synchronizes a modal with the browser / device Back button.
 * Dismisses the modal when Back is pressed without navigating away from the web app.
 */
export function useModalHistory(id: string, isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const isPushedRef = useRef(false);
  const closedByPopStateRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      if (isPushedRef.current && !closedByPopStateRef.current) {
        isPushedRef.current = false;
        if (typeof window !== 'undefined' && window.history.state?.modalId === id) {
          window.history.back();
        }
      }
      return;
    }

    if (typeof window === 'undefined') return;

    // Push history entry for this active modal only once
    if (!isPushedRef.current) {
      window.history.pushState({ modalId: id }, '');
      isPushedRef.current = true;
      closedByPopStateRef.current = false;
    }

    const handlePopState = () => {
      if (isPushedRef.current) {
        closedByPopStateRef.current = true;
        isPushedRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // NOTE: Do NOT call window.history.back() here during unmount to prevent
      // React StrictMode or re-renders from prematurely closing the modal!
    };
  }, [id, isOpen]);
}
