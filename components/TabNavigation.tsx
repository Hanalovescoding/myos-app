import React from 'react';
import { AppTab } from '../types';
import { PlusCircle, CalendarCheck, BrainCircuit } from 'lucide-react';

interface TabNavigationProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ currentTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-2 pb-6 z-50 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button
        onClick={() => onTabChange(AppTab.INPUT)}
        className={`flex flex-col items-center space-y-1 transition-colors duration-200 ${
          currentTab === AppTab.INPUT ? 'text-indigo-600' : 'text-slate-400'
        }`}
      >
        <PlusCircle className={`w-7 h-7 ${currentTab === AppTab.INPUT ? 'fill-indigo-100' : ''}`} />
        <span className="text-xs font-medium">Input</span>
      </button>

      <button
        onClick={() => onTabChange(AppTab.TODAY)}
        className={`flex flex-col items-center space-y-1 transition-colors duration-200 ${
          currentTab === AppTab.TODAY ? 'text-indigo-600' : 'text-slate-400'
        }`}
      >
        <CalendarCheck className={`w-7 h-7 ${currentTab === AppTab.TODAY ? 'fill-indigo-100' : ''}`} />
        <span className="text-xs font-medium">Today</span>
      </button>

      <button
        onClick={() => onTabChange(AppTab.MEMORY)}
        className={`flex flex-col items-center space-y-1 transition-colors duration-200 ${
          currentTab === AppTab.MEMORY ? 'text-indigo-600' : 'text-slate-400'
        }`}
      >
        <BrainCircuit className={`w-7 h-7 ${currentTab === AppTab.MEMORY ? 'fill-indigo-100' : ''}`} />
        <span className="text-xs font-medium">Memory</span>
      </button>
    </div>
  );
};

export default TabNavigation;
