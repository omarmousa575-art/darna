import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFamily } from '../context/FamilyContext';
import {
  X,
  Users,
  UserPlus,
  UserMinus,
  Edit3,
  Trash2,
  LogOut,
  AlertTriangle,
  Check,
  Shield,
  Search,
  Camera,
  Info,
} from 'lucide-react';

interface GroupProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  chatId: string;
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({
  isOpen,
  onClose,
  groupId,
  chatId,
}) => {
  const {
    currentUser,
    groups,
    users,
    chats,
    messages,
    updateGroupInfo,
    addGroupMembers,
    removeGroupMember,
    clearChatMessages,
    leaveGroup,
    deleteGroup,
  } = useFamily();

  const chat = chats.find((c) => c.id === chatId);
  const storedGroup = groups.find(
    (g) =>
      g.id === groupId ||
      `group-${g.id}` === groupId ||
      g.id === `group-${groupId}` ||
      `chat-${g.id}` === chatId ||
      (chat && chat.groupId === g.id)
  );

  // Some conversations are synchronized before their group metadata.
  // Show the real chat participants rather than silently refusing to open the modal.
  // This is read-only until the authoritative group record becomes available.
  const group = storedGroup || (chat?.type === 'GROUP' ? {
    id: chat.groupId || groupId,
    name: chat.title || 'مجموعة عائلية',
    description: '',
    createdBy: '',
    createdByName: 'غير متوفر',
    createdAt: '',
    members: Array.isArray(chat.participants) ? chat.participants : [],
    avatar: undefined,
  } : null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Confirmation dialogs state
  const [confirmAction, setConfirmAction] = useState<
    'CLEAR_CHAT' | 'LEAVE_GROUP' | 'DELETE_GROUP' | { type: 'REMOVE_MEMBER'; userId: string; userName: string } | null
  >(null);

  if (!isOpen || !group || !currentUser) return null;

  const isCreator = group.createdBy === currentUser.id;
  const isAdmin = currentUser.role === 'ADMIN';
  const canManageGroup = Boolean(storedGroup) && (isCreator || isAdmin);

  // Active users not currently in the group
  const nonGroupUsers = users.filter(
    (u) =>
      u.status === 'ACTIVE' &&
      !group.members.includes(u.id) &&
      (memberSearchQuery ? u.name.includes(memberSearchQuery) || u.phone.includes(memberSearchQuery) : true)
  );

  // Group members details
  const groupMembers = group.members
    .map((memberId) => users.find((u) => u.id === memberId))
    .filter(Boolean) as typeof users;

  const chatMessageCount = messages.filter((m) => m.chatId === chatId).length;

  const handleStartEdit = () => {
    setEditName(group.name);
    setEditDesc(group.description || '');
    setEditAvatar(group.avatar || '');
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    updateGroupInfo(group.id, editName, editDesc, editAvatar || undefined);
    setIsEditing(false);
  };

  const handleAddSelectedMembers = () => {
    if (selectedUserIds.length === 0) return;
    addGroupMembers(group.id, selectedUserIds);
    setSelectedUserIds([]);
    setShowAddMembers(false);
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const executeConfirmedAction = () => {
    if (!confirmAction) return;

    if (confirmAction === 'CLEAR_CHAT') {
      clearChatMessages(chatId);
      setConfirmAction(null);
    } else if (confirmAction === 'LEAVE_GROUP') {
      leaveGroup(group.id);
      setConfirmAction(null);
      onClose();
    } else if (confirmAction === 'DELETE_GROUP') {
      deleteGroup(group.id);
      setConfirmAction(null);
      onClose();
    } else if (typeof confirmAction === 'object' && confirmAction.type === 'REMOVE_MEMBER') {
      removeGroupMember(group.id, confirmAction.userId);
      setConfirmAction(null);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="معلومات المجموعة" className="fixed inset-0 z-[310] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-700 px-4 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Users className="w-5 h-5 text-teal-200" />
            <h2 className="font-bold text-sm">معلومات المجموعة العائلية</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!storedGroup && (
            <p role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              تفاصيل إدارة المجموعة غير متاحة حتى تكتمل مزامنة بياناتها. تُعرض أسماء المشاركين المعروفة حاليًا دون السماح بتعديل العضوية.
            </p>
          )}
          {/* Group Avatar & Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center relative shadow-xs">
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-3 text-right">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-teal-800">تعديل بيانات المجموعة</span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    إلغاء
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    اسم المجموعة:
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    وصف المجموعة:
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    placeholder="مثال: مجلس العائلة للتنسيق واللقاءات..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديلات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-xl text-xs transition"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-teal-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden mb-2">
                  <img
                    src={group.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(group.name)}&backgroundColor=0f766e`}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-base font-extrabold text-slate-800">{group.name}</h3>

                {group.description ? (
                  <p className="text-xs text-slate-600 mt-1 max-w-xs">{group.description}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">لا يوجد وصف للمجموعة</p>
                )}

                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                  <span className="bg-teal-50 text-teal-700 font-semibold px-2.5 py-0.5 rounded-full border border-teal-200">
                    {group.members.length} أعضاء
                  </span>
                  <span>•</span>
                  <span>أنشأها: {group.createdByName}</span>
                </div>

                {/* Edit Info Button (Creator or Admin) */}
                {canManageGroup && (
                  <button
                    onClick={handleStartEdit}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل معلومات المجموعة</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Members Management Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-700" />
                <h4 className="text-xs font-bold text-slate-800">
                  أعضاء المجموعة ({group.members.length})
                </h4>
              </div>

              {/* Add Members Button */}
              {canManageGroup && (
                <button
                  onClick={() => setShowAddMembers(!showAddMembers)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ إضافة أفراد إلى المجموعة</span>
                </button>
              )}
            </div>

            {/* Add Members Drawer / Sub-modal */}
            {showAddMembers && (
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">
                    اختر أفراد العائلة لإضافتهم:
                  </span>
                  <button
                    onClick={() => setShowAddMembers(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    إغلاق
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو رقم الجوال..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full bg-white border border-teal-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* List of candidates */}
                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-teal-100">
                  {nonGroupUsers.length === 0 ? (
                    <p className="text-center py-4 text-slate-400 text-xs">
                      جميع أفراد العائلة النشطين موجودون بالفعل في هذه المجموعة
                    </p>
                  ) : (
                    nonGroupUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleToggleSelectUser(u.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                            isSelected ? 'bg-teal-100/90 text-teal-900' : 'hover:bg-white/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <p className="text-xs font-bold">{u.name}</p>
                              <p className="text-[10px] text-slate-500">{u.phone}</p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isSelected
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {nonGroupUsers.length > 0 && (
                  <button
                    disabled={selectedUserIds.length === 0}
                    onClick={handleAddSelectedMembers}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white py-2 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    تأكيد إضافة ({selectedUserIds.length}) إلى المجموعة
                  </button>
                )}
              </div>
            )}

            {/* Current Group Members List */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {groupMembers.map((member) => {
                const isMemberCreator = member.id === group.createdBy;
                const isMemberAdmin = member.role === 'ADMIN';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-white transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                        {member.isOnline && (
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{member.name}</span>
                          {member.id === currentUser.id && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                              أنت
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span>{member.phone}</span>
                          {member.shortId && <span>• {member.shortId}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role Badges */}
                      {isMemberCreator ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          👑 منشئ المجموعة
                        </span>
                      ) : isMemberAdmin ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          🛡️ مشرف
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-100">
                          عضو
                        </span>
                      )}

                      {/* Remove Member Button (For Manager / Admin, cannot remove creator) */}
                      {canManageGroup && !isMemberCreator && member.id !== currentUser.id && (
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'REMOVE_MEMBER',
                              userId: member.id,
                              userName: member.name,
                            })
                          }
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                          title="إزالة من المجموعة"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Actions Section (خيارات إدارة المحادثة) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">خيارات إدارة المحادثة</h4>

            {/* Clear Chat History Button */}
            <button
              onClick={() => setConfirmAction('CLEAR_CHAT')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
            >
              <div className="flex items-center gap-2 text-slate-700">
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>مسح سجل الرسائل</span>
              </div>
              <span className="text-[10px] text-slate-400">{chatMessageCount} رسالة</span>
            </button>

            {/* Leave or Delete Group Button */}
            {canManageGroup ? (
              <button
                onClick={() => setConfirmAction('DELETE_GROUP')}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>حذف المجموعة نهائياً</span>
              </button>
            ) : (
              <button
                onClick={() => setConfirmAction('LEAVE_GROUP')}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition shadow-xs"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>مغادرة المجموعة</span>
              </button>
            )}
          </div>
        </div>

        {/* Universal Confirmation Modal Backdrop */}
        {confirmAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xs w-full p-4 text-center space-y-3 shadow-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {confirmAction === 'CLEAR_CHAT'
                    ? 'مسح سجل الرسائل'
                    : confirmAction === 'LEAVE_GROUP'
                    ? 'مغادرة المجموعة'
                    : confirmAction === 'DELETE_GROUP'
                    ? 'حذف المجموعة نهائياً'
                    : 'إزالة عضو'}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {confirmAction === 'CLEAR_CHAT'
                    ? 'هل أنت متأكد من مسح جميع الرسائل في هذه المجموعة؟ لا يمكن التراجع عن هذا الإجراء.'
                    : confirmAction === 'LEAVE_GROUP'
                    ? 'هل أنت متأكد من رغبتك في مغادرة هذه المجموعة؟ لن تتمكن من قراءة الرسائل إلا بدعوة جديدة.'
                    : confirmAction === 'DELETE_GROUP'
                    ? 'هل أنت متأكد من حذف هذه المجموعة نهائياً لجميع أفراد العائلة مع كامل سجل الرسائل؟'
                    : `هل أنت متأكد من إزالة "${(confirmAction as any).userName}" من هذه المجموعة؟`}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={executeConfirmedAction}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition"
                >
                  تأكيد
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-xl text-xs transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
