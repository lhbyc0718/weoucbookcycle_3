import React from 'react';
import { X, Bell, ShieldCheck, ShoppingBag, MessageCircle, Star } from 'lucide-react';

interface UsageInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsageInstructionsModal: React.FC<UsageInstructionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto no-scrollbar">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white font-display text-center">欢迎来到 BookCycle</h2>
          <p className="text-slate-400 text-sm text-center mt-1">安全且便捷的二手书交易指南</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white">买卖图书</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              浏览个人书目或发布自己的书籍。使用聊天功能与卖家/买家直接沟通。
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white">信任度系统</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              每位用户初始信任度为 <span className="text-amber-400 font-bold">100</span>。请诚信交易以维持良好信誉。
            </p>
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-300 font-medium">
                ⚠️ 警告：如果你的信任度降至 <span className="font-bold">60 或以下</span>，你的账号将被限制，违规物品将被删除。
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white">评价</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              交易后请为卖家评分。
              <br/>
              <span className="text-red-400">差评</span> 会扣减卖家 <span className="font-bold">10</span> 点信任度。
              <br/>
              <span className="text-green-400">好评</span> 有助于维持他们的声誉。
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
        >
          明白了，开始使用！
        </button>
      </div>
    </div>
  );
};
