import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaInstallPromptModal } from '../components/common/PwaInstallPromptModal';
import { AppProvider } from '../context/AppContext';

describe('Progressive Web App (PWA) Mobile Installation Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('PwaInstallPromptModal', () => {
    it('renders app branding and feature highlights (Full Screen, Instant Load, Offline)', () => {
      render(
        <AppProvider>
          <PwaInstallPromptModal
            isOpen={true}
            onClose={vi.fn()}
            hasDeferredPrompt={true}
            isIos={false}
            onTriggerInstall={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText('Oikonomos')).toBeTruthy();
      expect(screen.getByText('Full Screen')).toBeTruthy();
      expect(screen.getByText('Instant Load')).toBeTruthy();
      expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('renders "Install Now" button when hasDeferredPrompt is true (Android / Chrome)', () => {
      const handleTrigger = vi.fn().mockResolvedValue(true);
      const handleClose = vi.fn();

      render(
        <AppProvider>
          <PwaInstallPromptModal
            isOpen={true}
            onClose={handleClose}
            hasDeferredPrompt={true}
            isIos={false}
            onTriggerInstall={handleTrigger}
          />
        </AppProvider>
      );

      const installBtn = screen.getByRole('button', { name: /Install Now/i });
      expect(installBtn).toBeTruthy();
      fireEvent.click(installBtn);
      expect(handleTrigger).toHaveBeenCalledTimes(1);
    });

    it('renders 3-step instructions when on iOS Safari', () => {
      render(
        <AppProvider>
          <PwaInstallPromptModal
            isOpen={true}
            onClose={vi.fn()}
            hasDeferredPrompt={false}
            isIos={true}
            onTriggerInstall={vi.fn()}
          />
        </AppProvider>
      );

      expect(screen.getByText(/Apple iOS Safari Instructions/i)).toBeTruthy();
      expect(screen.getByText(/Tap the Share button/i)).toBeTruthy();
      expect(screen.getByText(/Add to Home Screen/i)).toBeTruthy();
      expect(screen.getByText(/Tap "Add"/i)).toBeTruthy();
    });

    it('dismisses modal when close button is clicked', () => {
      const handleClose = vi.fn();

      render(
        <AppProvider>
          <PwaInstallPromptModal
            isOpen={true}
            onClose={handleClose}
            hasDeferredPrompt={true}
            isIos={false}
            onTriggerInstall={vi.fn()}
          />
        </AppProvider>
      );

      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
      fireEvent.click(closeButtons[0]);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
