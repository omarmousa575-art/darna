import { User, Chat, Group, Message } from './types';

// Pre-injected System Admin with exact credentials
export const SYSTEM_ADMIN = {
  id: 'admin_root',
  phone: '0998803914', // رقم جوال مسؤول التطبيق
  name: 'مسؤول التطبيق عمر', // تم التحديث إلى مسؤول التطبيق عمر
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  password: '1994@1', // كلمة سر الإدارة الخاصة
  shortId: 'DARNA-001', // رمز ID القصير للمسؤول
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Omar&backgroundColor=0f766e',
  relationship: 'مسؤول التطبيق',
  canCreateGroups: true,
  canSendInvites: true,
  registeredAt: 'التأسيس',
  isOnline: true,
  biometricEnabled: true,
  autoReply: {
    enabled: false,
    message: 'السلام عليكم، أنا في اجتماع وسأعاود الاتصال بك لاحقاً.',
  },
};

// Default Family Secret Invite Password (can be updated by Admin in Settings/Admin)
export const DEFAULT_FAMILY_PASSWORD = '1232026';

// Strictly ZERO MOCK DATA: All dynamic application data arrays start completely empty
export const INITIAL_USERS: User[] = [
  {
    id: SYSTEM_ADMIN.id,
    phone: SYSTEM_ADMIN.phone,
    name: SYSTEM_ADMIN.name,
    role: SYSTEM_ADMIN.role,
    status: SYSTEM_ADMIN.status,
    shortId: SYSTEM_ADMIN.shortId,
    avatar: SYSTEM_ADMIN.avatar,
    relationship: SYSTEM_ADMIN.relationship,
    canCreateGroups: SYSTEM_ADMIN.canCreateGroups,
    canSendInvites: SYSTEM_ADMIN.canSendInvites,
    registeredAt: SYSTEM_ADMIN.registeredAt,
    isOnline: SYSTEM_ADMIN.isOnline,
    biometricEnabled: SYSTEM_ADMIN.biometricEnabled,
    autoReply: SYSTEM_ADMIN.autoReply,
  },
];

export const INITIAL_CHATS: Chat[] = [];
export const INITIAL_GROUPS: Group[] = [];
export const INITIAL_MESSAGES: Message[] = [];
