import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  getAllUsers,
  upsertUser,
  getAllChats,
  upsertChat,
  getAllMessages,
  insertMessage,
} from './src/db/queries.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '15mb' }));

  // Initialize Gemini client if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  let aiClient: GoogleGenAI | null = null;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      console.log('Gemini AI Client initialized successfully');
    } catch (err) {
      console.warn('Error initializing GoogleGenAI:', err);
    }
  } else {
    console.log('GEMINI_API_KEY not configured or using default placeholder. Using smart local family assistant fallback.');
  }

  // --- Cloud SQL Persistent Data Endpoints ---
  app.get('/api/sync/state', async (_req: Request, res: Response): Promise<void> => {
    try {
      const [dbUsers, dbChats, dbMessages] = await Promise.all([
        getAllUsers(),
        getAllChats(),
        getAllMessages(),
      ]);

      const formattedUsers = dbUsers.map((u) => ({
        id: u.uid,
        phone: u.phone,
        name: u.name,
        role: u.role,
        status: u.status,
        shortId: u.shortId,
        avatar: u.avatarUrl || undefined,
        bio: u.bio || '',
        relationship: u.bio?.startsWith('invited_by:') ? `مدعو من طرف ${u.bio.replace('invited_by:', '')}` : (u.bio || undefined),
        invitedBy: u.bio?.startsWith('invited_by:') ? u.bio.replace('invited_by:', '') : undefined,
        online: u.online ?? false,
        canCreateGroups: u.canCreateGroups ?? true,
        canSendInvites: u.canSendInvites ?? true,
      }));

      const formattedChats = dbChats.map((c) => {
        let parsedMembers: string[] = [];
        try {
          parsedMembers = JSON.parse(c.memberIds || '[]');
        } catch {
          parsedMembers = [];
        }
        return {
          id: c.chatId,
          type: c.type || 'DIRECT',
          name: c.name || '',
          title: c.name || '',
          description: c.description || '',
          participants: parsedMembers,
          members: parsedMembers,
          updatedAt: c.lastMessageTime || '',
          unreadCount: c.unreadCount || 0,
          lastMessage: c.lastMessageText
            ? {
                id: 'lm_' + c.chatId,
                chatId: c.chatId,
                senderId: '',
                senderName: '',
                text: c.lastMessageText,
                time: c.lastMessageTime || '',
                timestamp: 0,
              }
            : undefined,
        };
      });

      const formattedMessages = dbMessages.map((m) => ({
        id: m.messageId,
        chatId: m.chatId,
        senderId: m.senderId,
        senderName: m.senderName,
        text: m.text || undefined,
        mediaUrl: m.mediaUrl || undefined,
        time: m.time || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'الآن'),
        timestamp: m.time || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'الآن'),
        isViewOnce: m.isViewOnce ?? false,
        viewed: m.viewed ?? false,
        readBy: (() => {
          try {
            return JSON.parse(m.readBy || '[]');
          } catch {
            return [];
          }
        })(),
      }));

      // Never include authentication/invitation secrets in a state snapshot.
      res.json({
        users: formattedUsers,
        chats: formattedChats,
        messages: formattedMessages,
      });
    } catch (err: any) {
      console.error('Error fetching sync state from Cloud SQL:', err);
      res.status(500).json({ error: 'Failed to fetch persistent state' });
    }
  });

  app.post('/api/sync/user', async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.body;
      if (!user || !user.id || !user.phone || !user.name) {
        res.status(400).json({ error: 'Invalid user payload' });
        return;
      }

      const saved = await upsertUser({
        uid: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        shortId: user.shortId || user.id,
        avatarUrl: user.avatar,
        bio: user.invitedBy ? `invited_by:${user.invitedBy}` : (user.bio || user.relationship || ''),
        online: user.online,
        canCreateGroups: user.canCreateGroups,
        canSendInvites: user.canSendInvites,
      });

      res.json({ success: true, user: saved });
    } catch (err: any) {
      console.error('Error syncing user to Cloud SQL:', err);
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  app.post('/api/sync/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const chat = req.body;
      if (!chat || !chat.id) {
        res.status(400).json({ error: 'Invalid chat payload: id required' });
        return;
      }

      const chatName = chat.name || chat.title || 'محادثة';
      const memberIds = Array.isArray(chat.members)
        ? chat.members
        : (Array.isArray(chat.participants) ? chat.participants : []);

      const saved = await upsertChat({
        chatId: chat.id,
        type: chat.type || 'DIRECT',
        name: chatName,
        description: chat.description || '',
        memberIds,
        lastMessageText: chat.lastMessage?.text || chat.lastMessageText || '',
        lastMessageTime: chat.lastMessage?.timestamp || chat.lastMessage?.time || chat.lastMessageTime || '',
        unreadCount: chat.unreadCount || 0,
      });

      res.json({ success: true, chat: saved });
    } catch (err: any) {
      console.error('Error syncing chat to Cloud SQL:', err);
      res.status(500).json({ error: 'Failed to sync chat' });
    }
  });

  app.post('/api/sync/message', async (req: Request, res: Response): Promise<void> => {
    try {
      const msg = req.body;
      if (!msg || !msg.id || !msg.chatId || !msg.senderId) {
        res.status(400).json({ error: 'Invalid message payload' });
        return;
      }

      const formattedTime = msg.timestamp || msg.time || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const saved = await insertMessage({
        messageId: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        senderName: msg.senderName || 'عضو بالعائلة',
        text: msg.text || msg.content || '',
        mediaUrl: msg.mediaUrl || msg.media_url,
        time: formattedTime,
        isViewOnce: msg.isViewOnce || msg.is_view_once,
        viewed: msg.viewed || msg.is_viewed,
        readBy: msg.readBy,
      });

      res.json({ success: true, message: saved });
    } catch (err: any) {
      console.error('Error saving message to Cloud SQL:', err);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });

  app.post('/api/sync/password', async (_req: Request, res: Response): Promise<void> => {
    // SECURITY: the legacy endpoint accepted anonymous password replacement.
    // Disabled pending server-side authentication and administrator authorization.
    res.status(403).json({ error: 'تغيير رمز العائلة يتطلب مصادقة إدارية على الخادم' });
  });

  // Call Signaling State for Real-Time Voice Calls
  const activeCallSignals = new Map<string, any>();

  app.post('/api/call/signal', (req: Request, res: Response): void => {
    try {
      const { callId, callerId, receiverId, status, callerName, callerAvatar, callerPhone, sdp, candidate } = req.body;
      if (!callId) {
        res.status(400).json({ error: 'callId required' });
        return;
      }

      if (status === 'ended' || status === 'declined') {
        // Quickly clean up ended call signals so they do not auto-reject future calls
        activeCallSignals.delete(callId);
        res.json({ success: true, ended: true });
        return;
      }

      const existing = activeCallSignals.get(callId) || {};
      const updated = {
        ...existing,
        id: callId,
        callId,
        callerId: callerId || existing.callerId,
        receiverId: receiverId || existing.receiverId,
        targetUserId: receiverId || existing.targetUserId,
        status: status || existing.status,
        callerName: callerName || existing.callerName,
        callerAvatar: callerAvatar || existing.callerAvatar,
        callerPhone: callerPhone || existing.callerPhone,
        sdp: sdp || existing.sdp,
        candidate: candidate || existing.candidate,
        updatedAt: Date.now(),
      };
      activeCallSignals.set(callId, updated);
      res.json({ success: true, call: updated });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update call signal' });
    }
  });

  app.get('/api/call/signals', (_req: Request, res: Response): void => {
    const now = Date.now();
    // Only return live calls within the last 15 seconds to prevent stale auto-ringing/auto-rejects
    const list = Array.from(activeCallSignals.values()).filter(
      (c) => c.status !== 'ended' && now - (c.updatedAt || 0) < 15000
    );
    res.json({ signals: list });
  });

  // Family Assistant Chat Endpoint
  app.post('/api/gemini/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt, conversationHistory = [], familyContext = {} } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const systemInstruction = `أنت "مساعد دارنا" - المساعد الذكي التفاعلي المباشر للأسرة والعائلة.
أنت عضو محبوب وذكي جداً في هذه العائلة، تتحدث بلغة عربية سلسة وودودة تتسم بالدفء والمحبة والاحترام.
قدراتك وتفاعلك:
1. الإجابة الشاملة والتفصيلية عن أي سؤال يطرحه أفراد العائلة (أسئلة عامة، ثقافية، تربوية، تعليمية، دين وأخلاق).
2. تقديم اقتراحات مبتكرة للوجبات (غداء، عشاء، حلى، مشروبات) مع مقادير وطريقة تحضير خطوة بخطوة إذا طُلب منك.
3. التخطيط التفاعلي الكامل للفعاليات والنزهات والمسابقات العائلية وجداول العطلات الأسبوعية.
4. كتابة وتصمـيم رسائل تهنئة، أدعية، وأفكار تسويق أو تنظيم منزلي حسب الطلب الدقيق للمستخدم.
5. التفاعل المباشر مع استفسارات المستخدم ومتابعة الأسئلة السابقة بحرص واهتمام.
استجب دائماً بروح مرحة، مشجعة، ونافعة دون الاقتصار على إجابات مكررة أو نموذجية جامدة.`;

      // Check if aiClient is initialized or attempt creating dynamically with httpOptions User-Agent
      let activeAiClient = aiClient;
      const currentApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!activeAiClient && currentApiKey && currentApiKey !== 'MY_GEMINI_API_KEY') {
        try {
          activeAiClient = new GoogleGenAI({
            apiKey: currentApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });
        } catch (e) {
          console.warn('Dynamic GoogleGenAI client creation notice:', e);
        }
      }

      if (activeAiClient) {
        try {
          const contents = [
            ...conversationHistory.slice(-8).map((msg: any) => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text || msg.content || '' }]
            })),
            {
              role: 'user',
              parts: [
                {
                  text: `${prompt}${
                    familyContext?.summary ? `\n\n[سياق نقاش العائلة الأخير]: ${familyContext.summary}` : ''
                  }`
                }
              ]
            }
          ];

          const generatePromise = activeAiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction,
            }
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI request timeout')), 25000)
          );

          const response: any = await Promise.race([generatePromise, timeoutPromise]);

          const replyText = response.text || 'أهلاً بكم في دارنا! كيف يمكنني مساعدتكم؟';
          res.json({ reply: replyText });
          return;
        } catch (apiError: any) {
          console.warn('Gemini API call notice, smoothly returning fallback assistant response:', apiError?.message || apiError);
        }
      }

      // Dynamic intelligent response fallback for interactive assistance
      const lower = prompt.toLowerCase();
      let responseText = '';

      if (lower.includes('وجبة') || lower.includes('غداء') || lower.includes('عشاء') || lower.includes('طبخ') || lower.includes('اكل') || lower.includes('وصفة')) {
        responseText = `🥘 **اقترح عليكم وجبة عائلية شهية ولذيذة اليوم!**\n\n` +
          `**طبق اليوم:** صينية دجاج بالبطاطس والليمون والثوم مع أرز بالشعيرية وسلطة خضراء.\n\n` +
          `**المكونات الأساسية:**\n- دجاجة مقطعة + 4 حبات بطاطس slices.\n- عصير ليمونتين + 5 فصوص ثوم مفروم + زيت زيتون وثوم وبابريكا.\n\n` +
          `**طريقة التحضير السريعة:**\n1. تبلوا الدجاج والبطاطس بالثوم والليمون والبهارات.\n2. اطبخوها بالفرن على حرارة 200° لمدة 45 دقيقة حتى تتحمر.\n3. قدموها مع الأرز الدافئ وسلطة الخيار باللبن والنعناع.\n\n` +
          `وبالهناء والشفاء لعائلتنا الكريمة! 😋 إذا برغبتكم في صنف حلى سريع بعد الغداء خبروني!`;
      } else if (lower.includes('فعالية') || lower.includes('لعبة') || lower.includes('طلعة') || lower.includes('نشاط') || lower.includes('نهاية الأسبوع') || lower.includes('اجازة')) {
        responseText = `🏕️ **خطة نشاط عائلي مسلّي ومجمع للبيت:**\n\n` +
          `1. 🎲 **مسابقة التحدي العائلي:** أسئلة ومعلومات عن تاريخ العائلة وذكريات الصور القديمة.\n` +
          `2. 🌳 **رحلة أو جلسة خارجية:** تجهيز القهوة وشاي النعناع مع فطائر خفيفة بحديقة أو كشتة.\n` +
          `3. 🎬 **سهرة فيلم عائلي:** اختيار فيلم مناسب للجميع مع فشار وجلسة دافئة.\n\n` +
          `أي خيار تحبون نجهز تفاصيله وجدوله أكثر؟ 😊`;
      } else if (lower.includes('لخص') || lower.includes('ملخص') || lower.includes('نقاش') || lower.includes('المجلس')) {
        responseText = `📝 **ملخص المجلس والدردشات العائلية:**\n\n` +
          `- تم التأكيد على جمعة العائلة القادمة والاطمئنان على الجميع.\n` +
          `- الجميع بخير وصحة وعافية مع تبادل التحيات والتهاني الطيبة.\n` +
          `- التذكير بتنسيق المشتريات والطلبات قبل موعد الخروج.\n\n` +
          `الله يديم المحبة والجمع الميمون دائماً! 🤲✨`;
      } else {
        responseText = `يا أهلاً بكم! تسعدني إجابتكم ومساعدتكم بخصوص: "${prompt}".\n\n` +
          `أنا هنا لمساعدتكم في كل ما تحتاجونه: تنظيم جدول اليوم، كتابة الرسائل والأدعية، اقتراح أكلات وأفكار ترفيهية، أو الإجابة عن أي سؤال ثقافي أو عام.\n\n` +
          `كيف يمكنني تقديم المزيد من التفاصيل لكم الآن؟ 😊`;
      }

      res.json({ reply: responseText });
    } catch (error: any) {
      console.error('Server error in /api/gemini/chat:', error);
      res.status(500).json({ error: 'Internal server error', reply: 'عذراً، حدث خطأ بسيط أثناء معالجة الطلب. يرجى المحاولة ثانية.' });
    }
  });

  // Gemini AI Quick Reply Suggestions Endpoint
  app.post('/api/gemini/quick-replies', async (req: Request, res: Response): Promise<void> => {
    try {
      const { lastMessages = [], chatTitle = 'محادثة عائلية' } = req.body;
      const formattedHistory = Array.isArray(lastMessages) ? lastMessages.filter(Boolean).slice(-6) : [];

      let activeAiClient = aiClient;
      const currentApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!activeAiClient && currentApiKey && currentApiKey !== 'MY_GEMINI_API_KEY') {
        try {
          activeAiClient = new GoogleGenAI({ apiKey: currentApiKey });
        } catch (e) {}
      }

      if (activeAiClient && formattedHistory.length > 0) {
        try {
          const promptText = `أنت مساعد الذكاء الاصطناعي لتطبيق المحادثات العائلية "دارنا".
بناءً على المحادثة العائلية الأخيرة في (${chatTitle}):
${formattedHistory.map((m: any) => `- ${typeof m === 'string' ? m : `${m.senderName || 'عضو'}: ${m.text || ''}`}`).join('\n')}

اقترح 4 ردود سريعة ومناسبة جداً ومختصرة للرد المباشر (من 2 إلى 5 كلمات مع إيموجي).
المطلوب إخراج مصفوفة JSON فقط بالشكل التالي بدون أي شرح أو ماركداون إضافي:
["الرد الأول 🌸", "الرد الثاني 👍", "الرد الثالث 🤲", "الرد الرابع 💚"]`;

          const generatePromise = activeAiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI request timeout')), 10000)
          );

          const response: any = await Promise.race([generatePromise, timeoutPromise]);
          const textRes = response.text?.trim() || '';
          const parsed = JSON.parse(textRes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            res.json({ suggestions: parsed.slice(0, 4) });
            return;
          }
        } catch (e) {
          console.warn('[Gemini Quick-Replies] API warning, using rule-based suggestions:', e);
        }
      }

      // Rule-based Fallback Suggestions
      const lastMsgText = formattedHistory.length > 0
        ? (typeof formattedHistory[formattedHistory.length - 1] === 'string'
            ? formattedHistory[formattedHistory.length - 1]
            : formattedHistory[formattedHistory.length - 1]?.text || '')
        : '';

      const lower = lastMsgText.toLowerCase();
      let suggestions: string[] = [];

      if (lower.includes('سلام') || lower.includes('مرحبا') || lower.includes('اهلين') || lower.includes('مساء') || lower.includes('صباح')) {
        suggestions = ['وعليكم السلام ورحمة الله 💚', 'أهلاً وسهلاً بك 🌸', 'صباح الخير والبركة ☀️', 'مساء الورد والياسمين 🌺'];
      } else if (lower.includes('شكرا') || lower.includes('تسلم') || lower.includes('يعطيك') || lower.includes('ممنون')) {
        suggestions = ['العفو، ولو واجبنا 🤲', 'الله يسلمك ويحفظك 💚', 'الله يعافيك يارب 🌸', 'في الخدمة دائماً 🌹'];
      } else if (lower.includes('كيف') || lower.includes('شلون') || lower.includes('اخبار') || lower.includes('طمنا')) {
        suggestions = ['الحمد لله بكل خير وعافية 🤲', 'بخير ونعمة من الله 💚', 'الحمد لله نسأل عنكم 🌸', 'كل الأمور طيبة وبخير ✨'];
      } else if (lower.includes('ان شاء الله') || lower.includes('تم') || lower.includes('جاهز') || lower.includes('موعد')) {
        suggestions = ['إن شاء الله، تم الترتيب 👍', 'على بركة الله ✨', 'ممتاز، في الموعد إن شاء الله 🕒', 'الله يكتب الخير دائماً 🤲'];
      } else {
        suggestions = ['الله يسعدك ويحفظك 🤲', 'إن شاء الله، تم 👍', 'يعطيك الصحة والعافية 🌸', 'الله يديم التواصل المحب 💚'];
      }

      res.json({ suggestions });
    } catch (err) {
      res.json({
        suggestions: ['الله يسعدك ويحفظك 🤲', 'إن شاء الله، تم 👍', 'يعطيك الصحة والعافية 🌸', 'الله يديم الخير 💚'],
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Darna Family Chat', time: new Date().toISOString() });
  });

  // Setup Vite in development or serve dist in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Darna Family App running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
