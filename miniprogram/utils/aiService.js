const AI_CONFIG = require('../config/ai.config.js')
const CATEGORY_TAGS = ['学习笔记', '工作记录', '生活']

const DEFAULT_DELAY_MIN = 800
const DEFAULT_DELAY_MAX = 1500

function randomDelay() {
  const range = DEFAULT_DELAY_MAX - DEFAULT_DELAY_MIN
  return DEFAULT_DELAY_MIN + Math.floor(Math.random() * range)
}

/**
 * 去掉模型「思考链 / think」等内部输出，只保留最终回答。
 * 兼容： fenced ```think、<think>、redacted_reasoning、Final decision 等。
 */
function stripThinkingOutput(raw) {
  if (raw == null) return ''
  const original = String(raw).replace(/\r\n/g, '\n').trim()
  let s = original

  // 1) 最稳妥：如果有 </think>，只取最后一个闭合标签后的正文
  const closeIdx = s.lastIndexOf('</think>')
  if (closeIdx !== -1) {
    const tail = s.slice(closeIdx + '</think>'.length).trim()
    if (tail) return tail
  }

  // 2) 再兜底：移除完整 think 块
  s = s
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:think|thinking|reasoning|思考)[\s\S]*?```/gi, '')
    .trim()

  if (s) return s
  return original
}

/**
 * 将模型返回的标签文本解析为数组，兼容逗号/顿号/分号/换行/编号列表等格式。
 */
function parseTagsFromAIResult(raw, count = 5) {
  const text = String(raw || '').trim()
  if (!text) return []
  return text
    .replace(/\r\n/g, '\n')
    .split(/[\n,，、;；|]+/)
    .map((s) =>
      s
        .trim()
        // 清理常见列表前缀：-、*、1.、1)、（1）等
        .replace(/^[-*#\s]+/, '')
        .replace(/^[（(]?\d+[)）.\s]+/, '')
        .replace(/^标签[:：]\s*/i, '')
        .trim()
    )
    .filter(Boolean)
    .slice(0, Math.max(1, Number(count) || 5))
}

/** 本地模拟（不含任何密钥，仅 USE_MOCK_AI 时使用） */
function mockRequestAI(prompt) {
  const text = typeof prompt === 'string' ? prompt : String(prompt || '')
  const shouldFail = Math.random() < 0.1

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('模拟 AI 调用失败，请稍后重试'))
        return
      }

      let result = '这是一个模拟的AI回答'
      if (text.includes('标题')) {
        result = '智能笔记示例'
      } else if (text.includes('摘要')) {
        result = '这是一段模拟的AI生成摘要，用于开发阶段展示效果。'
      } else if (text.includes('标签')) {
        result = 'AI,笔记,智能管理'
      }
      resolve(result)
    }, randomDelay())
  })
}

/**
 * 底层统一入口：正式环境经云函数转发 AnythingLLM，密钥仅存云函数环境变量。
 * @param {string} prompt 完整提示词
 * @param {object} [options] 可选：mode / sessionId / reset，会透传给云函数并写入 AnythingLLM 请求体
 */
function requestAI(prompt, options = {}) {
  if (AI_CONFIG.USE_MOCK_AI) {
    return mockRequestAI(prompt)
  }

  if (!wx.cloud) {
    return Promise.reject(new Error('当前基础库不支持云开发，无法调用 AI'))
  }

  const name = AI_CONFIG.CLOUD_FUNCTION_NAME || 'anythingllmChat'

  return wx.cloud
    .callFunction({
      name,
      data: {
        prompt: typeof prompt === 'string' ? prompt : String(prompt || ''),
        options: options && typeof options === 'object' ? options : {}
      }
    })
    .then((res) => {
      const r = res.result
      if (!r || r.success !== true) {
        const msg =
          (r && r.message) ||
          (res.errMsg && String(res.errMsg)) ||
          'AI 调用失败'
        return Promise.reject(new Error(msg))
      }
      return stripThinkingOutput(r.text)
    })
}

function generateTitle(content) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。

请根据以下内容生成一个简短准确的中文标题，并严格遵守：
1) 标题尽量控制在 8-12 个字；
2) 最长不超过 15 个字；
3) 不要使用标点符号结尾；
4) 仅输出标题本身，不要解释、不要前后缀。

内容如下：
${content || ''}`
  return requestAI(prompt, { workspaceType: 'chat', mode: 'chat' })
}

function generateSummary(content, length = 150) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请为以下内容生成一个大约 ${length} 字的摘要，突出重点，语言简洁，仅输出摘要，不要输出其他内容：\n\n${content || ''}`
  return requestAI(prompt, { workspaceType: 'chat', mode: 'chat' })
}

function extractTags(content, count = 5) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。

请从以下内容中提取 ${count} 个标签，并严格遵守：
1) 结果中必须包含且仅包含 1 个分类标签，且只能从「${CATEGORY_TAGS.join(' / ')}」中选择；
2) 其余标签为内容关键词，不要与分类标签重复；
3) 仅输出标签本身，用中文逗号分隔，不要解释。

待分析内容：
${content || ''}`
  return requestAI(prompt, { workspaceType: 'chat', mode: 'chat' }).then((str) => {
    return parseTagsFromAIResult(str, count)
  })
}

function askQuestion(question, context = '') {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n基于以下内容与对话上下文回答问题，如果内容中找不到答案，请诚实说明：\n\n上下文：${context || '（无上下文）'}\n\n问题：${question || ''}`
  return requestAI(prompt, { workspaceType: 'chat', mode: 'chat', max_tokens: 512 })
}

function polishText(text, style = '正式') {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请用「${style}」的风格润色以下文本，保持原意但提升表达：\n\n${text || ''}`
  return requestAI(prompt, { workspaceType: 'chat', mode: 'chat', max_tokens: 512 })
}

function analyzeSentiment(text) {
  const prompt = `你是一个专业的情绪分析助手，请简单判断以下文本的大致情感（积极/中性/消极），并给出一句话解释：\n\n${text || ''}`
  return requestAI(prompt).then((res) => {
    return {
      label: 'neutral',
      score: 0.5,
      explanation: stripThinkingOutput(res)
    }
  })
}

/**
 * 将笔记正文上传到 AnythingLLM（当前使用与聊天相同的工作区；独立知识库工作区暂缓）。
 * 仅上传纯文本，文档标题走 metadata.title。
 */
function ingestNoteToKnowledgeBase(note) {
  if (AI_CONFIG.USE_MOCK_AI) {
    return Promise.resolve({ success: true, mock: true })
  }
  if (!wx.cloud) {
    return Promise.reject(new Error('当前基础库不支持云开发，无法上传到工作区'))
  }
  const name = AI_CONFIG.CLOUD_FUNCTION_NAME || 'anythingllmChat'
  const title = (note && note.title) || '未命名笔记'
  const content = (note && note.content) || ''
  const summary = (note && note.summary) || ''
  const tags = Array.isArray(note && note.tags) ? note.tags.join(', ') : ''
  const textContent =
    `标题：${title}\n\n` +
    `标签：${tags || '无'}\n\n` +
    (summary ? `摘要：${summary}\n\n` : '') +
    `正文：\n${content}`

  return wx.cloud
    .callFunction({
      name,
      data: {
        action: 'ingestNote',
        title,
        textContent,
        options: {
          workspaceType: 'chat'
        }
      }
    })
    .then((res) => {
      const r = res.result
      if (!r || r.success !== true) {
        const msg =
          (r && r.message) ||
          (res.errMsg && String(res.errMsg)) ||
          '上传到工作区失败'
        return Promise.reject(new Error(msg))
      }
      return r
    })
}

module.exports = {
  requestAI,
  generateTitle,
  generateSummary,
  extractTags,
  askQuestion,
  polishText,
  analyzeSentiment,
  ingestNoteToKnowledgeBase
}
