const aiService = require('../../utils/aiService.js')

Page({
  data: {
    mode: 'qa', // qa | summary | polish
    contextType: 'none', // all | note | none
    inputText: '',
    resultText: '',
    loading: false,
    qaHistory: []
  },

  onLoad(options) {
    if (options && options.context === 'note') {
      this.setData({ contextType: 'note' })
    }
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, inputText: '', resultText: '' })
  },

  switchContext(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ contextType: type })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  async onSend() {
    const { mode, inputText } = this.data
    if (!inputText) return
    this.setData({ loading: true })
    try {
      if (mode === 'qa') {
        const answer = await aiService.askQuestion(inputText, '')
        const history = this.data.qaHistory.concat([
          { role: 'user', content: inputText },
          { role: 'assistant', content: answer }
        ])
        this.setData({ qaHistory: history, inputText: '' })
      } else if (mode === 'summary') {
        const summary = await aiService.generateSummary(inputText, 150)
        this.setData({ resultText: summary })
      } else if (mode === 'polish') {
        const polished = await aiService.polishText(inputText, '正式')
        this.setData({ resultText: polished })
      }
    } catch (e) {
      wx.showToast({ title: 'AI 调用失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onQuickAsk(e) {
    const text = e.currentTarget.dataset.text
    this.setData({ inputText: text })
    this.onSend()
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