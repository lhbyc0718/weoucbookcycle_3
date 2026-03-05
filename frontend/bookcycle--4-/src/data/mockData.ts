import { 
  Book, 
  BookOpen, 
  ShoppingBag, 
  MessageCircle, 
  User, 
  Search, 
  ScanLine, 
  Bell, 
  Grid, 
  List, 
  Filter, 
  ChevronLeft, 
  MoreVertical, 
  Heart, 
  Share, 
  CheckCircle2, 
  Star, 
  MapPin, 
  Truck, 
  Send, 
  Plus, 
  Home, 
  LayoutGrid, 
  TrendingUp, 
  Wallet, 
  Settings, 
  ShieldCheck, 
  Award, 
  ChevronRight,
  Camera,
  X
} from 'lucide-react';

export interface User {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  sales: number;
  trustScore: number;
  joinDate: string;
  rank: string;
  bio?: string;
  location?: string;
  wishlist: string[]; // Array of Book IDs or generic terms
  listings: string[]; // Array of Book IDs
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  cover: string;
  price: number;
  originalPrice?: number;
  condition: string; // e.g., "95% New", "Like New"
  sellerId: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
  shippingTime: string;
  images: string[];
  isbn?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isImage?: boolean;
  imageUrl?: string;
}

export interface ChatSession {
  id: string;
  participants: string[]; // User IDs
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  bookId?: string; // Context book
}

// Mock Users
export const users: Record<string, User> = {
  'me': {
    id: 'me',
    name: 'BookLover_99',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    verified: true,
    rating: 0,
    ratingCount: 12,
    sales: 42,
    trustScore: 100,
    joinDate: '2021',
    rank: 'Gold Trader',
    bio: 'Passionate about sci-fi and history books. Always looking for rare editions.',
    location: 'Shanghai, CN',
    wishlist: ['The Three-Body Problem', 'Dune'],
    listings: []
  },
  'alex': {
    id: 'alex',
    name: 'Alex Reads',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop',
    verified: true,
    rating: 0,
    ratingCount: 48,
    sales: 156,
    trustScore: 100,
    joinDate: '2021',
    rank: 'Silver Trader',
    bio: 'Design student selling textbooks and design resources.',
    location: 'Shanghai, CN',
    wishlist: ['Universal Principles of Design'],
    listings: ['1', '2', '4']
  },
  'sarah': {
    id: 'sarah',
    name: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    verified: true,
    rating: 0,
    ratingCount: 35,
    sales: 89,
    trustScore: 100,
    joinDate: '2022',
    rank: 'Silver Trader',
    bio: 'History buff. Selling books I have finished reading.',
    location: 'Beijing, CN',
    wishlist: ['Guns, Germs, and Steel'],
    listings: ['3', '5']
  }
};

// Mock Books
export const books: BookItem[] = [
  {
    id: '1',
    title: 'The Great Gatsby (Hardcover)',
    author: 'F. Scott Fitzgerald',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
    price: 25,
    condition: '98% New',
    sellerId: 'alex',
    description: 'Classic hardcover edition. Barely read, spine is perfect. No markings inside.',
    category: 'Literature',
    tags: ['Classic', 'Fiction'],
    location: 'Shanghai, CN',
    shippingTime: 'Ships within 24h',
    images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=1200&fit=crop'],
    isbn: '9780743273565'
  },
  {
    id: '2',
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=600&fit=crop',
    price: 45,
    condition: 'Like New',
    sellerId: 'alex',
    description: 'Original English version, bought 2 months ago for a design course. The book is in excellent condition with no markings or dog-eared pages inside.',
    category: 'Design',
    tags: ['UX', 'Design', 'Textbook'],
    location: 'Shanghai, CN',
    shippingTime: 'Ships within 24h',
    images: ['https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&h=1200&fit=crop'],
    isbn: '9780465050659'
  },
  {
    id: '3',
    title: 'Sapiens: A Brief History',
    author: 'Yuval Noah Harari',
    cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop',
    price: 35,
    condition: 'New',
    sellerId: 'sarah',
    description: 'Brand new copy, unwanted gift.',
    category: 'History',
    tags: ['History', 'Bestseller'],
    location: 'Beijing, CN',
    shippingTime: 'Ships within 48h',
    images: ['https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800&h=1200&fit=crop'],
    isbn: '9780062316097'
  },
  {
    id: '4',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop',
    price: 55,
    condition: '99% New',
    sellerId: 'alex',
    description: 'Essential for any developer. Kept in great condition.',
    category: 'Tech',
    tags: ['Programming', 'Computer Science'],
    location: 'Shenzhen, CN',
    shippingTime: 'Ships within 24h',
    images: ['https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&h=1200&fit=crop'],
    isbn: '9780132350884'
  },
  {
    id: '5',
    title: 'Atomic Design Systems',
    author: 'Brad Frost',
    cover: 'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=400&h=600&fit=crop',
    price: 42,
    condition: '92% New',
    sellerId: 'sarah',
    description: 'Great resource for UI designers.',
    category: 'Design',
    tags: ['Design', 'System'],
    location: 'Hangzhou, CN',
    shippingTime: 'Ships within 24h',
    images: ['https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=800&h=1200&fit=crop'],
    isbn: '9780998296609'
  }
];

// Mock Chats
export const chats: ChatSession[] = [
  {
    id: '1',
    participants: ['me', 'alex'],
    lastMessage: 'I can send a close-up photo if you\'d like?',
    lastMessageTime: '10:26 AM',
    unreadCount: 0,
    bookId: '2'
  },
  {
    id: '2',
    participants: ['me', 'sarah'],
    lastMessage: 'Is the book "Sapiens" still available?',
    lastMessageTime: '10:42 AM',
    unreadCount: 1,
    bookId: '3'
  }
];

export const messages: Record<string, ChatMessage[]> = {
  '1': [
    {
      id: 'm1',
      senderId: 'alex',
      text: 'Hi! I saw you\'re interested in this book. It\'s still available.',
      timestamp: '10:23 AM'
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Hello! Yes, I\'ve been looking for this edition specifically. Is the spine condition really as good as new?',
      timestamp: '10:25 AM'
    },
    {
      id: 'm3',
      senderId: 'alex',
      text: 'Absolutely. I bought it for a course but ended up using the digital version mostly. It\'s been sitting on my shelf. I can send a close-up photo if you\'d like?',
      timestamp: '10:26 AM'
    }
  ],
  '2': [
    {
      id: 'm4',
      senderId: 'me',
      text: 'Is the book "Sapiens" still available?',
      timestamp: '10:42 AM'
    },
    {
      id: 'm5',
      senderId: 'sarah',
      text: 'Yes, it is! I can ship it tomorrow.',
      timestamp: '10:45 AM'
    }
  ]
};
