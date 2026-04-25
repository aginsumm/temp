class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<unknown>>;

  constructor() {
    this.pendingRequests = new Map();
  }

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const existingRequest = this.pendingRequests.get(key);

    if (existingRequest) {
      return existingRequest as Promise<T>;
    }

    const request = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, request);
    return request;
  }

  clear() {
    this.pendingRequests.clear();
  }

  hasPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }
}

export default new RequestDeduplicator();
