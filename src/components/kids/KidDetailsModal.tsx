import React from 'react';
import type { Kid } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { useModalHistory } from '../../utils/useModalHistory';
import { useBottomSheetDrag } from '../../utils/useBottomSheetDrag';
import { getUniversalNavigationUrl } from '../../utils/geo';
import { formatAge, safeRender } from '../../utils/formatters';
import { PhoneActionGroup } from '../common/PhoneActionGroup';
import { CopyableField } from '../common/CopyableField';
import { ContactPickerPopover, type ContactOption } from '../common/ContactPickerPopover';
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
  ChevronLeft,
} from 'lucide-react';

export interface KidDetailsModalProps {
  kid: Kid;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  onSelectClass?: (classId: string) => void;
  onSelectServiceGroup?: (groupId: string) => void;
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
  onBack,
  backLabel,
  onSelectClass,
  onSelectServiceGroup,
  onPrintBadge,
  onLogVisit,
  classes = [],
  serviceGroups = [],
}) => {
  const { translate, isRtl } = useApp();

  useModalEscape(onClose, true);
  useModalHistory(`kid-${kid.id}`, true, onClose);
  const { dragHandleProps, sheetStyle } = useBottomSheetDrag({ onClose });

  const fatherPhone = kid.contacts?.fatherMob?.trim();
  const motherPhone = kid.contacts?.motherMob?.trim();
  const kidPhone = kid.contacts?.kidMob?.trim();

  const currentClassId = kid.activeAssignment?.classId || kid.classId;
  const currentClass = classes.find((c) => c.id === currentClassId);
  const className = currentClass?.displayName || currentClass?.name || currentClassId || '-';

  const currentGroupId = kid.activeAssignment?.serviceGroupId || kid.serviceGroupId;
  const currentGroup = serviceGroups.find((g) => g.id === currentGroupId);
  const groupName = currentGroup?.displayName || currentGroupId || '-';

  const fullAddress = [
    kid.address?.building ? `Bldg ${kid.address.building}` : '',
    kid.address?.floor ? `Flr ${kid.address.floor}` : '',
    kid.address?.apartment ? `Apt ${kid.address.apartment}` : '',
    kid.address?.street,
    kid.address?.region,
  ].filter(Boolean).join(', ');

  const navUrl = getUniversalNavigationUrl(kid.address?.geoLocation, fullAddress);
  const calculatedAge = formatAge(kid.info?.dob);

  const [contactPicker, setContactPicker] = React.useState<{ actionType: 'call' | 'whatsapp' | 'copy'; contacts: ContactOption[] } | null>(null);

  const allAvailableContacts = React.useMemo<ContactOption[]>(() => {
    const list: ContactOption[] = [];
    if (fatherPhone) {
      list.push({
        role: 'father',
        label: translate('father') || 'Father',
        name: kid.contacts?.fatherName,
        phone: fatherPhone,
      });
    }
    if (motherPhone) {
      list.push({
        role: 'mother',
        label: translate('mother') || 'Mother',
        name: kid.contacts?.motherName,
        phone: motherPhone,
      });
    }
    if (kidPhone) {
      list.push({
        role: 'kid',
        label: translate('kids') || 'Student',
        name: kid.info.fullName,
        phone: kidPhone,
      });
    }
    return list;
  }, [fatherPhone, motherPhone, kidPhone, kid.contacts?.fatherName, kid.contacts?.motherName, kid.info.fullName, translate]);

  const handleTriggerContact = (actionType: 'call' | 'whatsapp') => {
    if (allAvailableContacts.length === 0) return;
    if (allAvailableContacts.length === 1) {
      const c = allAvailableContacts[0];
      const dial = c.phone.replace(/[^\d+]/g, '');
      if (actionType === 'call') {
        window.location.assign(`tel:${dial}`);
      } else {
        const text = encodeURIComponent(`Hello ${c.name || kid.info.fullName}, `);
        window.open(`https://wa.me/${dial.replace(/^\+/, '')}?text=${text}`, '_blank');
      }
      return;
    }
    setContactPicker({
      actionType,
      contacts: allAvailableContacts,
    });
  };

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

        {/* Sleek Quick Actions Bar (Call, WhatsApp, Maps, ID Card) */}
        <div className="grid grid-cols-4 gap-2 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {/* 1. Quick Call */}
          <button
            type="button"
            disabled={allAvailableContacts.length === 0}
            onClick={() => handleTriggerContact('call')}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
          >
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
              {translate('call') || 'Call'}
            </span>
          </button>

          {/* 2. Quick WhatsApp */}
          <button
            type="button"
            disabled={allAvailableContacts.length === 0}
            onClick={() => handleTriggerContact('whatsapp')}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              WhatsApp
            </span>
          </button>

          {/* 3. Maps / Navigation */}
          {navUrl ? (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 active:scale-95 transition cursor-pointer touch-manipulation"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Navigation className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                {translate('navigate') || 'Maps'}
              </span>
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 opacity-40 cursor-not-allowed">
              <div className="w-9 h-9 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-500 flex items-center justify-center">
                <Navigation className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-zinc-400">
                {translate('navigate') || 'Maps'}
              </span>
            </div>
          )}

          {/* 4. ID Card / Badge or Log Visit */}
          {onPrintBadge ? (
            <button
              type="button"
              onClick={onPrintBadge}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 active:scale-95 transition cursor-pointer touch-manipulation"
            >
              <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs">
                <IdCard className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                {translate('print_id_badge') || 'ID Card'}
              </span>
            </button>
          ) : onLogVisit ? (
            <button
              type="button"
              onClick={onLogVisit}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 active:scale-95 transition cursor-pointer touch-manipulation"
            >
              <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200">
                {translate('log_visit') || 'Visit'}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 opacity-40 cursor-not-allowed">
              <div className="w-9 h-9 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-500 flex items-center justify-center">
                <IdCard className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-zinc-400">ID Card</span>
            </div>
          )}
        </div>

        {/* Scrollable Information Body with Universal Copy & Action Fields */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-3.5 py-3 pr-1 text-xs">
          {/* Section: Academic & Church Life (Drill-Down Links) */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Academic & Ministry Enrollment</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-zinc-400 block">{translate('school')}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CopyableField
                    value={kid.info.school}
                    label={translate('school')}
                    compact
                  />
                  {kid.info.schoolType && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {kid.info.schoolType}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block">{translate('class')}</span>
                {onSelectClass && currentClassId ? (
                  <button
                    type="button"
                    onClick={() => onSelectClass(currentClassId)}
                    className="font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer text-start flex items-center gap-1"
                  >
                    <span>{className}</span>
                    <span className="text-[10px]">➔</span>
                  </button>
                ) : (
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{className}</span>
                )}
              </div>

              <div>
                <span className="text-zinc-400 block">{translate('service_group')}</span>
                {onSelectServiceGroup && currentGroupId ? (
                  <button
                    type="button"
                    onClick={() => onSelectServiceGroup(currentGroupId)}
                    className="font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer text-start flex items-center gap-1"
                  >
                    <span>{groupName}</span>
                    <span className="text-[10px]">➔</span>
                  </button>
                ) : (
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{groupName}</span>
                )}
              </div>

              <div>
                <span className="text-zinc-400 block">{translate('academic_year')}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {kid.activeAssignment?.academicYearId || kid.academicYearId || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Family & Contacts (Full Action Group with Call, WhatsApp, and 1-Tap Copy) */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-3">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{translate('family_contacts_group') || 'Family & Contacts'}</span>
            </h3>

            {/* Father Actions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">
                  <span>👨 {translate('father') || 'Father'}: </span>
                  <span>{kid.contacts?.fatherName || '-'}</span>
                </span>
                {kid.contacts?.fatherProfession && (
                  <span className="text-[10px] text-zinc-400">
                    {kid.contacts.fatherProfession}
                  </span>
                )}
              </div>
              {fatherPhone && (
                <PhoneActionGroup
                  phone={fatherPhone}
                  label="Father Mobile"
                  personName={kid.contacts?.fatherName}
                />
              )}
            </div>

            {/* Mother Actions */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">
                  <span>👩 {translate('mother') || 'Mother'}: </span>
                  <span>{kid.contacts?.motherName || '-'}</span>
                </span>
                {kid.contacts?.motherProfession && (
                  <span className="text-[10px] text-zinc-400">
                    {kid.contacts.motherProfession}
                  </span>
                )}
              </div>
              {motherPhone && (
                <PhoneActionGroup
                  phone={motherPhone}
                  label="Mother Mobile"
                  personName={kid.contacts?.motherName}
                />
              )}
            </div>

            {/* Student Actions */}
            {kidPhone && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs block">
                  🧒 Student Mobile:
                </span>
                <PhoneActionGroup
                  phone={kidPhone}
                  label="Student Mobile"
                  personName={kid.info.fullName}
                />
              </div>
            )}

            {/* Student DOB & Age */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-400 block">{translate('dob')}</span>
                <CopyableField
                  value={safeRender(kid.info?.dob)}
                  label={translate('dob')}
                  compact
                />
              </div>
              <div>
                <span className="text-zinc-400 block">{translate('age') || 'Age'}</span>
                <CopyableField
                  value={calculatedAge}
                  label="Age"
                  compact
                />
              </div>
            </div>
          </div>

          {/* Section: Residence & Address with 1-Tap Copy */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2">
            <h3 className="font-bold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>{translate('address_group') || 'Address & Location'}</span>
            </h3>
            
            <CopyableField
              label="Physical Address"
              value={fullAddress}
              actionUrl={navUrl}
              actionLabel="Open in Google / Apple Maps"
              actionIcon={<Navigation className="w-3.5 h-3.5" />}
            />

            {kid.address?.landmark && (
              <CopyableField
                label="Landmark"
                value={kid.address.landmark}
                compact
              />
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
                <CopyableField
                  value={kid.info?.fatherOfConfession}
                  label="Father of Confession"
                  compact
                />
              </div>
              <div>
                <span className="text-zinc-400 block">Deacon</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {kid.info?.deacon ? 'Yes (Ordained ✠)' : 'No'}
                </span>
              </div>
            </div>
            {kid.notes && (
              <div className="pt-2">
                <CopyableField
                  label={translate('notes') || 'Pastoral Notes'}
                  value={kid.notes}
                />
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

      {/* Contact Picker Popover */}
      {contactPicker && (
        <ContactPickerPopover
          personName={kid.info.fullName}
          actionType={contactPicker.actionType}
          contacts={contactPicker.contacts}
          isOpen={!!contactPicker}
          onClose={() => setContactPicker(null)}
        />
      )}
    </div>
  );
};
