import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { generateRecurringDates } from '../../utils/recurringEvents';
import { DEFAULT_EVENT_TYPES, type AttendanceEventType } from '../../types';
import { X, Calendar, RefreshCw, Sparkles } from 'lucide-react';

interface RecurringEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (events: Array<{ title: string; type: AttendanceEventType; eventDate: string }>, seriesId: string) => Promise<void>;
  defaultStartDate?: string;
  availableEventTypes?: Array<{ id: string; name: string }>;
}

export const RecurringEventModal: React.FC<RecurringEventModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  defaultStartDate,
  availableEventTypes,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, isOpen);

  const fallbackTypes = (availableEventTypes && availableEventTypes.length > 0)
    ? availableEventTypes
    : DEFAULT_EVENT_TYPES.map((t) => ({ id: t, name: t }));

  const [title, setTitle] = useState('Sunday School Lesson');
  const [type, setType] = useState<AttendanceEventType>(() => fallbackTypes[0]?.name || 'Sunday School');
  const [dayOfWeek, setDayOfWeek] = useState<number>(0); // 0 = Sunday
  const [startDate, setStartDate] = useState(() => defaultStartDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 9); // default ~academic year
    return d.toISOString().split('T')[0];
  });
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // Calculate matching dates
  const previewDates = generateRecurringDates({
    startDate,
    endDate,
    dayOfWeek,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || previewDates.length === 0) return;

    setIsGenerating(true);
    try {
      const seriesId = `series_${Date.now()}`;
      const eventList = previewDates.map((dateStr) => ({
        title: title.trim(),
        type,
        eventDate: dateStr,
      }));

      await onGenerate(eventList, seriesId);
      onClose();
    } catch (err: any) {
      console.error('Failed to generate recurring events:', err);
      alert(`Error generating events: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {translate('create_recurring_title')}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Generate a full term schedule in one click
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <fieldset disabled={isGenerating} className="space-y-4">
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
                placeholder="e.g. Sunday School Lesson"
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              />
            </div>

            {/* Event Type & Day of Week */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('event_type')} *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
                >
                  {fallbackTypes.map((ft) => (
                    <option key={ft.id} value={ft.name}>
                      {translate(ft.name.toLowerCase().replace(/\s+/g, '_')) || ft.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('frequency')} *
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
                >
                  <option value={0}>{translate('sunday')}</option>
                  <option value={5}>{translate('friday')}</option>
                  <option value={6}>{translate('saturday')}</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('start_date')} *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {translate('end_date')} *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
            </div>

            {/* Preview Banner */}
            <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200">
                <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-bold">
                  {previewDates.length} {translate('events_generated')}
                </span>
              </div>
              <span className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                {previewDates[0] || '-'} ➔ {previewDates[previewDates.length - 1] || '-'}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isGenerating}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                {translate('cancel')}
              </button>
              <button
                type="submit"
                disabled={isGenerating || previewDates.length === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50"
              >
                {isGenerating && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isGenerating ? translate('saving') : `Generate ${previewDates.length} Sessions`}</span>
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
