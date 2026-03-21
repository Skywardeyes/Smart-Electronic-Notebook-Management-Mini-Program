Page({
  data: {
    expanded: true
  },

  toggleExpand() {
    this.setData({ expanded: !this.data.expanded })
  },

  goEditor() {
    wx.navigateTo({
      url: '/pages/editor/editor'
    })
  },

  goAI() {
    wx.navigateTo({
      url: '/pages/ai/ai'
    })
  }
})

