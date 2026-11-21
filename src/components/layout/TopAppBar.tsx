import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useFilter } from '../../context/FilterContext';
import { APP_FULL_VERSION } from '../../config/version';
import { usePwaInstall } from '../../utils/usePwaInstall';
import { PwaInstallPromptModal } from '../common/PwaInstallPromptModal';
import type { ActiveTab } from './MainShell';
import { 
  Sun, 
  Moon, 
  Languages, 
  LogOut, 
  UserCheck, 
  Filter as FilterIcon, 
  Church as ChurchIcon,
  ChevronDown,
  Smartphone
} from 'lucide-react';

interface TopAppBarProps {
  activeTab?: ActiveTab;
  onOpenMobileFilters: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ activeTab, onOpenMobileFilters }) => {
  const { user, userRole, logout, login } = useAuth();
  const { language, setLanguage, theme, toggleTheme, translate } = useApp();
  const { 
    churches, 
    academicYears, 
    serviceGroups, 
    classes, 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId, 
    setChurch, 
    setAcademicYear, 
    setServiceGroup, 
    setClass 
  } = useFilter();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, hasDeferredPrompt, isIos, triggerInstall } = usePwaInstall();
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [userImgFailed, setUserImgFailed] = useState(false);

  useEffect(() => {
    setUserImgFailed(false);
  }, [user?.photoURL]);

  // Context-aware dimming rules as mandated by specs:
  // - Church Admin: dim church, academic year, class group, and class
  // - Service Groups: church active; dim year, group, and class
  // - Classes: church, year, group active; dim class
  // - Kids, Misters, Attendance, Dashboard: all active
  const dimChurch = activeTab === 'churches_config';
  const dimYear = activeTab === 'churches_config' || activeTab === 'service_groups';
  const dimGroup = activeTab === 'churches_config' || activeTab === 'service_groups';
  const dimClass = activeTab === 'churches_config' || activeTab === 'service_groups' || activeTab === 'classes';

  const activeChurch = churches.find((c) => c.id === selectedChurchId);

  // Close menu on click or touch outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20 overflow-hidden shrink-0">
          {activeChurch?.logoUrl ? (
            <img 
              src={activeChurch.logoUrl} 
              alt={activeChurch.displayName} 
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              className="w-full h-full object-cover" 
            />
          ) : (
            <ChurchIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight truncate">
            {activeChurch?.displayName || 'Oikonomos'}
          </h1>
          <span className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Sunday School CRM
          </span>
        </div>
      </div>

      {/* Desktop Cascading Filters (Hidden on Mobile) */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* 1. Church Dropdown (Bigger, Unique Shape, Never accepts All) */}
        <div className={`relative transition-all ${dimChurch ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center">
            <select
              value={selectedChurchId || ''}
              disabled={dimChurch || churches.length === 0}
              onChange={(e) => setChurch(e.target.value)}
              className="appearance-none font-black text-sm bg-gradient-to-r from-teal-600 to-teal-700 text-white ps-4 pe-9 py-2.5 rounded-2xl shadow-md shadow-teal-700/20 border-2 border-teal-500/80 hover:from-teal-700 hover:to-teal-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {churches.length === 0 && (
                <option value="" disabled className="text-zinc-800 bg-white">No Church Assigned</option>
              )}
              {churches.map((c) => (
                <option key={c.id} value={c.id} className="text-zinc-900 bg-white font-bold">
                  {c.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-white/90 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 2. Academic Year Dropdown (2nd in size, to the right, with Active icon, Never accepts All) */}
        <div className={`relative transition-all ${dimYear ? 'opacity-30 pointer-events-none' : ''}`}>
          <select
            value={selectedAcademicYearId || ''}
            disabled={dimYear || academicYears.length === 0}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="appearance-none font-bold text-xs md:text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 ps-3.5 pe-8 py-2 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer focus:outline-none"
          >
            {academicYears.length === 0 && (
              <option value="" disabled>No Year Found</option>
            )}
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.isActiveYear ? `⭐ ${y.displayName} ${translate('active_term_badge')}` : y.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* 3. Service Group Dropdown (Accepts All) */}
        <div className={`relative transition-all ${dimGroup ? 'opacity-30 pointer-events-none' : ''}`}>
          <select
            value={selectedServiceGroupId || ''}
            disabled={dimGroup}
            onChange={(e) => setServiceGroup(e.target.value ? e.target.value : null)}
            className="appearance-none text-xs font-semibold bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 ps-3 pe-7 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-teal-500 transition cursor-pointer focus:outline-none"
          >
            <option value="">{translate('all')} {translate('service_groups')}</option>
            {serviceGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* 4. Class Dropdown (Accepts All) */}
        <div className={`relative transition-all ${dimClass ? 'opacity-30 pointer-events-none' : ''}`}>
          <select
            value={selectedClassId || ''}
            disabled={dimClass}
            onChange={(e) => setClass(e.target.value ? e.target.value : null)}
            className="appearance-none text-xs font-semibold bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 ps-3 pe-7 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-teal-500 transition cursor-pointer focus:outline-none"
          >
            <option value="">{translate('all')} {translate('classes')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Right Controls: Mobile Filter Button + Profile Menu */}
      <div className="flex items-center gap-2">
        {/* Mobile Filter Trigger Button with Active Context */}
        {(() => {
          const activeClassObj = classes.find((c) => c.id === selectedClassId);
          const activeGroupObj = serviceGroups.find((g) => g.id === selectedServiceGroupId);
          
          let activeContextLabel: string;
          if (activeClassObj) {
            // 1. Specific Class selected
            activeContextLabel = activeClassObj.displayName;
          } else if (activeGroupObj) {
            // 2. Specific Group selected + All Classes
            activeContextLabel = `${activeGroupObj.displayName} ${translate('all_scope')}`;
          } else {
            // 3. All Groups + All Classes (Church-Wide)
            activeContextLabel = translate('all_church');
          }

          return (
            <button
              onClick={onOpenMobileFilters}
              className="lg:hidden min-h-[44px] flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 rounded-full border border-teal-200 dark:border-teal-800 transition active:scale-95 touch-manipulation max-w-[175px]"
              aria-label={translate('filter')}
            >
              <FilterIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {activeContextLabel}
              </span>
            </button>
          );
        })()}

        {/* Install PWA Button (Visible when site is not installed) */}
        {isInstallable && (
          <button
            type="button"
            onClick={() => setPwaModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 rounded-full border border-amber-200 dark:border-amber-800 transition active:scale-95 touch-manipulation cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-2xs"
            title={translate('install_app')}
            aria-label={translate('install_app')}
          >
            <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">{translate('install_app')}</span>
          </button>
        )}

        {/* Profile Avatar & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-full border-2 border-teal-600/30 overflow-hidden hover:ring-2 hover:ring-teal-500 transition touch-manipulation cursor-pointer"
            aria-label="User profile menu"
          >
            {user?.photoURL && !userImgFailed ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                referrerPolicy="no-referrer"
                onError={() => setUserImgFailed(true)}
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-700 dark:text-teal-200 font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </button>

          {/* Google-Style Dropdown Menu */}
          {menuOpen && (
            <div className="absolute end-0 mt-2 w-72 rounded-2xl bg-white dark:bg-zinc-800 shadow-2xl border border-zinc-200 dark:border-zinc-700 py-3 z-50 animate-in fade-in zoom-in-95">
              {/* User Identity Info */}
              <div className="px-4 pb-3 border-b border-zinc-100 dark:border-zinc-700/60">
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                  <UserCheck className="w-3 h-3" />
                  <span>{userRole.toUpperCase()}</span>
                </div>
              </div>

              {/* Preferences Toggles */}
              <div className="py-2 border-b border-zinc-100 dark:border-zinc-700/60">
                {/* Theme Toggle */}
                <button
                  onClick={() => toggleTheme()}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                >
                  <span className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-teal-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    {theme === 'dark' ? translate('theme_dark') : translate('theme_light')}
                  </span>
                  <span className="text-zinc-400 capitalize">{theme}</span>
                </button>

                {/* Language Toggle */}
                <button
                  onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                >
                  <span className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-teal-600" />
                    {translate('language')}
                  </span>
                  <span className="text-zinc-400 uppercase font-semibold">{language === 'en' ? 'العربية' : 'English'}</span>
                </button>

                {/* Install App Link */}
                {isInstallable && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setPwaModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-600" />
                      <span>{translate('install_app')}</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      PWA
                    </span>
                  </button>
                )}
              </div>

              {/* Account Actions */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    login(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                >
                  <UserCheck className="w-4 h-4 text-zinc-500" />
                  <span>{translate('switch_account')}</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{translate('sign_out')}</span>
                </button>
              </div>

              {/* Version Footer */}
              <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-700/60 text-[11px] text-zinc-400 dark:text-zinc-500 text-center font-mono">
                {APP_FULL_VERSION}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PWA Install Guide & Trigger Modal */}
      {pwaModalOpen && (
        <PwaInstallPromptModal
          isOpen={pwaModalOpen}
          onClose={() => setPwaModalOpen(false)}
          hasDeferredPrompt={hasDeferredPrompt}
          isIos={isIos}
          onTriggerInstall={triggerInstall}
        />
      )}
    </header>
  );
};
