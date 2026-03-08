import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { HiHome, HiShoppingBag, HiChat, HiPlusCircle, HiUser, HiChartPie } from 'react-icons/hi';
import clsx from 'clsx';
import { useChatStore } from '../store/chatStore';
import { useEffect, useState } from 'react';
import { userApi } from '../services/api';

export default function MainLayout() {
  const location = useLocation();
  const isPostPage = location.pathname === '/post';
  const unreadCount = useChatStore(state => state.unreadCount);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 检查用户角色
    const checkRole = async () => {
      try {
        const user = await userApi.getMyProfile();
        // @ts-ignore
        const roles = user.roles || [];
        // @ts-ignore
        setIsAdmin(roles.includes('admin') || user.role === 'admin');
      } catch (e) {
        console.error("Failed to fetch user profile", e);
      }
    };
    checkRole();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Desktop Header - Fixed at top */}
      <header className="hidden md:block fixed top-0 left-0 right-0 bg-white shadow-sm h-16 z-50 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2">
              <span className="font-bold text-xl text-blue-600 tracking-tight whitespace-nowrap">WeOUC Book Cycle</span>
            </NavLink>
            <nav className="flex space-x-6">
              <NavLink to="/" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600", isActive ? "text-blue-600" : "text-gray-600")}>首页</NavLink>
              <NavLink to="/market" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600", isActive ? "text-blue-600" : "text-gray-600")}>市场</NavLink>
              <NavLink to="/messages" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600 relative", isActive ? "text-blue-600" : "text-gray-600")}>
                消息
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600 flex items-center gap-1", isActive ? "text-blue-600" : "text-purple-600")}>
                  <HiChartPie />
                  管理后台
                </NavLink>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <NavLink to="/post" className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow active:scale-95 transform">
              <HiPlusCircle className="text-lg" />
              <span>发布书籍</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => clsx("p-2 rounded-full transition-colors flex items-center justify-center w-10 h-10 relative", isActive ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-blue-600 hover:bg-gray-100")}>
              <HiUser className="text-xl" />
              {isAdmin && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white"></span>}
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main Content Area - Native body scroll */}
      {/* Added pt-16 for desktop to account for fixed header */}
      <main className="flex-1 w-full max-w-7xl mx-auto md:pt-16 pb-20 md:pb-8 md:px-6 lg:px-8">
         <Outlet />
      </main>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      {!isPostPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center z-50 md:hidden safe-area-pb">
          <NavLink to="/" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors", isActive ? "text-blue-600" : "text-gray-400")}>
            <HiHome className="text-2xl" />
            <span>首页</span>
          </NavLink>
          
          <NavLink to="/market" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors", isActive ? "text-blue-600" : "text-gray-400")}>
            <HiShoppingBag className="text-2xl" />
            <span>市场</span>
          </NavLink>

          <NavLink to="/post" className="flex flex-col items-center -mt-6 group">
            <div className="bg-blue-600 rounded-full p-3 shadow-lg text-white transform transition-transform group-active:scale-95">
              <HiPlusCircle className="text-3xl" />
            </div>
            <span className="text-xs text-gray-500 mt-1">发布</span>
          </NavLink>

          <NavLink to="/messages" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors relative", isActive ? "text-blue-600" : "text-gray-400")}>
            <div className="relative">
              <HiChat className="text-2xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span>消息</span>
          </NavLink>

          <NavLink to="/profile" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors relative", isActive ? "text-blue-600" : "text-gray-400")}>
            <div className="relative">
              <HiUser className="text-2xl" />
              {isAdmin && <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-white"></span>}
            </div>
            <span>我的</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
