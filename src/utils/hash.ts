/**
 * cyrb53 string hash. Legacy only: v2.1 and earlier stored `cyrb53(email:password)`.
 * It is used solely to verify those old accounts once, on their next log-in, before
 * they are upgraded to salted PBKDF2 (services/passwordHash.ts). Never use it for
 * anything new — it is fast and unsalted, so it offers no real protection.
 */
export function hashString(input: string, seed = 0x5f3759df): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
