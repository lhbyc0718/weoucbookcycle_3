import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiSearch, HiFire, HiBookOpen, HiAcademicCap, HiSparkles, HiArrowRight } from 'react-icons/hi';
import { bookApi } from '../services/api';

interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  price: number;
  condition: string;
  sellerId: string;
  views?: number;
}

export default function Home() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [hotBooks, setHotBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recentData, hotData] = await Promise.all([
          bookApi.getBooks({ limit: 10 }),
          bookApi.getHotBooks()
        ]);
        
        setBooks(Array.isArray(recentData) ? recentData : (recentData as any).data || []);
        setHotBooks(Array.isArray(hotData) ? hotData : (hotData as any).data || []);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const categories = [
    { icon: <HiBookOpen className="text-blue-500" />, name: '教材', color: 'bg-blue-100' },
    { icon: <HiAcademicCap className="text-green-500" />, name: '考研', color: 'bg-green-100' },
    { icon: <HiSparkles className="text-purple-500" />, name: '文学', color: 'bg-purple-100' },
    { icon: <HiFire className="text-red-500" />, name: '热门', color: 'bg-red-100' },
  ];

  return (
    <div className="pb-20 md:pb-0">
      {/* Mobile Search Header (Hidden on Desktop) */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 shadow-sm md:hidden">
        <div className="relative" onClick={() => navigate('/market')}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <HiSearch className="text-gray-400 text-lg" />
          </div>
          <input
            type="text"
            readOnly
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full leading-5 bg-gray-100 text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-blue-300 transition duration-150 ease-in-out sm:text-sm"
            placeholder="搜索书籍、作者、ISBN..."
          />
        </div>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-8">
        {/* Left Column / Main Content */}
        <div className="md:col-span-12 lg:col-span-9 space-y-6 md:space-y-8">
          
          {/* Banner / Hero */}
          <div className="p-4 md:p-0">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-10 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between"
            >
              <div className="relative z-10 max-w-lg">
                <h2 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4">WeOUC Book Cycle</h2>
                <p className="text-blue-100 text-sm md:text-lg mb-4 md:mb-6">让闲置书籍流动起来，传递知识与价值。连接每一位 OUCer。</p>
                <button 
                  onClick={() => navigate('/market')}
                  className="bg-white text-blue-600 px-6 py-2 rounded-full text-sm md:text-base font-bold shadow-sm hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
                >
                  立即探索 <HiArrowRight />
                </button>
              </div>
              <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4 md:translate-x-0 md:translate-y-10">
                <HiBookOpen className="text-9xl md:text-[12rem]" />
              </div>
            </motion.div>
          </div>

          {/* Desktop Categories (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-4 gap-4">
             {categories.map((cat, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/market?category=${cat.name}`)}
              >
                <div className={`p-3 rounded-full ${cat.color} text-2xl`}>
                  {cat.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{cat.name}</h3>
                  <p className="text-xs text-gray-500">浏览{cat.name}类书籍</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mobile Categories (Hidden on Desktop) */}
          <div className="grid grid-cols-4 gap-4 px-4 md:hidden">
            {categories.map((cat, idx) => (
              <motion.div 
                key={idx}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => navigate(`/market?category=${cat.name}`)}
              >
                <div className={`p-3 rounded-full ${cat.color} text-xl shadow-sm`}>
                  {cat.icon}
                </div>
                <span className="text-xs text-gray-600 font-medium">{cat.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Hot Books Section */}
          {hotBooks.length > 0 && (
            <div className="md:bg-white md:p-6 md:rounded-2xl md:shadow-sm md:border md:border-gray-100">
              <div className="flex justify-between items-center px-4 md:px-0 mb-3 md:mb-6">
                <h3 className="font-bold text-lg md:text-xl text-gray-800 flex items-center gap-2">
                  <HiFire className="text-red-500" /> 热门推荐
                </h3>
                <span className="text-xs md:text-sm text-gray-500 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate('/market')}>查看全部</span>
              </div>
              
              {/* Mobile Scroll / Desktop Grid */}
              <div className="flex overflow-x-auto px-4 md:px-0 gap-4 pb-4 md:pb-0 scrollbar-hide md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-6 md:overflow-visible">
                {hotBooks.map((book) => (
                  <motion.div 
                    key={book.id}
                    className="flex-shrink-0 w-32 md:w-auto bg-white md:bg-gray-50 rounded-lg md:rounded-xl shadow-sm md:shadow-none md:hover:shadow-md border border-gray-100 md:border-transparent transition-all overflow-hidden cursor-pointer group"
                    whileHover={{ y: -4 }}
                    onClick={() => navigate(`/books/${book.id}`)}
                  >
                    <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden">
                      <img src={book.cover} alt={book.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {book.condition}
                      </div>
                    </div>
                    <div className="p-2 md:p-3">
                      <h4 className="font-medium text-sm text-gray-900 truncate md:text-base">{book.title}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-red-500 font-bold text-xs md:text-sm">¥{book.price}</p>
                        <span className="text-[10px] text-gray-400">{book.views}热度</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Listings Grid */}
          <div className="px-4 md:px-0">
            <h3 className="font-bold text-lg md:text-xl text-gray-800 mb-3 md:mb-6">最新发布</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {loading ? (
                // Skeleton Loading
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-gray-100">
                    <div className="h-40 bg-gray-200 rounded-t-xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : (
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
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden">
                             <div className="w-full h-full bg-blue-100 flex items-center justify-center text-[8px] text-blue-600 font-bold">{book.sellerId?.[0]?.toUpperCase()}</div>
                          </div>
                          <span className="text-xs text-gray-500 truncate max-w-[4rem]">{book.sellerId}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
            <h3 className="font-bold text-gray-800 mb-4">公告</h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 pb-3 border-b border-gray-50">
                <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs mr-2">New</span>
                欢迎来到 WeOUC 书籍循环圈！
              </div>
              <div className="text-sm text-gray-600 pb-3 border-b border-gray-50">
                <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-xs mr-2">Tip</span>
                发布书籍时请填写真实信息。
              </div>
              <div className="text-sm text-gray-600">
                <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-xs mr-2">Safe</span>
                线下交易请注意安全。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
