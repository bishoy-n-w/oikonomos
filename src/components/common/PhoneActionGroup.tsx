import React, { useState } from 'react';
import { Phone, MessageSquare, Copy, Check } from 'lucide-react';

export interface PhoneActionGroupProps {
  phone?: string | null;
  label?: string;
  personName?: string;
  compact?: boolean;
  showNumber?: boolean;
  allowCall?: boolean;
  allowWhatsApp?: boolean;
  allowCopy?: boolean;
  className?: string;
}

export const PhoneActionGroup: React.FC<PhoneActionGroupProps> = ({
  phone,
  label,
  personName,
  compact = false,
  showNumber = true,
  allowCall = true,
  allowWhatsApp = true,
  allowCopy = true,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const rawPhone = phone?.trim() || '';
  if (!rawPhone) return null;

  // Clean phone for tel: and WhatsApp (keep digits and leading plus)
  const dialPhone = rawPhone.replace(/[^\d+]/g, '');
  const waPhone = dialPhone.replace(/^\+/, '');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rawPhone);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = rawPhone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn('Could not copy phone number:', err);
    }
  };

  const waUrl = personName
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${personName}, `)}`
    : `https://wa.me/${waPhone}`;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
        {showNumber && (
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 me-1">
            <bdi dir="ltr">{rawPhone}</bdi>
          </span>
        )}
        {allowCall && (
          <a
            href={`tel:${dialPhone}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
            title={`Call ${rawPhone}`}
            aria-label={`Call ${rawPhone}`}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        {allowWhatsApp && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
            title={`WhatsApp ${rawPhone}`}
            aria-label={`WhatsApp ${rawPhone}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </a>
        )}
        {allowCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation cursor-pointer ${
              copied
                ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'
            }`}
            title="Copy phone number"
            aria-label="Copy phone number"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {label && (
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
        )}
        {showNumber && (
          <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
            <bdi dir="ltr">{rawPhone}</bdi>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {allowCall && (
          <a
            href={`tel:${dialPhone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 active:scale-95 transition min-h-[44px] touch-manipulation"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call</span>
          </a>
        )}
        {allowWhatsApp && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 active:scale-95 transition min-h-[44px] touch-manipulation"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
        {allowCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition min-h-[44px] touch-manipulation cursor-pointer ${
              copied
                ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
