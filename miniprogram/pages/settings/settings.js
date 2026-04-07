const dataService = require('../../utils/dataService.js')

const INTERVAL_ITEMS = [3, 5, 10]

Page({
  data: {
    intervalItems: INTERVAL_ITEMS,
    settings: {
      autoSaveEnabled: true,
      autoSaveIntervalSec: 3
    }
  },

  onShow() {
    const settings = dataService.getSettings()
    this.setData({ settings })
  },

  onToggleAutoSave(e) {
    const value = !!e.detail.value
    this.savePartial({ autoSaveEnabled: value })
  },

  onPickInterval(e) {
    const value = Number(e.currentTarget.dataset.value)
    if (!Number.isFinite(value)) return
    this.savePartial({ autoSaveIntervalSec: value })
  },

  savePartial(patch) {
    const saved = dataService.saveSettings(patch)
    this.setData({ settings: saved })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onClearTempCache() {
    wx.showModal({
      title: '清理临时缓存',
      content: '将删除本地草稿缓存与同步时间等临时数据，不会删除笔记、资料与 AI 历史对话。是否继续？',
      confirmText: '清理',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        dataService.clearTempCache()
        wx.showToast({ title: '临时缓存已清理', icon: 'success' })
      }
    })
  },

  onClearHistorySessions() {
    wx.showModal({
      title: '清理历史会话',
      content: '将清空本地保存的全部 AI 问答历史（含导出文件）及旧版对话记录，不会删除笔记与个人资料。是否继续？',
      confirmText: '清空',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        dataService.clearHistorySessions()
        wx.showToast({ title: '历史会话已清空', icon: 'success' })
      }
    })
  }
})
