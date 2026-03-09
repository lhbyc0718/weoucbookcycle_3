// tests/utils/storage.test.js
const storage = require('../../utils/storage');

// Mock wx API
global.wx = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  clearStorageSync: jest.fn(),
};

describe('Storage Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should set value in storage', () => {
    const key = 'test_key_1';
    const value = { foo: 'bar' };
    storage.set(key, value);
    expect(global.wx.setStorageSync).toHaveBeenCalledWith(key, value);
  });

  test('should get value from storage (cache miss)', () => {
    const key = 'test_key_2';
    const value = 'cached_value';
    global.wx.getStorageSync.mockReturnValue(value);
    
    // Ensure cache miss by using a new key
    const result = storage.get(key);
    
    expect(global.wx.getStorageSync).toHaveBeenCalledWith(key);
    expect(result).toBe(value);
  });

  test('should get value from cache (cache hit)', () => {
    const key = 'test_key_3';
    const value = 'cached_value_3';
    
    // Set first to populate cache
    storage.set(key, value);
    global.wx.getStorageSync.mockClear(); // Clear any calls
    
    const result = storage.get(key);
    
    // Should NOT call getStorageSync
    expect(global.wx.getStorageSync).not.toHaveBeenCalled();
    expect(result).toBe(value);
  });

  test('should remove value', () => {
    const key = 'test_key_4';
    storage.remove(key);
    expect(global.wx.removeStorageSync).toHaveBeenCalledWith(key);
    
    // Verify it is removed from cache (by checking if get calls getStorageSync again)
    // Mock getStorageSync to return something else
    global.wx.getStorageSync.mockReturnValue('new_val');
    const res = storage.get(key);
    expect(global.wx.getStorageSync).toHaveBeenCalledWith(key);
  });

  test('should clear all', () => {
    storage.clear();
    expect(global.wx.clearStorageSync).toHaveBeenCalled();
  });
});
