import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Market from './pages/Market';
import BookDetail from './pages/BookDetail';
import Messages from './pages/Messages';
import ChatDetail from './pages/ChatDetail';
import UserProfile from './pages/UserProfile';
import AdminDashboard from './pages/AdminDashboard';
import Post from './pages/Post';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import './index.css';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { wsService } from './services/websocket';
import { useChatStore } from './store/chatStore';
import { chatApi } from './services/api';
import LoginModal from './components/LoginModal';

export default function App() {
  const { incrementUnreadCount, setUnreadCount } = useChatStore();
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection if logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        wsService.connect();
    }

    // Listen for auth errors
    const handleAuthError = () => setShowLoginModal(true);
    window.addEventListener('auth:unauthorized', handleAuthError);

    // Listen for login event (e.g. from Login page)
    const handleLogin = () => {
        wsService.connect();
        fetchUnread();
    };
    window.addEventListener('auth:login', handleLogin);

    // Subscribe to messages for global unread count
    const handleMessage = (data: any) => {
      // If we are not in the chat where the message belongs, increment unread
      // Note: Active chat checking should be done, but for now simple increment
      // Ideally we check if we are on the chat page for that chatID
      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/chats/${data.chat_id}`)) {
         incrementUnreadCount(data.chat_id);
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
      window.removeEventListener('auth:unauthorized', handleAuthError);
      window.removeEventListener('auth:login', handleLogin);
      wsService.unsubscribe('message', handleMessage);
      wsService.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
            setShowLoginModal(false);
            wsService.connect(); // Reconnect socket after login
            window.location.reload(); // Simple way to refresh state
        }} 
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="market" element={<Market />} />
          <Route path="books/:id" element={<BookDetail />} />
          
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
          <Route path="admin" element={
            <PrivateRoute>
              <AdminDashboard />
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
