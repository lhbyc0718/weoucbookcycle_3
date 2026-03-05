import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { HiHome, HiShoppingBag, HiChat, HiPlusCircle, HiUser } from 'react-icons/hi';
import clsx from 'clsx';

export default function MainLayout() {
  const location = useLocation();
  const isPostPage = location.pathname === '/post';

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
              <NavLink to="/messages" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600", isActive ? "text-blue-600" : "text-gray-600")}>消息</NavLink>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <NavLink to="/post" className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow active:scale-95 transform">
              <HiPlusCircle className="text-lg" />
              <span>发布书籍</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => clsx("p-2 rounded-full transition-colors flex items-center justify-center w-10 h-10", isActive ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-blue-600 hover:bg-gray-100")}>
              <HiUser className="text-xl" />
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

          <NavLink to="/messages" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors", isActive ? "text-blue-600" : "text-gray-400")}>
            <HiChat className="text-2xl" />
            <span>消息</span>
          </NavLink>

          <NavLink to="/profile" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors", isActive ? "text-blue-600" : "text-gray-400")}>
            <HiUser className="text-2xl" />
            <span>我的</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
