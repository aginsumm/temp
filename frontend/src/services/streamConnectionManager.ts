import {
  LLMErrorType,
  classifyLLMError,
  getUserFriendlyMessage,
  shouldRetry,
} from './llmErrorClassifier';
import type { ChatRequest, ChatResponse, Entity, Relation } from '../types/chat';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 5000];
const STREAM_TIMEOUT = 60000;

export interface StreamReconnectState {
  attempt: number;
  maxAttempts: number;
  lastReceivedChunkIndex: number;
  accumulatedContent: string;
  entities: Entity[];
  keywords: string[];
  relations: Relation[];
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (response: ChatResponse) => void;
  onEntities?: (entities: Entity[]) => void;
  onKeywords?: (keywords: string[]) => void;
  onRelations?: (relations: Relation[]) => void;
  onReconnectStart?: (state: StreamReconnectState) => void;
  onReconnectSuccess?: (state: StreamReconnectState) => void;
  onReconnectFail?: (state: StreamReconnectState, error: Error) => void;
  onError?: (errorType: LLMErrorType, message: string) => void;
}

class StreamConnectionManager {
  private controller: AbortController | null = null;
  private reconnectState: StreamReconnectState | null = null;

  async connectWithRetry(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
    const {
      onChunk,
      onComplete,
      onEntities,
      onKeywords,
      onRelations,
      onReconnectStart,
      onReconnectSuccess,
      onReconnectFail,
      onError,
    } = callbacks;

    this.reconnectState = {
      attempt: 0,
      maxAttempts: MAX_RETRIES,
      lastReceivedChunkIndex: 0,
      accumulatedContent: '',
      entities: [],
      keywords: [],
      relations: [],
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];

          if (onReconnectStart) {
            onReconnectStart({
              ...this.reconnectState!,
              attempt,
            });
          }

          console.log(`Stream reconnection attempt ${attempt}/${MAX_RETRIES}, waiting ${delay}ms`);
          await this.sleep(delay);
        }

        await this.establishStream(
          request,
          onChunk,
          onComplete,
          onEntities,
          onKeywords,
          onRelations,
          attempt > 0 ? this.reconnectState : undefined
        );

        if (onReconnectSuccess && attempt > 0) {
          onReconnectSuccess({
            ...this.reconnectState!,
            attempt,
          });
        }

        return;
      } catch (error) {
        lastError = error as Error;
        const errorType = classifyLLMError(error);
        const userMessage = getUserFriendlyMessage(errorType);

        if (onError) {
          onError(errorType, userMessage);
        }

        console.error(`Stream attempt ${attempt} failed:`, error);

        if (!shouldRetry(error)) {
          break;
        }

        this.reconnectState!.attempt = attempt + 1;
      }
    }

    if (onReconnectFail && this.reconnectState) {
      onReconnectFail(this.reconnectState, lastError || new Error('Unknown error'));
    }

    throw new Error(
      `Stream connection failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
    );
  }

  private async establishStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: ChatResponse) => void,
    onEntities?: (entities: Entity[]) => void,
    onKeywords?: (keywords: string[]) => void,
    onRelations?: (relations: Relation[]) => void,
    resumeState?: StreamReconnectState
  ): Promise<void> {
    this.controller = new AbortController();
    const timeoutId = setTimeout(() => {
      this.controller?.abort();
    }, STREAM_TIMEOUT);

    try {
      const token = localStorage.getItem('token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (resumeState) {
        headers['X-Resume-From'] = resumeState.lastReceivedChunkIndex.toString();
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

      const response = await fetch(`${baseUrl}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: request.session_id,
          content: request.content,
          message_type: request.message_type || 'text',
          resume_from: resumeState?.lastReceivedChunkIndex,
        }),
        signal: this.controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await this.processStream(
        response.body!,
        onChunk,
        onComplete,
        onEntities,
        onKeywords,
        onRelations,
        resumeState,
        this.controller
      );
    } finally {
      clearTimeout(timeoutId);
      this.controller = null;
    }
  }

  private async processStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete: (response: ChatResponse) => void,
    onEntities?: (entities: Entity[]) => void,
    onKeywords?: (keywords: string[]) => void,
    onRelations?: (relations: Relation[]) => void,
    resumeState?: StreamReconnectState,
    controller?: AbortController
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = resumeState?.accumulatedContent ? '' : '';
    let accumulatedContent = resumeState?.accumulatedContent || '';
    let chunkIndex = resumeState?.lastReceivedChunkIndex || 0;
    let latestEntities: Entity[] = resumeState?.entities || [];
    let latestKeywords: string[] = resumeState?.keywords || [];
    let latestRelations: Relation[] = resumeState?.relations || [];
    let lastResponse: ChatResponse | null = null;
    let lastActivityTime = Date.now();

    try {
      let done = false;
      while (!done) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
          setTimeout(() => {
            if (Date.now() - lastActivityTime > STREAM_TIMEOUT) {
              reject(new Error('Stream read timeout'));
            }
          }, STREAM_TIMEOUT);
        });

        const result = await Promise.race([readPromise, timeoutPromise]);
        const { done: readerDone, value } = result;
        done = readerDone;

        if (done) break;

        lastActivityTime = Date.now();
        sseBuffer += decoder.decode(value, { stream: true });

        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() || '';

        for (const rawEvent of events) {
          const dataLines = rawEvent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.replace(/^data:\s?/, ''));

          if (dataLines.length === 0) continue;
          const payload = dataLines.join('\n');
          if (payload === '[DONE]') continue;

          try {
            const data = JSON.parse(payload);

            if (data.type === 'content_chunk' || data.type === 'content') {
              const chunkText = String(data.content || '');
              accumulatedContent += chunkText;
              chunkIndex++;
              onChunk(chunkText);

              if (this.reconnectState) {
                this.reconnectState.lastReceivedChunkIndex = chunkIndex;
                this.reconnectState.accumulatedContent = accumulatedContent;
              }
            } else if (data.type === 'entities') {
              latestEntities = Array.isArray(data.entities) ? data.entities : [];
              if (this.reconnectState) {
                this.reconnectState.entities = latestEntities;
              }
              onEntities?.(latestEntities);
            } else if (data.type === 'keywords') {
              latestKeywords = Array.isArray(data.keywords) ? data.keywords : [];
              if (this.reconnectState) {
                this.reconnectState.keywords = latestKeywords;
              }
              onKeywords?.(latestKeywords);
            } else if (data.type === 'relations') {
              latestRelations = Array.isArray(data.relations) ? data.relations : [];
              if (this.reconnectState) {
                this.reconnectState.relations = latestRelations;
              }
              onRelations?.(latestRelations);
            } else if (data.type === 'complete') {
              lastResponse = {
                message_id: data.message_id,
                content: data.content || accumulatedContent,
                role: 'assistant',
                sources: data.sources || [],
                entities: data.entities || latestEntities,
                keywords: data.keywords || latestKeywords,
                relations: data.relations || latestRelations,
                created_at: new Date().toISOString(),
              };
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Stream error');
            } else if (data.type === 'resume') {
              console.log(`Resuming from offset: ${data.offset}`);
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data event:', parseError);
          }
        }
      }

      if (!lastResponse && accumulatedContent.trim()) {
        lastResponse = {
          message_id: `msg_${Date.now()}`,
          content: accumulatedContent,
          role: 'assistant',
          sources: [],
          entities: latestEntities,
          keywords: latestKeywords,
          relations: latestRelations,
          created_at: new Date().toISOString(),
        };
      }

      if (lastResponse) {
        onComplete(lastResponse);
      }
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new Error('Stream aborted by timeout');
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  abort(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const streamConnectionManager = new StreamConnectionManager();
