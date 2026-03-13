import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { HiHome, HiShoppingBag, HiChat, HiPlusCircle, HiUser, HiChartPie, HiBell } from 'react-icons/hi';
import clsx from 'clsx';
import { useChatStore } from '../store/chatStore';
import { useEffect, useState } from 'react';
import { userApi, transactionApi, chatApi, notificationApi } from '../services/api';
import { wsService } from '../services/websocket';
import { useAuth } from '../hooks/useAuth';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPostPage = location.pathname === '/post';
  const unreadCount = useChatStore(state => state.unreadCount);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isAuthenticated } = useAuth();
  const [txUnread, setTxUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  useEffect(() => {
    // 检查用户角色
    const checkRole = async () => {
      if (!isAuthenticated) {
          setIsAdmin(false);
          return;
      }
      try {
        const user = await userApi.getMyProfile();
        // @ts-ignore
        const roles = user.roles || [];
        // @ts-ignore
        setIsAdmin(roles.includes('admin') || user.role === 'admin');
      } catch (e: any) {
        console.error("Failed to fetch user profile", e);
        // 如果是404或资源不存在，说明用户可能已被删除或Token失效
        if (e.message && (e.message.includes('不存在') || e.message.includes('404'))) {
           localStorage.removeItem('authToken');
           localStorage.removeItem('userInfo');
           window.location.href = '/login';
        }
      }
    };
    checkRole();
    
    // 获取交易未读数（若后端未提供该接口，静默失败）
    const fetchTxUnread = async () => {
      try {
        const res = await transactionApi.getUnreadCount();
        const data = (res as any).data ?? res;
        if (typeof data.unread_tx === 'number') {
          setTxUnread(data.unread_tx);
        } else if (typeof data.total_unread === 'number') {
          // 兼容返回字段名不同的情况
          setTxUnread(data.total_unread);
        }
      } catch (e) {
        // 忽略错误（后端可能尚未实现该接口）
      }
    };

    // 获取消息未读数
    const fetchChatUnread = async () => {
        try {
            const res = await chatApi.getChats();
            const chats = Array.isArray(res) ? res : ((res as any).chats || (res as any).data || []);
            let total = 0;
            chats.forEach((c: any) => {
                const count = c.unread_count || c.UnreadCount || (c.chat && (c.chat.unread_count || c.chat.UnreadCount)) || 0;
                total += count;
            });
            // Update store directly if needed, or rely on store action
            useChatStore.getState().setUnreadCount(total);
        } catch (e) { console.error(e); }
    };

    if (isAuthenticated) {
        fetchTxUnread();
        fetchChatUnread();
        // 获取通知未读数
        (async () => {
          try {
            const n = await notificationApi.getUnreadCount();
            setNotifUnread(typeof n === 'number' ? n : 0);
          } catch (e) {
            // ignore
          }
        })();
    }

    // 订阅 websocket 上的交易事件，实时更新未读数（后端需发送 type:'transaction' 消息）
    const onTransactionEvent = (d: any) => {
      // 如果事件来自当前用户发出，则不计入未读
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const currentUserId = userInfo.id;
      if (d.sender_id === currentUserId || d.from === currentUserId) return;
      setTxUnread(prev => prev + 1);
    };

    // 订阅 websocket 上的消息事件，实时更新消息未读数
    const onMessageEvent = (d: any) => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserId = userInfo.id;
        // 只有别人发给我的消息才增加未读数
        // 且如果当前不在该聊天窗口中（activeChat check inside store logic or here）
        if (d.sender_id !== currentUserId && d.from !== currentUserId) {
             const activeChatId = useChatStore.getState().activeChat?.id;
             // 如果当前没有打开该聊天，则增加未读数
             if (activeChatId !== d.chat_id) {
                 useChatStore.getState().incrementUnreadCount();
             }
        }
    };

    // 通知事件
    const onNotificationEvent = (d: any) => {
      // payload structure: { type: 'notification', data: {...}, ... }
      try {
        const payload = (d && d.data) ? d.data : d;
        const action = payload && payload.action ? payload.action : payload.data && payload.data.action ? payload.data.action : null;

        if (action === 'created' || action === null) {
          setNotifUnread(prev => prev + 1);
          // dispatch event so Notifications page can prepend
          window.dispatchEvent(new CustomEvent('notification:received', { detail: payload }));
          const title = '新通知';
          const body = payload && payload.type ? (payload.type + ' 有更新') : '您有新的通知';
          if (window.Notification && Notification.permission === 'granted') {
            new Notification(title, { body });
          }
        } else if (action === 'read') {
          // another session marked this notification as read
          // reduce count or refresh
          setNotifUnread(prev => Math.max(0, prev - 1));
          window.dispatchEvent(new CustomEvent('notification:read', { detail: payload }));
        } else if (action === 'mark_all_read') {
          setNotifUnread(0);
          window.dispatchEvent(new CustomEvent('notification:marked_all'));
        }
      } catch (e) {
        console.error('notification event parse error', e);
      }
    };

    // 监听已读事件（当在其他窗口已读时）
    const onReadEvent = () => {
        // 简单处理：重新拉取一次未读数
        fetchChatUnread();
    };

    wsService.subscribe('transaction', onTransactionEvent);
    wsService.subscribe('message', onMessageEvent);
    wsService.subscribe('read', onReadEvent);
    wsService.subscribe('notification', onNotificationEvent);

    // 监听前端触发的清除事件（例如访问 /transactions 后触发）
    const onCleared = () => setTxUnread(0);
    window.addEventListener('transactions:cleared', onCleared);
    
    // 监听新消息事件（从 ChatDetail 发出）
    const onNewMessage = (e: any) => {
        const detail = (e as CustomEvent).detail;
        // 如果不在该聊天中，增加未读
        const activeChatId = useChatStore.getState().activeChat?.id;
        if (activeChatId !== detail.chatId) {
            useChatStore.getState().incrementUnreadCount();
        }
    };
    window.addEventListener('chat:new-message', onNewMessage);

    return () => {
      wsService.unsubscribe('transaction', onTransactionEvent);
      wsService.unsubscribe('message', onMessageEvent);
      wsService.unsubscribe('read', onReadEvent);
      wsService.unsubscribe('notification', onNotificationEvent);
      window.removeEventListener('transactions:cleared', onCleared);
      window.removeEventListener('chat:new-message', onNewMessage);
    };
  }, [isAuthenticated]);

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
              {isAuthenticated && (
                <>
                  <NavLink to="/messages" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600 relative", isActive ? "text-blue-600" : "text-gray-600")}>
                    消息
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                  <NavLink to="/transactions" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600 relative", isActive ? "text-blue-600" : "text-gray-600")}>
                    我的交易
                    {txUnread > 0 && (
                      <span className="absolute -top-1 -right-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {txUnread > 99 ? '99+' : txUnread}
                      </span>
                    )}
                  </NavLink>
                  <NavLink to="/notifications" className={({ isActive }) => clsx("text-sm font-medium transition-colors hover:text-blue-600 relative flex items-center gap-2", isActive ? "text-blue-600" : "text-gray-600")}>
                    <HiBell className="text-lg" />
                    <span className="sr-only">通知</span>
                    {notifUnread > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {notifUnread > 99 ? '99+' : notifUnread}
                      </span>
                    )}
                  </NavLink>
                </>
              )}
              {isAuthenticated && isAdmin && (
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

            {!isAuthenticated && (
              <div className="flex items-center gap-3 border-l pl-4 border-gray-200">
                <NavLink to="/login" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors px-3 py-2">
                  登录
                </NavLink>
                <NavLink to="/login" state={{ isRegister: true }} className="bg-white text-blue-600 border border-blue-600 px-5 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm hover:shadow active:scale-95 transform">
                  注册
                </NavLink>
              </div>
            )}
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

          <NavLink to="/transactions" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors relative", isActive ? "text-blue-600" : "text-gray-400")}>
            <div className="relative">
              <HiShoppingBag className="text-2xl" />
              {txUnread > 0 && (
                <span className="absolute -top-1 -right-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
                  {txUnread > 99 ? '99+' : txUnread}
                </span>
              )}
            </div>
            <span>交易</span>
          </NavLink>

          {/* Mobile bell icon */}
          <button onClick={() => { navigate('/notifications'); if (window.Notification && Notification.permission !== 'granted') Notification.requestPermission(); }} className={clsx("flex flex-col items-center space-y-1 text-xs transition-colors relative", "text-gray-400")}>
            <div className="relative">
              <HiBell className="text-2xl" />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border-2 border-white">
                  {notifUnread > 99 ? '99+' : notifUnread}
                </span>
              )}
            </div>
            <span>通知</span>
          </button>

          <NavLink to="/profile" className={({ isActive }) => clsx("flex flex-col items-center space-y-1 text-xs transition-colors relative", isActive ? "text-blue-600" : "text-gray-400")}>
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
