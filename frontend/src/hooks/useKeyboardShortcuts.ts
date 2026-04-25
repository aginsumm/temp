import { useEffect, useCallback, useRef } from 'react';

type ShortcutPriority = 'high' | 'medium' | 'low';

interface ShortcutDefinition {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: (event: KeyboardEvent) => void;
  description: string;
  category?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  priority?: ShortcutPriority;
  enabled?: boolean;
  scope?: 'global' | 'input' | 'chat' | 'graph';
}

interface ShortcutManagerState {
  shortcuts: Map<string, ShortcutDefinition>;
  currentScope: string;
  isInputFocused: boolean;
}

class ShortcutManager {
  private state: ShortcutManagerState = {
    shortcuts: new Map(),
    currentScope: 'global',
    isInputFocused: false,
  };

  private listeners: Set<() => void> = new Set();

  register(shortcut: ShortcutDefinition): void {
    if (this.state.shortcuts.has(shortcut.id)) {
      console.warn(`Shortcut with id "${shortcut.id}" already exists, overwriting`);
    }
    this.state.shortcuts.set(shortcut.id, {
      ...shortcut,
      enabled: shortcut.enabled !== false,
      priority: shortcut.priority || 'medium',
      scope: shortcut.scope || 'global',
    });
    this.notifyListeners();
  }

  unregister(id: string): boolean {
    const deleted = this.state.shortcuts.delete(id);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  unregisterByCategory(category: string): number {
    let count = 0;
    for (const [id, shortcut] of this.state.shortcuts) {
      if (shortcut.category === category) {
        this.state.shortcuts.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.notifyListeners();
    }
    return count;
  }

  setScope(scope: string): void {
    this.state.currentScope = scope;
    this.notifyListeners();
  }

  setInputFocused(isFocused: boolean): void {
    this.state.isInputFocused = isFocused;
  }

  getShortcuts(): ShortcutDefinition[] {
    return Array.from(this.state.shortcuts.values());
  }

  getShortcutsForScope(scope: string): ShortcutDefinition[] {
    return Array.from(this.state.shortcuts.values()).filter(
      (s) => s.scope === 'global' || s.scope === scope
    );
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  clear(): void {
    this.state.shortcuts.clear();
    this.notifyListeners();
  }
}

export const shortcutManager = new ShortcutManager();

const PRIORITY_ORDER: Record<ShortcutPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const ctrlMatch = shortcut.ctrl
    ? event.ctrlKey || event.metaKey
    : !(event.ctrlKey || event.metaKey);
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

  return ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch;
}

function shouldExecuteShortcut(shortcut: ShortcutDefinition, isInputFocused: boolean): boolean {
  if (!shortcut.enabled) return false;

  if (isInputFocused && shortcut.scope === 'global') {
    return false;
  }

  return true;
}

export function useShortcut(shortcut: Omit<ShortcutDefinition, 'id'>): void {
  const idRef = useRef(`shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const shortcutId = idRef.current;
    shortcutManager.register({ ...shortcut, id: shortcutId });

    return () => {
      shortcutManager.unregister(shortcutId);
    };
  }, [shortcut]);
}

export function useShortcutManager(scope?: string) {
  useEffect(() => {
    if (scope) {
      shortcutManager.setScope(scope);
    }

    return () => {
      if (scope) {
        shortcutManager.setScope('global');
      }
    };
  }, [scope]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const shortcuts = shortcutManager.getShortcuts();
    const isInputFocused = shortcutManager['state'].isInputFocused;
    const currentScope = shortcutManager['state'].currentScope;

    const matchingShortcuts = shortcuts
      .filter((s) => matchesShortcut(event, s) && shouldExecuteShortcut(s, isInputFocused))
      .filter((s) => s.scope === 'global' || s.scope === currentScope)
      .sort((a, b) => (PRIORITY_ORDER[a.priority!] || 1) - (PRIORITY_ORDER[b.priority!] || 1));

    if (matchingShortcuts.length > 0) {
      const highestPriority = matchingShortcuts[0];
      if (highestPriority.preventDefault) {
        event.preventDefault();
      }
      if (highestPriority.stopPropagation) {
        event.stopPropagation();
      }
      highestPriority.action(event);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { manager: shortcutManager };
}

export function getShortcutLabel(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  const keyDisplay: Record<string, string> = {
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ' ': 'Space',
    Enter: '↵',
    Backspace: '⌫',
    Delete: 'Del',
    Tab: 'Tab',
  };

  parts.push(keyDisplay[shortcut.key] || shortcut.key.toUpperCase());

  return parts.join(' + ');
}

export const predefinedShortcuts = {
  newChat: {
    key: 'n',
    ctrl: true,
    description: '新建对话',
    category: '对话操作',
    scope: 'chat' as const,
  },
  exportChat: {
    key: 'e',
    ctrl: true,
    description: '导出对话',
    category: '对话操作',
    scope: 'chat' as const,
  },
  clearChat: {
    key: 'd',
    ctrl: true,
    shift: true,
    description: '清空对话',
    category: '对话操作',
    scope: 'chat' as const,
  },
  commandPalette: {
    key: 'k',
    ctrl: true,
    description: '打开命令面板',
    category: '导航',
    scope: 'global' as const,
  },
  searchMessages: {
    key: 'f',
    ctrl: true,
    description: '搜索消息',
    category: '导航',
    scope: 'chat' as const,
  },
  showHelp: {
    key: '/',
    description: '显示帮助',
    category: '界面',
    scope: 'global' as const,
  },
  toggleTheme: {
    key: 'd',
    ctrl: true,
    description: '切换主题',
    category: '界面',
    scope: 'global' as const,
  },
  toggleSidebar: {
    key: '\\',
    ctrl: true,
    description: '切换侧边栏',
    category: '界面',
    scope: 'global' as const,
  },
  openSettings: {
    key: ',',
    ctrl: true,
    description: '打开设置',
    category: '界面',
    scope: 'global' as const,
  },
};
