import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import { MainShell, type ActiveTab } from './components/layout/MainShell';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { KidsDirectoryScreen } from './screens/KidsDirectoryScreen';
import { ServantsDirectoryScreen } from './screens/ServantsDirectoryScreen';
import { AttendanceTrackerScreen } from './screens/AttendanceTrackerScreen';
import { ClassesScreen } from './screens/ClassesScreen';
import { ServiceGroupsScreen } from './screens/ServiceGroupsScreen';
import { ChurchesScreen } from './screens/ChurchesScreen';

const AuthenticatedApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-zinc-500">Loading Oikonomos...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <FilterProvider>
      <MainShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'dashboard' && <DashboardScreen onNavigate={setActiveTab} />}
        {activeTab === 'kids' && <KidsDirectoryScreen />}
        {activeTab === 'servants' && <ServantsDirectoryScreen />}
        {activeTab === 'attendance' && <AttendanceTrackerScreen />}
        {activeTab === 'classes' && <ClassesScreen />}
        {activeTab === 'service_groups' && <ServiceGroupsScreen />}
        {activeTab === 'home_visits' && <DashboardScreen onNavigate={setActiveTab} />}
        {activeTab === 'churches_config' && <ChurchesScreen />}
      </MainShell>
    </FilterProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </AppProvider>
  );
};

export default App;
