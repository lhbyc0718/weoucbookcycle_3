import React, { useState } from 'react';
import { Search, ScanLine, Grid, List, ChevronRight, Book, GraduationCap, Coffee, Sparkles, QrCode } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { BookItem } from '../data/mockData';
import { BookCard } from '../components/BookCard';

interface HomeProps {
  onBookClick: (id: string) => void;
  wishlist?: string[];
  onToggleWishlist?: (id: string) => void;
  onShowInstructions?: () => void;
  books: BookItem[];
}

export const Home: React.FC<HomeProps> = ({ onBookClick, wishlist = [], onToggleWishlist, onShowInstructions, books }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.isbn && book.isbn.includes(searchQuery));
    
    const matchesCategory = selectedCategory 
      ? (book.category === selectedCategory || (book.tags && book.tags.includes(selectedCategory)))
      : true;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'Used Books', label: '二手书', icon: Book, color: 'from-orange-400 to-pink-500' },
    { id: 'Textbook', label: '教材', icon: GraduationCap, color: 'from-blue-400 to-indigo-500' },
    { id: 'Non-Textbook', label: '非教材', icon: Coffee, color: 'from-emerald-400 to-teal-500' },
    { id: 'New Book', label: '新书', icon: Sparkles, color: 'from-purple-400 to-fuchsia-500' },
    { id: 'QR Code for English Books', label: '外文书', icon: QrCode, color: 'from-slate-400 to-slate-600' },
  ];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-display">
            <span className="text-indigo-500 text-2xl">BookCycle</span>
          </h1>
          <NotificationBell count={0} onClick={onShowInstructions} title="使用说明" />
        </div>
        
        <div className="relative flex items-center w-full group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            className="block w-full py-3.5 pl-11 pr-12 text-sm text-slate-200 rounded-2xl bg-slate-800/50 border border-white/5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 placeholder-slate-500 transition-all outline-none" 
            placeholder="搜索书名、ISBN或作者..." 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button title="扫描ISBN条形码" className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-indigo-400 transition-colors">
              <ScanLine className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Carousel - Only show if no search query and no category selected */}
      {!searchQuery && !selectedCategory && (
        <section className="w-full overflow-hidden px-4">
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory">
            <div className="snap-center shrink-0 w-[90%] relative rounded-3xl overflow-hidden shadow-2xl shadow-black/50 group cursor-pointer h-48 border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent z-10"></div>
              <img 
                alt="Library" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" 
                src="https://images.unsplash.com/photo-1507842217343-583bb7260b66?w=800&h=400&fit=crop" 
              />
              <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 animate-pulse"></span>
                    精选
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5 font-display tracking-tight">暑期阅读清单</h2>
                <p className="text-sm text-slate-200 font-medium opacity-90">精选书籍本周折扣高达20%</p>
              </div>
            </div>
            
            <div className="snap-center shrink-0 w-[90%] relative rounded-3xl overflow-hidden shadow-2xl shadow-black/50 group cursor-pointer h-48 border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent z-10"></div>
              <img 
                alt="Books" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" 
                src="https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=400&fit=crop" 
              />
              <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/30 text-amber-200 border border-amber-500/30 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></span>
                    热销商家
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5 font-display tracking-tight">认证卖家</h2>
                <p className="text-sm text-slate-200 font-medium opacity-90">高信任度和快速发货</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categories - Only show if no search query */}
      {!searchQuery && (
        <section className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-100 font-display">分类</h3>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button 
                  key={idx} 
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 transform transition-all duration-300 group-hover:-translate-y-1 group-active:scale-95 relative overflow-hidden
                    ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''}
                  `}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                    <div className="absolute inset-0 backdrop-blur-xl bg-white/5"></div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                    
                    {/* Glass Shine Effect */}
                    <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/20 to-transparent rotate-45 transform translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                    
                    <Icon className={`w-6 h-6 text-white relative z-10 drop-shadow-md ${isSelected ? 'scale-110' : ''}`} />
                  </div>
                  <span className={`text-[10px] font-medium transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Fresh Arrivals / Search Results */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            {searchQuery ? '搜索结果' : (selectedCategory ? `${selectedCategory}` : '最新上架')}
            {!searchQuery && !selectedCategory && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
            )}
          </h3>
          {!searchQuery && (
            <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-white/5">
              <button title="网格视图" className="p-1.5 rounded-md bg-white/10 text-white shadow-sm">
                <Grid className="w-4 h-4" />
              </button>
              <button title="列表视图" className="p-1.5 rounded-md text-slate-500 hover:text-white transition-colors">
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {filteredBooks.map(book => (
            <BookCard 
              key={book.id} 
              book={book} 
              onClick={onBookClick} 
              isWishlisted={wishlist.includes(book.id)}
              onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(book.id) : undefined}
            />
          ))}
          {filteredBooks.length === 0 && (
            <div className="col-span-2 text-center py-12 text-slate-500">
              <p>没有找到符合条件的书籍</p>
              {selectedCategory && (
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="mt-2 text-indigo-400 text-sm hover:underline"
                >
                  清除分类筛选
                </button>
              )}
            </div>
          )}
        </div>
        
        {!searchQuery && !selectedCategory && (
          <div className="mt-8 mb-6 text-center">
            <button className="px-8 py-3 rounded-full border border-white/10 bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-all active:scale-95">
              加载更多书籍
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
