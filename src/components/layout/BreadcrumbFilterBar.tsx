import React from 'react';
import { useFilter } from '../../context/FilterContext';
import { useApp } from '../../context/AppContext';
import { Church, Calendar, Layers, GraduationCap, ChevronRight } from 'lucide-react';

interface BreadcrumbFilterBarProps {
  onOpenMobileFilters?: () => void;
}

export const BreadcrumbFilterBar: React.FC<BreadcrumbFilterBarProps> = () => {
  const {
    churches,
    academicYears,
    serviceGroups,
    classes,
    selectedChurchId,
    selectedAcademicYearId,
    selectedServiceGroupId,
    selectedClassId,
    setAcademicYear,
    setServiceGroup,
    setClass,
  } = useFilter();
  const { translate, isRtl } = useApp();

  const activeChurch = churches.find((c) => c.id === selectedChurchId);

  if (churches.length === 0) return null;

  return (
    <div className="hidden sm:block w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/70 px-4 py-2 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Desktop Breadcrumb Filter Trail (>= sm) */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap font-medium text-zinc-600 dark:text-zinc-400">
          {/* Church */}
          <div className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-300">
            <Church className="w-3.5 h-3.5" />
            <span>{activeChurch?.displayName || translate('church')}</span>
          </div>

          <ChevronRight className={`w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 ${isRtl ? 'rotate-180' : ''}`} />

          {/* Academic Year */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedAcademicYearId || ''}
              onChange={(e) => setAcademicYear(e.target.value)}
              aria-label={translate('academic_year')}
              className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-none hover:text-teal-600"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {y.displayName}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className={`w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 ${isRtl ? 'rotate-180' : ''}`} />

          {/* Service Group */}
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedServiceGroupId || ''}
              onChange={(e) => setServiceGroup(e.target.value)}
              aria-label={translate('service_group')}
              className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-none hover:text-teal-600"
            >
              <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                All Groups
              </option>
              {serviceGroups.map((g) => (
                <option key={g.id} value={g.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {g.displayName}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className={`w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 ${isRtl ? 'rotate-180' : ''}`} />

          {/* Classroom */}
          <div className="flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedClassId || ''}
              onChange={(e) => setClass(e.target.value)}
              aria-label={translate('class')}
              className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-none hover:text-teal-600"
            >
              <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                All Classes
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {c.displayName || c.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
