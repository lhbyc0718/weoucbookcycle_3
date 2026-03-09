// utils/error.js
const handleError = (err, title = '发生错误') => {
  console.error(err);
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 2000
  });
};

module.exports = {
  handleError
};
