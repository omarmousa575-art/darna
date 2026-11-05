import React, { useState, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Clock, RefreshCw, LogOut, ShieldAlert, CheckCircle2, Copy, Check, Hash, Send } from 'lucide-react';

export const PendingScreen: React.FC = () => {
  const { currentUser, refreshMyStatus, logout } = useFamily();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [checkedMessage, setCheckedMessage] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);

  if (!currentUser) return null;

  // Automatically check approval status every 2.5 seconds
  useEffect(() => {
    refreshMyStatus();
    const timer = setInterval(() => {
      refreshMyStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCheckedMessage('');
    try {
      await refreshMyStatus();
      setCheckedMessage('تم التحقق عبر السحابة: في حال اعتمادك سيتم تفعيل حسابك ودخولك فوراً.');
    } catch {
      setCheckedMessage('تم التحقق: طلبك ما زال بانتظار اعتماد مسؤول التطبيق عمر.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setCheckedMessage(''), 4000);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white overflow-y-auto">
      {/* Top Banner */}
      <div className="text-center pt-8">
        <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-400/50 text-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-950/40 animate-pulse">
          <Clock className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-white font-serif">طلبك قيد المراجعة ⏳</h2>
        <p className="text-xs text-amber-200/90 mt-1 max-w-xs mx-auto leading-relaxed">
          طلبك قيد المراجعة، يرجى انتظار موافقة مسؤول التطبيق عمر لتفعيل حسابك.
        </p>
      </div>

      {/* User Information Card */}
      <div className="my-auto py-6">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center space-x-3 space-x-reverse pb-3 border-b border-slate-700/60">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-12 h-12 rounded-full ring-2 ring-amber-400/40 object-cover"
            />
            <div>
              <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                {currentUser.phone}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>حالة الحساب:</span>
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                <span>قيد المراجعة والاعتماد (PENDING)</span>
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>تاريخ التقديم:</span>
              <span className="text-slate-400">{currentUser.registeredAt}</span>
            </div>
            {currentUser.invitedBy && (
              <div className="flex justify-between text-slate-300">
                <span>جهة الدعوة:</span>
                <span className="text-teal-300 font-semibold">{currentUser.invitedBy}</span>
              </div>
            )}
          </div>

          {/* Generated Unique Short ID Box */}
          <div className="bg-gradient-to-r from-teal-950 to-slate-900 p-3 rounded-xl border border-teal-500/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-teal-300 block font-medium">رمز ID الخاص بك (رمز الدعوة):</span>
              <span className="text-sm font-mono font-bold text-emerald-300 mt-0.5 inline-block" dir="ltr">
                #{currentUser.shortId}
              </span>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(currentUser.shortId).catch(() => {});
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
              }}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-xs"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'تم النسخ!' : 'نسخ الرمز'}</span>
            </button>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 text-[11px] text-slate-300 leading-relaxed">
            🔒 لحماية خصوصية العائلة، لا يمكن استعراض المحادثات، المجموعات أو جهات الاتصال إلا بعد الموافقة عليك من قِبل مسؤول التطبيق عمر.
          </div>
        </div>

        {checkedMessage && (
          <div className="mt-3 bg-amber-950/70 border border-amber-800 rounded-xl p-2.5 text-center text-amber-200 text-xs">
            {checkedMessage}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pb-4">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'جارِ التحقق...' : 'التحقق من حالة الموافقة الآن'}</span>
        </button>

        <button
          onClick={logout}
          className="w-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل الخروج أو استخدام رقم آخر</span>
        </button>
      </div>
    </div>
  );
};
