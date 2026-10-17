import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useFilter } from '../../context/FilterContext';
import { 
  Sun, 
  Moon, 
  Languages, 
  LogOut, 
  UserCheck, 
  Filter as FilterIcon, 
  Church as ChurchIcon,
  ChevronDown
} from 'lucide-react';

interface TopAppBarProps {
  onOpenMobileFilters: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ onOpenMobileFilters }) => {
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

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20">
          <ChurchIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
            Oikonomos
          </h1>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Sunday School CRM
          </span>
        </div>
      </div>

      {/* Desktop Cascading Filters (Hidden on Mobile) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* 1. Church Dropdown (Anchor) */}
        <div className="relative">
          <select
            value={selectedChurchId || ''}
            onChange={(e) => setChurch(e.target.value)}
            className="appearance-none font-bold text-sm bg-teal-600 text-white px-4 py-2 pe-8 rounded-xl shadow-sm hover:bg-teal-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            {churches.map((c) => (
              <option key={c.id} value={c.id} className="text-zinc-900 bg-white">
                {c.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-white/80 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* 2. Academic Year Dropdown */}
        <div className="relative">
          <select
            value={selectedAcademicYearId || ''}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="appearance-none text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-3 py-2 pe-7 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer focus:outline-none"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* 3. Service Group Dropdown */}
        <div className="relative">
          <select
            value={selectedServiceGroupId || ''}
            onChange={(e) => setServiceGroup(e.target.value ? e.target.value : null)}
            className="appearance-none text-xs bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 px-3 py-2 pe-7 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-teal-500 transition cursor-pointer focus:outline-none"
          >
            <option value="">{translate('all')} {translate('service_groups')}</option>
            {serviceGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* 4. Class Dropdown */}
        <div className="relative">
          <select
            value={selectedClassId || ''}
            onChange={(e) => setClass(e.target.value ? e.target.value : null)}
            className="appearance-none text-xs bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 px-3 py-2 pe-7 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-teal-500 transition cursor-pointer focus:outline-none"
          >
            <option value="">{translate('all')} {translate('classes')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Right Controls: Mobile Filter Button + Profile Menu */}
      <div className="flex items-center gap-2">
        {/* Mobile Filter Trigger Button */}
        <button
          onClick={onOpenMobileFilters}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 rounded-full border border-teal-200 dark:border-teal-800 transition active:scale-95"
        >
          <FilterIcon className="w-3.5 h-3.5" />
          <span>{translate('filter')}</span>
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-teal-600/30 overflow-hidden hover:ring-2 hover:ring-teal-500 transition"
            aria-label="User profile menu"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
