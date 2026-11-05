import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rhkmjgwoxmmbzbrrcnmy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_74v4dPsz2r4Hmj6263mboA_Z0e_HsYF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Dedicated active broadcast channels for global events and calls
const globalChannel = supabase.channel('darna_global_realtime', {
  config: { broadcast: { self: false } },
});
globalChannel.subscribe();

const callsChannel = supabase.channel('darna_calls_broadcast', {
  config: { broadcast: { self: false } },
});
callsChannel.subscribe();

// 1. الدخول والتسجيل الحقيقي
export async function authenticateUser({ phone, fullName, password }) {
  const cleanPhone = phone?.trim() || '';
  const isAdmin = cleanPhone === '0998803914' || cleanPhone.includes('0998803914');

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', existingUser.id);

      // Sync with server Cloud SQL
      fetch('/api/sync/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name,
          role: existingUser.role,
          status: existingUser.status,
          avatar: existingUser.avatar_url,
          online: true,
        }),
      }).catch(() => {});

      // Broadcast user online event
      globalChannel.send({
        type: 'broadcast',
        event: 'user_status',
        payload: { id: existingUser.id, phone: existingUser.phone, is_online: true },
      }).catch(() => {});

      return existingUser;
    }

    // New user registration
    const initialStatus = isAdmin ? 'ACTIVE' : 'PENDING';
    const initialRole = isAdmin ? 'ADMIN' : 'MEMBER';

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          phone: cleanPhone,
          name: fullName || (isAdmin ? 'مسؤول التطبيق عمر' : cleanPhone),
          role: initialRole,
          status: initialStatus,
          is_online: true,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    fetch('/api/sync/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newUser.id,
        phone: newUser.phone,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
        online: true,
      }),
    }).catch(() => {});

    // Broadcast user joined
    globalChannel.send({
      type: 'broadcast',
      event: 'user_joined',
      payload: newUser,
    }).catch(() => {});

    return newUser;
  } catch (err) {
    console.warn('[darnaBackend] Supabase users table note:', err?.message || err);

    const fallbackUser = {
      id: isAdmin ? 'admin_root' : `usr_${cleanPhone.replace(/\D/g, '')}`,
      phone: cleanPhone,
      name: fullName || (isAdmin ? 'مسؤول التطبيق عمر' : 'عضو عائلة'),
      role: isAdmin ? 'ADMIN' : 'MEMBER',
      status: isAdmin ? 'ACTIVE' : 'PENDING',
      is_online: true,
      last_seen: new Date().toISOString(),
    };

    fetch('/api/sync/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: fallbackUser.id,
        phone: fallbackUser.phone,
        name: fallbackUser.name,
        role: fallbackUser.role,
        status: fallbackUser.status,
        online: true,
      }),
    }).catch(() => {});

    return fallbackUser;
  }
}

// 2. إرسال الرسائل ومزامنتها لحظياً
export async function sendMessage({
  id,
  senderId,
  senderName = '',
  senderAvatar = '',
  chatId,
  chatType = 'direct',
  content = '',
  mediaUrl = '',
  mediaType = 'text',
  isViewOnce = false,
}) {
  const timestampArabic = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const unifiedMessage = {
    id: msgId,
    sender_id: senderId,
    senderId,
    sender_name: senderName,
    senderName,
    sender_avatar: senderAvatar,
    senderAvatar,
    chat_id: chatId,
    chatId,
    chat_type: chatType,
    content: content || '',
    text: content || '',
    media_url: mediaUrl,
    mediaUrl,
    media_type: mediaType,
    mediaType,
    is_view_once: isViewOnce,
    isViewOnce,
    viewed: false,
    created_at: new Date().toISOString(),
    timestamp: timestampArabic,
    time: timestampArabic,
  };

  // 1. Send via Supabase Realtime Broadcast (Fastest, zero-latency WebSocket)
  try {
    globalChannel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: unifiedMessage,
    }).catch(() => {});

    // Also broadcast on chat-specific channel
    const chatCh = supabase.channel(`chat_${chatId}`);
    chatCh.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        chatCh.send({
          type: 'broadcast',
          event: 'new_message',
          payload: unifiedMessage,
        }).catch(() => {});
      }
    });
  } catch (e) {
    console.warn('[darnaBackend] Realtime broadcast message error:', e);
  }

  // 2. Send to Server Cloud SQL
  try {
    fetch('/api/sync/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unifiedMessage),
    }).catch(() => {});
  } catch (e) {}

  // 3. Insert into Supabase table (if table exists)
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: senderId,
          chat_id: chatId,
          chat_type: chatType,
          content: content || '',
          media_url: mediaUrl,
          media_type: mediaType,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      return { ...unifiedMessage, id: data.id || unifiedMessage.id };
    }
  } catch (err) {
    // Schema note or table not created yet in Supabase
  }

  return unifiedMessage;
}

export function subscribeToChatMessages(chatId, onNewMessage) {
  try {
    const channel = supabase.channel(`chat_${chatId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        if (payload?.payload) {
          onNewMessage(payload.payload);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload?.new) {
            onNewMessage(payload.new);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  } catch (err) {
    console.warn('[darnaBackend] subscribeToChatMessages fallback:', err);
    return { unsubscribe: () => {} };
  }
}

export function subscribeToGlobalMessages(onNewMessage) {
  try {
    const channel = supabase.channel('darna_global_messages_sub', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        if (payload?.payload) {
          onNewMessage(payload.payload);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload?.new) {
            onNewMessage(payload.new);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  } catch (err) {
    console.warn('[darnaBackend] subscribeToGlobalMessages fallback:', err);
    return { unsubscribe: () => {} };
  }
}

// 3. رفع الصور والتسجيلات الصوتية
export async function uploadMediaFile(file, folder = 'media') {
  try {
    const fileExt = file.name ? file.name.split('.').pop() : (file.type?.includes('audio') ? 'webm' : 'jpg');
    const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('darna-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('darna-media')
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      return data.publicUrl;
    }
  } catch (err) {
    console.warn('[darnaBackend] uploadMediaFile to Supabase storage:', err?.message || err);
  }

  // Instant resilient fallback using Data URL
  if (file instanceof Blob || file instanceof File) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }
  return typeof file === 'string' ? file : '';
}

// 4. إشارات المكالمات WebRTC
export async function sendCallSignal({ callerId, receiverId, callType = 'voice', signalType, payload }) {
  const signalId = payload?.callId || `call_${Date.now()}`;
  const status = signalType === 'offer' ? 'incoming_ringing' : (signalType === 'answer' ? 'connected' : 'ended');

  const signalRecord = {
    id: signalId,
    callId: signalId,
    caller_id: callerId,
    callerId,
    receiver_id: receiverId,
    receiverId,
    call_type: callType,
    callType,
    signal_type: signalType,
    signalType,
    payload: payload || {},
    status,
    callerName: payload?.callerName || '',
    callerAvatar: payload?.callerAvatar || '',
    callerPhone: payload?.callerPhone || '',
    sdp: payload?.sdp,
    candidate: payload?.candidate,
    updatedAt: Date.now(),
  };

  // 1. Broadcast over Supabase Realtime channel (Instant WebSocket push to all receivers)
  try {
    callsChannel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: signalRecord,
    }).catch(() => {});
  } catch (err) {
    console.warn('[darnaBackend] callsChannel broadcast warning:', err);
  }

  // 2. Post to App Server call signaling endpoint
  try {
    fetch('/api/call/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: signalId,
        callerId,
        receiverId,
        status,
        callerName: payload?.callerName,
        callerAvatar: payload?.callerAvatar,
        callerPhone: payload?.callerPhone,
        sdp: payload?.sdp,
        candidate: payload?.candidate,
      }),
    }).catch(() => {});
  } catch (e) {}

  // 3. Also try Supabase table insertion if exists
  try {
    await supabase.from('call_signals').insert([
      {
        caller_id: callerId,
        receiver_id: receiverId,
        call_type: callType,
        signal_type: signalType,
        payload,
      },
    ]);
  } catch (err) {
    // Supabase table not created yet
  }

  return signalRecord;
}

export function subscribeToIncomingCalls(currentUserId, onSignalReceived) {
  try {
    // Use the single dedicated callsChannel to avoid duplicate listeners
    const handleBroadcast = (msg) => {
      const signal = msg?.payload;
      if (signal && (signal.receiver_id === currentUserId || signal.receiverId === currentUserId || signal.caller_id === currentUserId || signal.callerId === currentUserId)) {
        onSignalReceived(signal);
      }
    };

    callsChannel.on('broadcast', { event: 'call_signal' }, handleBroadcast);

    return {
      unsubscribe: () => {
        // cleanup listener
      },
    };
  } catch (err) {
    console.warn('[darnaBackend] subscribeToIncomingCalls fallback:', err);
    return { unsubscribe: () => {} };
  }
}

// 5. قصص وحالات العائلة (Supabase Stories)
export async function publishStoryToSupabase({ userId, userName, userAvatar, text, mediaUrl, durationHours = 24 }) {
  const now = Date.now();
  const expiresAt = now + durationHours * 60 * 60 * 1000;
  const storyId = `story_${now}_${Math.random().toString(36).substring(7)}`;

  let finalMediaUrl = mediaUrl || '';
  if (mediaUrl && typeof mediaUrl !== 'string' && mediaUrl instanceof File) {
    finalMediaUrl = await uploadMediaFile(mediaUrl, 'stories');
  }

  const storyRecord = {
    id: storyId,
    userId,
    userName,
    userAvatar,
    text: text || '',
    mediaUrl: finalMediaUrl,
    createdAt: now,
    expiresAt,
  };

  // 1. Broadcast over Supabase Realtime channel
  try {
    globalChannel.send({
      type: 'broadcast',
      event: 'new_story',
      payload: storyRecord,
    }).catch(() => {});
  } catch (e) {}

  // 2. Insert into Supabase table
  try {
    await supabase.from('stories').insert([
      {
        id: storyId,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        text: text || '',
        media_url: finalMediaUrl,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      },
    ]);
  } catch (err) {
    console.warn('[darnaBackend] Supabase stories insert notice:', err);
  }

  return storyRecord;
}

export async function fetchStoriesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    if (!error && Array.isArray(data)) {
      return data.map((s) => ({
        id: s.id,
        userId: s.user_id || s.userId,
        userName: s.user_name || s.userName,
        userAvatar: s.user_avatar || s.userAvatar,
        text: s.text,
        mediaUrl: s.media_url || s.mediaUrl,
        createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
        expiresAt: s.expires_at ? new Date(s.expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000,
      }));
    }
  } catch (err) {
    console.warn('[darnaBackend] fetchStoriesFromSupabase notice:', err);
  }
  return [];
}

export async function deleteStoryFromSupabase(storyId) {
  try {
    globalChannel.send({
      type: 'broadcast',
      event: 'delete_story',
      payload: { id: storyId },
    }).catch(() => {});

    await supabase.from('stories').delete().eq('id', storyId);
  } catch (e) {}
}

export function subscribeToSupabaseStories(onStoryAdded, onStoryDeleted) {
  try {
    const channel = supabase.channel('darna_stories_channel', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'new_story' }, (payload) => {
        if (payload?.payload) onStoryAdded(payload.payload);
      })
      .on('broadcast', { event: 'delete_story' }, (payload) => {
        if (payload?.payload?.id) onStoryDeleted(payload.payload.id);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stories' },
        (payload) => {
          if (payload?.new) {
            const raw = payload.new;
            onStoryAdded({
              id: raw.id,
              userId: raw.user_id,
              userName: raw.user_name,
              userAvatar: raw.user_avatar,
              text: raw.text,
              mediaUrl: raw.media_url,
              createdAt: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
              expiresAt: raw.expires_at ? new Date(raw.expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'stories' },
        (payload) => {
          if (payload?.old?.id) onStoryDeleted(payload.old.id);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  } catch (err) {
    return { unsubscribe: () => {} };
  }
}

