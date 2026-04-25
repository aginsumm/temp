/**
 * 语音合成服务（Text-to-Speech）
 * 提供文本转语音功能，支持多种语音和语速控制
 */

type SpeechState = 'idle' | 'speaking' | 'paused' | 'error';

interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

type EventCallback = (...args: unknown[]) => void;

class SpeechSynthesisService {
  private state: SpeechState = 'idle';
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private isSupported: boolean = false;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.checkSupport();
    if (this.isSupported) {
      this.loadVoices();
      // 监听语音加载完成事件（某些浏览器是异步的）
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  /**
   * 检查浏览器支持
   */
  private checkSupport(): void {
    this.isSupported = 'speechSynthesis' in window;
    if (!this.isSupported) {
      console.warn('浏览器不支持语音合成');
    }
  }

  /**
   * 加载可用语音
   */
  private loadVoices(): void {
    this.availableVoices = window.speechSynthesis.getVoices();

    // 优先选择中文语音
    this.preferredVoice =
      this.availableVoices.find(
        (voice) =>
          voice.lang.startsWith('zh-CN') ||
          voice.lang.startsWith('zh-HK') ||
          voice.lang.startsWith('zh-TW')
      ) ||
      this.availableVoices.find((voice) => voice.lang.startsWith('zh')) ||
      null;

    this.emit('voiceschanged', this.availableVoices);
  }

  /**
   * 获取所有可用语音
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.availableVoices;
  }

  /**
   * 获取首选语音（中文）
   */
  getPreferredVoice(): SpeechSynthesisVoice | null {
    return this.preferredVoice;
  }

  /**
   * 设置首选语音
   */
  setPreferredVoice(voice: SpeechSynthesisVoice | null): void {
    this.preferredVoice = voice;
  }

  /**
   * 朗读文本
   */
  speak(text: string, options?: SpeechOptions): boolean {
    if (!this.isSupported) {
      this.emit('error', { error: 'not_supported', message: '浏览器不支持语音合成' });
      return false;
    }

    if (!text || text.trim().length === 0) {
      return false;
    }

    // 如果正在说话，先停止
    if (this.state === 'speaking') {
      this.stop();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // 应用选项
    utterance.lang = options?.lang || this.preferredVoice?.lang || 'zh-CN';
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    if (options?.voice) {
      utterance.voice = options.voice;
    } else if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    // 绑定事件
    utterance.onstart = () => {
      this.state = 'speaking';
      this.emit('start');
    };

    utterance.onend = () => {
      this.state = 'idle';
      this.currentUtterance = null;
      this.emit('end');
    };

    utterance.onerror = (event) => {
      this.state = 'error';
      this.currentUtterance = null;
      this.emit('error', {
        error: 'unknown',
        message: `语音合成错误：${event.error}`,
      });
    };

    utterance.onboundary = (event) => {
      this.emit('boundary', {
        charIndex: event.charIndex,
        charLength: event.charLength,
        name: event.name,
      });
    };

    this.currentUtterance = utterance;
    this.state = 'speaking';

    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * 暂停朗读
   */
  pause(): void {
    if (this.state === 'speaking') {
      window.speechSynthesis.pause();
      this.state = 'paused';
      this.emit('pause');
    }
  }

  /**
   * 恢复朗读
   */
  resume(): void {
    if (this.state === 'paused') {
      window.speechSynthesis.resume();
      this.state = 'speaking';
      this.emit('resume');
    }
  }

  /**
   * 停止朗读
   */
  stop(): void {
    if (this.state === 'speaking' || this.state === 'paused') {
      window.speechSynthesis.cancel();
      this.state = 'idle';
      this.currentUtterance = null;
      this.emit('stop');
    }
  }

  /**
   * 获取当前状态
   */
  getState(): SpeechState {
    return this.state;
  }

  /**
   * 检查是否正在说话
   */
  isSpeaking(): boolean {
    return this.state === 'speaking';
  }

  /**
   * 检查是否被支持
   */
  getIsSupported(): boolean {
    return this.isSupported;
  }

  /**
   * 事件监听
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: unknown[]): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback(...args));
    }
  }
}

// 单例
export const speechSynthesisService = new SpeechSynthesisService();
export default speechSynthesisService;
