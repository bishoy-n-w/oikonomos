import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import type { AttendanceEventType } from '../../types';
import { X, Calendar, RefreshCw } from 'lucide-react';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: { title: string; type: AttendanceEventType; eventDate: string }) => Promise<void>;
}

export const NewEventModal: React.FC<NewEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, isOpen);

  const [title, setTitle] = useState('Sunday School Lesson');
  const [type, setType] = useState<AttendanceEventType>('lesson');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        type,
        eventDate,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to create event:', err);
      alert(`Error creating event: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {translate('new_event')}
            </h3>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <fieldset disabled={isSaving} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {translate('event_title')} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Weekly Sunday School Lesson"
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              />
            </div>

            {/* Event Type & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('event_type')} *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AttendanceEventType)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
                >
                  <option value="lesson">{translate('lesson')}</option>
                  <option value="liturgy">{translate('liturgy')}</option>
                  <option value="hymns">{translate('hymns')}</option>
                  <option value="activity">{translate('activity')}</option>
                  <option value="trip">{translate('trip')}</option>
                  <option value="other">{translate('other')}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('event_date')} *
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                {translate('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
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
