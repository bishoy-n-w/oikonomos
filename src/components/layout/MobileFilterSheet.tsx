import React from 'react';
import { useApp } from '../../context/AppContext';
import { useFilter } from '../../context/FilterContext';
import type { ActiveTab } from './MainShell';
import { X, Check } from 'lucide-react';

interface MobileFilterSheetProps {
  activeTab?: ActiveTab;
  isOpen: boolean;
  onClose: () => void;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({ activeTab, isOpen, onClose }) => {
  const { translate } = useApp();
  const {
    churches,
    academicYears,
    serviceGroups,
    classes,
    selectedChurchId,
    selectedAcademicYearId,
    selectedServiceGroupId,
    selectedClassId,
    setChurch,
    setAcademicYear,
    setServiceGroup,
    setClass,
  } = useFilter();

  if (!isOpen) return null;

  const dimChurch = activeTab === 'churches_config';
  const dimYear = activeTab === 'churches_config' || activeTab === 'service_groups';
  const dimGroup = activeTab === 'churches_config' || activeTab === 'service_groups';
  const dimClass = activeTab === 'churches_config' || activeTab === 'service_groups' || activeTab === 'classes';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {translate('filter')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Selectors Form */}
        <div className="space-y-4 py-4">
          {/* 1. Church */}
          <div className={dimChurch ? 'opacity-30 pointer-events-none' : ''}>
            <label className="block text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-1.5">
              {translate('church')}
            </label>
            <select
              value={selectedChurchId || ''}
              disabled={dimChurch || churches.length === 0}
              onChange={(e) => setChurch(e.target.value)}
              className="w-full text-sm font-semibold p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500"
            >
              {churches.length === 0 && (
                <option value="" disabled>No Church Assigned</option>
              )}
              {churches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Academic Year */}
          <div className={dimYear ? 'opacity-30 pointer-events-none' : ''}>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              {translate('academic_year')}
            </label>
            <select
              value={selectedAcademicYearId || ''}
              disabled={dimYear || academicYears.length === 0}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full text-sm p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500"
            >
              {academicYears.length === 0 && (
                <option value="" disabled>No Year Found</option>
              )}
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.isActiveYear ? `⭐ ${y.displayName} (Active)` : y.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Service Group */}
          <div className={dimGroup ? 'opacity-30 pointer-events-none' : ''}>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              {translate('service_groups')}
            </label>
            <select
              value={selectedServiceGroupId || ''}
              disabled={dimGroup}
              onChange={(e) => setServiceGroup(e.target.value ? e.target.value : null)}
              className="w-full text-sm p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{translate('all')} {translate('service_groups')}</option>
              {serviceGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Class */}
          <div className={dimClass ? 'opacity-30 pointer-events-none' : ''}>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              {translate('classes')}
            </label>
            <select
              value={selectedClassId || ''}
              disabled={dimClass}
              onChange={(e) => setClass(e.target.value ? e.target.value : null)}
              className="w-full text-sm p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{translate('all')} {translate('classes')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition shadow-lg shadow-teal-600/30"
          >
            <Check className="w-4 h-4" />
            <span>{translate('apply_filters')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
