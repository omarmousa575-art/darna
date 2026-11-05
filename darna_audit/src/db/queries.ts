import { db, isDbConfigured } from './index.ts';
import { users, messages, chats, systemSettings } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

// In-Memory Fallback Stores for when Cloud SQL is unavailable or unreachable
const inMemoryUsers = new Map<string, any>();
const inMemoryChats = new Map<string, any>();
const inMemoryMessages = new Map<string, any>();
const inMemorySettings = new Map<string, string>();

export async function getAllUsers() {
  if (!isDbConfigured()) {
    return Array.from(inMemoryUsers.values());
  }
  try {
    const res = await db.select().from(users);
    res.forEach((u) => inMemoryUsers.set(u.uid, u));
    return res;
  } catch (error) {
    console.warn('[DB] SQL query failed for getAllUsers, falling back to in-memory store:', (error as Error)?.message || error);
    return Array.from(inMemoryUsers.values());
  }
}

export async function upsertUser(userData: {
  uid: string;
  phone: string;
  name: string;
  role?: string;
  status?: string;
  shortId: string;
  avatarUrl?: string;
  bio?: string;
  online?: boolean;
  canCreateGroups?: boolean;
  canSendInvites?: boolean;
}) {
  const memRecord = {
    id: userData.uid,
    uid: userData.uid,
    phone: userData.phone,
    name: userData.name,
    role: userData.role || 'MEMBER',
    status: userData.status || 'ACTIVE',
    shortId: userData.shortId,
    avatarUrl: userData.avatarUrl || null,
    bio: userData.bio || '',
    online: userData.online ?? false,
    canCreateGroups: userData.canCreateGroups ?? true,
    canSendInvites: userData.canSendInvites ?? true,
    createdAt: new Date(),
  };

  const existing = inMemoryUsers.get(userData.uid) || {};
  inMemoryUsers.set(userData.uid, { ...existing, ...memRecord });

  if (!isDbConfigured()) {
    return inMemoryUsers.get(userData.uid);
  }

  try {
    const result = await db.insert(users)
      .values({
        uid: userData.uid,
        phone: userData.phone,
        name: userData.name,
        role: userData.role || 'MEMBER',
        status: userData.status || 'ACTIVE',
        shortId: userData.shortId,
        avatarUrl: userData.avatarUrl || null,
        bio: userData.bio || '',
        online: userData.online ?? false,
        canCreateGroups: userData.canCreateGroups ?? true,
        canSendInvites: userData.canSendInvites ?? true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          name: userData.name,
          phone: userData.phone,
          status: userData.status ?? undefined,
          role: userData.role ?? undefined,
          shortId: userData.shortId ?? undefined,
          avatarUrl: userData.avatarUrl !== undefined ? userData.avatarUrl : undefined,
          online: userData.online !== undefined ? userData.online : undefined,
          bio: userData.bio !== undefined ? userData.bio : undefined,
          canCreateGroups: userData.canCreateGroups !== undefined ? userData.canCreateGroups : undefined,
          canSendInvites: userData.canSendInvites !== undefined ? userData.canSendInvites : undefined,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('[DB] SQL upsertUser failed, fallback to in-memory:', (error as Error)?.message || error);
    return inMemoryUsers.get(userData.uid);
  }
}

export async function getAllChats() {
  if (!isDbConfigured()) {
    return Array.from(inMemoryChats.values());
  }
  try {
    const res = await db.select().from(chats).orderBy(desc(chats.createdAt));
    res.forEach((c) => inMemoryChats.set(c.chatId, c));
    return res;
  } catch (error) {
    console.warn('[DB] SQL query failed for getAllChats, falling back to in-memory store:', (error as Error)?.message || error);
    return Array.from(inMemoryChats.values());
  }
}

export async function upsertChat(chatData: {
  chatId: string;
  type: string;
  name: string;
  description?: string;
  memberIds: string[];
  lastMessageText?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}) {
  const memRecord = {
    id: chatData.chatId,
    chatId: chatData.chatId,
    type: chatData.type,
    name: chatData.name,
    description: chatData.description || '',
    memberIds: JSON.stringify(chatData.memberIds),
    lastMessageText: chatData.lastMessageText || '',
    lastMessageTime: chatData.lastMessageTime || '',
    unreadCount: chatData.unreadCount || 0,
    createdAt: new Date(),
  };

  const existing = inMemoryChats.get(chatData.chatId) || {};
  inMemoryChats.set(chatData.chatId, { ...existing, ...memRecord });

  if (!isDbConfigured()) {
    return inMemoryChats.get(chatData.chatId);
  }

  try {
    const result = await db.insert(chats)
      .values({
        chatId: chatData.chatId,
        type: chatData.type,
        name: chatData.name,
        description: chatData.description || '',
        memberIds: JSON.stringify(chatData.memberIds),
        lastMessageText: chatData.lastMessageText || '',
        lastMessageTime: chatData.lastMessageTime || '',
        unreadCount: chatData.unreadCount || 0,
      })
      .onConflictDoUpdate({
        target: chats.chatId,
        set: {
          name: chatData.name,
          description: chatData.description || '',
          memberIds: JSON.stringify(chatData.memberIds),
          lastMessageText: chatData.lastMessageText !== undefined ? chatData.lastMessageText : undefined,
          lastMessageTime: chatData.lastMessageTime !== undefined ? chatData.lastMessageTime : undefined,
          unreadCount: chatData.unreadCount !== undefined ? chatData.unreadCount : undefined,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('[DB] SQL upsertChat failed, fallback to in-memory:', (error as Error)?.message || error);
    return inMemoryChats.get(chatData.chatId);
  }
}

export async function getAllMessages(chatId?: string) {
  const memList = Array.from(inMemoryMessages.values());
  const filteredMem = chatId ? memList.filter((m) => m.chatId === chatId) : memList;

  if (!isDbConfigured()) {
    return filteredMem;
  }

  try {
    let res;
    if (chatId) {
      res = await db.select().from(messages).where(eq(messages.chatId, chatId));
    } else {
      res = await db.select().from(messages);
    }
    res.forEach((m) => inMemoryMessages.set(m.messageId, m));
    return res;
  } catch (error) {
    console.warn('[DB] SQL query failed for getAllMessages, falling back to in-memory store:', (error as Error)?.message || error);
    return filteredMem;
  }
}

export async function insertMessage(msgData: {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text?: string;
  mediaUrl?: string;
  time: string;
  isViewOnce?: boolean;
  viewed?: boolean;
  readBy?: string[];
}) {
  const memRecord = {
    id: msgData.messageId,
    messageId: msgData.messageId,
    chatId: msgData.chatId,
    senderId: msgData.senderId,
    senderName: msgData.senderName,
    text: msgData.text || null,
    mediaUrl: msgData.mediaUrl || null,
    time: msgData.time,
    isViewOnce: msgData.isViewOnce || false,
    viewed: msgData.viewed || false,
    readBy: msgData.readBy ? JSON.stringify(msgData.readBy) : '[]',
    createdAt: new Date(),
  };

  inMemoryMessages.set(msgData.messageId, memRecord);

  if (!isDbConfigured()) {
    return memRecord;
  }

  try {
    const result = await db.insert(messages)
      .values({
        messageId: msgData.messageId,
        chatId: msgData.chatId,
        senderId: msgData.senderId,
        senderName: msgData.senderName,
        text: msgData.text || null,
        mediaUrl: msgData.mediaUrl || null,
        time: msgData.time,
        isViewOnce: msgData.isViewOnce || false,
        viewed: msgData.viewed || false,
        readBy: msgData.readBy ? JSON.stringify(msgData.readBy) : '[]',
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('[DB] SQL insertMessage failed, fallback to in-memory:', (error as Error)?.message || error);
    return memRecord;
  }
}

export async function getSystemSetting(key: string): Promise<string | null> {
  const memVal = inMemorySettings.get(key) || null;
  if (!isDbConfigured()) {
    return memVal;
  }
  try {
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (rows.length > 0) {
      inMemorySettings.set(key, rows[0].value);
      return rows[0].value;
    }
    return memVal;
  } catch (error) {
    console.warn('[DB] SQL query failed for getSystemSetting, falling back to in-memory store:', (error as Error)?.message || error);
    return memVal;
  }
}

export async function setSystemSetting(key: string, value: string) {
  inMemorySettings.set(key, value);

  if (!isDbConfigured()) {
    return { key, value, updatedAt: new Date() };
  }

  try {
    const result = await db.insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('[DB] SQL setSystemSetting failed, fallback to in-memory:', (error as Error)?.message || error);
    return { key, value, updatedAt: new Date() };
  }
}

