import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiChat } from 'react-icons/hi';
import { chatApi, userApi } from '../services/api';

interface Chat {
  id: string;
  name?: string; // Derived from participant
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  Participants?: any[];
  LastMessage?: any;
}

export default function Messages() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileData = await userApi.getMyProfile();
      const currentUser = (profileData as any).data || profileData;

      const data = await chatApi.getChats();
      const chatList = Array.isArray(data) ? data : (data as any).data || [];
      
      const processedChats = chatList.map((chat: any) => {
        const otherUser = chat.Participants?.find((p: any) => p.id !== currentUser.id) || {};
        return {
          id: chat.id,
          name: otherUser.username || '未知用户',
          avatar: otherUser.avatar,
          lastMessage: chat.LastMessage?.content || '暂无消息',
          lastMessageTime: chat.LastMessage?.CreatedAt,
          unreadCount: chat.UnreadCount || 0,
          otherUserId: otherUser.id
        };
      });

      setChats(processedChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
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
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer relative overflow-hidden transition-all"
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
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-gray-900 truncate text-base">{chat.name}</h3>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
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
