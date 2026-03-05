import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { dbOps } from './src/db';
import './src/seed';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/init', (req, res) => {
    res.json({
      users: dbOps.getAllUsers(),
      books: dbOps.getAllBooks(),
      chats: dbOps.getAllChats(),
      messages: dbOps.getMessages()
    });
  });

  app.get('/api/books', (req, res) => {
    res.json(dbOps.getAllBooks());
  });

  app.post('/api/books', (req, res) => {
    const newBook = req.body;
    dbOps.addBook(newBook);
    
    // Update user listings
    const user = dbOps.getUser(newBook.sellerId);
    if (user) {
      user.listings.push(newBook.id);
      dbOps.upsertUser(user);
    }
    
    res.json(newBook);
  });

  app.post('/api/chats', (req, res) => {
    const { sellerId } = req.body;
    const chats = dbOps.getAllChats();
    const existingChat = chats.find(c => c.participants.includes(sellerId) && c.participants.includes('me'));
    
    if (existingChat) {
      res.json(existingChat);
    } else {
      const newChat = {
        id: `c${Date.now()}`,
        participants: ['me', sellerId],
        lastMessage: '',
        lastMessageTime: 'Now',
        unreadCount: 0
      };
      dbOps.addChat(newChat);
      res.json(newChat);
    }
  });

  app.post('/api/messages', (req, res) => {
    const { chatId, text, senderId } = req.body;
    const newMessage = {
      id: `m${Date.now()}`,
      chatId,
      senderId,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    dbOps.addMessage(newMessage);

    // Update chat last message
    dbOps.updateChat(chatId, text, 'Now');

    res.json(newMessage);
  });

  app.post('/api/evaluate', (req, res) => {
    const { sellerId, isGood } = req.body;
    const seller = dbOps.getUser(sellerId);
    
    if (seller) {
      const newRating = isGood ? seller.rating + 1 : seller.rating - 1;
      const newTrustScore = isGood ? seller.trustScore : Math.max(0, seller.trustScore - 10);
      
      const updatedSeller = {
        ...seller,
        rating: newRating,
        trustScore: newTrustScore
      };

      dbOps.upsertUser(updatedSeller);

      if (newTrustScore <= 60) {
        dbOps.deleteBooksBySeller(sellerId);
        updatedSeller.listings = [];
        dbOps.upsertUser(updatedSeller);
      }
      
      res.json(updatedSeller);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/wishlist/toggle', (req, res) => {
    const { bookId } = req.body;
    const me = dbOps.getUser('me');
    if (me.wishlist.includes(bookId)) {
      me.wishlist = me.wishlist.filter(id => id !== bookId);
    } else {
      me.wishlist.push(bookId);
    }
    dbOps.upsertUser(me);
    res.json(me.wishlist);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
