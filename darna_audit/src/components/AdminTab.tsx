import React, { useState } from 'react';
import { useFamily } from '../context/FamilyContext';
import { ShieldCheck, UserCheck, Check, X, Clock, ShieldAlert, KeyRound, Save } from 'lucide-react';

export const AdminTab: React.FC = () => {
  const {
    currentUser,
    users,
    approveUser,
    rejectUser,
    toggleUserPermission,
    familyPassword,
    updateFamilyPassword,
    biometricEnabled,
    verifyBiometricForAction,
  } = useFamily();

  const [newFamilyPassInput, setNewFamilyPassInput] = useState<string>(familyPassword);
  const [passSaveSuccess, setPassSaveSuccess] = useState<boolean>(false);

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-100">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-3" />
        <h2 className="text-base font-bold text-slate-800">صلاحيات مسؤول التطبيق مطلوبة</h2>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          هذه الصفحة مخصصة لـ "مسؤول التطبيق عمر" فقط لمراجعة طلبات الانضمام وإدارة الصلاحيات.
        </p>
      </div>
    );
  }

  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyPassInput.trim()) return;

    if (biometricEnabled) {
      const bioRes = await verifyBiometricForAction('تغيير كلمة سر الإدارة والعائلة');
      if (!bioRes.success) {
        alert(bioRes.message || 'تعذر التحقق من البصمة/الوجه لتحديث كلمة السر.');
        return;
      }
    }

    const ok = updateFamilyPassword(newFamilyPassInput.trim());
    if (ok) {
      setPassSaveSuccess(true);
      setTimeout(() => setPassSaveSuccess(false), 3000);
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING');
  const activeMembers = users.filter((u) => u.status === 'ACTIVE' && u.id !== currentUser.id);
  const rejectedUsers = users.filter((u) => u.status === 'REJECTED');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
            🛡️
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">لوحة تحكم مسؤول التطبيق</h2>
            <p className="text-[11px] text-slate-500">مرحباً بك يا مسؤول التطبيق عمر</p>
          </div>
        </div>

        <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">
          مسؤول التطبيق عمر 👑
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {/* Section: Family Password Management for Members */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-teal-700" />
              <span>كلمة سر العائلة للأعضاء (Family Invite Password)</span>
            </h3>
            <span className="text-xs font-mono font-bold bg-white text-teal-800 px-2.5 py-0.5 rounded-lg border border-teal-300">
              {familyPassword}
            </span>
          </div>

          <p className="text-[11px] text-teal-800 leading-relaxed">
            هذه هي كلمة السر التي يُطلب من أفراد العائلة كتابتها عند التسجيل. يمكنك تغييرها وتحديثها في أي وقت:
          </p>

          <form onSubmit={handleUpdatePass} className="flex gap-2 pt-1">
            <input
              type="text"
              dir="ltr"
              value={newFamilyPassInput}
              onChange={(e) => setNewFamilyPassInput(e.target.value)}
              placeholder="اكتب كلمة سر العائلة الجديدة"
              className="flex-1 bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ التغيير</span>
            </button>
          </form>

          {passSaveSuccess && (
            <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>تم تحديث كلمة سر العائلة بنجاح!</span>
            </p>
          )}
        </div>

        {/* Section: Supabase Cloud Integration Helper */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm">⚡ Supabase Database</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                متصل
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const sqlScript = `-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  status TEXT NOT NULL DEFAULT 'PENDING',
  short_id TEXT,
  avatar_url TEXT,
  relationship TEXT,
  is_online BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  can_create_groups BOOLEAN DEFAULT FALSE,
  can_send_invites BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  chat_type TEXT DEFAULT 'direct',
  content TEXT DEFAULT '',
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  is_viewed BOOLEAN DEFAULT FALSE,
  is_view_once BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  caller_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  call_type TEXT DEFAULT 'voice',
  signal_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;`;
                navigator.clipboard.writeText(sqlScript);
                alert('تم نسخ كود SQL الخاص بإنشاء الجداول في Supabase بنجاح! يمكنك لصقه في Supabase SQL Editor.');
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
            >
              <span>نسخ كود SQL لـ Supabase 📋</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            يتم مزامنة طلبات الانضمام والمستخدمين تلقائياً عبر السحابة وخادم التطبيق المباشر، وتظهر لك الطلبات فور تقديمها.
          </p>
        </div>

        {/* Section 1: Pending Approvals with Live Count Badge */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>طلبات الانضمام بانتظار الاعتماد</span>
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pendingUsers.length > 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pendingUsers.length} طلبات
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1"
              title="تحديث فوري لقائمة الطلبات"
            >
              <span>تحديث 🔄</span>
            </button>
          </div>

          {pendingUsers.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
              لا توجد طلبات انضمام جديدة معلقة حالياً ✨
            </p>
          ) : (
            <div className="space-y-2.5">
              {pendingUsers.map((pending) => (
                <div
                  key={pending.id}
                  className="bg-amber-50/70 border border-amber-200 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5 space-x-reverse">
                      <img
                        src={pending.avatar}
                        alt={pending.name}
                        className="w-10 h-10 rounded-full object-cover border border-amber-300"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-800">{pending.name}</h4>
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-mono font-bold px-1.5 py-0.2 rounded" dir="ltr">
                            #{pending.shortId}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                          {pending.phone}
                        </p>
                        {pending.invitedBy && (
                          <p className="text-[10px] text-teal-700 font-medium mt-0.5">
                            مدعو عبر: {pending.invitedBy}
                          </p>
                        )}
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          قدم الطلب: {pending.registeredAt}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 space-x-reverse shrink-0">
                      <button
                        onClick={() => approveUser(pending.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>قبول</span>
                      </button>

                      <button
                        onClick={() => rejectUser(pending.id)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-xl transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Active Members Permissions Control */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>الأعضاء المعتمدون والصلاحيات ({activeMembers.length})</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            يمكنك تخصيص صلاحيات كل فرد (مثل السماح بإنشاء المجموعات العائلية):
          </p>

          {activeMembers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
              لا يوجد أعضاء آخرون معتمدون بعد.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeMembers.map((member) => (
                <div key={member.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 space-x-reverse">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">{member.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {member.phone}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      نشط ومعتمد ✅
                    </span>
                  </div>

                  {/* Permissions Switcher */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-700">صلاحية إنشاء المجموعات:</span>
                    <button
                      onClick={() => toggleUserPermission(member.id, 'canCreateGroups')}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        member.canCreateGroups
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {member.canCreateGroups ? 'مسموح ✅' : 'ممنوع ❌'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Rejected Requests */}
        {rejectedUsers.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 mb-2">
              الطلبات المرفوضة ({rejectedUsers.length})
            </h3>
            <div className="space-y-1.5">
              {rejectedUsers.map((rej) => (
                <div
                  key={rej.id}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <span className="text-slate-600">
                    {rej.name} ({rej.phone})
                  </span>
                  <button
                    onClick={() => approveUser(rej.id)}
                    className="text-teal-700 hover:underline text-[11px] font-semibold"
                  >
                    إعادة القبول
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
