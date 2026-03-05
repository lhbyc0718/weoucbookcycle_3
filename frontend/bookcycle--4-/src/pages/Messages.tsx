import React, { useState } from 'react';
import { Search } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { User, ChatSession } from '../data/mockData';

interface MessagesProps {
  onChatClick: (id: string) => void;
  chats: ChatSession[];
  users: Record<string, User>;
  onShowInstructions?: () => void;
  onUserClick?: (userId: string) => void;
}

export const Messages: React.FC<MessagesProps> = ({ onChatClick, chats, users, onShowInstructions, onUserClick }) => {
  const activeUsers = Object.values(users).filter((u: any) => 
    u.id !== 'me'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter(chat => {
    const otherUserId = chat.participants.find(p => p !== 'me') || 'alex';
    const otherUser = users[otherUserId];
    return otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 pb-24 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-0 right-0 w-full h-96 bg-indigo-900/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-full h-96 bg-purple-900/10 blur-[100px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

      <header className="px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white font-display tracking-tight">消息</h1>
          <NotificationBell count={0} onClick={onShowInstructions} title="使用说明" />
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜索消息..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 relative z-10">
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">在线用户</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {activeUsers.map((user: any) => (
              <div 
                key={user.id} 
                className="flex flex-col items-center gap-2 min-w-[64px] cursor-pointer"
                onClick={() => onUserClick && onUserClick(user.id)}
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="w-full h-full rounded-full object-cover border-2 border-slate-950"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full"></div>
                </div>
                <span className="text-xs font-medium text-slate-300 truncate w-full text-center">{user.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">最近聊天</h2>
          <div className="space-y-3">
            {filteredChats.map((chat) => {
              const otherUserId = chat.participants.find(p => p !== 'me') || 'alex';
              const otherUser = users[otherUserId];
              
              return (
                <button 
                  key={chat.id}
                  onClick={() => onChatClick(chat.id)}
                  className="w-full bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition-all group active:scale-[0.98]"
                >
                  <div className="relative">
                    <img 
                      src={otherUser.avatar} 
                      alt={otherUser.name} 
                      className="w-14 h-14 rounded-2xl object-cover"
                    />
                    {chat.unreadCount > 0 && (
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-indigo-500 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-white">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors truncate pr-2">{otherUser.name}</h3>
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{chat.lastMessageTime}</span>
                    </div>
                    <p className={`text-sm truncate ${chat.unreadCount > 0 ? 'text-slate-300 font-medium' : 'text-slate-500'}`}>
                      {chat.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
