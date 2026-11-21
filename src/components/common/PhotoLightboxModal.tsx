import React from 'react';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { X, Cross } from 'lucide-react';

export interface PhotoLightboxModalProps {
  photoUrl?: string | null;
  name: string;
  gender?: 'male' | 'female';
  subtitle?: string;
  isDeacon?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photoUrl,
  name,
  gender = 'male',
  subtitle,
  isDeacon = false,
  isOpen,
  onClose,
}) => {
  useModalEscape(onClose, isOpen);
  useModalHistory('photo-lightbox', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${name}`}
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md flex flex-col items-center gap-4 text-center cursor-default animate-in zoom-in-95 duration-200"
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="self-end p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Large Centered Image / Avatar */}
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-zinc-900 flex items-center justify-center">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center font-black text-6xl ${
                gender === 'female'
                  ? 'bg-rose-950 text-rose-300'
                  : 'bg-teal-950 text-teal-300'
              }`}
            >
              {name ? name.trim().charAt(0) : '?'}
            </div>
          )}
        </div>

        {/* Name, Deacon Badge & Subtitle */}
        <div className="text-white space-y-1 px-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-black">{name}</h3>
            {isDeacon && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-zinc-900 shadow-sm">
                <Cross className="w-3 h-3" />
                <span>Deacon</span>
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-300 font-medium">{subtitle}</p>
          )}
          <p className="text-[11px] text-zinc-400 pt-1">
            Tap anywhere or press back to dismiss
          </p>
        </div>
      </div>
    </div>
  );
};
