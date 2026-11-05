import React, { useState } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Users, MessageSquare, Phone, Copy, Check, Hash, UserPlus, AlertCircle, ArrowLeft, Camera, Share2, Send } from 'lucide-react';

export const DirectoryTab: React.FC = () => {
  const {
    users,
    currentUser,
    getOrCreateDirectChat,
    setActiveChatId,
    startVoiceCall,
    setActiveTab,
    connectByShortId,
    openAvatarModal,
  } = useFamily();

  const [searchShortId, setSearchShortId] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedToast, setSharedToast] = useState<boolean>(false);

  if (!currentUser) return null;

  // Filter only other approved family members (status === 'ACTIVE')
  const otherApprovedMembers = users.filter(
    (u) => u.status === 'ACTIVE' && u.id !== currentUser.id
  );

  const pendingCount = currentUser.role === 'ADMIN'
    ? users.filter((u) => u.status === 'PENDING').length
    : 0;

  const handleStartChat = (memberId: string) => {
    const chatId = getOrCreateDirectChat(memberId);
    setActiveChatId(chatId);
  };

  const handleConnectByShortId = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchShortId.trim()) return;

    const res = connectByShortId(searchShortId);
    if (!res.success) {
      setSearchError(res.message || 'تعذر العثور على العضو.');
    } else {
      setSearchShortId('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleShareWhatsApp = () => {
    const inviteMsg = `السلام عليكم ورحمة الله وبركاته،\nأنا متواجد في تطبيق «دارنا» للمحادثات العائلية الخاصة والآمنة.\nرمز دعوتي للتواصل المباشر معي هو: #${currentUser.shortId}\nيمكنك إدخال هذا الرمز مباشرة في خانة «دليل العائلة» لبدء مراسلتي والاتصال الصوتي فوراً.`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMsg)}`;
    window.open(url, '_blank');
  };

  const handleShareInvite = async () => {
    const inviteMsg = `السلام عليكم، أنا متواجد في تطبيق «دارنا» العائلي. رمز دعوتي للتواصل المباشر هو: #${currentUser.shortId} - أدخله في دليل العائلة لمراسلتي فوراً!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'دعوة للتواصل في دارنا',
          text: inviteMsg,
        });
        return;
      } catch {
        // User cancelled
      }
    }
    copyToClipboard(inviteMsg);
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">دليل العائلة 📖</h2>
          <p className="text-[11px] text-slate-500">
            {otherApprovedMembers.length} أفراد معتمدين في شجرة العائلة
          </p>
        </div>

        {currentUser.role === 'ADMIN' && pendingCount > 0 && (
          <button
            onClick={() => setActiveTab('admin')}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1.5 transition animate-bounce"
          >
            <span>{pendingCount} طلبات معلقة</span>
          </button>
        )}
      </div>

      {/* Directory Content with safety bottom padding */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3.5">
        
        {/* User's Own Short ID Card (Shareable with family) */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white rounded-2xl p-4 shadow-md space-y-3 border border-teal-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                onClick={openAvatarModal}
                className="relative group shrink-0"
                title="تعديل صورتك الشخصية"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-teal-400/50 group-hover:ring-white transition"
                />
                <span className="absolute -bottom-1 -left-1 bg-teal-500 text-white p-0.5 rounded-full border border-teal-900 shadow">
                  <Camera className="w-2.5 h-2.5" />
                </span>
              </button>

              <div>
                <span className="text-[10px] text-teal-200 block font-medium">رمز ID الخاص بك لدعوة العائلة:</span>
                <span className="text-base font-mono font-bold tracking-wider text-emerald-300 mt-0.5 inline-block">
                  #{currentUser.shortId}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={openAvatarModal}
                className="bg-white/10 hover:bg-white/20 text-teal-100 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition"
              >
                صورتك
              </button>
              <button
                onClick={() => copyToClipboard(currentUser.shortId)}
                className="bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                {copiedId === currentUser.shortId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === currentUser.shortId ? 'تم النسخ!' : 'نسخ الرمز'}</span>
              </button>
            </div>
          </div>

          {/* Direct Share Buttons on Top Card */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-teal-700/60">
            <button
              onClick={handleShareWhatsApp}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Send className="w-3 h-3" />
              <span>مشاركة عبر واتساب</span>
            </button>
            <button
              onClick={handleShareInvite}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-1.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-white/15"
            >
              <Share2 className="w-3 h-3" />
              <span>مشاركة نص الدعوة</span>
            </button>
          </div>

          {sharedToast && (
            <p className="text-[10px] text-emerald-300 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-500/30 text-center font-bold">
              تم نسخ نص الدعوة العائلية! يمكنك مشاركتها مع أفراد العائلة. ✨
            </p>
          )}
        </div>

        {/* Connect Directly by Short ID Box */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
            <Hash className="w-4 h-4 text-teal-600" />
            <span>بدء محادثة مباشرة بواسطة رمز ID</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-2.5">
            إذا شارك أحد أفراد العائلة رمزه التعريفي معك، يمكنك كتابته هنا لبدء التراسل فوراً:
          </p>

          <form onSubmit={handleConnectByShortId} className="flex gap-2">
            <input
              type="text"
              dir="ltr"
              placeholder="مثال: DRN-8392 أو DARNA-001"
              value={searchShortId}
              onChange={(e) => {
                setSearchShortId(e.target.value);
                setSearchError('');
              }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono tracking-wider focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>تواصل</span>
            </button>
          </form>

          {searchError && (
            <p className="text-rose-600 text-[11px] mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{searchError}</span>
            </p>
          )}
        </div>

        {/* Approved Members List */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 px-1 mb-2">
            الأفراد المعتمدون ({otherApprovedMembers.length})
          </h3>

          {otherApprovedMembers.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/90 shadow-xs my-3 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                لا يوجد أفراد آخرون معتمدون بعد
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mb-4">
                {currentUser.role === 'ADMIN'
                  ? 'أنت الحساب المعتمد الوحيد حالياً. يمكنك مشاركة كلمة السر العائلية لتمكين أفراد العائلة من التسجيل ثم اعتمادهم.'
                  : 'بانتظار تسجيل باقي أفراد العائلة واعتمادهم من قِبل مسؤول التطبيق عمر للبدء في التواصل والاتصال.'}
              </p>

              {currentUser.role === 'ADMIN' && pendingCount > 0 && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition"
                >
                  مراجعة طلبات الانضمام المعلقة ({pendingCount})
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {otherApprovedMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-teal-300 transition"
                >
                  <div className="flex items-center space-x-3 space-x-reverse overflow-hidden">
                    <div className="relative shrink-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          member.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-800">{member.name}</h3>
                        {member.role === 'ADMIN' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                            مسؤول التطبيق عمر 👑
                          </span>
                        )}
                      </div>
                      
                      {/* Short ID Badge */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono" dir="ltr">
                          #{member.shortId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(member.shortId)}
                          className="text-slate-400 hover:text-teal-700 p-0.5"
                          title="نسخ رمز ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-xs text-teal-700 font-medium mt-0.5">{member.relationship || 'عضو بالعائلة'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                    <button
                      onClick={() => startVoiceCall(member)}
                      className="w-9 h-9 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 flex items-center justify-center transition border border-slate-200/80"
                      title="مكالمة صوتية مشفرة"
                    >
                      <Phone className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleStartChat(member.id)}
                      className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1 shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>محادثة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
