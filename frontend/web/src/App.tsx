import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Market from './pages/Market';
import BookDetail from './pages/BookDetail';
import Messages from './pages/Messages';
import ChatDetail from './pages/ChatDetail';
import UserProfile from './pages/UserProfile';
import Post from './pages/Post';
import './index.css';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { wsService } from './services/websocket';

export default function App() {
  useEffect(() => {
    // Initialize WebSocket connection
    wsService.connect();

    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="market" element={<Market />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="chats/:id" element={<ChatDetail />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="post" element={<Post />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
