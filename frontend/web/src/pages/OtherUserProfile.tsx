import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiBookOpen, HiCheckCircle, HiBadgeCheck, HiChat } from 'react-icons/hi';
import { userApi } from '../services/api';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { bookStatusLabel, bookStatusBadgeClass } from '../utils/status';

interface User {
  id: string;
  username: string;
  avatar: string;
  bio?: string;
  trust_score: number;
  role?: string;
  roles?: string[];
  Books?: Book[];
  wishlist?: string;
}

interface Book {
  id: string;
  title: string;
  cover?: string;
  images?: string | string[];
  price: number;
  condition: string;
  status: number;
}

export default function OtherUserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab] = useState<'posts'>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
        loadProfile(id);
    }
  }, [id]);

  const loadProfile = async (userId: string) => {
    try {
      const data = await userApi.getUser(userId);
      const userData = (data as any).data || data;
      setUser(userData);
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        navigate('/login');
        return;
    }
    navigate(`/chats/new?userId=${user.id}`);
  };

  const getCover = (book: Book) => {
    if (book.cover) return book.cover;
    if (book.images) {
      try {
        const imgs = typeof book.images === 'string' ? JSON.parse(book.images) : book.images;
        if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
      } catch (e) {
        console.error("Error parsing book images", e);
      }
    }
    return '/images/default_book.jpg';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50">加载中...</div>;
  }

  if (!user) return <div className="flex justify-center items-center h-screen">用户不存在</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-0 relative">
      <div className="md:grid md:grid-cols-12 md:gap-8">
        
        {/* Left Column: User Card (Desktop) / Header (Mobile) */}
        <div className="md:col-span-4 lg:col-span-3">
          <div className="bg-blue-600 md:bg-white md:border md:border-gray-200 md:rounded-2xl md:overflow-hidden md:shadow-sm">
             {/* Mobile Banner Background */}
             <div className="md:hidden text-white pt-10 pb-16 px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <HiBookOpen className="text-9xl transform rotate-12" />
                </div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg shrink-0">
                    <img 
                      src={user.avatar || '/images/default_avatar.jpg'} 
                      alt={user.username} 
                      className="w-full h-full rounded-full object-cover" 
                      onError={(e) => (e.target as HTMLImageElement).src = '/images/default_avatar.jpg'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold truncate">{user.username}</h1>
                      {(user.role === 'admin' || user.roles?.includes('admin')) && (
                        <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <HiBadgeCheck /> 管理员
                        </span>
                      )}
                    </div>
                    <p className="text-blue-100 text-sm mt-1 line-clamp-2">{user.bio || '暂无简介'}</p>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-700 text-xs">
                      <span>信任分: {user.trust_score}</span>
                    </div>
                  </div>
                </div>
             </div>

             {/* Desktop Profile Card */}
             <div className="hidden md:flex flex-col items-center p-8 text-center relative">
                <div className="w-32 h-32 rounded-full bg-gray-100 p-1 mb-4 overflow-hidden shadow-sm">
                    <img 
                      src={user.avatar || '/images/default_avatar.jpg'} 
                      alt={user.username} 
                      className="w-full h-full rounded-full object-cover" 
                      onError={(e) => (e.target as HTMLImageElement).src = '/images/default_avatar.jpg'}
                    />
                </div>
                <div className="flex items-center gap-2 justify-center w-full">
                  <h2 className="text-2xl font-bold text-gray-900 truncate max-w-[200px]">{user.username}</h2>
                  {(user.role === 'admin' || user.roles?.includes('admin')) && (
                    <span className="text-purple-600 shrink-0" title="管理员">
                      <HiBadgeCheck className="text-2xl" />
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm mt-2 mb-4 line-clamp-3">{user.bio || '暂无简介'}</p>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                   <HiCheckCircle /> 信任分: {user.trust_score}
                </div>
                
                <div className="w-full border-t border-gray-100 my-6"></div>
                
                <div className="w-full text-center">
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.Books?.length || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">已发布</div>
                   </div>
                </div>

                <div className="w-full mt-8">
                   <button 
                     onClick={handleContactSeller}
                     className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                   >
                     <HiChat /> 私信
                   </button>
                </div>
             </div>
          </div>

          {/* Mobile Stats Card (Overlay) */}
          <div className="md:hidden mx-4 -mt-10 relative z-20 bg-white rounded-xl shadow-sm p-4 flex justify-around text-center border border-gray-100">
            <div>
              <div className="text-xl font-bold text-gray-800">{user.Books?.length || 0}</div>
              <div className="text-xs text-gray-500">已发布</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">0</div>
              <div className="text-xs text-gray-500">已卖出</div>
            </div>
          </div>
        </div>

        {/* Right Column: Content (Desktop) / Main (Mobile) */}
        <div className="md:col-span-8 lg:col-span-9">
          <div className="bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:p-6 min-h-[500px]">
            {/* Tabs */}
            <div className="px-4 md:px-0 pt-6 md:pt-0">
              <div className="flex border-b border-gray-200">
                <button
                  className={clsx(
                    "px-6 pb-3 text-sm font-medium transition-colors relative",
                    activeTab === 'posts' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Ta的发布
                  {activeTab === 'posts' && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              </div>

              <div className="mt-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'posts' && (
                    <motion.div
                      key="posts"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {user.Books && user.Books.length > 0 ? (
                        user.Books.map((book) => (
                          <div 
                            key={book.id} 
                            onClick={() => navigate(`/books/${book.id}`)}
                            className="bg-white md:bg-gray-50 p-3 rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-transparent md:hover:border-blue-200 md:hover:bg-blue-50 transition-all cursor-pointer flex gap-3 group"
                          >
                            <img 
                              src={getCover(book)} 
                              alt={book.title} 
                              className="w-20 h-24 object-cover rounded bg-gray-200" 
                              onError={(e) => (e.target as HTMLImageElement).src = '/images/default_book.jpg'}
                            />
                            <div className="flex-1 flex flex-col justify-between py-1">
                              <div>
                                <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">{book.title}</h3>
                                <span className="text-xs text-gray-500 mt-1 inline-block">{book.condition}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-red-500 font-bold">¥{book.price}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${bookStatusBadgeClass(book.status)}`}>
                                  {bookStatusLabel(book.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-20 text-gray-400">
                          <p>暂无发布</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Action Button */}
      <div className="mt-8 px-4 md:hidden">
         <button 
           onClick={handleContactSeller}
           className="w-full bg-blue-600 text-white py-3 rounded-lg shadow-sm font-medium flex items-center justify-center gap-2 active:bg-blue-700 border border-transparent"
         >
           <HiChat /> 私信卖家
         </button>
      </div>
    </div>
  );
}
