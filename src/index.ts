/* Core entry — MUST stay free of React and of any "use client" banner.
 *
 * This is what a Node emit script, a route handler and the edge import. A single
 * "use client" directive on this entry, or one stray React import pulled in
 * through a barrel file, makes the engine unusable in all three — and the
 * failure surfaces at request time in production, not at build time here. The
 * smoke test require()s this bundle under plain Node for exactly that reason.
 */
export * from "./tokens/names";
export * from "./color";
export * from "./engine";
