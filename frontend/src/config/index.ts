/**
 * 应用配置
 * 统一管理所有配置项
 */

// API 配置
export const API_CONFIG = {
  BASE_URL: '/api/v1',
  TIMEOUT: 30000, // 30 秒
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 秒
};

// 图谱配置
export const GRAPH_CONFIG = {
  // 节点配置
  NODE: {
    MIN_SIZE: 20,
    MAX_SIZE: 60,
    DEFAULT_SIZE: 30,
    HOVER_SCALE: 1.2,
    SELECTED_SCALE: 1.3,
  },
  // 边配置
  EDGE: {
    MIN_WIDTH: 1,
    MAX_WIDTH: 5,
    DEFAULT_WIDTH: 2,
    HOVER_WIDTH: 4,
    OPACITY: 0.6,
    HOVER_OPACITY: 1.0,
  },
  // 布局配置
  LAYOUT: {
    FORCE_REPULSION: 500,
    FORCE_STRENGTH: 0.1,
    FORCE_DAMPING: 0.9,
    INITIAL_ALPHA: 1,
    ALPHA_DECAY: 0.02,
    MIN_ALPHA: 0.001,
  },
  // 缓存配置
  CACHE: {
    ENABLED: true,
    MAX_SIZE: 100,
    TTL: 5 * 60 * 1000, // 5 分钟
  },
};

// 搜索配置
export const SEARCH_CONFIG = {
  DEBOUNCE_DELAY: 300, // 300ms
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 50,
  HIGHLIGHT_COLOR: '#1890ff',
};

// 实体类型颜色配置
export const ENTITY_COLORS: Record<string, string> = {
  technique: '#1890ff', // 技艺 - 蓝色
  work: '#52c41a', // 作品 - 绿色
  person: '#faad14', // 人物 - 橙色
  region: '#722ed1', // 地区 - 紫色
  material: '#13c2c2', // 材料 - 青色
  pattern: '#eb2f96', // 纹样 - 粉色
  period: '#fadb14', // 时期 - 黄色
  default: '#8c8c8c', // 默认 - 灰色
};

// 关系类型配置
export const RELATION_TYPES = {
  inherits: { label: '传承', color: '#1890ff' },
  origin: { label: '发源地', color: '#52c41a' },
  creates: { label: '用于制作', color: '#faad14' },
  flourished_in: { label: '兴盛于', color: '#722ed1' },
  located_in: { label: '位于', color: '#13c2c2' },
  uses_material: { label: '使用材料', color: '#eb2f96' },
  has_pattern: { label: '包含纹样', color: '#fadb14' },
  related_to: { label: '相关', color: '#8c8c8c' },
};

// 会话配置
export const SESSION_CONFIG = {
  MAX_MESSAGES: 100, // 单个会话最大消息数
  MAX_TITLE_LENGTH: 50, // 会话标题最大长度
  AUTO_SAVE_INTERVAL: 30000, // 30 秒自动保存
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 分钟无操作超时
};

// 消息配置
export const MESSAGE_CONFIG = {
  MAX_CONTENT_LENGTH: 10000,
  STREAM_CHUNK_DELAY: 50, // 流式响应块延迟（ms）
  TYPING_INDICATOR_DELAY: 500, // 打字指示器延迟（ms）
};

// 快照配置
export const SNAPSHOT_CONFIG = {
  ENABLED: true,
  AUTO_SAVE: true,
  MAX_SNAPSHOTS: 10, // 每个会话最大快照数
  STORAGE_KEY_PREFIX: 'graph_snapshot_',
};

// LLM 配置
export const LLM_CONFIG = {
  MODEL: 'qwen-turbo',
  MAX_TOKENS: 2000,
  TEMPERATURE: 0.7,
  TOP_P: 0.9,
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  FALLBACK_ENABLED: true,
};

// 错误处理配置
export const ERROR_CONFIG = {
  SHOW_TOAST: true,
  LOG_ERRORS: true,
  RETRYABLE_ERRORS: ['NETWORK_ERROR', 'TIMEOUT', '500', '502', '503'],
  TOAST_DURATION: 3000, // 3 秒
};

// 性能配置
export const PERFORMANCE_CONFIG = {
  ENABLE_PROFILING: false,
  RENDER_THROTTLE: 16, // 60fps
  VIRTUAL_SCROLL_THRESHOLD: 100, // 超过 100 个元素启用虚拟滚动
  LAZY_LOAD_THRESHOLD: 50, // 超过 50 个元素启用懒加载
};

// 本地存储配置
export const STORAGE_CONFIG = {
  PREFIX: 'kg_app_',
  VERSION: '1.0.0',
  KEYS: {
    THEME: 'theme',
    LANGUAGE: 'language',
    PREFERENCES: 'preferences',
    CACHE: 'cache',
  },
};

// 导出所有配置
export const config = {
  api: API_CONFIG,
  graph: GRAPH_CONFIG,
  search: SEARCH_CONFIG,
  entityColors: ENTITY_COLORS,
  relationTypes: RELATION_TYPES,
  session: SESSION_CONFIG,
  message: MESSAGE_CONFIG,
  snapshot: SNAPSHOT_CONFIG,
  llm: LLM_CONFIG,
  error: ERROR_CONFIG,
  performance: PERFORMANCE_CONFIG,
  storage: STORAGE_CONFIG,
};

// 类型导出
export type Config = typeof config;
