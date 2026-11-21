import React, { useState } from 'react';
import type { ClassDoc, ClassYearData, Kid, Mister, Church } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useBottomSheetDrag } from '../../utils/useBottomSheetDrag';
import {
  X,
  Edit3,
  Baby,
  Users,
  Info,
  Search,
  Phone,
  MessageSquare,
} from 'lucide-react';

export interface ClassDetailsModalProps {
  classDoc: ClassDoc;
  activeAcademicYearId?: string | null;
  allKids: Kid[];
  allMisters: Mister[];
  serviceGroups?: Array<{ id: string; displayName?: string; name?: string }>;
  currentChurch?: Church | null;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
}

export const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  classDoc,
  activeAcademicYearId,
  allKids,
  allMisters,
  serviceGroups = [],
  currentChurch,
  canEdit = false,
  onEdit,
  onClose,
}) => {
  const { translate, isRtl } = useApp();
  const [activeTab, setActiveTab] = useState<'kids' | 'servants' | 'overview'>('kids');
  const [search, setSearch] = useState('');

  useModalEscape(onClose, true);
  const { dragHandleProps, sheetStyle } = useBottomSheetDrag({ onClose });

  const yearData: ClassYearData | null = activeAcademicYearId
    ? classDoc.academicYears[activeAcademicYearId] || Object.values(classDoc.academicYears)[0] || null
    : Object.values(classDoc.academicYears)[0] || null;

  const group = serviceGroups.find((g) => g.id === yearData?.serviceGroupId);
  const gradeItem = yearData?.gradeId ? currentChurch?.grades?.[yearData.gradeId] : undefined;

  const storedKidIds = yearData?.KidIds || yearData?.kids || [];
  const assignedFromDirectory = allKids
    .filter((k) => k.active !== false && (k.activeAssignment?.classId === classDoc.id || k.classId === classDoc.id))
    .map((k) => k.id);
  const effectiveKidIds = Array.from(new Set([...storedKidIds, ...assignedFromDirectory]));

  const enrolledKids = allKids.filter((k) => effectiveKidIds.includes(k.id));
  const assignedMisterIds = yearData?.MistersIds || yearData?.servants || [];
  const assignedServants = allMisters.filter((m) => {
    const email = (m.email || m.id || '').toLowerCase().trim();
    return assignedMisterIds.some((id) => id.toLowerCase().trim() === email);
  });

  const filteredKids = enrolledKids.filter((k) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (k.info?.fullName || '').toLowerCase().includes(q) ||
      (k.contacts?.fatherName || '').toLowerCase().includes(q) ||
      (k.contacts?.fatherMob || '').includes(q) ||
      (k.contacts?.motherMob || '').includes(q)
    );
  });

  const filteredServants = assignedServants.filter((m) => {
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
      aria-labelledby="class-details-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        className="w-full sm:max-w-xl bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] flex flex-col cursor-default text-start touch-manipulation"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Mobile Pull Indicator */}
        <div
          {...dragHandleProps}
          className="w-full py-2 -mt-2 mb-1 sm:hidden cursor-grab active:cursor-grabbing flex justify-center touch-none"
        >
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="class-details-title"
                className="font-black text-lg text-zinc-900 dark:text-zinc-100 truncate"
              >
                {yearData?.displayName || classDoc.id}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  classDoc.active !== false
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {classDoc.active !== false ? translate('active_badge') : translate('inactive_badge')}
              </span>
              {gradeItem && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[10px] font-semibold">
                  <span className="font-mono font-bold">#{yearData?.gradeId}</span>
                  <bdi>{gradeItem.name}</bdi>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {group?.displayName || yearData?.serviceGroupId || 'Service Group'}
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
            onClick={() => setActiveTab('kids')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation ${
              activeTab === 'kids'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>{translate('enrolled_kids')} ({enrolledKids.length})</span>
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
            <span>{translate('servants')} ({assignedServants.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-3 pr-1 text-xs">
          {/* TAB: KIDS */}
          {activeTab === 'kids' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="w-full ps-9 pe-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {filteredKids.length === 0 ? (
                <div className="py-8 text-center text-zinc-400">
                  {search ? 'No students match your search.' : 'No students currently enrolled in this class.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 overflow-hidden">
                  {filteredKids.map((k) => {
                    const phone = k.contacts?.fatherMob || k.contacts?.motherMob || k.contacts?.kidMob;
                    return (
                      <div key={k.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                            {k.info?.photoUrl ? (
                              <img src={k.info.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span
                                className={`w-full h-full flex items-center justify-center font-bold text-xs ${
                                  k.info?.gender === 'female' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'
                                }`}
                              >
                                {k.info?.fullName ? k.info.fullName.charAt(0) : '?'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {k.info?.fullName}
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {k.contacts?.fatherName ? `${k.contacts.fatherName}` : 'Sunday School Student'}
                              {phone && ` • ${phone}`}
                            </p>
                          </div>
                        </div>

                        {phone && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${phone}`}
                              className="p-1.5 rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                              title={translate('phone')}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${phone.replace(/\+/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
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
                  {search ? 'No servants match your search.' : 'No servants assigned to this class.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 overflow-hidden">
                  {filteredServants.map((m) => {
                    const phone = m.personalInfo?.phone;
                    return (
                      <div key={m.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {m.displayName}
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {m.email}
                            </p>
                          </div>
                        </div>

                        {phone && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${phone}`}
                              className="p-1.5 rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                              title={translate('phone')}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${phone.replace(/\+/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 block">{translate('service_group')}</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {group?.displayName || yearData?.serviceGroupId || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Grade Level</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {gradeItem ? `${gradeItem.name} (#${yearData?.gradeId})` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">{translate('academic_year')}</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {activeAcademicYearId || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Class ID</span>
                  <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {classDoc.id}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs font-semibold">
                <span>Total Registered Students:</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">{enrolledKids.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Total Assigned Servants:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{assignedServants.length}</span>
              </div>
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
              aria-label={translate('edit_class') || 'Edit Class'}
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
