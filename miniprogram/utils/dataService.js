const STORAGE_KEYS = {
  USER_INFO: 'userInfo',
  NOTES: 'notes',
  CATEGORIES: 'categories',
  DRAFTS: 'drafts',
  SETTINGS: 'settings',
  CONVERSATION_HISTORY: 'conversationHistory',
  LAST_SYNC_TIME: 'lastSyncTime'
}

function nowISO() {
  return new Date().toISOString()
}

function loadArray(key) {
  try {
    return wx.getStorageSync(key) || []
  } catch (e) {
    return []
  }
}

function saveArray(key, value) {
  try {
    wx.setStorageSync(key, value || [])
  } catch (e) {}
}

function loadObject(key) {
  try {
    return wx.getStorageSync(key) || {}
  } catch (e) {
    return {}
  }
}

function saveObject(key, value) {
  try {
    wx.setStorageSync(key, value || {})
  } catch (e) {}
}

function generateNoteId() {
  return `note_${Date.now()}_${Math.floor(Math.random() * 100000)}`
}

function getNotes(includeDeleted = false) {
  let list = loadArray(STORAGE_KEYS.NOTES)
  let changed = false
  list = list.map(n => {
    const id = n.id || n._id
    if (!id) {
      n.id = generateNoteId()
      changed = true
    } else if (!n.id) {
      n.id = id
    }
    return n
  })
  if (changed) {
    saveArray(STORAGE_KEYS.NOTES, list)
  }
  if (!includeDeleted) {
    list = list.filter(n => n.status !== 'deleted')
  }
  return list
}

function getNoteById(id) {
  return getNotes(true).find(n => n.id === id) || null
}

function upsertNote(note) {
  const notes = getNotes(true)
  let target = note
  const now = nowISO()

  if (!note.id) {
    target = Object.assign(
      {
        id: generateNoteId(),
        userId: 'demo_user',
        title: '',
        content: '',
        summary: '',
        tags: [],
        category: '默认',
        status: 'normal',
        createTime: now,
        updateTime: now,
        deleteTime: '',
        isFavorite: false,
        attachments: [],
        aiMetadata: {
          summaryGenerated: false,
          tagsGenerated: false,
          lastAnalyzed: ''
        }
      },
      note
    )
    notes.unshift(target)
  } else {
    const index = notes.findIndex(n => n.id === note.id)
    if (index >= 0) {
      notes[index] = Object.assign({}, notes[index], note, {
        updateTime: now
      })
      target = notes[index]
    } else {
      target.updateTime = now
      notes.unshift(target)
    }
  }

  saveArray(STORAGE_KEYS.NOTES, notes)
  return target
}

function softDeleteNote(id) {
  const notes = getNotes(true)
  const now = nowISO()
  const index = notes.findIndex(n => n.id === id)
  if (index >= 0) {
    notes[index].status = 'deleted'
    notes[index].deleteTime = now
    saveArray(STORAGE_KEYS.NOTES, notes)
  }
}

function restoreNote(id) {
  const notes = getNotes(true)
  const index = notes.findIndex(n => n.id === id)
  if (index >= 0) {
    notes[index].status = 'normal'
    notes[index].deleteTime = ''
    saveArray(STORAGE_KEYS.NOTES, notes)
  }
}

function hardDeleteNote(id) {
  const notes = getNotes(true).filter(n => n.id !== id)
  saveArray(STORAGE_KEYS.NOTES, notes)
}

function getRecentNotes(limit = 5) {
  return getNotes(false)
    .slice()
    .sort((a, b) => (b.updateTime || '').localeCompare(a.updateTime || ''))
    .slice(0, limit)
}

function getCategories() {
  let list = loadArray(STORAGE_KEYS.CATEGORIES)
  if (!list.length) {
    list = [
      { id: 'all', name: '全部', icon: '📚', noteCount: 0, createTime: nowISO(), sortOrder: 0 },
      { id: 'study', name: '学习笔记', icon: '📖', noteCount: 0, createTime: nowISO(), sortOrder: 1 },
      { id: 'work', name: '工作记录', icon: '💼', noteCount: 0, createTime: nowISO(), sortOrder: 2 },
      { id: 'life', name: '生活', icon: '🏠', noteCount: 0, createTime: nowISO(), sortOrder: 3 }
    ]
    saveArray(STORAGE_KEYS.CATEGORIES, list)
  }
  return list
}

function saveCategories(list) {
  saveArray(STORAGE_KEYS.CATEGORIES, list)
}

function getUserInfo() {
  const info = loadObject(STORAGE_KEYS.USER_INFO)
  if (info && info.nickName) return info
  const mock = {
    nickName: '云端拾笔',
    avatarUrl: '/assets/avatar/default.png',
    wechatId: 'demo_wechat'
  }
  saveObject(STORAGE_KEYS.USER_INFO, mock)
  return mock
}

module.exports = {
  STORAGE_KEYS,
  getNotes,
  getNoteById,
  upsertNote,
  softDeleteNote,
  restoreNote,
  hardDeleteNote,
  getRecentNotes,
  getCategories,
  saveCategories,
  getUserInfo
}

