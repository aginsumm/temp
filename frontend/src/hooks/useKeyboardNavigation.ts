import { useEffect, useCallback, useRef, useState } from 'react';

interface UseKeyboardNavigationOptions {
  enabled?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onTab?: (e: KeyboardEvent) => void;
  onShiftTab?: (e: KeyboardEvent) => void;
  customShortcuts?: Array<{
    keys: string[];
    handler: () => void;
    description?: string;
  }>;
}

/**
 * 增强的键盘导航 Hook
 * 提供完整的键盘快捷键管理和焦点循环
 */
export function useKeyboardNavigation({
  enabled = true,
  onEnter,
  onEscape,
  onArrowUp,
  onArrowDown,
  onTab,
  onShiftTab,
  customShortcuts = [],
}: UseKeyboardNavigationOptions) {
  const shortcutsRef = useRef(customShortcuts);

  useEffect(() => {
    shortcutsRef.current = customShortcuts;
  }, [customShortcuts]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 处理自定义快捷键
      for (const shortcut of shortcutsRef.current) {
        const keys = shortcut.keys.map((k) => k.toLowerCase());
        const pressedKeys: string[] = [];

        if (e.ctrlKey || e.metaKey) pressedKeys.push('mod');
        if (e.shiftKey) pressedKeys.push('shift');
        if (e.altKey) pressedKeys.push('alt');
        pressedKeys.push(e.key.toLowerCase());

        const match =
          keys.length === pressedKeys.length && keys.every((key) => pressedKeys.includes(key));

        if (match) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }

      // 处理标准导航键
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnter?.();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onArrowUp?.();
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onArrowDown?.();
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          onShiftTab?.(e);
        } else {
          onTab?.(e);
        }
      }
    },
    [enabled, onEnter, onEscape, onArrowUp, onArrowDown, onTab, onShiftTab]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

interface FocusTrapOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled?: boolean;
  onEscape?: () => void;
  initialFocus?: string;
}

/**
 * 焦点陷阱 Hook
 * 将焦点限制在指定容器内，用于模态框、下拉菜单等
 */
export function useFocusTrap({
  containerRef,
  enabled = true,
  onEscape,
  initialFocus,
}: FocusTrapOptions) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // 保存当前焦点元素
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 设置初始焦点
    const container = containerRef.current;
    if (container && initialFocus) {
      const focusable = container.querySelector(initialFocus) as HTMLElement;
      focusable?.focus();
    } else if (container) {
      const focusable = container.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      focusable?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 恢复之前的焦点
      previousActiveElement.current?.focus();
    };
  }, [enabled, containerRef, onEscape, initialFocus]);
}

/**
 * 获取所有可聚焦元素
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

/**
 * 管理快捷键帮助信息
 */
export function useKeyboardShortcutsHelp(shortcuts: Array<{ keys: string; description: string }>) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowHelp((prev: boolean) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { showHelp, setShowHelp, shortcuts };
}
