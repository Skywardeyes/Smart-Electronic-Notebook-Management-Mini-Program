const dataService = require('../../utils/dataService.js')

Page({
  data: {
    userInfo: null,
    stats: {
      totalNotes: 0,
      thisMonthNew: 0,
      storageUsage: '—'
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    this.loadData()
  },

  loadData() {
    const userInfo = dataService.getUserInfo()
    const notes = dataService.getNotes(true)
    const totalNotes = notes.filter((n) => n.status !== 'deleted').length
    const now = new Date()
    const m = now.getMonth() + 1
    const ym = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`
    const thisMonthNew = notes.filter(
      (n) => (n.createTime || '').startsWith(ym) && n.status !== 'deleted'
    ).length
    this.setData({
      userInfo,
      stats: {
        totalNotes,
        thisMonthNew,
        storageUsage: '本地缓存'
      }
    })
  },

  onTapSetting() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onTapEditProfile() {
    wx.navigateTo({ url: '/pages/profileEdit/profileEdit' })
  },

  onTapMenu(e) {
    const action = e.currentTarget.dataset.action
    if (action === '设置') {
      wx.navigateTo({ url: '/pages/settings/settings' })
      return
    }
    if (action === '使用帮助') {
      wx.navigateTo({ url: '/pages/help/help' })
      return
    }
    if (action === '关于我们') {
      wx.navigateTo({ url: '/pages/about/about' })
      return
    }
    if (action === '回收站') {
      wx.navigateTo({ url: '/pages/recycle/recycle' })
      return
    }
    wx.showToast({ title: `${action} 功能待实现`, icon: 'none' })
  },

  onTapLogout() {
    wx.showToast({ title: '开发阶段为本地模式，无需登录', icon: 'none' })
  }
})
