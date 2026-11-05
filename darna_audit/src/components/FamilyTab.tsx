import React, { useState } from 'react';
import { useFamily } from '../context/FamilyContext';
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  Megaphone,
  Calendar,
  MessageSquare,
  Phone,
  Copy,
  Check,
  Hash,
  Camera,
  Share2,
  Send,
  AlertCircle,
  Plus,
  KeyRound,
  ShieldCheck,
  UserMinus,
  CheckCircle,
  Clock,
  Award,
} from 'lucide-react';
import { User, Group } from '../types';

export const FamilyTab: React.FC = () => {
  const {
    users,
    currentUser,
    groups,
    chats,
    getOrCreateDirectChat,
    setActiveChatId,
    startVoiceCall,
    connectByShortId,
    openAvatarModal,
    approveUser,
    rejectUser,
    toggleUserPermission,
    createGroup,
  } = useFamily();

  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'approvals' | 'notices' | 'events' | 'groups'>('directory');
  const [searchShortId, setSearchShortId] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedInviteText, setCopiedInviteText] = useState<boolean>(false);

  // Group creation modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  // Announcement state
  const [announcements, setAnnouncements] = useState<
    { id: string; title: string; body: string; author: string; date: string }[]
  >([
    {
      id: 'ann-1',
      title: 'اجتماع العائلة الأسبوعي 🏡',
      body: 'نلتقي جميعاً في بيت الجد بإذن الله مساء يوم الجمعة بعد صلاة العشاء.',
      author: 'مسؤول التطبيق عمر 👑',
      date: 'اليوم، 08:30 م',
    },
    {
      id: 'ann-2',
      title: 'مباركة وتبريكات 🎉',
      body: 'ألف مبروك لجميع أفراد أسرتنا الكريمة بمناسبة التميز والتجمع المبارك.',
      author: 'إدارة العائلة',
      date: 'أمس، 04:15 م',
    },
  ]);
  const [newAnnTitle, setNewAnnTitle] = useState<string>('');
  const [newAnnBody, setNewAnnBody] = useState<string>('');
  const [showAnnModal, setShowAnnModal] = useState<boolean>(false);

  // Calendar / Events state
  const [events, setEvents] = useState<
    { id: string; title: string; dateStr: string; location: string }[]
  >([
    { id: 'ev-1', title: 'عشاء الجمعة العائلي', dateStr: 'الجمعة القادم • 08:00 مساءً', location: 'البيت الكبير' },
    { id: 'ev-2', title: 'رحلة الكشتة والنزهة', dateStr: 'السبت 15 نوفمبر • 03:00 عصراً', location: 'حديقة العائلة' },
  ]);

  if (!currentUser) return null;

  const isOwnerOrAdmin =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'FAMILY_OWNER' ||
    currentUser.role === 'FAMILY_ADMIN' ||
    currentUser.phone === '0998803914' ||
    currentUser.id === 'admin_root' ||
    currentUser.name.includes('عمر');

  const otherApprovedMembers = users.filter((u) => u.status === 'ACTIVE' && u.id !== currentUser.id);
  const pendingUsers = users.filter((u) => u.status === 'PENDING');

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

  const getFullInviteMessage = () => {
    return `السلام عليكم ورحمة الله وبركاته،\nأدعوك للانضمام إلى تطبيق «دارنا» للمحادثات العائلية الخاصة والآمنة 🏡.\nرمز دعوتي للتواصل المباشر معي هو: #${currentUser.shortId}\nأدخل هذا الرمز في خانة «العائلة» للبدء في التراسل والاتصال الصوتي المباشر!`;
  };

  const handleShareWhatsApp = () => {
    const text = getFullInviteMessage();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareInvite = async () => {
    const text = getFullInviteMessage();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'دعوة للتواصل في دارنا', text });
        return;
      } catch {}
    }
    copyToClipboard(text);
    setCopiedInviteText(true);
    setTimeout(() => setCopiedInviteText(false), 2500);
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const res = createGroup(newGroupName.trim(), newGroupDesc.trim(), selectedGroupMembers);
    if (res.success && res.group) {
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedGroupMembers([]);
      setShowCreateGroupModal(false);
      setActiveSubTab('groups');
    }
  };

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnBody.trim()) return;

    setAnnouncements((prev) => [
      {
        id: `ann-${Date.now()}`,
        title: newAnnTitle.trim(),
        body: newAnnBody.trim(),
        author: currentUser.name,
        date: 'الآن',
      },
      ...prev,
    ]);
    setNewAnnTitle('');
    setNewAnnBody('');
    setShowAnnModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden" dir="rtl">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">العائلة 🏡</h2>
            <p className="text-[11px] text-slate-500">
              دليل الأفراد، الإعلانات، والتحكم بأمان العائلة
            </p>
          </div>

          <span className="text-xs font-mono font-bold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full border border-teal-300">
            {users.filter((u) => u.status === 'ACTIVE').length} أفراد معتمدين
          </span>
        </div>

        {/* Sub-Tabs Pills Filter */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('directory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeSubTab === 'directory'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            دليل الأفراد ({otherApprovedMembers.length + 1})
          </button>

          {isOwnerOrAdmin && (
            <button
              onClick={() => setActiveSubTab('approvals')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                activeSubTab === 'approvals'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>طلبات الانضمام ({pendingUsers.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('notices')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeSubTab === 'notices'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            الإعلانات ({announcements.length})
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeSubTab === 'events'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            الفعاليات ({events.length})
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeSubTab === 'groups'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            المجموعات ({groups.length})
          </button>
        </div>
      </div>

      {/* Viewport Scroll Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">

        {/* 1. DIRECTORY SUB-TAB */}
        {activeSubTab === 'directory' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Shareable Invite ID Card */}
            <div className="bg-gradient-to-r from-teal-800 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3 border border-teal-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <button onClick={openAvatarModal} className="relative group shrink-0">
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
                    <span className="text-[10px] text-teal-200 block font-medium">رمز ID لدعوة العائلة:</span>
                    <span className="text-base font-mono font-bold tracking-wider text-emerald-300 mt-0.5 inline-block" dir="ltr">
                      #{currentUser.shortId}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(currentUser.shortId)}
                  className="bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  {copiedId === currentUser.shortId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === currentUser.shortId ? 'تم النسخ!' : 'نسخ الرمز'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-teal-700/60">
                <button
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>دعوة عبر واتساب</span>
                </button>
                <button
                  onClick={handleShareInvite}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-1.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-white/15"
                >
                  <Share2 className="w-3 h-3" />
                  <span>نسخ نص الدعوة</span>
                </button>
              </div>

              {copiedInviteText && (
                <p className="text-[10px] text-emerald-300 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-500/30 text-center font-bold">
                  تم نسخ نص الدعوة العائلية! يمكنك مشاركتها مع أفراد العائلة. ✨
                </p>
              )}
            </div>

            {/* Connect directly by Short ID */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Hash className="w-4 h-4 text-teal-600" />
                <span>التواصل المباشر عبر رمز ID</span>
              </h3>
              <p className="text-[11px] text-slate-500 mb-2">
                أدخل رمز ID الخاص بأحد أفراد العائلة لبدء المراسلة والاتصال فوراً:
              </p>

              <form onSubmit={handleConnectByShortId} className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  placeholder="مثال: DRN-8392"
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

            {/* Approved Family Members Directory */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 px-1 mb-2">
                أفراد العائلة المعتمدون ({otherApprovedMembers.length})
              </h3>

              {otherApprovedMembers.length === 0 ? (
                <div className="bg-white rounded-3xl p-6 text-center border border-slate-200/90 shadow-xs my-2">
                  <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-bold">لا يوجد أفراد معتمدون آخرون حالياً.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {otherApprovedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-teal-300 transition"
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
                                مسؤول 👑
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono" dir="ltr">
                              #{member.shortId}
                            </span>
                          </div>

                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            {member.relationship || 'عضو بالعائلة'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                        <button
                          onClick={() => startVoiceCall(member)}
                          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 flex items-center justify-center transition border border-slate-200/80"
                          title="مكالمة صوتية"
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
        )}

        {/* 2. APPROVALS SUB-TAB (Only for Admins/Owners) */}
        {activeSubTab === 'approvals' && isOwnerOrAdmin && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              <strong>إدارة طلبات الانضمام:</strong> تتيح لك كـ "مسؤول التطبيق عمر" مراجعة واعتماد طلبات أفراد العائلة قبل دخولهم المحادثات.
            </div>

            {pendingUsers.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">لا توجد طلبات معلقة حالياً</h3>
                <p className="text-xs text-slate-500 mt-1">جميع الأفراد الحاليين معتمدون وفي شجرة العائلة ✅</p>
              </div>
            ) : (
              pendingUsers.map((pending) => (
                <div
                  key={pending.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <img
                      src={pending.avatar}
                      alt={pending.name}
                      className="w-12 h-12 rounded-2xl object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{pending.name}</h4>
                      <p className="text-xs text-slate-500 font-mono" dir="ltr">{pending.phone}</p>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                        رمز ID: #{pending.shortId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveUser(pending.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition shadow-xs"
                    >
                      اعتماد ✅
                    </button>
                    <button
                      onClick={() => rejectUser(pending.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-3 rounded-xl border border-rose-200 transition"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. ANNOUNCEMENTS / NOTICES SUB-TAB */}
        {activeSubTab === 'notices' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-teal-600" />
                <span>إعلانات وتنبيهات العائلة الهامة</span>
              </h3>

              {isOwnerOrAdmin && (
                <button
                  onClick={() => setShowAnnModal(true)}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إعلان جديد</span>
                </button>
              )}
            </div>

            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white rounded-2xl p-4 border border-teal-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-teal-900">{ann.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{ann.date}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{ann.body}</p>
                <div className="pt-2 border-t border-slate-100 text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>نُشر بواسطة: {ann.author}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. EVENTS & CALENDAR SUB-TAB */}
        {activeSubTab === 'events' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>جدول فعاليات ومناسبات العائلة</span>
              </h3>
            </div>

            {events.map((ev) => (
              <div key={ev.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-sm font-bold text-slate-800">{ev.title}</h4>
                <p className="text-xs text-teal-700 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>{ev.dateStr}</span>
                </p>
                <p className="text-xs text-slate-500">📍 المكان: {ev.location}</p>
              </div>
            ))}
          </div>
        )}

        {/* 5. FAMILY GROUPS SUB-TAB */}
        {activeSubTab === 'groups' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">مجموعات العائلة ({groups.length})</h3>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إنشاء مجموعة</span>
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center border border-slate-200 shadow-xs">
                <p className="text-xs text-slate-500">لا توجد مجموعات عائلية قائمة بعد.</p>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between hover:border-teal-300 transition"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg border border-teal-200">
                      👥
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{group.name}</h4>
                      <p className="text-xs text-slate-500">{group.description || 'مجموعة عائلية خاصة'}</p>
                      <span className="text-[10px] text-teal-700 font-semibold">{group.members?.length || 0} أفراد</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const chat = chats.find((c) => c.groupId === group.id);
                      if (chat) setActiveChatId(chat.id);
                    }}
                    className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition"
                  >
                    فتح المحادثة
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* New Announcement Modal */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">نشر إعلان عائلي جديد 📢</h3>

            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان الإعلان:</label>
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="مثال: اجتماع العائلة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تفاصيل الإعلان:</label>
                <textarea
                  rows={3}
                  required
                  value={newAnnBody}
                  onChange={(e) => setNewAnnBody(e.target.value)}
                  placeholder="اكتب تفاصيل الإعلان هنا..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs"
                >
                  نشر الإعلان
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800">إنشاء مجموعة عائلية جديدة 👥</h3>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المجموعة:</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="مثال: شباب العائلة، مجلس الأعمام..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">وصف المجموعة:</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="وصف مختصر لمناقشات المجموعة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">اختر الأعضاء المضافين:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {otherApprovedMembers.map((member) => {
                    const isSelected = selectedGroupMembers.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGroupMembers((prev) => prev.filter((id) => id !== member.id));
                          } else {
                            setSelectedGroupMembers((prev) => [...prev, member.id]);
                          }
                        }}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer text-xs transition ${
                          isSelected ? 'bg-teal-100 text-teal-900 font-bold border border-teal-300' : 'bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <img src={member.avatar} alt={member.name} className="w-7 h-7 rounded-lg object-cover" />
                          <span>{member.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-700" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs"
                >
                  إنشاء المجموعة الآن
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
