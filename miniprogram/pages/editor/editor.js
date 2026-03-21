const dataService = require('../../utils/dataService.js')
const aiService = require('../../utils/aiService.js')
const aiPrefill = require('../../utils/aiPrefill.js')

let autoSaveTimer = null

Page({
  data: {
    mode: 'create', // create | edit
    noteId: '',
    title: '',
    content: '',
    summary: '',
    tags: [],
    newTagInput: '',
    isDirty: false,
    saving: false,
    aiLoading: false
  },

  onLoad(options) {
    const mode = options.mode || 'create'
    const id = options.id || ''
    this._editingNoteId = id || ''
    this._isSaving = false
    this.setData({ mode, noteId: id })
    if (mode === 'edit' && id) {
      this.loadNoteIntoEditor(id)
    } else {
      // 新建模式下确保编辑器是空白的
      this.setData({
        mode: 'create',
        noteId: '',
        title: '',
        content: '',
        summary: '',
        tags: [],
        newTagInput: '',
        isDirty: false
      })
      this._editingNoteId = ''
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
      this._editingNoteId = id
      this.setData({
        mode: 'edit',
        noteId: id,
        title: note.title || '',
        content: note.content || '',
        summary: note.summary || '',
        tags: note.tags || []
      })
    }
  },

  onUnload() {
    if (this._skipUnloadSave) {
      return
    }
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

  onSummaryInput(e) {
    this.setData({ summary: e.detail.value, isDirty: true })
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
    if (this._isSaving) {
      return null
    }
    this._isSaving = true
    const { silent } = options
    const { title, content, summary, tags } = this.data
    const noteId = this._editingNoteId || this.data.noteId || ''
    if (!silent) {
      this.setData({ saving: true })
      wx.showLoading({ title: '保存中...', mask: true })
    }
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
    try {
      const note = dataService.upsertNote({
        id: noteId || undefined,
        title,
        content,
        summary,
        tags
      })
      this._editingNoteId = note.id
      this.setData({
        noteId: note.id,
        isDirty: false
      })
      if (!silent) {
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
        this.setData({ saving: false })
      }
      return note
    } finally {
      this._isSaving = false
    }
  },

  async onTapSave() {
    const shouldIngest = this.data.mode === 'create'
    const note = this.saveNote({ silent: false })
    if (shouldIngest && note && (note.title || note.content)) {
      try {
        await aiService.ingestNoteToKnowledgeBase(note)
      } catch (e) {
        wx.showToast({ title: '笔记已保存，工作区同步失败', icon: 'none' })
      }
    }
    this._skipUnloadSave = true
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
      this.setData({ summary, isDirty: true })
      this.scheduleAutoSave()
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  /** 剪贴板中的选中文本 → AI 问答页（需用户先在正文里复制选区） */
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

  /** 当前正文全文 → AI 问答页（标签为当前标题，正文含未保存内容写入临时文件） */
  onAskFullBodyForAI() {
    const t = (this.data.content || '').trim()
    if (!t) {
      wx.showToast({ title: '正文为空', icon: 'none' })
      return
    }
    aiPrefill.navigateWithFullNoteFromEditor(this.data.title, this.data.content)
  },

  /** 长按正文区域：快捷菜单 */
  onBodyAreaLongPress() {
    wx.showActionSheet({
      itemList: ['用剪贴板选区问AI（需先复制）', '用当前全文问AI'],
      success: (res) => {
        if (res.tapIndex === 0) this.onAskClipForAI()
        else if (res.tapIndex === 1) this.onAskFullBodyForAI()
      }
    })
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