import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutGrid, List } from 'lucide-react';

interface MobileViewToggleProps {
  compact?: boolean;
}

export const MobileViewToggle: React.FC<MobileViewToggleProps> = ({ compact = false }) => {
  const { mobileViewMode, setMobileViewMode, translate } = useApp();

  return (
    <div className="flex items-center p-0.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 shadow-2xs">
      <button
        type="button"
        onClick={() => setMobileViewMode('tiles')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none active:scale-95 ${
          mobileViewMode === 'tiles'
            ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-2xs'
            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
        title={translate('view_tiles')}
        aria-label={translate('view_tiles')}
      >
        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span className="text-[11px] leading-none">{translate('view_tiles')}</span>}
      </button>
      <button
        type="button"
        onClick={() => setMobileViewMode('list')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none active:scale-95 ${
          mobileViewMode === 'list'
            ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-2xs'
            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
        title={translate('view_list')}
        aria-label={translate('view_list')}
      >
        <List className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span className="text-[11px] leading-none">{translate('view_list')}</span>}
      </button>
    </div>
  );
};
