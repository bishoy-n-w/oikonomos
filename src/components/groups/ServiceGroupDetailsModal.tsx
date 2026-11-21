import React, { useState } from 'react';
import { DEFAULT_EVENT_TYPES, type ServiceGroup, type Mister, type GradeItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { useBottomSheetDrag } from '../../utils/useBottomSheetDrag';
import { PhoneActionGroup } from '../common/PhoneActionGroup';
import {
  X,
  Edit3,
  Calendar,
  Shield,
  Users,
  Award,
  Search,
  ChevronLeft,
} from 'lucide-react';

export interface ServiceGroupDetailsModalProps {
  group: ServiceGroup;
  allMisters: Mister[];
  churchGrades?: Record<string, GradeItem>;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  onSelectServant?: (servant: Mister) => void;
  onManageEvents?: () => void;
}

export const ServiceGroupDetailsModal: React.FC<ServiceGroupDetailsModalProps> = ({
  group,
  allMisters,
  churchGrades = {},
  canEdit = false,
  onEdit,
  onClose,
  onBack,
  backLabel,
  onSelectServant,
  onManageEvents,
}) => {
  const { translate, isRtl } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'servants'>('overview');
  const [search, setSearch] = useState('');

  useModalEscape(onClose, true);
  useModalHistory(`group-${group.id}`, true, onClose);
  const { dragHandleProps, sheetStyle } = useBottomSheetDrag({ onClose });

  const groupMistersMap = group.misters || {};
  const adminEmails = Array.from(
    new Set([
      ...(group.admins || []),
      ...Object.entries(groupMistersMap)
        .filter(([, role]) => role === 'admin')
        .map(([email]) => email),
    ])
  ).map((e) => e.toLowerCase().trim());

  const servantEmails = Array.from(
    new Set([
      ...(group.servants || []),
      ...Object.entries(groupMistersMap)
        .filter(([, role]) => role === 'servant')
        .map(([email]) => email),
    ])
  ).map((e) => e.toLowerCase().trim());

  const adminMisters = allMisters.filter((m) =>
    adminEmails.includes((m.email || m.id || '').toLowerCase().trim())
  );
  const servantMisters = allMisters.filter((m) =>
    servantEmails.includes((m.email || m.id || '').toLowerCase().trim())
  );

  const matchingGrades = Object.entries(churchGrades)
    .filter(([, item]) => item.serviceGroupId === group.id)
    .map(([gradeId, item]) => ({ gradeId, ...item }));

  const eventTypes =
    group.eventTypes && group.eventTypes.length > 0
      ? group.eventTypes
      : DEFAULT_EVENT_TYPES.map((name, idx) => ({
          id: String(idx),
          name,
          isCore: idx === 0,
        }));

  const filteredAdmins = adminMisters.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.personalInfo?.phone || '').includes(q)
    );
  });

  const filteredServants = servantMisters.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.personalInfo?.phone || '').includes(q)
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-details-title"
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
        <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="group-details-title"
                className="font-black text-lg text-zinc-900 dark:text-zinc-100 truncate"
              >
                {group.displayName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  group.active !== false
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {group.active !== false ? translate('active_badge') : translate('inactive_badge')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {adminEmails.length} Admins • {servantEmails.length} Servants
            </p>
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

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 my-3 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Overview & Events</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation ${
              activeTab === 'admins'
                ? 'bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admins ({adminEmails.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('servants')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation ${
              activeTab === 'servants'
                ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Servants ({servantEmails.length})</span>
          </button>
        </div>

        {/* Tab Content Body with Drill-Down Links and Universal Phone Actions */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-3.5 pr-1 text-xs">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Grades Covered */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
                <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Covered Academic Grades</span>
                </h3>
                {matchingGrades.length === 0 ? (
                  <p className="text-zinc-400 italic text-[11px]">No grades currently mapped to this service group.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {matchingGrades.map((g) => (
                      <span
                        key={g.gradeId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold"
                      >
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-300">#{g.gradeId}</span>
                        <bdi>{g.name}</bdi>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Event Types */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Configured Event Types ({eventTypes.length})</span>
                  </h3>
                  {onManageEvents && canEdit && (
                    <button
                      type="button"
                      onClick={onManageEvents}
                      className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      Manage Events
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {eventTypes.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-1"
                    >
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{evt.name}</span>
                      {evt.isCore && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                          Core
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADMINS */}
          {activeTab === 'admins' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search administrators..."
                  className="w-full ps-9 pe-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {filteredAdmins.length === 0 ? (
                <div className="py-8 text-center text-zinc-400">
                  {search ? 'No administrators match your search.' : 'No administrators assigned to this group.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 overflow-hidden">
                  {filteredAdmins.map((m) => {
                    const phone = m.personalInfo?.phone;
                    return (
                      <div key={m.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition">
                        <div
                          onClick={() => onSelectServant?.(m)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                            {m.personalInfo?.photoUrl ? (
                              <img src={m.personalInfo.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="w-full h-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center">
                                {m.displayName.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 group-hover:underline">
                              {m.displayName} ➔
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {m.email}
                            </p>
                          </div>
                        </div>

                        {phone && (
                          <PhoneActionGroup
                            phone={phone}
                            personName={m.displayName}
                            compact
                            allowCall
                            allowWhatsApp
                            allowCopy
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: SERVANTS */}
          {activeTab === 'servants' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search servants..."
                  className="w-full ps-9 pe-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {filteredServants.length === 0 ? (
                <div className="py-8 text-center text-zinc-400">
                  {search ? 'No servants match your search.' : 'No servants assigned to this group.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 overflow-hidden">
                  {filteredServants.map((m) => {
                    const phone = m.personalInfo?.phone;
                    return (
                      <div key={m.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition">
                        <div
                          onClick={() => onSelectServant?.(m)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                            {m.personalInfo?.photoUrl ? (
                              <img src={m.personalInfo.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="w-full h-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                                {m.displayName.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 group-hover:underline">
                              {m.displayName} ➔
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {m.email}
                            </p>
                          </div>
                        </div>

                        {phone && (
                          <PhoneActionGroup
                            phone={phone}
                            personName={m.displayName}
                            compact
                            allowCall
                            allowWhatsApp
                            allowCopy
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              aria-label={translate('edit_group') || 'Edit Service Group'}
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
