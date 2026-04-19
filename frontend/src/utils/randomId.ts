/** Stable request / error id without extra deps (works in browser + Vitest). */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
