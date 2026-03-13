import { create } from 'zustand';

interface Chat {
  id: string;
  name?: string;
  avatar?: string;
  last_message?: string;
  updated_at?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  chat_id: string;
}

interface ChatStore {
  chats: Chat[];
  activeChat: Chat | null;
  unreadCount: number;
  socketConnected: boolean;

  setChats: (chats: Chat[]) => void;
  setActiveChat: (chat: Chat | null) => void;
  setUnreadCount: (count: number) => void;
  setSocketConnected: (connected: boolean) => void;
  
  updateChatMessage: (chatId: string, message: Message) => void;
  incrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: [],
  activeChat: null,
  unreadCount: 0,
  socketConnected: false,

  setChats: (chats) => set({ chats }),
  setActiveChat: (chat) => set({ activeChat: chat }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setSocketConnected: (connected) => set({ socketConnected: connected }),

  updateChatMessage: (chatId, message) => set((state) => {
    const updatedChats = state.chats.map((c) => {
      if (c.id === chatId) {
        return {
          ...c,
          last_message: message.content,
          updated_at: message.created_at,
        };
      }
      return c;
    });
    
    // Sort chats by updated_at desc
    updatedChats.sort((a, b) => {
      const timeA = new Date(a.updated_at || 0).getTime();
      const timeB = new Date(b.updated_at || 0).getTime();
      return timeB - timeA;
    });

    return { chats: updatedChats };
  }),

  incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnreadCount: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));
