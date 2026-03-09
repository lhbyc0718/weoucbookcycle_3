import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowLeft, HiHeart, HiOutlineHeart, HiChat, HiLocationMarker, HiShare, HiCheckCircle, HiStar, HiBadgeCheck } from 'react-icons/hi';
import { bookApi, userApi } from '../services/api';

interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  images?: string[];
  price: number;
  condition: string;
  description: string;
  category: string;
  status: string;
  views: number;
  likes: number;
  Seller: {
    id: string;
    username: string;
    avatar: string;
    trust_score: number;
    role?: string;
    roles?: string[];
  };
  CreatedAt: string;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      loadBook(id);
      checkWishlist(id);
    }
  }, [id]);

  const loadBook = async (bookId: string) => {
    try {
      const data = await bookApi.getBook(bookId);
      // 类型安全处理：不再使用 as any
      // 假设 api 返回的数据结构已经规范化，如果不规范，建议在 api 层统一处理
      const bookData = (data as any).data || data; 
      // TODO: 定义严格的 API 响应接口，避免 (data as any)
      setBook(bookData);
    } catch (error) {
      console.error('Failed to load book:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWishlist = async (bookId: string) => {
    try {
      const user = await userApi.getMyProfile();
      // 拦截器已统一解包
      const userData = user as any; 
      let list: string[] = [];
      try {
        if (typeof userData.wishlist === 'string') {
          list = JSON.parse(userData.wishlist);
        } else if (Array.isArray(userData.wishlist)) {
          list = userData.wishlist;
        }
      } catch (e) {
        list = [];
      }
      setIsWishlisted(list.includes(bookId));
    } catch (error) {
      console.error('Failed to check wishlist:', error);
    }
  };

  const handleToggleWishlist = async () => {
    if (!id) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        navigate('/login', { state: { from: location } });
        return;
    }

    try {
      setIsWishlisted(!isWishlisted);
      await userApi.toggleWishlist(id);
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
      setIsWishlisted(!isWishlisted);
    }
  };

  const handleContactSeller = async () => {
    if (!book) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        navigate('/login', { state: { from: location } });
        return;
    }
    navigate(`/chats/new?userId=${book.Seller.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 mb-4">未找到该书籍信息</p>
        <button onClick={() => navigate(-1)} className="text-blue-600">返回上一页</button>
      </div>
    );
  }

  const images = book.images && book.images.length > 0 ? book.images : [book.cover];

  return (
    <div className="pb-20 md:pb-0">
      {/* Mobile Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 p-4 flex justify-between items-center pointer-events-none md:hidden">
        <button 
          onClick={() => navigate(-1)} 
          aria-label="返回"
          className="bg-white/80 backdrop-blur-md p-2 rounded-full shadow-sm pointer-events-auto active:scale-95 transition-transform"
        >
          <HiArrowLeft className="text-xl text-gray-800" />
        </button>
        <button aria-label="分享" className="bg-white/80 backdrop-blur-md p-2 rounded-full shadow-sm pointer-events-auto active:scale-95 transition-transform">
          <HiShare className="text-xl text-gray-800" />
        </button>
      </div>

      <div className="bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:overflow-hidden md:p-6 md:grid md:grid-cols-2 md:gap-10">
        {/* Left Column: Images */}
        <div className="space-y-4">
          <div className="relative bg-gray-100 aspect-[3/4] md:aspect-square w-full overflow-hidden md:rounded-xl">
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                key={currentImageIndex}
                src={images[currentImageIndex]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-contain md:object-cover"
                alt={book.title}
              />
            </AnimatePresence>
            
            {images.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
          </div>
          
          {/* Thumbnails (Desktop) */}
          {images.length > 1 && (
            <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  aria-label={`查看第${idx + 1}张图片`}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${currentImageIndex === idx ? 'border-blue-600' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Info */}
        <div className="p-5 md:p-0 -mt-6 md:mt-0 relative z-10 bg-white rounded-t-3xl md:rounded-none">
          {/* Breadcrumb (Desktop) */}
          <div className="hidden md:flex items-center text-sm text-gray-500 mb-4">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/market')}>市场</span>
            <span className="mx-2">/</span>
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate(`/market?category=${book.category}`)}>{book.category}</span>
          </div>

          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight flex-1 mr-4">{book.title}</h1>
            <div className="text-right">
               <span className="text-3xl font-bold text-red-600 block">¥{book.price}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center text-sm text-gray-500 mb-6 gap-3">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">{book.condition}</span>
            <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs"><HiLocationMarker /> {book.status === 'sold' ? '已售出' : '在售'}</span>
            <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs"><HiCheckCircle className="text-green-500"/> {book.author}</span>
            <span className="text-xs">{book.views} 次浏览</span>
          </div>

          <div className="border-t border-b border-gray-100 py-6 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 text-lg">书籍简介</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-base">
              {/* 使用普通文本渲染，防止XSS。如果确实需要富文本，请使用 DOMPurify */}
              {book.description || '暂无简介'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-4 mb-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white overflow-hidden shadow-sm">
              {book.Seller?.avatar ? (
                <img src={book.Seller.avatar} alt={book.Seller.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-xl">
                  {book.Seller?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                {book.Seller?.username}
                {(book.Seller?.role === 'admin' || book.Seller?.roles?.includes('admin')) && (
                   <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-normal">
                     <HiBadgeCheck /> 管理员
                   </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1 text-yellow-500"><HiStar /> {book.Seller?.trust_score} 信任分</span>
              </div>
            </div>
            <button className="text-blue-600 font-medium hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
              查看主页
            </button>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex gap-4">
            <button 
              onClick={handleContactSeller}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 text-lg"
            >
              <HiChat className="text-xl" />
              联系卖家
            </button>
            <button 
              onClick={handleToggleWishlist}
              className={`px-6 py-3 rounded-xl font-bold border-2 flex items-center gap-2 transition-all ${isWishlisted ? 'border-red-500 text-red-500 bg-red-50' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {isWishlisted ? <HiHeart className="text-xl" /> : <HiOutlineHeart className="text-xl" />}
              {isWishlisted ? '已收藏' : '收藏'}
            </button>
            <button aria-label="分享" className="p-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
              <HiShare className="text-xl" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 px-6 flex items-center gap-4 z-50 md:hidden">
        <button 
          onClick={handleToggleWishlist}
          className="flex flex-col items-center gap-1 text-gray-500 min-w-[3rem]"
        >
          {isWishlisted ? (
            <HiHeart className="text-2xl text-red-500" />
          ) : (
            <HiOutlineHeart className="text-2xl" />
          )}
          <span className="text-[10px]">{isWishlisted ? '已收藏' : '收藏'}</span>
        </button>
        
        <button 
          onClick={handleContactSeller}
          className="flex-1 bg-blue-600 text-white rounded-full py-2.5 font-medium shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <HiChat className="text-lg" />
          联系卖家
        </button>
      </div>
    </div>
  );
}
