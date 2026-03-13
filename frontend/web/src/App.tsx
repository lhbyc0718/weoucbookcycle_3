import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Market from './pages/Market';
import BookDetail from './pages/BookDetail';
import Messages from './pages/Messages';
import ChatDetail from './pages/ChatDetail';
import UserProfile from './pages/UserProfile';
import OtherUserProfile from './pages/OtherUserProfile';
import AdminDashboard from './pages/AdminDashboard';
import AdminAddresses from './pages/AdminAddresses';
import AdminUsers from './pages/AdminUsers';
import AdminBooks from './pages/AdminBooks';
import AdminTransactions from './pages/AdminTransactions';
import AdminReports from './pages/AdminReports';
import Post from './pages/Post';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import './index.css';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

import { wsService } from './services/websocket';
import { useChatStore } from './store/chatStore';
import { chatApi } from './services/api';
import MyTransactions from './pages/MyTransactions';
import TransactionDetail from './pages/TransactionDetail';
import Notifications from './pages/Notifications';

export default function App() {
  const { incrementUnreadCount, setUnreadCount } = useChatStore();

  useEffect(() => {
    // Initialize WebSocket connection if logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        wsService.connect();
    }

    // Listen for login event (e.g. from Login page)
    const handleLogin = () => {
        wsService.connect();
        fetchUnread();
    };
    window.addEventListener('auth:login', handleLogin);

    // Subscribe to messages for global unread count
    const handleMessage = (data: any) => {
      // 获取当前用户ID
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const currentUserId = userInfo.id;

      // 如果是自己发送的消息，不增加未读数
      if (data.sender_id === currentUserId || data.from === currentUserId) {
        return;
      }

      // 如果不在当前会话页面，则增加未读数
      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/chats/${data.chat_id}`)) {
        incrementUnreadCount();
      }
    };

    wsService.subscribe('message', handleMessage);

    // Fetch initial unread count
    const fetchUnread = async () => {
        try {
            const res = await chatApi.getUnreadCount();
            const data = (res as any).data || res;
            if (typeof data.total_unread === 'number') {
                setUnreadCount(data.total_unread);
            }
        } catch (e) {
            console.error("Failed to fetch unread count", e);
        }
    };
    
    if (token) {
        fetchUnread();
    }

    return () => {
      window.removeEventListener('auth:login', handleLogin);
      wsService.unsubscribe('message', handleMessage);
      wsService.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="market" element={<Market />} />
          <Route path="books/:id" element={
            <PrivateRoute>
              <BookDetail />
            </PrivateRoute>
          } />
          
          {/* Protected Routes */}
          <Route path="messages" element={
            <PrivateRoute>
              <Messages />
            </PrivateRoute>
          } />
          <Route path="chats/:id" element={
            <PrivateRoute>
              <ChatDetail />
            </PrivateRoute>
          } />
          <Route path="profile" element={
            <PrivateRoute>
              <UserProfile />
            </PrivateRoute>
          } />
          <Route path="transactions" element={
            <PrivateRoute>
              <MyTransactions />
            </PrivateRoute>
          } />
          <Route path="transactions/:id" element={
            <PrivateRoute>
              <TransactionDetail />
            </PrivateRoute>
          } />
          <Route path="notifications" element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          } />
          <Route path="users/:id" element={<OtherUserProfile />} />
          <Route path="admin" element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          } />
          <Route path="admin/users" element={
            <PrivateRoute>
              <AdminUsers />
            </PrivateRoute>
          } />
          <Route path="admin/books" element={
            <PrivateRoute>
              <AdminBooks />
            </PrivateRoute>
          } />
          <Route path="admin/transactions" element={
            <PrivateRoute>
              <AdminTransactions />
            </PrivateRoute>
          } />
          <Route path="admin/reports" element={
            <PrivateRoute>
              <AdminReports />
            </PrivateRoute>
          } />
          <Route path="admin/addresses" element={
            <PrivateRoute>
              <AdminAddresses />
            </PrivateRoute>
          } />
          <Route path="post" element={
            <PrivateRoute>
              <Post />
            </PrivateRoute>
          } />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
