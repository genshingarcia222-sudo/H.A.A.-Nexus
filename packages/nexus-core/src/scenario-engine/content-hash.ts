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

export type ContentHashViolation =
  | { kind: "changed-without-version-bump"; key: string; recorded: string; actual: string }
  | { kind: "unrecorded"; key: string; actual: string }
  | { kind: "recorded-but-missing"; key: string; recorded: string };

/**
 * The content-authoring gate required by Architecture Package Section 29:
 * "a content update that doesn't bump `version` but changes `content_hash`
 * is flagged as a content-authoring error".
 *
 * Both maps are keyed by package identity plus version (for scenarios,
 * `scenarioKey` - `SCRIBE-FM-014@1.0`) and hold `computeContentHash` values.
 * `recorded` is the committed manifest; `actual` is what is shipping now.
 *
 * - **changed-without-version-bump**: a released version's content changed.
 *   The fix is to publish the change under a new version, never to
 *   re-record the old one - which is why this check has no "update" mode.
 * - **unrecorded**: a new package version whose hash must be added to the
 *   manifest once it is final.
 * - **recorded-but-missing**: the manifest lists a version that is no longer
 *   shipped, so the manifest no longer describes the shipped content.
 *
 * Pure and deterministic: violations are sorted by key, then kind.
 */
export function findContentHashViolations(
  recorded: Readonly<Record<string, string>>,
  actual: Readonly<Record<string, string>>
): ContentHashViolation[] {
  const violations: ContentHashViolation[] = [];
  for (const [key, hash] of Object.entries(actual)) {
    const previous = recorded[key];
    if (previous === undefined) {
      violations.push({ kind: "unrecorded", key, actual: hash });
    } else if (previous !== hash) {
      violations.push({ kind: "changed-without-version-bump", key, recorded: previous, actual: hash });
    }
  }
  for (const [key, hash] of Object.entries(recorded)) {
    if (!(key in actual)) {
      violations.push({ kind: "recorded-but-missing", key, recorded: hash });
    }
  }
  return violations.sort((a, b) => (a.key === b.key ? a.kind.localeCompare(b.kind) : a.key.localeCompare(b.key)));
}
