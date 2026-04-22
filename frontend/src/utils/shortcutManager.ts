/**
 * 全局快捷键管理器
 * 为 Chat 和 Knowledge 模块提供统一的快捷键管理
 */

type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

interface Shortcut {
  key: string;
  modifiers?: ModifierKey[];
  description: string;
  callback: (event: KeyboardEvent) => void;
  context?: 'global' | 'chat' | 'knowledge' | 'input';
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private activeContext: 'global' | 'chat' | 'knowledge' | 'input' = 'global';
  private enabled = true;

  /**
   * 注册快捷键
   */
  register(
    id: string,
    key: string,
    modifiers: ModifierKey[] = [],
    callback: (event: KeyboardEvent) => void,
    description: string = '',
    context: 'global' | 'chat' | 'knowledge' | 'input' = 'global'
  ): void {
    const shortcutKey = this.generateShortcutKey(key, modifiers);

    this.shortcuts.set(shortcutKey, {
      key: key.toLowerCase(),
      modifiers: modifiers.map((m) => m.toLowerCase()) as ModifierKey[],
      description,
      callback,
      context,
    });
  }

  /**
   * 注销快捷键
   */
  unregister(id: string): void {
    // 简化实现：实际应该根据 id 存储和删除
    // 这里为了简化，使用 shortcutKey 作为 id
    this.shortcuts.delete(id);
  }

  /**
   * 启用快捷键管理器
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用快捷键管理器
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 设置当前上下文
   */
  setContext(context: 'global' | 'chat' | 'knowledge' | 'input'): void {
    this.activeContext = context;
  }

  /**
   * 获取当前上下文
   */
  getContext(): string {
    return this.activeContext;
  }

  /**
   * 获取所有注册的快捷键
   */
  getShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 获取当前上下文可用的快捷键
   */
  getShortcutsForContext(): Shortcut[] {
    const shortcuts = this.getShortcuts();
    return shortcuts.filter((s) => s.context === 'global' || s.context === this.activeContext);
  }

  /**
   * 生成快捷键显示文本
   */
  static formatShortcut(key: string, modifiers?: ModifierKey[]): string {
    const modifierSymbols: Record<ModifierKey, string> = {
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
      meta: '⌘',
    };

    const parts: string[] = [];

    if (modifiers) {
      parts.push(...modifiers.map((m) => modifierSymbols[m]));
    }

    parts.push(key.toUpperCase());

    return parts.join(' + ');
  }

  /**
   * 检查快捷键是否匹配
   */
  private matches(event: KeyboardEvent, shortcut: Shortcut): boolean {
    // 检查修饰键
    const hasModifiers =
      (!shortcut.modifiers?.includes('ctrl') || event.ctrlKey) &&
      (!shortcut.modifiers?.includes('alt') || event.altKey) &&
      (!shortcut.modifiers?.includes('shift') || event.shiftKey) &&
      (!shortcut.modifiers?.includes('meta') || event.metaKey);

    if (!hasModifiers) {
      return false;
    }

    // 检查是否有额外的修饰键
    const expectedModifierCount = shortcut.modifiers?.length || 0;
    const actualModifierCount = [event.ctrlKey, event.altKey, event.shiftKey, event.metaKey].filter(
      Boolean
    ).length;

    if (expectedModifierCount !== actualModifierCount) {
      return false;
    }

    // 检查按键
    return event.key.toLowerCase() === shortcut.key;
  }

  /**
   * 生成快捷键的唯一标识
   */
  private generateShortcutKey(key: string, modifiers: ModifierKey[]): string {
    const sortedModifiers = [...modifiers].sort().join('+');
    return `${sortedModifiers ? `${sortedModifiers}+` : ''}${key.toLowerCase()}`;
  }

  /**
   * 初始化键盘事件监听
   */
  init(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 销毁
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.shortcuts.clear();
  }

  /**
   * 处理键盘按下事件
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) {
      return;
    }

    // 在输入框中时，只处理全局快捷键和输入上下文快捷键
    const isInputElement =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement).isContentEditable;

    if (isInputElement && this.activeContext !== 'input') {
      // 在输入元素中，只允许全局快捷键
      const shortcutsToCheck = this.getShortcuts().filter((s) => s.context === 'global');

      for (const shortcut of shortcutsToCheck) {
        if (this.matches(event, shortcut)) {
          shortcut.callback(event);
          return;
        }
      }
      return;
    }

    // 查找匹配的快捷键
    const shortcuts = this.getShortcutsForContext();

    for (const shortcut of shortcuts) {
      if (this.matches(event, shortcut)) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        if (shortcut.stopPropagation !== false) {
          event.stopPropagation();
        }

        shortcut.callback(event);
        return;
      }
    }
  };
}

// ============================================================================
// 预定义快捷键
// ============================================================================

/**
 * 注册默认快捷键
 */
export function registerDefaultShortcuts(shortcutManager: ShortcutManager): void {
  // 全局快捷键
  shortcutManager.register(
    'global-search',
    'k',
    ['ctrl'],
    () => {
      console.log('打开全局搜索');
      // 实际实现：打开搜索框
    },
    '全局搜索',
    'global'
  );

  shortcutManager.register(
    'toggle-help',
    '?',
    ['shift'],
    () => {
      console.log('显示快捷键帮助');
      // 实际实现：显示快捷键列表
    },
    '显示快捷键帮助',
    'global'
  );

  // Chat 模块快捷键
  shortcutManager.register(
    'chat-new-session',
    'n',
    ['ctrl'],
    () => {
      console.log('新建会话');
      // 实际实现：新建会话
    },
    '新建会话',
    'chat'
  );

  shortcutManager.register(
    'chat-send-message',
    'Enter',
    [],
    () => {
      console.log('发送消息');
      // 实际实现：发送消息
    },
    '发送消息',
    'chat'
  );

  shortcutManager.register(
    'chat-toggle-panel',
    'p',
    ['ctrl'],
    () => {
      console.log('切换右侧面板');
      // 实际实现：切换面板
    },
    '切换右侧面板',
    'chat'
  );

  // Knowledge 模块快捷键
  shortcutManager.register(
    'knowledge-search',
    'f',
    ['ctrl'],
    () => {
      console.log('知识库搜索');
      // 实际实现：打开搜索
    },
    '知识库搜索',
    'knowledge'
  );

  shortcutManager.register(
    'knowledge-refresh',
    'r',
    ['ctrl'],
    () => {
      console.log('刷新知识图谱');
      // 实际实现：刷新图谱
    },
    '刷新知识图谱',
    'knowledge'
  );

  shortcutManager.register(
    'knowledge-export',
    'e',
    ['ctrl', 'shift'],
    () => {
      console.log('导出知识图谱');
      // 实际实现：导出图谱
    },
    '导出知识图谱',
    'knowledge'
  );

  // 输入框快捷键
  shortcutManager.register(
    'input-submit',
    'Enter',
    ['ctrl'],
    () => {
      console.log('提交输入');
      // 实际实现：提交表单
    },
    '提交输入',
    'input'
  );

  shortcutManager.register(
    'input-cancel',
    'Escape',
    [],
    () => {
      console.log('取消输入');
      // 实际实现：取消编辑
    },
    '取消输入',
    'input'
  );
}

// 导出单例
export const shortcutManager = new ShortcutManager();

export default shortcutManager;
