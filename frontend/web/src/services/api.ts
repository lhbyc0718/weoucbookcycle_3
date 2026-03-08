import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

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
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败，可能是 refresh token 也过期了
        // 此时才清除本地状态并跳转
        // 建议使用事件通知 UI 弹出登录框，而不是直接跳转，以保护用户当前输入
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        
        // 触发全局事件，让 App 组件处理登录弹窗或跳转
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        
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

    // 处理 429 Too Many Requests
    if (status === 429) {
      return Promise.reject(new Error('请求过于频繁，请稍后再试'));
    }

    // 处理 500 Internal Server Error
    if (status >= 500) {
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
            toast.error(errorMessage);
            sessionStorage.setItem(errorKey, now.toString());
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

// 认证API
export const authApi = {
  wechatLogin: (code: string) => 
    apiClient.post('/api/auth/wechat', { code }),
  login: (data: any) => 
    apiClient.post('/api/auth/login', data),
  register: (data: any) => 
    apiClient.post('/api/auth/register', data),
  logout: () => 
    apiClient.post('/api/auth/logout', {}),
};

// 书籍API
export const bookApi = {
  getBooks: (params?: any) => 
    apiClient.get('/api/books', { params }),
  getHotBooks: () => 
    apiClient.get('/api/books/hot'),
  getRecommendations: () => 
    apiClient.get('/api/books/recommendations'),
  getBook: (id: string) => 
    apiClient.get(`/api/books/${id}`),
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
  
  // 管理员接口
  admin: {
    getStats: () => apiClient.get('/api/monitor/stats'),
  }
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
  createChat: (data: { user_id: string }) => 
    apiClient.post('/api/chats', data),
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
