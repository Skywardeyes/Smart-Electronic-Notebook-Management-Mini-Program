const dataService = require('../../utils/dataService.js')

Page({
  data: {
    searchText: '',
    activeCategoryId: 'all',
    categories: [],
    notes: [],
    filteredNotes: []
  },

  goProfile() {
    wx.switchTab({
      url: '/pages/notebook/notebook'
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    this.loadData()
  },

  loadData() {
    const categories = dataService.getCategories()
    const notes = dataService.getNotes(true)
    this.setData({
      categories,
      notes: notes.filter((n) => n.status !== 'deleted')
    })
    this.applyFilter()
  },

  onSearchInput(e) {
    const value = e.detail.value || ''
    this.setData({ searchText: value })
    this.applyFilter({
      searchText: value
    })
  },

  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategoryId: id })
    this.applyFilter({
      activeCategoryId: id
    })
  },

  applyFilter(overrides = {}) {
    const notes = overrides.notes || this.data.notes
    const activeCategoryId = overrides.activeCategoryId || this.data.activeCategoryId
    const searchText = overrides.searchText !== undefined ? overrides.searchText : this.data.searchText
    const kw = String(searchText || '').trim().toLowerCase()
    const list = notes
      .filter((n) => {
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
      .map((n) => {
        const dateStr = (n.updateTime || n.createTime || '').slice(0, 10)
        return Object.assign({}, n, {
          dateText: dateStr,
          tagCount: (n.tags && n.tags.length) || 0
        })
      })
    this.setData({ filteredNotes: list })
  },

  findCategoryName(id) {
    const c = (this.data.categories || []).find((x) => x.id === id)
    return c ? c.name : ''
  },

  resolveNoteIdFromEvent(e) {
    let id = e.currentTarget.dataset.noteId
    if (id === undefined || id === null || id === '') {
      return ''
    }
    return String(id)
  },

  onTapNote(e) {
    const id = this.resolveNoteIdFromEvent(e)
    if (!id) {
      wx.showToast({ title: '无法打开该笔记', icon: 'none' })
      return
    }
    const app = getApp()
    app.globalData.editorNoteId = id
    app.globalData.editorMode = 'edit'
    wx.navigateTo({
      url: '/pages/editor/editor'
    })
  },

  onTapDelete(e) {
    const id = this.resolveNoteIdFromEvent(e)
    if (!id) {
      wx.showToast({ title: '无法删除该笔记', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除笔记',
      content: '确定永久删除这条笔记？删除后不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          dataService.hardDeleteNote(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        }
      }
    })
  },

  onTapNew() {
    wx.navigateTo({ url: '/pages/editor/editor' })
  }
})
