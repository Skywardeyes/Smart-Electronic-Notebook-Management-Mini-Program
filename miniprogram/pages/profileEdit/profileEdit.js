const dataService = require('../../utils/dataService.js')

Page({
  data: {
    avatarUrl: '/assets/avatar/default.png',
    nickName: '',
    wechatId: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const user = dataService.getUserInfo()
    this.setData({
      avatarUrl: user.avatarUrl || '/assets/avatar/default.png',
      nickName: user.nickName || '',
      wechatId: user.wechatId || ''
    })
  },

  onInputNickName(e) {
    this.setData({ nickName: String(e.detail.value || '') })
  },

  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles || [])[0]
        if (!file || !file.tempFilePath) return
        this.setData({ avatarUrl: file.tempFilePath })
      }
    })
  },

  onSave() {
    const nickName = String(this.data.nickName || '').trim()
    if (!nickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    const next = dataService.saveUserInfo({
      nickName,
      avatarUrl: this.data.avatarUrl
    })
    this.setData({
      nickName: next.nickName || nickName,
      avatarUrl: next.avatarUrl || this.data.avatarUrl
    })
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack()
    }, 350)
  }
})
