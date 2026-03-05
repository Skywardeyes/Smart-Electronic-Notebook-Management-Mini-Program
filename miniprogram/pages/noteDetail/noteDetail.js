const dataService = require('../../utils/dataService.js')
const aiService = require('../../utils/aiService.js')

Page({
  data: {
    noteId: '',
    note: null,
    createTimeText: '',
    updateTimeText: '',
    aiSummary: '',
    aiLoading: false
  },

  onLoad(options) {
    const id = options.id || ''
    this.setData({ noteId: id })
    this.loadNote()
  },

  loadNote() {
    const note = dataService.getNoteById(this.data.noteId)
    if (!note) {
      this.setData({ note: null })
      return
    }
    const create = (note.createTime || '').replace('T', ' ').slice(0, 16)
    const update = (note.updateTime || '').replace('T', ' ').slice(0, 16)
    this.setData({
      note,
      createTimeText: create,
      updateTimeText: update,
      aiSummary: note.summary || ''
    })
  },

  async onRegenerateSummary() {
    const note = this.data.note
    if (!note) return
    this.setData({ aiLoading: true })
    try {
      const summary = await aiService.generateSummary(note.content || note.title || '', 120)
      this.setData({ aiSummary: summary })
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  onCopySummary() {
    if (!this.data.aiSummary) return
    wx.setClipboardData({
      data: this.data.aiSummary,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  onEdit() {
    wx.switchTab({
      url: '/pages/editor/editor'
    })
  },

  onAskAI() {
    wx.switchTab({
      url: '/pages/ai/ai'
    })
  },

  onDelete() {
    const id = this.data.noteId
    if (!id) return
    wx.showModal({
      title: '删除笔记',
      content: '确定要彻底删除这条云端笔记吗？删除后不可恢复。',
      success: res => {
        if (res.confirm) {
          dataService.hardDeleteNote(id)
          wx.showToast({ title: '已删除', icon: 'none' })
          wx.navigateBack()
        }
      }
    })
  }
})