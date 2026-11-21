import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { 
  X, 
  Smartphone, 
  Zap, 
  WifiOff, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

export interface PwaInstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasDeferredPrompt: boolean;
  isIos: boolean;
  onTriggerInstall: () => Promise<boolean>;
}

export const PwaInstallPromptModal: React.FC<PwaInstallPromptModalProps> = ({
  isOpen,
  onClose,
  hasDeferredPrompt,
  isIos,
  onTriggerInstall,
}) => {
  const { translate, isRtl } = useApp();
  const [isInstalling, setIsInstalling] = useState(false);

  useModalEscape(onClose, isOpen);
  useModalHistory('pwa-install', isOpen, onClose);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const installed = await onTriggerInstall();
      if (installed) {
        onClose();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 space-y-5 cursor-default text-start animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Mobile Pull Bar */}
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto -mt-2 sm:hidden" />

        {/* Header & Logo */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-teal-500/30 shadow-md shrink-0 bg-zinc-950 flex items-center justify-center">
              <img
                src="/icon-192.png"
                alt="Oikonomos App Icon"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <h3 id="pwa-install-title" className="font-black text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Oikonomos</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {translate('install_app_desc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={translate('close') || 'Close'}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-2 py-2">
          <div className="p-2.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/60 text-center space-y-1">
            <div className="w-7 h-7 mx-auto rounded-full bg-teal-600 text-white flex items-center justify-center shadow-2xs">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-[11px] text-teal-900 dark:text-teal-200">Full Screen</p>
            <p className="text-[9px] text-teal-700 dark:text-teal-400">No browser bars</p>
          </div>

          <div className="p-2.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-center space-y-1">
            <div className="w-7 h-7 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-[11px] text-indigo-900 dark:text-indigo-200">Instant Load</p>
            <p className="text-[9px] text-indigo-700 dark:text-indigo-400">Fast 1-tap open</p>
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-center space-y-1">
            <div className="w-7 h-7 mx-auto rounded-full bg-amber-600 text-white flex items-center justify-center shadow-2xs">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-[11px] text-amber-900 dark:text-amber-200">Offline</p>
            <p className="text-[9px] text-amber-700 dark:text-amber-400">Works anywhere</p>
          </div>
        </div>

        {/* Platform Specific Install Trigger */}
        {hasDeferredPrompt ? (
          /* Android / Chrome One-Tap Install */
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isInstalling}
              onClick={handleInstallClick}
              className="w-full py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation disabled:opacity-50"
            >
              <Smartphone className="w-4 h-4" />
              <span>{isInstalling ? 'Installing...' : translate('install_now')}</span>
            </button>
            <p className="text-[11px] text-center text-zinc-400">
              Adds an icon directly to your phone's home screen
            </p>
          </div>
        ) : isIos ? (
          /* iOS Safari 3-Step Guide */
          <div className="space-y-2.5 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-xs text-zinc-700 dark:text-zinc-300">
            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mb-1">
              <span>Apple iOS Safari Instructions:</span>
            </p>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span>{translate('ios_install_step1')}</span>
                <Share className="w-4 h-4 text-blue-600 inline" />
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span>{translate('ios_install_step2')}</span>
                <PlusSquare className="w-4 h-4 text-zinc-600 dark:text-zinc-400 inline" />
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span>{translate('ios_install_step3')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
              </div>
            </div>
          </div>
        ) : (
          /* Generic Browser Instructions */
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
            <p className="font-bold text-zinc-900 dark:text-zinc-100">
              Open in Chrome, Edge, or Safari on your mobile device to install directly onto your home screen.
            </p>
          </div>
        )}

        {/* Footer Close */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition min-h-[44px] cursor-pointer touch-manipulation"
          >
            {translate('close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
