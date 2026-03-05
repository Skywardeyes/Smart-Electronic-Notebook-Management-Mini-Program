const DEFAULT_DELAY_MIN = 800
const DEFAULT_DELAY_MAX = 1500

function randomDelay() {
  const range = DEFAULT_DELAY_MAX - DEFAULT_DELAY_MIN
  return DEFAULT_DELAY_MIN + Math.floor(Math.random() * range)
}

function requestAI(prompt, options = {}) {
  console.log('[AI][request]', prompt, options)
  const shouldFail = Math.random() < 0.1

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('模拟 AI 调用失败，请稍后重试'))
        return
      }

      let result = '这是一个模拟的AI回答'
      if (prompt.includes('标题')) {
        result = '智能笔记示例'
      } else if (prompt.includes('摘要')) {
        result = '这是一段模拟的AI生成摘要，用于开发阶段展示效果。'
      } else if (prompt.includes('标签')) {
        result = 'AI,笔记,智能管理'
      }
      resolve(result)
    }, randomDelay())
  })
}

function generateTitle(content) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请根据以下内容生成一个简洁准确的标题（不超过20字）：\n\n${content || ''}`
  return requestAI(prompt)
}

function generateSummary(content, length = 150) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请为以下内容生成一个大约 ${length} 字的摘要，突出重点，语言简洁：\n\n${content || ''}`
  return requestAI(prompt)
}

function extractTags(content, count = 5) {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请从以下内容中提取 ${count} 个关键词作为标签，用逗号分隔：\n\n${content || ''}`
  return requestAI(prompt).then(str => {
    return String(str)
      .split(/[，,]/)
      .map(s => s.trim())
      .filter(Boolean)
  })
}

function askQuestion(question, context = '') {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n基于以下内容回答问题，如果内容中找不到答案，请诚实说明：\n\n上下文：${context || '（无上下文）'}\n\n问题：${question || ''}`
  return requestAI(prompt)
}

function polishText(text, style = '正式') {
  const prompt = `你是一个专业的笔记整理助手，擅长处理文本分析和知识管理任务。\n\n请用「${style}」的风格润色以下文本，保持原意但提升表达：\n\n${text || ''}`
  return requestAI(prompt)
}

function analyzeSentiment(text) {
  const prompt = `你是一个专业的情绪分析助手，请简单判断以下文本的大致情感（积极/中性/消极），并给出一句话解释：\n\n${text || ''}`
  return requestAI(prompt).then(res => {
    return {
      label: 'neutral',
      score: 0.5,
      explanation: res
    }
  })
}

module.exports = {
  requestAI,
  generateTitle,
  generateSummary,
  extractTags,
  askQuestion,
  polishText,
  analyzeSentiment
}

