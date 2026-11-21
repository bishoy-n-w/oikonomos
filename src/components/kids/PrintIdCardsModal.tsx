import React, { useState } from 'react';
import type { Kid } from '../../types';
import { StudentIdCard } from './StudentIdCard';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { X, Printer, Languages } from 'lucide-react';

export interface PrintIdCardsModalProps {
  kids: Kid[];
  churchId: string;
  churchName: string;
  churchLogoUrl?: string;
  classes: Array<{ id: string; displayName: string }>;
  serviceGroups: Array<{ id: string; displayName: string }>;
  yearName?: string;
  yearBadgeColor?: string;
  onClose: () => void;
}

export const PrintIdCardsModal: React.FC<PrintIdCardsModalProps> = ({
  kids,
  churchId,
  churchName,
  churchLogoUrl,
  classes,
  serviceGroups,
  yearName,
  yearBadgeColor = '#0d9488',
  onClose,
}) => {
  const { language, translate } = useApp();
  const [cardLang, setCardLang] = useState<'en' | 'ar'>(language);
  const isRtl = language === 'ar';

  useModalEscape(onClose, true);

  const handlePrint = () => {
    window.print();
  };

  const getClassName = (classId?: string) => {
    return classes.find((c) => c.id === classId)?.displayName || 'All Classes';
  };

  const getGroupName = (groupId?: string) => {
    return serviceGroups.find((g) => g.id === groupId)?.displayName || '';
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[92dvh] flex flex-col cursor-default"
      >
        {/* Header (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3 shrink-0 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100">
                {translate('batch_print_title')}
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                {kids.length} {translate('print_cards_count')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {translate('cards_per_page_hint')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => setCardLang((prev) => (prev === 'en' ? 'ar' : 'en'))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{cardLang === 'ar' ? 'العربية' : 'English'}</span>
            </button>

            {/* Print Trigger Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>{translate('print_now')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Grid Container */}
        <div className="flex-1 overflow-y-auto py-6 pe-2">
          {kids.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-xs">
              No students selected for printing.
            </div>
          ) : (
            <div
              id="printable-id-sheet"
              dir={isRtl ? 'rtl' : 'ltr'}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:bg-white print:border-none print:p-0 print:gap-2 print:m-0"
            >
              {kids.map((kid) => (
                <div
                  key={kid.id}
                  className="print:break-inside-avoid print:mb-2 p-1 border border-dashed border-zinc-300 rounded-2xl bg-white"
                >
                  <StudentIdCard
                    kid={kid}
                    churchId={churchId}
                    churchName={churchName}
                    churchLogoUrl={churchLogoUrl}
                    className={getClassName(kid.activeAssignment?.classId || kid.classId)}
                    serviceGroupName={getGroupName(kid.activeAssignment?.serviceGroupId || kid.serviceGroupId)}
                    yearName={yearName}
                    yearBadgeColor={yearBadgeColor}
                    lang={cardLang}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print Stylesheet Hook */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-id-sheet, #printable-id-sheet * {
              visibility: visible !important;
            }
            #printable-id-sheet {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 4mm !important;
              background: white !important;
            }
            .student-id-card {
              box-shadow: none !important;
              border: 1px solid #d4d4d8 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
          }
        `}} />
      </div>
    </div>
  );
};
