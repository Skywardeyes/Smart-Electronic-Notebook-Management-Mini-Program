const dataService = require('../../utils/dataService.js')
const aiService = require('../../utils/aiService.js')
const aiPrefill = require('../../utils/aiPrefill.js')

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
    const contentText = htmlToPlainText(note.content || '')
    const create = (note.createTime || '').replace('T', ' ').slice(0, 16)
    const update = (note.updateTime || '').replace('T', ' ').slice(0, 16)
    this.setData({
      note: Object.assign({}, note, { contentText }),
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
      const summary = await aiService.generateSummary(note.contentText || note.title || '', 120)
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
    const app = getApp()
    app.globalData.editorNoteId = this.data.noteId
    app.globalData.editorMode = 'edit'
    wx.navigateTo({
      url: `/pages/editor/editor?mode=edit&id=${encodeURIComponent(this.data.noteId || '')}`
    })
  },

  onAskAI() {
    wx.navigateTo({
      url: '/pages/ai/ai'
    })
  },

  onAskClipForAI() {
    wx.getClipboardData({
      success: (res) => {
        const t = (res.data || '').trim()
        if (!t) {
          wx.showToast({
            title: '剪贴板为空，请先在正文里长按并复制选中文本',
            icon: 'none'
          })
          return
        }
        aiPrefill.navigateWithClipboardAttach(t)
      },
      fail: () => {
        wx.showToast({ title: '无法读取剪贴板', icon: 'none' })
      }
    })
  },

  onAskFullBodyForAI() {
    const note = this.data.note
    const t = (note && note.contentText ? String(note.contentText) : '').trim()
    if (!t) {
      wx.showToast({ title: '正文为空', icon: 'none' })
      return
    }
    aiPrefill.navigateWithFullNoteFromDetail(this.data.noteId, note.title || '')
  },

  onBodyAreaLongPress() {
    wx.showActionSheet({
      itemList: ['用剪贴板选区问AI（需先复制）', '用当前全文问AI'],
      success: (res) => {
        if (res.tapIndex === 0) this.onAskClipForAI()
        else if (res.tapIndex === 1) this.onAskFullBodyForAI()
      }
    })
  },

  onDelete() {
    const id = this.data.noteId
    if (!id) return
    wx.showModal({
      title: '删除笔记',
      content: '确定将该笔记移入回收站？',
      confirmText: '移入',
      cancelText: '取消',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          dataService.softDeleteNote(id)
          wx.showToast({ title: '已移入回收站', icon: 'success' })
          wx.navigateBack()
        }
      }
    })
  }
})
