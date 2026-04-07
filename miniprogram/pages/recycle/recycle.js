const dataService = require('../../utils/dataService.js')

function toDateText(iso) {
  return String(iso || '').replace('T', ' ').slice(0, 16)
}

Page({
  data: {
    list: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const list = dataService
      .getDeletedNotes()
      .slice()
      .sort((a, b) => (b.deleteTime || '').localeCompare(a.deleteTime || ''))
      .map((n) => ({
        id: n.id,
        title: n.title || '未命名笔记',
        deleteTimeText: toDateText(n.deleteTime),
        updateTimeText: toDateText(n.updateTime || n.createTime)
      }))
    this.setData({ list })
  },

  onRestore(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    dataService.restoreNote(id)
    wx.showToast({ title: '已还原', icon: 'success' })
    this.loadData()
  },

  onDeletePermanent(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    wx.showModal({
      title: '彻底删除',
      content: '确定彻底删除该笔记？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        dataService.hardDeleteNote(id)
        wx.showToast({ title: '已彻底删除', icon: 'success' })
        this.loadData()
      }
    })
  },

  onClearAll() {
    if (!this.data.list.length) {
      wx.showToast({ title: '回收站为空', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清空回收站',
      content: '确定清空回收站？该操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        dataService.purgeAllDeletedNotes()
        wx.showToast({ title: '已清空', icon: 'success' })
        this.loadData()
      }
    })
  }
})
