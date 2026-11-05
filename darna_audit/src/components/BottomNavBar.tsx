import React from 'react';
import { useFamily } from '../context/FamilyContext';
import { MainTab } from '../types';
import { MessageSquare, Phone, Users, Bot, Settings } from 'lucide-react';

export const BottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab, currentUser, users, setActiveChatId, totalUnreadCount } = useFamily();

  if (!currentUser || currentUser.status !== 'ACTIVE') return null;

  const isOwnerOrAdmin =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'FAMILY_OWNER' ||
    currentUser.role === 'FAMILY_ADMIN' ||
    currentUser.phone === '0998803914' ||
    currentUser.id === 'admin_root' ||
    currentUser.name.includes('عمر');

  const pendingApprovalsCount = isOwnerOrAdmin
    ? users.filter((u) => u.status === 'PENDING').length
    : 0;

  const tabs: { id: MainTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'chats',
      label: 'الدردشات',
      icon: <MessageSquare className="w-5 h-5" />,
      badge: totalUnreadCount,
    },
    {
      id: 'calls',
      label: 'المكالمات',
      icon: <Phone className="w-5 h-5" />,
    },
    {
      id: 'family',
      label: 'العائلة',
      icon: <Users className="w-5 h-5" />,
      badge: pendingApprovalsCount,
    },
    {
      id: 'assistant',
      label: 'المساعد',
      icon: <Bot className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 shadow-lg h-16 flex items-center justify-around px-2 select-none" dir="rtl">
      {tabs.map((tab) => {
        const isActive =
          activeTab === tab.id ||
          (tab.id === 'chats' && (activeTab as string) === 'council') ||
          (tab.id === 'family' && ((activeTab as string) === 'directory' || (activeTab as string) === 'admin'));

        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveChatId(null);
              setActiveTab(tab.id);
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all relative ${
              isActive
                ? 'text-teal-700 dark:text-teal-400 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold ring-2 ring-white dark:ring-slate-900 animate-bounce">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] mt-1 leading-none">{tab.label}</span>
            {isActive && <span className="w-1.5 h-1.5 bg-teal-600 dark:bg-teal-400 rounded-full mt-1" />}
          </button>
        );
      })}
    </nav>
  );
};
