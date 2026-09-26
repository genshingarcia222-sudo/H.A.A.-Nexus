/**
 * Identifier conventions for corpus records (D12-29).
 *
 * Ids are **opaque after minting**. The domain and level a pattern contains are
 * mint-time hints for humans reading a diff; nothing parses them to decide
 * behaviour, and an item whose difficulty later changes keeps the id it was
 * born with. The alternative — re-deriving ids from content — would break every
 * delivery record that ever referenced the old one.
 *
 * Six digits allow a million records per family per domain, which is past the
 * point where authoring, not numbering, is the constraint.
 */

/** Items keep the pilot's shape: NEXUS-L<difficulty>-<DOMAIN>-<six digits>. */
export const ITEM_ID_PATTERN = /^NEXUS-L[1-6]-[A-Z0-9]{2,8}-\d{6}$/;

/** Knowledge records: NEXUS-KR-<DOMAIN>-<six digits>. */
export const KNOWLEDGE_ID_PATTERN = /^NEXUS-KR-[A-Z0-9]{2,8}-\d{6}$/;

/** Case contexts: NEXUS-CX-<DOMAIN>-<six digits>. */
export const CONTEXT_ID_PATTERN = /^NEXUS-CX-[A-Z0-9]{2,8}-\d{6}$/;

/**
 * Concepts are the bank's existing `variantGroup` values (for example
 * `PRIV-PHI-DEFINITION`), so their pattern is the looser shape already in use.
 * Inventing a new concept id format would orphan every variantGroup authored
 * before D12.
 */
export const CONCEPT_ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

/** A reference to one revision of one record: `<id>@<revision>` (D12-10). */
export const PINNED_REF_PATTERN = /^(.+)@(\d+)$/;

export interface PinnedRef {
  id: string;
  revision: number;
}

/**
 * Parses `<id>@<revision>`, or returns null when the ref is not pinned.
 *
 * Unpinned references are rejected by the validators rather than resolved to
 * "whatever is newest": a context edit must not silently change an item a
 * reviewer already approved.
 */
export function parsePinnedRef(ref: string): PinnedRef | null {
  const match = PINNED_REF_PATTERN.exec(ref);
  if (!match) return null;
  const [, id, revision] = match;
  if (!id || !revision) return null;
  const parsed = Number(revision);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return { id, revision: parsed };
}

export function formatPinnedRef(id: string, revision: number): string {
  return `${id}@${revision}`;
}
