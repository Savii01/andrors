/**
 * Lightweight Client-Side Proof-of-Work Challenge
 * Uses native Web Crypto API (SHA-256) to prove browser presence.
 * Target: find nonce where SHA-256(challenge:nonce) starts with "000".
 */

export interface PowChallenge {
  challenge: string;
  nonce: number;
  solution: string;
}

const LEADING_ZEROS = 3;
const MAX_ATTEMPTS = 200_000;

/**
 * Generate a challenge string on the client.
 */
export function generateChallenge(userId: string): string {
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  return `${userId}:${Date.now()}:${nonce}`;
}

/**
 * Solve the proof-of-work in the browser.
 * Returns the solution object, or null if Web Crypto is unavailable.
 */
export async function solvePow(challenge: string): Promise<PowChallenge | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;

  const encoder = new TextEncoder();
  const prefix = '0'.repeat(LEADING_ZEROS);

  for (let nonce = 0; nonce < MAX_ATTEMPTS; nonce++) {
    const input = encoder.encode(`${challenge}:${nonce}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', input);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex.startsWith(prefix)) {
      return { challenge, nonce, solution: hashHex };
    }
  }

  return null;
}

/**
 * Server-side verification of a proof-of-work solution.
 * Uses Node.js crypto — O(1), single SHA-256 hash.
 */
export function verifyPow(challenge: string, nonce: number, solution: string): boolean {
  const crypto = require('crypto') as typeof import('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${challenge}:${nonce}`)
    .digest('hex');

  const prefix = '0'.repeat(LEADING_ZEROS);
  return hash.startsWith(prefix) && hash === solution;
}
