import React, { useState } from 'react';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { Phone, MessageSquare, Copy, Check, X } from 'lucide-react';

export interface ContactOption {
  role: 'father' | 'mother' | 'kid';
  label: string;
  name?: string;
  phone: string;
}

export interface ContactPickerPopoverProps {
  personName: string;
  actionType: 'call' | 'whatsapp' | 'copy';
  contacts: ContactOption[];
  isOpen: boolean;
  onClose: () => void;
}

export const ContactPickerPopover: React.FC<ContactPickerPopoverProps> = ({
  personName,
  actionType,
  contacts,
  isOpen,
  onClose,
}) => {
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  useModalEscape(onClose, isOpen);
  useModalHistory('contact-picker', isOpen, onClose);

  if (!isOpen || contacts.length === 0) return null;

  const handleSelect = async (contact: ContactOption) => {
    const raw = contact.phone.trim();
    const dialPhone = raw.replace(/[^\d+]/g, '');
    const waPhone = dialPhone.replace(/^\+/, '');

    if (actionType === 'call') {
      window.location.assign(`tel:${dialPhone}`);
      onClose();
    } else if (actionType === 'whatsapp') {
      const text = encodeURIComponent(`Hello ${contact.name || personName}, `);
      window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
      onClose();
    } else if (actionType === 'copy') {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(raw);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = raw;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        setCopiedPhone(raw);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
        setTimeout(() => {
          setCopiedPhone(null);
          onClose();
        }, 800);
      } catch (err) {
        console.warn('Could not copy:', err);
        onClose();
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'father':
        return '👨';
      case 'mother':
        return '👩';
      default:
        return '🧒';
    }
  };

  const actionTitle =
    actionType === 'call'
      ? `Call ${personName}`
      : actionType === 'whatsapp'
      ? `WhatsApp ${personName}`
      : `Copy Phone for ${personName}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-picker-title"
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 space-y-3.5 cursor-default text-start animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Mobile Pull Bar */}
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            {actionType === 'call' && <Phone className="w-4 h-4 text-blue-600" />}
            {actionType === 'whatsapp' && <MessageSquare className="w-4 h-4 text-emerald-600" />}
            {actionType === 'copy' && <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />}
            <h3 id="contact-picker-title" className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
              {actionTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Available Numbers List */}
        <div className="space-y-2">
          {contacts.map((c, idx) => {
            const isJustCopied = copiedPhone === c.phone.trim();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(c)}
                className={`w-full p-3 rounded-2xl border transition flex items-center justify-between gap-3 text-start cursor-pointer touch-manipulation ${
                  isJustCopied
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    <span>{getRoleIcon(c.role)}</span>
                    <span>{c.label}</span>
                    {c.name && <span className="text-zinc-500 dark:text-zinc-400">({c.name})</span>}
                  </div>
                  <p className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                    <bdi dir="ltr">{c.phone}</bdi>
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  {isJustCopied ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </span>
                  ) : actionType === 'call' ? (
                    <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Phone className="w-4 h-4" />
                    </span>
                  ) : actionType === 'whatsapp' ? (
                    <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <MessageSquare className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      <Copy className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Cancel */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition min-h-[44px] cursor-pointer touch-manipulation"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
