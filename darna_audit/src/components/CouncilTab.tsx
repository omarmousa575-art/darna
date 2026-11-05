import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { StorySection } from './StorySection';
import { Chat, User } from '../types';
import {
  MessageSquare,
  Users,
  Plus,
  UserPlus,
  ArrowLeft,
  Camera,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Trash2,
  CheckCheck,
} from 'lucide-react';

// Virtual Scrolling & Lazy Loading Chat List for High Performance
const ITEM_HEIGHT = 76; // Height of each chat card in px
const OVERSCAN = 5;     // Extra items buffered above & below viewport
const INITIAL_PAGE_SIZE = 15;
const PAGE_INCREMENT = 10;

interface VirtualizedChatListProps {
  chats: Chat[];
  users: User[];
  currentUser: User;
  getTypingUsersInChat: (chatId: string) => string[];
  getUnreadCountForChat: (chatId: string) => number;
  setActiveChatId: (chatId: string) => void;
}

const VirtualizedChatList: React.FC<VirtualizedChatListProps> = ({
  chats,
  users,
  currentUser,
  getTypingUsersInChat,
  getUnreadCountForChat,
  setActiveChatId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset lazy load limit when filter or total chats change
  useEffect(() => {
    setVisibleLimit(INITIAL_PAGE_SIZE);
  }, [chats.length]);

  // Paginated chats subset (Lazy loaded)
  const paginatedChats = useMemo(() => {
    return chats.slice(0, visibleLimit);
  }, [chats, visibleLimit]);

  const hasMore = visibleLimit < chats.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);

      // Lazy Loading trigger when user scrolls near bottom (120px threshold)
      if (hasMore && !isLoadingMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleLimit((prev) => Math.min(chats.length, prev + PAGE_INCREMENT));
          setIsLoadingMore(false);
        }, 300);
      }
    };

    const updateHeight = () => {
      if (el) setContainerHeight(el.clientHeight);
    };

    updateHeight();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateHeight);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeight);
    };
  }, [hasMore, isLoadingMore, chats.length]);

  const totalItems = paginatedChats.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN);

  const visibleChats = paginatedChats.slice(startIndex, endIndex);
  const paddingTop = startIndex * ITEM_HEIGHT;
  const paddingBottom = Math.max(0, (totalItems - endIndex) * ITEM_HEIGHT);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto min-h-0 overscroll-contain pb-24"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden"
        style={{
          paddingTop: `${paddingTop}px`,
          paddingBottom: `${paddingBottom}px`,
        }}
      >
        {visibleChats.map((chat) => {
          const chatParts = Array.isArray(chat.participants)
            ? chat.participants
            : (Array.isArray((chat as any).members) ? (chat as any).members : []);
          const partnerId = chat.type === 'DIRECT'
            ? chatParts.find((p: string) => p !== currentUser.id)
            : null;
          const partner = partnerId ? users.find((u) => u.id === partnerId) : null;
          const title = chat.type === 'DIRECT' ? partner?.name || 'محادثة خاصة' : chat.title;
          const avatar = chat.type === 'DIRECT' ? partner?.avatar : undefined;
          const typingUsers = getTypingUsersInChat(chat.id);
          const unreadCount = getUnreadCountForChat(chat.id);

          return (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              style={{ height: `${ITEM_HEIGHT}px` }}
              className={`w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition text-right ${
                unreadCount > 0 ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
              }`}
            >
              <div className="flex items-center space-x-3 space-x-reverse overflow-hidden flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-800 dark:text-teal-200 font-bold overflow-hidden border border-teal-200 dark:border-teal-700">
                    {avatar ? (
                      <img src={avatar} alt={title} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-teal-700 dark:text-teal-300" />
                    )}
                  </div>
                  {partner && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        partner.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  )}
                </div>

                <div className="overflow-hidden flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs truncate ${unreadCount > 0 ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-100'}`}>
                      {title}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-2 shrink-0">{chat.updatedAt}</span>
                  </div>

                  <div className="text-[11px] truncate mt-0.5">
                    {typingUsers.length > 0 ? (
                      <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping inline-block" />
                        <span>{typingUsers.join(', ')}: جاري الكتابة...</span>
                      </span>
                    ) : chat.lastMessage ? (
                      <span className={unreadCount > 0 ? 'text-teal-900 dark:text-teal-200 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                        {chat.lastMessage.senderId === currentUser.id ? 'أنت: ' : ''}
                        {chat.lastMessage.text ||
                          (chat.lastMessage.mediaType === 'audio' || chat.lastMessage.mediaUrl?.startsWith('data:audio')
                            ? '🎤 تسجيل صوتي'
                            : '📷 صورة مرفقة')}
                      </span>
                    ) : (
                      <span className="text-teal-600 dark:text-teal-400 font-medium">ابدأ الحديث الآن ✍️</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Unread Incoming Messages Badge */}
              {unreadCount > 0 && (
                <div className="mr-3 shrink-0 flex flex-col items-center justify-center">
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-900 animate-bounce">
                    {unreadCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lazy Loading Footer Indicator */}
      {isLoadingMore && (
        <div className="py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/40 rounded-2xl mt-2 animate-in fade-in duration-150">
          <span className="w-2 h-2 bg-teal-500 rounded-full animate-ping" />
          <span>جاري تحميل المزيد من المحادثات العائلية...</span>
        </div>
      )}

      {hasMore && !isLoadingMore && (
        <div className="text-center py-2 mt-1">
          <button
            type="button"
            onClick={() => {
              setIsLoadingMore(true);
              setTimeout(() => {
                setVisibleLimit((prev) => Math.min(chats.length, prev + PAGE_INCREMENT));
                setIsLoadingMore(false);
              }, 200);
            }}
            className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition shadow-2xs"
          >
            تحميل المزيد ({chats.length - visibleLimit} متبقية) 👇
          </button>
        </div>
      )}
    </div>
  );
};

export const CouncilTab: React.FC = () => {
  const {
    chats,
    users,
    currentUser,
    callLogs,
    clearCallLogs,
    getUnreadCountForChat,
    totalUnreadCount,
    setActiveChatId,
    setActiveTab,
    createGroup,
    getTypingUsersInChat,
    openAvatarModal,
    startVoiceCall,
  } = useFamily();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'group' | 'direct' | 'calls'>('all');
  const [callsSubFilter, setCallsSubFilter] = useState<'all' | 'missed'>('all');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [groupDesc, setGroupDesc] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  if (!currentUser) return null;

  // Filter chats relevant to currentUser
  const myChats = useMemo(() => {
    return chats.filter((c) => {
      const parts = Array.isArray(c?.participants)
        ? c.participants
        : (Array.isArray((c as any)?.members) ? (c as any).members : []);
      return parts.includes(currentUser.id);
    });
  }, [chats, currentUser.id]);

  const unreadChatsCount = useMemo(() => {
    return myChats.filter((c) => getUnreadCountForChat(c.id) > 0).length;
  }, [myChats, getUnreadCountForChat]);

  // STRICT deduplication: guarantee no contact ever has duplicate chat entries!
  const uniqueChats = useMemo(() => {
    const seenPartners = new Set<string>();
    const filtered = myChats.filter((c) => {
      if (activeFilter === 'unread') return getUnreadCountForChat(c.id) > 0;
      if (activeFilter === 'group') return c.type === 'GROUP';
      if (activeFilter === 'direct') return c.type === 'DIRECT';
      return true;
    });

    return filtered.filter((c) => {
      if (c.type !== 'DIRECT') return true;
      const parts = Array.isArray(c.participants)
        ? c.participants
        : (Array.isArray((c as any).members) ? (c as any).members : []);
      const partnerId = parts.find((p: string) => p !== currentUser.id);
      if (!partnerId) return true;
      if (seenPartners.has(partnerId)) return false;
      seenPartners.add(partnerId);
      return true;
    });
  }, [myChats, activeFilter, currentUser.id]);

  // Filter Call Logs
  const filteredCallLogs = useMemo(() => {
    if (callsSubFilter === 'missed') {
      return callLogs.filter((log) => log.direction === 'missed' || log.status === 'declined' || log.status === 'missed');
    }
    return callLogs;
  }, [callLogs, callsSubFilter]);

  const missedCallsCount = useMemo(() => {
    return callLogs.filter((log) => log.direction === 'missed' || log.status === 'declined' || log.status === 'missed').length;
  }, [callLogs]);

  const approvedMembers = users.filter((u) => u.status === 'ACTIVE' && u.id !== currentUser.id);
  const canCreateGroup = currentUser.role === 'ADMIN' || currentUser.canCreateGroups;

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!groupName.trim()) {
      setError('يرجى كتابة اسم المجلس أو المجموعة');
      return;
    }

    const result = createGroup(groupName, groupDesc, selectedMemberIds);
    if (!result.success) {
      setError(result.error || 'تعذر إنشاء المجموعة');
      return;
    }

    setShowCreateGroupModal(false);
    setGroupName('');
    setGroupDesc('');
    setSelectedMemberIds([]);

    if (result.group) {
      setActiveChatId(`chat-${result.group.id}`);
    }
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins} د و ${secs} ث`;
    }
    return `${secs} ثانية`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          <button
            onClick={openAvatarModal}
            className="relative group shrink-0"
            title="تعيين وتغيير صورتك الشخصية"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-2xl object-cover ring-2 ring-teal-500/40 shadow-xs group-hover:ring-teal-600 transition"
            />
            <span className="absolute -bottom-1 -left-1 bg-teal-600 text-white p-0.5 rounded-full border border-white">
              <Camera className="w-2.5 h-2.5" />
            </span>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-800">دارنا</h2>
              <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded-md font-mono font-bold" dir="ltr">
                #{currentUser.shortId}
              </span>
              {totalUnreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
                  {totalUnreadCount} رسالة غير مقروءة
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">مرحباً {currentUser.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canCreateGroup && (
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مجموعة جديدة</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('directory')}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>محادثة خاصة</span>
          </button>
        </div>
      </div>

      {/* Story Section (قصص وحالات العائلة) */}
      <StorySection />

      {/* Filter Tabs: [الكل] [غير مقروءة] [مجموعات] [دردشة خاصة] [سجل المكالمات] */}
      <div className="px-4 py-2 bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 text-xs shrink-0 overflow-x-auto no-scrollbar select-none">
        {/* 1. الكل */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1 whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>الكل</span>
          <span className="text-[10px] opacity-80 font-mono">({uniqueChats.length})</span>
        </button>

        {/* 2. غير مقروءة */}
        <button
          onClick={() => setActiveFilter('unread')}
          className={`px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === 'unread'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200/60 dark:border-rose-800/40'
          }`}
        >
          <span>غير مقروءة</span>
          {unreadChatsCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
              {unreadChatsCount}
            </span>
          )}
        </button>

        {/* 3. مجموعات */}
        <button
          onClick={() => setActiveFilter('group')}
          className={`px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1 whitespace-nowrap ${
            activeFilter === 'group'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>مجموعات</span>
          <span className="text-[10px] opacity-80 font-mono">
            ({uniqueChats.filter((c) => c.type === 'GROUP').length})
          </span>
        </button>

        {/* 4. دردشة خاصة */}
        <button
          onClick={() => setActiveFilter('direct')}
          className={`px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1 whitespace-nowrap ${
            activeFilter === 'direct'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>دردشة خاصة</span>
          <span className="text-[10px] opacity-80 font-mono">
            ({uniqueChats.filter((c) => c.type === 'DIRECT').length})
          </span>
        </button>

        {/* 5. سجل المكالمات */}
        <button
          onClick={() => setActiveFilter('calls')}
          className={`px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === 'calls'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-800/40'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>سجل المكالمات</span>
          <span className="text-[10px] opacity-90 font-mono">({callLogs.length})</span>
          {missedCallsCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] px-1 py-0.2 rounded-full font-bold">
              {missedCallsCount}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeFilter === 'calls' ? (
          /* CALL LOGS VIEW (سجل المكالمات) */
          <div className="space-y-3">
            {/* Call Logs Sub-Filter & Clear Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCallsSubFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    callsSubFilter === 'all'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  جميع المكالمات ({callLogs.length})
                </button>
                <button
                  onClick={() => setCallsSubFilter('missed')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    callsSubFilter === 'missed'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  الفائتة ({missedCallsCount})
                </button>
              </div>

              {callLogs.length > 0 && (
                <button
                  onClick={clearCallLogs}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition"
                  title="مسح سجل المكالمات"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح السجل</span>
                </button>
              )}
            </div>

            {filteredCallLogs.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs my-6 max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Phone className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  {callsSubFilter === 'missed' ? 'لا توجد مكالمات فائتة' : 'سجل المكالمات فارغ حالياً'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mb-4">
                  يمكنك إجراء مكالمات صوتية مشفرة وفورية مع أفراد العائلة مباشرة من دليل العائلة أو المحادثات.
                </p>
                <button
                  onClick={() => setActiveTab('directory')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition inline-flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>الانتقال للدليل وبدء اتصال</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 shadow-xs overflow-hidden">
                {filteredCallLogs.map((log) => {
                  const partner = users.find((u) => u.id === log.partnerId);
                  const isMissed = log.direction === 'missed' || log.status === 'declined' || log.status === 'missed';
                  const isIncoming = log.direction === 'incoming';
                  const durationStr = formatDuration(log.durationSeconds);

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center space-x-3 space-x-reverse overflow-hidden">
                        <div className="relative shrink-0">
                          <img
                            src={log.partnerAvatar || partner?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=U'}
                            alt={log.partnerName}
                            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
                              isMissed
                                ? 'bg-rose-500 text-white'
                                : isIncoming
                                ? 'bg-emerald-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}
                          >
                            {isMissed ? (
                              <PhoneMissed className="w-2.5 h-2.5" />
                            ) : isIncoming ? (
                              <PhoneIncoming className="w-2.5 h-2.5" />
                            ) : (
                              <PhoneOutgoing className="w-2.5 h-2.5" />
                            )}
                          </span>
                        </div>

                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {log.partnerName}
                            </span>
                            {partner?.relationship && (
                              <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-medium">
                                {partner.relationship}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span
                              className={`font-medium ${
                                isMissed ? 'text-rose-600' : isIncoming ? 'text-emerald-700' : 'text-blue-700'
                              }`}
                            >
                              {isMissed
                                ? 'مكالمة فائتة / لم يتم الرد'
                                : isIncoming
                                ? `مكالمة واردة (${durationStr})`
                                : `مكالمة صادرة (${durationStr})`}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400 font-mono text-[10px] flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{log.timestamp}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* One-Tap Call Back Button */}
                      <button
                        onClick={() => {
                          const target = partner || {
                            id: log.partnerId,
                            name: log.partnerName,
                            avatar: log.partnerAvatar,
                            phone: log.partnerPhone || '',
                            role: 'MEMBER',
                            status: 'ACTIVE',
                            shortId: 'CALL',
                            canCreateGroups: true,
                            canSendInvites: true,
                            registeredAt: '',
                            isOnline: true,
                          };
                          startVoiceCall(target);
                        }}
                        className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 text-xs font-semibold shrink-0 transition"
                        title="معاودة الاتصال"
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">اتصال</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : uniqueChats.length === 0 ? (
          /* ZERO MOCK DATA - Clean Empty State */
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/90 shadow-xs my-6 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              لا توجد محادثات نشطة حالياً
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mb-5">
              ابدأ محادثة خاصة مع أحد أفراد العائلة المعتمدين من الدليل، أو أنشئ مجموعة عائلية جديدة.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('directory')}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition inline-flex items-center justify-center gap-2"
              >
                <span>الانتقال لدليل العائلة وبدء محادثة</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              {canCreateGroup && (
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl transition"
                >
                  + إنشاء أول مجموعة عائلية
                </button>
              )}
            </div>
          </div>
        ) : (
          /* VIRTUALIZED CHATS LIST WITH UNREAD INDICATORS & DEDUPLICATION */
          <VirtualizedChatList
            chats={uniqueChats}
            users={users}
            currentUser={currentUser}
            getTypingUsersInChat={getTypingUsersInChat}
            getUnreadCountForChat={getUnreadCountForChat}
            setActiveChatId={setActiveChatId}
          />
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 mb-3">
              إنشاء مجلس أو مجموعة عائلية جديدة
            </h3>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المجلس / المجموعة
                </label>
                <input
                  type="text"
                  placeholder="مثال: المجلس العائلي العام أو ترتيبات الرحلة"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الوصف (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="وصف مختصر لموضوع المجلس"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  إضافة أعضاء من العائلة ({selectedMemberIds.length} محددين)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                  {approvedMembers.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-2">لا يوجد أعضاء آخرين معتمدين بعد</p>
                  ) : (
                    approvedMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center space-x-2 space-x-reverse text-xs text-slate-700 hover:bg-white p-1 rounded-lg cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(member.id)}
                          onChange={() => handleToggleMember(member.id)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <img src={member.avatar} alt={member.name} className="w-5 h-5 rounded-full object-cover" />
                        <span className="truncate flex-1">{member.name}</span>
                        <span className="text-[10px] text-slate-400" dir="ltr">#{member.shortId}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2 rounded-xl transition"
                >
                  إنشاء المجموعة
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
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
