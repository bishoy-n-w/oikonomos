import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { TopAppBar } from './TopAppBar';
import { MobileFilterSheet } from './MobileFilterSheet';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  CalendarCheck, 
  GraduationCap, 
  FolderGit2, 
  Home, 
  Building2, 
  Menu, 
  X,
  Lock
} from 'lucide-react';

export type ActiveTab = 
  | 'dashboard' 
  | 'kids' 
  | 'servants' 
  | 'attendance' 
  | 'classes' 
  | 'service_groups' 
  | 'home_visits' 
  | 'churches_config';

interface MainShellProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  children: React.ReactNode;
}

export const MainShell: React.FC<MainShellProps> = ({ activeTab, onTabChange, children }) => {
  const { user, isAuthorized, userRole } = useAuth();
  const { translate } = useApp();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems: Array<{ id: ActiveTab; labelKey: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean }> = [
    { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { id: 'kids', labelKey: 'kids', icon: Users },
    { id: 'servants', labelKey: 'servants', icon: UserCheck },
    { id: 'attendance', labelKey: 'attendance', icon: CalendarCheck },
    { id: 'classes', labelKey: 'classes', icon: GraduationCap },
    { id: 'service_groups', labelKey: 'service_groups', icon: FolderGit2 },
    { id: 'home_visits', labelKey: 'home_visits', icon: Home },
    { id: 'churches_config', labelKey: 'churches_config', icon: Building2, adminOnly: true },
  ];

  // If user is not yet authorized in this church (pending join approval)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <TopAppBar activeTab={activeTab} onOpenMobileFilters={() => setMobileFiltersOpen(true)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {translate('unauthorized_title')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              {translate('unauthorized_desc')}
            </p>
            <div className="text-xs text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl mb-4">
              Signed in as: <span className="font-semibold">{user?.email}</span>
            </div>
          </div>
        </div>
        <MobileFilterSheet activeTab={activeTab} isOpen={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top App Bar */}
      <TopAppBar activeTab={activeTab} onOpenMobileFilters={() => setMobileFiltersOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (lg:flex) */}
        <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-zinc-900 border-e border-zinc-200 dark:border-zinc-800 p-4 shrink-0 transition-colors">
          <nav className="space-y-1.5 flex-1">
            {navItems.map((item) => {
              if (item.adminOnly && userRole === 'viewer') return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{translate(item.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 text-center">
            Oikonomos Web v3.1
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation (< lg) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                isActive ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {translate(item.labelKey)}
              </span>
            </button>
          );
        })}

        {/* More Drawer Button */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            ['classes', 'service_groups', 'home_visits', 'churches_config'].includes(activeTab)
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-zinc-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">
            {translate('settings')}
          </span>
        </button>
      </nav>

      {/* Mobile Settings Slide-over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-72 bg-white dark:bg-zinc-900 h-full p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {translate('settings')}
              </h3>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 flex-1">
              {navItems.slice(4).map((item) => {
                if (item.adminOnly && userRole === 'viewer') return null;
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-teal-600 text-white'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{translate(item.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cascading Filter Bottom Sheet */}
      <MobileFilterSheet
        activeTab={activeTab}
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
      />
    </div>
  );
};
