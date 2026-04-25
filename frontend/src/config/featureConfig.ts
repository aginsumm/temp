/**
 * 功能模块配置文件
 * 
 * 本文件定义了项目所有功能模块的运行模式：
 * - backend-required: 必须依赖后端服务（如大模型集成）
 * - local-first: 优先本地实现，后端可选
 * - local-only: 仅本地实现
 * 
 * @author 非遗数字生命互动引擎项目组
 * @version 1.0.0
 */

export type FeatureMode = 'backend-required' | 'local-first' | 'local-only';

export interface FeatureConfig {
  mode: FeatureMode;
  description: string;
  backendEndpoint?: string;
  localImplementation: string;
  fallbackStrategy?: 'queue' | 'cache' | 'mock' | 'none';
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[];
}

export interface FeatureRegistry {
  [key: string]: FeatureConfig;
}

export const FEATURE_CONFIG: FeatureRegistry = {
  // ==================== 认证模块 ====================
  auth: {
    mode: 'local-first',
    description: '用户认证与授权',
    backendEndpoint: '/api/v1/auth',
    localImplementation: 'localAuthService',
    fallbackStrategy: 'cache',
    priority: 'critical',
  },
  guestAuth: {
    mode: 'local-only',
    description: '访客模式认证',
    localImplementation: 'localAuthService.loginAsGuest',
    priority: 'critical',
  },

  // ==================== 聊天模块 ====================
  chatSession: {
    mode: 'local-first',
    description: '会话管理（创建、删除、切换会话）',
    backendEndpoint: '/api/v1/session',
    localImplementation: 'chatRepository',
    fallbackStrategy: 'queue',
    priority: 'high',
  },
  chatMessage: {
    mode: 'local-first',
    description: '消息管理（发送、编辑、删除消息）',
    backendEndpoint: '/api/v1/chat/message',
    localImplementation: 'chatRepository',
    fallbackStrategy: 'queue',
    priority: 'high',
  },
  chatHistory: {
    mode: 'local-first',
    description: '聊天历史记录',
    backendEndpoint: '/api/v1/chat/history',
    localImplementation: 'chatRepository',
    fallbackStrategy: 'cache',
    priority: 'high',
  },

  // ==================== 大模型服务（必须后端）====================
  llmChat: {
    mode: 'backend-required',
    description: '大模型对话生成（需要AI服务）',
    backendEndpoint: '/api/v1/llm/chat',
    localImplementation: 'mockChatService',
    fallbackStrategy: 'mock',
    priority: 'critical',
    dependencies: ['ai-service'],
  },
  llmIntent: {
    mode: 'backend-required',
    description: '意图识别（需要AI服务）',
    backendEndpoint: '/api/v1/llm/intent',
    localImplementation: 'mockIntentRecognition',
    fallbackStrategy: 'mock',
    priority: 'medium',
    dependencies: ['ai-service'],
  },
  llmEntityExtraction: {
    mode: 'backend-required',
    description: '实体提取（需要AI服务）',
    backendEndpoint: '/api/v1/llm/entities',
    localImplementation: 'mockEntityExtraction',
    fallbackStrategy: 'mock',
    priority: 'medium',
    dependencies: ['ai-service'],
  },
  llmKeywordExtraction: {
    mode: 'backend-required',
    description: '关键词提取（需要AI服务）',
    backendEndpoint: '/api/v1/llm/keywords',
    localImplementation: 'mockKeywordExtraction',
    fallbackStrategy: 'mock',
    priority: 'medium',
    dependencies: ['ai-service'],
  },
  llmQuestionRecommend: {
    mode: 'backend-required',
    description: '问题推荐（需要AI服务）',
    backendEndpoint: '/api/v1/llm/questions',
    localImplementation: 'mockQuestionRecommendation',
    fallbackStrategy: 'mock',
    priority: 'low',
    dependencies: ['ai-service'],
  },
  llmAnswerEvaluation: {
    mode: 'backend-required',
    description: '答案评估（需要AI服务）',
    backendEndpoint: '/api/v1/llm/evaluate',
    localImplementation: 'mockAnswerEvaluation',
    fallbackStrategy: 'mock',
    priority: 'low',
    dependencies: ['ai-service'],
  },

  // ==================== 知识图谱模块 ====================
  knowledgeEntity: {
    mode: 'local-first',
    description: '知识实体管理',
    backendEndpoint: '/api/v1/knowledge/entity',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'high',
  },
  knowledgeRelationship: {
    mode: 'local-first',
    description: '知识关系管理',
    backendEndpoint: '/api/v1/knowledge/relationship',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'high',
  },
  knowledgeGraph: {
    mode: 'local-first',
    description: '知识图谱可视化数据',
    backendEndpoint: '/api/v1/knowledge/graph',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'high',
  },
  knowledgeSearch: {
    mode: 'local-first',
    description: '知识搜索',
    backendEndpoint: '/api/v1/knowledge/search',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'high',
  },
  knowledgePath: {
    mode: 'local-first',
    description: '知识路径探索',
    backendEndpoint: '/api/v1/knowledge/path',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'medium',
  },
  knowledgeStats: {
    mode: 'local-first',
    description: '知识统计分析',
    backendEndpoint: '/api/v1/knowledge/stats',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'cache',
    priority: 'medium',
  },

  // ==================== 收藏与反馈模块 ====================
  favorites: {
    mode: 'local-first',
    description: '收藏管理',
    backendEndpoint: '/api/v1/favorites',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'queue',
    priority: 'medium',
  },
  feedback: {
    mode: 'local-first',
    description: '反馈管理',
    backendEndpoint: '/api/v1/feedback',
    localImplementation: 'knowledgeRepository',
    fallbackStrategy: 'queue',
    priority: 'medium',
  },

  // ==================== 用户设置模块 ====================
  userSettings: {
    mode: 'local-only',
    description: '用户偏好设置',
    localImplementation: 'localStorage',
    priority: 'low',
  },
  themeSettings: {
    mode: 'local-only',
    description: '主题设置',
    localImplementation: 'themeStore',
    priority: 'low',
  },
  languageSettings: {
    mode: 'local-only',
    description: '语言设置',
    localImplementation: 'i18nStore',
    priority: 'low',
  },

  // ==================== 数据同步模块 ====================
  dataSync: {
    mode: 'local-first',
    description: '数据同步服务',
    backendEndpoint: '/api/v1/sync',
    localImplementation: 'syncManager',
    fallbackStrategy: 'queue',
    priority: 'high',
  },
  offlineQueue: {
    mode: 'local-only',
    description: '离线操作队列',
    localImplementation: 'syncManager',
    priority: 'high',
  },
};

/**
 * 获取功能模块配置
 */
export function getFeatureConfig(featureName: string): FeatureConfig | undefined {
  return FEATURE_CONFIG[featureName];
}

/**
 * 检查功能是否需要后端
 */
export function requiresBackend(featureName: string): boolean {
  const config = FEATURE_CONFIG[featureName];
  return config?.mode === 'backend-required';
}

/**
 * 检查功能是否支持本地实现
 */
export function supportsLocal(featureName: string): boolean {
  const config = FEATURE_CONFIG[featureName];
  return config?.mode !== 'backend-required' || config.fallbackStrategy === 'mock';
}

/**
 * 获取所有需要后端的功能
 */
export function getBackendRequiredFeatures(): string[] {
  return Object.entries(FEATURE_CONFIG)
    .filter(([, config]) => config.mode === 'backend-required')
    .map(([name]) => name);
}

/**
 * 获取所有支持本地的功能
 */
export function getLocalSupportedFeatures(): string[] {
  return Object.entries(FEATURE_CONFIG)
    .filter(([, config]) => config.mode !== 'backend-required')
    .map(([name]) => name);
}

/**
 * 功能模块分组
 */
export const FEATURE_GROUPS = {
  authentication: ['auth', 'guestAuth'],
  chat: ['chatSession', 'chatMessage', 'chatHistory'],
  llm: [
    'llmChat',
    'llmIntent',
    'llmEntityExtraction',
    'llmKeywordExtraction',
    'llmQuestionRecommend',
    'llmAnswerEvaluation',
  ],
  knowledge: [
    'knowledgeEntity',
    'knowledgeRelationship',
    'knowledgeGraph',
    'knowledgeSearch',
    'knowledgePath',
    'knowledgeStats',
  ],
  user: ['favorites', 'feedback', 'userSettings', 'themeSettings', 'languageSettings'],
  sync: ['dataSync', 'offlineQueue'],
} as const;

export type FeatureGroup = keyof typeof FEATURE_GROUPS;
