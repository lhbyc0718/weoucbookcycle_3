import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Heart, 
  Share, 
  User, 
  Star, 
  MapPin, 
  Truck, 
  MessageCircle, 
  ShoppingBag,
  ChevronDown,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  X,
  CheckCircle2
} from 'lucide-react';
import { BookItem, User as UserType } from '../data/mockData';

interface BookDetailProps {
  id: string;
  onBack: () => void;
  onChat: (sellerId: string) => void;
  onSellerClick: (sellerId: string) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  onEvaluate?: (sellerId: string, isGood: boolean) => void;
  isEvaluated?: boolean;
  book: BookItem;
  seller: UserType;
}

export const BookDetail: React.FC<BookDetailProps> = ({ 
  id, 
  onBack, 
  onChat, 
  onSellerClick,
  isWishlisted = false,
  onToggleWishlist,
  onEvaluate,
  isEvaluated = false,
  book,
  seller
}) => {
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: book.title,
      text: `看看这本书: ${book.title} by ${book.author}`,
      url: `${window.location.origin}?bookId=${book.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('链接已复制到剪贴板');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleEvaluation = (isGood: boolean) => {
    if (onEvaluate) {
      onEvaluate(book.sellerId, isGood);
      setShowEvaluateModal(false);
      alert(`感谢您的反馈!\u60a8评价卖家为${isGood ? '好评' : '差评'}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-y-auto no-scrollbar pb-24">
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[60%] h-[60%] bg-amber-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 px-4 py-4 flex items-center justify-between max-w-md mx-auto left-0 right-0">
        <button onClick={onBack} title="返回" className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-3">
          <button 
            onClick={onToggleWishlist}
            title={isWishlisted ? "从心预单移除" : "加入心预单"}
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors ${isWishlisted ? 'text-red-500' : 'text-white'}`}
          >
            <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
          <button 
            onClick={handleShare}
            title="\u5206\u4eab\u8fd9\u672c\u4e66"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors"
          >
            <Share className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hero Image */}
      <div className="relative w-full h-[55vh] flex items-end justify-center pb-12 shrink-0">
        <div className="absolute inset-0 z-0">
          <div 
            className="w-full h-full bg-center bg-cover opacity-50 blur-sm scale-110" 
            style={{ backgroundImage: `url(${book.cover})` }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/20 to-slate-950"></div>
        </div>
        
        <div className="relative z-10 shadow-2xl shadow-black/60 rounded-lg overflow-hidden w-48 aspect-[2/3] transform translate-y-8 border border-white/5">
          <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-2 relative z-10">
        <div className="relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight font-display">{book.title}</h1>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium tracking-wide uppercase text-amber-200/80">{book.author}</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {book.tags.map((tag, index) => (
                <span key={index} className="px-3 py-1 rounded-full bg-slate-800/50 border border-white/5 text-xs text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 mb-1">\u4ef7\u683c</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-amber-500">¥</span>
                <span className="text-3xl font-extrabold text-amber-500 tracking-tight font-display">{book.price.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">{book.condition}</span>
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">\u6b63\u7248</span>
            </div>
          </div>
        </div>

        {/* Seller Info */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">卖家评分</h3>
          <div 
            onClick={() => onSellerClick(book.sellerId)}
            className="bg-slate-800/40 border border-white/5 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-700">
                  <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-slate-950 rounded-full p-0.5 border-2 border-slate-950">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{seller.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-wide uppercase">\u5df2\u8ba4\u8bc1</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">\u52a0\u5165\u4e8e {seller.joinDate} \u2022 {seller.sales} \u6b21\u9500\u552e</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center text-amber-400 gap-0.5">
                <span className="text-sm font-bold text-slate-200 mr-1">{seller.rating}</span>
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
              </div>
              <span className="text-[10px] text-slate-500 mt-1">\u4fe1\u4efb\u5ea6: {seller.trustScore}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 mb-4 px-2">
          <h3 className="text-lg font-bold text-white mb-2 font-display">\u63cf\u8ff0</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            {book.description}
          </p>
          <button className="mt-2 text-indigo-400 text-sm font-medium flex items-center gap-1 hover:text-indigo-300 transition-colors">
            Read more <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Shipping */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 px-2 pb-8">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{book.location}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-600"></div>
          <div className="flex items-center gap-1">
            <Truck className="w-4 h-4" />
            <span>{book.shippingTime}</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-white/5 px-6 py-4 pb-8 z-40 max-w-md mx-auto left-0 right-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onChat(book.sellerId)}
            title="\u4e0e\u5356\u5bb6\u804a\u5929"
            className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-slate-300 font-bold bg-slate-900 shadow-lg active:scale-95 transition-all duration-200 border border-white/5"
          >
            <MessageCircle className="w-5 h-5 text-indigo-400" />
            <span>Chat</span>
          </button>
          <button 
            onClick={() => !isEvaluated && setShowEvaluateModal(true)}
            disabled={isEvaluated}
            title={isEvaluated ? "\u5df2\u8bc4\u4ef7" : "\u8bc4\u4ef7\u8fd9\u4e2a\u5356\u5bb6"}
            className={`flex-[2] h-12 rounded-xl flex items-center justify-center gap-2 font-bold shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-200 ${
              isEvaluated 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
            }`}
          >
            <span>{isEvaluated ? 'Evaluated' : 'Evaluate'}</span>
            {isEvaluated ? <CheckCircle2 className="w-5 h-5" /> : <Star className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Evaluation Modal */}
      {showEvaluateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowEvaluateModal(false)}></div>
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowEvaluateModal(false)}
              title="Close evaluation modal"
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold text-white mb-2 text-center">评价卖家</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              您与{seller.name}的交易体验如何?
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => handleEvaluation(false)}
                className="flex-1 flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-red-500/10 hover:border-red-500/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <ThumbsDown className="w-6 h-6 text-slate-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-red-400">差</span>
              </button>
              
              <button 
                onClick={() => handleEvaluation(true)}
                className="flex-1 flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-green-500/10 hover:border-green-500/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
                  <ThumbsUp className="w-6 h-6 text-slate-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-green-400">好</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
