const STORAGE_KEY = 'chat_input_history';
const MAX_HISTORY_ITEMS = 50;
const MIN_INPUT_LENGTH = 2;
const DEBOUNCE_DELAY = 500;

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: number;
  sessionId?: string;
  usageCount: number;
}

class InputHistoryService {
  private history: HistoryItem[] = [];
  private debounceTimer: number | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load input history:', error);
      this.history = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save input history:', error);
    }
  }

  addInput(text: string, sessionId?: string): void {
    if (!text || text.trim().length < MIN_INPUT_LENGTH) return;

    const trimmedText = text.trim();

    const existingIndex = this.history.findIndex(
      (item) => item.text.toLowerCase() === trimmedText.toLowerCase()
    );

    if (existingIndex !== -1) {
      this.history[existingIndex].timestamp = Date.now();
      this.history[existingIndex].usageCount += 1;
      if (sessionId) {
        this.history[existingIndex].sessionId = sessionId;
      }
    } else {
      const newItem: HistoryItem = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: trimmedText,
        timestamp: Date.now(),
        sessionId,
        usageCount: 1,
      };

      this.history.unshift(newItem);

      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
      }
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  addInputDebounced(text: string, sessionId?: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.addInput(text, sessionId);
      this.debounceTimer = null;
    }, DEBOUNCE_DELAY);
  }

  searchHistory(query: string, limit: number = 10): HistoryItem[] {
    if (!query || query.trim().length === 0) {
      return this.history.slice(0, limit);
    }

    const lowerQuery = query.toLowerCase();

    const matches = this.history.filter((item) => item.text.toLowerCase().includes(lowerQuery));

    const sorted = matches.sort((a, b) => {
      const aStartsWith = a.text.toLowerCase().startsWith(lowerQuery);
      const bStartsWith = b.text.toLowerCase().startsWith(lowerQuery);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      if (aStartsWith && bStartsWith) {
        return b.usageCount - a.usageCount;
      }

      return b.timestamp - a.timestamp;
    });

    return sorted.slice(0, limit);
  }

  getRecentHistory(limit: number = 10): HistoryItem[] {
    return this.history.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getFrequentHistory(limit: number = 10): HistoryItem[] {
    return this.history.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
  }

  deleteItem(id: string): boolean {
    const index = this.history.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  getItemById(id: string): HistoryItem | null {
    return this.history.find((item) => item.id === id) || null;
  }

  getAllHistory(): HistoryItem[] {
    return [...this.history];
  }

  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  importHistory(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.history = imported.slice(0, MAX_HISTORY_ITEMS);
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }
}

export const inputHistoryService = new InputHistoryService();

export { InputHistoryService };
