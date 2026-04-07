const dataService = require('../../utils/dataService.js')

Page({
  onLoad() {
    // 个人信息已合并到 Tab「我的」(pages/notebook)，保留本页仅作旧链接跳转
    wx.switchTab({ url: '/pages/notebook/notebook' })
  },

  data: {
    userInfo: null,
    stats: {
      totalNotes: 0,
      thisMonthNew: 0,
      storageUsage: '—'
    }
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const userInfo = dataService.getUserInfo()
    const notes = dataService.getNotes(true)
    const totalNotes = notes.filter(n => n.status !== 'deleted').length
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const thisMonthNew = notes.filter(n =>
      (n.createTime || '').startsWith(ym) && n.status !== 'deleted'
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
    wx.showToast({ title: '设置页可按需扩展', icon: 'none' })
  },

  onTapMenu(e) {
    const action = e.currentTarget.dataset.action
    wx.showToast({ title: `${action} 功能待实现`, icon: 'none' })
  },

  onTapLogout() {
    wx.showToast({ title: '开发阶段为本地模式，无需登录', icon: 'none' })
  }
})