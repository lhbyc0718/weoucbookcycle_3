// utils/storage.js
// Simple in-memory cache to avoid frequent synchronous reads
const cache = {};

const set = (key, value) => {
  cache[key] = value;
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.error('Storage set error:', e);
  }
};

const get = (key) => {
  if (cache[key] !== undefined) {
    return cache[key];
  }
  try {
    const value = wx.getStorageSync(key);
    cache[key] = value;
    return value;
  } catch (e) {
    console.error('Storage get error:', e);
    return null;
  }
};

const remove = (key) => {
  delete cache[key];
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.error('Storage remove error:', e);
  }
};

const clear = () => {
  for (let key in cache) delete cache[key];
  try {
    wx.clearStorageSync();
  } catch (e) {
    console.error('Storage clear error:', e);
  }
};

module.exports = {
  set,
  get,
  remove,
  clear
};
