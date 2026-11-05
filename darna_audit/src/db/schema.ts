import { pgTable, serial, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  phone: text('phone').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('MEMBER'),
  status: text('status').notNull().default('ACTIVE'),
  shortId: text('short_id').notNull().unique(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  online: boolean('online').default(false),
  canCreateGroups: boolean('can_create_groups').default(true),
  canSendInvites: boolean('can_send_invites').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  messageId: text('message_id').notNull().unique(),
  chatId: text('chat_id').notNull(),
  senderId: text('sender_id').notNull(),
  senderName: text('sender_name').notNull(),
  text: text('text'),
  mediaUrl: text('media_url'),
  time: text('time').notNull(),
  isViewOnce: boolean('is_view_once').default(false),
  viewed: boolean('viewed').default(false),
  readBy: text('read_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull().unique(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  memberIds: text('member_ids').notNull(),
  lastMessageText: text('last_message_text'),
  lastMessageTime: text('last_message_time'),
  unreadCount: integer('unread_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
