import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiSearch, HiFilter, HiX } from 'react-icons/hi';
import { bookApi, searchApi } from '../services/api';
import clsx from 'clsx';

interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  price: number;
  condition: string;
  category: string;
  sellerId: string;
  views?: number;
}

export default function Market() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';
  
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [loading, setLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Advanced filters
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [condition, setCondition] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    loadBooks();
  }, [category, condition, sortBy]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category !== 'All') params.category = category;
      if (condition !== 'All') params.condition = condition;
      params.sort = sortBy;
      
      const data = await bookApi.getBooks(params);
      const bookList = Array.isArray(data) ? data : (data as any).data || [];
      
      const filtered = bookList.filter((b: Book) => 
        b.price >= priceRange[0] && b.price <= priceRange[1]
      );
      
      setBooks(filtered);
    } catch (error) {
      console.error('Failed to load books:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadBooks();
      return;
    }
    setLoading(true);
    try {
      const data = await searchApi.search(searchQuery);
      const results = Array.isArray(data) ? data : (data as any).data || [];
      setBooks(results);
    } catch (error) {
      console.error('Search failed:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', '教材', '考研', '文学', '小说', '历史', '科学', '商业', '艺术'];
  const conditions = ['All', '全新', '几乎全新', '轻微使用', '有使用痕迹'];

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-bold mb-3 text-sm text-gray-800">分类</h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm transition-colors border",
                category === cat 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              {cat === 'All' ? '全部' : cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-bold mb-3 text-sm text-gray-800">排序</h4>
        <div className="flex flex-col gap-2">
           {[
             { value: 'newest', label: '最新发布' },
             { value: 'price_asc', label: '价格从低到高' },
             { value: 'price_desc', label: '价格从高到低' }
           ].map((opt) => (
             <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
               <div className={clsx(
                 "w-4 h-4 rounded-full border flex items-center justify-center",
                 sortBy === opt.value ? "border-blue-600" : "border-gray-300 group-hover:border-blue-400"
               )}>
                 {sortBy === opt.value && <div className="w-2 h-2 rounded-full bg-blue-600" />}
               </div>
               <input 
                 type="radio" 
                 name="sort" 
                 className="hidden" 
                 checked={sortBy === opt.value}
                 onChange={() => setSortBy(opt.value)}
               />
               <span className={clsx("text-sm", sortBy === opt.value ? "text-blue-600 font-medium" : "text-gray-600")}>{opt.label}</span>
             </label>
           ))}
        </div>
      </div>

      <div>
        <h4 className="font-bold mb-3 text-sm text-gray-800">书籍状况</h4>
        <div className="flex flex-wrap gap-2">
          {conditions.map((c) => (
            <button 
              key={c}
              onClick={() => setCondition(c)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                condition === c 
                  ? "bg-blue-50 text-blue-600 border-blue-200" 
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              {c === 'All' ? '不限' : c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-bold mb-3 text-sm text-gray-800">价格区间 (¥)</h4>
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            value={priceRange[0]}
            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
            className="w-24 p-2 border border-gray-200 rounded-lg text-center text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <span className="text-gray-400">-</span>
          <input  
            type="number" 
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-24 p-2 border border-gray-200 rounded-lg text-center text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
      
      <div className="pt-4 border-t border-gray-100 flex gap-3">
        <button 
          onClick={() => {
            setCategory('All');
            setCondition('All');
            setPriceRange([0, 1000]);
            setSortBy('newest');
          }}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
        >
          重置
        </button>
        <button 
          onClick={() => {
            loadBooks();
            setShowMobileFilters(false);
          }}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          确认
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Mobile Search Header */}
      <div className="md:hidden sticky top-0 z-30 bg-white shadow-sm">
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <HiSearch className="text-gray-400 text-lg" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full leading-5 bg-gray-100 text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm"
              placeholder="搜索书籍..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button 
            onClick={() => setShowMobileFilters(true)}
            className="p-2 text-gray-500 hover:text-blue-600 active:bg-gray-100 rounded-full"
          >
            <HiFilter className="text-xl" />
          </button>
        </div>
        
        {/* Mobile Horizontal Category Scroll */}
        <div className="px-4 pb-3 flex overflow-x-auto gap-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === cat 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'All' ? '全部' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-8 md:items-start">
        {/* Desktop Filter Sidebar */}
        <div className="hidden md:block md:col-span-3 lg:col-span-3 sticky top-24 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="mb-6">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HiSearch className="text-gray-400 text-lg" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition sm:text-sm"
                  placeholder="搜索书籍..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
          </div>
          <FilterContent />
        </div>

        {/* Book Grid */}
        <div className="md:col-span-9 lg:col-span-9">
           {/* Desktop Sort Bar */}
           <div className="hidden md:flex justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
             <span className="text-gray-500 text-sm">共找到 <span className="font-bold text-gray-900">{books.length}</span> 本书籍</span>
             <div className="flex items-center gap-4">
               <span className="text-sm text-gray-500">当前分类: <span className="text-blue-600 font-medium">{category === 'All' ? '全部' : category}</span></span>
             </div>
           </div>

           <div className="p-4 md:p-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-gray-100">
                  <div className="h-40 bg-gray-200 rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : books.length > 0 ? (
              books.map((book) => (
                <motion.div 
                  key={book.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden cursor-pointer transition-all group"
                  onClick={() => navigate(`/books/${book.id}`)}
                >
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <img src={book.cover} alt={book.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <span className="text-white text-xs font-medium">{book.condition}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium text-sm text-gray-900 line-clamp-2 h-10 leading-5 mb-1 group-hover:text-blue-600 transition-colors">{book.title}</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-red-500 font-bold">¥{book.price}</span>
                      <span className="text-xs text-gray-400">{book.views || 0}浏览</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden">
                          <div className="w-full h-full bg-blue-100 flex items-center justify-center text-[8px] text-blue-600 font-bold">{book.sellerId?.[0]?.toUpperCase()}</div>
                      </div>
                      <span className="text-xs text-gray-500 truncate max-w-[4rem]">{book.sellerId}</span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-2 md:col-span-3 lg:col-span-4 py-20 text-center text-gray-400 flex flex-col items-center">
                <HiSearch className="text-4xl mb-2 opacity-50" />
                <p>没有找到相关书籍</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-3/4 max-w-sm bg-white z-50 shadow-xl p-6 flex flex-col md:hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">筛选与排序</h3>
                <button onClick={() => setShowMobileFilters(false)}><HiX className="text-xl" /></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                 <FilterContent />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
