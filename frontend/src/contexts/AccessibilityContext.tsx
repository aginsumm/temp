import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilityContextType {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  setReducedMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    // 检测系统偏好
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    setReducedMotion(motionQuery.matches);
    setHighContrast(contrastQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const handleContrastChange = (e: MediaQueryListEvent) => setHighContrast(e.matches);

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  useEffect(() => {
    // 应用字体大小
    const root = document.documentElement;
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.setProperty('--font-size-base', fontSizes[fontSize]);
  }, [fontSize]);

  useEffect(() => {
    // 应用高对比度模式
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [highContrast]);

  const value = {
    reducedMotion,
    highContrast,
    fontSize,
    setReducedMotion,
    setHighContrast,
    setFontSize,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

/**
 * 可访问性工具类
 */
export class AccessibilityUtils {
  /**
   * 宣布消息给屏幕阅读器
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer) {
      announcer.textContent = '';
      announcer.setAttribute('aria-live', priority);
      setTimeout(() => {
        announcer.textContent = message;
      }, 100);
    }
  }

  /**
   * 创建可访问性公告器元素
   */
  static createAnnouncer() {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('a11y-announcer');
    if (existing) return;

    const announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }

  /**
   * 管理焦点
   */
  static focusFirstFocusable(container: HTMLElement) {
    const focusable = container.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }

  /**
   * 检查元素是否在视口内
   */
  static isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * 滚动元素到视口并聚焦
   */
  static scrollIntoViewAndFocus(element: HTMLElement) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
  }
}

/**
 * 可访问性公告器组件
 */
export function AccessibilityAnnouncer() {
  useEffect(() => {
    AccessibilityUtils.createAnnouncer();
  }, []);

  return (
    <div
      id="a11y-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
