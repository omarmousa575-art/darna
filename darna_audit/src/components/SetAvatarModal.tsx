import React, { useState, useRef } from 'react';
import { useFamily } from '../context/FamilyContext';
import { uploadMediaFile } from '../services/darnaBackend.js';
import { Camera, Upload, Check, X } from 'lucide-react';

const PRESET_FAMILY_AVATARS = [
  { label: 'الوالد', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80' },
  { label: 'الوالدة', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { label: 'الجد', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'ابن', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { label: 'ابنة', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { label: 'رمز دارنا', url: 'https://api.dicebear.com/7.x/initials/svg?seed=Home&backgroundColor=0f766e' },
  { label: 'أخ', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { label: 'أخت', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
];

interface SetAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetAvatarModal: React.FC<SetAvatarModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfilePhoto } = useFamily();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser?.avatar || '');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !currentUser) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const publicUrl = await uploadMediaFile(file, 'avatars');
        setSelectedAvatar(publicUrl);
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedAvatar(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSave = () => {
    if (selectedAvatar) {
      updateProfilePhoto(selectedAvatar);
      localStorage.setItem('darna_avatar_set_' + currentUser.id, 'true');
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200/90 space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">تعيين صورتك الشخصية</h3>
              <p className="text-[11px] text-slate-500">تظهر لكل العائلة في المحادثات والدعوات</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current / Selected Preview */}
        <div className="flex flex-col items-center justify-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="relative">
            <img
              src={selectedAvatar || currentUser.avatar}
              alt={currentUser.name}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-teal-500/40 shadow-md"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -left-1 bg-teal-600 hover:bg-teal-500 text-white p-1.5 rounded-full shadow border-2 border-white transition"
              title="رفع صورة خاصة"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs font-bold text-slate-800 mt-2">{currentUser.name}</span>
          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">#{currentUser.shortId}</span>
        </div>

        {/* Upload Button */}
        <div>
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
            className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>رفع صورة خاصة من ألبوم الجوال أو الكاميرا</span>
          </button>
        </div>

        {/* Ready Presets */}
        <div>
          <span className="block text-[11px] font-bold text-slate-700 mb-2">أو اختر رمزاً عائلياً يناسبك:</span>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_FAMILY_AVATARS.map((av, idx) => {
              const isSelected = (selectedAvatar || currentUser.avatar) === av.url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedAvatar(av.url)}
                  className={`p-1 rounded-xl flex flex-col items-center border transition ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-500/30'
                      : 'border-slate-200 hover:border-teal-300 bg-white'
                  }`}
                >
                  <img
                    src={av.url}
                    alt={av.label}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <span className="text-[10px] text-slate-600 font-medium mt-1 truncate w-full text-center">
                    {av.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2 rounded-xl text-center font-bold flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ صورتك الشخصية بنجاح! ستظهر للجميع الآن ✨</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>حفظ الصورة وتأكيدها</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};
