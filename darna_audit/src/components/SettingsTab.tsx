import React, { useState, useRef } from 'react';
import { useFamily } from '../context/FamilyContext';
import { uploadMediaFile } from '../services/darnaBackend.js';
import {
  LogOut,
  Camera,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Palette,
  Upload,
  Hash,
  Info,
  Shield,
  KeyRound,
  Heart,
  X,
  Share2,
  Send,
  MessageSquare,
  Users,
  Fingerprint,
  Lock,
  Moon,
  Sun,
} from 'lucide-react';

const PRESET_FAMILY_AVATARS = [
  { label: 'الوالد', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80' },
  { label: 'الوالدة', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { label: 'الجد', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'ابن', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { label: 'ابنة', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { label: 'رمز عائلي', url: 'https://api.dicebear.com/7.x/initials/svg?seed=Home&backgroundColor=0f766e' },
];

const AUTO_REPLY_PRESETS = [
  'أنا غير متصل حالياً، سأرد عليك فور دخولي التطبيق 🌙',
  'في الصلاة / المسجد حالياً، سأعاود محادثتك بإذن الله 🤲',
  'أنا خارج المنزل لشراء أغراض العائلة، اتصل بي لو ضروري 🛒',
  'في الدوام / العمل، سأرد فور الفراغ 💼',
  'وقت نوم وراحة، نلتقي على خير غداً 😴',
];

export const SettingsTab: React.FC = () => {
  const {
    currentUser,
    logout,
    updateUserSettings,
    updateProfilePhoto,
    clearAllDataForReset,
    familyPassword,
    updateFamilyPassword,
    biometricEnabled,
    toggleBiometric,
    lockApp,
    verifyBiometricForAction,
    theme,
    toggleTheme,
  } = useFamily();

  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(
    currentUser?.autoReply?.enabled ?? true
  );
  const [replyMessage, setReplyMessage] = useState<string>(
    currentUser?.autoReply?.message ?? 'أنا غير متصل حالياً، سأرد عليك فور دخولي التطبيق 🌙'
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [photoSavedNotice, setPhotoSavedNotice] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedInviteText, setCopiedInviteText] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('emerald');
  const [showAvatarChooser, setShowAvatarChooser] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [biometricNotice, setBiometricNotice] = useState<string>('');

  // Admin Family Password update inside Settings
  const [newFamilyPass, setNewFamilyPass] = useState<string>(familyPassword);
  const [passNotice, setPassNotice] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const publicUrl = await uploadMediaFile(file, 'avatars');
        updateProfilePhoto(publicUrl);
        setPhotoSavedNotice(true);
        setTimeout(() => setPhotoSavedNotice(false), 3000);
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          updateProfilePhoto(result);
          setPhotoSavedNotice(true);
          setTimeout(() => setPhotoSavedNotice(false), 3000);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSelectPresetAvatar = (url: string) => {
    updateProfilePhoto(url);
    setShowAvatarChooser(false);
    setPhotoSavedNotice(true);
    setTimeout(() => setPhotoSavedNotice(false), 3000);
  };

  const handleSaveAutoReply = () => {
    updateUserSettings({
      autoReply: {
        enabled: autoReplyEnabled,
        message: replyMessage.trim(),
      },
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const copyMyId = () => {
    navigator.clipboard.writeText(currentUser.shortId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const getFullInviteMessage = () => {
    return `السلام عليكم ورحمة الله وبركاته،\nأنا متواجد في تطبيق «دارنا» للمحادثات العائلية الخاصة والآمنة.\nرمز دعوتي للتواصل المباشر معي هو: #${currentUser.shortId}\nيمكنك إدخال هذا الرمز مباشرة في خانة «دليل العائلة» لبدء مراسلتي والاتصال الصوتي فوراً.`;
  };

  const handleShareWhatsApp = () => {
    const text = getFullInviteMessage();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareNativeOrCopy = async () => {
    const text = getFullInviteMessage();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'دعوة للتواصل في تطبيق دارنا العائلي',
          text: text,
        });
        return;
      } catch {
        // User dismissed
      }
    }
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedInviteText(true);
    setTimeout(() => setCopiedInviteText(false), 2500);
  };

  const handleSaveFamilyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyPass.trim()) return;

    if (biometricEnabled) {
      const bioRes = await verifyBiometricForAction('تحديث كلمة سر العائلة');
      if (!bioRes.success) {
        alert(bioRes.message || 'تعذر التحقق من البصمة/الوجه لحفظ كلمة السر الجديدة.');
        return;
      }
    }

    updateFamilyPassword(newFamilyPass.trim());
    setPassNotice(true);
    setTimeout(() => setPassNotice(false), 3000);
  };

  const handleResetApp = async () => {
    if (biometricEnabled) {
      const bioRes = await verifyBiometricForAction('تصفير بيانات التطبيق');
      if (!bioRes.success) {
        alert(bioRes.message || 'تعذر التحقق من البصمة/الوجه لتصفير بيانات التطبيق.');
        return;
      }
    }

    if (window.confirm('هل أنت متأكد من رغبتك في إعادة تعيين التطبيق ومسح كافة البيانات المسجلة للبدء من الصفر؟')) {
      clearAllDataForReset();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">الملف الشخصي والإعدادات</h2>
          <p className="text-[11px] text-slate-500">الصورة الشخصية، رمز ID، والأمان</p>
        </div>

        <button
          onClick={logout}
          className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>خروج</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        
        {/* User Profile Card with Avatar Upload */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5 space-x-reverse">
              {/* Avatar with Camera Trigger */}
              <div className="relative group cursor-pointer" onClick={() => setShowAvatarChooser(!showAvatarChooser)}>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-teal-500/40 shadow-sm"
                />
                <button
                  type="button"
                  className="absolute -bottom-1 -left-1 bg-teal-600 hover:bg-teal-500 text-white p-1 rounded-full shadow-md border-2 border-white"
                  title="تغيير الصورة الشخصية"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-800">{currentUser.name}</h3>
                  <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                    {currentUser.role === 'ADMIN' ? 'مسؤول التطبيق عمر 👑' : 'عضو معتمد'}
                  </span>
                </div>
                <p className="text-xs text-teal-700 font-medium mt-0.5">
                  {currentUser.relationship || (currentUser.role === 'ADMIN' ? 'مسؤول التطبيق' : 'عضو بالعائلة')}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                  {currentUser.phone}
                </p>
              </div>
            </div>

            {/* Change Avatar Button */}
            <button
              onClick={() => setShowAvatarChooser(!showAvatarChooser)}
              className="text-xs text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 font-semibold px-2.5 py-1.5 rounded-xl transition"
            >
              تعديل الصورة
            </button>
          </div>

          {/* Short ID Highlight */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-slate-700">رمز ID الخاص بك:</span>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md" dir="ltr">
                #{currentUser.shortId}
              </span>
            </div>

            <button
              onClick={copyMyId}
              className="text-xs text-teal-700 hover:text-teal-900 flex items-center gap-1 font-semibold"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          {photoSavedNotice && (
            <p className="text-[11px] text-emerald-600 font-bold text-center bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
              تم تحديث صورتك الشخصية وستظهر لجميع أفراد العائلة فوراً! ✨
            </p>
          )}

          {/* Avatar Chooser Drawer */}
          {showAvatarChooser && (
            <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">اختر صورة تعبر عنك أو ارفع صورة خاصة:</span>
              </div>

              {/* Upload from device */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>رفع صورة من ألبوم جوالك أو الكاميرا</span>
              </button>

              {/* Ready Preset Avatars */}
              <div>
                <span className="block text-[11px] text-slate-500 mb-2">أو اختر من الرموز العائلية الجاهزة:</span>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_FAMILY_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(av.url)}
                      className="flex flex-col items-center group"
                    >
                      <img
                        src={av.url}
                        alt={av.label}
                        className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200 group-hover:border-teal-500 transition"
                      />
                      <span className="text-[9px] text-slate-500 mt-0.5 truncate">{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Member Invite Code & Direct Sharing Card */}
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white rounded-2xl p-4 border border-teal-700/60 shadow-md space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>رمز الدعوة والتواصل المباشر الخاص بك</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded-full font-bold">
                    فريد وآمن
                  </span>
                </h4>
                <p className="text-[10px] text-teal-200/80">
                  شاركه مع أفراد العائلة للبدء في مراسلتك والتواصل معك فوراً
                </p>
              </div>
            </div>
          </div>

          {/* Large Code Badge */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-teal-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-teal-300/80 block font-medium">رمز ID المخصص لحسابك:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-mono font-black tracking-widest text-emerald-300" dir="ltr">
                  #{currentUser.shortId}
                </span>
                {currentUser.invitedBy && (
                  <span className="text-[10px] bg-teal-900/80 text-teal-200 border border-teal-700 px-2 py-0.5 rounded-md font-medium">
                    مدعو عبر: {currentUser.invitedBy}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={copyMyId}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'تم النسخ!' : 'نسخ الرمز'}</span>
            </button>
          </div>

          {/* Action Buttons: WhatsApp & Native Share / Message Copy */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>مشاركة عبر واتساب</span>
            </button>

            <button
              onClick={handleShareNativeOrCopy}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-white/20 active:scale-98"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedInviteText ? 'تم نسخ الدعوة!' : 'مشاركة أو نسخ النص'}</span>
            </button>
          </div>

          {copiedInviteText && (
            <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs p-2 rounded-xl text-center font-bold animate-in fade-in">
              تم نسخ نص الدعوة العائلية الكامل إلى الحافظة! يمكنك لصقه وإرساله لأي شخص. ✨
            </div>
          )}

          {/* Privacy & How it works Callout */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-[11px] text-teal-200/90 leading-relaxed space-y-1">
            <p>
              🔒 <strong>خصوصية مضمونة:</strong> يمكن لأي فرد من العائلة إدخال رمزك التعريفي في خانة «دليل العائلة» أو أثناء تسجيله لبدء محادثة مباشرة معك دون الحاجة لرقم هاتفك.
            </p>
          </div>
        </div>

        {/* Admin Family Password Manager (Only if Admin: مسؤول التطبيق عمر) */}
        {currentUser.role === 'ADMIN' && (
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-200 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-teal-700" />
                <span>كلمة سر العائلة للأعضاء</span>
              </h4>
              <span className="text-xs font-mono font-bold bg-white text-teal-800 px-2 py-0.5 rounded-md border border-teal-300">
                {familyPassword}
              </span>
            </div>

            <p className="text-[11px] text-teal-800">
              يمكنك كـ "مسؤول التطبيق عمر" تعديل كلمة سر العائلة المشتركة لتسجيل الأعضاء الجدد:
            </p>

            <form onSubmit={handleSaveFamilyPass} className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={newFamilyPass}
                onChange={(e) => setNewFamilyPass(e.target.value)}
                placeholder="كلمة السر الجديدة"
                className="flex-1 bg-white border border-teal-300 rounded-xl px-3 py-1.5 text-xs font-mono text-left focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="submit"
                className="bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-xs shrink-0"
              >
                تحديث
              </button>
            </form>

            {passNotice && (
              <p className="text-[10px] text-emerald-700 font-bold">تم تحديث كلمة سر العائلة بنجاح! ✅</p>
            )}
          </div>
        )}

        {/* WebAuthn Biometric Lock (البصمة / الوجه) Section */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  قفل التطبيق بالبصمة / الوجه (WebAuthn)
                </h4>
                <p className="text-[10px] text-slate-400">
                  حماية واستئناف الجلسة باستخدام بصمة الأصبع أو التعرف على الوجه
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                const res = await toggleBiometric(!biometricEnabled);
                setBiometricNotice(res.message || '');
                setTimeout(() => setBiometricNotice(''), 3500);
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                biometricEnabled ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  biometricEnabled ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-[11px] text-slate-600 font-medium">
              {biometricEnabled ? 'البصمة مفعّلة وآمنة ✅' : 'البصمة غير مفعّلة'}
            </span>
            <button
              onClick={lockApp}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1 shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-teal-400" />
              <span>قفل التطبيق الآن 🔒</span>
            </button>
          </div>

          {biometricNotice && (
            <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-200 text-center">
              {biometricNotice}
            </p>
          )}
        </div>

        {/* Offline Auto-Reply Settings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  الرد التلقائي عند عدم التواجد (Offline Auto-Reply)
                </h4>
                <p className="text-[10px] text-slate-400">
                  يرد آلياً لمن يراسلك في الخاص وأنت غير متصل
                </p>
              </div>
            </div>

            <button
              onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                autoReplyEnabled ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoReplyEnabled ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {autoReplyEnabled && (
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  نص الرد التلقائي:
                </label>
                <textarea
                  rows={2}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <span className="block text-[10px] text-slate-500 mb-1 font-medium">
                  نماذج سريعة جاهزة:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AUTO_REPLY_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyMessage(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border text-right transition ${
                        replyMessage === preset
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveAutoReply}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>حفظ نص الرد التلقائي</span>
              </button>

              {saveSuccess && (
                <p className="text-[11px] text-emerald-600 text-center font-bold">
                  تم حفظ إعدادات الرد بنجاح! 🌸
                </p>
              )}
            </div>
          )}
        </div>

        {/* Appearance & Themes + Night Mode Toggle */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-teal-600" />
              <span>المظهر والخلفيات العائلية</span>
            </h4>
          </div>

          {/* Night Mode Toggle Switch (الوضع الليلي) */}
          <div className="bg-slate-900 text-white rounded-xl p-3 border border-slate-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs transition ${
                theme === 'dark' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-400/40' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-bold text-white">الوضع الليلي (راحة العين)</h5>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                    theme === 'dark'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {theme === 'dark' ? 'مفعّل 🌙' : 'غير مفعّل ☀️'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  تعتيم خلفيات الشاشة وتقليل التباين لراحة العين أثناء الاستخدام الليلي
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
              title={theme === 'dark' ? 'إيقاف الوضع الليلي' : 'تفعيل الوضع الليلي'}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  theme === 'dark' ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Color Presets */}
          <div>
            <span className="block text-[10px] text-slate-400 mb-1.5 font-medium">أنماط ألوان الواجهة:</span>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <button
                onClick={() => setSelectedTheme('emerald')}
                className={`p-2.5 rounded-xl border transition ${
                  selectedTheme === 'emerald'
                    ? 'bg-teal-50 border-teal-500 text-teal-800 font-bold ring-1 ring-teal-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                🌿 زمردي دافئ
              </button>
              <button
                onClick={() => setSelectedTheme('slate')}
                className={`p-2.5 rounded-xl border transition ${
                  selectedTheme === 'slate'
                    ? 'bg-slate-200 border-slate-600 text-slate-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                🌑 رمادي أنيق
              </button>
              <button
                onClick={() => setSelectedTheme('warm')}
                className={`p-2.5 rounded-xl border transition ${
                  selectedTheme === 'warm'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                ☕ بيج كلاسيكي
              </button>
            </div>
          </div>
        </div>

        {/* About App Section / تعريف بالتطبيق - تطوير عمر الموسى V1.0 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">حول التطبيق</h4>
                <p className="text-[10px] text-slate-400">تطبيق دارنا V1.0 • تطوير عمر الموسى</p>
              </div>
            </div>

            <button
              onClick={() => setShowAboutModal(true)}
              className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold px-3 py-1.5 rounded-xl border border-teal-200 transition"
            >
              عرض التفاصيل
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">تطوير: عمر الموسى</span>
            <span className="font-mono bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
              V1.0
            </span>
          </div>
        </div>

        {/* Factory Reset Section */}
        <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs space-y-2">
          <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>إعادة التعيين التجريبي (تصفير البيانات)</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            يمكنك مسح كافة الرسائل والمحادثات والحسابات المسجلة للبدء من جديد كنسخة نظيفة تماماً.
          </p>
          <button
            onClick={handleResetApp}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>إعادة تعيين التطبيق التجريبي الآن</span>
          </button>
        </div>

        {/* App Footer */}
        <div className="text-center pt-2 pb-6 text-slate-400 text-[10px]">
          <p className="font-semibold text-slate-500">تطبيق دارنا V1.0 • تطوير عمر الموسى</p>
          <p className="mt-0.5">منصة عائلية خاصة وآمنة 100% بإشراف مسؤول التطبيق عمر 🛡️</p>
        </div>
      </div>

      {/* About App Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white flex items-center justify-center mx-auto shadow-xl text-3xl">
              🏡
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">تطبيق دارنا</h3>
              <span className="inline-block bg-teal-100 text-teal-800 text-xs font-bold font-mono px-2.5 py-0.5 rounded-full mt-1">
                الإصدار V1.0
              </span>
            </div>

            <div className="bg-teal-50 border border-teal-100 p-3 rounded-2xl text-xs text-teal-900 leading-relaxed text-right space-y-1.5">
              <p className="font-bold text-teal-950 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-teal-600 shrink-0" />
                <span>فكرة وتطوير: عمر الموسى</span>
              </p>
              <p className="text-[11px] text-teal-800">
                منصة عائلية خاصة ومغلقة صُممت بأحدث تقنيات الويب التقدمية (PWA) لتوفير تواصل عائلي آمن ومشفر يجمع الأهل والأقارب، بإدارة وإشراف مسؤول التطبيق عمر.
              </p>
            </div>

            <button
              onClick={() => setShowAboutModal(false)}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2.5 rounded-xl transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
