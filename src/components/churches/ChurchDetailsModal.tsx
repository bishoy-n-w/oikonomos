import React from 'react';
import type { Church, AcademicYear, ServiceGroup } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import {
  X,
  Edit3,
  Calendar,
  Award,
  Settings,
} from 'lucide-react';

export interface ChurchDetailsModalProps {
  church: Church;
  activeAcademicYearName?: string;
  academicYears?: AcademicYear[];
  serviceGroups?: ServiceGroup[];
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onManageGrades?: () => void;
}

export const ChurchDetailsModal: React.FC<ChurchDetailsModalProps> = ({
  church,
  activeAcademicYearName,
  academicYears = [],
  serviceGroups = [],
  canEdit = false,
  onEdit,
  onClose,
  onManageGrades,
}) => {
  const { translate, isRtl } = useApp();

  useModalEscape(onClose, true);

  const grades = church.grades || {};
  const gradeEntries = Object.entries(grades).sort((a, b) => {
    const numA = parseInt(a[0], 10);
    const numB = parseInt(b[0], 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a[0].localeCompare(b[0]);
  });

  const activeYear =
    academicYears.find((y) => y.id === church.activeAcademicYearId)?.displayName ||
    activeAcademicYearName ||
    church.activeAcademicYearId ||
    '-';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="church-details-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] flex flex-col cursor-default text-start"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-xs">
              {church.logoUrl ? (
                <img
                  src={church.logoUrl}
                  alt={church.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-black text-xl flex items-center justify-center">
                  {church.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="church-details-title"
                  className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {church.displayName}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    church.active !== false
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {church.active !== false ? translate('active_badge') : translate('inactive_badge')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Active Year: {activeYear}
              </p>
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

        {/* Scrollable Information Body */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 py-3 pr-1 text-xs">
          {/* Section: Overview & Year */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Academic Year Status</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-zinc-400 block">{translate('academic_year')}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {activeYear}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('grades')}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {gradeEntries.length} Configured
                </span>
              </div>
            </div>
          </div>

          {/* Section: Configured Grades */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Configured Grades ({gradeEntries.length})</span>
              </h3>
              {onManageGrades && (
                <button
                  type="button"
                  onClick={onManageGrades}
                  className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Configure</span>
                </button>
              )}
            </div>

            {gradeEntries.length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">No grades configured yet for this church.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {gradeEntries.map(([key, item]) => {
                  const group = serviceGroups.find((g) => g.id === item.serviceGroupId);
                  return (
                    <div
                      key={key}
                      className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-[10px] px-1 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800">
                            #{key}
                          </span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                            {item.name}
                          </span>
                        </div>
                        {group && (
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {group.displayName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              aria-label={translate('edit_church') || 'Edit Church'}
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm min-h-[44px] cursor-pointer touch-manipulation"
            >
              <Edit3 className="w-4 h-4" />
              <span>{translate('edit') || 'Edit Church'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
