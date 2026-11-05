import React, { useState } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, UserPlus, Video } from 'lucide-react';
import { User } from '../types';

export const CallsTab: React.FC = () => {
  const {
    callLogs,
    clearCallLogs,
    users,
    currentUser,
    startVoiceCall,
    toggleCallCamera,
  } = useFamily();

  const [showDialerModal, setShowDialerModal] = useState<boolean>(false);

  if (!currentUser) return null;

  const otherActiveMembers = users.filter(
    (u) => u.status === 'ACTIVE' && u.id !== currentUser.id
  );

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0 ثانية';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} ثانية`;
    return `${mins} دقيقة و ${secs} ثانية`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">المكالمات 📞</h2>
          <p className="text-[11px] text-slate-500">سجل الاتصالات المشفرة والمكالمات المباشرة</p>
        </div>

        <div className="flex items-center gap-2">
          {callLogs.length > 0 && (
            <button
              onClick={clearCallLogs}
              className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl border border-rose-200 transition"
              title="مسح سجل المكالمات"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowDialerModal(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>اتصال جديد</span>
          </button>
        </div>
      </div>

      {/* Call History List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {callLogs.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/90 shadow-xs my-6 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Phone className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">لا توجد مكالمات سابقة في السجل</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mb-4">
              يمكنك بدء مكالمة صوتية أو مرئية عالية الدقة ومشفّرة 100% مع أي فرد من أفراد العائلة المعتمدين.
            </p>
            <button
              onClick={() => setShowDialerModal(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition"
            >
              بدء مكالمة الآن
            </button>
          </div>
        ) : (
          callLogs.map((log) => {
            const partner = users.find((u) => u.id === log.partnerId);

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-teal-300 transition"
              >
                <div className="flex items-center space-x-3 space-x-reverse overflow-hidden">
                  <img
                    src={log.partnerAvatar || partner?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=U'}
                    alt={log.partnerName}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />

                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{log.partnerName}</h3>
                    
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                      {log.direction === 'incoming' && (
                        <span className="text-emerald-600 flex items-center gap-1 font-medium">
                          <PhoneIncoming className="w-3.5 h-3.5" />
                          <span>واردة ({formatDuration(log.durationSeconds)})</span>
                        </span>
                      )}
                      {log.direction === 'outgoing' && (
                        <span className="text-teal-600 flex items-center gap-1 font-medium">
                          <PhoneOutgoing className="w-3.5 h-3.5" />
                          <span>صادرة ({formatDuration(log.durationSeconds)})</span>
                        </span>
                      )}
                      {log.direction === 'missed' && (
                        <span className="text-rose-600 flex items-center gap-1 font-medium">
                          <PhoneMissed className="w-3.5 h-3.5" />
                          <span>مكالمة فائتة / لم يتم الرد</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{log.timestamp}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      if (partner) startVoiceCall(partner);
                    }}
                    className="w-9 h-9 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center transition border border-teal-200"
                    title="إعادة الاتصال صوتياً"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Call Selector Modal */}
      {showDialerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-teal-600" />
                <span>اختر عضواً للاتصال به</span>
              </h3>
              <button
                onClick={() => setShowDialerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            {otherActiveMembers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                لا يوجد أفراد معتمدون متصلون حالياً في دليل العائلة.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {otherActiveMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-teal-50 rounded-2xl border border-slate-200/80 transition"
                  >
                    <div className="flex items-center space-x-2.5 space-x-reverse">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{member.name}</h4>
                        <span className="text-[10px] text-teal-700">{member.relationship || 'عضو بالعائلة'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowDialerModal(false);
                        startVoiceCall(member);
                      }}
                      className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>اتصال</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
