/**
 * 统一的设计系统变量
 * 为 Chat 和 Knowledge 模块提供一致的视觉风格
 */

// ============================================================================
// 颜色系统
// ============================================================================

export const colors = {
  // 主色调
  primary: {
    50: '#E8F4FD',
    100: '#C5E3F8',
    200: '#9FD1F2',
    300: '#78BFEA',
    400: '#59B0E4',
    500: '#3AA1DD',
    600: '#3495D4',
    700: '#2C85C9',
    800: '#2576BF',
    900: '#175CAC',
  },

  // 成功色
  success: {
    50: '#E8F8F0',
    100: '#C5EBD8',
    200: '#9FDEC0',
    300: '#78D0A7',
    400: '#59C593',
    500: '#3ABA7F',
    600: '#34AD74',
    700: '#2C9E67',
    800: '#258F5B',
    900: '#177746',
  },

  // 警告色
  warning: {
    50: '#FEF7E8',
    100: '#FDEAC5',
    200: '#FBDC9F',
    300: '#F8CE78',
    400: '#F6C359',
    500: '#F4B83A',
    600: '#EDAA34',
    700: '#E5992C',
    800: '#DD8925',
    900: '#CF6F17',
  },

  // 错误色
  error: {
    50: '#FDE8E8',
    100: '#FAC5C5',
    200: '#F69F9F',
    300: '#F07878',
    400: '#EB5959',
    500: '#E63A3A',
    600: '#DD3434',
    700: '#D32C2C',
    800: '#C92525',
    900: '#B61717',
  },

  // 中性色
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // 功能色
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// ============================================================================
// 字体系统
// ============================================================================

export const typography = {
  // 字体家族
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  // 字体大小
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },

  // 字重
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // 行高
  lineHeight: {
    none: '1',
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

// ============================================================================
// 间距系统
// ============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
};

// ============================================================================
// 圆角系统
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',  // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
};

// ============================================================================
// 阴影系统
// ============================================================================

export const boxShadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};

// ============================================================================
// 动画系统
// ============================================================================

export const animation = {
  // 过渡时长
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },

  // 缓动函数
  easing: {
    linear: 'linear',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
  },

  // 预设动画
  presets: {
    fadeIn: 'fadeIn 0.3s ease-in-out',
    fadeOut: 'fadeOut 0.3s ease-in-out',
    slideIn: 'slideIn 0.3s ease-out',
    slideOut: 'slideOut 0.3s ease-in',
    scaleIn: 'scaleIn 0.2s ease-out',
    scaleOut: 'scaleOut 0.2s ease-in',
  },
};

// ============================================================================
// 断点（响应式）
// ============================================================================

export const breakpoints = {
  sm: '640px',   // 手机横屏
  md: '768px',   // 平板
  lg: '1024px',  // 小屏笔记本
  xl: '1280px',  // 桌面
  '2xl': '1536px', // 大屏
};

// ============================================================================
// 层级（z-index）
// ============================================================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
};

// ============================================================================
// 图谱特定样式
// ============================================================================

export const graphStyles = {
  // 节点颜色（按类型）
  nodeColors: {
    inheritor: colors.primary[500],
    technique: colors.success[500],
    work: colors.warning[500],
    pattern: '#9C27B0',
    region: colors.error[500],
    period: '#FF9800',
    material: '#795548',
  },

  // 节点大小
  nodeSize: {
    small: 20,
    medium: 30,
    large: 40,
    xlarge: 50,
  },

  // 边样式
  edge: {
    color: colors.neutral[400],
    width: 2,
    opacity: 0.6,
    curveness: 0.3,
  },

  // 高亮样式
  highlight: {
    color: colors.primary[300],
    shadowColor: colors.primary[500],
    shadowBlur: 10,
  },

  // 选中样式
  selected: {
    borderColor: colors.primary[700],
    borderWidth: 3,
    shadowColor: colors.primary[600],
    shadowBlur: 15,
  },
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取颜色值
 */
export function getColor(path: string): string {
  const keys = path.split('.');
  let value: any = colors;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`Color not found: ${path}`);
      return colors.neutral[500];
    }
  }

  return value as string;
}

/**
 * 获取间距值
 */
export function getSpacing(value: keyof typeof spacing | number): string {
  if (typeof value === 'number') {
    return spacing[value as keyof typeof spacing] || `${value}px`;
  }
  return spacing[value];
}

/**
 * 获取字体大小
 */
export function getFontSize(size: keyof typeof typography.fontSize): string {
  return typography.fontSize[size];
}

/**
 * 生成 CSS 变量定义
 */
export function generateCSSVariables(): string {
  return `
    :root {
      --color-primary: ${colors.primary[500]};
      --color-success: ${colors.success[500]};
      --color-warning: ${colors.warning[500]};
      --color-error: ${colors.error[500]};
      
      --font-size-xs: ${typography.fontSize.xs};
      --font-size-sm: ${typography.fontSize.sm};
      --font-size-base: ${typography.fontSize.base};
      --font-size-lg: ${typography.fontSize.lg};
      
      --spacing-1: ${spacing[1]};
      --spacing-2: ${spacing[2]};
      --spacing-3: ${spacing[3]};
      --spacing-4: ${spacing[4]};
      
      --border-radius: ${borderRadius.DEFAULT};
      --border-radius-lg: ${borderRadius.lg};
      
      --shadow: ${boxShadow.DEFAULT};
      --shadow-lg: ${boxShadow.lg};
      
      --transition-fast: ${animation.duration.fast};
      --transition-normal: ${animation.duration.normal};
    }
  `;
}

// 导出所有设计系统变量
export const designSystem = {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  animation,
  breakpoints,
  zIndex,
  graphStyles,
};

export default designSystem;
