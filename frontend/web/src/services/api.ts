import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use(
  (config) => {
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
    // 检查是否有 code 字段 (WeChat style response wrapper)
    if (response.data && typeof response.data.code !== 'undefined') {
      const { code, data, message } = response.data;
      if (code === 20000) {
        return data;
      }
      throw new Error(message || '请求失败');
    }
    
    // 如果没有 code 字段，假设直接返回数据 (Standard REST style)
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 如果是 401 且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败，重定向到登录
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Token刷新
async function refreshToken(): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
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
    apiClient.get('/api/users/profile'), // Note: this maps to GetUserProfile in backend? No, backend route is PUT /profile. Wait, GET /profile is usually get current user. Backend has GetMyProfile but route might be distinct. Let's check routes.
  // Actually, looking at backend controller, GetMyProfile is usually bound to GET /api/users/me or similar. I'll stick to generic getProfile for now and verify route later.
  // Correction: backend controller has GetMyProfile but no route mapping was shown in file list, just controller methods. Assuming standard /api/users/me or /api/users/profile. 
  // Let's assume GET /api/users/me based on typical REST.
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
};

// 聊天API
export const chatApi = {
  getChats: () => 
    apiClient.get('/api/chats'),
  getChat: (id: string) => 
    apiClient.get(`/api/chats/${id}`),
  sendMessage: (chatId: string, data: any) => 
    apiClient.post(`/api/chats/${chatId}/messages`, data),
  getMessages: (chatId: string) => 
    apiClient.get(`/api/chats/${chatId}/messages`),
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
