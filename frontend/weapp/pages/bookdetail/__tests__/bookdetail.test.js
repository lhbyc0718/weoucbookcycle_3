// pages/bookdetail/__tests__/bookdetail.test.js
const simulate = require('miniprogram-simulate');
const path = require('path');

// Mock getApp before loading the component
global.getApp = jest.fn(() => ({
  globalData: {
    apiBase: 'http://localhost:8080',
    userInfo: { id: 'me' }
  }
}));

// Mock dependencies
jest.mock('../../../utils/request', () => ({
  requestWithRetry: jest.fn()
}));

jest.mock('../../../utils/storage', () => ({
  get: jest.fn(),
  set: jest.fn()
}));

jest.mock('../../../config/index', () => ({
  env: 'develop',
  apiBase: 'http://localhost:8080',
  useMock: false,
  features: {
    enableCloud: false
  }
}));

// Load the page component
const bookdetailPath = path.join(__dirname, '../bookdetail');

describe('BookDetail Page', () => {
  let id;

  beforeAll(() => {
    id = simulate.load(bookdetailPath);
  });

  test('should render book details correctly', async () => {
    const bookData = {
      id: '123',
      title: 'Test Book Title',
      author: 'Test Author',
      price: 99.99,
      description: 'Test Description',
      sellerId: 'seller_1'
    };

    // Render the page
    const container = simulate.render(id);
    const parent = document.createElement('parent-wrapper');
    container.attach(parent);

    // Update data directly to simulate loaded state
    container.setData({
      book: bookData,
      loading: false
    });
    
    // Force update
    await simulate.sleep(10);

    // Check rendered content
    const title = container.querySelector('.book-title');
    // Note: miniprogram-simulate querySelector returns a wrapper, access dom via .dom
    expect(title.dom.textContent).toBe('Test Book Title');
    
    const author = container.querySelector('.book-author');
    expect(author.dom.textContent).toBe('by Test Author');
    
    const price = container.querySelector('.book-price');
    expect(price.dom.textContent).toBe('¥99.99');
  });

  test('should toggle wishlist status', async () => {
    const container = simulate.render(id);
    const parent = document.createElement('parent-wrapper');
    container.attach(parent);

    // Initial state: not wishlisted
    container.setData({ isWishlisted: false, bookId: '123' });
    
    const wishlistBtn = container.querySelector('.wishlist-btn');
    
    // Simulate tap
    wishlistBtn.dispatchEvent('tap');
    await simulate.sleep(10);
    
    // Check if data updated
    expect(container.data.isWishlisted).toBe(true);
    
    // Simulate tap again
    wishlistBtn.dispatchEvent('tap');
    await simulate.sleep(10);
    
    expect(container.data.isWishlisted).toBe(false);
  });
});
