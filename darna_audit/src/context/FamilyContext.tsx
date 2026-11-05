import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { User, Message, Group, Chat, TypingIndicator, CallSession, CallRecord, MainTab, CallManagerState, Story } from '../types';
import { SYSTEM_ADMIN, DEFAULT_FAMILY_PASSWORD, INITIAL_USERS, INITIAL_CHATS, INITIAL_GROUPS, INITIAL_MESSAGES } from '../initialData';
import { sounds } from '../utils/audio';
import { webrtcService } from '../services/webrtcCallService';
import { registerBiometricPasskey, verifyBiometricPasskey } from '../utils/webauthn';
import {
  supabase,
  authenticateUser,
  sendMessage as supaSendMessage,
  uploadMediaFile,
  sendCallSignal,
  subscribeToIncomingCalls,
  subscribeToGlobalMessages,
  publishStoryToSupabase,
  fetchStoriesFromSupabase,
  deleteStoryFromSupabase,
  subscribeToSupabaseStories,
} from '../services/darnaBackend.js';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const realtimeChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('darna_realtime_channel') : null;

function safeLocalStorageSet(key: string, value: any) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err: any) {
    console.warn(`[Storage] localStorage.setItem skipped for key "${key}":`, err?.message || err);
  }
}

interface FamilyContextType {
  currentUser: User | null;
  users: User[];
  groups: Group[];
  chats: Chat[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  activeTab: MainTab;
  activeChatId: string | null;
  activeCall: CallSession | null;
  callManagerState: CallManagerState;
  callLogs: CallRecord[];
  clearCallLogs: () => void;
  totalUnreadCount: number;
  getUnreadCountForChat: (chatId: string) => number;
  markChatMessagesAsRead: (chatId: string) => void;
  viewOnceMessage: Message | null;
  typingIndicators: TypingIndicator[];
  familyPassword: string;
  isAppLocked: boolean;
  biometricEnabled: boolean;
  lockApp: () => void;
  toggleBiometric: (enabled: boolean) => Promise<{ success: boolean; message?: string }>;
  unlockWithBiometrics: () => Promise<{ success: boolean; message?: string }>;
  unlockWithPassword: (pass: string) => boolean;
  verifyBiometricForAction: (actionName: string) => Promise<{ success: boolean; message?: string }>;
  setActiveTab: (tab: MainTab) => void;
  setActiveChatId: (chatId: string | null) => void;
  login: (credentials: {
    phone: string;
    password: string;
    name?: string;
    inviteCode?: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    status?: string;
    role?: string;
    shortId?: string;
  }>;
  logout: () => void;
  refreshMyStatus: () => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  toggleUserPermission: (userId: string, permission: 'canCreateGroups' | 'canSendInvites') => void;
  createGroup: (name: string, description: string, memberIds: string[]) => { success: boolean; group?: Group; error?: string };
  updateGroupInfo: (groupId: string, name: string, description: string, avatar?: string) => boolean;
  addGroupMembers: (groupId: string, userIds: string[]) => boolean;
  removeGroupMember: (groupId: string, userId: string) => boolean;
  clearChatMessages: (chatId: string) => void;
  leaveGroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
  getOrCreateDirectChat: (partnerId: string) => string;
  connectByShortId: (targetShortId: string) => { success: boolean; message?: string; chatId?: string };
  updateProfilePhoto: (avatarDataUrl: string) => Promise<void>;
  isAvatarModalOpen: boolean;
  openAvatarModal: () => void;
  closeAvatarModal: () => void;
  updateFamilyPassword: (newPass: string) => boolean;
  sendMessage: (
    chatId: string,
    text?: string,
    mediaUrl?: string,
    isViewOnce?: boolean,
    mediaType?: 'text' | 'image' | 'audio' | 'view_once_image'
  ) => Promise<void>;
  sendTypingSignal: (chatId: string, isTyping: boolean) => void;
  getTypingUsersInChat: (chatId: string) => string[];
  startVoiceCall: (targetUser: User) => Promise<void>;
  answerVoiceCall: () => Promise<void>;
  declineVoiceCall: () => Promise<void>;
  endVoiceCall: () => Promise<void>;
  toggleCallMute: () => void;
  toggleCallSpeaker: () => void;
  toggleCallCamera: () => Promise<boolean>;
  openViewOnce: (msg: Message) => void;
  closeViewOnce: (msgId: string) => void;
  updateUserSettings: (settings: Partial<User>) => void;
  askFamilyAI: (prompt: string, customHistory?: { role: string; text: string }[]) => Promise<string>;
  clearAllDataForReset: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  stories: Story[];
  addStory: (story: { text?: string; mediaUrl?: string; durationHours?: number }) => Promise<void>;
  deleteStory: (storyId: string) => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

function getArabicTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

export function generateUniqueShortId(existingUsers: { shortId?: string }[]): string {
  const existingSet = new Set(existingUsers.map((u) => u.shortId?.toUpperCase()));
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 1000; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `DRN-${suffix}`;
    if (!existingSet.has(candidate.toUpperCase())) {
      return candidate;
    }
  }
  return `DRN-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const FamilyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Dynamic Family Password
  const [familyPassword, setFamilyPassword] = useState<string>(() => {
    return localStorage.getItem('darna_family_password') || DEFAULT_FAMILY_PASSWORD;
  });

  // Users state: seeded with only SYSTEM_ADMIN, zero mock members
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('darna_v4_users');
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u) => ({
            ...u,
            shortId: u.shortId || (u.id === SYSTEM_ADMIN.id ? SYSTEM_ADMIN.shortId : 'DARNA-' + Math.floor(1000 + Math.random() * 9000)),
            name: u.phone === SYSTEM_ADMIN.phone ? SYSTEM_ADMIN.name : u.name,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_USERS;
  });

  // Strict Authentication: currentUser starts null by default
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('darna_v4_current_user');
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        if (parsed) {
          return {
            ...parsed,
            shortId: parsed.shortId || (parsed.id === SYSTEM_ADMIN.id ? SYSTEM_ADMIN.shortId : 'DARNA-' + Math.floor(1000 + Math.random() * 9000)),
            name: parsed.phone === SYSTEM_ADMIN.phone ? SYSTEM_ADMIN.name : parsed.name,
          };
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Dynamic Groups
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('darna_v4_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const sanitizeChatList = (rawChats: any[]): Chat[] => {
    if (!Array.isArray(rawChats)) return [];
    const directMap = new Map<string, Chat>();
    const groupChats: Chat[] = [];

    rawChats.forEach((c) => {
      if (!c) return;
      const parts = Array.isArray(c.participants) ? c.participants : (Array.isArray(c.members) ? c.members : []);
      const type = c.type || (parts.length > 2 || c.groupId ? 'GROUP' : 'DIRECT');
      const chatItem: Chat = {
        id: c.id || c.chatId || `chat-${Date.now()}`,
        type,
        title: c.title || c.name || 'محادثة',
        participants: parts,
        groupId: c.groupId,
        lastMessage: c.lastMessage,
        updatedAt: c.updatedAt || c.lastMessageTime || '',
      };

      if (type === 'DIRECT' && parts.length >= 2) {
        const sortedKey = [...parts].sort().join('_');
        const deterministicId = `direct_${sortedKey}`;
        chatItem.id = deterministicId;
        const existing = directMap.get(sortedKey);
        if (existing) {
          directMap.set(sortedKey, {
            ...existing,
            ...chatItem,
            lastMessage: chatItem.lastMessage || existing.lastMessage,
            updatedAt: chatItem.updatedAt || existing.updatedAt,
          });
        } else {
          directMap.set(sortedKey, chatItem);
        }
      } else {
        groupChats.push(chatItem);
      }
    });

    return [...Array.from(directMap.values()), ...groupChats];
  };

  // Dynamic Chats with strict contact deduplication
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('darna_v4_chats');
    return saved ? sanitizeChatList(JSON.parse(saved)) : sanitizeChatList(INITIAL_CHATS);
  });

  // Dynamic Messages
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('darna_v4_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  // Call Logs & History
  const [callLogs, setCallLogs] = useState<CallRecord[]>(() => {
    const saved = localStorage.getItem('darna_call_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    safeLocalStorageSet('darna_call_logs', callLogs);
  }, [callLogs]);

  const addCallLog = useCallback((record: CallRecord) => {
    setCallLogs((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
  }, []);

  const clearCallLogs = useCallback(() => {
    setCallLogs([]);
    safeLocalStorageSet('darna_call_logs', []);
  }, []);

  // WebRTC & Call Signaling tracking refs to prevent phantom calls and auto-rejects
  const handledCallIds = useRef<Set<string>>(new Set());
  const pendingOfferSdp = useRef<RTCSessionDescriptionInit | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>('council');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callManagerState, setCallManagerState] = useState<CallManagerState>('idle');
  const [viewOnceMessage, setViewOnceMessage] = useState<Message | null>(null);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);

  // Theme state (dark / light)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('darna_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      safeLocalStorageSet('darna_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Family Stories state connected to Supabase
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const saved = localStorage.getItem('darna_stories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    safeLocalStorageSet('darna_stories', stories);
  }, [stories]);

  // Initial fetch of active stories from Supabase
  useEffect(() => {
    fetchStoriesFromSupabase().then((supaStories) => {
      if (Array.isArray(supaStories) && supaStories.length > 0) {
        setStories((prev) => {
          const map = new Map<string, Story>();
          prev.forEach((s) => map.set(s.id, s));
          supaStories.forEach((s) => map.set(s.id, s));
          return Array.from(map.values()).filter((s) => s.expiresAt ? Date.now() < s.expiresAt : true);
        });
      }
    });

    const sub = subscribeToSupabaseStories(
      (newStory: Story) => {
        setStories((prev) => {
          if (prev.some((s) => s.id === newStory.id)) return prev;
          return [newStory, ...prev];
        });
      },
      (deletedId: string) => {
        setStories((prev) => prev.filter((s) => s.id !== deletedId));
      }
    );

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, []);

  const addStory = useCallback(async (storyData: { text?: string; mediaUrl?: string; durationHours?: number }) => {
    if (!currentUser) return;
    const durationHours = storyData.durationHours && storyData.durationHours > 0 ? storyData.durationHours : 24;

    const publishedRecord = await publishStoryToSupabase({
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text: storyData.text,
      mediaUrl: storyData.mediaUrl,
      durationHours,
    });

    if (publishedRecord) {
      setStories((prev) => {
        if (prev.some((s) => s.id === publishedRecord.id)) return prev;
        return [publishedRecord, ...prev];
      });
      sounds.playNotificationSound();
    }
  }, [currentUser]);

  const deleteStory = useCallback(async (storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    await deleteStoryFromSupabase(storyId);
  }, []);

  // Synchronize Call Manager state ('idle' | 'ringing' | 'in-call') with activeCall lifecycle
  useEffect(() => {
    if (!activeCall || activeCall.status === 'ended') {
      setCallManagerState('idle');
    } else if (activeCall.status === 'incoming_ringing' || activeCall.status === 'outgoing_ringing') {
      setCallManagerState('ringing');
    } else if (activeCall.status === 'connected') {
      setCallManagerState('in-call');
    } else {
      setCallManagerState('idle');
    }
  }, [activeCall?.status]);

  // Connected Call Duration Timer Ticker (seconds)
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') return;
    const interval = setInterval(() => {
      setActiveCall((prev) => {
        if (!prev || prev.status !== 'connected') return prev;
        return { ...prev, durationSeconds: prev.durationSeconds + 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const openAvatarModal = () => setIsAvatarModalOpen(true);

  // WebAuthn Biometric & App Lock State
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('darna_biometric_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const lockApp = useCallback(() => {
    setIsAppLocked(true);
  }, []);

  const toggleBiometric = useCallback(async (enabled: boolean) => {
    if (!currentUser) return { success: false, message: 'يرجى تسجيل الدخول أولاً.' };

    if (enabled) {
      const res = await registerBiometricPasskey({
        id: currentUser.id,
        name: currentUser.name,
        phone: currentUser.phone,
      });
      if (res.success) {
        setBiometricEnabled(true);
        safeLocalStorageSet('darna_biometric_enabled', 'true');
        return { success: true, message: 'تم تفعيل قفل البصمة / الوجه بنجاح! 🔒' };
      }
      return { success: false, message: res.message || 'تعذر تسجيل البصمة/الوجه.' };
    } else {
      setBiometricEnabled(false);
      safeLocalStorageSet('darna_biometric_enabled', 'false');
      return { success: true, message: 'تم إلغاء تفعيل قفل البصمة/الوجه.' };
    }
  }, [currentUser]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!currentUser) return { success: false };
    const res = await verifyBiometricPasskey({
      id: currentUser.id,
      phone: currentUser.phone,
    });
    if (res.success) {
      setIsAppLocked(false);
      return { success: true };
    }
    return { success: false, message: 'تعذر التحقق من البصمة/الوجه.' };
  }, [currentUser]);

  const unlockWithPassword = useCallback((inputPass: string) => {
    const clean = inputPass.trim();
    if (clean === familyPassword || clean === SYSTEM_ADMIN.password) {
      setIsAppLocked(false);
      return true;
    }
    return false;
  }, [familyPassword]);

  const verifyBiometricForAction = useCallback(async (actionName: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'يرجى تسجيل الدخول أولاً' };

    const res = await verifyBiometricPasskey({
      id: currentUser.id,
      phone: currentUser.phone,
    });

    if (res.success) {
      return { success: true, message: `تم تأكيد العملية الحساسة (${actionName}) بالبصمة/الوجه 🔒` };
    }
    return { success: false, message: res.message || `تعذر تأكيد العملية الحساسة (${actionName}) بالبصمة/الوجه.` };
  }, [currentUser]);

  const closeAvatarModal = () => {
    if (currentUser) {
      try {
        localStorage.setItem('darna_avatar_prompted_' + currentUser.id, 'true');
      } catch {}
    }
    setIsAvatarModalOpen(false);
  };

  // Automatically prompt user to set their avatar once on first login ever
  useEffect(() => {
    if (currentUser && currentUser.status === 'ACTIVE') {
      const promptedKey = 'darna_avatar_prompted_' + currentUser.id;
      const setKey = 'darna_avatar_set_' + currentUser.id;
      const alreadyPrompted = localStorage.getItem(promptedKey) || localStorage.getItem(setKey) || currentUser.hasCustomAvatar;

      if (!alreadyPrompted) {
        try {
          localStorage.setItem(promptedKey, 'true');
        } catch {}
        const timer = setTimeout(() => {
          setIsAvatarModalOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser?.id, currentUser?.status]);

  // Incoming Messages Unread Indicators
  const totalUnreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return messages.filter(
      (m) =>
        m.senderId !== currentUser.id &&
        (!m.readBy || !m.readBy.includes(currentUser.id))
    ).length;
  }, [messages, currentUser?.id]);

  const getUnreadCountForChat = useCallback(
    (chatId: string): number => {
      if (!currentUser) return 0;
      return messages.filter(
        (m) =>
          m.chatId === chatId &&
          m.senderId !== currentUser.id &&
          (!m.readBy || !m.readBy.includes(currentUser.id))
      ).length;
    },
    [messages, currentUser?.id]
  );

  const markChatMessagesAsRead = useCallback(
    (chatId: string) => {
      if (!currentUser) return;
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.chatId === chatId && m.senderId !== currentUser.id && !m.readBy?.includes(currentUser.id)) {
            changed = true;
            const updatedReadBy = Array.from(new Set([...(m.readBy || []), currentUser.id]));
            // Read receipt must NOT consume a View Once image.
            return { ...m, readBy: updatedReadBy }; 
          }
          return m;
        });
        if (changed) {
          safeLocalStorageSet('darna_v4_messages', next);
        }
        return changed ? next : prev;
      });
    },
    [currentUser?.id]
  );

  // Automatically mark active chat messages as read
  useEffect(() => {
    if (activeChatId) {
      markChatMessagesAsRead(activeChatId);
    }
  }, [activeChatId, markChatMessagesAsRead]);

  // Multi-Cloud Sync Helpers (Server + Firestore + Supabase + BroadcastChannel)
  const syncUserToCloud = (u: User) => {
    // 1. App Server Endpoint
    fetch('/api/sync/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u),
    }).catch((err) => console.warn('Server user sync error:', err));

    // 2. Firestore darna_users
    try {
      setDoc(doc(db, 'darna_users', u.id), u, { merge: true }).catch((err) =>
        console.warn('Firestore user sync warning:', err)
      );
    } catch (e) {}

    // 3. Supabase users table
    try {
      Promise.resolve(
        supabase.from('users').upsert([
          {
            id: u.id,
            phone: u.phone,
            name: u.name,
            role: u.role,
            status: u.status,
            short_id: u.shortId,
            avatar_url: u.avatar,
            relationship: u.relationship,
            is_online: u.isOnline,
            can_create_groups: u.canCreateGroups,
            can_send_invites: u.canSendInvites,
          },
        ])
      ).catch(() => {});
    } catch (e) {}

    // 4. Cross-tab BroadcastChannel
    if (realtimeChannel) {
      realtimeChannel.postMessage({ type: 'USER_SYNC', payload: u });
    }
  };

  const syncChatToCloud = (c: Chat) => {
    fetch('/api/sync/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }).catch(() => {});
    try {
      setDoc(doc(db, 'darna_chats', c.id), c, { merge: true }).catch(() => {});
    } catch (e) {}
  };

  const syncMessageToCloud = (m: Message) => {
    fetch('/api/sync/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    }).catch(() => {});
    try {
      setDoc(doc(db, 'darna_messages', m.id), m, { merge: true }).catch(() => {});
    } catch (e) {}
  };

  // Periodic state fetch from server (Every 1.5 seconds)
  useEffect(() => {
    const fetchServerState = () => {
      fetch('/api/sync/state')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          if (Array.isArray(data.users) && data.users.length > 0) {
            setUsers((prev) => {
              const map = new Map<string, User>();
              prev.forEach((u) => map.set(u.id, u));
              data.users.forEach((raw: any) => {
                const existing = map.get(raw.id) || prev.find((u) => u.phone === raw.phone);
                const merged: User = {
                  id: raw.id,
                  phone: raw.phone,
                  name: raw.name,
                  role: raw.role || existing?.role || 'MEMBER',
                  status: raw.status || existing?.status || 'PENDING',
                  shortId: raw.shortId || existing?.shortId || ('DRN-' + String(raw.id).slice(0, 4).toUpperCase()),
                  avatar: raw.avatar || raw.avatarUrl || existing?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(raw.name)}&backgroundColor=0d9488`,
                  relationship: raw.relationship || raw.bio || existing?.relationship || 'فرد من العائلة',
                  canCreateGroups: raw.canCreateGroups ?? existing?.canCreateGroups ?? false,
                  canSendInvites: raw.canSendInvites ?? existing?.canSendInvites ?? true,
                  registeredAt: existing?.registeredAt || getArabicTime(),
                  isOnline: raw.online ?? existing?.isOnline ?? true,
                  biometricEnabled: existing?.biometricEnabled ?? false,
                  autoReply: existing?.autoReply,
                };

                // Check if current user status changed
                if (currentUser && (currentUser.id === merged.id || currentUser.phone === merged.phone)) {
                  if (currentUser.status !== merged.status) {
                    setCurrentUser(merged);
                    if (merged.status === 'ACTIVE') {
                      sounds.playNotificationSound();
                    }
                  }
                }

                map.set(merged.id, merged);
              });

              if (!map.has(SYSTEM_ADMIN.id)) {
                map.set(SYSTEM_ADMIN.id, SYSTEM_ADMIN as any);
              }
              return Array.from(map.values());
            });
          }

          if (Array.isArray(data.chats) && data.chats.length > 0) {
            setChats((prev) => {
              const sanitized = sanitizeChatList(data.chats);
              const map = new Map<string, Chat>();
              prev.forEach((c) => map.set(c.id, c));
              sanitized.forEach((c) => {
                const existing = map.get(c.id);
                map.set(c.id, existing ? { ...existing, ...c, lastMessage: c.lastMessage || existing.lastMessage } : c);
              });
              return Array.from(map.values());
            });
          }

          if (Array.isArray(data.messages) && data.messages.length > 0) {
            data.messages.forEach((m: any) => handleIncomingMessage(m, false));
          }
        })
        .catch(() => {});
    };

    fetchServerState();
    const interval = setInterval(fetchServerState, 1500);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.status]);

  // Unified Handler for Real-Time & Polled Incoming Messages
  const handleIncomingMessage = useCallback(
    (raw: any, playSound = true) => {
      if (!raw) return;
      const msgId = raw.id || raw.messageId || `msg-${Date.now()}`;
      const targetChatId = raw.chat_id || raw.chatId;
      const senderId = raw.sender_id || raw.senderId;
      if (!targetChatId || !senderId) return;

      const timeStr =
        raw.timestamp ||
        raw.time ||
        (raw.created_at
          ? new Date(raw.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
          : getArabicTime());

      const sender = users.find((u) => u.id === senderId);
      const newMsg: Message = {
        id: msgId,
        chatId: targetChatId,
        senderId,
        senderName: raw.sender_name || raw.senderName || sender?.name || 'عضو بالعائلة',
        senderAvatar: raw.sender_avatar || raw.senderAvatar || sender?.avatar,
        text: raw.content || raw.text || '',
        mediaUrl: raw.media_url || raw.mediaUrl,
        mediaType: raw.media_type || raw.mediaType || (raw.media_url?.startsWith('data:audio') ? 'audio' : 'text'),
        isViewOnce: raw.media_type === 'view_once_image' || raw.is_view_once || raw.isViewOnce || false,
        viewed: raw.is_viewed || raw.viewed || false,
        timestamp: timeStr,
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        if (playSound && currentUser && newMsg.senderId !== currentUser.id) {
          sounds.playNotificationSound();
        }
        return [...prev, newMsg];
      });

      // Automatically ensure Chat exists on both devices with strict deduplication
      setChats((prevChats) => {
        let partnerId: string | null = null;
        if (targetChatId.startsWith('direct_') && currentUser) {
          const parts = targetChatId.replace('direct_', '').split('_');
          partnerId = parts.find((p: string) => p !== currentUser.id) || senderId;
        }

        const existing = prevChats.find((c) =>
          c.id === targetChatId ||
          (Boolean(currentUser && partnerId) && c.type === 'DIRECT' && c.participants?.includes(currentUser!.id) && c.participants?.includes(partnerId!))
        );

        if (existing) {
          return prevChats.map((c) =>
            c.id === existing.id
              ? { ...c, lastMessage: newMsg, updatedAt: timeStr }
              : c
          );
        }

        if (targetChatId.startsWith('direct_') && currentUser && partnerId) {
          const partner = users.find((u) => u.id === partnerId);
          const newChat: Chat = {
            id: `direct_${[currentUser.id, partnerId].sort().join('_')}`,
            type: 'DIRECT',
            participants: [currentUser.id, partnerId],
            title: partner ? partner.name : (senderId !== currentUser.id ? newMsg.senderName : 'محادثة خاصة'),
            lastMessage: newMsg,
            updatedAt: timeStr,
          };
          return [newChat, ...prevChats];
        }
        return prevChats;
      });
    },
    [currentUser?.id, users]
  );

  // Unified Handler for Real-Time & Polled Call Signals
  const handleCallSignal = useCallback(
    async (signal: any) => {
      if (!signal || !currentUser) return;
      const callerId = signal.caller_id || signal.callerId;
      const receiverId = signal.receiver_id || signal.receiverId;
      const signalType = signal.signal_type || signal.signalType;
      const payload = signal.payload || {};
      const callStatus = signal.status;
      const callId = payload.callId || signal.id || signal.callId;

      if (receiverId !== currentUser.id && callerId !== currentUser.id) return;

      const now = Date.now();
      const signalTime = signal.updatedAt || payload?.timestamp || now;

      // Handle ICE Candidates
      if (signalType === 'candidate') {
        const candidate = signal.candidate || payload.candidate;
        if (candidate) {
          webrtcService.addIceCandidate(candidate);
        }
        return;
      }

      // Handle Incoming Call Offer
      if (signalType === 'offer' || callStatus === 'incoming_ringing') {
        // Discard stale signals older than 12 seconds
        if (now - signalTime > 12000) return;

        if (receiverId === currentUser.id && callerId !== currentUser.id) {
          if (callId && handledCallIds.current.has(callId)) {
            return;
          }
          if (callId) {
            handledCallIds.current.add(callId);
          }

          // Cache pending offer SDP for answering
          if (signal.sdp || payload.sdp) {
            pendingOfferSdp.current = signal.sdp || payload.sdp;
          }

          setActiveCall((curr) => {
            if (curr && (curr.status === 'connected' || curr.id === callId)) {
              return curr;
            }

            const callerUser: User = {
              id: callerId,
              name: signal.callerName || payload.callerName || 'عضو بالعائلة',
              avatar: signal.callerAvatar || payload.callerAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=U',
              phone: signal.callerPhone || payload.callerPhone || '',
              relationship: 'عضو في العائلة',
              role: 'MEMBER',
              status: 'ACTIVE',
              shortId: 'CALL',
              canCreateGroups: true,
              canSendInvites: true,
              registeredAt: '',
              isOnline: true,
            };

            sounds.playIncomingRing();

            // Trigger Browser Push Notification if supported and permitted
            if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                try {
                  new Notification(`مكالمة واردة من ${callerUser.name} 📲`, {
                    body: 'انقر لفتح التطبيق والرد على المكالمة',
                    icon: callerUser.avatar,
                    tag: `call-${callId}`,
                  });
                } catch (e) {}
              } else if (Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
              }
            }

            return {
              id: callId || `call-${Date.now()}`,
              targetUser: callerUser,
              isIncoming: true,
              status: 'incoming_ringing',
              durationSeconds: 0,
              isMuted: false,
              isSpeakerOn: false,
            };
          });
        }
      } else if (signalType === 'answer' || callStatus === 'connected') {
        // Stop outgoing ringtone and connect
        sounds.stopRingtone();
        sounds.playCallConnected();

        const answerSdp = signal.sdp || payload.sdp;
        if (answerSdp) {
          await webrtcService.handleAnswer(answerSdp);
        }

        setActiveCall((prev) => {
          if (prev && prev.status === 'outgoing_ringing') {
            return { ...prev, status: 'connected' };
          }
          return prev;
        });
      } else if (signalType === 'ended' || callStatus === 'ended') {
        // Strictly match callId so past ended calls never abort a new call
        setActiveCall((prev) => {
          if (prev && (!callId || prev.id === callId)) {
            sounds.stopRingtone();
            sounds.playCallEnded();
            webrtcService.cleanup();

            addCallLog({
              id: `call-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              callId: prev.id,
              partnerId: prev.targetUser.id,
              partnerName: prev.targetUser.name,
              partnerAvatar: prev.targetUser.avatar,
              partnerPhone: prev.targetUser.phone,
              direction: prev.isIncoming ? (prev.durationSeconds > 0 ? 'incoming' : 'missed') : 'outgoing',
              durationSeconds: prev.durationSeconds,
              timestamp: getArabicTime(),
              date: Date.now(),
              status: prev.durationSeconds > 0 ? 'completed' : (prev.isIncoming ? 'declined' : 'missed'),
            });

            setTimeout(() => setActiveCall(null), 400);
            return { ...prev, status: 'ended' };
          }
          return prev;
        });
      }
    },
    [currentUser?.id, addCallLog]
  );

  // Global Realtime Messages Listener (Supabase Realtime Broadcast & Postgres)
  useEffect(() => {
    const sub = subscribeToGlobalMessages((raw: any) => {
      handleIncomingMessage(raw, true);
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [handleIncomingMessage]);

  // Firestore Live Listener for instant cross-device user sync
  useEffect(() => {
    try {
      const unsubUsers = onSnapshot(collection(db, 'darna_users'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const raw: any = change.doc.data();
          if (raw && raw.id) {
            setUsers((prev) => {
              const exists = prev.some((u) => u.id === raw.id || u.phone === raw.phone);
              const formatted: User = {
                id: raw.id,
                phone: raw.phone,
                name: raw.name,
                role: raw.role || 'MEMBER',
                status: raw.status || 'PENDING',
                shortId: raw.shortId || ('DRN-' + String(raw.id).slice(0, 4).toUpperCase()),
                avatar: raw.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(raw.name)}&backgroundColor=0d9488`,
                relationship: raw.relationship || 'فرد من العائلة',
                canCreateGroups: raw.canCreateGroups ?? false,
                canSendInvites: raw.canSendInvites ?? true,
                registeredAt: raw.registeredAt || getArabicTime(),
                isOnline: raw.isOnline ?? true,
              };

              if (currentUser && (currentUser.id === formatted.id || currentUser.phone === formatted.phone)) {
                if (currentUser.status !== formatted.status) {
                  setCurrentUser((curr) => curr ? { ...curr, status: formatted.status } : null);
                  if (formatted.status === 'ACTIVE') {
                    sounds.playNotificationSound();
                  }
                }
              }

              if (exists) {
                return prev.map((u) => (u.id === raw.id || u.phone === raw.phone ? { ...u, ...formatted } : u));
              }
              return [...prev, formatted];
            });
          }
        });
      }, (err) => console.warn('Firestore users listener notice:', err));

      return () => unsubUsers();
    } catch (e) {}
  }, [currentUser?.id, currentUser?.status]);

  // Initial fetch of users from Supabase
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, User>();
            prev.forEach((u) => map.set(u.phone, u));
            data.forEach((raw: any) => {
              const u: User = {
                id: raw.id,
                phone: raw.phone,
                name: raw.name,
                role: raw.role || 'MEMBER',
                status: raw.status || 'PENDING',
                shortId: raw.short_id || ('DRN-' + (raw.id ? String(raw.id).slice(0, 4).toUpperCase() : Math.floor(1000 + Math.random() * 9000))),
                avatar: raw.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(raw.name)}&backgroundColor=0d9488`,
                relationship: raw.relationship || 'فرد من العائلة',
                canCreateGroups: raw.can_create_groups ?? false,
                canSendInvites: raw.can_send_invites ?? true,
                registeredAt: raw.created_at ? new Date(raw.created_at).toLocaleDateString('ar-SA') : getArabicTime(),
                isOnline: raw.is_online ?? true,
              };
              map.set(u.phone, { ...map.get(u.phone), ...u });
            });
            if (!map.has(SYSTEM_ADMIN.phone)) {
              map.set(SYSTEM_ADMIN.phone, SYSTEM_ADMIN as any);
            }
            return Array.from(map.values());
          });
        }
      } catch (e) {
        console.warn('Supabase initial users query notice:', e);
      }
    };
    loadUsers();
  }, []);

  // Supabase Realtime Listener for Users table updates
  useEffect(() => {
    const channel = supabase
      .channel('darna_public_users')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload: any) => {
          if (payload?.new) {
            const raw = payload.new;
            setUsers((prev) => {
              const exists = prev.some((u) => u.id === raw.id || u.phone === raw.phone);
              const formatted: User = {
                id: raw.id,
                phone: raw.phone,
                name: raw.name,
                role: raw.role || 'MEMBER',
                status: raw.status || 'PENDING',
                shortId: raw.short_id || ('DRN-' + String(raw.id).slice(0, 4).toUpperCase()),
                avatar: raw.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(raw.name)}&backgroundColor=0d9488`,
                relationship: raw.relationship || 'فرد من العائلة',
                canCreateGroups: raw.can_create_groups ?? false,
                canSendInvites: raw.can_send_invites ?? true,
                registeredAt: raw.created_at ? new Date(raw.created_at).toLocaleDateString('ar-SA') : getArabicTime(),
                isOnline: raw.is_online ?? true,
              };

              if (currentUser && (currentUser.id === formatted.id || currentUser.phone === formatted.phone)) {
                setCurrentUser((curr) => curr ? { ...curr, ...formatted } : null);
              }

              if (exists) {
                return prev.map((u) => (u.id === raw.id || u.phone === raw.phone ? { ...u, ...formatted } : u));
              }
              return [...prev, formatted];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  // Real WebRTC Call Signals via Supabase
  useEffect(() => {
    if (!currentUser) return;
    const sub = subscribeToIncomingCalls(currentUser.id, (signal: any) => {
      handleCallSignal(signal);
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [currentUser?.id, handleCallSignal]);

  // Call Signals Fallback via Server Polling
  useEffect(() => {
    if (!currentUser) return;
    const checkServerCalls = () => {
      fetch('/api/call/signals')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data.signals)) return;
          const relevantSignals = data.signals.filter(
            (s: any) =>
              (s.receiverId === currentUser.id || s.callerId === currentUser.id) &&
              Date.now() - (s.updatedAt || 0) < 30000
          );
          relevantSignals.forEach(handleCallSignal);
        })
        .catch(() => {});
    };

    checkServerCalls();
    const interval = setInterval(checkServerCalls, 1500);
    return () => clearInterval(interval);
  }, [currentUser?.id, handleCallSignal]);

  // Cross-tab BroadcastChannel listener
  useEffect(() => {
    if (!realtimeChannel) return;
    const handleBroadcast = (event: MessageEvent) => {
      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'NEW_MESSAGE' && data.payload) {
        handleIncomingMessage(data.payload, true);
      } else if (data.type === 'CALL_SIGNAL' && data.payload) {
        handleCallSignal(data.payload);
      }
    };

    realtimeChannel.addEventListener('message', handleBroadcast);
    return () => realtimeChannel.removeEventListener('message', handleBroadcast);
  }, [handleIncomingMessage, handleCallSignal]);

  // Synchronize state with localStorage
  useEffect(() => {
    safeLocalStorageSet('darna_family_password', familyPassword);
  }, [familyPassword]);

  useEffect(() => {
    safeLocalStorageSet('darna_v4_users', users);
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      safeLocalStorageSet('darna_v4_current_user', currentUser);
    } else {
      try {
        localStorage.removeItem('darna_v4_current_user');
      } catch {}
    }
  }, [currentUser]);

  useEffect(() => {
    safeLocalStorageSet('darna_v4_groups', groups);
  }, [groups]);

  useEffect(() => {
    safeLocalStorageSet('darna_v4_chats', chats);
  }, [chats]);

  useEffect(() => {
    safeLocalStorageSet('darna_v4_messages', messages);
  }, [messages]);

  // Clean typing indicators older than 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingIndicators((prev) => prev.filter((t) => now - t.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Voice call duration timer
  useEffect(() => {
    let timer: any = null;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, durationSeconds: prev.durationSeconds + 1 } : null));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.status]);

  // Real Supabase Authentication
  const login = async ({
    phone,
    password,
    name,
    inviteCode,
  }: {
    phone: string;
    password: string;
    name?: string;
    inviteCode?: string;
  }) => {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanPhone) {
      return { success: false, message: 'يرجى إدخال رقم الجوال للمتابعة.' };
    }
    if (!cleanPassword) {
      return { success: false, message: 'يرجى إدخال كلمة السر.' };
    }

    // 1. Admin Login
    if (cleanPhone === SYSTEM_ADMIN.phone) {
      if (cleanPassword !== SYSTEM_ADMIN.password) {
        return { success: false, message: 'كلمة سر الإدارة غير صحيحة! يرجى التأكد من الرمز السري الخاص بمسؤول التطبيق عمر.' };
      }

      let supaUser: any = null;
      try {
        supaUser = await authenticateUser({
          phone: cleanPhone,
          fullName: SYSTEM_ADMIN.name,
          password: cleanPassword,
        });
      } catch (e) {
        console.warn('Supabase admin auth note:', e);
      }

      const adminUser: User = {
        id: supaUser?.id || SYSTEM_ADMIN.id,
        phone: SYSTEM_ADMIN.phone,
        name: SYSTEM_ADMIN.name,
        role: 'ADMIN',
        status: 'ACTIVE',
        shortId: supaUser?.short_id || SYSTEM_ADMIN.shortId,
        avatar: supaUser?.avatar_url || SYSTEM_ADMIN.avatar,
        relationship: SYSTEM_ADMIN.relationship,
        canCreateGroups: true,
        canSendInvites: true,
        registeredAt: SYSTEM_ADMIN.registeredAt,
        isOnline: true,
        biometricEnabled: true,
        autoReply: SYSTEM_ADMIN.autoReply,
      };

      setCurrentUser(adminUser);
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.phone !== SYSTEM_ADMIN.phone);
        return [adminUser, ...filtered];
      });
      syncUserToCloud(adminUser);
      sounds.playNotificationSound();
      return { success: true, status: 'ACTIVE', role: 'ADMIN', shortId: adminUser.shortId };
    }

    // 2. Family Password Check
    if (cleanPassword !== familyPassword) {
      return {
        success: false,
        message: 'كلمة سر العائلة غير صحيحة! يرجى إدخال كلمة سر العائلة المشتركة المعتمدة من مسؤول التطبيق عمر.',
      };
    }

    // Real Supabase User Lookup or Registration
    let supaUser: any = null;
    try {
      supaUser = await authenticateUser({
        phone: cleanPhone,
        fullName: name?.trim() || cleanPhone,
        password: cleanPassword,
      });
    } catch (err: any) {
      console.warn('Supabase auth notice:', err);
    }

    const existing = users.find((u) => u.phone === cleanPhone);
    if (existing && existing.status === 'REJECTED') {
      return {
        success: false,
        message: 'عذراً، تم رفض طلب هذا الحساب من قِبل مسؤول التطبيق عمر. يرجى مراجعة المسؤول.',
      };
    }

    const resolvedStatus: User['status'] = (supaUser?.status || existing?.status || 'PENDING') as User['status'];
    const resolvedRole: User['role'] = (supaUser?.role || existing?.role || 'MEMBER') as User['role'];
    const resolvedShortId = supaUser?.short_id || existing?.shortId || generateUniqueShortId(users);

    const loggedUser: User = {
      id: supaUser?.id || existing?.id || `user-${Date.now()}`,
      phone: cleanPhone,
      name: supaUser?.name || existing?.name || name?.trim() || cleanPhone,
      role: resolvedRole,
      status: resolvedStatus,
      shortId: resolvedShortId,
      avatar: supaUser?.avatar_url || existing?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanPhone)}&backgroundColor=0d9488`,
      relationship: existing?.relationship || 'فرد من العائلة',
      canCreateGroups: supaUser?.can_create_groups ?? existing?.canCreateGroups ?? false,
      canSendInvites: supaUser?.can_send_invites ?? existing?.canSendInvites ?? true,
      registeredAt: existing?.registeredAt || getArabicTime(),
      isOnline: true,
      biometricEnabled: existing?.biometricEnabled ?? false,
      autoReply: existing?.autoReply,
    };

    setCurrentUser(loggedUser);
    setUsers((prev) => {
      const existsInList = prev.some((u) => u.phone === cleanPhone);
      if (existsInList) {
        return prev.map((u) => (u.phone === cleanPhone ? loggedUser : u));
      }
      return [...prev, loggedUser];
    });

    // Synchronize user to server + Firestore + Supabase
    syncUserToCloud(loggedUser);

    sounds.playNotificationSound();
    return { success: true, status: resolvedStatus, role: resolvedRole, shortId: resolvedShortId };
  };

  const logout = () => {
    if (currentUser) {
      Promise.resolve(
        supabase
          .from('users')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', currentUser.id)
      ).catch(() => {});
    }
    setCurrentUser(null);
    setActiveChatId(null);
    setActiveCall(null);
    sounds.playCallEnded();
  };

  const refreshMyStatus = async () => {
    if (!currentUser) return;
    try {
      // 1. Check Server Persistent State
      const res = await fetch('/api/sync/state');
      if (res.ok) {
        const state = await res.json();
        const serverUser = state.users?.find((u: any) => u.id === currentUser.id || u.phone === currentUser.phone);
        if (serverUser && serverUser.status !== currentUser.status) {
          const updated = { ...currentUser, status: serverUser.status as User['status'] };
          setCurrentUser(updated);
          setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));
          if (serverUser.status === 'ACTIVE') {
            sounds.playNotificationSound();
          }
          return;
        }
      }

      // 2. Check Supabase
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.${currentUser.id},phone.eq.${currentUser.phone}`)
        .maybeSingle();

      if (!error && data) {
        if (data.status !== currentUser.status) {
          const updated = { ...currentUser, status: data.status as User['status'] };
          setCurrentUser(updated);
          setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));
          if (data.status === 'ACTIVE') {
            sounds.playNotificationSound();
          }
        }
      }
    } catch (e) {
      console.warn('Refresh status notice:', e);
    }
  };

  const approveUser = async (userId: string) => {
    let targetUser: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          targetUser = { ...u, status: 'ACTIVE' as const };
          return targetUser;
        }
        return u;
      })
    );
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, status: 'ACTIVE' } : null));
    }
    sounds.playNotificationSound();

    if (targetUser) {
      syncUserToCloud(targetUser);
    } else {
      const found = users.find((u) => u.id === userId);
      if (found) syncUserToCloud({ ...found, status: 'ACTIVE' });
    }
  };

  const rejectUser = async (userId: string) => {
    let targetUser: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          targetUser = { ...u, status: 'REJECTED' as const };
          return targetUser;
        }
        return u;
      })
    );
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
    }

    if (targetUser) {
      syncUserToCloud(targetUser);
    } else {
      const found = users.find((u) => u.id === userId);
      if (found) syncUserToCloud({ ...found, status: 'REJECTED' });
    }
  };

  const toggleUserPermission = (userId: string, permission: 'canCreateGroups' | 'canSendInvites') => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, [permission]: !u[permission] } : u))
    );
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, [permission]: !prev[permission] } : null));
    }
  };

  const updateFamilyPassword = (newPass: string): boolean => {
    const clean = newPass.trim();
    if (!clean) return false;
    setFamilyPassword(clean);
    sounds.playNotificationSound();
    return true;
  };

  const createGroup = (name: string, description: string, memberIds: string[]) => {
    if (!currentUser) return { success: false, error: 'غير مسجل' };
    if (currentUser.role !== 'ADMIN' && !currentUser.canCreateGroups) {
      return { success: false, error: 'ليس لديك صلاحية لإنشاء مجموعات جديدة' };
    }
    if (!name.trim()) {
      return { success: false, error: 'يرجى كتابة اسم المجموعة' };
    }

    const allMembers = Array.from(new Set([currentUser.id, ...memberIds]));
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: getArabicTime(),
      members: allMembers,
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=0f766e`,
    };

    const newChat: Chat = {
      id: `chat-${newGroup.id}`,
      type: 'GROUP',
      groupId: newGroup.id,
      title: newGroup.name,
      participants: allMembers,
      updatedAt: getArabicTime(),
    };

    setGroups((prev) => [newGroup, ...prev]);
    setChats((prev) => [newChat, ...prev]);
    sounds.playMessageSent();

    return { success: true, group: newGroup };
  };

  const updateGroupInfo = (groupId: string, name: string, description: string, avatar?: string): boolean => {
    if (!name.trim()) return false;
    const finalAvatar = avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=0f766e`;

    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              name: name.trim(),
              description: description.trim() || undefined,
              avatar: finalAvatar,
            }
          : g
      )
    );

    setChats((prev) =>
      prev.map((c) =>
        c.groupId === groupId
          ? {
              ...c,
              title: name.trim(),
            }
          : c
      )
    );

    return true;
  };

  const addGroupMembers = (groupId: string, newMemberIds: string[]): boolean => {
    if (!newMemberIds.length) return false;

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const updated = Array.from(new Set([...g.members, ...newMemberIds]));
        return { ...g, members: updated };
      })
    );

    setChats((prev) =>
      prev.map((c) => {
        if (c.groupId !== groupId) return c;
        const updated = Array.from(new Set([...c.participants, ...newMemberIds]));
        return { ...c, participants: updated };
      })
    );

    return true;
  };

  const removeGroupMember = (groupId: string, memberId: string): boolean => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, members: g.members.filter((id) => id !== memberId) };
      })
    );

    setChats((prev) =>
      prev.map((c) => {
        if (c.groupId !== groupId) return c;
        return { ...c, participants: c.participants.filter((id) => id !== memberId) };
      })
    );

    if (currentUser?.id === memberId && activeChatId === `chat-${groupId}`) {
      setActiveChatId(null);
    }

    return true;
  };

  const clearChatMessages = (chatId: string) => {
    setMessages((prev) => prev.filter((m) => m.chatId !== chatId));
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, lastMessage: undefined } : c))
    );
  };

  const leaveGroup = (groupId: string) => {
    if (!currentUser) return;
    removeGroupMember(groupId, currentUser.id);
    const chatId = `chat-${groupId}`;
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const deleteGroup = (groupId: string) => {
    const chatId = `chat-${groupId}`;
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setChats((prev) => prev.filter((c) => c.groupId !== groupId && c.id !== chatId));
    setMessages((prev) => prev.filter((m) => m.chatId !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const getOrCreateDirectChat = (partnerId: string): string => {
    if (!currentUser) return '';

    const deterministicId = `direct_${[currentUser.id, partnerId].sort().join('_')}`;
    const existing = chats.find(
      (c) =>
        c.type === 'DIRECT' &&
        (c.id === deterministicId ||
          (c.participants?.includes(currentUser.id) && c.participants?.includes(partnerId)) ||
          (c.id.includes(currentUser.id) && c.id.includes(partnerId)))
    );

    if (existing) {
      if (existing.id !== deterministicId) {
        existing.id = deterministicId;
      }
      return existing.id;
    }

    const partner = users.find((u) => u.id === partnerId);
    const newChat: Chat = {
      id: deterministicId,
      type: 'DIRECT',
      participants: [currentUser.id, partnerId],
      title: partner ? partner.name : 'محادثة خاصة',
      updatedAt: getArabicTime(),
    };

    setChats((prev) => {
      const already = prev.find(
        (c) =>
          c.type === 'DIRECT' &&
          (c.id === deterministicId ||
            (c.participants?.includes(currentUser.id) && c.participants?.includes(partnerId)))
      );
      if (already) return prev;
      return [newChat, ...prev];
    });
    syncChatToCloud(newChat);
    return deterministicId;
  };

  const connectByShortId = (targetShortId: string): { success: boolean; message?: string; chatId?: string } => {
    if (!currentUser) return { success: false, message: 'يرجى تسجيل الدخول أولاً' };
    const cleanId = targetShortId.trim().toUpperCase().replace('#', '');
    if (!cleanId) return { success: false, message: 'يرجى إدخال رمز ID للبحث' };

    if (cleanId === currentUser.shortId.toUpperCase()) {
      return { success: false, message: 'هذا هو رمز ID الخاص بحسابك أنت!' };
    }

    const targetUser = users.find(
      (u) =>
        u.shortId.toUpperCase() === cleanId ||
        u.shortId.toUpperCase() === `DRN-${cleanId}` ||
        u.shortId.toUpperCase().replace('DRN-', '') === cleanId ||
        u.shortId.toUpperCase() === `DARNA-${cleanId}` ||
        u.shortId.toUpperCase().replace('DARNA-', '') === cleanId
    );
    if (!targetUser) {
      return { success: false, message: 'لم يتم العثور على فرد في العائلة يحمل هذا الرمز (ID). تأكد من صحة رمز الدعوة.' };
    }

    if (targetUser.status !== 'ACTIVE') {
      return { success: false, message: 'هذا العضو ما زال حسابه بانتظار اعتماد مسؤول التطبيق عمر.' };
    }

    const chatId = getOrCreateDirectChat(targetUser.id);
    setActiveChatId(chatId);
    sounds.playMessageSent();
    return { success: true, chatId };
  };

  const updateProfilePhoto = async (avatarDataUrl: string) => {
    if (!currentUser) return;
    const updated = { ...currentUser, avatar: avatarDataUrl, hasCustomAvatar: true };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

    try {
      await supabase.from('users').update({ avatar_url: avatarDataUrl }).eq('id', currentUser.id);
    } catch (e) {
      console.warn('Supabase updateProfilePhoto notice:', e);
    }
  };

  const sendMessage = async (
    chatId: string,
    text?: string,
    mediaUrl?: string,
    isViewOnce?: boolean,
    mediaType?: 'text' | 'image' | 'audio' | 'view_once_image'
  ) => {
    if (!currentUser) return;
    if (!text?.trim() && !mediaUrl) return;

    const resolvedMediaType: 'text' | 'image' | 'audio' | 'view_once_image' =
      mediaType ||
      (isViewOnce
        ? 'view_once_image'
        : mediaUrl
        ? mediaUrl.startsWith('data:audio') || mediaUrl.includes('audio') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.mp3')
          ? 'audio'
          : 'image'
        : 'text');

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: text?.trim(),
      mediaUrl,
      mediaType: resolvedMediaType,
      isViewOnce,
      viewed: false,
      timestamp: getArabicTime(),
    };

    setMessages((prev) => [...prev, newMsg]);
    sounds.playMessageSent();
    sendTypingSignal(chatId, false);

    // 1. Supabase Realtime Broadcast & Persistence
    supaSendMessage({
      id: newMsg.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      chatId,
      chatType: chatId.startsWith('direct_') ? 'direct' : 'group',
      content: text?.trim() || '',
      mediaUrl: mediaUrl || '',
      mediaType: resolvedMediaType,
      isViewOnce,
    }).catch((err) => console.warn('supaSendMessage notice:', err));

    // 2. Cross-tab BroadcastChannel
    if (realtimeChannel) {
      realtimeChannel.postMessage({ type: 'NEW_MESSAGE', payload: newMsg });
    }

    // 3. Server Cloud SQL & Firestore Sync
    syncMessageToCloud(newMsg);

    const targetChat = chats.find((c) => c.id === chatId);
    if (targetChat) {
      syncChatToCloud({ ...targetChat, lastMessage: newMsg, updatedAt: getArabicTime() });
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, lastMessage: newMsg, updatedAt: getArabicTime() } : c
      )
    );
  };

  const sendTypingSignal = (chatId: string, isTyping: boolean) => {
    if (!currentUser) return;
    const now = Date.now();
    if (isTyping) {
      setTypingIndicators((prev) => {
        const withoutMe = prev.filter((t) => !(t.chatId === chatId && t.userId === currentUser.id));
        return [
          ...withoutMe,
          {
            chatId,
            userId: currentUser.id,
            userName: currentUser.name,
            timestamp: now,
          },
        ];
      });
    } else {
      setTypingIndicators((prev) =>
        prev.filter((t) => !(t.chatId === chatId && t.userId === currentUser.id))
      );
    }
  };

  const getTypingUsersInChat = (chatId: string): string[] => {
    if (!currentUser) return [];
    return typingIndicators
      .filter((t) => t.chatId === chatId && t.userId !== currentUser.id)
      .map((t) => t.userName);
  };

  // Real WebRTC Voice Calls
  const startVoiceCall = async (targetUser: User) => {
    if (!currentUser) return;
    sounds.playOutgoingRing();
    const callId = `call-${Date.now()}`;
    handledCallIds.current.add(callId);
    const hasCamera = await webrtcService.isCameraAvailable();

    setActiveCall({
      id: callId,
      targetUser,
      isIncoming: false,
      status: 'outgoing_ringing',
      durationSeconds: 0,
      isMuted: false,
      isSpeakerOn: false,
      isVideoOn: false,
      isCameraAvailable: hasCamera,
    });

    let offerSdp: any = null;
    try {
      offerSdp = await webrtcService.createOffer((candidate) => {
        sendCallSignal({
          callerId: currentUser.id,
          receiverId: targetUser.id,
          callType: 'voice',
          signalType: 'candidate',
          payload: { callId, candidate: candidate.toJSON ? candidate.toJSON() : candidate },
        }).catch(() => {});
      });
    } catch (e) {
      console.warn('WebRTC createOffer note:', e);
    }

    const callPayload = {
      callId,
      callerName: currentUser.name,
      callerPhone: currentUser.phone,
      callerAvatar: currentUser.avatar,
      sdp: offerSdp,
    };

    try {
      await sendCallSignal({
        callerId: currentUser.id,
        receiverId: targetUser.id,
        callType: 'voice',
        signalType: 'offer',
        payload: callPayload,
      });

      if (realtimeChannel) {
        realtimeChannel.postMessage({
          type: 'CALL_SIGNAL',
          payload: {
            callerId: currentUser.id,
            receiverId: targetUser.id,
            signalType: 'offer',
            status: 'incoming_ringing',
            payload: callPayload,
          },
        });
      }
    } catch (e) {
      console.warn('Send call offer note:', e);
    }
  };

  const answerVoiceCall = async () => {
    if (!activeCall || !currentUser) return;
    sounds.stopRingtone();
    sounds.playCallConnected();
    const targetUserId = activeCall.targetUser.id;
    const callId = activeCall.id;
    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    let answerSdp: any = null;
    if (pendingOfferSdp.current) {
      try {
        answerSdp = await webrtcService.handleOffer(pendingOfferSdp.current, (candidate) => {
          sendCallSignal({
            callerId: currentUser.id,
            receiverId: targetUserId,
            callType: 'voice',
            signalType: 'candidate',
            payload: { callId, candidate: candidate.toJSON ? candidate.toJSON() : candidate },
          }).catch(() => {});
        });
      } catch (err) {
        console.warn('WebRTC handleOffer note:', err);
      }
    }

    try {
      await sendCallSignal({
        callerId: currentUser.id,
        receiverId: targetUserId,
        callType: 'voice',
        signalType: 'answer',
        payload: { callId, sdp: answerSdp },
      });

      if (realtimeChannel) {
        realtimeChannel.postMessage({
          type: 'CALL_SIGNAL',
          payload: {
            callerId: currentUser.id,
            receiverId: targetUserId,
            signalType: 'answer',
            status: 'connected',
            payload: { callId, sdp: answerSdp },
          },
        });
      }
    } catch (e) {
      console.warn('Send call answer note:', e);
    }
  };

  const declineVoiceCall = async () => {
    if (!activeCall || !currentUser) return;
    sounds.stopRingtone();
    sounds.playCallEnded();
    webrtcService.cleanup();

    const targetUserId = activeCall.targetUser.id;
    const callId = activeCall.id;

    addCallLog({
      id: `call-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      callId,
      partnerId: targetUserId,
      partnerName: activeCall.targetUser.name,
      partnerAvatar: activeCall.targetUser.avatar,
      partnerPhone: activeCall.targetUser.phone,
      direction: 'missed',
      durationSeconds: 0,
      timestamp: getArabicTime(),
      date: Date.now(),
      status: 'declined',
    });

    setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : null));

    try {
      await sendCallSignal({
        callerId: currentUser.id,
        receiverId: targetUserId,
        callType: 'voice',
        signalType: 'ended',
        payload: { callId },
      });

      if (realtimeChannel) {
        realtimeChannel.postMessage({
          type: 'CALL_SIGNAL',
          payload: {
            callerId: currentUser.id,
            receiverId: targetUserId,
            signalType: 'ended',
            status: 'ended',
            payload: { callId },
          },
        });
      }
    } catch (e) {
      console.warn('Send call decline note:', e);
    }
    setTimeout(() => setActiveCall(null), 400);
  };

  const endVoiceCall = async () => {
    if (!activeCall || !currentUser) return;
    sounds.stopRingtone();
    sounds.playCallEnded();
    webrtcService.cleanup();

    const targetUserId = activeCall.targetUser.id;
    const callId = activeCall.id;
    const duration = activeCall.durationSeconds;

    addCallLog({
      id: `call-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      callId,
      partnerId: targetUserId,
      partnerName: activeCall.targetUser.name,
      partnerAvatar: activeCall.targetUser.avatar,
      partnerPhone: activeCall.targetUser.phone,
      direction: activeCall.isIncoming ? (duration > 0 ? 'incoming' : 'missed') : 'outgoing',
      durationSeconds: duration,
      timestamp: getArabicTime(),
      date: Date.now(),
      status: duration > 0 ? 'completed' : 'missed',
    });

    setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : null));

    try {
      await sendCallSignal({
        callerId: currentUser.id,
        receiverId: targetUserId,
        callType: 'voice',
        signalType: 'ended',
        payload: { callId },
      });

      if (realtimeChannel) {
        realtimeChannel.postMessage({
          type: 'CALL_SIGNAL',
          payload: {
            callerId: currentUser.id,
            receiverId: targetUserId,
            signalType: 'ended',
            status: 'ended',
            payload: { callId },
          },
        });
      }
    } catch (e) {
      console.warn('Send call end note:', e);
    }
    setTimeout(() => setActiveCall(null), 400);
  };

  const toggleCallMute = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextMuted = !prev.isMuted;
      webrtcService.toggleMute(nextMuted);
      return { ...prev, isMuted: nextMuted };
    });
  };

  const toggleCallSpeaker = () => {
    setActiveCall((prev) => (prev ? { ...prev, isSpeakerOn: !prev.isSpeakerOn } : null));
  };

  const toggleCallCamera = async (): Promise<boolean> => {
    if (!activeCall) return false;
    const currentState = Boolean(activeCall.isVideoOn);
    const newState = await webrtcService.toggleCamera(!currentState);
    setActiveCall((prev) => (prev ? { ...prev, isVideoOn: newState } : null));
    return newState;
  };

  const openViewOnce = (msg: Message) => {
    if (!currentUser || !msg.isViewOnce || msg.senderId === currentUser.id) return;
    // UI-level guard only. Actual one-time permissions must be enforced by an authenticated backend.
    if (msg.viewedBy?.includes(currentUser.id) || !msg.mediaUrl) return;
    setViewOnceMessage(msg);
  };

  const closeViewOnce = (msgId: string) => {
    if (!currentUser) { setViewOnceMessage(null); return; }
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.senderId !== currentUser.id
        ? { ...m, viewedBy: Array.from(new Set([...(m.viewedBy || []), currentUser.id])) }
        : m
    ));
    setViewOnceMessage(null);
  };

  const updateUserSettings = (settings: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...settings };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const askFamilyAI = async (prompt: string, customHistory?: { role: string; text: string }[]): Promise<string> => {
    try {
      const historyToPass = customHistory || messages.slice(-6).map((m) => ({
        role: m.senderId === currentUser?.id ? 'user' : 'model',
        text: m.text || '',
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          conversationHistory: historyToPass,
        }),
      });

      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      return data.reply || 'أهلاً بكم في دارنا! كيف أستطيع مساعدة أسرتكم اليوم؟';
    } catch (e) {
      console.warn('API fallback notice:', e);
      return 'أهلاً بكم! أنا جاهز تماماً لمساعدتكم واقتراح كل ما تحتاجونه لجمع شمل الأسرة وتيسير يومكم.';
    }
  };

  const clearAllDataForReset = () => {
    localStorage.removeItem('darna_v4_users');
    localStorage.removeItem('darna_v4_current_user');
    localStorage.removeItem('darna_v4_groups');
    localStorage.removeItem('darna_v4_chats');
    localStorage.removeItem('darna_v4_messages');
    localStorage.removeItem('darna_family_password');
    setUsers(INITIAL_USERS);
    setCurrentUser(null);
    setGroups([]);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setFamilyPassword(DEFAULT_FAMILY_PASSWORD);
  };

  return (
    <FamilyContext.Provider
      value={{
        currentUser,
        users,
        groups,
        chats,
        messages,
        setMessages,
        activeTab,
        activeChatId,
        activeCall,
        callManagerState,
        callLogs,
        clearCallLogs,
        totalUnreadCount,
        getUnreadCountForChat,
        markChatMessagesAsRead,
        viewOnceMessage,
        typingIndicators,
        familyPassword,
        isAppLocked,
        biometricEnabled,
        lockApp,
        toggleBiometric,
        unlockWithBiometrics,
        unlockWithPassword,
        verifyBiometricForAction,
        setActiveTab,
        setActiveChatId,
        login,
        logout,
        refreshMyStatus,
        approveUser,
        rejectUser,
        toggleUserPermission,
        createGroup,
        updateGroupInfo,
        addGroupMembers,
        removeGroupMember,
        clearChatMessages,
        leaveGroup,
        deleteGroup,
        getOrCreateDirectChat,
        connectByShortId,
        updateProfilePhoto,
        isAvatarModalOpen,
        openAvatarModal,
        closeAvatarModal,
        updateFamilyPassword,
        sendMessage,
        sendTypingSignal,
        getTypingUsersInChat,
        startVoiceCall,
        answerVoiceCall,
        declineVoiceCall,
        endVoiceCall,
        toggleCallMute,
        toggleCallSpeaker,
        toggleCallCamera,
        openViewOnce,
        closeViewOnce,
        updateUserSettings,
        askFamilyAI,
        clearAllDataForReset,
        theme,
        toggleTheme,
        stories,
        addStory,
        deleteStory,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = (): FamilyContextType => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};
