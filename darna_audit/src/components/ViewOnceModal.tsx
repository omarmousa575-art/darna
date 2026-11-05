import React, { useState, useEffect, useCallback } from 'react';
import { useFamily } from '../context/FamilyContext';
import { ShieldCheck, X, AlertTriangle, EyeOff, Lock } from 'lucide-react';

export const ViewOnceModal: React.FC = () => {
  const { viewOnceMessage, closeViewOnce, currentUser } = useFamily();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isPrivacyBlurred, setIsPrivacyBlurred] = useState<boolean>(false);

  const handleSecurityViolation = useCallback(() => {
    setIsPrivacyBlurred(true);
    if (viewOnceMessage) {
      setTimeout(() => {
        closeViewOnce(viewOnceMessage.id);
      }, 800);
    }
  }, [viewOnceMessage, closeViewOnce]);

  // 1. Timer Countdown
  useEffect(() => {
    if (!viewOnceMessage) return;
    setSecondsRemaining(30);
    setIsPrivacyBlurred(false);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          closeViewOnce(viewOnceMessage.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewOnceMessage, closeViewOnce]);

  // 2. Anti-Screenshot & Screen capture protection: visibilitychange & window blur detection
  useEffect(() => {
    if (!viewOnceMessage) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSecurityViolation();
      }
    };

    const handleWindowBlur = () => {
      handleSecurityViolation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key or Screenshot shortcuts
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 's') ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'))
      ) {
        e.preventDefault();
        handleSecurityViolation();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        handleSecurityViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [viewOnceMessage, handleSecurityViolation]);

  if (!viewOnceMessage || !viewOnceMessage.mediaUrl || !currentUser || viewOnceMessage.senderId === currentUser.id) return null;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 bg-black/95 z-[120] flex flex-col justify-between p-4 animate-in fade-in duration-200 backdrop-blur-md select-none protected-content"
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      dir="rtl"
    >
      {/* Top Bar with security notice & timer */}
      <div className="flex items-center justify-between text-white z-10 pt-2">
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-8 h-8 rounded-full bg-teal-600/80 flex items-center justify-center font-bold text-xs ring-2 ring-teal-400">
            ①
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>مشاهدة لمرة واحدة</span>
              <span className="text-[10px] text-amber-300 font-normal">({secondsRemaining}ث)</span>
            </div>
            <div className="text-[10px] text-slate-300">
              مرسلة من: {viewOnceMessage.senderName}
            </div>
          </div>
        </div>

        <button
          onClick={() => closeViewOnce(viewOnceMessage.id)}
          className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition flex items-center gap-1 text-xs px-3"
        >
          <span>إغلاق وحذف</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Protected Content Area */}
      <div className="flex-1 flex items-center justify-center relative p-2 overflow-hidden select-none">
        {isPrivacyBlurred ? (
          <div className="flex flex-col items-center justify-center text-amber-300 bg-black/90 p-8 rounded-3xl border border-amber-500/40 animate-pulse text-center max-w-xs">
            <EyeOff className="w-12 h-12 mb-3 text-amber-400" />
            <h3 className="text-sm font-bold text-white mb-1">حماية المحتوى الحساس</h3>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              تم إخفاء الصورة تلقائياً لحمايتها من التصوير أو لقطات الشاشة وسيتم تدميرها فوراً.
            </p>
          </div>
        ) : (
          <div className="relative max-h-[70vh] max-w-full flex items-center justify-center">
            <img
              src={viewOnceMessage.mediaUrl}
              alt="صورة للعرض مرة واحدة"
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl pointer-events-none select-none protected-content"
              style={{
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserDrag: 'none',
              } as any}
            />

            <div className="absolute bottom-4 bg-black/80 backdrop-blur-xs text-white/90 text-[10px] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-none border border-white/10 shadow-xl">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>مشاهدة محدودة داخل التطبيق؛ لا يمكن منع لقطات الشاشة بشكل مضمون</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Destruction & Privacy notice */}
      <div className="bg-amber-950/90 border border-amber-600/40 rounded-2xl p-3 text-center text-amber-200 text-xs flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>تنبيه: هذه النسخة تحتاج إلى تحقق من الخادم لضمان المشاهدة لمرة واحدة بين الأجهزة.</span>
      </div>
    </div>
  );
};
