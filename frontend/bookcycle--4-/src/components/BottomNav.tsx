import React from 'react';
import { 
  Home, 
  LayoutGrid, 
  Plus, 
  MessageCircle, 
  User 
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 pb-safe pt-2 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-end justify-around px-2 pb-4 max-w-md mx-auto">
        <button 
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1.5 p-2 w-16 group ${activeTab === 'home' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <Home className={`w-6 h-6 transition-transform ${activeTab === 'home' ? 'scale-110' : 'group-active:scale-90'}`} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">首页</span>
        </button>

        <button 
          onClick={() => onTabChange('market')}
          className={`flex flex-col items-center gap-1.5 p-2 w-16 group ${activeTab === 'market' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <LayoutGrid className={`w-6 h-6 transition-transform ${activeTab === 'market' ? 'scale-110' : 'group-active:scale-90'}`} strokeWidth={activeTab === 'market' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">市\u573a</span>
        </button>

        <button 
          onClick={() => onTabChange('post')}
          className="relative -top-6 flex flex-col items-center group"
        >
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-[0_8px_16px_rgba(79,70,229,0.4)] border-4 border-slate-950 transition-transform group-active:scale-95 group-hover:-translate-y-1">
            <Plus className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-slate-300 mt-1">发\u5e03</span>
        </button>

        <button 
          onClick={() => onTabChange('messages')}
          className={`flex flex-col items-center gap-1.5 p-2 w-16 group ${activeTab === 'messages' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <div className="relative">
            <MessageCircle className={`w-6 h-6 transition-transform ${activeTab === 'messages' ? 'scale-110' : 'group-active:scale-90'}`} strokeWidth={activeTab === 'messages' ? 2.5 : 2} />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-slate-900"></span>
          </div>
          <span className="text-[10px] font-medium">消\u606f</span>
        </button>

        <button 
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1.5 p-2 w-16 group ${activeTab === 'profile' ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <User className={`w-6 h-6 transition-transform ${activeTab === 'profile' ? 'scale-110' : 'group-active:scale-90'}`} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">简\u4ecb</span>
        </button>
      </div>
    </nav>
  );
};
