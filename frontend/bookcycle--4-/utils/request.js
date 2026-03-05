/**
 * 统一的API请求层
 * 
 * 功能：
 * 1. 自动添加认证token到请求头
 * 2. 统一的错误处理
 * 3. 请求超时控制
 * 4. Token自动刷新（当返回401时）
 * 5. 请求日志记录
 */

const app = getApp();

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 10000;

// 正在进行的token刷新Promise，避免并发刷新
let refreshTokenPromise = null;

/**
 * 获取请求头，包含认证信息
 */
function getAuthHeaders() {
  const token = wx.getStorageSync('authToken');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 刷新token——对后端API的调用
 * 
 * @returns {Promise<boolean>} 刷新成功返回true，失败返回false
 */
function refreshAccessToken() {
  // 如果已经有正在进行中的刷新，直接返回该Promise
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = new Promise((resolve) => {
    const apiBase = app.globalData.apiBase;
    
    wx.request({
      url: `${apiBase}/api/auth/refresh`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      timeout: DEFAULT_TIMEOUT,
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 20000 && res.data.data && res.data.data.token) {
          // 保存新token
          wx.setStorageSync('authToken', res.data.data.token);
          app.globalData.authToken = res.data.data.token;
          resolve(true);
        } else {
          // token刷新失败，需要重新登录
          clearAuthData();
          resolve(false);
        }
      },
      fail: () => {
        clearAuthData();
        resolve(false);
      },
      complete: () => {
        refreshTokenPromise = null;
      }
    });
  });

  return refreshTokenPromise;
}

/**
 * 清除认证数据，触发重新登录
 */
function clearAuthData() {
  wx.removeStorageSync('authToken');
  wx.removeStorageSync('userInfo');
  app.globalData.authToken = null;
  app.globalData.userInfo = null;

  // 通知用户需要重新登录
  wx.showModal({
    title: '登录已过期',
    content: '请重新登录',
    showCancel: false,
    confirmText: '重新登录',
    success: () => {
      // 重新启动登录流程
      app.doWeChatLogin();
    }
  });
}

/**
 * 统一的请求方法
 * 
 * @param {Object} options 请求配置
 *   - url {string} 请求URL（相对于apiBase或完整URL）
 *   - method {string} HTTP方法（GET/POST/PUT/DELETE等）
 *   - data {object} 请求数据
 *   - timeout {number} 超时时间（毫秒）
 *   - needAuth {boolean} 是否需要认证token（默认true）
 * 
 * @returns {Promise<Object>} 返回响应数据
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = null,
    timeout = DEFAULT_TIMEOUT,
    needAuth = true
  } = options;

  // 规范化URL
  let fullUrl = url;
  if (!url.startsWith('http')) {
    fullUrl = app.globalData.apiBase + url;
  }

  // 构建请求头
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (needAuth) {
    const token = wx.getStorageSync('authToken');
    if (!token) {
      return Promise.reject({
        code: -1,
        message: '未登录或登录已过期'
      });
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 记录请求日志（开发环境）
  if (app.globalData.apiEnv === 'development') {
    console.log(`[Request] ${method} ${url}`, data);
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method: method,
      data: data,
      header: headers,
      timeout: timeout,
      success: (res) => {
        const { statusCode, data: responseData } = res;

        // 处理HTTP层面的错误
        if (statusCode === 401) {
          // Token过期，尝试刷新
          refreshAccessToken().then((success) => {
            if (success) {
              // 刷新成功，重试请求
              request(options).then(resolve).catch(reject);
            } else {
              // 刷新失败，需要重新登录
              reject({
                code: 401,
                message: '认证失败，请重新登录'
              });
            }
          });
          return;
        }

        if (statusCode >= 400) {
          reject({
            code: statusCode,
            message: responseData?.message || `HTTP Error ${statusCode}`
          });
          return;
        }

        // 处理业务层面的响应
        if (responseData && typeof responseData === 'object') {
          if (responseData.code === 20000) {
            // 成功响应
            resolve(responseData.data);
          } else if (responseData.code === 40001 || responseData.code === 40002) {
            // Token相关错误，清除并重新登录
            clearAuthData();
            reject({
              code: responseData.code,
              message: responseData.message || '认证失败'
            });
          } else {
            // 业务错误
            reject({
              code: responseData.code,
              message: responseData.message || '请求失败'
            });
          }
        } else {
          resolve(responseData);
        }
      },
      fail: (err) => {
        console.error(`[Request Error] ${method} ${url}:`, err);
        reject({
          code: -1,
          message: '网络错误，请检查是否连接到互联网'
        });
      }
    });
  });
}

/**
 * GET请求
 */
function get(url, options = {}) {
  return request({
    ...options,
    url,
    method: 'GET'
  });
}

/**
 * POST请求
 */
function post(url, data, options = {}) {
  return request({
    ...options,
    url,
    method: 'POST',
    data
  });
}

/**
 * PUT请求
 */
function put(url, data, options = {}) {
  return request({
    ...options,
    url,
    method: 'PUT',
    data
  });
}

/**
 * DELETE请求
 */
function deleteRequest(url, options = {}) {
  return request({
    ...options,
    url,
    method: 'DELETE'
  });
}

module.exports = {
  request,
  get,
  post,
  put,
  deleteRequest,
  getAuthHeaders
};
