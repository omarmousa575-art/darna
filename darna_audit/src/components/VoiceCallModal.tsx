import React, { useEffect, useRef } from 'react';
import { useFamily } from '../context/FamilyContext';
import { webrtcService } from '../services/webrtcCallService';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ShieldCheck, Video, VideoOff } from 'lucide-react';

export const VoiceCallModal: React.FC = () => {
  const {
    activeCall,
    callManagerState,
    answerVoiceCall,
    declineVoiceCall,
    endVoiceCall,
    toggleCallMute,
    toggleCallSpeaker,
    toggleCallCamera,
  } = useFamily();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bind WebRTC Local and Remote Streams to video elements when active
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') return;

    const syncStreams = () => {
      const localStream = webrtcService.getLocalStream();
      if (localVideoRef.current && localStream) {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
        }
      }

      const remoteStream = webrtcService.getRemoteStream();
      if (remoteVideoRef.current && remoteStream) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      }
    };

    syncStreams();
    webrtcService.setOnLocalStream(syncStreams);
    webrtcService.setOnRemoteStream(syncStreams);

    const interval = setInterval(syncStreams, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status, activeCall?.isVideoOn]);

  if (!activeCall || callManagerState === 'idle') return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // View for Incoming Call Ringing Screen
  if (activeCall.isIncoming && (activeCall.status === 'incoming_ringing' || callManagerState === 'ringing')) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 z-[100] flex flex-col justify-between p-6 text-white animate-in zoom-in-95 duration-200" dir="rtl">
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>مكالمة عائلية مشفرة محميّة</span>
          </div>
          <p className="text-xs text-teal-200/80 mt-2 font-mono">مكالمة واردة... 📲</p>
        </div>

        <div className="flex flex-col items-center justify-center my-auto">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full border-2 border-emerald-400/60 animate-ping pointer-events-none" />
            <img
              src={activeCall.targetUser.avatar}
              alt={activeCall.targetUser.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-teal-400/60 shadow-2xl relative z-10"
            />
          </div>
          <h2 className="text-xl font-bold mt-5 text-white">{activeCall.targetUser.name}</h2>
          <p className="text-xs text-teal-300 mt-1">يتصل بك الآن...</p>
        </div>

        <div className="flex items-center justify-center gap-10 pb-8">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={declineVoiceCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl transition"
              title="رفض"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-slate-300 font-semibold">رفض</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={answerVoiceCall}
              className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/80 animate-bounce transition"
              title="رد"
            >
              <Phone className="w-8 h-8" />
            </button>
            <span className="text-xs text-emerald-300 font-bold">قبول المكالمة</span>
          </div>
        </div>
      </div>
    );
  }

  const getStatusText = () => {
    switch (activeCall.status) {
      case 'outgoing_ringing':
        return 'جارِ الاتصال بالطرف الآخر... 🔔';
      case 'connected':
        return `مكالمة نشطة (${formatDuration(activeCall.durationSeconds)})`;
      case 'ended':
        return 'تم إنهاء المكالمة';
      default:
        return 'جارِ الاتصال...';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 z-[100] flex flex-col justify-between p-6 text-white animate-in zoom-in-95 duration-200 overflow-hidden" dir="rtl">
      {/* Top Header & Privacy Status */}
      <div className="text-center pt-4 z-20">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>اتصال مشفّر عبر WebRTC & Supabase</span>
        </div>
        <p className="text-xs text-teal-200/80 mt-2 font-mono">{getStatusText()}</p>

        {/* Dynamic Privacy Indicators */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {activeCall.isMuted && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-medium flex items-center gap-1">
              <MicOff className="w-3 h-3" /> الميكروفون مكتوم
            </span>
          )}
          {activeCall.isVideoOn && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <Video className="w-3 h-3" /> الكاميرا مفعّلة
            </span>
          )}
        </div>
      </div>

      {/* Center Avatar & Optional Video Stream Viewport */}
      <div className="flex flex-col items-center justify-center my-auto relative z-10 w-full max-w-md mx-auto">
        {/* Local Video Stream Preview Box (Picture-in-Picture) */}
        {activeCall.isVideoOn && (
          <div className="w-full h-64 rounded-2xl overflow-hidden border-2 border-teal-500/50 shadow-2xl relative bg-slate-900 mb-4 animate-in fade-in duration-300">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] text-teal-300 border border-teal-500/30">
              الكاميرا المحلية
            </div>
          </div>
        )}

        {/* Remote Hidden Video Container for WebRTC Stream Sync */}
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />

        {/* Avatar Display when Video is Off */}
        {!activeCall.isVideoOn && (
          <div className="relative">
            {/* Animated sound pulse circles when connected */}
            {activeCall.status === 'connected' && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping pointer-events-none" />
                <div className="absolute -inset-4 rounded-full border border-teal-400/30 animate-pulse pointer-events-none" />
              </>
            )}

            {activeCall.status === 'outgoing_ringing' && (
              <div className="absolute -inset-3 rounded-full border-2 border-teal-400/60 animate-ping pointer-events-none" />
            )}

            <img
              src={activeCall.targetUser.avatar}
              alt={activeCall.targetUser.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-teal-400/60 shadow-2xl relative z-10"
            />
          </div>
        )}

        <h2 className="text-xl font-bold mt-5 text-white">{activeCall.targetUser.name}</h2>
        <p className="text-xs text-teal-300 mt-1">{activeCall.targetUser.relationship || 'عضو بالعائلة'}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono" dir="ltr">{activeCall.targetUser.phone}</p>

        {/* WebRTC Audio Wave Animation */}
        {activeCall.status === 'connected' && !activeCall.isVideoOn && (
          <div className="flex items-center gap-1 mt-6 h-8">
            {[40, 70, 95, 60, 85, 45, 90, 75, 50, 80].map((height, i) => (
              <span
                key={i}
                style={{ height: `${height}%`, animationDelay: `${i * 120}ms` }}
                className={`w-1 rounded-full animate-soft-pulse transition-all ${
                  activeCall.isMuted ? 'bg-slate-600' : 'bg-gradient-to-t from-teal-500 to-emerald-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Control Buttons Bar */}
      <div className="space-y-6 pb-6 z-20">
        <div className="flex items-center justify-center gap-5">
          {/* Mute Microphone button */}
          <button
            onClick={toggleCallMute}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition ${
              activeCall.isMuted
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/60 ring-2 ring-rose-400'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={activeCall.isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          >
            {activeCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera Toggle button */}
          <button
            onClick={() => toggleCallCamera()}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition ${
              activeCall.isVideoOn
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/60 ring-2 ring-emerald-400'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={activeCall.isVideoOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
          >
            {activeCall.isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          {/* Speaker button */}
          <button
            onClick={toggleCallSpeaker}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition ${
              activeCall.isSpeakerOn
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={activeCall.isSpeakerOn ? 'إيقاف مكبر الصوت' : 'تشغيل مكبر الصوت'}
          >
            {activeCall.isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>

        {/* End Call red button */}
        <div className="flex justify-center">
          <button
            onClick={endVoiceCall}
            className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-950/70 hover:scale-105 active:scale-95 transition"
            title="إنهاء المكالمة"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};
