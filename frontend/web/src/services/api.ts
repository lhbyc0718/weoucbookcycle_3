import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { saveNotificationsToCache } from '../utils/notificationsCache';

// 定义标准 API 响应结构
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 优先使用环境变量，如果没有则回退到默认值
// 注意：在生产环境中，必须正确设置环境变量，否则会连接到localhost导致失败
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use(
  (config) => {
    // 优先从 localStorage 获取 (兼容现有逻辑)，同时也支持 HttpOnly Cookie (浏览器自动携带)
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理401和错误
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 统一解包：如果后端返回标准格式，直接返回 data 字段
    // 这样前端组件拿到的直接是业务数据
    if (response.data && typeof response.data.code !== 'undefined') {
      const { code, data, message } = response.data as ApiResponse;
      if (code === 20000) {
        return data; // 直接返回业务数据 T
      }
      // 业务逻辑错误
      return Promise.reject(new Error(message || '请求失败'));
    }
    
    // 如果没有 code 字段，假设直接返回数据 (兼容旧接口或非标准接口)
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 网络错误或超时
    if (!error.response) {
      console.error('Network Error:', error);
      // 可以触发全局提示，如 toast.error("网络连接失败")
      return Promise.reject(new Error('网络连接失败，请检查您的网络设置'));
    }

    const status = error.response.status;

    // 处理 401 Unauthorized (Token过期)
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // 优化 Token 刷新逻辑，避免强制跳转
      try {
        const newToken = await refreshToken();
        // 确保原请求头中 Authorization 更新
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        // 使用原始 axios 实例重试，但要确保它不再走 refresh 逻辑（_retry已设置）
        // 这里必须用 axios(originalRequest) 而不是 apiClient，
        // 或者确保 apiClient 能正确处理 _retry 标记（通常 axios 拦截器会保留 config）
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败，可能是 refresh token 也过期了
        // 此时才清除本地状态并跳转
        // 建议使用事件通知 UI 弹出登录框，而不是直接跳转，以保护用户当前输入
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        
        // 触发全局事件，让 App 组件处理登录弹窗或跳转
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        
        // 抛出错误，让调用方知道失败了
        return Promise.reject(refreshError);
      }
    }
    
    // 处理 403 Forbidden
    if (status === 403) {
      return Promise.reject(new Error('您没有权限执行此操作'));
    }

    // 处理 404 Not Found
    if (status === 404) {
      return Promise.reject(new Error('请求的资源不存在'));
    }

    // 处理 429 Too Many Requests - 自动重试（指数退避），避免客户端在短时间内被硬性拒绝
    if (status === 429) {
      // 最大重试次数
      const maxRetries = 3;
      originalRequest._retry429Count = originalRequest._retry429Count || 0;
      if (originalRequest._retry429Count >= maxRetries) {
        return Promise.reject(new Error('请求过于频繁，请稍后再试'));
      }
      originalRequest._retry429Count++;
      // 指数退避：等待 200 * 2^(n-1) 毫秒
      const waitMs = 200 * Math.pow(2, originalRequest._retry429Count - 1);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      try {
        return apiClient(originalRequest);
      } catch (e) {
        return Promise.reject(new Error('请求过于频繁，请稍后再试'));
      }
    }

    // 处理 500 Internal Server Error (在开发模式下允许显示具体错误)
    if (status >= 500 && import.meta.env.MODE === 'production') {
      return Promise.reject(new Error('服务器内部错误，请联系客服'));
    }
    
    // 其他错误，返回后端给出的错误信息
    const errorMessage = error.response?.data?.message || error.message || '未知错误';
    console.error('API Error:', errorMessage);
    
    // 使用 react-hot-toast 显示错误提示
    // 优化：避免网络波动时的弹窗轰炸
    // 1. 忽略 401 (已在上方处理)
    // 2. 忽略 "取消请求" (CanceledError)
    if (status !== 401 && error.code !== 'ERR_CANCELED') {
        // 简单的防抖机制：避免同一错误短时间内多次弹出
        const errorKey = `toast:${errorMessage}`;
        const lastShown = sessionStorage.getItem(errorKey);
        const now = Date.now();
        
        if (!lastShown || (now - parseInt(lastShown)) > 3000) {
            // 如果是登录/注册页面的 401 错误，不弹窗（交给页面逻辑处理）
            const isAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
            if (!(status === 401 && isAuthPage)) {
                toast.error(errorMessage);
                sessionStorage.setItem(errorKey, now.toString());
            }
        }
    }
    
    return Promise.reject(new Error(errorMessage));
  }
);

// Token刷新
async function refreshToken(): Promise<string> {
  try {
    // 使用新的axios实例以避免拦截器死循环
    const response = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
      withCredentials: true
    });
    // Handle both wrapper and direct formats for refresh token too
    const data = response.data.code === 20000 ? response.data.data : response.data;
    const newToken = data.token;
    localStorage.setItem('authToken', newToken);
    return newToken;
  } catch (error) {
    throw error;
  }
}

// 将后端的书籍对象规范化，统一字段名（例如 view_count -> views）
function normalizeBook(b: any) {
  if (!b) return b;
  const book = { ...b };
  // 兼容不同字段命名
  book.views = book.view_count ?? book.views ?? 0;
  book.likes = book.likes ?? book.like_count ?? 0;
  // sellerId 兼容 seller.id 或 seller_id
  book.sellerId = book.seller_id ?? book.seller?.id ?? book.sellerId ?? (book.seller && book.seller.id);
  return book;
}

// 认证API
export const authApi = {
  getCaptcha: () =>
    apiClient.get('/api/auth/captcha'),
  wechatLogin: (code: string) => 
    apiClient.post('/api/auth/wechat', { code }),
  login: (data: any) => 
    apiClient.post('/api/auth/login', data),
  register: (data: any) => 
    apiClient.post('/api/auth/register', data),
  completeRegistration: (data: any) =>
    apiClient.post('/api/auth/complete-registration', data),
  logout: () => 
    apiClient.post('/api/auth/logout', {}),
  sendPasswordReset: (data: any) =>
    apiClient.post('/api/auth/send-password-reset', data),
  verifyEmail: (data: any) =>
    apiClient.post('/api/auth/verify-email', data),
  resetPassword: (data: any) =>
    apiClient.post('/api/auth/reset-password', data),
  updatePassword: (data: any) =>
    apiClient.post('/api/auth/update-password', data),
};

// 上传API
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  uploadFiles: (files: FileList | File[]) => {
    const formData = new FormData();
    if (files instanceof FileList) {
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }
    } else {
      files.forEach(file => formData.append('file', file));
    }
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// 书籍API
export const bookApi = {
  getBooks: (params?: any) =>
    apiClient.get('/api/books', { params }).then((data: any) => {
      const list = Array.isArray(data) ? data : data.books || data.data || [];
      return list.map(normalizeBook);
    }),
  getHotBooks: () =>
    apiClient.get('/api/books/hot').then((data: any) => {
      const list = Array.isArray(data) ? data : data.books || data.data || [];
      return list.map(normalizeBook);
    }),
  getRecommendations: () =>
    apiClient.get('/api/books/recommendations').then((data: any) => {
      const list = Array.isArray(data) ? data : data.books || data.data || [];
      return list.map(normalizeBook);
    }),
  getBook: (id: string) =>
    apiClient.get(`/api/books/${id}`).then((data: any) => {
      // 支持后端返回 { book: {...} } 或 直接返回 book
      const payload = data && data.book ? data.book : (data && data.data ? data.data : data);
      return normalizeBook(payload);
    }),
  createBook: (data: any) => 
    apiClient.post('/api/books', data),
  updateBook: (id: string, data: any) => 
    apiClient.put(`/api/books/${id}`, data),
  deleteBook: (id: string) => 
    apiClient.delete(`/api/books/${id}`),
  likeBook: (id: string) => 
    apiClient.post(`/api/books/${id}/like`),
};

// 用户API
export const userApi = {
  getProfile: () => 
    apiClient.get('/api/users/profile'), 
  getMyProfile: () => apiClient.get('/api/users/me'),
  getCurrentUser: () => {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
  },
  
  updateProfile: (data: any) => 
    apiClient.put('/api/users/profile', data),
  getUser: (id: string) => 
    apiClient.get(`/api/users/${id}`),
  getUsers: () => 
    apiClient.get('/api/users'),
  toggleWishlist: (bookId: string) => 
    apiClient.post('/api/users/wishlist/toggle', { bookId }),
  evaluateUser: (data: { seller_id: string, is_good: boolean }) => 
    apiClient.post('/api/users/evaluate', data),
  blockUser: (id: string) => apiClient.post(`/api/users/${id}/block`),
  unblockUser: (id: string) => apiClient.post(`/api/users/${id}/unblock`),
  
  // 管理员接口
  admin: {
    getStats: () => apiClient.get('/api/monitor/stats'),
  }
};

// 管理员API
export const adminApi = {
  getStats: () => apiClient.get('/api/admin/stats'),
  getUsers: (params?: any) => apiClient.get('/api/admin/users', { params }),
  updateUserStatus: (id: string, status: number) => apiClient.put(`/api/admin/users/${id}/status`, { status }),
  setUserRole: (id: string, role: string) => apiClient.post(`/api/admin/users/${id}/role`, { role }),
  getBooks: (params?: any) => apiClient.get('/api/admin/books', { params }),
  updateBookStatus: (id: string, status: number) => apiClient.put(`/api/admin/books/${id}/status`, { status }),
  deleteBook: (id: string) => apiClient.delete(`/api/admin/books/${id}`),
  getTransactions: (params?: any) => apiClient.get('/api/admin/transactions', { params }),
  getReports: (params?: any) => apiClient.get('/api/admin/reports', { params }),
  resolveReport: (id: string, data: any) => apiClient.post(`/api/admin/reports/${id}/resolve`, data),
};

// 聊天API
export const chatApi = {
  getChats: () => 
    apiClient.get('/api/chats'),
  getUnreadCount: () =>
    apiClient.get('/api/chats/unread'),
  getChat: (id: string) => 
    apiClient.get(`/api/chats/${id}`),
  getMessages: (chatId: string) =>
    apiClient.get(`/api/chats/${chatId}/messages`),
  sendMessage: (chatId: string, data: any) => 
    apiClient.post(`/api/chats/${chatId}/messages`, data),
  createChat: (data: { targetId: string }) => 
    apiClient.post('/api/chats', data),
  markAsRead: (id: string) => 
    apiClient.put(`/api/chats/${id}/read`),
  deleteChat: (id: string) => apiClient.delete(`/api/chats/${id}`),
  clearMessages: (id: string) => apiClient.delete(`/api/chats/${id}/messages`),
};

// 列表API
export const listingApi = {
  getListings: (params?: any) => 
    apiClient.get('/api/listings', { params }),
  getListing: (id: string) => 
    apiClient.get(`/api/listings/${id}`),
  createListing: (data: any) => 
    apiClient.post('/api/listings', data),
  updateListing: (id: string, data: any) => 
    apiClient.put(`/api/listings/${id}`, data),
  deleteListing: (id: string) => 
    apiClient.delete(`/api/listings/${id}`),
};

// 交易API
export const transactionApi = {
  createTransaction: (data: { listing_id: string; chat_id?: string }) =>
    apiClient.post('/api/transactions', data),
  getMyTransactions: () =>
    apiClient.get('/api/transactions/mine'),
  getTransaction: (id: string) =>
    apiClient.get(`/api/transactions/${id}`),
  // 清除当前用户的交易未读标记
  clearUnread: () =>
    apiClient.post('/api/transactions/unread/clear'),
  // 获取交易未读数（后端需支持该接口：GET /api/transactions/unread）
  getUnreadCount: () =>
    apiClient.get('/api/transactions/unread'),
  confirmTransaction: (id: string) =>
    apiClient.put(`/api/transactions/${id}/confirm`),
  confirmReceipt: (id: string) =>
    apiClient.put(`/api/transactions/${id}/receive`),
  cancelTransaction: (id: string) =>
    apiClient.put(`/api/transactions/${id}/cancel`),
  // 评价交易
  reviewTransaction: (id: string, data: { rating: number; review?: string }) =>
    apiClient.post(`/api/transactions/${id}/review`, data),
};

// 通知 API
export const notificationApi = {
  list: async (params?: any) => {
    const res: any = await apiClient.get('/api/notifications', { params });
    try {
      const list = Array.isArray(res) ? res : (res && res.data) || [];
      // 异步写入 IndexedDB 缓存
      saveNotificationsToCache(list).catch(() => {});
      return list;
    } catch (e) {
      return res;
    }
  },
  markRead: (id: string) => apiClient.post(`/api/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/api/notifications/mark-all-read'),
  // 简单获取未读数量（限制为前50条以节省流量）
  getUnreadCount: async () => {
    // Use lightweight unread count endpoint when available
    try {
      const res: any = await apiClient.get('/api/notifications/unread');
      const data = Array.isArray(res) ? res : res;
      // 如果后端返回 { unread_notifications: N }
      if (res && typeof res.unread_notifications === 'number') return res.unread_notifications;
      // 兼容旧实现，fallback to listing
    } catch (e) {
      // ignore and fallback
    }
    const data: any = await apiClient.get('/api/notifications', { params: { new: true, limit: 50 } });
    const list = Array.isArray(data) ? data : (data && data.data) || [];
    return Array.isArray(list) ? list.length : 0;
  }
};

// 地址 API
export const addressApi = {
  // 获取官方地址（用于联想与选择）
  getAddresses: (params?: any) => apiClient.get('/api/addresses', { params }),
  // 管理员创建官方地址
  createAddress: (data: any) => apiClient.post('/api/addresses', data),
  deleteAddress: (id: string) => apiClient.delete(`/api/addresses/${id}`),
  // 用户自定义地址
  getUserAddresses: () => apiClient.get('/api/addresses/user/custom'),
  createUserAddress: (data: any) => apiClient.post('/api/addresses/user/custom', data),
  deleteUserAddress: (id: string) => apiClient.delete(`/api/addresses/user/custom/${id}`),
};

// 搜索API
export const searchApi = {
  search: (query: string, params?: any) => 
    apiClient.get('/api/search', { params: { q: query, ...params } }),
  getHotSearch: () => 
    apiClient.get('/api/search/hot'),
  getSuggestions: (query: string) => 
    apiClient.get('/api/search/suggestions', { params: { q: query } }),
};

export default apiClient;
