/**
 * Canonicalizes an object so hashing is independent of key order (two
 * JSON files with the same content but differently ordered keys must
 * produce the same hash). Recurses through arrays and plain objects.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/**
 * Uses Web Crypto (`crypto.subtle`), available as a global in both the
 * browser/Tauri webview and Node 20+ — deliberately not `node:crypto`, so
 * this function works unmodified in the desktop frontend later, not just
 * in tests.
 */
export async function computeContentHash(value: unknown): Promise<string> {
  const canonical = JSON.stringify(canonicalize(value));
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
