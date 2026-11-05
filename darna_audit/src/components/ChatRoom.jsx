import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { uploadMediaFile, subscribeToChatMessages } from '../services/darnaBackend.js';
import { useFamily } from '../context/FamilyContext';
import {
  ArrowRight,
  Phone,
  Send,
  CheckCheck,
  Mic,
  Trash2,
  Play,
  Pause,
  Info,
} from 'lucide-react';
import { GroupProfileModal } from './GroupProfileModal';

// Audio Player for voice notes
const AudioMessagePlayer = ({ audioUrl, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2.5 p-1 min-w-[190px] max-w-[260px]">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition shadow-xs ${
          isMe
            ? 'bg-white text-teal-800 hover:bg-teal-50'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current mr-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        {/* Sound Wave Bars */}
        <div className="flex items-center gap-0.5 h-6 px-1">
          {[35, 75, 50, 90, 60, 30, 85, 45, 100, 70, 35, 80, 55, 65, 40].map((h, i) => {
            const progress = duration > 0 ? (currentTime / duration) * 15 : 0;
            const isPlayed = i <= progress;
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-1 rounded-full transition-all ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-teal-600'
                    : isMe
                    ? 'bg-white/40'
                    : 'bg-slate-300'
                } ${isPlaying ? 'animate-pulse' : ''}`}
              />
            );
          })}
        </div>

        <div
          className={`flex justify-between items-center text-[9px] mt-0.5 ${
            isMe ? 'text-teal-100' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export const ChatRoom = ({ chatId }) => {
  const {
    currentUser,
    chats,
    users,
    messages: initialContextMessages,
    sendMessage,
    setActiveChatId,
    startVoiceCall,
    sendTypingSignal,
    getTypingUsersInChat,
  } = useFamily();

  const [messages, setMessages] = useState(() => {
    return initialContextMessages.filter((m) => m.chatId === chatId);
  });
  const [inputText, setInputText] = useState('');
  const [isGroupProfileOpen, setIsGroupProfileOpen] = useState(false);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chat = chats.find((c) => c.id === chatId);
  const partnerId = chat?.type === 'DIRECT' ? chat.participants.find((p) => p !== currentUser?.id) : null;
  const partnerUser = partnerId ? users.find((u) => u.id === partnerId) : null;
  const typingUsers = getTypingUsersInChat(chatId);

  // داخل مكون الدردشة (ChatRoom.jsx)
  useEffect(() => {
    // الاستماع للرسائل الجديدة لحظياً
    const channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync when initialContextMessages changes
  useEffect(() => {
    const chatMsgs = initialContextMessages.filter((m) => m.chatId === chatId);
    setMessages(chatMsgs);
  }, [chatId, initialContextMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim().length > 0) {
      sendTypingSignal(chatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingSignal(chatId, false);
      }, 2500);
    } else {
      sendTypingSignal(chatId, false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');
    sendTypingSignal(chatId, false);

    // إرسال للكونتكست المحلي
    sendMessage(chatId, content);

    // إرسال إلى Supabase لحظياً
    try {
      await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: currentUser?.id,
          content: content,
          media_type: 'text',
        },
      ]);
    } catch (err) {
      console.warn('Realtime supabase send message note:', err);
    }
  };

  // Voice Note Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الصوت.');
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioDataUrl = reader.result;
          sendMessage(chatId, undefined, audioDataUrl, false, 'audio');

          try {
            await supabase.from('messages').insert([
              {
                chat_id: chatId,
                sender_id: currentUser?.id,
                content: 'رسالة صوتية 🎤',
                media_url: audioDataUrl,
                media_type: 'audio',
              },
            ]);
          } catch (e) {
            console.warn('Supabase voice note sync note:', e);
          }
        };
        reader.readAsDataURL(audioBlob);

        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current.stop();
    } else {
      cancelRecording();
    }
  };

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const chatTitle = chat?.type === 'DIRECT'
    ? partnerUser?.name || 'محادثة خاصة'
    : chat?.title || 'مجموعة عائلية';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2]/35 relative overflow-hidden">
      {/* Header */}
      <div className="bg-white/95 border-b border-slate-200/90 px-3 py-2 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => setActiveChatId(null)}
            className="p-1 text-slate-500 hover:text-slate-800"
            title="رجوع للقائمة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (chat?.type === 'GROUP') {
                setIsGroupProfileOpen(true);
              }
            }}
            className={`flex items-center space-x-2 space-x-reverse ${
              chat?.type === 'GROUP' ? 'cursor-pointer hover:opacity-85 transition select-none group' : ''
            }`}
            title={chat?.type === 'GROUP' ? 'عرض تفاصيل المجموعة' : undefined}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-bold overflow-hidden border border-teal-200">
                {chat?.type === 'DIRECT' ? (
                  <img
                    src={partnerUser?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=U'}
                    alt={chatTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base">👥</span>
                )}
              </div>
              {partnerUser && (
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    partnerUser.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-800 leading-tight group-hover:text-teal-700 transition">
                  {chatTitle}
                </h3>
                {chat?.type === 'GROUP' && (
                  <span className="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 rounded px-1.5 font-bold">
                    معلومات المجموعة
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-500">
                {typingUsers.length > 0 ? (
                  <span className="text-teal-600 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping inline-block" />
                    <span>{typingUsers.join(', ')}: جاري الكتابة...</span>
                  </span>
                ) : inputText.trim().length > 0 ? (
                  <span className="text-teal-600 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping inline-block" />
                    <span>جاري الكتابة...</span>
                  </span>
                ) : chat?.type === 'DIRECT' ? (
                  partnerUser?.isOnline ? (
                    <span className="text-emerald-600 font-medium">متصل الآن 🟢</span>
                  ) : (
                    <span>غير متصل ⚪</span>
                  )
                ) : (
                  <span>{chat?.participants?.length || 0} أفراد في المجموعة (انقر للملف)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 space-x-reverse">
          {chat?.type === 'DIRECT' && partnerUser && (
            <button
              onClick={() => startVoiceCall(partnerUser)}
              className="w-8 h-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center transition border border-teal-200"
              title="اتصال صوتي"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {chat?.type === 'GROUP' && (
            <button
              onClick={() => setIsGroupProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center transition border border-teal-200"
              title="ملف المجموعة وإدارتها"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-slate-200/80 flex items-center justify-center text-2xl mb-2">
              💬
            </div>
            <p className="font-semibold text-slate-600">لا توجد رسائل سابقة في هذه المحادثة</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              ابدأ الحديث الآن، وسيتم مزامنة الرسائل لحظياً عبر Supabase Realtime!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const senderId = msg.sender_id || msg.senderId;
            const isMe = senderId === currentUser?.id;
            const textContent = msg.content || msg.text || '';
            const msgTime =
              msg.timestamp ||
              (msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '');
            const isAudio =
              msg.media_type === 'audio' ||
              msg.mediaType === 'audio' ||
              msg.media_url?.startsWith('data:audio') ||
              msg.mediaUrl?.startsWith('data:audio');

            return (
              <div
                key={msg.id || idx}
                className={`flex ${isMe ? 'justify-start flex-row-reverse' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-2.5 text-xs shadow-xs relative ${
                    isMe
                      ? 'bg-teal-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  {isAudio ? (
                    <div className="my-1">
                      <AudioMessagePlayer
                        audioUrl={msg.media_url || msg.mediaUrl}
                        isMe={isMe}
                      />
                    </div>
                  ) : msg.media_url || msg.mediaUrl ? (
                    <img
                      src={msg.media_url || msg.mediaUrl}
                      alt="مرفق"
                      className="rounded-lg max-h-48 w-full object-cover mb-1.5"
                    />
                  ) : null}

                  {textContent && !isAudio && (
                    <p className="leading-relaxed whitespace-pre-wrap">{textContent}</p>
                  )}

                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                      isMe ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msgTime}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-teal-200" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Realtime Typing Indicator Bubble */}
        {(typingUsers.length > 0 || inputText.trim().length > 0) && (
          <div className="flex justify-start items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="bg-white text-teal-800 border border-teal-200/90 rounded-2xl rounded-bl-xs px-3 py-1.5 text-xs shadow-xs flex items-center space-x-2 space-x-reverse">
              <span className="flex space-x-1 space-x-reverse items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce" />
              </span>
              <span className="text-[11px] font-bold text-teal-700">
                {typingUsers.length > 0 ? `${typingUsers.join(', ')}: جاري الكتابة...` : 'جاري الكتابة...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Live Typing Status Bar */}
      {inputText.trim().length > 0 && (
        <div className="bg-teal-50 border-t border-teal-200/60 px-3.5 py-1 flex items-center justify-between text-[11px] text-teal-800 shrink-0 z-10 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping inline-block" />
            <span>✍️ جاري الكتابة...</span>
          </div>
          <span className="text-[10px] text-teal-600/80 font-medium">يتم إرسال إشعار لحظي للمحادثة</span>
        </div>
      )}

      {/* Input Form with Voice Note Controls */}
      <div className="bg-white/95 border-t border-slate-200/90 p-2 shrink-0 z-10">
        {isRecording ? (
          <div className="flex items-center justify-between gap-2 px-1 py-1 animate-in fade-in duration-150">
            <button
              type="button"
              onClick={cancelRecording}
              className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition border border-red-200 shrink-0 shadow-2xs"
              title="إلغاء التسجيل"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-3 bg-red-50/70 border border-red-200/80 rounded-full px-4 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              <span className="text-xs font-mono font-bold text-red-700">
                {formatTimer(recordingDuration)}
              </span>

              <div className="flex items-center gap-1 h-4">
                {[60, 100, 40, 80, 50, 90, 70, 40, 100, 60].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={stopAndSendRecording}
              className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-md shrink-0"
              title="إرسال التسجيل الصوتي"
            >
              <Send className="w-4 h-4 rtl:-scale-x-100" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center space-x-2 space-x-reverse">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="اكتب رسالة لحظية..."
              className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 text-slate-800 placeholder-slate-400"
            />

            {/* Voice Note Button */}
            <button
              type="button"
              onClick={startRecording}
              className="w-9 h-9 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 transition border border-teal-200 shadow-2xs"
              title="تسجيل رسالة صوتية (انقر لبدء التسجيل)"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="إرسال"
            >
              <Send className="w-4 h-4 rtl:-scale-x-100" />
            </button>
          </form>
        )}
      </div>

      {/* Group Profile Modal */}
      {chat?.type === 'GROUP' && chat?.groupId && (
        <GroupProfileModal
          isOpen={isGroupProfileOpen}
          onClose={() => setIsGroupProfileOpen(false)}
          groupId={chat.groupId}
          chatId={chat.id}
        />
      )}
    </div>
  );
};

export default ChatRoom;
