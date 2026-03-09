// cloudfunctions/books/index.js
// 云函数 - 获取书籍列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const page = parseInt(event.page) || 1;
    const limit = Math.min(parseInt(event.limit) || 20, 50); // Cap limit at 50
    const skip = (page - 1) * limit;

    // Parallel execution is not fully possible because we need books to know which users to fetch
    // But we can optimize the user fetching significantly.
    
    // 1. Get books with pagination
    const booksRes = await db.collection('books')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    const books = booksRes.data;
    
    // 2. Extract unique seller IDs
    const sellerIds = [...new Set(books.map(book => book.sellerId).filter(id => id))];
    
    let users = {};

    // 3. Fetch only relevant users if there are any sellers
    if (sellerIds.length > 0) {
      const usersRes = await db.collection('users')
        .where({
          _id: _.in(sellerIds)
        })
        .get()
      
      usersRes.data.forEach(user => {
        users[user._id] = user
      })
    }
    
    return {
      success: true,
      data: {
        books: books,
        users: users,
        hasMore: books.length === limit // Simple check for more data
      }
    }
  } catch (err) {
    console.error('获取书籍列表失败', err)
    return {
      success: false,
      error: err
    }
  }
}
