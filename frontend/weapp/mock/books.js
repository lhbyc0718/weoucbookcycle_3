/**
 * @file mock/books.js
 * @description Mock data for books.
 */

const books = [
  {
    id: '1',
    _id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    price: 15.00,
    originalPrice: 25.00,
    condition: 'Like New',
    description: 'A classic novel of the Jazz Age.',
    cover: 'https://example.com/gatsby.jpg',
    images: ['https://example.com/gatsby.jpg'],
    sellerId: 'user_123',
    createdAt: '2023-01-01T10:00:00Z',
    status: 'active'
  },
  {
    id: '2',
    _id: '2',
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    price: 20.00,
    originalPrice: 35.00,
    condition: 'Good',
    description: 'Fundamental principles of design.',
    cover: 'https://example.com/design.jpg',
    images: ['https://example.com/design.jpg'],
    sellerId: 'user_456',
    createdAt: '2023-01-02T11:00:00Z',
    status: 'active'
  },
  {
    id: '3',
    _id: '3',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    price: 30.00,
    originalPrice: 50.00,
    condition: 'New',
    description: 'A Handbook of Agile Software Craftsmanship.',
    cover: 'https://example.com/cleancode.jpg',
    images: ['https://example.com/cleancode.jpg'],
    sellerId: 'user_789',
    createdAt: '2023-01-03T12:00:00Z',
    status: 'sold'
  }
];

module.exports = {
  books,
  getById: (id) => books.find(b => b.id === id || b._id === id) || books[0]
};
