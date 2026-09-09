// Small shared helpers: error shape, id generation, and the revenue split.

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Computes the 70/30 uploader/BNO revenue split for a sale, server-side only.
 * Never trust a split coming from client input.
 */
export function computeSplit(amountCents: number): { uploaderShareCents: number; bnoShareCents: number } {
  const uploaderShareCents = Math.round(amountCents * 0.7);
  const bnoShareCents = amountCents - uploaderShareCents; // remainder to BNO
  return { uploaderShareCents, bnoShareCents };
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}
