Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentTab: 'latest',
    notes: [
      {
        id: 1,
        title: '在智能笔记构建你的学霸笔记吧！',
        time: '今天 21:23'
      },
      {
        id: 2,
        title: '在云笔记打造你的技术知识库吧！',
        time: '今天 20:06'
      },
      {
        id: 3,
        title: '在云笔记搭建你的高效工作流吧！',
        time: '昨天 18:45'
      }
    ]
  },
  goProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  },
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab
    })
  },
  getNoteData(){
    wx.switchTab({
      url: '/pages/notebook/notebook'
    })
  },
  goEditor(){
    wx.switchTab({
      url: '/pages/editor/editor'
    })
  },
  goRichEditor(){
    wx.switchTab({
      url: '/pages/ai/ai'
    })
  },
  

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    
  }
})