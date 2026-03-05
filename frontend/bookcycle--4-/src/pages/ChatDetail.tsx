import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  MoreVertical, 
  PlusCircle, 
  Smile, 
  Send,
  ShoppingBag,
  X
} from 'lucide-react';
import { BookItem, User, ChatMessage, ChatSession } from '../data/mockData';

interface ChatDetailProps {
  id: string;
  onBack: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  chat: ChatSession;
  onSellerClick: (sellerId: string) => void;
  books: BookItem[];
  users: Record<string, User>;
}

export const ChatDetail: React.FC<ChatDetailProps> = ({ id, onBack, messages, onSendMessage, chat, onSellerClick, books, users }) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const emojis = ['😊', '😂', '❤️', '👍', '📚', '👋', '🤔', '🤝', '💸', '📦', '✨', '🔥', '🎉', '👀', '🙏', '💯'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showEmojiPicker]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    onSendMessage(inputText);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const book = books.find(b => b.id === chat.bookId);
  
  // Find the other participant (not 'me')
  const otherUserId = chat.participants.find(p => p !== 'me') || 'alex';
  const otherUser = users[otherUserId];

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-0 right-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=1200&fit=crop')] bg-cover bg-center opacity-10 blur-3xl scale-110 pointer-events-none"></div>
      <div className="absolute top-20 left-10 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none"></div>
      
      <header className="sticky top-0 z-50 px-4 pt-4 pb-3 flex items-center justify-between bg-slate-900/60 backdrop-blur-xl border-b border-white/5 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onBack} title="\u8fd4\u56de" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors group">
            <ChevronLeft className="w-6 h-6 text-slate-200 group-hover:text-white" />
          </button>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSellerClick(otherUserId)}
          >
            <div className="relative">
              <img src={otherUser.avatar} alt={otherUser.name} className="w-10 h-10 rounded-full border-2 border-white/10 object-cover shadow-md" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white flex items-center gap-1">
                {otherUser.name}
                {otherUser.verified && <span className="text-[10px] text-amber-400">★</span>}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium tracking-wide">\u5728\u7ebf</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button title="联系买家" className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all backdrop-blur-md hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <span>立即购买</span>
            <ShoppingBag className="w-3 h-3" />
          </button>
          <button title="\u66f4\u591a\u9009\u9879" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <MoreVertical className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </header>

      <main className="flex-grow z-10 overflow-y-auto no-scrollbar pt-4 pb-4 px-4 flex flex-col gap-6">
        <div className="flex justify-center my-2">
          <span className="px-3 py-1 rounded-full bg-slate-800/40 backdrop-blur-md text-[10px] text-slate-400 font-medium border border-white/5 shadow-sm">\u4eca\u5929 10:23</span>
        </div>

        {book && (
          <div className="flex justify-start w-full">
            <div className="bg-slate-800/40 backdrop-blur-xl p-3 rounded-3xl rounded-tl-sm max-w-[85%] border border-white/10 shadow-xl">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-lg relative group cursor-pointer">
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex flex-col justify-center">
                  <h4 className="text-sm font-bold text-slate-200 leading-tight line-clamp-2">{book.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">{book.author}</p>
                  <p className="text-amber-400 font-bold text-sm mt-1">¥{book.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="w-full h-[1px] bg-white/5 mb-2"></div>
              <p className="text-xs text-slate-300 font-light">\u5609!\u6211\u770b\u5230\u4f60\u5bf9\u8fd9\u672c\u4e66\u611f\u5174\u8da3\u3002\u5b83\u4ecd\u5f88\u53ef\u7528\u3002</p>
            </div>
          </div>
        )}

        {messages.slice(1).map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[85%] p-4 rounded-3xl shadow-lg backdrop-blur-xl border border-white/5 ${
              msg.senderId === 'me' 
                ? 'bg-indigo-600/30 rounded-tr-sm text-right border-indigo-500/20' 
                : 'bg-slate-800/40 rounded-tl-sm'
            }`}>
              <p className="text-sm text-slate-200 leading-relaxed font-light">{msg.text}</p>
              <span className={`text-[9px] text-slate-500/80 absolute -bottom-4 ${msg.senderId === 'me' ? 'right-1' : 'left-1'}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <div className="z-50 px-4 py-3 pb-8 bg-slate-900/80 backdrop-blur-2xl border-t border-white/5 mx-auto w-full shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {/* Quick Replies */}
        <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
          {['\u4eca\u5929\u80fd\u53d1\u8d27\u5417?', '\u4ef7\u683c\u53ef\u4ee5\u8c08\u5417?', '\u6709\u66f4\u591a\u7167\u7247\u5417?'].map((text, i) => (
            <button 
              key={i} 
              onClick={() => setInputText(text)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 hover:border-indigo-500/30 hover:text-indigo-300 transition-all backdrop-blur-md whitespace-nowrap active:scale-95"
            >
              {text}
            </button>
          ))}
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mb-3 p-3 bg-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  title={`Add ${emoji} emoji`}
                  className="text-xl hover:bg-white/10 p-1.5 rounded-lg transition-colors active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button title="Add attachment" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-indigo-400 hover:bg-white/10 transition-all flex-shrink-0 backdrop-blur-sm active:scale-95">
            <PlusCircle className="w-5 h-5" />
          </button>
          
          <div className="flex-grow relative group">
            <textarea 
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-4 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none overflow-hidden backdrop-blur-sm shadow-inner transition-all" 
              placeholder="\u8f93\u5165\u6d88\u606f..." 
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
            ></textarea>
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title={showEmojiPicker ? "Close emoji picker" : "Open emoji picker"}
              className={`absolute right-3 bottom-2.5 transition-colors ${showEmojiPicker ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
            >
              {showEmojiPicker ? <X className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
            </button>
          </div>
          
          <button 
            onClick={handleSend}
            title="Send message"
            className={`w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-95 transition-all flex-shrink-0 border border-white/10 ${!inputText.trim() ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
            disabled={!inputText.trim()}
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
