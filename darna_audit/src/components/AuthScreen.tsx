import React, { useState } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Phone, Lock, User as UserIcon, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login } = useFamily();
  const [phone, setPhone] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('يرجى إدخال رقم الجوال.');
      return;
    }
    if (!password.trim()) {
      setError('يرجى إدخال كلمة سر الدخول.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login({
        phone: cleanPhone,
        password: password.trim(),
        name: name.trim() || undefined,
      });

      if (!result.success) {
        setError(result.message || 'تعذر تسجيل الدخول.');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[100dvh] bg-slate-900 text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-y-auto" dir="rtl">
      {/* Decorative Warm Lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Emblem */}
      <div className="text-center pt-8 z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-700 shadow-2xl shadow-teal-950/60 mb-3 border border-teal-300/30">
          <span className="text-4xl">🏡</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-serif">
          دارنا
        </h1>
        <p className="text-xs sm:text-sm text-teal-200/90 mt-1">
          شبكة المحادثات العائلية الخاصة والآمنة
        </p>
      </div>

      {/* Login Card with exactly 3 fields */}
      <div className="w-full max-w-md mx-auto my-auto py-6 z-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4">
            {/* Field 1: رقم الجوال */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم الجوال
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="0000000000"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  className="w-full bg-slate-900/90 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-teal-400 font-mono tracking-wider text-left placeholder:text-slate-500 disabled:opacity-60"
                />
                <Phone className="w-4 h-4 text-teal-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Field 2: الاسم الكامل */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                الاسم الكامل
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="نص"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  className="w-full bg-slate-900/90 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-teal-400 placeholder:text-slate-500 disabled:opacity-60"
                />
                <UserIcon className="w-4 h-4 text-teal-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Field 3: كلمة سر الدخول */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة سر الدخول
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  placeholder="000000"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  className="w-full bg-slate-900/90 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-teal-400 font-mono tracking-wider text-left placeholder:text-slate-500 disabled:opacity-60"
                />
                <Lock className="w-4 h-4 text-teal-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/80 border border-rose-800 rounded-2xl p-3 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl shadow-teal-950/40 transition flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارِ التحقق والدخول...</span>
              </>
            ) : (
              <>
                <span>دخول</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Clean Footer without hints */}
      <div className="text-center text-[11px] text-slate-500 z-10 pb-4">
        تطبيق دارنا العائلي
      </div>
    </div>
  );
};
