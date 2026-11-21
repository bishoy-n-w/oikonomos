import React from 'react';
import type { Mister, ServiceGroup, ClassDoc } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { useBottomSheetDrag } from '../../utils/useBottomSheetDrag';
import { formatAge, safeRender } from '../../utils/formatters';
import { PhoneActionGroup } from '../common/PhoneActionGroup';
import { CopyableField } from '../common/CopyableField';
import {
  X,
  Edit3,
  Mail,
  Briefcase,
  Shield,
  BookOpen,
  ChevronLeft,
} from 'lucide-react';

export interface ServantDetailsModalProps {
  mister: Mister;
  allGroups?: Array<Partial<ServiceGroup> & { id: string; displayName?: string }>;
  allClasses?: ClassDoc[];
  activeAcademicYearId?: string | null;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  onSelectClass?: (classDoc: ClassDoc) => void;
  onSelectGroup?: (group: Partial<ServiceGroup> & { id: string; displayName?: string }) => void;
}

export const ServantDetailsModal: React.FC<ServantDetailsModalProps> = ({
  mister,
  allGroups = [],
  allClasses = [],
  activeAcademicYearId,
  canEdit = false,
  onEdit,
  onClose,
  onBack,
  backLabel,
  onSelectClass,
  onSelectGroup,
}) => {
  const { translate, isRtl } = useApp();

  useModalEscape(onClose, true);
  useModalHistory(`servant-${mister.id}`, true, onClose);
  const { dragHandleProps, sheetStyle } = useBottomSheetDrag({ onClose });

  const emailKey = (mister.email || mister.id || '').toLowerCase().trim();
  const phone = mister.personalInfo?.phone?.trim();

  // Find groups where mister is Admin
  const adminGroups = allGroups.filter((g) => {
    if (g.misters && g.misters[emailKey] === 'admin') return true;
    return (g.admins || []).map((e) => e.toLowerCase().trim()).includes(emailKey);
  });

  // Find groups where mister is Servant
  const servantGroups = allGroups.filter((g) => {
    if (g.misters && g.misters[emailKey] === 'servant') return true;
    return (g.servants || []).map((e) => e.toLowerCase().trim()).includes(emailKey);
  });

  // Find classes where mister is Servant
  const assignedClasses = allClasses.filter((cls) => {
    const yearData = activeAcademicYearId
      ? cls.academicYears?.[activeAcademicYearId]
      : Object.values(cls.academicYears || {})[0];
    if (!yearData) return false;
    const misters = (yearData.MistersIds || yearData.servants || []).map((e) =>
      e.toLowerCase().trim()
    );
    return misters.includes(emailKey);
  });

  const calculatedAge = formatAge(mister.personalInfo?.dob);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="servant-details-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center xl:items-stretch xl:justify-end justify-center p-0 sm:p-4 xl:p-0 bg-black/60 xl:bg-black/25 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        className="w-full sm:max-w-xl xl:max-w-[460px] xl:w-[460px] bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl xl:rounded-none xl:rounded-s-3xl p-5 sm:p-6 shadow-2xl border-t sm:border xl:border-s xl:border-t-0 xl:border-b-0 border-zinc-200 dark:border-zinc-800 max-h-[90dvh] xl:max-h-full xl:h-full flex flex-col cursor-default text-start touch-manipulation animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 xl:slide-in-from-right duration-200"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Mobile Pull Indicator */}
        <div
          {...dragHandleProps}
          className="w-full py-2 -mt-2 mb-1 sm:hidden cursor-grab active:cursor-grabbing flex justify-center touch-none"
        >
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Back Button Navigation if opened from another entity */}
        {onBack && (
          <div className="pb-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer touch-manipulation"
            >
              <ChevronLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              <span>{backLabel ? `Back to ${backLabel}` : 'Back'}</span>
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-xs">
              {mister.personalInfo?.photoUrl ? (
                <img
                  src={mister.personalInfo.photoUrl}
                  alt={mister.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-black text-xl flex items-center justify-center">
                  {mister.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="servant-details-title"
                  className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {mister.displayName}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    mister.churchRole === 'admin'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {mister.churchRole}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    mister.active !== false
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {mister.active !== false ? translate('active_badge') : translate('inactive_badge')}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {mister.email}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={translate('close') || 'Close'}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer touch-manipulation shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Strip */}
        <div className="py-2.5 flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {mister.email && (
            <a
              href={`mailto:${mister.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 active:scale-95 transition min-h-[40px] touch-manipulation"
              title="Send Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>
          )}
        </div>

        {/* Scrollable Information Body with Phone Actions & Copy Fields */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-3.5 py-3 pr-1 text-xs">
          {/* Section: Ministry Assignments with Cross-Entity Drill Down */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-3">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Ministry Roles & Assignments</span>
            </h3>

            {/* Admin In Groups */}
            <div>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                Admin in Groups:
              </span>
              {adminGroups.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {adminGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSelectGroup?.(g)}
                      className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{g.displayName}</span>
                      <span className="text-[10px]">➔</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-400 italic text-[11px]">None</p>
              )}
            </div>

            {/* Servant In Groups */}
            {servantGroups.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                  Servant in Groups:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {servantGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSelectGroup?.(g)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{g.displayName}</span>
                      <span className="text-[10px]">➔</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Classes */}
            <div>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                Assigned Classes:
              </span>
              {assignedClasses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {assignedClasses.map((c) => {
                    const yearData = activeAcademicYearId
                      ? c.academicYears?.[activeAcademicYearId]
                      : Object.values(c.academicYears || {})[0];
                    const cName = yearData?.displayName || yearData?.name || c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectClass?.(c)}
                        className="px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <BookOpen className="w-3 h-3 inline me-1" />
                        <span>{cName}</span>
                        <span className="text-[10px]">➔</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-400 italic text-[11px]">No active classes assigned</p>
              )}
            </div>
          </div>

          {/* Section: Personal Info (PhoneActionGroup & Copyable Fields) */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-3">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Contact & Personal Details</span>
            </h3>

            {/* Phone Action Group */}
            {phone && (
              <PhoneActionGroup
                phone={phone}
                label="Servant Mobile"
                personName={mister.displayName}
              />
            )}

            {/* Email with 1-Tap Copy */}
            <CopyableField
              label="Email Address"
              value={mister.email}
              compact
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block">Profession / Job</span>
                <CopyableField
                  value={mister.personalInfo?.job}
                  label="Profession"
                  compact
                />
              </div>
              <div>
                <span className="text-zinc-400 block">Date of Birth</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {safeRender(mister.personalInfo?.dob) || '-'} {calculatedAge && `(${calculatedAge})`}
                </span>
              </div>
            </div>

            {mister.personalInfo?.address && (
              <CopyableField
                label="Address"
                value={mister.personalInfo.address}
              />
            )}

            {mister.personalInfo?.notes && (
              <CopyableField
                label="Notes"
                value={mister.personalInfo.notes}
              />
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition min-h-[44px] cursor-pointer touch-manipulation"
          >
            {translate('close') || 'Close'}
          </button>

          {canEdit && onEdit && (
            <button
              type="button"
              aria-label={translate('edit_profile') || 'Edit Profile'}
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm min-h-[44px] cursor-pointer touch-manipulation"
            >
              <Edit3 className="w-4 h-4" />
              <span>{translate('edit') || 'Edit'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
