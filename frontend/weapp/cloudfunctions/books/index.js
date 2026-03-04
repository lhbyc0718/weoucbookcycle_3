// cloudfunctions/books/index.js
// 云函数 - 获取书籍列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 获取书籍列表
    const booksRes = await db.collection('books')
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    
    // 获取用户信息
    const usersRes = await db.collection('users')
      .get()
    
    const users = {}
    usersRes.data.forEach(user => {
      users[user._id] = user
    })
    
    return {
      success: true,
      data: {
        books: booksRes.data,
        users: users
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
