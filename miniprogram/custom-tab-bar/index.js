Component({
  data: {
    selected: 0,
    expandMenu: false,
    color: '#8a8a8a',
    selectedColor: '#6c5ce7',
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页'
      },
      {
        pagePath: '/pages/create/create',
        text: '+'
      },
      {
        pagePath: '/pages/notebook/notebook',
        text: '我的'
      }
    ]
  },
  methods: {
    onPanelTap() {},

    onTapTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      if (index === 1) {
        this.setData({ expandMenu: !this.data.expandMenu })
        return
      }
      const item = this.data.list[index]
      this.setData({
        selected: index,
        expandMenu: false
      })
      wx.switchTab({
        url: item.pagePath
      })
    },

    onMaskTap() {
      this.setData({ expandMenu: false })
    },

    onTapNewNote() {
      this.setData({ expandMenu: false })
      wx.navigateTo({
        url: '/pages/editor/editor'
      })
    },

    onTapAI() {
      this.setData({ expandMenu: false })
      wx.navigateTo({
        url: '/pages/ai/ai'
      })
    },
  }
})

