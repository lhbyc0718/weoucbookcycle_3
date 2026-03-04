// cloudfunctions/login/index.js
// 云函数 - 获取用户登录信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  // 获取调用云函数的小程序信息
  const wxContext = cloud.getWXContext()
  
  // 返回用户openid
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    env: wxContext.ENV
  }
}
