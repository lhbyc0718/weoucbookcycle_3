import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiLogout, HiBookOpen, HiHeart, HiCheckCircle, HiBadgeCheck, HiPencil, HiX, HiUpload, HiLockClosed, HiStar } from 'react-icons/hi';
import { userApi, bookApi, authApi, uploadApi } from '../services/api';
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
  published_count?: number;
  total_likes?: number;
  total_favorites?: number;
  sold_count?: number;
  rating_sum?: number;
  rating_count?: number;
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

export default function UserProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'wishlist'>('posts');
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    avatar: '',
    bio: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await userApi.getMyProfile();
      const userData = (data as any).data || data;
      setUser(userData);
      setEditForm({
        username: userData.username || '',
        avatar: userData.avatar || '',
        bio: userData.bio || ''
      });
      
      if (userData.wishlist) {
        let ids: string[] = [];
        try {
          // 后端可能返回 ID 数组或 JSON 字符串
          if (Array.isArray(userData.wishlist)) {
             ids = userData.wishlist;
          } else if (typeof userData.wishlist === 'string') {
             ids = JSON.parse(userData.wishlist);
          }
        } catch (e) { ids = []; }
        
        if (ids.length > 0) {
          const promises = ids.map(id => bookApi.getBook(id).catch(() => null));
          const results = await Promise.all(promises);
          const validBooks = results
            .filter(r => r)
            .map(r => (r as any).data || r)
            .filter(b => b && (b.id || b.ID)); // 过滤无效书籍
          setWishlistBooks(validBooks);
        }
      }
      
      // Load user's books if not included in profile
      if (!userData.Books || userData.Books.length === 0) {
          try {
             // Assuming there's an API to get books by user, or filter from market
             // For now, let's assume getMyProfile should return Books. 
             // If not, we might need a separate call like bookApi.getMyBooks() if it existed.
             // But based on backend, User struct has Books. Let's check backend.
          } catch (e) { console.error(e); }
      }

    } catch (error: any) {
      console.error('Failed to load profile:', error);
      // 如果是404或资源不存在，说明用户可能已被删除或Token失效
      if (error.message && (error.message.includes('不存在') || error.message.includes('404'))) {
        toast.error('用户信息失效，请重新登录');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        // 延迟跳转让用户看到提示
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        toast.error('加载个人信息失败');
      }
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userApi.updateProfile(editForm);
      toast.success('个人资料已更新');
      setIsEditing(false);
      loadProfile(); // Reload to get fresh data
    } catch (error: any) {
      console.error('Update failed:', error);
      toast.error(error.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('新密码长度不能少于8位');
      return;
    }

    setSaving(true);
    try {
      await authApi.updatePassword({
        old_password: passwordForm.oldPassword,
        new_password: passwordForm.newPassword
      });
      toast.success('密码修改成功');
      setIsChangingPassword(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password update failed:', error);
      toast.error(error.message || '密码修改失败');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    const toastId = toast.loading('正在上传头像...');
    try {
      const res = await uploadApi.uploadFile(file);
      const data = (res as any).data || res;
      if (data.url) {
        setEditForm(prev => ({ ...prev, avatar: data.url }));
        toast.success('上传成功', { id: toastId });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('头像上传失败', { id: toastId });
    }
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

  const getRating = () => {
    if (!user || !user.rating_count) return 0;
    return (user.rating_sum || 0) / user.rating_count;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50">加载中...</div>;
  }

  if (!user) return null;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-0 relative">
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">编辑个人资料</h3>
              <button 
                onClick={() => setIsEditing(false)} 
                className="p-1 hover:bg-gray-200 rounded-full"
                title="关闭"
              >
                <HiX className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">头像</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border bg-gray-100 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <img 
                      src={editForm.avatar || '/images/default_avatar.jpg'} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      onError={(e) => (e.target as HTMLImageElement).src = '/images/default_avatar.jpg'} 
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <HiUpload className="text-white text-xl" />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                    title="上传头像"
                    placeholder="选择图片文件"
                  />
                  <div className="flex-1">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-700 transition-colors"
                      >
                        更换头像
                      </button>
                      <p className="text-xs text-gray-500 mt-1">支持 JPG, PNG, GIF，最大 5MB</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input 
                  type="text" 
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入昵称"
                  title="昵称"
                  required
                />
                  
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
                <textarea 
                  value={editForm.bio}
                  onChange={e => setEditForm({...editForm, bio: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="介绍一下你自己..."
                />
              </div>
              <div className="pt-2 flex flex-col gap-3">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存修改'}
                </button>
                <button 
                  type="button"
                  onClick={() => { setIsEditing(false); setIsChangingPassword(true); }}
                  className="w-full text-blue-600 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm flex items-center justify-center gap-1"
                >
                  <HiLockClosed /> 修改密码
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">修改密码</h3>
              <button onClick={() => setIsChangingPassword(false)} className="p-1 hover:bg-gray-200 rounded-full" title="关闭">
                <HiX className="text-xl" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                <input 
                  type="password" 
                  value={passwordForm.oldPassword}
                  onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  title="当前密码"
                  placeholder="请输入当前密码"
                />
          
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                <input 
                  type="password" 
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">至少8位字符</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                <input 
                  type="password" 
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  title="确认新密码"
                  placeholder="请再次输入新密码"
                />
            
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <div className="mt-2 flex flex-col items-start gap-1">
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-700 text-xs">
                        <span>信任分: {user.trust_score}</span>
                      </div>
                      <div className="inline-flex items-center gap-1 bg-yellow-400/20 text-yellow-200 px-2 py-0.5 rounded-full text-xs font-medium border border-yellow-400/30">
                        <HiStar className="text-yellow-400" />
                        <span>{getRating().toFixed(1)}</span>
                        <span className="opacity-70">({user.rating_count || 0})</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                    title="编辑资料"
                  >
                    <HiPencil className="text-white" />
                  </button>
                </div>
             </div>

             {/* Desktop Profile Card */}
             <div className="hidden md:flex flex-col items-center p-8 text-center relative">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="编辑资料"
                >
                  <HiPencil className="text-xl" />
                </button>
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
                <div className="flex flex-col items-center gap-1 mt-2 mb-4">
                  <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                     <HiCheckCircle /> 信任分: {user.trust_score}
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200 shadow-sm mt-1">
                     <HiStar className="text-yellow-500 text-lg" />
                     <span className="text-lg">{getRating().toFixed(1)}</span>
                     <span className="text-xs text-gray-500 font-normal ml-1">({user.rating_count || 0}人评价)</span>
                  </div>
                </div>
                
                <div className="w-full border-t border-gray-100 my-6"></div>
                
                <div className="w-full grid grid-cols-2 gap-4 text-center">
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.published_count || user.Books?.length || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">已发布</div>
                   </div>
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.total_likes || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">获赞数</div>
                   </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-4 text-center mt-4 pt-4 border-t border-gray-100">
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.total_favorites || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">收藏数</div>
                   </div>
                   <div>
                     <div className="text-xl font-bold text-gray-900">{user.sold_count || 0}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">已卖出</div>
                   </div>
                </div>

                <div className="w-full mt-8">
                   <div className="space-y-3">
                     <button
                       onClick={() => navigate('/transactions')}
                       className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                     >
                       我的交易
                     </button>
                     <button 
                       onClick={handleLogout}
                       className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                     >
                       <HiLogout /> 退出登录
                     </button>
                   </div>
                </div>
             </div>
          </div>

          {/* Mobile Stats Card (Overlay) */}
          <div className="md:hidden mx-4 -mt-10 relative z-20 bg-white rounded-xl shadow-sm p-4 flex justify-around text-center border border-gray-100">
            <div>
              <div className="text-xl font-bold text-gray-800">{user.published_count || user.Books?.length || 0}</div>
              <div className="text-xs text-gray-500">已发布</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{user.total_likes || 0}</div>
              <div className="text-xs text-gray-500">获赞数</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{user.total_favorites || 0}</div>
              <div className="text-xs text-gray-500">被收藏</div>
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
         <div className="space-y-3">
           <button onClick={() => navigate('/transactions')} className="w-full bg-blue-600 text-white py-3 rounded-lg shadow-sm font-medium flex items-center justify-center gap-2">我的交易</button>
           <button 
             onClick={handleLogout}
             className="w-full bg-white text-red-500 py-3 rounded-lg shadow-sm font-medium flex items-center justify-center gap-2 active:bg-gray-50 border border-gray-200"
           >
             <HiLogout /> 退出登录
           </button>
         </div>
      </div>
    </div>
  );
}
