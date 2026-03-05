import { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Market } from './pages/Market';
import { Post } from './pages/Post';
import { Messages } from './pages/Messages';
import { UserProfile } from './pages/UserProfile';
import { BookDetail } from './pages/BookDetail';
import { ChatDetail } from './pages/ChatDetail';
import { UsageInstructionsModal } from './components/UsageInstructionsModal';
import { AnimatePresence, motion } from 'motion/react';
import { User, BookItem, ChatSession, ChatMessage } from './data/mockData';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  
  // Initialize with empty/loading state
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [users, setUsers] = useState<Record<string, User>>({});
  const [books, setBooks] = useState<BookItem[]>([]);
  
  const [evaluatedBookIds, setEvaluatedBookIds] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show instructions on first load
    setShowInstructions(true);

    // Fetch initial data
    const fetchData = async () => {
      try {
        const data = await api.init();
        setUsers(data.users);
        setBooks(data.books);
        setChats(data.chats);
        setMessages(data.messages);
        if (data.users['me']) {
          setWishlist(data.users['me'].wishlist);
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleBookClick = (id: string) => {
    setSelectedBookId(id);
  };

  const handleChatClick = (id: string) => {
    setSelectedChatId(id);
  };

  const handleSellerClick = (sellerId: string) => {
    setViewingUserId(sellerId);
  };

  const handleToggleWishlist = async (bookId: string) => {
    // Optimistic update
    setWishlist(prev => {
      if (prev.includes(bookId)) {
        return prev.filter(id => id !== bookId);
      } else {
        return [...prev, bookId];
      }
    });
    
    try {
      await api.toggleWishlist(bookId);
    } catch (error) {
      console.error("Failed to toggle wishlist:", error);
      // Revert if needed (omitted for brevity)
    }
  };

  const handleStartChat = async (sellerId: string) => {
    if (sellerId === 'me') return;

    try {
      const chat = await api.startChat(sellerId);
      
      // Update local state if it's a new chat
      setChats(prev => {
        if (!prev.find(c => c.id === chat.id)) {
          return [...prev, chat];
        }
        return prev;
      });
      
      if (!messages[chat.id]) {
        setMessages(prev => ({ ...prev, [chat.id]: [] }));
      }

      setSelectedChatId(chat.id);
      setSelectedBookId(null);
      setViewingUserId(null);
      setActiveTab('messages');
    } catch (error) {
      console.error("Failed to start chat:", error);
    }
  };

  const handleSendMessage = async (chatId: string, text: string) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: tempId,
      senderId: 'me',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMessage]
    }));

    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, lastMessage: text, lastMessageTime: 'Now' }
        : chat
    ));

    try {
      const savedMessage = await api.sendMessage(chatId, text, 'me');
      // Replace temp message with real one
      setMessages(prev => ({
        ...prev,
        [chatId]: prev[chatId].map(m => m.id === tempId ? savedMessage : m)
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleEvaluate = async (sellerId: string, bookId: string, isGood: boolean) => {
    setEvaluatedBookIds(prev => [...prev, bookId]);
    
    try {
      const updatedSeller = await api.evaluateUser(sellerId, isGood);
      
      setUsers(prevUsers => ({
        ...prevUsers,
        [sellerId]: updatedSeller
      }));

      // If trust score dropped, update books locally
      if (updatedSeller.trustScore <= 60) {
        setBooks(prevBooks => prevBooks.filter(book => book.sellerId !== sellerId));
      }
    } catch (error) {
      console.error("Failed to evaluate user:", error);
    }
  };

  const handleBack = () => {
    if (selectedChatId) {
      setSelectedChatId(null);
      return;
    }
    if (viewingUserId) {
      setViewingUserId(null);
      return;
    }
    if (selectedBookId) {
      setSelectedBookId(null);
      return;
    }
  };

  const handleStartChatFromProfile = () => {
    if (viewingUserId) {
      handleStartChat(viewingUserId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  const handlePostBook = async (book: BookItem) => {
    try {
      const newBook = await api.postBook(book);
      setBooks(prev => [newBook, ...prev]);
      setUsers(prev => ({
        ...prev,
        [newBook.sellerId]: {
          ...prev[newBook.sellerId],
          listings: [...prev[newBook.sellerId].listings, newBook.id]
        }
      }));
      setActiveTab('home');
    } catch (error) {
      console.error("Failed to post book:", error);
    }
  };

  const renderContent = () => {
    if (selectedChatId) {
      const chat = chats.find(c => c.id === selectedChatId);
      if (!chat) return null;

      return (
        <ChatDetail 
          id={selectedChatId} 
          onBack={handleBack} 
          messages={messages[selectedChatId] || []}
          onSendMessage={(text) => handleSendMessage(selectedChatId, text)}
          chat={chat}
          onSellerClick={(sellerId) => {
            setViewingUserId(sellerId);
            setSelectedChatId(null);
          }}
          books={books}
          users={users}
        />
      );
    }

    if (viewingUserId) {
      return (
        <UserProfile 
          userId={viewingUserId} 
          onBack={handleBack} 
          onChat={handleStartChatFromProfile}
          onBookClick={handleBookClick}
          wishlist={viewingUserId === 'me' ? wishlist : undefined}
          onToggleWishlist={viewingUserId === 'me' ? handleToggleWishlist : undefined}
          user={users[viewingUserId]}
          books={books}
        />
      );
    }

    if (selectedBookId) {
      return (
        <BookDetail 
          id={selectedBookId} 
          onBack={handleBack} 
          onChat={(sellerId) => handleStartChat(sellerId)}
          onSellerClick={handleSellerClick}
          isWishlisted={wishlist.includes(selectedBookId)}
          onToggleWishlist={() => handleToggleWishlist(selectedBookId)}
          onEvaluate={(sellerId, isGood) => handleEvaluate(sellerId, selectedBookId, isGood)}
          isEvaluated={evaluatedBookIds.includes(selectedBookId)}
          book={books.find(b => b.id === selectedBookId)!}
          seller={users[books.find(b => b.id === selectedBookId)!.sellerId]}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home 
            onBookClick={handleBookClick} 
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            books={books}
            onShowInstructions={() => setShowInstructions(true)}
          />
        );
      case 'market':
        return (
          <Market 
            onBookClick={handleBookClick} 
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            books={books}
          />
        );
      case 'post':
        return <Post onBack={() => setActiveTab('home')} user={users['me']} onPostBook={handlePostBook} />;
      case 'messages':
        return (
          <Messages 
            onChatClick={handleChatClick} 
            chats={chats} 
            users={users} 
            onShowInstructions={() => setShowInstructions(true)}
            onUserClick={handleSellerClick}
          />
        );
      case 'profile':
        return (
          <UserProfile 
            userId="me" 
            onBookClick={handleBookClick}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            user={users['me']}
            books={books}
          />
        );
      default:
        return <Home onBookClick={handleBookClick} books={books} />;
    }
  };

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-sans pb-20 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <UsageInstructionsModal isOpen={showInstructions} onClose={() => setShowInstructions(false)} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedBookId ? 'book' : selectedChatId ? 'chat' : viewingUserId ? 'user' : activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {!selectedBookId && !selectedChatId && !viewingUserId && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}
