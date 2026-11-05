import React, { useState, useRef, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { Bot, Send, Sparkles, Utensils, Compass, FileText, Heart, RefreshCw } from 'lucide-react';

interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

const DEFAULT_PROMPTS = [
  {
    icon: <Utensils className="w-3.5 h-3.5 text-amber-600" />,
    text: 'اقترح غداء عائلي شهي وسريع لليوم مع التحلية 🍲',
    label: 'اقتراح وجبة غداء',
  },
  {
    icon: <Compass className="w-3.5 h-3.5 text-emerald-600" />,
    text: 'ما هي أفضل خطة لنزهة عائلية مميزة في نهاية هذا الأسبوع؟ 🏕️',
    label: 'فعالية عطلة الأسبوع',
  },
  {
    icon: <FileText className="w-3.5 h-3.5 text-teal-600" />,
    text: 'لخص لي أهم ما دار في نقاشات المجلس العائلي مؤخراً 📝',
    label: 'تلخيص المجلس العائلي',
  },
  {
    icon: <Heart className="w-3.5 h-3.5 text-rose-600" />,
    text: 'اكتب رسالة صباحية لطيفة فيها دعاء للوالدين والأبناء للمشاركة في المجلس ☀️',
    label: 'رسالة ودعاء للأسرة',
  },
];

export const AssistantTab: React.FC = () => {
  const { askFamilyAI, currentUser } = useFamily();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'ai-init',
      sender: 'assistant',
      text: `أهلاً بك يا ${currentUser?.name || 'غالي'} في ركن المساعد الذكي لـ "دارنا" 🤖✨\n\nأنا هنا لخدمة العائلة: اقتراح وجبات الغداء والعشاء، تنظيم المسابقات والأنشطة الأسبوعية، تلخيص النقاشات، وتقديم النصائح الأسرية. تفضل بطرح سؤالك أو اختر أحد الاقتراحات السريعة!`,
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const handleSendPrompt = async (promptToSend: string) => {
    const text = promptToSend.trim();
    if (!text || isLoading) return;

    const userMsg: AIMessage = {
      id: `ai-u-${Date.now()}`,
      sender: 'user',
      text,
    };

    const currentHistory = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const reply = await askFamilyAI(text, currentHistory);
      const botMsg: AIMessage = {
        id: `ai-b-${Date.now()}`,
        sender: 'assistant',
        text: reply,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errorMsg: AIMessage = {
        id: `ai-e-${Date.now()}`,
        sender: 'assistant',
        text: 'عذراً، حدث خطأ بسيط أثناء معالجة الطلب. يرجى إعادة المحاولة بعد قليل.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-800">مساعد العائلة الذكي</h2>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-medium">
                Gemini AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500">جاهز للاقتراحات والمساعدة المنزلية 24/7</p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: `ai-reset-${Date.now()}`,
                sender: 'assistant',
                text: 'تم بدء جلسة محادثة جديدة. كيف أستطيع مساعدة أسرتنا الكريمة اليوم؟ 🌸',
              },
            ]);
          }}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
          title="بدء جلسة جديدة"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area with safety bottom padding */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${
                isUser ? 'justify-start flex-row-reverse' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl p-3 text-xs shadow-xs relative leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                }`}
              >
                {!isUser && (
                  <div className="text-[10px] text-amber-700 font-bold mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>مساعد دارنا الذكي</span>
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-2 px-3 bg-white rounded-2xl w-fit border border-slate-200 shadow-xs">
            <Bot className="w-4 h-4 text-amber-500 animate-spin" />
            <span>المساعد يكتب رداً يناسب العائلة...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Preset Suggestions Chips above input */}
      <div className="p-2 bg-slate-100/95 border-t border-slate-200/90 overflow-x-auto shrink-0 z-10 mb-16">
        <div className="flex items-center gap-1.5 whitespace-nowrap mb-2">
          {DEFAULT_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendPrompt(p.text)}
              disabled={isLoading}
              className="bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-900 text-[11px] px-2.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputText);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="اسأل المساعد عن وجبة، فكرة نزهة، أو تلخيص..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-white text-slate-800 text-xs rounded-full px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow transition"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
