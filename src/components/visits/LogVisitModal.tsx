import React, { useState, useEffect } from 'react';
import { 
  X, 
  Home, 
  Calendar, 
  Check, 
  RefreshCw,
  AlertCircle,
  Navigation
} from 'lucide-react';
import type { Kid, Mister, HomeVisit, VisitType } from '../../types';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { captureDeviceGpsLocation } from '../../utils/geo';

interface LogVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    visitData: Omit<HomeVisit, 'id' | 'createdAt' | 'createdBy'>, 
    existingId?: string,
    capturedGeo?: string
  ) => Promise<void>;
  preselectedKidId?: string;
  existingVisit?: HomeVisit | null;
  kids: Kid[];
  misters: Mister[];
  currentServantEmail?: string;
}

export const LogVisitModal: React.FC<LogVisitModalProps> = ({
  isOpen,
  onClose,
  onSave,
  preselectedKidId,
  existingVisit,
  kids,
  misters,
  currentServantEmail,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, isOpen);

  const [kidId, setKidId] = useState(existingVisit?.kidId || preselectedKidId || (kids[0]?.id || ''));
  const [visitDate, setVisitDate] = useState(existingVisit?.visitDate || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<VisitType>(existingVisit?.type || 'home_visit');
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<string[]>(() => {
    if (existingVisit?.visitorMisterIds?.length) return existingVisit.visitorMisterIds;
    if (currentServantEmail) return [currentServantEmail.toLowerCase().trim()];
    return [];
  });
  const [notes, setNotes] = useState(existingVisit?.notes || '');
  const [needsFollowUp, setNeedsFollowUp] = useState(Boolean(existingVisit?.needsFollowUp));
  const [followUpDate, setFollowUpDate] = useState(existingVisit?.followUpDate || '');
  const [saveCurrentGps, setSaveCurrentGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKidId(existingVisit?.kidId || preselectedKidId || (kids[0]?.id || ''));
      setVisitDate(existingVisit?.visitDate || new Date().toISOString().split('T')[0]);
      setType(existingVisit?.type || 'home_visit');
      if (existingVisit?.visitorMisterIds?.length) {
        setSelectedVisitorIds(existingVisit.visitorMisterIds);
      } else if (currentServantEmail) {
        setSelectedVisitorIds([currentServantEmail.toLowerCase().trim()]);
      } else {
        setSelectedVisitorIds([]);
      }
      setNotes(existingVisit?.notes || '');
      setNeedsFollowUp(Boolean(existingVisit?.needsFollowUp));
      setFollowUpDate(existingVisit?.followUpDate || '');
      setSaveCurrentGps(false);
      setIsSaving(false);
    }
  }, [isOpen, existingVisit, preselectedKidId, kids, currentServantEmail]);

  if (!isOpen) return null;

  const handleToggleVisitor = (emailKey: string) => {
    const key = emailKey.toLowerCase().trim();
    if (selectedVisitorIds.includes(key)) {
      setSelectedVisitorIds(selectedVisitorIds.filter((id) => id !== key));
    } else {
      setSelectedVisitorIds([...selectedVisitorIds, key]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kidId) {
      alert('Please select a student.');
      return;
    }
    if (!visitDate) {
      alert('Please select a visit date.');
      return;
    }

    setIsSaving(true);
    try {
      let capturedGeo: string | undefined = undefined;
      if (saveCurrentGps) {
        try {
          const gps = await captureDeviceGpsLocation();
          capturedGeo = gps.geoUri;
        } catch (gpsErr: any) {
          console.warn('GPS capture error during visit save:', gpsErr);
          alert(`Notice: ${gpsErr.message || 'Could not capture GPS location.'} Proceeding to save visit.`);
        }
      }

      await onSave(
        {
          kidId,
          academicYearId: '', // populated by caller
          classId: '', // populated by caller
          visitDate,
          type,
          visitorMisterIds: selectedVisitorIds,
          notes: notes.trim(),
          needsFollowUp,
          followUpDate: needsFollowUp ? followUpDate || undefined : undefined,
        },
        existingVisit?.id,
        capturedGeo
      );
      onClose();
    } catch (err: any) {
      alert(`Error saving visit: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedKid = kids.find((k) => k.id === kidId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {existingVisit ? translate('edit') : translate('log_visit')}
              </h3>
              <p className="text-[11px] text-zinc-400">Record pastoral care and family interactions</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSaving} 
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <fieldset disabled={isSaving} className="space-y-4">
            {/* Target Student */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {translate('student_full_name')} *
              </label>
              <select
                value={kidId}
                onChange={(e) => setKidId(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.info.fullName} {k.address?.region ? `(${k.address.region})` : ''}
                  </option>
                ))}
              </select>
              {selectedKid?.address?.landmark && (
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-1">
                  📍 {translate('landmark')}: {selectedKid.address.landmark}
                </p>
              )}
            </div>

            {/* Date & Interaction Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{translate('event_date')} *</span>
                  </span>
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('event_type')} *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as VisitType)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
                >
                  <option value="home_visit">🏠 {translate('visit_type_home')}</option>
                  <option value="phone_call">📞 {translate('visit_type_phone')}</option>
                  <option value="hospital">🏥 {translate('visit_type_hospital')}</option>
                  <option value="church_meeting">⛪ {translate('visit_type_church')}</option>
                </select>
              </div>
            </div>

            {/* Attending Servants */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {translate('attending_servants')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
                {misters.map((m) => {
                  const emailKey = (m.email || m.id || '').toLowerCase().trim();
                  const isChecked = selectedVisitorIds.includes(emailKey);
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleVisitor(emailKey)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-[11px] cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-teal-50 dark:bg-teal-950/80 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-bold'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <span className="truncate">{m.displayName}</span>
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ms-1 ${
                        isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pastoral Notes */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {translate('pastoral_notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Family situation, spiritual discussions, prayer requests..."
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
              />
            </div>

            {/* Needs Follow-Up Toggle */}
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={needsFollowUp}
                  onChange={(e) => setNeedsFollowUp(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{translate('needs_follow_up')}</span>
                </span>
              </label>
              {needsFollowUp && (
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    {translate('follow_up_date')}
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Optional GPS Capture if kid has no location */}
            {selectedKid && !selectedKid.address?.geoLocation && (
              <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveCurrentGps}
                    onChange={(e) => setSaveCurrentGps(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-teal-900 dark:text-teal-200 text-xs flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-teal-600" />
                    <span>{translate('save_gps_with_visit')}</span>
                  </span>
                </label>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {translate('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isSaving ? translate('saving') : translate('save')}</span>
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
