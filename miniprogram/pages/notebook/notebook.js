const dataService = require('../../utils/dataService.js')

Page({
  data: {
    searchText: '',
    activeCategoryId: 'all',
    categories: [],
    notes: [],
    filteredNotes: [],
    recycleCount: 0
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const categories = dataService.getCategories()
    const notes = dataService.getNotes(true)
    const recycleCount = notes.filter(n => n.status === 'deleted').length
    this.setData({
      categories,
      notes: notes.filter(n => n.status !== 'deleted'),
      recycleCount
    })
    this.applyFilter()
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value })
    this.applyFilter()
  },

  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategoryId: id })
    this.applyFilter()
  },

  applyFilter() {
    const { notes, activeCategoryId, searchText } = this.data
    const kw = (searchText || '').trim().toLowerCase()
    const list = notes
      .filter(n => {
        if (
          activeCategoryId !== 'all' &&
          n.category !== activeCategoryId &&
          n.category !== this.findCategoryName(activeCategoryId)
        ) {
          return false
        }
        if (!kw) return true
        const text = `${n.title || ''} ${n.content || ''} ${(n.tags || []).join(' ')}`
        return text.toLowerCase().includes(kw)
      })
      .map(n => {
        const dateStr = (n.updateTime || n.createTime || '').slice(0, 10)
        return Object.assign({}, n, {
          dateText: dateStr,
          tagCount: (n.tags && n.tags.length) || 0
        })
      })
    this.setData({ filteredNotes: list })
  },

  findCategoryName(id) {
    const c = (this.data.categories || []).find(x => x.id === id)
    return c ? c.name : ''
  },

  onTapNote(e) {
    const rawIndex = e.currentTarget.dataset.index
    const index = typeof rawIndex === 'string' ? parseInt(rawIndex, 10) : rawIndex
    if (isNaN(index) || index < 0) {
      wx.showToast({ title: '无法打开该笔记', icon: 'none' })
      return
    }
    const list = this.data.filteredNotes || []
    const note = list[index]
    const id = note && (note.id || note._id)
    if (!id) {
      wx.showToast({ title: '无法打开该笔记', icon: 'none' })
      return
    }
    const app = getApp()
    app.globalData.editorNoteId = id
    app.globalData.editorMode = 'edit'
    wx.switchTab({
      url: '/pages/editor/editor'
    })
  },

  onTapDelete(e) {
    const rawIndex = e.currentTarget.dataset.index
    const index = typeof rawIndex === 'string' ? parseInt(rawIndex, 10) : rawIndex
    if (isNaN(index) || index < 0) {
      wx.showToast({ title: '无法删除该笔记', icon: 'none' })
      return
    }
    const list = this.data.filteredNotes || []
    const note = list[index]
    const id = note && (note.id || note._id)
    if (!id) {
      wx.showToast({ title: '无法删除该笔记', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除笔记',
      content: '是否删除该笔记？删除后不可恢复。',
      confirmText: '确认删除',
      cancelText: '取消',
      success: res => {
        if (res.confirm) {
          dataService.hardDeleteNote(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        }
      }
    })
  },

  onTapNew() {
    wx.switchTab({ url: '/pages/editor/editor' })
  },

  onTapRecycle() {
    wx.showToast({ title: '回收站暂为示例，可按需求扩展', icon: 'none' })
  }
})