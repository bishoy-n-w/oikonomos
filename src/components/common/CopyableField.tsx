import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyableFieldProps {
  label?: string;
  value?: string | number | null;
  copyValue?: string;
  icon?: React.ReactNode;
  actionUrl?: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const CopyableField: React.FC<CopyableFieldProps> = ({
  label,
  value,
  copyValue,
  icon,
  actionUrl,
  actionLabel,
  actionIcon,
  className = '',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);

  const displayStr = value !== null && value !== undefined ? String(value).trim() : '';
  const toCopy = copyValue || displayStr;

  if (!displayStr && !actionUrl) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toCopy) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = toCopy;
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
      console.warn('Could not copy:', err);
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
          {displayStr}
        </span>
        {toCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`p-1 rounded-md transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center touch-manipulation ${
              copied
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={`Copy ${label || 'text'}`}
            aria-label={`Copy ${label || 'text'}`}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{label}</span>
        </div>
      )}

      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {displayStr || <span className="text-zinc-400 italic">None</span>}
      </p>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {toCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] touch-manipulation cursor-pointer ${
              copied
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            aria-label={`Copy ${label || 'value'}`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-500" />
                <span>Copy {label || 'Value'}</span>
              </>
            )}
          </button>
        )}

        {actionUrl && (
          <a
            href={actionUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition min-h-[38px] touch-manipulation"
          >
            {actionIcon}
            <span>{actionLabel || 'Open'}</span>
          </a>
        )}
      </div>
    </div>
  );
};
