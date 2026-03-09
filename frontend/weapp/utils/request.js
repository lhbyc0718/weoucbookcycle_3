/**
 * @file request.js
 * @description A wrapper around wx.request with Promise support, error handling, and retry mechanism.
 */

const { handleError } = require('./error');

/**
 * Sends an HTTP request.
 * @param {Object} options - The request options.
 * @param {string} options.url - The URL to send the request to.
 * @param {string} [options.method='GET'] - The HTTP method.
 * @param {Object} [options.data] - The request body or query parameters.
 * @param {Object} [options.header] - The request headers.
 * @returns {Promise<Object>} A promise that resolves with the response object or rejects with an error.
 */
const request = (options) => {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

/**
 * Sends a GET request.
 * @param {string} url - The URL to request.
 * @param {Object} [data={}] - Query parameters.
 * @returns {Promise<Object>} The response.
 */
const get = (url, data = {}) => {
  return request({
    url,
    data,
    method: 'GET'
  });
};

/**
 * Sends a POST request.
 * @param {string} url - The URL to request.
 * @param {Object} [data={}] - The request body.
 * @returns {Promise<Object>} The response.
 */
const post = (url, data = {}) => {
  return request({
    url,
    data,
    method: 'POST'
  });
};

/**
 * Sends a request with automatic retry on failure.
 * @param {Object} options - Request options (same as request).
 * @param {number} [retries=3] - Number of retry attempts.
 * @param {number} [delay=1000] - Delay between retries in milliseconds.
 * @returns {Promise<Object>} The response.
 */
const requestWithRetry = async (options, retries = 3, delay = 1000) => {
  try {
    return await request(options);
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return requestWithRetry(options, retries - 1, delay * 2); // Exponential backoff
    } else {
      handleError(err, 'Network request failed');
      throw err;
    }
  }
};

module.exports = {
  request,
  get,
  post,
  requestWithRetry
};
