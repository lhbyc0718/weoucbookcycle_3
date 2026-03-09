// tests/app.test.js
const simulate = require('miniprogram-simulate');
const storage = require('../utils/storage');

// Mock storage module methods since app.js requires it
jest.mock('../utils/storage', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

// Mock websocket service
jest.mock('../services/websocket', () => ({
  init: jest.fn(),
}));

describe('App', () => {
  let appOptions;
  
  beforeAll(() => {
    // Mock global App function to capture options
    global.App = (options) => {
      appOptions = options;
    };
    
    // Mock wx globals needed for app.js execution
    global.wx = {
      getAccountInfoSync: jest.fn().mockReturnValue({
        miniProgram: { envVersion: 'develop' }
      }),
      login: jest.fn(),
      request: jest.fn(),
      showToast: jest.fn(),
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
    };
    
    // Load app.js to trigger App() call
    require('../app.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset globalData
    appOptions.globalData = {
      userInfo: null,
      token: null,
      apiBase: 'http://localhost:8080',
      wsUrl: null
    };
  });

  test('onLaunch should check login status', () => {
    const spy = jest.spyOn(appOptions, 'checkLoginStatus');
    appOptions.onLaunch();
    expect(spy).toHaveBeenCalled();
  });

  test('checkLoginStatus should restore session from storage', () => {
    const mockUser = { name: 'Test User' };
    const mockToken = 'test-token';
    
    storage.get.mockImplementation((key) => {
      if (key === 'userInfo') return mockUser;
      if (key === 'token') return mockToken;
      return null;
    });

    appOptions.checkLoginStatus();

    expect(appOptions.globalData.userInfo).toEqual(mockUser);
    expect(appOptions.globalData.token).toEqual(mockToken);
  });

  test('login should handle success', (done) => {
    const mockUserInfo = { avatarUrl: 'url', nickName: 'nick' };
    const mockCode = 'mock-code';
    const mockToken = 'new-token';
    const mockUser = { id: 1, name: 'nick' };

    global.wx.login.mockImplementation(({ success }) => {
      success({ code: mockCode });
    });

    global.wx.request.mockImplementation(({ success }) => {
      success({
        data: {
          code: 20000,
          data: {
            token: mockToken,
            user: mockUser
          }
        }
      });
    });

    appOptions.login(mockUserInfo, (user) => {
      try {
        expect(user).toEqual(mockUser);
        expect(appOptions.globalData.token).toBe(mockToken);
        expect(storage.set).toHaveBeenCalledWith('token', mockToken);
        expect(storage.set).toHaveBeenCalledWith('userInfo', mockUser);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('login should handle failure', () => {
    const mockUserInfo = { avatarUrl: 'url', nickName: 'nick' };
    
    global.wx.login.mockImplementation(({ success }) => {
      success({ code: 'mock-code' });
    });

    global.wx.request.mockImplementation(({ success }) => {
      success({
        data: {
          code: 500,
          message: 'Server Error'
        }
      });
    });

    appOptions.login(mockUserInfo);
    
    expect(global.wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Login failed')
    }));
  });
});
