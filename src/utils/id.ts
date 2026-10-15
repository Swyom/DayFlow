/** Collision-resistant local id (no crypto dependency needed for client-side records). */
export function createId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
