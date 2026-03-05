import React, { useState } from 'react';
import { Search, Filter, ChevronDown, X } from 'lucide-react';
import { BookItem } from '../data/mockData';
import { BookCard } from '../components/BookCard';

interface MarketProps {
  onBookClick: (id: string) => void;
  wishlist?: string[];
  onToggleWishlist?: (id: string) => void;
  books: BookItem[];
}

export const Market: React.FC<MarketProps> = ({ onBookClick, wishlist = [], onToggleWishlist, books }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Derived data for filters
  const categories = [
    'Used Books', 
    'Textbook', 
    'Non-Textbook', 
    'New Book', 
    'QR Code for English Books'
  ];
  const conditions = Array.from(new Set(books.map(b => b.condition)));
  const locations = Array.from(new Set(books.map(b => b.location)));

  // Filter logic
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.isbn && book.isbn.includes(searchQuery));
    
    const matchesCategory = selectedCategory 
      ? (book.category === selectedCategory || (book.tags && book.tags.includes(selectedCategory)))
      : true;
    const matchesCondition = selectedCondition ? book.condition === selectedCondition : true;
    const matchesLocation = selectedLocation ? book.location === selectedLocation : true;

    return matchesSearch && matchesCategory && matchesCondition && matchesLocation;
  });

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedCondition(null);
    setSelectedLocation(null);
    setShowFilters(false);
  };

  const activeFilterCount = [selectedCategory, selectedCondition, selectedLocation].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full pb-24 relative">
      <header className="sticky top-0 z-30 px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="relative flex items-center w-full group mb-3">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            className="block w-full py-3 pl-11 pr-4 text-sm text-slate-200 rounded-xl bg-slate-800/50 border border-white/5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 placeholder-slate-500 transition-all outline-none" 
            placeholder="\u641c\u7d22\u4e66\u540d\u3001\u4f5c\u8005\u6216ISBN..." 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex-shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'bg-indigo-600 border-indigo-500 text-white' 
                : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-3 h-3" />
            \u7b5b\u9009 {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-900 border border-white/10 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">\u6240\u6709\u7b5b\u9009</h3>
              <button onClick={clearFilters} className="text-xs text-indigo-400 hover:text-indigo-300">
                \u6e05\u9664\u5168\u90e8
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-2 block">\u5206\u7c7b</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        selectedCategory === cat
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-2 block">\u4e66\u7c4d\u72b6\u51b5</label>
                <div className="flex flex-wrap gap-2">
                  {conditions.map(cond => (
                    <button
                      key={cond}
                      onClick={() => setSelectedCondition(selectedCondition === cond ? null : cond)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        selectedCondition === cond
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-2 block">\u5730\u533a</label>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <button
                      key={loc}
                      onClick={() => setSelectedLocation(selectedLocation === loc ? null : loc)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        selectedLocation === loc
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="px-4 pt-4 pb-20 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-400">{filteredBooks.length} \u4e2a\u7ed3\u679c</span>
          <button className="flex items-center gap-1 text-xs text-indigo-400 font-medium">
            \u6392\u5e8f: \u6700\u4f73\u5339\u914d <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pb-4">
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
              <p>\u6ca1\u6709\u627e\u5230\u7b26\u5408\u6761\u4ef6\u7684\u4e66\u7c4d\u3002</p>
              <button onClick={clearFilters} className="text-indigo-400 text-sm mt-2 hover:underline">
                \u6e05\u9664\u7b5b\u9009
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
