export const MAX_DELIVERY_ATTEMPTS = 5;

export function readAttempt(headers: unknown): number {
  if (!headers || typeof headers !== 'object') {
    return 1;
  }

  const raw = (headers as Record<string, unknown>)['x-attempts'];
  const attempt = typeof raw === 'number' ? raw : Number(raw);

  return Number.isInteger(attempt) && attempt > 0 ? attempt : 1;
}

/** Failed deliveries retry until the cap, then go to the dead-letter queue. */
export function failureAction(attempt: number): 'retry' | 'dead-letter' {
  return attempt >= MAX_DELIVERY_ATTEMPTS ? 'dead-letter' : 'retry';
}
