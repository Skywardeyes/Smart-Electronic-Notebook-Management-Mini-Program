/**
 * AnythingLLM 代理云函数
 *
 * 读取顺序：云函数环境变量 process.env → 下方明文 DEFAULT（当前为快速打通流程，勿用于生产/勿提交到公开仓库）。
 */
'use strict'

const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')
const { URL } = require('url')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/** 明文兜底（测试用）；线上请改用环境变量覆盖 */
const DEFAULT_ANYTHINGLLM = {
  ANYTHINGLLM_BASE_URL: 'http://127.0.0.1:3001',
  ANYTHINGLLM_API_KEY: 'S0AAAM1-RYCM4K5-N8JDMD6-YS3SCR0',
  /** 当前统一只使用聊天工作区；知识库工作区暂缓 */
  ANYTHINGLLM_WORKSPACE_CHAT: '5d269246-42f9-4ab3-a0e2-0199c1334cc5',
  ANYTHINGLLM_WORKSPACE_SLUG: '',
  ANYTHINGLLM_CHAT_MODE: 'chat'
}

function envAny(key) {
  const fromProc = process.env[key]
  if (fromProc !== undefined && String(fromProc).trim() !== '') {
    return String(fromProc).trim()
  }
  const dflt = DEFAULT_ANYTHINGLLM[key]
  if (dflt !== undefined && String(dflt).trim() !== '') {
    return String(dflt).trim()
  }
  return ''
}

function postJson(urlString, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const isHttps = u.protocol === 'https:'
    const requestLib = isHttps ? https : http
    const data = JSON.stringify(body)
    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        ...headers
      }
    }
    const req = requestLib.request(opts, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (c) => {
        raw += c
      })
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, raw })
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}


function buildChatUrl(baseUrl, slug) {
  const b = (baseUrl || '').trim().replace(/\/$/, '')
  if (!b) {
    throw new Error('ANYTHINGLLM_BASE_URL 未配置')
  }
  if (b.endsWith('/api')) {
    return `${b}/v1/workspace/${encodeURIComponent(slug)}/chat`
  }
  return `${b}/api/v1/workspace/${encodeURIComponent(slug)}/chat`
}

function buildRawTextUrl(baseUrl) {
  const b = (baseUrl || '').trim().replace(/\/$/, '')
  if (!b) {
    throw new Error('ANYTHINGLLM_BASE_URL 未配置')
  }
  if (b.endsWith('/api')) {
    return `${b}/v1/document/raw-text`
  }
  return `${b}/api/v1/document/raw-text`
}

function pickWorkspace(options) {
  const defaultSlug = envAny('ANYTHINGLLM_WORKSPACE_SLUG')
  const chatSlug = envAny('ANYTHINGLLM_WORKSPACE_CHAT') || defaultSlug

  if (options && options.workspace) {
    return String(options.workspace).trim()
  }
  // 知识库工作区暂缓：忽略 workspaceType 中的 kb，一律使用聊天工作区 slug
  return chatSlug
}

exports.main = async (event) => {
  const action = event && event.action
  const prompt = event && event.prompt
  const options = (event && event.options) || {}
  const baseUrl = envAny('ANYTHINGLLM_BASE_URL')
  const apiKey = envAny('ANYTHINGLLM_API_KEY')
  const defaultMode = envAny('ANYTHINGLLM_CHAT_MODE') || 'chat'
  const slug = pickWorkspace(options)

  if (!apiKey || !slug) {
    return {
      success: false,
      message:
        '云函数未配置 ANYTHINGLLM_API_KEY 或工作区变量，请配置 ANYTHINGLLM_WORKSPACE_CHAT 或 ANYTHINGLLM_WORKSPACE_SLUG'
    }
  }

  if (action === 'ingestNote') {
    const textContent = event && event.textContent
    const title = (event && event.title) || '未命名笔记'
    if (!textContent || typeof textContent !== 'string') {
      return { success: false, message: '缺少 textContent' }
    }
    let rawTextUrl
    try {
      rawTextUrl = buildRawTextUrl(baseUrl)
    } catch (e) {
      return { success: false, message: e.message }
    }

    const ingestBody = {
      textContent,
      addToWorkspaces: slug,
      metadata: {
        title
      }
    }

    try {
      const { statusCode, raw } = await postJson(rawTextUrl, ingestBody, {
        Authorization: `Bearer ${apiKey}`
      })
      let json
      try {
        json = JSON.parse(raw)
      } catch (e) {
        return {
          success: false,
          message: `AnythingLLM 返回非 JSON (HTTP ${statusCode})`,
          detail: (raw || '').slice(0, 500)
        }
      }

      if (statusCode >= 400 || !json || json.success === false) {
        return {
          success: false,
          message:
            (json && (json.error || json.message)) ||
            `AnythingLLM HTTP ${statusCode}`,
          detail: json
        }
      }

      const doc =
        json &&
        Array.isArray(json.documents) &&
        json.documents.length > 0
          ? json.documents[0]
          : null
      return {
        success: true,
        uploaded: true,
        workspace: slug,
        documentLocation: doc && doc.location ? doc.location : ''
      }
    } catch (e) {
      return {
        success: false,
        message: e.message || '上传笔记到工作区失败'
      }
    }
  }

  if (!prompt || typeof prompt !== 'string') {
    return { success: false, message: '缺少 prompt' }
  }

  let url
  try {
    url = buildChatUrl(baseUrl, slug)
  } catch (e) {
    return { success: false, message: e.message }
  }

  const wxContext = cloud.getWXContext()
  const sessionId =
    options.sessionId || `mp_${wxContext.OPENID || 'anon'}`

  const body = {
    message: prompt,
    mode: options.mode || defaultMode,
    sessionId,
    reset: !!options.reset
  }
  if (typeof options.max_tokens === 'number' && options.max_tokens > 0) {
    body.max_tokens = options.max_tokens
  }

  try {
    const { statusCode, raw } = await postJson(url, body, {
      Authorization: `Bearer ${apiKey}`
    })

    let json
    try {
      json = JSON.parse(raw)
    } catch (e) {
      return {
        success: false,
        message: `AnythingLLM 返回非 JSON (HTTP ${statusCode})`,
        detail: (raw || '').slice(0, 500)
      }
    }

    if (statusCode >= 400) {
      return {
        success: false,
        message:
          (json && (json.error || json.message)) || `AnythingLLM HTTP ${statusCode}`,
        detail: json
      }
    }

    if (json.error != null && json.error !== 'null' && json.error !== '') {
      return { success: false, message: String(json.error) }
    }

    if (json.type === 'abort') {
      return {
        success: false,
        message: json.textResponse || 'AnythingLLM 中止了回复'
      }
    }

    const text = json.textResponse
    if (text == null || text === '') {
      return {
        success: false,
        message: 'AnythingLLM 未返回 textResponse',
        detail: json
      }
    }

    return { success: true, text: String(text) }
  } catch (e) {
    return {
      success: false,
      message: e.message || '请求 AnythingLLM 失败（请检查云函数外网与实例地址）'
    }
  }
}
