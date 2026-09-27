const ITERATIONS = 150_000;

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

/** PBKDF2-SHA256 hash of the PIN with a per-device random salt. */
export async function hashPin(pin: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const h = await hashPin(pin, salt);
  // Constant-time-ish compare.
  let diff = h.hash.length ^ hash.length;
  for (let i = 0; i < Math.min(h.hash.length, hash.length); i++) diff |= h.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
