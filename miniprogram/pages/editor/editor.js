const dataService = require('../../utils/dataService.js')
const aiService = require('../../utils/aiService.js')
const aiPrefill = require('../../utils/aiPrefill.js')

let autoSaveTimer = null
const FONT_SIZE_OPTIONS = [14, 16, 18, 22]
const CATEGORY_TAGS = ['学习笔记', '工作记录', '生活']
const COLOR_OPTIONS = [
  { label: '默认', value: '#000000' },
  { label: '红色', value: '#dc2626' },
  { label: '蓝色', value: '#2563eb' },
  { label: '绿色', value: '#16a34a' },
  { label: '紫色', value: '#7c3aed' }
]
const HIGHLIGHT_OPTIONS = [
  { label: '默认', value: 'transparent' },
  { label: '黄色高亮', value: '#fef08a' },
  { label: '绿色高亮', value: '#bbf7d0' },
  { label: '蓝色高亮', value: '#bfdbfe' },
  { label: '粉色高亮', value: '#fbcfe8' }
]

function looksLikeHtml(text) {
  const s = String(text || '')
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function plainTextToHtml(text) {
  const lines = String(text || '').split(/\r?\n/)
  if (!lines.length) return '<p><br></p>'
  return lines
    .map((line) => {
      if (!line.trim()) return '<p><br></p>'
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('')
}

function htmlToPlainText(html) {
  const s = String(html || '')
  return s
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

function extractImageItems(html) {
  const s = String(html || '')
  const out = []
  const seen = new Set()
  const figureRe = /<figure[\s\S]*?<img[\s\S]*?src=['"]([^'"]+)['"][\s\S]*?>([\s\S]*?)<\/figure>/gi
  let fm = figureRe.exec(s)
  while (fm) {
    const src = fm[1] || ''
    const tail = fm[2] || ''
    const capMatch = tail.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)
    const caption = htmlToPlainText(capMatch ? capMatch[1] : '')
    if (src && !seen.has(src)) {
      out.push({ src, caption })
      seen.add(src)
    }
    fm = figureRe.exec(s)
  }
  const imgRe = /<img[\s\S]*?src=['"]([^'"]+)['"][\s\S]*?>/gi
  let im = imgRe.exec(s)
  while (im) {
    const src = im[1] || ''
    if (src && !seen.has(src)) {
      const imgTag = im[0] || ''
      const capAttr =
        imgTag.match(/\sdata-caption=['"]([^'"]*)['"]/i) ||
        imgTag.match(/\salt=['"]([^'"]*)['"]/i)
      const caption = capAttr ? htmlToPlainText(capAttr[1] || '') : ''
      out.push({ src, caption })
      seen.add(src)
    }
    im = imgRe.exec(s)
  }
  return out
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function setImageCaptionInHtml(html, src, caption) {
  const s = String(html || '')
  if (!src) return s
  const safeCaption = escapeHtml((caption || '').trim())
  const esc = escapeRegExp(src)
  const imgRe = new RegExp(`<img[^>]*src=['"]${esc}['"][^>]*>`, 'i')
  const im = s.match(imgRe)
  if (!im || !im[0]) return s
  let imgTag = im[0]
  // 只更新 img 属性，避免引入 figure/figcaption 导致编辑器丢图
  imgTag = imgTag
    .replace(/\sdata-caption=['"][^'"]*['"]/i, '')
    .replace(/\salt=['"][^'"]*['"]/i, '')
  if (safeCaption) {
    imgTag = imgTag.replace(/>$/, ` alt="${safeCaption}" data-caption="${safeCaption}">`)
  }
  return s.replace(im[0], imgTag)
}

function normalizeTagsWithCategory(tags, preferredCategory) {
  const list = Array.isArray(tags) ? tags.map((x) => String(x || '').trim()).filter(Boolean) : []
  const dedup = Array.from(new Set(list))
  const existed = dedup.find((t) => CATEGORY_TAGS.includes(t))
  const category = existed || (CATEGORY_TAGS.includes(preferredCategory) ? preferredCategory : CATEGORY_TAGS[0])
  const others = dedup.filter((t) => !CATEGORY_TAGS.includes(t))
  return [category].concat(others)
}

function buildSaveSignature(payload) {
  const p = payload || {}
  const tags = Array.isArray(p.tags) ? p.tags.slice() : []
  return JSON.stringify({
    id: p.id || '',
    title: p.title || '',
    content: p.content || '',
    summary: p.summary || '',
    tags
  })
}

function generateDraftKey() {
  return `draft_${Date.now()}_${Math.floor(Math.random() * 100000)}`
}

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
    aiLoading: false,
    contentText: '',
    activeFormats: {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      header: false,
      list: false
    },
    imageList: [],
    imageItems: []
  },

  onLoad(options) {
    const app = getApp()
    // 优先消费全局编辑态，避免 onShow 之前误按“新建”路径保存出重复笔记
    const globalMode = app && app.globalData ? app.globalData.editorMode : ''
    const globalId = app && app.globalData ? app.globalData.editorNoteId : ''
    const mode = options.mode || (globalId && globalMode === 'edit' ? 'edit' : 'create')
    const id = options.id || (globalId && globalMode === 'edit' ? globalId : '')
    this._editingNoteId = id || ''
    this._draftKey = id || generateDraftKey()
    this._isSaving = false
    this._editorReady = false
    this._editorCtx = null
    this._pendingContentHtml = '<p><br></p>'
    this._lastSavedSignature = ''
    this.refreshAutoSaveSettings()
    this.setData({ mode, noteId: id })
    if (id && globalMode === 'edit') {
      delete app.globalData.editorNoteId
      delete app.globalData.editorMode
    }
    if (mode === 'edit' && id) {
      this.loadNoteIntoEditor(id)
    } else {
      // 新建模式下确保编辑器是空白的
      this.setData({
        mode: 'create',
        noteId: '',
        title: '',
        content: '',
        contentText: '',
        imageList: [],
        imageItems: [],
        summary: '',
        tags: [],
        newTagInput: '',
        isDirty: false
      })
      this._editingNoteId = ''
      this._draftKey = generateDraftKey()
    }
  },

  refreshAutoSaveSettings() {
    const settings = dataService.getSettings ? dataService.getSettings() : null
    const enabled = !settings || settings.autoSaveEnabled !== false
    const sec = settings && settings.autoSaveIntervalSec ? Number(settings.autoSaveIntervalSec) : 3
    this._autoSaveEnabled = enabled
    this._autoSaveDelayMs = Math.max(1000, (Number.isFinite(sec) ? sec : 3) * 1000)
  },

  onShow() {
    const app = getApp()
    const id = app.globalData.editorNoteId
    const mode = app.globalData.editorMode
    if (id && mode === 'edit' && id !== this._editingNoteId) {
      delete app.globalData.editorNoteId
      delete app.globalData.editorMode
      this.loadNoteIntoEditor(id)
    }
  },

  loadNoteIntoEditor(id) {
    const note = dataService.getNoteById(id)
    if (note) {
      const rawContent = note.content || ''
      const html = looksLikeHtml(rawContent) ? rawContent : plainTextToHtml(rawContent)
      this._editingNoteId = id
      this._draftKey = id
      this._pendingContentHtml = html || '<p><br></p>'
      const imageItems = extractImageItems(this._pendingContentHtml)
      this.setData({
        mode: 'edit',
        noteId: id,
        title: note.title || '',
        content: this._pendingContentHtml,
        contentText: htmlToPlainText(this._pendingContentHtml),
        imageList: imageItems.map((x) => x.src),
        imageItems,
        summary: note.summary || '',
        tags: note.tags || []
      })
      this._lastSavedSignature = buildSaveSignature({
        id,
        title: note.title || '',
        content: this._pendingContentHtml,
        summary: note.summary || '',
        tags: note.tags || []
      })
      if (this._editorReady && this._editorCtx) {
        this._editorCtx.setContents({ html: this._pendingContentHtml })
      }
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
    const value = e.detail.value || ''
    this.setData({ content: value, contentText: htmlToPlainText(value), isDirty: true })
    this.scheduleAutoSave()
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select('#noteEditor')
      .context((res) => {
        if (!res || !res.context) return
        this._editorCtx = res.context
        this._editorReady = true
        this._editorCtx.setContents({
          html: this._pendingContentHtml || this.data.content || '<p><br></p>'
        })
      })
      .exec()
  },

  onEditorInput(e) {
    const html = (e.detail && e.detail.html) || ''
    const text = (e.detail && e.detail.text) || htmlToPlainText(html)
    const imageItems = extractImageItems(html)
    this.setData({
      content: html,
      contentText: String(text || '').trim(),
      imageList: imageItems.map((x) => x.src),
      imageItems,
      isDirty: true
    })
    this.scheduleAutoSave()
  },

  onEditorStatusChange(e) {
    const f = (e.detail || {})
    this.setData({
      activeFormats: {
        bold: !!f.bold,
        italic: !!f.italic,
        underline: !!f.underline,
        strike: !!f.strike,
        header: !!f.header,
        list: !!f.list
      }
    })
  },

  onFormatTap(e) {
    const cmd = e.currentTarget.dataset.cmd
    if (!this._editorCtx) return
    if (cmd === 'fontSize') {
      this.onPickFontSize()
      return
    }
    if (cmd === 'image') {
      this.onInsertImagePlaceholder()
      return
    }
    if (cmd === 'undo') {
      this._editorCtx.undo()
      return
    }
    if (cmd === 'redo') {
      this._editorCtx.redo()
      return
    }
    if (cmd === 'color') {
      this.onPickTextColor()
      return
    }
    if (cmd === 'highlight') {
      this.onPickHighlightColor()
      return
    }
    if (cmd === 'header') {
      const next = this.data.activeFormats.header ? false : 'H2'
      this._editorCtx.format('header', next)
      return
    }
    if (cmd === 'list') {
      const next = this.data.activeFormats.list ? false : 'bullet'
      this._editorCtx.format('list', next)
      return
    }
    this._editorCtx.format(cmd)
  },

  onPickFontSize() {
    if (!this._editorCtx) return
    wx.showActionSheet({
      itemList: FONT_SIZE_OPTIONS.map((n) => `${n}px`),
      success: (res) => {
        const idx = res.tapIndex
        if (idx < 0 || idx >= FONT_SIZE_OPTIONS.length) return
        this._editorCtx.format('fontSize', `${FONT_SIZE_OPTIONS[idx]}px`)
      }
    })
  },

  onPickTextColor() {
    if (!this._editorCtx) return
    wx.showActionSheet({
      itemList: COLOR_OPTIONS.map((x) => x.label),
      success: (res) => {
        const idx = res.tapIndex
        if (idx < 0 || idx >= COLOR_OPTIONS.length) return
        this._editorCtx.format('color', COLOR_OPTIONS[idx].value)
      }
    })
  },

  onPickHighlightColor() {
    if (!this._editorCtx) return
    wx.showActionSheet({
      itemList: HIGHLIGHT_OPTIONS.map((x) => x.label),
      success: (res) => {
        const idx = res.tapIndex
        if (idx < 0 || idx >= HIGHLIGHT_OPTIONS.length) return
        this._editorCtx.format('backgroundColor', HIGHLIGHT_OPTIONS[idx].value)
      }
    })
  },

  onInsertImagePlaceholder() {
    if (!this._editorCtx) return
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = (res.tempFiles || []).filter((f) => f && f.tempFilePath)
        if (!files.length) return
        files.forEach((f) => {
          this._editorCtx.insertImage({
            src: f.tempFilePath,
            alt: '本地图片',
            success: () => {}
          })
        })
      },
      fail: () => {
        wx.showToast({ title: '未选择图片', icon: 'none' })
      }
    })
  },

  onPreviewInsertedImage(e) {
    const src = e.currentTarget.dataset.src
    if (!src) return
    const urls = (this.data.imageList || []).filter(Boolean)
    wx.previewImage({
      current: src,
      urls: urls.length ? urls : [src]
    })
  },

  onEditImageCaption(e) {
    const src = e.currentTarget.dataset.src
    if (!src) return
    const row = (this.data.imageItems || []).find((x) => x.src === src)
    wx.showModal({
      title: '图片说明',
      editable: true,
      placeholderText: '请输入图片说明（可选）',
      content: row && row.caption ? row.caption : '',
      success: (res) => {
        if (!res.confirm) return
        const nextHtml = setImageCaptionInHtml(this.data.content || '', src, res.content || '')
        const safeHtml = nextHtml.trim() ? nextHtml : '<p><br></p>'
        const imageItems = extractImageItems(safeHtml)
        this.setData({
          content: safeHtml,
          contentText: htmlToPlainText(safeHtml),
          imageList: imageItems.map((x) => x.src),
          imageItems,
          isDirty: true
        })
        if (this._editorCtx) {
          this._editorCtx.setContents({ html: safeHtml })
        }
        this.scheduleAutoSave()
      }
    })
  },

  onDeleteInsertedImage(e) {
    const src = e.currentTarget.dataset.src
    if (!src) return
    wx.showModal({
      title: '删除图片',
      content: '确定删除这张图片吗？',
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        const html = String(this.data.content || '')
        if (!html) return
        const re = new RegExp(
          `<img[^>]*src=['"]${escapeRegExp(src)}['"][^>]*>`,
          'gi'
        )
        const nextHtml = html.replace(re, '')
        const safeHtml = nextHtml.trim() ? nextHtml : '<p><br></p>'
        const imageItems = extractImageItems(safeHtml)
        this.setData({
          content: safeHtml,
          contentText: htmlToPlainText(safeHtml),
          imageList: imageItems.map((x) => x.src),
          imageItems,
          isDirty: true
        })
        if (this._editorCtx) {
          this._editorCtx.setContents({ html: safeHtml })
        }
        this.scheduleAutoSave()
        wx.showToast({ title: '已删除图片', icon: 'success' })
      }
    })
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
    if (!this._autoSaveEnabled) return
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => {
      this.saveNote({ silent: true })
    }, this._autoSaveDelayMs || 3000)
  },

  saveNote(options = {}) {
    if (this._isSaving) {
      return null
    }
    this._isSaving = true
    const { silent } = options
    const { title, content, summary, tags } = this.data
    const noteId = this._editingNoteId || this.data.noteId || ''
    const nextSignature = buildSaveSignature({
      id: noteId,
      title,
      content,
      summary,
      tags
    })
    if (nextSignature === this._lastSavedSignature) {
      this._isSaving = false
      return null
    }
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
        draftKey: this._draftKey || undefined,
        title,
        content,
        summary,
        tags
      })
      this._editingNoteId = note.id
      this._draftKey = note.id || this._draftKey
      this.setData({
        noteId: note.id,
        isDirty: false
      })
      this._lastSavedSignature = buildSaveSignature({
        id: note.id,
        title,
        content,
        summary,
        tags
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
    if (!this.data.contentText && !this.data.title) return
    this.setData({ aiLoading: true })
    try {
      const title = await aiService.generateTitle(this.data.contentText || this.data.title)
      this.setData({ title, isDirty: true })
      this.scheduleAutoSave()
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  async onAIGenerateSummary() {
    if (!this.data.contentText) return
    this.setData({ aiLoading: true })
    try {
      const summary = await aiService.generateSummary(this.data.contentText, 120)
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
    const t = (this.data.contentText || '').trim()
    if (!t) {
      wx.showToast({ title: '正文为空', icon: 'none' })
      return
    }
    aiPrefill.navigateWithFullNoteFromEditor(this.data.title, this.data.contentText)
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
    if (!this.data.contentText && !this.data.title) return
    this.setData({ aiLoading: true })
    try {
      const tags = await aiService.extractTags(this.data.contentText || this.data.title, 5)
      const currentCategory = (this.data.tags || []).find((t) => CATEGORY_TAGS.includes(t))
      const merged = normalizeTagsWithCategory([].concat(this.data.tags || [], tags || []), currentCategory)
      this.setData({
        tags: merged,
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