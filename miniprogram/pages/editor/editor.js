const dataService = require('../../utils/dataService.js')
const aiService = require('../../utils/aiService.js')

let autoSaveTimer = null

Page({
  data: {
    mode: 'create', // create | edit
    noteId: '',
    title: '',
    content: '',
    tags: [],
    newTagInput: '',
    isDirty: false,
    saving: false,
    aiLoading: false
  },

  onLoad(options) {
    const mode = options.mode || 'create'
    const id = options.id || ''
    this.setData({ mode, noteId: id })
    if (mode === 'edit' && id) {
      this.loadNoteIntoEditor(id)
    }
  },

  onShow() {
    const app = getApp()
    const id = app.globalData.editorNoteId
    const mode = app.globalData.editorMode
    if (id && mode === 'edit') {
      delete app.globalData.editorNoteId
      delete app.globalData.editorMode
      this.loadNoteIntoEditor(id)
    }
  },

  loadNoteIntoEditor(id) {
    const note = dataService.getNoteById(id)
    if (note) {
      this.setData({
        mode: 'edit',
        noteId: id,
        title: note.title || '',
        content: note.content || '',
        tags: note.tags || []
      })
    }
  },

  onUnload() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
    if (this.data.isDirty) {
      this.saveNote({ silent: true })
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value, isDirty: true })
    this.scheduleAutoSave()
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value, isDirty: true })
    this.scheduleAutoSave()
  },

  onNewTagInput(e) {
    this.setData({ newTagInput: e.detail.value })
  },

  addTag() {
    const tag = (this.data.newTagInput || '').trim()
    if (!tag) return
    if (this.data.tags.includes(tag)) {
      this.setData({ newTagInput: '' })
      return
    }
    this.setData({
      tags: this.data.tags.concat(tag),
      newTagInput: '',
      isDirty: true
    })
    this.scheduleAutoSave()
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      tags: this.data.tags.filter(t => t !== tag),
      isDirty: true
    })
    this.scheduleAutoSave()
  },

  scheduleAutoSave() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => {
      this.saveNote({ silent: true })
    }, 3000)
  },

  saveNote(options = {}) {
    const { silent } = options
    const { noteId, title, content, tags } = this.data
    if (!silent) {
      this.setData({ saving: true })
      wx.showLoading({ title: '保存中...', mask: true })
    }
    const note = dataService.upsertNote({
      id: noteId || undefined,
      title,
      content,
      tags
    })
    this.setData({
      noteId: note.id,
      isDirty: false
    })
    if (!silent) {
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ saving: false })
    }
  },

  onTapSave() {
    this.saveNote({ silent: false })
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  async onAIGenerateTitle() {
    if (!this.data.content && !this.data.title) return
    this.setData({ aiLoading: true })
    try {
      const title = await aiService.generateTitle(this.data.content || this.data.title)
      this.setData({ title, isDirty: true })
      this.scheduleAutoSave()
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  async onAIGenerateSummary() {
    if (!this.data.content) return
    this.setData({ aiLoading: true })
    try {
      const summary = await aiService.generateSummary(this.data.content, 120)
      const merged = `摘要：${summary}\n\n${this.data.content}`
      this.setData({ content: merged, isDirty: true })
      this.scheduleAutoSave()
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  async onAIExtractTags() {
    if (!this.data.content && !this.data.title) return
    this.setData({ aiLoading: true })
    try {
      const tags = await aiService.extractTags(this.data.content || this.data.title, 5)
      this.setData({
        tags: Array.from(new Set([].concat(this.data.tags || [], tags || []))),
        isDirty: true
      })
      this.scheduleAutoSave()
    } catch (e) {
      wx.showToast({ title: '提取失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  }
})