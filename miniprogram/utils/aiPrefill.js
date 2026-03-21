/**
 * AI 问答附件：选区用临时文件存剪贴板；全文在详情页用 noteId 取正文，在编辑页用临时文件存当前正文。
 * 小程序无法在系统复制菜单中增加按钮，选区需先复制再点「选区问AI」。
 */

const fs = wx.getFileSystemManager()
const USER = (wx.env && wx.env.USER_DATA_PATH) || ''
const FILE_CLIPBOARD = `${USER}/ai_attach_clipboard.tmp`
const FILE_FULL_EDITOR = `${USER}/ai_attach_fullnote_editor.tmp`

function ensureUserDataPath() {
  if (!USER) {
    wx.showToast({ title: '当前基础库不支持本地临时文件', icon: 'none' })
    return false
  }
  return true
}

function writeFileSafe(path, content) {
  fs.writeFileSync(path, String(content || ''), 'utf8')
}

function readFileSafe(path) {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch (e) {
    return ''
  }
}

function unlinkSafe(path) {
  try {
    fs.unlinkSync(path)
  } catch (e) {
    // ignore
  }
}

/** 合并剪贴板节选 + 用户问题 → 发给模型的完整文本 */
function buildClipboardPrompt(excerpt, userQuestion) {
  const q = (userQuestion || '').trim()
  const body = (excerpt || '').trim()
  return (
    '以下是用户从笔记中复制的一段节选，请先阅读，再结合后面「用户问题」作答。\n\n' +
    '---\n' +
    body +
    '\n---\n\n' +
    '用户问题：\n' +
    q
  )
}

/** 合并全文笔记 + 用户问题 */
function buildFullNotePrompt(title, fullBody, userQuestion) {
  const q = (userQuestion || '').trim()
  const body = (fullBody || '').trim()
  const t = (title || '').trim() || '未命名笔记'
  return (
    '以下是一篇完整笔记的全文（标题：' +
    t +
    '），请先阅读，再结合后面「用户问题」作答。\n\n' +
    '---\n' +
    body +
    '\n---\n\n' +
    '用户问题：\n' +
    q
  )
}

function setGlobalAttach(payload) {
  const app = getApp()
  if (!app.globalData) app.globalData = {}
  app.globalData.aiAttach = payload
}

/**
 * 剪贴板选区 → 写入临时文件并打开 AI 页（输入框保持空白，由标签栏提示）
 */
function navigateWithClipboardAttach(text) {
  const t = (text || '').trim()
  if (!t) {
    wx.showToast({ title: '没有可用文本', icon: 'none' })
    return
  }
  if (!ensureUserDataPath()) return
  writeFileSafe(FILE_CLIPBOARD, t)
  setGlobalAttach({
    type: 'clipboard',
    tagLabel: '剪贴板内容'
  })
  wx.navigateTo({ url: '/pages/ai/ai?mode=qa' })
}

/**
 * 笔记详情页「全文问AI」：标签为笔记标题，发送时从本地存储读正文
 */
function navigateWithFullNoteFromDetail(noteId, title) {
  const id = (noteId || '').trim()
  if (!id) {
    wx.showToast({ title: '笔记无效', icon: 'none' })
    return
  }
  unlinkSafe(FILE_FULL_EDITOR)
  setGlobalAttach({
    type: 'full_note_stored',
    noteId: id,
    tagLabel: (title || '').trim() || '笔记全文'
  })
  wx.navigateTo({ url: '/pages/ai/ai?mode=qa' })
}

/**
 * 编辑页「全文问AI」：用当前编辑区标题作标签，正文写入临时文件（含未保存修改）
 */
function navigateWithFullNoteFromEditor(title, content) {
  const body = (content || '').trim()
  if (!body) {
    wx.showToast({ title: '正文为空', icon: 'none' })
    return
  }
  if (!ensureUserDataPath()) return
  writeFileSafe(FILE_FULL_EDITOR, body)
  setGlobalAttach({
    type: 'full_note_editor',
    tagLabel: (title || '').trim() || '未命名笔记'
  })
  wx.navigateTo({ url: '/pages/ai/ai?mode=qa' })
}

/** 清除附件状态与临时文件（AI 页移除标签或发送成功后调用） */
function clearAttachResources(attach) {
  if (!attach || !attach.type) return
  if (attach.type === 'clipboard') {
    unlinkSafe(FILE_CLIPBOARD)
  }
  if (attach.type === 'full_note_editor') {
    unlinkSafe(FILE_FULL_EDITOR)
  }
}

module.exports = {
  FILE_CLIPBOARD,
  FILE_FULL_EDITOR,
  readFileSafe,
  buildClipboardPrompt,
  buildFullNotePrompt,
  navigateWithClipboardAttach,
  navigateWithFullNoteFromDetail,
  navigateWithFullNoteFromEditor,
  clearAttachResources
}
