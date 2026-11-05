import React, { useState, useRef } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Story } from '../types';
import { Plus, X, Image as ImageIcon, Sparkles, Send, Trash2, Clock } from 'lucide-react';
import { uploadMediaFile } from '../services/darnaBackend.js';

const GRADIENTS = [
  'from-teal-600 to-emerald-800',
  'from-indigo-600 to-purple-800',
  'from-amber-500 to-rose-700',
  'from-sky-600 to-blue-900',
  'from-slate-800 to-slate-950',
];

const DURATION_OPTIONS = [
  { label: '12 ساعة', hours: 12 },
  { label: '24 ساعة (يوم)', hours: 24 },
  { label: '48 ساعة (يومان)', hours: 48 },
  { label: '7 أيام', hours: 168 },
];

export const StorySection: React.FC = () => {
  const { currentUser, stories, addStory, deleteStory } = useFamily();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [storyType, setStoryType] = useState<'text' | 'image'>('text');
  const [storyText, setStoryText] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
  const [storyImageUrl, setStoryImageUrl] = useState<string | null>(null);
  const [selectedDurationHours, setSelectedDurationHours] = useState<number>(24);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!currentUser) return null;

  // Filter non-expired stories (where current time < s.expiresAt)
  const activeStories = stories.filter((s) => s.expiresAt ? Date.now() < s.expiresAt : Date.now() - s.createdAt < 24 * 60 * 60 * 1000);
  const myStories = activeStories.filter((s) => s.userId === currentUser.id);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadMediaFile(file, 'stories');
      setStoryImageUrl(url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setStoryImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublishStory = async () => {
    if (!storyText.trim() && !storyImageUrl) return;

    await addStory({
      text: storyText.trim() ? (storyType === 'text' ? `gradient:${selectedGradient}:::${storyText.trim()}` : storyText.trim()) : undefined,
      mediaUrl: storyImageUrl || undefined,
      durationHours: selectedDurationHours,
    });

    setIsAddModalOpen(false);
    setStoryText('');
    setStoryImageUrl(null);
    setSelectedDurationHours(24);
  };

  const formatRemainingTime = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'منتهية';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `متبقي ${days} يوم`;
    }
    if (hours > 0) {
      return `متبقي ${hours}س و ${mins}د`;
    }
    return `متبقي ${mins} دقيقة`;
  };

  return (
    <>
      {/* Horizontal Stories Carousel */}
      <div className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 px-3 py-2.5 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0 select-none">
        {/* User's Own Story Bubble */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative cursor-pointer group" onClick={() => (myStories.length > 0 ? setSelectedStory(myStories[0]) : setIsAddModalOpen(true))}>
            <div className={`w-14 h-14 rounded-full p-0.5 ${myStories.length > 0 ? 'bg-gradient-to-tr from-teal-400 via-emerald-500 to-teal-700' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddModalOpen(true);
              }}
              className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs transition"
              title="إضافة حالة جديدة"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 max-w-[56px] truncate text-center">
            {myStories.length > 0 ? 'حالتي' : 'أضف حالة'}
          </span>
        </div>

        {/* Other Family Members' Stories */}
        {activeStories
          .filter((s) => s.userId !== currentUser.id)
          .map((story) => (
            <div
              key={story.id}
              onClick={() => setSelectedStory(story)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group transition active:scale-95"
            >
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-teal-500 via-emerald-400 to-amber-400 ring-1 ring-teal-400/30">
                <img
                  src={story.userAvatar}
                  alt={story.userName}
                  className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900 group-hover:scale-105 transition"
                />
              </div>
              <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 max-w-[56px] truncate text-center">
                {story.userName.split(' ')[0]}
              </span>
            </div>
          ))}
      </div>

      {/* Story Viewer Modal */}
      {selectedStory && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col justify-between p-4 animate-in fade-in select-none" dir="rtl">
          {/* Top Progress bar and Header */}
          <div className="w-full max-w-md mx-auto space-y-2">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full animate-progress" />
            </div>

            <div className="flex items-center justify-between text-white pt-1">
              <div className="flex items-center gap-2">
                <img
                  src={selectedStory.userAvatar}
                  alt={selectedStory.userName}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-teal-400"
                />
                <div>
                  <h4 className="text-xs font-bold">{selectedStory.userName}</h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                    <span>منذ {Math.round((Date.now() - selectedStory.createdAt) / (1000 * 60))} دقيقة</span>
                    <span>•</span>
                    <span className="text-amber-300 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatRemainingTime(selectedStory.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedStory.userId === currentUser.id && (
                  <button
                    onClick={() => {
                      deleteStory(selectedStory.id);
                      setSelectedStory(null);
                    }}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-red-600/80 text-white transition"
                    title="حذف حالتي"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedStory(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Story Content Area */}
          <div className="w-full max-w-md mx-auto flex-1 flex items-center justify-center p-2">
            {selectedStory.mediaUrl ? (
              <div className="relative max-h-[75vh] w-full flex flex-col items-center justify-center">
                <img
                  src={selectedStory.mediaUrl}
                  alt="حالة"
                  className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                />
                {selectedStory.text && !selectedStory.text.startsWith('gradient:') && (
                  <p className="mt-3 bg-black/60 backdrop-blur-xs text-white text-xs px-4 py-2 rounded-2xl max-w-xs text-center">
                    {selectedStory.text}
                  </p>
                )}
              </div>
            ) : selectedStory.text?.startsWith('gradient:') ? (
              (() => {
                const parts = selectedStory.text.split(':::');
                const gradClass = parts[0].replace('gradient:', '') || 'from-teal-600 to-emerald-800';
                const bodyText = parts.slice(1).join(':::');
                return (
                  <div className={`w-full aspect-[9/14] max-h-[70vh] rounded-3xl bg-gradient-to-br ${gradClass} flex items-center justify-center p-8 text-center text-white text-lg font-bold shadow-2xl leading-relaxed`}>
                    {bodyText}
                  </div>
                );
              })()
            ) : (
              <div className="w-full aspect-[9/14] max-h-[70vh] rounded-3xl bg-gradient-to-br from-teal-600 to-emerald-800 flex items-center justify-center p-8 text-center text-white text-lg font-bold shadow-2xl leading-relaxed">
                {selectedStory.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">إضافة حالة عائلية</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setStoryType('text')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition ${storyType === 'text' ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                نصية
              </button>
              <button
                type="button"
                onClick={() => setStoryType('image')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition ${storyType === 'image' ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                صورة
              </button>
            </div>

            {storyType === 'text' ? (
              <div className="space-y-3">
                <div className={`w-full aspect-video rounded-2xl bg-gradient-to-br ${selectedGradient} flex items-center justify-center p-4 text-center text-white text-sm font-bold shadow-inner`}>
                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="اكتب حالتك هنا..."
                    rows={3}
                    className="w-full bg-transparent text-white placeholder:text-white/60 text-center font-bold text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-center gap-2">
                  {GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedGradient(g)}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} transition ${selectedGradient === g ? 'ring-2 ring-teal-500 scale-110' : 'opacity-70'}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {storyImageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={storyImageUrl} alt="حالة" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setStoryImageUrl(null)}
                      className="absolute top-2 left-2 p-1 bg-black/60 rounded-full text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full aspect-video rounded-2xl border-2 border-dashed border-teal-300 dark:border-slate-700 bg-teal-50/50 dark:bg-slate-800 flex flex-col items-center justify-center gap-1.5 text-teal-700 dark:text-teal-400 text-xs font-semibold cursor-pointer hover:bg-teal-50 transition"
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span>{isUploading ? 'جارِ الرفع...' : 'انقر لاختيار صورة من جهازك'}</span>
                  </button>
                )}

                <input
                  type="text"
                  placeholder="أضف تعليقاً على الصورة (اختياري)..."
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  className="w-full text-xs rounded-xl px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            {/* Expiration Duration selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>وقت انتهاء الحالة:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setSelectedDurationHours(opt.hours)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition ${
                      selectedDurationHours === opt.hours
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePublishStory}
              disabled={(!storyText.trim() && !storyImageUrl) || isUploading}
              className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 rtl:-scale-x-100" />
              <span>نشر الحالة</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
