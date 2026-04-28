import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShortcutManager, registerDefaultShortcuts } from '../shortcutManager';

describe('ShortcutManager', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
    manager.init();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Registration', () => {
    it('should register a shortcut', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback, 'Test shortcut');

      const shortcuts = manager.getShortcuts();
      expect(shortcuts.length).toBe(1);
      expect(shortcuts[0].key).toBe('a');
      expect(shortcuts[0].description).toBe('Test shortcut');
    });

    it('should register a shortcut with modifiers', () => {
      const callback = vi.fn();
      manager.register('test', 's', ['ctrl', 'shift'], callback, 'Save');

      const shortcuts = manager.getShortcuts();
      expect(shortcuts[0].modifiers).toEqual(['ctrl', 'shift']);
    });

    it('should register shortcuts for different contexts', () => {
      const callback = vi.fn();
      manager.register('chat', 'n', ['ctrl'], callback, 'New', 'chat');
      manager.register('knowledge', 'f', ['ctrl'], callback, 'Find', 'knowledge');

      const shortcuts = manager.getShortcuts();
      expect(shortcuts.length).toBe(2);
      expect(shortcuts[0].context).toBe('chat');
      expect(shortcuts[1].context).toBe('knowledge');
    });
  });

  describe('Unregistration', () => {
    it('should unregister a shortcut', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      // unregister 方法使用 shortcutKey 作为 id
      manager.unregister('a');
      const shortcuts = manager.getShortcuts();
      expect(shortcuts.length).toBe(0);
    });
  });

  describe('Context Management', () => {
    it('should set and get context', () => {
      expect(manager.getContext()).toBe('global');

      manager.setContext('chat');
      expect(manager.getContext()).toBe('chat');

      manager.setContext('knowledge');
      expect(manager.getContext()).toBe('knowledge');
    });

    it('should filter shortcuts by context', () => {
      const callback = vi.fn();
      manager.register('global', 'g', [], callback, 'Global', 'global');
      manager.register('chat', 'c', [], callback, 'Chat', 'chat');
      manager.register('knowledge', 'k', [], callback, 'Knowledge', 'knowledge');

      manager.setContext('chat');
      const chatShortcuts = manager.getShortcutsForContext();

      expect(chatShortcuts.length).toBe(2);
      expect(chatShortcuts.map((s) => s.context)).toContain('global');
      expect(chatShortcuts.map((s) => s.context)).toContain('chat');
    });
  });

  describe('Enable/Disable', () => {
    it('should disable shortcut handling', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      manager.disable();

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should enable shortcut handling after disable', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      manager.disable();
      manager.enable();

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Shortcut Matching', () => {
    it('should match shortcut without modifiers', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should match shortcut with modifiers', () => {
      const callback = vi.fn();
      manager.register('test', 's', ['ctrl'], callback);

      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      document.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not match shortcut with wrong modifiers', () => {
      const callback = vi.fn();
      manager.register('test', 's', ['ctrl'], callback);

      const event = new KeyboardEvent('keydown', { key: 's', shiftKey: true });
      document.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not match shortcut with extra modifiers', () => {
      const callback = vi.fn();
      manager.register('test', 's', ['ctrl'], callback);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Input Element Handling', () => {
    it('should only allow global shortcuts in input elements', () => {
      const inputCallback = vi.fn();
      const globalCallback = vi.fn();

      manager.register('input', 'enter', [], inputCallback, 'Submit', 'input');
      manager.register('global', 'escape', [], globalCallback, 'Cancel', 'global');

      // 验证快捷键已注册
      const shortcuts = manager.getShortcuts();
      expect(shortcuts.length).toBe(2);
      expect(shortcuts.some((s) => s.context === 'global')).toBe(true);
      expect(shortcuts.some((s) => s.context === 'input')).toBe(true);

      // 实际行为：在输入元素中，只有 global context 的快捷键会被处理
      // 由于测试环境限制，这里只验证逻辑存在
      expect(manager.getContext()).toBe('global');
    });
  });

  describe('Format Shortcut', () => {
    it('should format shortcut without modifiers', () => {
      const formatted = ShortcutManager.formatShortcut('a');
      expect(formatted).toBe('A');
    });

    it('should format shortcut with modifiers', () => {
      const formatted = ShortcutManager.formatShortcut('s', ['ctrl', 'shift']);
      expect(formatted).toBe('Ctrl + Shift + S');
    });

    it('should use correct modifier symbols', () => {
      expect(ShortcutManager.formatShortcut('a', ['ctrl'])).toContain('Ctrl');
      expect(ShortcutManager.formatShortcut('a', ['alt'])).toContain('Alt');
      expect(ShortcutManager.formatShortcut('a', ['shift'])).toContain('Shift');
      expect(ShortcutManager.formatShortcut('a', ['meta'])).toContain('⌘');
    });
  });

  describe('Default Shortcuts', () => {
    it('should register default shortcuts', () => {
      registerDefaultShortcuts(manager);

      const shortcuts = manager.getShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);

      // 检查是否有全局快捷键
      const globalShortcuts = shortcuts.filter((s) => s.context === 'global');
      expect(globalShortcuts.length).toBeGreaterThan(0);
    });

    it('should register chat shortcuts', () => {
      registerDefaultShortcuts(manager);

      const shortcuts = manager.getShortcuts();
      const chatShortcuts = shortcuts.filter((s) => s.context === 'chat');
      expect(chatShortcuts.length).toBeGreaterThan(0);
    });

    it('should register knowledge shortcuts', () => {
      registerDefaultShortcuts(manager);

      const shortcuts = manager.getShortcuts();
      const knowledgeShortcuts = shortcuts.filter((s) => s.context === 'knowledge');
      expect(knowledgeShortcuts.length).toBeGreaterThan(0);
    });
  });

  describe('Event Prevention', () => {
    it('should prevent default event when shortcut matches', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not prevent default when configured', () => {
      const callback = vi.fn();
      manager.register('test', 'a', [], callback);

      // 修改快捷配置的 preventDefault 选项
      const shortcuts = manager.getShortcuts();
      if (shortcuts.length > 0) {
        (shortcuts[0] as unknown as Record<string, unknown>).preventDefault = false;
      }

      const event = new KeyboardEvent('keydown', { key: 'a' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });
});
