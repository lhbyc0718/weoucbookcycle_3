import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiChat } from 'react-icons/hi';
import { chatApi, userApi } from '../services/api';
import { wsService } from '../services/websocket';

interface Chat {
  hasUnreadTx: any;
  id: string;
  name?: string; // Derived from participant
  avatar?: string;
  otherUserId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  Participants?: any[];
  LastMessage?: any;
  txStatus?: string;
  txSender?: string;
}

export default function Messages() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  // Keep a ref to chats to access them in the event listener without re-subscribing
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    loadData();
    wsService.connect();

    const handleNewMessage = (data: any) => {
        // If it's a chat_created event, reload data
        if (data.type === 'chat_created') {
            loadData();
            return;
        }

        const currentChats = chatsRef.current;
        // The backend might send 'chat_id' or 'id'
        const chatId = data.chat_id || data.id;
        const chatIndex = currentChats.findIndex(c => c.id === chatId);

        if (chatIndex > -1) {
             setChats(prevChats => {
                const idx = prevChats.findIndex(c => c.id === chatId);
                if (idx === -1) return prevChats;

                let lastContent = data.content;
                if (data.msg_type === 'image') lastContent = '[图片]';
                else if (data.msg_type === 'emoji') lastContent = '[表情]';
                
                // 只有当消息不是自己发送的时，才增加未读数
                const isMyMessage = data.sender_id === (userApi.getCurrentUser()?.id || '');
                const newUnreadCount = isMyMessage ? (prevChats[idx].unreadCount || 0) : ((prevChats[idx].unreadCount || 0) + 1);

                const updatedChat = {
                    ...prevChats[idx],
                    lastMessage: lastContent,
                    lastMessageTime: data.created_at || new Date().toISOString(),
                    unreadCount: newUnreadCount
                };
                
                const newChats = [...prevChats];
                newChats.splice(idx, 1);
                return [updatedChat, ...newChats];
             });
        } else {
            // New chat found
            loadData();
        }
    };

    wsService.subscribe('message', handleNewMessage);
    
    return () => {
        wsService.unsubscribe('message', handleNewMessage);
    };
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await userApi.getMyProfile();
      const currentUser = (profileRes as any).data || profileRes;
      const uid = String(currentUser.id || currentUser.ID);
      setCurrentUserId(uid);

      const data = await chatApi.getChats();
      // ... (rest of loadData)处理多种返回格式
      let chatList: any[] = [];
      if (Array.isArray(data)) {
        chatList = data;
      } else if ((data as any).chats) {
        chatList = (data as any).chats;
      } else if ((data as any).data) {
        const dataField = (data as any).data;
        chatList = Array.isArray(dataField) ? dataField : (dataField.chats || []);
      }
      
      const processedChats = chatList.map((item: any) => {
        // 处理ChatResponse结构（后端新返回格式）
        const chat = item.chat || item;
        const unreadCount = typeof item.unread_count !== 'undefined' ? item.unread_count : 
                           (typeof (item as any).UnreadCount !== 'undefined' ? (item as any).UnreadCount : 0);
        
        // 获取聊天用户列表
        const users = (chat.users || chat.Users || []);
        
        // 查找不是当前用户的另一个参与者
        const otherChatUser = users.find((u: any) => {
            const uid = u.user_id || u.id || u.UserID;
            return String(uid) !== String(currentUser.id);
        });
        
        const otherUser = otherChatUser?.user || otherChatUser?.User || otherChatUser;

        const hasUnreadTx = !!(item.has_unread_transaction || item.HasUnreadTransaction || chat.has_unread_transaction || chat.HasUnreadTransaction);

        return {
          id: chat.id || chat.ID,
          name: otherUser?.username || otherUser?.Username || '未知用户',
          avatar: otherUser?.avatar || otherUser?.Avatar,
          lastMessage: chat.last_message || chat.LastMessage || '暂无消息',
          lastMessageTime: chat.updated_at || chat.UpdatedAt || chat.updated_at_ts,
          unreadCount: unreadCount || 0,
          otherUserId: otherUser?.id || otherUser?.ID || otherChatUser?.user_id || otherChatUser?.id || otherChatUser?.UserID,
          hasUnreadTx,
          // 增加交易状态和发起者ID用于显示红标
          txStatus: item.active_transaction_status || chat.active_transaction_status || '',
          txSender: item.active_transaction_sender || chat.active_transaction_sender || ''
        };
      }).sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });

      setChats(processedChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await chatApi.deleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
    } catch (e) {
      console.error('删除会话失败', e);
      alert('删除会话失败：' + (e as any).message);
    }
  };

  const handleClearMessages = async (chatId: string) => {
    try {
      await chatApi.clearMessages(chatId);
      // No need to remove chat entry; optionally show a notice
      alert('已清空聊天记录');
    } catch (e) {
      console.error('清空聊天记录失败', e);
      alert('清空聊天记录失败：' + (e as any).message);
    }
  };

  const handleBlockUser = async (userId: string, chatId?: string) => {
    try {
      await userApi.blockUser(userId);
      // Remove chats with that user from list
      if (chatId) setChats(prev => prev.filter(c => c.id !== chatId));
      alert('已拉黑用户');
    } catch (e) {
      console.error('拉黑失败', e);
      alert('拉黑失败：' + (e as any).message);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-0">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-30 md:hidden">
        <h1 className="text-lg font-bold">消息</h1>
      </div>

      <div className="md:max-w-2xl md:mx-auto md:py-8">
        <h1 className="text-2xl font-bold mb-6 hidden md:block px-4 md:px-0">消息中心</h1>
        
        <div className="p-4 md:p-0 space-y-3">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl flex gap-3 animate-pulse border border-gray-100">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 w-1/3 rounded" />
                  <div className="h-3 bg-gray-200 w-2/3 rounded" />
                </div>
              </div>
            ))
          ) : chats.length > 0 ? (
            chats.map((chat) => (
              <motion.div
                key={chat.id}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                onClick={() => navigate(`/chats/${chat.id}`)}
                role="button"
                tabIndex={0}
                aria-label={`进入与 ${chat.name} 的聊天`}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer relative transition-all"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {chat.avatar ? (
                      <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold">
                        {chat.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                      {chat.unreadCount}
                    </div>
                  ) : null}
                    {chat.hasUnreadTx ? (
                      <div className="absolute -bottom-0 -right-0 translate-x-1/2 translate-y-1/2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white">交易</div>
                    ) : null}
                </div>

                {/* Ellipsis menu */}
                <div className="absolute top-2 right-2 z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); const menu = document.getElementById(`menu-${chat.id}`); if (menu) menu.classList.toggle('hidden'); }}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                    aria-label="更多操作"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm7 0a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  </button>

                  <div id={`menu-${chat.id}`} className="hidden origin-top-right absolute right-0 mt-2 w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('确认删除会话？（仅删除会话条，保留消息）')) handleDeleteChat(chat.id); const menu = document.getElementById(`menu-${chat.id}`); if (menu) menu.classList.add('hidden'); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">删除会话</button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('确认清空聊天记录？此操作不可恢复。')) handleClearMessages(chat.id); const menu = document.getElementById(`menu-${chat.id}`); if (menu) menu.classList.add('hidden'); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">清空记录</button>
                      {chat.otherUserId && (
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('确认拉黑该用户？拉黑后将看不到对方的书籍，并且对方将无法向你发送消息。')) handleBlockUser(chat.otherUserId!, chat.id); const menu = document.getElementById(`menu-${chat.id}`); if (menu) menu.classList.add('hidden'); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">拉黑用户</button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-gray-900 truncate text-base">{chat.name}</h3>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {(() => {
                        if (chat.lastMessage && chat.lastMessage.startsWith('{')) {
                            try {
                                const obj = JSON.parse(chat.lastMessage);
                                if (obj.transaction_id || obj.listing_id) {
                                    const status = chat.txStatus;
                                    const senderId = chat.txSender;
                                    const isMeSender = String(senderId) === String(currentUserId);
                                    const isCompleted = status === 'completed';
                                    const isCancelled = status === 'cancelled';
                                    
                                    if (isCompleted || isCancelled) {
                                        return <span className="text-gray-400">[交易]</span>;
                                    }

                                    // 卖家视角
                                    if (!isMeSender) {
                                        if (status === 'pending') return <><span className="text-red-500 font-bold">[还未确认交易]</span>{obj.title || '商品'}</>;
                                        if (status === 'in_progress') return <><span className="text-red-500 font-bold">[还未完成的交易]</span>{obj.title || '商品'}</>;
                                    } else {
                                        // 买家视角
                                        if (status === 'pending') return <><span className="text-red-500 font-bold">[卖家还未确认交易]</span>{obj.title || '商品'}</>;
                                        if (status === 'in_progress') return <><span className="text-red-500 font-bold">[还未确认收书交易]</span>{obj.title || '商品'}</>;
                                    }
                                    return <span className="text-blue-500">[交易] {obj.title || '商品'}</span>;
                                }
                            } catch(e) {}
                        }
                        return chat.lastMessage;
                    })()}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <HiChat className="text-2xl text-gray-300" />
              </div>
              <p>暂无消息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
