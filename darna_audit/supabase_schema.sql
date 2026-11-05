-- ===============================================================
-- DARNA Family PWA - Supabase Database Schema
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ===============================================================

-- 1. Users Table
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

-- 2. Messages Table
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

-- 3. WebRTC Call Signals Table
CREATE TABLE IF NOT EXISTS public.call_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  caller_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  call_type TEXT DEFAULT 'voice',
  signal_type TEXT NOT NULL, -- 'offer' | 'answer' | 'ice-candidate' | 'call-ended'
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- 5. Row Level Security (RLS) Permissive for Family Network
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on call_signals" ON public.call_signals FOR ALL USING (true) WITH CHECK (true);

-- 6. Storage Bucket setup
-- Create 'darna-media' bucket in Supabase Dashboard -> Storage -> New bucket named 'darna-media' (set to Public)
