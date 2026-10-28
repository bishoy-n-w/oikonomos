import React, { useState } from 'react';
import type { Kid } from '../../types';
import { syncKidsToGoogleContacts, type SyncResult } from '../../services/googleContacts';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { X, RefreshCw, CheckCircle, AlertCircle, BookUser } from 'lucide-react';

interface GoogleContactsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  kids: Kid[];
  churchName: string;
  className: string;
  yearName: string;
}

export const GoogleContactsSyncModal: React.FC<GoogleContactsSyncModalProps> = ({
  isOpen,
  onClose,
  kids,
  churchName,
  className,
  yearName,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, isOpen);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncKidsToGoogleContacts(kids, churchName, className, yearName);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        totalSynced: 0,
        groupName: '',
        error: err.message || 'Synchronization failed.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto cursor-default"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <BookUser className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {translate('sync_contacts')}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={syncing}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Content */}
        <div className="py-4 space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {translate('sync_description')}
          </p>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Target Group:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                [Oikonomos] {className || 'All Classes'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Year / Term:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{yearName || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Student Contacts:</span>
              <span className="font-bold text-teal-600 dark:text-teal-400">{kids.length} kids</span>
            </div>
          </div>

          {/* Sync Status Feedback */}
          {result && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                result.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {result.success ? translate('sync_success') : 'Sync Failed'}
                </p>
                <p className="mt-0.5 opacity-90 leading-relaxed">
                  {result.success
                    ? `Successfully synchronized ${result.totalSynced} contacts into Google Contacts under group "${result.groupName}". They will automatically appear on your phone within moments.`
                    : result.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={syncing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            {translate('cancel')}
          </button>
          <button
            onClick={handleStartSync}
            disabled={syncing || kids.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition shadow-md shadow-teal-600/30 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? translate('syncing_contacts') : translate('sync_contacts')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
