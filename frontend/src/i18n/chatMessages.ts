/**
 * 智能问答模块国际化文本
 */

export const chatMessages = {
  'zh-CN': {
    // 欢迎屏幕
    'chat.welcome.greeting.morning': '早上好',
    'chat.welcome.greeting.afternoon': '下午好',
    'chat.welcome.greeting.evening': '晚上好',
    'chat.welcome.greeting.late': '夜深了',
    'chat.welcome.title': '开始新的对话',
    'chat.welcome.subtitle': '探索非遗文化知识',

    // 分类推荐问题
    'chat.welcome.category.skill': '技艺探索',
    'chat.welcome.category.history': '历史文化',
    'chat.welcome.category.inheritor': '传承人物',

    // 特性卡片
    'chat.welcome.feature.intelligent': '智能问答',
    'chat.welcome.feature.intelligent.desc': '精准理解',
    'chat.welcome.feature.knowledge': '知识图谱',
    'chat.welcome.feature.knowledge.desc': '丰富知识库',
    'chat.welcome.feature.recommendation': '个性推荐',
    'chat.welcome.feature.recommendation.desc': '定制内容',
    'chat.welcome.feature.multimodal': '多模态',
    'chat.welcome.feature.multimodal.desc': '图文音视',

    // 统计信息
    'chat.welcome.stats.projects': '非遗项目',
    'chat.welcome.stats.inheritors': '传承人',
    'chat.welcome.stats.techniques': '技艺类型',

    // 提示语
    'chat.welcome.tip.question': '试试问我关于任何非遗技艺的问题',
    'chat.welcome.tip.story': '我可以帮你了解非遗传承人的故事',
    'chat.welcome.tip.explore': '探索不同地区的非遗文化特色',
    'chat.welcome.tip.protection': '了解非遗保护与传承的现状',

    // 工具栏
    'chat.toolbar.pin': '置顶对话',
    'chat.toolbar.unpin': '取消置顶',
    'chat.toolbar.export': '导出对话',
    'chat.toolbar.share': '分享对话',
    'chat.toolbar.settings': '对话设置',
    'chat.toolbar.export.format': '导出格式',
    'chat.toolbar.export.json': 'JSON 格式',
    'chat.toolbar.export.json.desc': '结构化数据，便于导入',
    'chat.toolbar.export.txt': '纯文本',
    'chat.toolbar.export.txt.desc': '简单文本格式',
    'chat.toolbar.export.md': 'Markdown',
    'chat.toolbar.export.md.desc': '保留格式的文档',
    'chat.toolbar.messages.count': '{count} 条消息',

    // 消息操作
    'chat.message.actions.feedback': '反馈',
    'chat.message.actions.helpful': '有帮助',
    'chat.message.actions.notHelpful': '需改进',
    'chat.message.actions.favorite': '收藏',
    'chat.message.actions.copy': '复制',
    'chat.message.actions.regenerate': '重新生成',
    'chat.message.actions.edit': '编辑',
    'chat.message.actions.delete': '删除',
    'chat.message.actions.speak': '朗读',
    'chat.message.actions.stopSpeaking': '停止朗读',
    'chat.message.actions.quote': '引用',

    // 消息状态
    'chat.message.thinking': 'AI 正在思考...',
    'chat.message.typing': '正在输入...',
    'chat.message.streaming': '生成中...',
    'chat.message.edited': '已编辑',
    'chat.message.version': '版本 {current}/{total}',

    // 来源展示
    'chat.message.sources.title': '参考来源',
    'chat.message.sources.view': '查看原文',
    'chat.message.sources.show': '显示来源',
    'chat.message.sources.hide': '隐藏来源',

    // 实体展示
    'chat.message.entities.title': '相关实体',
    'chat.message.relations.title': '关系网络',
    'chat.message.keywords.title': '关键词',

    // 代码块
    'chat.code.copy': '复制',
    'chat.code.copied': '已复制',
    'chat.code.expand': '展开全部',
    'chat.code.collapse': '收起代码',

    // 输入区域
    'chat.input.placeholder': '输入您的问题，探索非遗文化...',
    'chat.input.send': '发送',
    'chat.input.stop': '停止生成',
    'chat.input.voice': '语音输入',
    'chat.input.file': '上传文件',
    'chat.input.history': '输入历史',
    'chat.input.history.hint': '↑↓ 导航历史记录',
    'chat.input.chars.remaining': '剩余 {count} 字符',
    'chat.input.chars.exceeded': '超出 {count} 字符',
    'chat.input.file.limit': '最多上传 {limit} 个文件',
    'chat.input.file.size': '文件大小不能超过 {size}MB',

    // 加载状态
    'chat.loading.dots': '思考中',
    'chat.loading.spinner': '处理中',
    'chat.loading.wave': '生成中',
    'chat.loading.skeleton': '加载中',

    // 错误状态
    'chat.error.network.title': '网络连接失败',
    'chat.error.network.message': '请检查您的网络连接后重试',
    'chat.error.server.title': '服务器错误',
    'chat.error.server.message': '服务器暂时无法响应，请稍后再试',
    'chat.error.timeout.title': '请求超时',
    'chat.error.timeout.message': '请求处理时间过长，请重试',
    'chat.error.generic.title': '发生错误',
    'chat.error.generic.message': '操作失败，请重试',
    'chat.error.retry': '重试',
    'chat.error.dismiss': '关闭',

    // 成功状态
    'chat.success.copied': '已复制到剪贴板',
    'chat.success.favorited': '已加入收藏',
    'chat.success.unfavorited': '已取消收藏',
    'chat.success.feedback': '感谢您的反馈',
    'chat.success.export': '导出成功',
    'chat.success.deleted': '已删除',

    // 确认对话框
    'chat.confirm.delete.title': '删除对话',
    'chat.confirm.delete.message': '确定要删除这个对话吗？此操作无法撤销。',
    'chat.confirm.delete.confirm': '删除',
    'chat.confirm.delete.cancel': '取消',

    'chat.confirm.deleteMessage.title': '删除消息',
    'chat.confirm.deleteMessage.message': '确定要删除这条消息吗？此操作无法撤销。',
    'chat.confirm.deleteMessage.confirm': '删除',
    'chat.confirm.deleteMessage.cancel': '取消',

    'chat.confirm.clear.title': '清空历史',
    'chat.confirm.clear.message': '确定要清空所有聊天记录吗？',

    // 侧边栏
    'chat.sidebar.new': '新对话',
    'chat.sidebar.search': '搜索对话',
    'chat.sidebar.today': '今天',
    'chat.sidebar.yesterday': '昨天',
    'chat.sidebar.week': '本周',
    'chat.sidebar.month': '本月',
    'chat.sidebar.older': '更早',
    'chat.sidebar.pinned': '置顶',
    'chat.sidebar.archive': '已归档',

    // 右侧面板
    'chat.panel.keywords': '关键词',
    'chat.panel.graph': '知识图谱',
    'chat.panel.history': '历史快照',
    'chat.panel.search.placeholder': '搜索关键词...',
    'chat.panel.history.empty': '暂无历史快照',
    'chat.panel.history.load': '加载快照',
    'chat.panel.history.view': '在知识图谱页查看',
    'chat.panel.history.confirm': '加载此快照将替换当前图谱，是否继续？',

    // 命令面板
    'chat.command.palette.placeholder': '输入命令或搜索...',
    'chat.command.palette.actions': '快捷操作',
    'chat.command.palette.navigation': '导航',
    'chat.command.palette.settings': '设置',

    // 消息搜索
    'chat.search.placeholder': '搜索消息...',
    'chat.search.results': '找到 {count} 条消息',
    'chat.search.noResults': '没有找到相关消息',
    'chat.search.filters.date': '日期',
    'chat.search.filters.type': '类型',
    'chat.search.filters.user': '用户',
    'chat.search.filters.ai': 'AI',

    // 会话设置
    'chat.settings.title': '对话设置',
    'chat.settings.rename': '重命名',
    'chat.settings.tags': '标签',
    'chat.settings.tags.add': '添加标签',
    'chat.settings.archive': '归档',
    'chat.settings.clear': '清空消息',
    'chat.settings.export': '导出',
    'chat.settings.delete': '删除对话',

    // 快捷键帮助
    'chat.shortcuts.title': '快捷键',
    'chat.shortcuts.send': '发送消息',
    'chat.shortcuts.newline': '换行',
    'chat.shortcuts.command': '命令面板',
    'chat.shortcuts.search': '搜索消息',
    'chat.shortcuts.shortcuts': '查看快捷键',
    'chat.shortcuts.theme': '切换主题',
    'chat.shortcuts.sidebar': '切换侧边栏',
    'chat.shortcuts.close': '关闭面板',
    'chat.shortcuts.history.up': '上一条历史',
    'chat.shortcuts.history.down': '下一条历史',
  },

  'en-US': {
    // Welcome Screen
    'chat.welcome.greeting.morning': 'Good Morning',
    'chat.welcome.greeting.afternoon': 'Good Afternoon',
    'chat.welcome.greeting.evening': 'Good Evening',
    'chat.welcome.greeting.late': 'Good Night',
    'chat.welcome.title': 'Start New Conversation',
    'chat.welcome.subtitle': 'Explore Intangible Cultural Heritage',

    // Categories
    'chat.welcome.category.skill': 'Skills & Techniques',
    'chat.welcome.category.history': 'History & Culture',
    'chat.welcome.category.inheritor': 'Inheritors',

    // Features
    'chat.welcome.feature.intelligent': 'Intelligent Q&A',
    'chat.welcome.feature.intelligent.desc': 'Precise Understanding',
    'chat.welcome.feature.knowledge': 'Knowledge Graph',
    'chat.welcome.feature.knowledge.desc': 'Rich Knowledge Base',
    'chat.welcome.feature.recommendation': 'Recommendations',
    'chat.welcome.feature.recommendation.desc': 'Personalized Content',
    'chat.welcome.feature.multimodal': 'Multimodal',
    'chat.welcome.feature.multimodal.desc': 'Text, Image, Audio, Video',

    // Stats
    'chat.welcome.stats.projects': 'Heritage Projects',
    'chat.welcome.stats.inheritors': 'Inheritors',
    'chat.welcome.stats.techniques': 'Technique Types',

    // Toolbar
    'chat.toolbar.pin': 'Pin Conversation',
    'chat.toolbar.unpin': 'Unpin',
    'chat.toolbar.export': 'Export',
    'chat.toolbar.share': 'Share',
    'chat.toolbar.settings': 'Settings',
    'chat.toolbar.messages.count': '{count} messages',

    // Message Actions
    'chat.message.actions.feedback': 'Feedback',
    'chat.message.actions.helpful': 'Helpful',
    'chat.message.actions.notHelpful': 'Not Helpful',
    'chat.message.actions.favorite': 'Favorite',
    'chat.message.actions.copy': 'Copy',
    'chat.message.actions.regenerate': 'Regenerate',
    'chat.message.actions.edit': 'Edit',
    'chat.message.actions.delete': 'Delete',
    'chat.message.actions.speak': 'Speak',
    'chat.message.actions.stopSpeaking': 'Stop',

    // Loading
    'chat.loading.dots': 'Thinking',
    'chat.loading.spinner': 'Processing',

    // Errors
    'chat.error.network.title': 'Network Error',
    'chat.error.network.message': 'Please check your connection and retry',
    'chat.error.retry': 'Retry',

    // Success
    'chat.success.copied': 'Copied to clipboard',
    'chat.success.feedback': 'Thank you for your feedback',

    // Confirmation Dialogs
    'chat.confirm.delete.title': 'Delete Conversation',
    'chat.confirm.delete.message':
      'Are you sure you want to delete this conversation? This action cannot be undone.',
    'chat.confirm.delete.confirm': 'Delete',
    'chat.confirm.delete.cancel': 'Cancel',

    'chat.confirm.deleteMessage.title': 'Delete Message',
    'chat.confirm.deleteMessage.message':
      'Are you sure you want to delete this message? This action cannot be undone.',
    'chat.confirm.deleteMessage.confirm': 'Delete',
    'chat.confirm.deleteMessage.cancel': 'Cancel',

    'chat.confirm.clear.title': 'Clear History',
    'chat.confirm.clear.message': 'Are you sure you want to clear all chat history?',
  },
};

export type ChatMessageKey = keyof (typeof chatMessages)['zh-CN'];
