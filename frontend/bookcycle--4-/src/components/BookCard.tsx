import React from 'react';
import { BookItem, users } from '../data/mockData';
import { CheckCircle2, Share, Heart } from 'lucide-react';

interface BookCardProps {
  book: BookItem;
  onClick: (id: string) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (e: React.MouseEvent) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onClick, isWishlisted = false, onToggleWishlist }) => {
  const seller = users[book.sellerId];

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: book.title,
      text: `Check out this book: ${book.title} by ${book.author}`,
      url: `${window.location.origin}?bookId=${book.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div 
      onClick={() => onClick(book.id)}
      className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-3 flex flex-col border border-white/5 active:scale-[0.98] transition-all duration-200 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-indigo-500/5 group cursor-pointer relative"
    >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-slate-800 shadow-inner">
        <img 
          src={book.cover} 
          alt={book.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        />
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-white border border-white/10 shadow-sm">
          {book.condition}
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
          <button 
            onClick={handleShare}
            className="p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-white/20 transition-colors border border-white/10"
          >
            <Share className="w-3.5 h-3.5" />
          </button>
          {onToggleWishlist && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(e);
              }}
              className={`p-1.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-white/20 transition-colors border border-white/10 ${isWishlisted ? 'text-red-500' : 'text-white'}`}
            >
              <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <h4 className="text-sm font-semibold text-slate-100 line-clamp-2 mb-1 leading-snug group-hover:text-indigo-300 transition-colors font-display">
          {book.title}
        </h4>
        <p className="text-xs text-slate-400 mb-3 line-clamp-1">{book.author}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="text-amber-400 font-bold text-lg font-display">¥{book.price}</span>
          <div className="flex items-center gap-1 bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-200">\u5df2\u8ba4\u8bc4</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
        <img 
          src={seller.avatar} 
          alt={seller.name} 
          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10" 
        />
        <span className="text-[10px] text-slate-400 truncate font-medium">{seller.name}</span>
      </div>
    </div>
  );
};
