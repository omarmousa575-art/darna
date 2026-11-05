import React from 'react';
import { BiometricLockOverlay } from './BiometricLockOverlay';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="w-full h-[100dvh] bg-slate-50 text-slate-800 flex flex-col font-sans select-none relative overflow-hidden" dir="rtl">
      {/* Main Viewport Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {children}
      </main>

      {/* Biometric & Session Security Lock Overlay */}
      <BiometricLockOverlay />
    </div>
  );
};
