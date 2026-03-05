import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiPaperAirplane } from 'react-icons/hi';
import { chatApi, userApi } from '../services/api';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');
  
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [targetUser, setTargetUser] = useState<any>(null);

  useEffect(() => {
    initChat();
  }, [id, targetUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initChat = async () => {
    try {
      const profileData = await userApi.getMyProfile();
      const currentUser = (profileData as any).data || profileData;
      setCurrentUserId(currentUser.id);

      if (id === 'new' && targetUserId) {
        try {
          const userRes = await userApi.getUser(targetUserId);
          const userData = (userRes as any).data || userRes;
          setTargetUser(userData);
        } catch (e) { console.error(e); }

        const chatsRes = await chatApi.getChats();
        const chats = Array.isArray(chatsRes) ? chatsRes : (chatsRes as any).data || [];
        const existingChat = chats.find((c: any) => 
          c.Participants?.some((p: any) => p.id === targetUserId)
        );

        if (existingChat) {
          navigate(`/chats/${existingChat.id}`, { replace: true });
          return;
        }
        
        setLoading(false);
      } else if (id && id !== 'new') {
        const chatRes = await chatApi.getChat(id);
        const chatData = (chatRes as any).data || chatRes;
        
        const other = chatData.Participants?.find((p: any) => p.id !== currentUser.id);
        if (other) setTargetUser(other);

        const msgsRes = await chatApi.getMessages(id);
        const msgs = Array.isArray(msgsRes) ? msgsRes : (msgsRes as any).data || [];
        setMessages(msgs);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to init chat:', error);
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      if (id && id !== 'new') {
        await chatApi.sendMessage(id, { content: newMessage });
        setMessages([...messages, {
          id: Date.now().toString(),
          sender_id: currentUserId,
          content: newMessage,
          created_at: new Date().toISOString()
        }]);
        setNewMessage('');
      } else if (targetUserId) {
         alert("暂不支持新建会话，请先在后端创建会话");
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="bg-gray-50 h-screen flex flex-col md:bg-gray-100 md:p-8">
      <div className="flex-1 flex flex-col bg-white md:max-w-4xl md:mx-auto md:rounded-2xl md:shadow-lg md:border md:border-gray-200 overflow-hidden w-full">
        {/* Header */}
        <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3 z-10 border-b border-gray-100">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <HiArrowLeft className="text-xl" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
              {targetUser?.avatar ? (
                <img src={targetUser.avatar} alt={targetUser.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-xs">
                  {targetUser?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="font-bold text-gray-800">{targetUser?.username || 'Chat'}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {loading ? (
            <div className="text-center text-gray-400 py-10">加载中...</div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white p-4 border-t border-gray-200 flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="发送消息..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition-all border border-transparent focus:border-blue-200"
          />
          <button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="p-3 bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
          >
            <HiPaperAirplane className="transform rotate-90 text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
