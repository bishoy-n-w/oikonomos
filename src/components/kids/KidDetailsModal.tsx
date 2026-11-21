import React from 'react';
import type { Kid } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useBottomSheetDrag } from '../../utils/useBottomSheetDrag';
import { getUniversalNavigationUrl } from '../../utils/geo';
import { formatAge, safeRender } from '../../utils/formatters';
import {
  X,
  Edit3,
  Phone,
  MessageSquare,
  Navigation,
  IdCard,
  MapPin,
  School,
  User,
  HeartHandshake,
  Users,
  Cross,
} from 'lucide-react';

export interface KidDetailsModalProps {
  kid: Kid;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onPrintBadge?: () => void;
  onLogVisit?: () => void;
  classes?: Array<{ id: string; displayName?: string; name?: string }>;
  serviceGroups?: Array<{ id: string; displayName?: string }>;
}

export const KidDetailsModal: React.FC<KidDetailsModalProps> = ({
  kid,
  canEdit = false,
  onEdit,
  onClose,
  onPrintBadge,
  onLogVisit,
  classes = [],
  serviceGroups = [],
}) => {
  const { translate, isRtl } = useApp();

  useModalEscape(onClose, true);
  const { dragHandleProps, sheetStyle } = useBottomSheetDrag({ onClose });

  const fatherPhone = kid.contacts?.fatherMob?.trim();
  const motherPhone = kid.contacts?.motherMob?.trim();
  const kidPhone = kid.contacts?.kidMob?.trim();
  const primaryPhone = fatherPhone || motherPhone || kidPhone;

  const currentClass = classes.find(
    (c) => c.id === (kid.activeAssignment?.classId || kid.classId)
  );
  const className = currentClass?.displayName || currentClass?.name || kid.activeAssignment?.classId || '-';

  const currentGroup = serviceGroups.find(
    (g) => g.id === (kid.activeAssignment?.serviceGroupId || kid.serviceGroupId)
  );
  const groupName = currentGroup?.displayName || kid.activeAssignment?.serviceGroupId || '-';

  const fullAddress = [
    kid.address?.building ? `Bldg ${kid.address.building}` : '',
    kid.address?.floor ? `Flr ${kid.address.floor}` : '',
    kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
    kid.address?.street,
    kid.address?.region,
  ].filter(Boolean).join(', ');

  const navUrl = getUniversalNavigationUrl(kid.address?.geoLocation, fullAddress);
  const calculatedAge = formatAge(kid.info?.dob);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kid-details-title"
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

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-xs">
              {kid.info.photoUrl ? (
                <img
                  src={kid.info.photoUrl}
                  alt={kid.info.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className={`w-full h-full flex items-center justify-center font-black text-xl ${
                    kid.info.gender === 'female'
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'
                  }`}
                >
                  {kid.info.fullName ? kid.info.fullName.trim().charAt(0) : '?'}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="kid-details-title"
                  className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {kid.info.fullName}
                </h2>
                {kid.info.deacon && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    <Cross className="w-2.5 h-2.5" />
                    <span>Deacon</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    kid.info.gender === 'female'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {kid.info.gender === 'female' ? translate('female') : translate('male')}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    kid.active !== false
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {kid.active !== false ? translate('active_badge') : translate('inactive_badge')}
                </span>

                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {className}
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

        {/* Quick Contact & Action Strip */}
        <div className="py-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {fatherPhone && (
            <a
              href={`tel:${fatherPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 active:scale-95 transition min-h-[44px] touch-manipulation"
              title={translate('call_parent')}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{translate('father') || 'Father'}</span>
            </a>
          )}
          {motherPhone && (
            <a
              href={`tel:${motherPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 active:scale-95 transition min-h-[44px] touch-manipulation"
              title={translate('mother')}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{translate('mother') || 'Mother'}</span>
            </a>
          )}
          {kidPhone && (
            <a
              href={`tel:${kidPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 active:scale-95 transition min-h-[44px] touch-manipulation"
              title={translate('phone')}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{translate('kids') || 'Kid'}</span>
            </a>
          )}
          {primaryPhone && (
            <a
              href={`https://wa.me/${primaryPhone.replace(/\+/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 active:scale-95 transition min-h-[44px] touch-manipulation"
              title="WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 active:scale-95 transition min-h-[44px] touch-manipulation"
              title={translate('navigate')}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{translate('navigate') || 'Directions'}</span>
            </a>
          )}
          {onPrintBadge && (
            <button
              type="button"
              onClick={onPrintBadge}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition cursor-pointer min-h-[44px] touch-manipulation"
              title={translate('print_id_badge')}
            >
              <IdCard className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{translate('print_id_badge') || 'ID Card'}</span>
            </button>
          )}
          {onLogVisit && (
            <button
              type="button"
              onClick={onLogVisit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 active:scale-95 transition cursor-pointer min-h-[44px] touch-manipulation"
              title={translate('log_visit')}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{translate('log_visit') || 'Log Visit'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Information Body */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 py-3 pr-1 text-xs">
          {/* Section: Academic & Church Life */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Academic & Ministry Enrollment</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-zinc-400 block">{translate('school')}</span>
                <div className="flex items-center gap-1.5 flex-wrap font-semibold text-zinc-800 dark:text-zinc-200">
                  <span>{kid.info.school || '-'}</span>
                  {kid.info.schoolType && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {kid.info.schoolType}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('class')}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {className}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('service_group')}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {groupName}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('academic_year')}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {kid.activeAssignment?.academicYearId || kid.academicYearId || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Family & Personal Contact */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{translate('family_contacts_group') || 'Family & Contacts'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
              {/* Father */}
              <div className="space-y-1">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 block border-b border-zinc-200/60 dark:border-zinc-700/60 pb-0.5">
                  👨 {translate('father') || 'Father'}
                </span>
                <p className="text-zinc-800 dark:text-zinc-200">
                  <span className="text-zinc-400">{translate('father_name')}: </span>
                  <span className="font-semibold">{kid.contacts?.fatherName || '-'}</span>
                </p>
                {kid.contacts?.fatherProfession && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('father_job')}: </span>
                    <span>{kid.contacts.fatherProfession}</span>
                  </p>
                )}
                {fatherPhone && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('phone')}: </span>
                    <a href={`tel:${fatherPhone}`} className="text-blue-600 dark:text-blue-400 font-mono underline">
                      {fatherPhone}
                    </a>
                  </p>
                )}
                {kid.contacts?.fatherDOB && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('father_dob')}: </span>
                    <span>{safeRender(kid.contacts.fatherDOB)}</span>
                  </p>
                )}
              </div>

              {/* Mother */}
              <div className="space-y-1">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 block border-b border-zinc-200/60 dark:border-zinc-700/60 pb-0.5">
                  👩 {translate('mother') || 'Mother'}
                </span>
                <p className="text-zinc-800 dark:text-zinc-200">
                  <span className="text-zinc-400">{translate('mother_name')}: </span>
                  <span className="font-semibold">{kid.contacts?.motherName || '-'}</span>
                </p>
                {kid.contacts?.motherProfession && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('mother_job')}: </span>
                    <span>{kid.contacts.motherProfession}</span>
                  </p>
                )}
                {motherPhone && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('phone')}: </span>
                    <a href={`tel:${motherPhone}`} className="text-purple-600 dark:text-purple-400 font-mono underline">
                      {motherPhone}
                    </a>
                  </p>
                )}
                {kid.contacts?.motherDOB && (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    <span className="text-zinc-400">{translate('mother_dob')}: </span>
                    <span>{safeRender(kid.contacts.motherDOB)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Student DOB & Age */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block">{translate('dob')}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {safeRender(kid.info?.dob)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('age') || 'Age'}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {calculatedAge || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Residence & Address */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>{translate('address_group') || 'Address & Location'}</span>
            </h3>
            <p className="text-[11px] text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
              {fullAddress || <span className="text-zinc-400 italic">No address on file</span>}
            </p>
            {kid.address?.landmark && (
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400">Landmark: </span>
                {kid.address.landmark}
              </p>
            )}
            {navUrl && (
              <div className="pt-1">
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Open Navigation Link (Google / Apple Maps)</span>
                </a>
              </div>
            )}
          </div>

          {/* Section: Spiritual & Pastoral */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Spiritual & Pastoral Care</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block">{translate('confession_father') || 'Father of Confession'}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {kid.info?.fatherOfConfession || '-'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Deacon</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {kid.info?.deacon ? 'Yes (Ordained ✠)' : 'No'}
                </span>
              </div>
            </div>
            {kid.notes && (
              <div className="pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-zinc-400 block mb-0.5">{translate('notes') || 'Notes'}</span>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 italic whitespace-pre-wrap bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
                  {kid.notes}
                </p>
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
              aria-label={translate('edit_student') || 'Edit Student'}
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
