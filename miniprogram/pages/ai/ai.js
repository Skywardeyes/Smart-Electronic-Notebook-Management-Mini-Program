const aiService = require('../../utils/aiService.js')
const aiPrefill = require('../../utils/aiPrefill.js')
const dataService = require('../../utils/dataService.js')
const aiSessionStore = require('../../utils/aiSessionStore.js')

const MAX_NOTE_SUMMARY_CHARS = 220
const MAX_CONTEXT_CHARS = 3000

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

/** WXML 中不宜用 indexOf 判断选中，给每条笔记打上布尔标记供模板绑定 */
function withPickerSelection(list, selectedIds) {
  const set = new Set((selectedIds || []).map((id) => String(id)))
  return (list || []).map((n) =>
    Object.assign({}, n, { pickerSelected: set.has(String(n.id)) })
  )
}

Page({
  data: {
    mode: 'qa', // qa | polish
    /** 当前对话 none | 历史对话 history */
    contextType: 'none',
    currentSessionId: '',
    savedSessions: [],
    inputText: '',
    resultText: '',
    loading: false,
    qaHistory: [],
    attachTag: null,
    notePickerOpen: false,
    allNotes: [],
    selectedNoteIds: [],
    selectedNoteCount: 0,
    contextTruncated: false
  },

  formatSessionDate(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  decorateSessions(list) {
    return (list || []).map((s) =>
      Object.assign({}, s, {
        dateText: this.formatSessionDate(s.updatedAt)
      })
    )
  },

  persistCurrentQASession() {
    const { currentSessionId, qaHistory } = this.data
    if (!currentSessionId || !qaHistory || qaHistory.length === 0) return
    const listRaw = aiSessionStore.loadSessions()
    const existing = listRaw.find((x) => x.id === currentSessionId)
    const session = {
      id: currentSessionId,
      createdAt: existing ? existing.createdAt : this._sessionCreatedAt || Date.now(),
      updatedAt: Date.now(),
      qaHistory: JSON.parse(JSON.stringify(qaHistory)),
      preview: aiSessionStore.makePreview(qaHistory)
    }
    const next = aiSessionStore.upsertSessionInList(listRaw, session)
    aiSessionStore.saveSessions(next)
    aiSessionStore.writeSessionFile(session)
  },

  /** 归档当前会话（若有内容）并开启新会话 ID，用于「当前对话」或从编辑页带附件进入 */
  startNewConversation() {
    this.persistCurrentQASession()
    const attach = this.data.attachTag
    if (attach) {
      aiPrefill.clearAttachResources(attach)
    }
    const newId = aiSessionStore.generateSessionId()
    this._sessionCreatedAt = Date.now()
    this.setData({
      currentSessionId: newId,
      qaHistory: [],
      inputText: '',
      attachTag: null,
      contextType: 'none',
      savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
    })
  },

  beginSessionFromEditor(attachPayload) {
    this.persistCurrentQASession()
    const newId = aiSessionStore.generateSessionId()
    this._sessionCreatedAt = Date.now()
    this.setData({
      mode: 'qa',
      contextType: 'none',
      currentSessionId: newId,
      qaHistory: [],
      inputText: '',
      resultText: '',
      attachTag: attachPayload,
      selectedNoteIds: [],
      selectedNoteCount: 0,
      contextTruncated: false,
      allNotes: withPickerSelection(this.data.allNotes, []),
      savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
    })
  },

  onLoad(options) {
    const mode = options && options.mode === 'polish' ? 'polish' : 'qa'
    const id = aiSessionStore.generateSessionId()
    this._sessionCreatedAt = Date.now()
    this.setData({
      mode,
      currentSessionId: id,
      savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
    })
    this.loadSelectableNotes()
  },

  onShow() {
    const app = getApp()
    const attach = app.globalData && app.globalData.aiAttach
    if (attach && attach.type) {
      delete app.globalData.aiAttach
      this.beginSessionFromEditor({
        type: attach.type,
        label: attach.tagLabel || '上下文',
        noteId: attach.noteId || ''
      })
      return
    }
    this.setData({
      savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
    })
    this.loadSelectableNotes()
  },

  onUnload() {
    if (this.data.mode === 'qa') {
      this.persistCurrentQASession()
    }
    const attach = this.data.attachTag
    if (attach) {
      aiPrefill.clearAttachResources(attach)
    }
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (this.data.mode === 'qa') {
      if (this.data.attachTag) {
        aiPrefill.clearAttachResources(this.data.attachTag)
      }
      this.persistCurrentQASession()
    }
    this.setData({
      mode,
      inputText: '',
      resultText: '',
      attachTag: null,
      notePickerOpen: false,
      selectedNoteIds: [],
      selectedNoteCount: 0,
      contextTruncated: false,
      allNotes: withPickerSelection(this.data.allNotes, []),
      savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
    })
  },

  switchContext(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'history') {
      this.setData({
        contextType: 'history',
        notePickerOpen: false,
        savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
      })
      return
    }
    if (type === 'none') {
      this.startNewConversation()
    }
  },

  onDeleteHistorySession(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '删除对话',
      content: '确定永久删除该条对话记录？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: (res) => {
        if (!res.confirm) return
        aiSessionStore.hardDeleteSession(id)
        if (this.data.currentSessionId === id) {
          const newId = aiSessionStore.generateSessionId()
          this._sessionCreatedAt = Date.now()
          this.setData({
            currentSessionId: newId,
            qaHistory: [],
            inputText: ''
          })
        }
        this.setData({
          savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
        })
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  onOpenSession(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const s = aiSessionStore.getSessionById(id)
    if (!s || !Array.isArray(s.qaHistory)) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      return
    }
    this._sessionCreatedAt = s.createdAt || Date.now()
    this.setData({
      contextType: 'none',
      currentSessionId: id,
      qaHistory: JSON.parse(JSON.stringify(s.qaHistory)),
      inputText: ''
    })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  loadSelectableNotes() {
    const list = dataService
      .getNotes(false)
      .slice()
      .sort((a, b) => (b.updateTime || '').localeCompare(a.updateTime || ''))
      .map((n) => {
        const title = String(n.title || '未命名笔记').trim() || '未命名笔记'
        const plain = htmlToPlainText(n.summary || '') || htmlToPlainText(n.content || '')
        const preview = plain.length > 80 ? `${plain.slice(0, 80)}...` : plain
        return {
          id: n.id,
          title,
          summary: plain,
          preview
        }
      })
    const existed = new Set(list.map((x) => x.id))
    const selected = (this.data.selectedNoteIds || []).filter((id) => existed.has(id))
    this.setData({
      allNotes: withPickerSelection(list, selected),
      selectedNoteIds: selected,
      selectedNoteCount: selected.length
    })
  },

  toggleNotePicker() {
    if (this.data.mode !== 'qa' || this.data.contextType === 'history') return
    this.setData({ notePickerOpen: !this.data.notePickerOpen })
  },

  toggleNoteSelect(e) {
    if (this.data.mode !== 'qa') return
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    const set = new Set(this.data.selectedNoteIds || [])
    if (set.has(id)) set.delete(id)
    else set.add(id)
    const selectedNoteIds = Array.from(set)
    this.setData({
      selectedNoteIds,
      selectedNoteCount: selectedNoteIds.length,
      contextTruncated: false,
      allNotes: withPickerSelection(this.data.allNotes, selectedNoteIds)
    })
    if (this.data.attachTag && selectedNoteIds.length) {
      aiPrefill.clearAttachResources(this.data.attachTag)
      this.setData({ attachTag: null })
    }
  },

  toggleSelectAllNotes() {
    if (this.data.mode !== 'qa') return
    const allIds = (this.data.allNotes || []).map((n) => n.id)
    if (!allIds.length) return
    const allSelected = (this.data.selectedNoteIds || []).length === allIds.length
    const next = allSelected ? [] : allIds
    this.setData({
      selectedNoteIds: next,
      selectedNoteCount: next.length,
      contextTruncated: false,
      allNotes: withPickerSelection(this.data.allNotes, next)
    })
    if (this.data.attachTag && next.length) {
      aiPrefill.clearAttachResources(this.data.attachTag)
      this.setData({ attachTag: null })
    }
  },

  clearSelectedNotes() {
    this.setData({
      selectedNoteIds: [],
      selectedNoteCount: 0,
      contextTruncated: false,
      allNotes: withPickerSelection(this.data.allNotes, [])
    })
  },

  onRemoveAttach() {
    const attach = this.data.attachTag
    if (!attach) return
    aiPrefill.clearAttachResources(attach)
    this.setData({ attachTag: null })
    wx.showToast({ title: '已移除上下文', icon: 'none' })
  },

  buildSelectedNotesPrompt(question) {
    const q = String(question || '').trim()
    if (!q) return null
    const selected = new Set(this.data.selectedNoteIds || [])
    if (!selected.size) return null
    const picked = (this.data.allNotes || []).filter((n) => selected.has(n.id))
    let block = ''
    picked.forEach((n, idx) => {
      const summaryRaw = String(n.summary || '').trim()
      const summary =
        summaryRaw.length > MAX_NOTE_SUMMARY_CHARS
          ? `${summaryRaw.slice(0, MAX_NOTE_SUMMARY_CHARS)}...`
          : summaryRaw
      block += `【笔记${idx + 1}】\n标题: ${n.title}\n摘要: ${summary || '无'}\n\n`
    })
    let truncated = false
    if (block.length > MAX_CONTEXT_CHARS) {
      block = `${block.slice(0, MAX_CONTEXT_CHARS)}\n...(已截断)`
      truncated = true
    }
    const merged =
      '以下是用户选择的笔记信息（标题+摘要），请优先基于这些信息回答问题；若信息不足请明确说明。\n\n' +
      block +
      '\n用户问题：\n' +
      q
    return {
      merged,
      displayUser: `【已选${picked.length}篇笔记】\n${q}`,
      truncated
    }
  },

  buildMergedQA(userQuestion) {
    const { attachTag } = this.data
    const q = (userQuestion || '').trim()
    if (!attachTag) {
      if (!q) return null
      return { merged: q, displayUser: q }
    }
    if (!q) {
      return { error: '请先输入您的问题' }
    }
    if (attachTag.type === 'clipboard') {
      const body = aiPrefill.readFileSafe(aiPrefill.FILE_CLIPBOARD).trim()
      if (!body) {
        return { error: '剪贴板上下文已失效，请重新操作' }
      }
      return {
        merged: aiPrefill.buildClipboardPrompt(body, q),
        displayUser: `【${attachTag.label}】\n${q}`
      }
    }
    if (attachTag.type === 'full_note_stored') {
      const note = dataService.getNoteById(attachTag.noteId)
      const body = (note && note.content ? String(note.content) : '').trim()
      if (!body) {
        return { error: '笔记正文为空或已删除' }
      }
      const title = (note && note.title) || attachTag.label
      return {
        merged: aiPrefill.buildFullNotePrompt(title, body, q),
        displayUser: `【${attachTag.label}】\n${q}`
      }
    }
    if (attachTag.type === 'full_note_editor') {
      const body = aiPrefill.readFileSafe(aiPrefill.FILE_FULL_EDITOR).trim()
      if (!body) {
        return { error: '笔记全文上下文已失效，请重新操作' }
      }
      return {
        merged: aiPrefill.buildFullNotePrompt(attachTag.label, body, q),
        displayUser: `【${attachTag.label}】\n${q}`
      }
    }
    return { error: '未知附件类型' }
  },

  async runQASend(userQuestion) {
    if (this.data.contextType === 'history') {
      this.setData({ contextType: 'none' })
    }
    const selectedBuilt = this.buildSelectedNotesPrompt(userQuestion)
    const built = selectedBuilt || this.buildMergedQA(userQuestion)
    if (!built) return
    if (built.error) {
      wx.showToast({ title: built.error, icon: 'none' })
      return
    }
    const attachTag = this.data.attachTag
    this.setData({ contextTruncated: !!built.truncated })
    this.setData({ loading: true })
    try {
      const answer = attachTag || (this.data.selectedNoteIds || []).length
        ? await aiService.requestAI(built.merged, { max_tokens: 512 })
        : await aiService.askQuestion(built.merged, '')
      const history = this.data.qaHistory.concat([
        { role: 'user', content: built.displayUser },
        { role: 'assistant', content: answer }
      ])
      if (attachTag) {
        aiPrefill.clearAttachResources(attachTag)
      }
      this.setData({
        qaHistory: history,
        inputText: '',
        attachTag: null,
        notePickerOpen: false,
        loading: false
      })
      this.persistCurrentQASession()
      this.setData({
        savedSessions: this.decorateSessions(aiSessionStore.loadActiveSessions())
      })
    } catch (e) {
      wx.showToast({ title: 'AI 调用失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async onSend() {
    const { mode, inputText } = this.data
    if (mode === 'qa') {
      await this.runQASend(inputText)
      return
    }
    if (!inputText) return
    this.setData({ loading: true })
    try {
      const polished = await aiService.polishText(inputText, '正式')
      this.setData({ resultText: polished })
    } catch (e) {
      wx.showToast({ title: 'AI 调用失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onQuickAsk(e) {
    const text = e.currentTarget.dataset.text || ''
    if (this.data.mode === 'qa') {
      this.runQASend(text)
      return
    }
    this.setData({ inputText: text }, () => {
      this.onSend()
    })
  },

  onCopyResult() {
    const text = this.data.resultText
    if (!text) return
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }
})
