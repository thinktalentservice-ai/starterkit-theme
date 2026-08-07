/* Core entry — engine, types and the token ABI.
 *
 * MUST remain free of "use client". This module is imported by a build-time
 * emit script, by a Next.js route handler and potentially by middleware at the
 * edge; the directive would break all three at import time rather than at
 * build, so `scripts/smoke.mjs` asserts its absence on every build. See the
 * comment at the top of tsup.config.ts. */

export * from "./tokens/names";
export * from "./color";
