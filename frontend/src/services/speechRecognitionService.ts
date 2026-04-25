type RecognitionState = 'idle' | 'listening' | 'processing' | 'error';

interface RecognitionResult {
  final: string;
  interim: string;
  confidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (...args: any[]) => void;

class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private state: RecognitionState = 'idle';
  private lang: string = 'zh-CN';
  private continuous: boolean = true;
  private interimResults: boolean = true;
  private maxAlternatives: number = 1;
  private result: RecognitionResult = { final: '', interim: '', confidence: 0 };
  private listeners: Map<string, EventCallback[]> = new Map();
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    this.isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private initRecognition(): SpeechRecognition | null {
    if (!this.isSupported) {
      this.emit('error', { error: 'not_supported', message: '浏览器不支持语音识别' });
      return null;
    }

    if (this.recognition) {
      return this.recognition;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      this.isSupported = false;
      this.emit('error', { error: 'not_supported', message: '浏览器不支持语音识别' });
      return null;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.lang;
    this.recognition.maxAlternatives = this.maxAlternatives;

    this.recognition.onresult = (event: Event) => {
      const speechEvent = event as SpeechRecognitionEvent;
      let finalTranscript = '';
      let interimTranscript = '';
      let highestConfidence = 0;

      for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i++) {
        const result = speechEvent.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          highestConfidence = Math.max(highestConfidence, result[0].confidence);
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      this.result = {
        final: finalTranscript,
        interim: interimTranscript,
        confidence: highestConfidence,
      };

      this.emit('result', this.result);
    };

    this.recognition.onerror = () => {
      this.state = 'error';
      this.emit('error', { error: 'unknown', message: '语音识别错误' });
    };

    this.recognition.onend = () => {
      if (this.state === 'listening') {
        this.state = 'idle';
        this.emit('end');
      }
    };

    this.recognition.onstart = () => {
      this.state = 'listening';
      this.emit('start');
    };

    return this.recognition;
  }

  start(options?: { lang?: string; continuous?: boolean; interimResults?: boolean }): boolean {
    if (options?.lang) this.lang = options.lang;
    if (options?.continuous !== undefined) this.continuous = options.continuous;
    if (options?.interimResults !== undefined) this.interimResults = options.interimResults;

    const recognition = this.initRecognition();
    if (!recognition) {
      return false;
    }

    if (this.state === 'listening') {
      return false;
    }

    this.result = { final: '', interim: '', confidence: 0 };
    this.state = 'processing';

    try {
      recognition.start();
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', { error: 'start_failed', message: '启动语音识别失败' });
      return false;
    }
  }

  stop(): void {
    if (this.recognition && this.state === 'listening') {
      this.recognition.stop();
      this.state = 'idle';
    }
  }

  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.state = 'idle';
    }
  }

  getState(): RecognitionState {
    return this.state;
  }

  getResult(): RecognitionResult {
    return { ...this.result };
  }

  isListening(): boolean {
    return this.state === 'listening';
  }

  getIsSupported(): boolean {
    return this.isSupported;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args));
    }
  }

  destroy(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    this.listeners.clear();
    this.state = 'idle';
  }
}

export const speechRecognitionService = new SpeechRecognitionService();

export { SpeechRecognitionService, type RecognitionState, type RecognitionResult };
