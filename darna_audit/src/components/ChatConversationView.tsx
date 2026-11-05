import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Chat, Message, User } from '../types';
import { supabase } from '../supabaseClient';
import { uploadMediaFile, subscribeToChatMessages } from '../services/darnaBackend.js';
import {
  ArrowRight,
  Phone,
  Send,
  Image as ImageIcon,
  Eye,
  CheckCheck,
  ShieldCheck,
  X,
  Lock,
  Mic,
  Trash2,
  Play,
  Pause,
  Info,
  Check,
  Sparkles,
  Clock,
} from 'lucide-react';
import { GroupProfileModal } from './GroupProfileModal';
import { ImageViewer } from './ImageViewer';

// Audio Player for voice notes
const AudioMessagePlayer: React.FC<{ audioUrl: string; isMe: boolean }> = ({ audioUrl, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const formatTime = (sec: number) => {
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

interface ChatConversationViewProps {
  chatId: string;
}

export const ChatConversationView: React.FC<ChatConversationViewProps> = ({ chatId }) => {
  const {
    currentUser,
    chats,
    users,
    messages,
    setMessages,
    sendMessage,
    setActiveChatId,
    startVoiceCall,
    openViewOnce,
    sendTypingSignal,
    getTypingUsersInChat,
    markChatMessagesAsRead,
  } = useFamily();

  const [inputText, setInputText] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isViewOnce, setIsViewOnce] = useState<boolean>(false);
  const [showImageDrawer, setShowImageDrawer] = useState<boolean>(false);
  const [isGroupProfileOpen, setIsGroupProfileOpen] = useState<boolean>(false);
  const [activeViewerImage, setActiveViewerImage] = useState<string | null>(null);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const chat = chats.find((c) => c.id === chatId);
  const chatMessages = messages.filter((m) => m.chatId === chatId);
  const typingUsers = getTypingUsersInChat(chatId);

  const chatParticipants = Array.isArray(chat?.participants)
    ? chat.participants
    : (Array.isArray((chat as any)?.members) ? (chat as any).members : []);

  // Determine partner user for direct chats
  const partnerId = chat?.type === 'DIRECT' ? chatParticipants.find((p: string) => p !== currentUser?.id) : null;
  const partnerUser = partnerId ? users.find((u) => u.id === partnerId) : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, typingUsers.length]);

  useEffect(() => {
    markChatMessagesAsRead(chatId);
  }, [chatId, markChatMessagesAsRead, chatMessages.length]);

  // Gemini AI Quick Reply suggestions state & logic
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isFetchingQuickReplies, setIsFetchingQuickReplies] = useState<boolean>(false);

  const fetchQuickReplies = useCallback(async () => {
    if (chatMessages.length === 0) return;
    setIsFetchingQuickReplies(true);
    try {
      const recent = chatMessages.slice(-5).map((m) => `${m.senderName}: ${m.text || (m.mediaUrl ? '[مرفق]' : '')}`);
      const res = await fetch('/api/gemini/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastMessages: recent,
          chatTitle: chat?.title || partnerUser?.name || 'محادثة عائلية',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setQuickReplies(data.suggestions);
        }
      }
    } catch (e) {
      console.warn('Quick replies fetch notice:', e);
    } finally {
      setIsFetchingQuickReplies(false);
    }
  }, [chatMessages, chat?.title, partnerUser?.name]);

  // Auto-fetch quick replies when new message arrives from other participant
  const lastMsg = chatMessages[chatMessages.length - 1];
  useEffect(() => {
    if (lastMsg && lastMsg.senderId !== currentUser?.id) {
      fetchQuickReplies();
    }
  }, [lastMsg?.id, currentUser?.id]);

  // Inside Chat - Listen to new messages in real-time via Supabase
  useEffect(() => {
    const sub = subscribeToChatMessages(chatId, (raw: any) => {
      if (raw) {
        setMessages((prev) => {
          const targetId = raw.id || raw.messageId;
          if (prev.some((m) => m.id === targetId)) return prev;
          const newMsg: Message = {
            id: targetId || `msg-supa-${Date.now()}`,
            chatId: raw.chat_id || raw.chatId || chatId,
            senderId: raw.sender_id || raw.senderId || '',
            senderName: raw.sender_name || raw.senderName || 'عضو في العائلة',
            senderAvatar: raw.sender_avatar || raw.senderAvatar,
            text: raw.content || raw.text || '',
            mediaUrl: raw.media_url || raw.mediaUrl,
            mediaType: raw.media_type || raw.mediaType || (raw.media_url?.startsWith('data:audio') ? 'audio' : 'text'),
            isViewOnce: raw.media_type === 'view_once_image' || raw.is_view_once || raw.isViewOnce,
            viewed: raw.is_viewed || raw.viewed || false,
            timestamp:
              raw.timestamp ||
              raw.time ||
              (raw.created_at
                ? new Date(raw.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                : 'الآن'),
          };
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      if (sub && typeof (sub as any).unsubscribe === 'function') {
        (sub as any).unsubscribe();
      }
    };
  }, [chatId, setMessages]);

  if (!chat || !currentUser) {
    return null;
  }

  // Handle typing input changes with automatic debounced typing signal
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim().length > 0) {
      sendTypingSignal(chatId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingSignal(chatId, false);
      }, 2500);
    } else {
      sendTypingSignal(chatId, false);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingSignal(chatId, false);

    sendMessage(chatId, inputText.trim() || undefined, selectedImage || undefined, isViewOnce);

    setInputText('');
    setSelectedImage(null);
    setIsViewOnce(false);
    setShowImageDrawer(false);
  };

  // Voice Note Recording Handlers
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
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        try {
          const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          const uploadedUrl = await uploadMediaFile(audioFile, 'voices');
          sendMessage(chatId, undefined, uploadedUrl, false, 'audio');
        } catch (error) {
          console.error('Voice note upload failed:', error);
          alert('فشل رفع الرسالة الصوتية ولم تُرسل. يرجى المحاولة مجددًا.');
        }

        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current.stop();
    } else {
      cancelRecording();
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const uploadedUrl = await uploadMediaFile(file, 'images');
        setSelectedImage(uploadedUrl);
        setShowImageDrawer(true);
      } catch (error) {
        console.error('Image upload failed:', error);
        alert('تعذر رفع الصورة. تحقق من الاتصال وأذونات التخزين ثم أعد المحاولة. لم تُرسل الصورة.');
      } finally {
        // Selecting the same file again should trigger the change event.
        e.target.value = '';
      }
    }
  };

  const chatTitle = chat.type === 'DIRECT'
    ? partnerUser?.name || 'محادثة خاصة'
    : chat.title || 'مجموعة عائلية';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2]/35 dark:bg-slate-950/90 relative min-h-0 overflow-hidden">
      {/* Fixed Chat Header */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 py-2 flex items-center justify-between shadow-xs shrink-0 z-20 relative">
        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => setActiveChatId(null)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
            title="رجوع للقائمة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (chat.type === 'GROUP') {
                setIsGroupProfileOpen(true);
              }
            }}
            className={`flex items-center space-x-2 space-x-reverse ${
              chat.type === 'GROUP'
                ? 'cursor-pointer hover:opacity-85 transition select-none group'
                : ''
            }`}
            title={chat.type === 'GROUP' ? 'عرض ملف وتفاصيل المجموعة' : undefined}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-800 dark:text-teal-200 font-bold overflow-hidden border border-teal-200 dark:border-teal-700">
                {chat.type === 'DIRECT' ? (
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
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                    partnerUser.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  {chatTitle}
                </h3>
                {chat.type === 'GROUP' && (
                  <span className="text-[9px] bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded px-1.5 font-bold">
                    معلومات المجموعة
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {typingUsers.length > 0 ? (
                  <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping inline-block" />
                    <span>{typingUsers.join(', ')}: جاري الكتابة...</span>
                  </span>
                ) : inputText.trim().length > 0 ? (
                  <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping inline-block" />
                    <span>جاري الكتابة...</span>
                  </span>
                ) : chat.type === 'DIRECT' ? (
                  partnerUser?.isOnline ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">متصل الآن 🟢</span>
                  ) : (
                    <span>غير متصل ⚪</span>
                  )
                ) : (
                  <span>{chatParticipants.length} أفراد في المجموعة (انقر للملف)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-1.5 space-x-reverse">
          {chat.type === 'DIRECT' && partnerUser && (
            <button
              onClick={() => startVoiceCall(partnerUser)}
              className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center transition border border-teal-200 dark:border-teal-800"
              title="اتصال صوتي"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {chat.type === 'GROUP' && (
            <button
              onClick={() => setIsGroupProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center transition border border-teal-200 dark:border-teal-800"
              title="ملف المجموعة وإدارتها"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2.5">
        {chatMessages.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-slate-200/80 flex items-center justify-center text-2xl mb-2">
              💬
            </div>
            <p className="font-semibold text-slate-600">لا توجد رسائل سابقة في هذه المحادثة</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              ابدأ الحديث الآن، وستظهر مؤشرات الكتابة "يكتب الآن..." مباشرة عند كتابة أي طرف!
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`flex w-full my-1.5 ${isMe ? 'justify-start flex-row-reverse' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] sm:max-w-[75%] px-3.5 py-2.5 text-xs sm:text-sm relative transition-all shadow-xs ${
                    isMe
                      ? 'bg-gradient-to-l from-teal-700 to-teal-600 text-white rounded-2xl rounded-bl-none shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl rounded-br-none shadow-2xs'
                  }`}
                >
                  {/* Outward pointing SVG Tail for RTL */}
                  {isMe ? (
                    <svg
                      className="absolute -left-2 bottom-0 w-2.5 h-3 text-teal-600 fill-current pointer-events-none"
                      viewBox="0 0 10 12"
                    >
                      <path d="M10 0 C6 4 2 8 0 12 L10 12 Z" />
                    </svg>
                  ) : (
                    <svg
                      className="absolute -right-2 bottom-0 w-2.5 h-3 text-white dark:text-slate-800 fill-current pointer-events-none"
                      viewBox="0 0 10 12"
                    >
                      <path d="M0 0 C4 4 8 8 10 12 L0 12 Z" />
                    </svg>
                  )}

                  {/* Sender name in group chats */}
                  {chat.type === 'GROUP' && !isMe && (
                    <div className="text-[11px] text-teal-700 dark:text-teal-400 font-bold mb-1">
                      {msg.senderName}
                    </div>
                  )}

                  {/* View Once Image */}
                  {msg.isViewOnce ? (
                    <div className="my-1">
                      {msg.viewedBy?.includes(currentUser.id) && !isMe ? (
                        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] flex items-center gap-1.5">
                          <span className="font-bold text-xs">①</span>
                          <span>تم فتح الصورة ذات العرض لمرة واحدة</span>
                        </div>
                      ) : isMe ? (
                        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-teal-200/40 text-xs" role="status">
                          ① صورة للمشاهدة لمرة واحدة — تنتظر فتح المستلم
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openViewOnce(msg)}
                          className="w-full p-2.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 font-bold flex items-center justify-between text-xs transition active:scale-98"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                              ①
                            </span>
                            <span>صورة (عرض لمرة واحدة)</span>
                          </div>
                          <Eye className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        </button>
                      )}
                    </div>
                  ) : msg.mediaType === 'audio' || (msg.mediaUrl && (msg.mediaUrl.startsWith('data:audio') || msg.mediaUrl.includes('audio') || (msg as any).media_type === 'audio')) ? (
                    <div className="my-1">
                      <AudioMessagePlayer audioUrl={(msg.mediaUrl || (msg as any).media_url)!} isMe={isMe} />
                    </div>
                  ) : msg.mediaUrl || (msg as any).media_url ? (
                    <button
                      type="button"
                      onClick={() => setActiveViewerImage(msg.mediaUrl || (msg as any).media_url)}
                      className="block w-full my-1 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-700/60 transition hover:opacity-90 active:scale-98 cursor-pointer focus:outline-hidden group"
                      title="انقر لفتح الصورة بحجم كامل 🔍"
                    >
                      <img
                        src={msg.mediaUrl || (msg as any).media_url}
                        alt="مرفق صورة"
                        className="rounded-xl max-h-52 w-full object-cover transition group-hover:scale-102"
                      />
                    </button>
                  ) : null}

                  {msg.text && (
                    <p className="leading-relaxed whitespace-pre-wrap select-text dir-rtl text-right">{msg.text}</p>
                  )}

                  {/* Timestamp and Delivery Status Indicator with Fixed Spacing */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1.5 text-[10px] select-none ${
                      isMe ? 'text-teal-200/90' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="font-mono text-[9.5px] tracking-tight" dir="ltr">{msg.timestamp}</span>
                    {isMe && (
                      msg.status === 'sending' ? (
                        <span title="جاري الإرسال..."><Clock className="w-3 h-3 text-teal-200/70 animate-spin" /></span>
                      ) : msg.status === 'read' || msg.viewed ? (
                        <span title="تمت القراءة"><CheckCheck className="w-3.5 h-3.5 text-cyan-300" /></span>
                      ) : (
                        <span title="تم التسليم"><CheckCheck className="w-3.5 h-3.5 text-teal-200/80" /></span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Real-Time 'جاري الكتابة...' Indicator Bubble */}
        {(typingUsers.length > 0 || inputText.trim().length > 0) && (
          <div className="flex justify-start items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="bg-white/95 backdrop-blur-xs border border-teal-200/90 text-slate-700 px-3 py-1.5 rounded-2xl text-xs flex items-center gap-2 shadow-xs">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-teal-100 shrink-0 border border-teal-300">
                <img
                  src={
                    inputText.trim().length > 0
                      ? currentUser.avatar
                      : partnerUser?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=U'
                  }
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-semibold text-[11px] text-teal-800">
                {inputText.trim().length > 0
                  ? `${currentUser.name} (أنت): جاري الكتابة...`
                  : `${typingUsers.join(', ')}: جاري الكتابة...`}
              </span>
              <div className="flex items-center gap-1 mr-0.5">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Image Preview Bar */}
      {showImageDrawer && selectedImage && (
        <div className="bg-slate-900 text-white p-2.5 border-t border-slate-700 flex items-center justify-between z-20">
          <div className="flex items-center space-x-2 space-x-reverse">
            <img
              src={selectedImage}
              alt="معاينة"
              className="w-12 h-12 object-cover rounded-lg border border-slate-600"
            />
            <div>
              <span className="text-xs font-semibold text-white block">صورة جاهزة للإرسال</span>
              <button
                type="button"
                onClick={() => setIsViewOnce(!isViewOnce)}
                className={`mt-1 text-[10px] px-2.5 py-0.5 rounded-full border flex items-center gap-1 transition ${
                  isViewOnce
                    ? 'bg-teal-500 border-teal-300 text-white font-bold'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                <span className="font-bold">①</span>
                <span>عرض لمرة واحدة: {isViewOnce ? 'مفعّل ✅' : 'معطل'}</span>
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedImage(null);
              setShowImageDrawer(false);
            }}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Real-Time Typing Status Bar */}
      {inputText.trim().length > 0 && (
        <div className="bg-teal-50 border-t border-teal-200/60 px-3.5 py-1 flex items-center justify-between text-[11px] text-teal-800 shrink-0 z-10 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping inline-block" />
            <span>جاري الكتابة...</span>
          </div>
          <span className="text-[10px] text-teal-600/80">
            تظهر حالة "جاري الكتابة..." فوراً للأطراف في المحادثة
          </span>
        </div>
      )}

      {/* Gemini AI Quick Reply Suggestions Bar */}
      {chatMessages.length > 0 && !isRecording && (
        <div className="bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 px-3 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar select-none">
          <button
            type="button"
            onClick={fetchQuickReplies}
            disabled={isFetchingQuickReplies}
            className="flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800 shrink-0 hover:bg-teal-100 transition shadow-2xs disabled:opacity-50"
            title="تحديث اقتراحات الردود الذكية عبر Gemini AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isFetchingQuickReplies ? 'animate-spin' : ''}`} />
            <span>{isFetchingQuickReplies ? 'جاري التحليل...' : 'ردود ذكية ✨'}</span>
          </button>

          {quickReplies.length > 0 ? (
            quickReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sendMessage(chatId, reply, undefined, false);
                }}
                className="text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs transition active:scale-95 whitespace-nowrap"
                title="انقر لإرسال هذا الرد فوراً"
              >
                {reply}
              </button>
            ))
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              انقر "ردود ذكية ✨" للحصول على اقتراحات إرسال سريعة من Gemini
            </span>
          )}
        </div>
      )}

      {/* Voice Note Recording Bar OR Standard Fixed Input Form */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 p-2 sm:p-2.5 shrink-0 z-20 sticky bottom-0">
        {isRecording ? (
          <div className="flex items-center justify-between gap-2 px-1 py-1 animate-in fade-in duration-150">
            {/* Cancel Button (سلة مهملات) */}
            <button
              type="button"
              onClick={cancelRecording}
              className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 flex items-center justify-center transition border border-red-200 dark:border-red-800 shrink-0 shadow-2xs active:scale-95"
              title="إلغاء التسجيل"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>

            {/* Recording Indicator & Waveform & Timer */}
            <div className="flex-1 flex items-center justify-center gap-3 bg-red-50/80 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/60 rounded-full px-4 py-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              <span className="text-xs font-mono font-bold text-red-700 dark:text-red-300">
                {formatTimer(recordingDuration)}
              </span>

              {/* Animated Audio Waveform */}
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

            {/* Green Send Recording Button */}
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-md shrink-0 active:scale-95"
              title="إرسال التسجيل الصوتي"
            >
              <Send className="w-4.5 h-4.5 rtl:-scale-x-100" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition active:scale-95 border border-slate-200/80 dark:border-slate-700"
              title="إرفاق صورة"
            >
              <ImageIcon className="w-4.5 h-4.5 text-teal-700 dark:text-teal-400" />
            </button>

            <input
              type="text"
              placeholder="اكتب رسالة..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm rounded-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            {/* Voice Note Button (ميكروفون) */}
            <button
              type="button"
              onClick={startRecording}
              className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 transition border border-teal-200 dark:border-teal-800 shadow-2xs active:scale-95"
              title="تسجيل رسالة صوتية (انقر لبدء التسجيل)"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>

            {/* Send Text Button */}
            <button
              type="submit"
              disabled={!inputText.trim() && !selectedImage}
              className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95"
              title="إرسال"
            >
              <Send className="w-4.5 h-4.5 rtl:-scale-x-100" />
            </button>
          </form>
        )}
      </div>

      {/* Full-Screen Interactive Media Image Viewer Modal */}
      <ImageViewer
        imageUrl={activeViewerImage}
        altText="صورة من محادثة دارنا العائلية"
        onClose={() => setActiveViewerImage(null)}
      />

      {/* Group Profile Modal */}
      {chat.type === 'GROUP' && (
        <GroupProfileModal
          isOpen={isGroupProfileOpen}
          onClose={() => setIsGroupProfileOpen(false)}
          groupId={chat.groupId || (chat.id.startsWith('chat-') ? chat.id.replace('chat-', '') : chat.id)}
          chatId={chat.id}
        />
      )}
    </div>
  );
};
