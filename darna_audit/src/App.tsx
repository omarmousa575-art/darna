import React from 'react';
import { FamilyProvider, useFamily } from './context/FamilyContext';
import { AppLayout } from './components/AppLayout';
import { AuthScreen } from './components/AuthScreen';
import { PendingScreen } from './components/PendingScreen';
import { CouncilTab } from './components/CouncilTab';
import { CallsTab } from './components/CallsTab';
import { FamilyTab } from './components/FamilyTab';
import { AssistantTab } from './components/AssistantTab';
import { SettingsTab } from './components/SettingsTab';
import { ChatConversationView } from './components/ChatConversationView';
import { BottomNavBar } from './components/BottomNavBar';
import { VoiceCallModal } from './components/VoiceCallModal';
import { ViewOnceModal } from './components/ViewOnceModal';
import { SetAvatarModal } from './components/SetAvatarModal';

const MainAppRouter: React.FC = () => {
  const { currentUser, activeTab, activeChatId, isAvatarModalOpen, closeAvatarModal } = useFamily();

  // State A: Logged Out -> Strictly Render AuthScreen first
  if (!currentUser) {
    return <AuthScreen />;
  }

  // State B: Logged In but PENDING -> Strictly Render PendingScreen (Locked)
  if (currentUser.status === 'PENDING') {
    return <PendingScreen />;
  }

  // State C: Logged In & ACTIVE -> Render Main Application Shell with 5 Primary Tabs
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeChatId ? (
          <ChatConversationView chatId={activeChatId} />
        ) : (
          <>
            {(activeTab === 'chats' || activeTab === 'council') && <CouncilTab />}
            {activeTab === 'calls' && <CallsTab />}
            {(activeTab === 'family' || activeTab === 'directory' || activeTab === 'admin') && <FamilyTab />}
            {activeTab === 'assistant' && <AssistantTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </>
        )}
      </div>

      {/* Permanently Fixed Bottom Navigation Bar (Hidden only inside an open chat) */}
      {!activeChatId && <BottomNavBar />}

      {/* Voice Call & View Once Overlays */}
      <VoiceCallModal />
      <ViewOnceModal />
      <SetAvatarModal isOpen={isAvatarModalOpen} onClose={closeAvatarModal} />
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    // Never erase cached conversations as a side effect of a rendering error.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-teal-800/80 border border-teal-500/40 text-teal-300 flex items-center justify-center text-3xl mb-4 shadow-xl">
            🏡
          </div>
          <h2 className="text-xl font-bold text-white mb-2">مرحباً بك في تطبيق دارنا</h2>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed mb-6">
            حدث تحديث طفيف في البيانات. يرجى الضغط على زر "إعادة التحميل" للعودة إلى التطبيق فوراً.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-lg transition"
          >
            إعادة التحميل وبدء الاستخدام 🔄
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <FamilyProvider>
        <AppLayout>
          <MainAppRouter />
        </AppLayout>
      </FamilyProvider>
    </AppErrorBoundary>
  );
}
