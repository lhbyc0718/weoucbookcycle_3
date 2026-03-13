import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowLeft, HiHeart, HiOutlineHeart, HiChat, HiLocationMarker, HiShare, HiCheckCircle, HiStar, HiBadgeCheck } from 'react-icons/hi';
import { bookApi, userApi } from '../services/api';

import { toast } from 'react-hot-toast';
import { bookStatusLabel, normalizeBookStatus } from '../utils/status';

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
  status: any; // may be number or string from API
  views: number;
  likes: number;
  seller: {
    id: string;
    username: string;
    avatar: string;
    trust_score: number;
    role?: string;
    roles?: string[];
    rating_sum?: number;
    rating_count?: number;
  };
  address?: {
    id?: string;
    province?: string;
    city?: string;
    district?: string;
    address?: string;
  };
  CreatedAt: string;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (id) {
      loadBook(id);
      checkWishlist(id);
      // TODO: checkLike status if API supports it
    }
  }, [id]);

  useEffect(() => {
      if (book) {
          const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
          setIsOwner(userInfo.id === book.seller?.id);
      }
  }, [book]);

  const loadBook = async (bookId: string) => {
    try {
      setError(null);
      const res = await bookApi.getBook(bookId);

      // 支持多种返回格式：
      // 1) 直接返回 book 对象
      // 2) 返回 { book: {...}, ... }
      // 3) 返回包装 { data: {...} } （不常见，保守处理）
      const payload: any = res as any;
      let bookData: any = null;

      if (!payload) {
        bookData = null;
      } else if (payload.book) {
        bookData = payload.book;
      } else if (payload.data) {
        // payload.data 可能是 book 对象或 { book: ... }
        bookData = payload.data.book || payload.data;
      } else {
        bookData = payload;
      }

      if (bookData && (bookData.id || bookData.ID)) {
        // 处理 images 字段，可能是 JSON 字符串
        if (typeof bookData.images === 'string') {
          try {
            bookData.images = JSON.parse(bookData.images);
          } catch (e) {
            console.error('Failed to parse images JSON:', e);
            bookData.images = [];
          }
        }

        setBook(bookData);
      } else {
        console.error('Invalid book data received:', bookData);
        setError('无效的书籍数据');
        setBook(null);
      }
    } catch (error) {
      console.error('Failed to load book:', error);
      setError('加载书籍失败，请稍后重试');
      setBook(null);
    } finally {
      setLoading(false);
    }
  };

  const checkWishlist = async (bookId: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

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
      // Ensure IDs are compared as strings
      setIsWishlisted(list.map(String).includes(String(bookId)));
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

    // Optimistic update
    const previousState = isWishlisted;
    setIsWishlisted(!previousState);

    try {
      const res = await userApi.toggleWishlist(id);
      const data = (res as any).data || res;
      // Backend returns { message: "...", is_wishlisted: boolean }
      if (typeof data.is_wishlisted !== 'undefined') {
          setIsWishlisted(data.is_wishlisted);
          toast.success(data.is_wishlisted ? '已加入心愿单' : '已取消收藏');
      }
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
      setIsWishlisted(previousState); // Revert on error
      toast.error('操作失败，请重试');
    }
  };

  const handleLike = async () => {
    if (!id) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        navigate('/login', { state: { from: location } });
        return;
    }

    const previousState = isLiked;
    setIsLiked(!previousState);

    try {
      await bookApi.likeBook(id);
      // Assuming like is just increment, no toggle state from backend usually, but let's assume success
      toast.success(!previousState ? '点赞成功' : '已取消点赞');
    } catch (error) {
      console.error('Failed to like book:', error);
      setIsLiked(previousState);
    }
  };

  const handleContactSeller = async () => {
    if (!book) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        navigate('/login', { state: { from: location } });
        return;
    }
    
    // Check if Seller exists
    if (!book.seller || !book.seller.id) {
        toast.error('卖家信息无效，无法联系');
        return;
    }

    // 检查是否是自己的书
    const userInfo = userApi.getCurrentUser();
    if (userInfo && userInfo.id === book.seller.id) {
        toast.error('不能联系自己');
        return;
    }
    
    // 直接跳转到聊天页面，带上目标用户ID
    // 聊天页面会处理会话的创建或查找
    navigate(`/chats/new?userId=${book.seller.id}`);
  };

  const handleUpdateStatus = async (newStatus: number) => {
      if (!book) return;
      try {
          await bookApi.updateBook(book.id, { status: newStatus });
          toast.success('状态更新成功');
          setBook({ ...book, status: newStatus });
      } catch (error) {
          console.error('Failed to update status:', error);
          toast.error('状态更新失败');
      }
  };

  const handleDelete = async () => {
      if (!book || !confirm('确定要下架这本书吗？')) return;
      try {
          await bookApi.deleteBook(book.id);
          toast.success('下架成功');
          navigate('/profile');
      } catch (error) {
          console.error('Failed to delete book:', error);
          toast.error('下架失败');
      }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 mb-4">{error || '未找到该书籍信息'}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600">返回上一页</button>
      </div>
    );
  }

  const images = (book.images && Array.isArray(book.images) && book.images.length > 0) ? book.images : [book.cover || '/images/default_book.jpg'];

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
        <button 
          aria-label="分享" 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success('链接已复制');
          }}
          className="bg-white/80 backdrop-blur-md p-2 rounded-full shadow-sm pointer-events-auto active:scale-95 transition-transform"
        >
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
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('default_book.jpg')) {
                    target.src = '/images/default_book.jpg';
                  }
                }}
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
            <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs"><HiLocationMarker /> {bookStatusLabel(book.status)}</span>
            {book.address && book.address.address && (
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs"><HiLocationMarker /> {book.address.address}</span>
            )}
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

          <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-4 mb-8 overflow-hidden">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white overflow-hidden shadow-sm shrink-0">
              <img 
                src={book.seller?.avatar || '/images/default_avatar.jpg'} 
                alt={book.seller?.username || 'Seller'} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('default_avatar.jpg')) {
                    target.src = '/images/default_avatar.jpg';
                  }
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-lg flex items-center gap-2 truncate">
                {book.seller?.username || '账号已注销'}
                {(book.seller?.role === 'admin' || book.seller?.roles?.includes('admin')) && (
                   <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-normal shrink-0">
                     <HiBadgeCheck /> 管理员
                   </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full"><HiBadgeCheck /> 信任分: {book.seller?.trust_score || 0}</span>
                <span className="flex items-center gap-1 text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200">
                    <HiStar className="text-yellow-500" /> 
                    {(() => {
                        const sum = book.seller?.rating_sum || 0;
                        const count = book.seller?.rating_count || 0;
                        return count > 0 ? (sum / count).toFixed(1) : '0.0';
                    })()} 
                    <span className="text-xs font-normal text-gray-400 ml-0.5">({book.seller?.rating_count || 0})</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={handleContactSeller}
                disabled={!book.seller?.id}
                className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <HiChat className="text-base" />
                私信
              </button>
              <button
                onClick={() => {
                  // 发送商品链接到私信（跳转并附带分享参数）
                  if (!book.seller?.id) return;
                  const params = new URLSearchParams();
                  params.set('userId', book.seller.id);
                  params.set('shareListingId', book.id);
                  params.set('shareTitle', book.title);
                  navigate(`/chats/new?${params.toString()}`);
                }}
                className="text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-1"
              >
                发送商品链接
              </button>
              <button 
                onClick={() => book.seller?.id && navigate(`/users/${book.seller.id}`)}
                disabled={!book.seller?.id}
                className="text-blue-600 font-medium hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm border border-blue-100 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                查看主页
              </button>
            </div>
          </div>

          {/* Desktop Actions */}
          {isOwner ? (
            <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-3">
                    <button 
                      onClick={() => handleUpdateStatus(1)}
                      disabled={normalizeBookStatus(book.status) === 1}
                      className={`flex-1 py-3 rounded-xl font-bold shadow-sm transition-all ${normalizeBookStatus(book.status) === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      设为在售
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(2)}
                      disabled={normalizeBookStatus(book.status) === 0}
                      className={`flex-1 py-3 rounded-xl font-bold shadow-sm transition-all ${normalizeBookStatus(book.status) === 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      设为已售出
                    </button>
                </div>
              <button 
                onClick={handleDelete}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-sm transition-all"
              >
                下架/删除书籍
              </button>
            </div>
          ) : (
          <div className="hidden md:flex gap-4">
            <button 
              onClick={handleContactSeller}
              disabled={!book.seller?.id}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 text-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
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
            <button 
              onClick={handleLike}
              className={`px-6 py-3 rounded-xl font-bold border-2 flex items-center gap-2 transition-all ${isLiked ? 'border-blue-500 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              <HiStar className="text-xl" />
              {isLiked ? '已点赞' : '点赞'}
            </button>
            <button 
              aria-label="分享" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('链接已复制到剪贴板');
              }}
              className="p-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
            >
              <HiShare className="text-xl" />
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 px-6 flex items-center gap-4 z-50 md:hidden">
        {isOwner ? (
             <div className="flex gap-3 w-full">
                 <button 
                   onClick={() => handleUpdateStatus(normalizeBookStatus(book.status) === 1 ? 2 : 1)}
                   className="flex-1 bg-blue-600 text-white rounded-full py-2.5 font-medium shadow-md"
                 >
                   {normalizeBookStatus(book.status) === 1 ? '设为已售出' : '设为在售'}
                 </button>
                 <button 
                   onClick={handleDelete}
                   className="flex-1 bg-red-600 text-white rounded-full py-2.5 font-medium shadow-md"
                 >
                   下架
                 </button>
             </div>
        ) : (
            <>
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
          onClick={handleLike}
          className="flex flex-col items-center gap-1 text-gray-500 min-w-[3rem]"
        >
          <HiStar className={`text-2xl ${isLiked ? 'text-blue-500' : ''}`} />
          <span className="text-[10px]">{isLiked ? '已点赞' : '点赞'}</span>
        </button>

        <button 
          onClick={handleContactSeller}
          disabled={!book.seller?.id}
          className="flex-1 bg-blue-600 text-white rounded-full py-2.5 font-medium shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
        >
          <HiChat className="text-lg" />
          联系卖家
        </button>
            </>
        )}
      </div>
    </div>
  );
}
