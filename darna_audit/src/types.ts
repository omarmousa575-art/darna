export type UserRole = 'FAMILY_OWNER' | 'FAMILY_ADMIN' | 'FAMILY_MEMBER' | 'ADMIN' | 'MEMBER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar: string;
  shortId: string;
  relationship?: string;
  invitedBy?: string;
  canCreateGroups: boolean;
  canSendInvites: boolean;
  registeredAt: string;
  isOnline: boolean;
  biometricEnabled?: boolean;
  hasCustomAvatar?: boolean;
  autoReply?: {
    enabled: boolean;
    message: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'audio' | 'view_once_image';
  isViewOnce?: boolean;
  viewed?: boolean;
  viewedBy?: string[];
  status?: 'sending' | 'sent' | 'read';
  isAutoReply?: boolean;
  timestamp: string;
  readBy?: string[]; // user IDs who have read this message
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl?: string;
  text?: string;
  createdAt: number;
  expiresAt: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  members: string[]; // user IDs
  avatar?: string;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  participants: string[]; // user IDs
  groupId?: string;
  title?: string;
  lastMessage?: Message;
  updatedAt: string;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface CallSession {
  id: string;
  targetUser: User;
  isIncoming: boolean;
  status: 'outgoing_ringing' | 'incoming_ringing' | 'connected' | 'ended';
  durationSeconds: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoOn?: boolean;
  isCameraAvailable?: boolean;
}

export interface CallRecord {
  id: string;
  callId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  partnerPhone?: string;
  direction: 'incoming' | 'outgoing' | 'missed';
  durationSeconds: number;
  timestamp: string;
  date: number;
  status: 'completed' | 'missed' | 'declined';
}

export type MainTab = 'chats' | 'calls' | 'family' | 'assistant' | 'settings' | 'council' | 'directory' | 'admin';
export type CallManagerState = 'idle' | 'ringing' | 'in-call';
