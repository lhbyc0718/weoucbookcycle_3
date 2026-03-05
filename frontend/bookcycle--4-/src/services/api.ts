import { User, BookItem, ChatSession, ChatMessage } from '../data/mockData';

const BASE = process.env.VITE_API_URL || '';

function buildHeaders() {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

// Transform backend User to frontend User format
function transformUser(backendUser: any): User {
  return {
    id: backendUser.id,
    name: backendUser.username || 'Unknown',
    avatar: backendUser.avatar || 'https://via.placeholder.com/150',
    verified: backendUser.email_verified || false,
    rating: 0, // Not available from backend, use 0 as default
    ratingCount: 0,
    sales: backendUser.listings?.length || 0,
    trustScore: backendUser.trust_score || 80,
    joinDate: backendUser.created_at ? new Date(backendUser.created_at).getFullYear().toString() : '2024',
    rank: backendUser.trust_score >= 90 ? 'Gold Trader' : backendUser.trust_score >= 70 ? 'Silver Trader' : 'New',
    bio: backendUser.bio || '',
    location: backendUser.phone || '',
    wishlist: backendUser.wishlist ? JSON.parse(backendUser.wishlist) : [],
    listings: backendUser.listings?.map((l: any) => l.id) || [],
  };
}

// Transform backend Book to frontend BookItem format
function transformBook(backendBook: any): BookItem {
  return {
    id: backendBook.id,
    title: backendBook.title,
    author: backendBook.author || 'Unknown',
    cover: backendBook.images?.[0] || 'https://via.placeholder.com/300',
    price: backendBook.price,
    originalPrice: backendBook.original_price,
    condition: backendBook.condition || '未知',
    sellerId: backendBook.seller_id,
    description: backendBook.description || '',
    category: backendBook.category || '其他',
    tags: [],
    location: '未提供',
    shippingTime: '3-5天',
    images: backendBook.images || [],
    isbn: backendBook.isbn,
  };
}

export const api = {
  init: async () => {
    // Fetch public books and active users, then chats/messages if authenticated
    const booksRes = await fetch(`${BASE}/api/books`);
    const booksData = await booksRes.json();
    const books = (Array.isArray(booksData) ? booksData : booksData.books || []).map(transformBook);

    const usersRes = await fetch(`${BASE}/api/users/active`);
    const usersPayload = await usersRes.json();
    const usersArray = usersPayload.users || usersPayload || [];
    const users: Record<string, User> = {};
    if (Array.isArray(usersArray)) {
      usersArray.forEach((u: any) => (users[u.id] = transformUser(u)));
    }

    const token = localStorage.getItem('token');
    let chats: ChatSession[] = [];
    let messages: Record<string, ChatMessage[]> = {};

    if (token) {
      const headers = buildHeaders();
      const meRes = await fetch(`${BASE}/api/users/me`, { headers });
      if (meRes.ok) {
        const me = await meRes.json();
        users['me'] = transformUser(me);
      }

      const chatsRes = await fetch(`${BASE}/api/chats`, { headers });
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json();
        chats = Array.isArray(chatsData) ? chatsData : chatsData.chats || [];
        // load messages for each chat
        await Promise.all(chats.map(async (c: any) => {
          const mRes = await fetch(`${BASE}/api/chats/${c.id}/messages`, { headers });
          if (mRes.ok) {
            const msgsData = await mRes.json();
            messages[c.id] = Array.isArray(msgsData) ? msgsData : msgsData.messages || [];
          } else {
            messages[c.id] = [];
          }
        }));
      }
    }

    return {
      users,
      books,
      chats,
      messages,
    } as {
      users: Record<string, User>;
      books: BookItem[];
      chats: ChatSession[];
      messages: Record<string, ChatMessage[]>;
    };
  },

  postBook: async (book: BookItem) => {
    const headers = buildHeaders();
    const payload = {
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      price: book.price,
      description: book.description,
      images: book.images,
      condition: book.condition,
    };
    const res = await fetch(`${BASE}/api/books`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const backendBook = await res.json();
    return transformBook(backendBook);
  },

  startChat: async (sellerId: string) => {
    const headers = buildHeaders();
    const res = await fetch(`${BASE}/api/chats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: sellerId }),
    });
    const data = await res.json();
    return data as ChatSession;
  },

  sendMessage: async (chatId: string, text: string, senderId: string) => {
    const headers = buildHeaders();
    const res = await fetch(`${BASE}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: text }),
    });
    return res.json() as Promise<ChatMessage>;
  },

  evaluateUser: async (sellerId: string, isGood: boolean) => {
    const headers = buildHeaders();
    const res = await fetch(`${BASE}/api/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ seller_id: sellerId, is_good: isGood }),
    });
    const backendUser = await res.json();
    return transformUser(backendUser);
  },

  toggleWishlist: async (bookId: string) => {
    const headers = buildHeaders();
    const res = await fetch(`${BASE}/api/users/wishlist/toggle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookId }),
    });
    return res.json() as Promise<string[]>; // Returns updated wishlist
  }
};
