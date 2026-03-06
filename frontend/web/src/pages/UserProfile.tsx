import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiLogout, HiBookOpen, HiHeart, HiCheckCircle } from 'react-icons/hi';
import { userApi, bookApi, authApi } from '../services/api';
import clsx from 'clsx';

interface User {
  id: string;
  username: string;
  avatar: string;
  bio?: string;
  trust_score: number;
  Books?: Book[];
  wishlist?: string;
}

interface Book {
  id: string;
  title: string;
  cover: string;
  price: number;
  condition: string;
  status: number;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'wishlist'>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await userApi.getMyProfile();
      const userData = (data as any).data || data;
      setUser(userData);
      
      if (userData.wishlist) {
        let ids: string[] = [];
        try {
          ids = typeof userData.wishlist === 'string' 
            ? JSON.parse(userData.wishlist) 
            : userData.wishlist;
        } catch (e) { ids = []; }
        
        if (ids.length > 0) {
          const promises = ids.map(id => bookApi.getBook(id).catch(() => null));
          const results = await Promise.all(promises);
          const validBooks = results
            .filter(r => r)
            .map(r => (r as any).data || r);
          setWishlistBooks(validBooks);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50">加载中...</div>;
  }

  if (!user) return null;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-0">
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
                  <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                        {user.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold">{user.username}</h1>
                    <p className="text-blue-100 text-sm mt-1">{user.bio || '暂无简介'}</p>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-700 text-xs">
                      <span>信任分: {user.trust_score}</span>
                    </div>
                  </div>
                </div>
             </div>

             {/* Desktop Profile Card */}
             <div className="hidden md:flex flex-col items-center p-8 text-center">
                <div className="w-32 h-32 rounded-full bg-gray-100 p-1 mb-4 overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold">
                        {user.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{user.username}</h2>
                <p className="text-gray-500 text-sm mt-2 mb-4">{user.bio || '暂无简介'}</p>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                   <HiCheckCircle /> 信任分: {user.trust_score}
                </div>
                
                <div className="w-full border-t border-gray-100 my-6"></div>
                
                <div className="w-full grid grid-cols-2 gap-4 text-center">
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.Books?.length || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">已发布</div>
                   </div>
                   <div>
                     <div className="text-xl font-bold text-gray-900">{wishlistBooks.length}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">心愿单</div>
                   </div>
                </div>

                <div className="w-full mt-8">
                   <button 
                     onClick={handleLogout}
                     className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                   >
                     <HiLogout /> 退出登录
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
              <div className="text-xl font-bold text-gray-800">{wishlistBooks.length}</div>
              <div className="text-xs text-gray-500">心愿单</div>
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
                  onClick={() => setActiveTab('posts')}
                  className={clsx(
                    "px-6 pb-3 text-sm font-medium transition-colors relative",
                    activeTab === 'posts' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  我的发布
                  {activeTab === 'posts' && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('wishlist')}
                  className={clsx(
                    "px-6 pb-3 text-sm font-medium transition-colors relative",
                    activeTab === 'wishlist' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  心愿单
                  {activeTab === 'wishlist' && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              </div>

              <div className="mt-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'posts' ? (
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
                            <img src={book.cover} alt={book.title} className="w-20 h-24 object-cover rounded bg-gray-200" />
                            <div className="flex-1 flex flex-col justify-between py-1">
                              <div>
                                <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">{book.title}</h3>
                                <span className="text-xs text-gray-500 mt-1 inline-block">{book.condition}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-red-500 font-bold">¥{book.price}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${book.status === 1 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                  {book.status === 1 ? '在售' : '已下架'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-20 text-gray-400">
                          <p>暂无发布</p>
                          <button onClick={() => navigate('/post')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">去发布</button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="wishlist"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {wishlistBooks.length > 0 ? (
                        wishlistBooks.map((book) => (
                          <div 
                            key={book.id} 
                            onClick={() => navigate(`/books/${book.id}`)}
                            className="bg-white md:bg-gray-50 p-3 rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-transparent md:hover:border-blue-200 md:hover:bg-blue-50 transition-all cursor-pointer flex gap-3 group"
                          >
                            <img src={book.cover} alt={book.title} className="w-20 h-24 object-cover rounded bg-gray-200" />
                            <div className="flex-1 flex flex-col justify-between py-1">
                              <div>
                                <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">{book.title}</h3>
                                <span className="text-xs text-gray-500 mt-1 inline-block">{book.condition}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-red-500 font-bold">¥{book.price}</span>
                                <button aria-label="收藏" className="text-gray-400 hover:text-red-500 transition-colors">
                                  <HiHeart className="text-xl text-red-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-20 text-gray-400">
                          <p>暂无收藏</p>
                          <button onClick={() => navigate('/market')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">去逛逛</button>
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
      
      {/* Mobile Logout Button */}
      <div className="mt-8 px-4 md:hidden">
         <button 
           onClick={handleLogout}
           className="w-full bg-white text-red-500 py-3 rounded-lg shadow-sm font-medium flex items-center justify-center gap-2 active:bg-gray-50 border border-gray-200"
         >
           <HiLogout /> 退出登录
         </button>
      </div>
    </div>
  );
}
