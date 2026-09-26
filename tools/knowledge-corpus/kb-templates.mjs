// The template index. Families are split across files only to keep each one
// readable; the order here is the order batch sequence numbers are minted in,
// so it must not be reshuffled once a batch has been generated.
import { TEMPLATES_A } from "./kb-templates-a.mjs";
import { TEMPLATES_B } from "./kb-templates-b.mjs";
import { TEMPLATES_C } from "./kb-templates-c.mjs";

export const TEMPLATES = [...TEMPLATES_A, ...TEMPLATES_B, ...TEMPLATES_C];
