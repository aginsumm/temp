import type { ChatResponse, Entity, Relation, Source } from '../types/chat';

const MAX_ERRORS = 5;

export class RecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoverableError';
  }
}

export class StreamBuffer {
  private buffer: string[] = [];
  private errorCount = 0;
  private accumulatedContent = '';
  private entities: Entity[] = [];
  private keywords: string[] = [];
  private relations: Relation[] = [];
  private messageId: string | null = null;
  private sources: Source[] = [];

  async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete: (response: ChatResponse) => void
  ): Promise<void> {
    const decoder = new TextDecoder();
    let sseBuffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.flushBuffer(onChunk);
          onComplete(this.buildFinalResponse());
          break;
        }

        const text = decoder.decode(value, { stream: true });
        sseBuffer += text;

        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() || '';

        for (const rawEvent of events) {
          await this.handleRawEvent(rawEvent, onChunk);
        }
      }
    } catch (error) {
      this.errorCount++;
      if (this.errorCount < MAX_ERRORS) {
        throw new RecoverableError((error as Error).message);
      } else {
        throw error;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleRawEvent(rawEvent: string, onChunk: (chunk: string) => void): Promise<void> {
    const dataLines = rawEvent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''));

    if (dataLines.length === 0) return;

    const payload = dataLines.join('\n');
    if (payload === '[DONE]') return;

    try {
      const data = JSON.parse(payload);
      await this.handleSSEData(data, onChunk);
    } catch (parseError) {
      console.warn('SSE parse error:', parseError);
    }
  }

  async handleSSEData(
    data: Record<string, unknown>,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (data.type === 'content_chunk' || data.type === 'content') {
      const chunkText = String(data.content || '');
      this.buffer.push(chunkText);
      this.accumulatedContent += chunkText;
      onChunk(chunkText);
    } else if (data.type === 'entities') {
      this.entities = Array.isArray(data.entities) ? data.entities : [];
    } else if (data.type === 'keywords') {
      this.keywords = Array.isArray(data.keywords) ? data.keywords : [];
    } else if (data.type === 'relations') {
      this.relations = Array.isArray(data.relations) ? data.relations : [];
    } else if (data.type === 'complete') {
      this.messageId = String(data.message_id || '');
      this.sources = Array.isArray(data.sources) ? data.sources : [];
      if (data.content) {
        this.accumulatedContent = String(data.content);
      }
      if (data.entities) this.entities = Array.isArray(data.entities) ? data.entities : [];
      if (data.keywords) this.keywords = Array.isArray(data.keywords) ? data.keywords : [];
      if (data.relations) this.relations = Array.isArray(data.relations) ? data.relations : [];
    } else if (data.type === 'resume') {
      console.log(`Stream resumed from offset: ${data.offset}`);
    } else if (data.type === 'error') {
      throw new Error(String(data.message || 'Stream error'));
    }
  }

  private flushBuffer(onChunk: (chunk: string) => void): void {
    if (this.buffer.length > 0) {
      const remaining = this.buffer.join('');
      if (remaining) {
        onChunk(remaining);
        this.buffer = [];
      }
    }
  }

  private buildFinalResponse(): ChatResponse {
    return {
      message_id: this.messageId || `msg_${Date.now()}`,
      content: this.accumulatedContent,
      role: 'assistant',
      sources: this.sources,
      entities: this.entities,
      keywords: this.keywords,
      relations: this.relations,
      created_at: new Date().toISOString(),
    };
  }

  reset(): void {
    this.buffer = [];
    this.errorCount = 0;
    this.accumulatedContent = '';
    this.entities = [];
    this.keywords = [];
    this.relations = [];
    this.messageId = null;
    this.sources = [];
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }
}
