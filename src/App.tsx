import React, { useState } from 'react';
import { BarChart3, Building, LogOut, Plus, Settings, User } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Projects } from './components/Projects';
import { AddExpense } from './components/AddExpense';
import { Settings as SettingsComponent } from './components/Settings';
import { Auth } from './components/Auth';
import { useAuth } from './hooks/useAuth';
import { TabType } from './types';

function App() {
  const { session, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3, component: Dashboard },
    { id: 'projects', name: 'Projects', icon: Building, component: Projects },
    { id: 'add-expense', name: 'Add Expense', icon: Plus, component: AddExpense },
    { id: 'settings', name: 'Settings', icon: Settings, component: SettingsComponent },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-black text-white pb-20 lg:pb-0" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 lg:py-4 relative z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Building className="h-5 w-5 lg:h-6 lg:w-6 text-black" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold">Construction Tracker</h1>
              <p className="text-xs lg:text-sm text-gray-400 hidden sm:block">Expense Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-500 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-black" />
            </div>
            <button
              onClick={() => signOut()}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex relative">
        {/* Desktop Sidebar */}
        <nav className="hidden lg:block w-64 bg-gray-900 border-r border-gray-800 min-h-screen p-4">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <ActiveComponent />
        </main>
      </div>

      {/* Mobile Floating Footer Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1 ${
                  isActive
                    ? 'text-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-yellow-500' : ''}`} />
                <span className={`text-xs font-medium truncate ${
                  isActive ? 'text-yellow-500' : 'text-gray-400'
                }`}>
                  {tab.name === 'Add Expense' ? 'Add' : tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;