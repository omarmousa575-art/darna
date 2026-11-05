import React, { useState, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Fingerprint, Lock, KeyRound, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';

export const BiometricLockOverlay: React.FC = () => {
  const {
    currentUser,
    isAppLocked,
    unlockWithBiometrics,
    unlockWithPassword,
  } = useFamily();

  const [showPasswordMode, setShowPasswordMode] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Auto-prompt biometrics when the overlay appears
  useEffect(() => {
    if (isAppLocked && currentUser && !showPasswordMode) {
      handleBiometricUnlock();
    }
  }, [isAppLocked]);

  if (!isAppLocked || !currentUser) {
    return null;
  }

  const handleBiometricUnlock = async () => {
    setIsVerifying(true);
    setError('');
    try {
      const res = await unlockWithBiometrics();
      if (!res.success) {
        setError(res.message || 'تعذر التحقق من البصمة/الوجه. يمكنك استخدام كلمة السر.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء فحص البصمة. يمكنك استخدام كلمة السر للفتح.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!passwordInput.trim()) {
      setError('يرجى إدخال كلمة السر.');
      return;
    }

    const ok = unlockWithPassword(passwordInput.trim());
    if (!ok) {
      setError('كلمة السر غير صحيحة!');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md text-white flex flex-col justify-between p-6 z-50 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header */}
      <div className="text-center pt-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-teal-800/80 border border-teal-500/40 text-teal-300 shadow-2xl mb-3">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          تطبيق دارنا مقفل للأمان
        </h2>
        <p className="text-xs text-teal-200/80 mt-1">
          مُحمي بنظام التحقق البيومتري WebAuthn (البصمة / الوجه)
        </p>
      </div>

      {/* User Badge & Unlock Card */}
      <div className="w-full max-w-sm mx-auto my-auto space-y-6 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          {/* User Info */}
          <div className="flex flex-col items-center">
            <div className="relative mb-2">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-teal-500/40 shadow-lg"
              />
              <span className="absolute bottom-0 right-0 bg-teal-600 text-white p-1 rounded-full border-2 border-slate-900 shadow">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{currentUser.name}</h3>
            <span className="text-[11px] text-teal-300 font-mono mt-0.5" dir="ltr">
              #{currentUser.shortId}
            </span>
          </div>

          {!showPasswordMode ? (
            /* Biometric Verification View */
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isVerifying}
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 hover:from-teal-400 hover:to-emerald-600 text-white flex flex-col items-center justify-center shadow-xl shadow-teal-950/60 transition active:scale-95 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 rounded-full animate-ping pointer-events-none opacity-25" />
                <Fingerprint className="w-10 h-10 group-hover:scale-110 transition shrink-0" />
                <span className="text-[10px] font-bold mt-1">
                  {isVerifying ? 'جاري الفحص...' : 'فتح بالبصمة'}
                </span>
              </button>

              <p className="text-xs text-slate-300 leading-relaxed">
                انقر على رمز البصمة أعلاه أو استخدم مستشعر بصمة الأصبع / الوجه بجهازك لاستئناف الجلسة.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordMode(true);
                  setError('');
                }}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold underline flex items-center justify-center gap-1 mx-auto pt-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>استخدام كلمة السر بدلاً من البصمة</span>
              </button>
            </div>
          ) : (
            /* Password Fallback View */
            <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-right">
                  كلمة سر العائلة أو الإدارة
                </label>
                <input
                  type="password"
                  dir="ltr"
                  placeholder="أدخل كلمة السر"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 text-left font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg transition text-xs"
              >
                فتح الجلسة بكلمة السر
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordMode(false);
                  setError('');
                }}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center justify-center gap-1 mx-auto pt-1"
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                <span>الرجوع للفتح بالبصمة / الوجه</span>
              </button>
            </form>
          )}

          {error && (
            <div className="bg-rose-950/90 border border-rose-800 text-rose-200 text-xs p-2.5 rounded-xl flex items-center gap-1.5 text-right">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="text-center text-[11px] text-slate-400 pb-2">
        🔒 دارنا - حماية البيانات وقفل الجلسات تلقائياً لتعزيز أمان العائلة
      </div>
    </div>
  );
};
