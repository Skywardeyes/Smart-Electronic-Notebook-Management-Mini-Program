/**
 * AI 问答会话本地存储 + 每条会话一份文本文件（USER_DATA_PATH）
 * status: normal | deleted（回收站）
 */
const STORAGE_KEY = 'ai_chat_sessions_v1'
const MAX_SESSIONS = 120

const STATUS_NORMAL = 'normal'
const STATUS_DELETED = 'deleted'

function generateSessionId() {
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

function loadSessionsRaw() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    let list = Array.isArray(raw) ? raw : []
    let changed = false
    list = list.map((s) => {
      if (!s.status) {
        changed = true
        return Object.assign({}, s, { status: STATUS_NORMAL })
      }
      return s
    })
    if (changed) {
      try {
        wx.setStorageSync(STORAGE_KEY, list.slice(0, MAX_SESSIONS))
      } catch (e) {}
    }
    return list
  } catch (e) {
    return []
  }
}

function saveSessions(list) {
  try {
    wx.setStorageSync(STORAGE_KEY, (list || []).slice(0, MAX_SESSIONS))
  } catch (e) {}
}

/** 全部会话（含回收站），内部合并用 */
function loadSessions() {
  return loadSessionsRaw()
}

function loadActiveSessions() {
  return loadSessionsRaw().filter((s) => s.status !== STATUS_DELETED)
}

function loadDeletedSessions() {
  return loadSessionsRaw().filter((s) => s.status === STATUS_DELETED)
}

function countDeletedSessions() {
  return loadDeletedSessions().length
}

function filePathForSession(id) {
  const u = wx.env && wx.env.USER_DATA_PATH
  if (!u || !id) return ''
  return `${u}/ai_conv_${id}.txt`
}

function unlinkSessionFile(id) {
  const p = filePathForSession(id)
  if (!p) return
  try {
    wx.getFileSystemManager().unlinkSync(p)
  } catch (e) {
    // ignore
  }
}

function makePreview(qaHistory) {
  const first = (qaHistory || []).find((m) => m.role === 'user')
  const t = first && first.content ? String(first.content) : '（空会话）'
  return t.length > 56 ? `${t.slice(0, 56)}…` : t
}

function formatSessionAsText(session) {
  const lines = []
  lines.push('# 智能云笔记 · AI 对话记录')
  lines.push(`会话ID: ${session.id}`)
  lines.push(`创建: ${new Date(session.createdAt || 0).toLocaleString()}`)
  lines.push(`更新: ${new Date(session.updatedAt || 0).toLocaleString()}`)
  lines.push('')
  ;(session.qaHistory || []).forEach((m) => {
    const tag = m.role === 'user' ? '问' : '答'
    lines.push(`【${tag}】${m.content || ''}`)
    lines.push('')
  })
  return lines.join('\n')
}

function writeSessionFile(session) {
  const p = filePathForSession(session.id)
  if (!p) return
  try {
    wx.getFileSystemManager().writeFileSync(p, formatSessionAsText(session), 'utf8')
  } catch (e) {
    console.warn('writeSessionFile', e)
  }
}

function upsertSessionInList(list, session) {
  const arr = Array.isArray(list) ? list.slice() : []
  const i = arr.findIndex((s) => s.id === session.id)
  const prev = i >= 0 ? arr[i] : {}
  const nextSession = Object.assign({}, prev, session)
  if (!nextSession.status) nextSession.status = STATUS_NORMAL
  if (i >= 0) {
    nextSession.createdAt = prev.createdAt || nextSession.createdAt
    arr[i] = nextSession
  } else {
    arr.unshift(nextSession)
  }
  return arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, MAX_SESSIONS)
}

/** 仅未删除的会话（用于历史列表、继续对话） */
function getSessionById(id) {
  const s = loadSessionsRaw().find((x) => x.id === id)
  if (!s || s.status === STATUS_DELETED) return null
  return s
}

function getSessionByIdIncludeDeleted(id) {
  return loadSessionsRaw().find((x) => x.id === id) || null
}

function softDeleteSession(id) {
  const list = loadSessionsRaw()
  const i = list.findIndex((s) => s.id === id)
  if (i < 0) return false
  list[i].status = STATUS_DELETED
  list[i].deletedAt = Date.now()
  saveSessions(list)
  unlinkSessionFile(id)
  return true
}

function restoreSession(id) {
  const list = loadSessionsRaw()
  const i = list.findIndex((s) => s.id === id)
  if (i < 0) return false
  list[i].status = STATUS_NORMAL
  delete list[i].deletedAt
  saveSessions(list)
  writeSessionFile(list[i])
  return true
}

function hardDeleteSession(id) {
  const list = loadSessionsRaw().filter((s) => s.id !== id)
  saveSessions(list)
  unlinkSessionFile(id)
  return true
}

function purgeAllDeletedSessions() {
  const raw = loadSessionsRaw()
  const deleted = raw.filter((s) => s.status === STATUS_DELETED)
  deleted.forEach((s) => unlinkSessionFile(s.id))
  const kept = raw.filter((s) => s.status !== STATUS_DELETED)
  saveSessions(kept)
}

/** 清空全部 AI 会话（含回收站）及本地会话文件，用于设置页「清理历史会话」 */
function clearAllSessions() {
  loadSessionsRaw().forEach((s) => {
    if (s && s.id) unlinkSessionFile(s.id)
  })
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {}
}

module.exports = {
  STORAGE_KEY,
  STATUS_NORMAL,
  STATUS_DELETED,
  generateSessionId,
  loadSessions,
  loadActiveSessions,
  loadDeletedSessions,
  countDeletedSessions,
  saveSessions,
  writeSessionFile,
  makePreview,
  upsertSessionInList,
  getSessionById,
  getSessionByIdIncludeDeleted,
  softDeleteSession,
  restoreSession,
  hardDeleteSession,
  purgeAllDeletedSessions,
  clearAllSessions,
  filePathForSession
}
