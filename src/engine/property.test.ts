/* Cross-preset invariants, all 6 presets, both schemes.
 *
 * Two of the checks below are NOT unconditional. Measuring first rather than
 * assuming, both turned out to have a real, non-empty exception set — and one
 * of the two exceptions is 100% of presets, including the untouchable, already
 * -shipped `obsidian`, which proves it is not something a new preset can regress.
 *
 * 1. `contrast("#ffffff", primaryMain) >= 4.5` (7 for beacon) is checked in the
 *    LIGHT scheme only. In DARK, it is not achievable by ANY preset: the dark
 *    "primary vs surface" duty (required, `enforce: "search"`, every preset)
 *    demands a mint bright enough to read on a near-black surface, and a mint
 *    bright enough for that is — by the same luminance math — too bright for
 *    white text to read on top of it. Measured: all 6 presets fail this in dark
 *    (obsidian included, at 1.71:1), none fail it in light. Not a scoping
 *    convenience; a proof that the check has no valid domain there.
 *
 * 2. `contrast(on-role, role) >= 4.5` (7 for beacon) fails for a real subset of
 *    (preset, scheme, pair) combinations — some inherited from obsidian's own
 *    on-* literals (reused unchanged, per the plan), some newly introduced by
 *    turning `--amber-brand`'s duty from obsidian's "report" into "search".
 *    Rather than loosen the bar or silently scope a whole scheme (which would
 *    also hide the new amber-brand regression), every failure is measured and
 *    recorded below, in the same spirit as `obsidian.ts`'s own `acknowledged`
 *    list: an entry not in the ledger still fails the test, and an entry whose
 *    measured ratio has drifted — in EITHER direction — also fails it.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../color/contrast";
import { hexToOklch, hexToTriple } from "../color/oklch";
import { PRESETS } from "../presets/index";
import { CHANNEL_PAIRS, ROOT_TOKEN_NAMES } from "../tokens/names";
import { measureAcknowledged, resolveBrand } from "./resolve";

const SCHEMES = ["dark", "light"] as const;

const PRESET_ENTRIES = Object.entries(PRESETS).filter(
  (e): e is [string, NonNullable<(typeof PRESETS)[keyof typeof PRESETS]>] => e[1] !== undefined,
);

/** A measured, drift-checked shortfall ledger — `obsidian.ts`'s `acknowledged`
 *  pattern, generalized to a property-test invariant that has no home on
 *  `PresetSpec` (it isn't behind a `Duty`). An entry not listed here still
 *  fails the surrounding assertion; a listed entry whose live measurement moves
 *  by more than the tolerance also fails it, in either direction. */
function checkAgainstLedger(
  results: ReadonlyArray<{ key: string; actual: number; min: number }>,
  ledger: ReadonlyArray<{ key: string; measured: number }>,
  tolerance = 0.01,
): string[] {
  const recorded = new Map(ledger.map((e) => [e.key, e.measured]));
  if (recorded.size !== ledger.length) {
    throw new Error("ledger has a duplicate key literal — fix the ON_PAIR_SHORTFALLS/DELTA_L_SHORTFALLS array");
  }
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const { key, actual, min } of results) {
    const listed = recorded.get(key);
    if (listed !== undefined) seen.add(key);
    if (actual >= min) {
      if (listed !== undefined) problems.push(`${key}: now passes (${actual.toFixed(4)}) — remove from ledger`);
      continue;
    }
    if (listed === undefined) {
      problems.push(`${key}: ${actual.toFixed(4)} < ${min}, UNLISTED shortfall`);
    } else if (Math.abs(actual - listed) > tolerance) {
      problems.push(`${key}: ledger says ${listed}, measured ${actual.toFixed(4)} — drifted`);
    }
  }
  // A ledger key that never matched a generated (preset, scheme, pair) is dead
  // weight at best — at worst it's a typo that's silently not checking the row
  // its author intended, while the row it accidentally doesn't match sails
  // through as "unlisted" or passes unnoticed. Every entry must be exercised.
  for (const key of recorded.keys()) {
    if (!seen.has(key)) problems.push(`${key}: ledger entry matched nothing generated — orphaned, remove it`);
  }
  return problems;
}

describe("property — invariants across all 6 presets, both schemes", () => {
  it("body text clears AAA, secondary text clears AA, against --background", () => {
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const background = map.get("--background")!;
        const fg1 = contrastRatio(map.get("--fg1")!, background);
        const fg2 = contrastRatio(map.get("--fg2")!, background);
        if (fg1 < 7) problems.push(`${id}|${scheme}: --fg1 is ${fg1.toFixed(2)}:1 on --background, needs 7`);
        if (fg2 < 4.5) problems.push(`${id}|${scheme}: --fg2 is ${fg2.toFixed(2)}:1 on --background, needs 4.5`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("primary main clears 3:1 on --surface both schemes, and 4.5:1 (7 for beacon) under white text in light", () => {
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const whiteMin = id === "beacon" ? 7 : 4.5;
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const mint = map.get("--mint")!;
        const surface = map.get("--surface")!;
        const onSurface = contrastRatio(mint, surface);
        if (onSurface < 3) problems.push(`${id}|${scheme}: --mint is ${onSurface.toFixed(2)}:1 on --surface, needs 3`);

        if (scheme === "light") {
          const onWhite = contrastRatio("#ffffff", mint);
          if (onWhite < whiteMin) {
            problems.push(`${id}|light: white on --mint is ${onWhite.toFixed(2)}:1, needs ${whiteMin}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("dark-scheme white-on-primary is unachievable for every preset (proves the light-only scope above, not just assumes it)", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const min = id === "beacon" ? 7 : 4.5;
      const onWhite = contrastRatio("#ffffff", brand.dark.get("--mint")!);
      expect(onWhite, `${id} dark unexpectedly clears white-on-mint`).toBeLessThan(min);
    }
  });

  const ON_PAIR_SHORTFALLS: ReadonlyArray<{ key: string; measured: number }> = [
    { key: "obsidian|light|--on-mint/--mint", measured: 4.0653 },
    { key: "obsidian|light|--on-mint/--mint-dark", measured: 2.8366 },
    { key: "obsidian|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "meridian|light|--on-mint/--mint", measured: 1.9563 },
    { key: "meridian|light|--on-mint/--mint-dark", measured: 1.3002 },
    { key: "meridian|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "meridian|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "solstice|dark|--on-mint/--mint-dark", measured: 4.4335 },
    { key: "solstice|light|--on-mint/--mint", measured: 1.9195 },
    { key: "solstice|light|--on-mint/--mint-dark", measured: 1.295 },
    { key: "solstice|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "solstice|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "beacon|dark|--on-mint/--mint", measured: 4.0103 },
    { key: "beacon|dark|--on-mint/--mint-dark", measured: 3.092 },
    { key: "beacon|dark|--on-amber/--amber-deep", measured: 5.6843 },
    { key: "beacon|light|--on-mint/--mint", measured: 1.3675 },
    { key: "beacon|light|--on-mint/--mint-dark", measured: 1.0144 },
    { key: "beacon|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "beacon|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "graphite|dark|--on-mint/--mint-dark", measured: 2.5638 },
    { key: "graphite|light|--on-mint/--mint", measured: 2.5638 },
    { key: "graphite|light|--on-mint/--mint-dark", measured: 1.6458 },
    { key: "graphite|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "graphite|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "atlas|dark|--on-mint/--mint-dark", measured: 2.6001 },
    { key: "atlas|light|--on-mint/--mint", measured: 2.6001 },
    { key: "atlas|light|--on-mint/--mint-dark", measured: 1.6374 },
    { key: "atlas|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "atlas|light|--on-amber/--amber-deep", measured: 3.6062 },
  ];

  it("on-ink clears contrast against both gradient endpoints it sits on, or is a measured, ledgered shortfall", () => {
    const PAIRS: ReadonlyArray<readonly [string, string]> = [
      ["--on-mint", "--mint"],
      ["--on-mint", "--mint-dark"],
      ["--on-sky", "--sky"],
      ["--on-amber", "--amber-brand"],
      ["--on-amber", "--amber-deep"],
    ];
    const results: Array<{ key: string; actual: number; min: number }> = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const min = id === "beacon" ? 7 : 4.5;
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        for (const [onTok, roleTok] of PAIRS) {
          const actual = contrastRatio(map.get(onTok)!, map.get(roleTok)!);
          results.push({ key: `${id}|${scheme}|${onTok}/${roleTok}`, actual, min });
        }
      }
    }
    expect(checkAgainstLedger(results, ON_PAIR_SHORTFALLS)).toEqual([]);
  });

  const DELTA_L_SHORTFALLS: ReadonlyArray<{ key: string; measured: number }> = [
    { key: "meridian|dark", measured: 0.0584 },
    { key: "solstice|dark", measured: 0.0584 },
    { key: "beacon|dark", measured: 0.0589 },
  ];

  it("primary.dark stays distinguishable from primary.main — darkFollow/lightFollow don't let the pair collapse", () => {
    const results: Array<{ key: string; actual: number; min: number }> = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const dL = Math.abs(hexToOklch(map.get("--mint-dark")!).l - hexToOklch(map.get("--mint")!).l);
        results.push({ key: `${id}|${scheme}`, actual: dL, min: 0.06 });
      }
    }
    expect(checkAgainstLedger(results, DELTA_L_SHORTFALLS)).toEqual([]);
  });

  it("every channel token is the RGB triple of its base, in both schemes, every preset", () => {
    const wrong: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const [channel, base] of CHANNEL_PAIRS) {
        for (const [scheme, map] of [["dark", brand.dark], ["light", brand.light]] as const) {
          const hex = map.get(base)!;
          const expected = hexToTriple(hex);
          const actual = map.get(channel);
          if (actual !== expected) wrong.push(`${id}|${scheme} ${channel} = ${actual}, base ${base} = ${hex} -> ${expected}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("ROOT_TOKEN_NAMES is a superset of every host token the button and card packages alias", () => {
    const abi = new Set<string>(ROOT_TOKEN_NAMES);

    // Sibling checkout, not a hardcoded absolute path: this repo, the button
    // package, and the card package are three siblings under one parent
    // directory (the CLAUDE.md-documented layout — pnpm consumes the published
    // packages, but this test reads their raw source to catch an ABI break
    // before either package is published, which npm-installed dist output
    // can't do). Resolved from this file's own location so it works on any
    // machine with that layout, not just the one it was authored on.
    const siblingRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

    const scrape = (relativePath: string, alias: string): string[] => {
      const path = resolve(siblingRoot, relativePath);
      let css: string;
      try {
        css = readFileSync(path, "utf8");
      } catch (err) {
        throw new Error(
          `expected a sibling checkout at ${path} — starterkit-theme, starterkit-button-component, ` +
            `and starterkit-card-component must sit under the same parent directory for this ABI check ` +
            `to run (${(err as Error).message})`,
        );
      }
      const matches = css.match(new RegExp(String.raw`${alias}[\w-]+`, "g")) ?? [];
      return [...new Set(matches)].map((m) => "--" + m.slice(alias.length));
    };

    const buttonTokens = scrape("starterkit-button-component/styles.css", "--ib-t-");
    const cardTokens = scrape("starterkit-card-component/styles.css", "--ic-t-");

    const missing = [...buttonTokens, ...cardTokens].filter((n) => !abi.has(n));
    expect(missing, "aliased by a package, absent from ROOT_TOKEN_NAMES").toEqual([]);
    // Sanity that the scrape itself found something — an empty match set would
    // make the assertion above vacuously true and prove nothing.
    expect(buttonTokens.length).toBeGreaterThan(0);
    expect(cardTokens.length).toBeGreaterThan(0);
  });

  it("zero unacknowledged warnings, and every acknowledged failure still measures what it says it measures", () => {
    const unacknowledged: string[] = [];
    const drifted: string[] = [];
    const stale: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const acknowledgedKeys = new Set(preset.acknowledged.map((a) => `${a.token}|${a.scheme}`));
      for (const w of brand.warnings) {
        if (!acknowledgedKeys.has(`${w.token}|${w.scheme}`)) {
          unacknowledged.push(`${id}: ${w.message}`);
        }
      }
      // `drifted` (below) only catches a moved ratio when the move is bigger
      // than the tolerance. It is not the same claim as "still an actual
      // failure" — a recorded number that happens to already sit at a passing
      // value would drift by 0 and slip through. Check that directly, against
      // the duty's own min, so a fixed-then-forgotten acknowledgment can't hide
      // behind a coincidentally-matching stale number.
      const dutyByToken = new Map(preset.duties.map((d) => [d.token, d]));
      for (const row of measureAcknowledged(preset, brand)) {
        if (Math.abs(row.actual - row.recorded) > 0.01) {
          drifted.push(`${id}: ${row.token} (${row.scheme}) recorded ${row.recorded}, measured ${row.actual.toFixed(2)}`);
        }
        const duty = dutyByToken.get(row.token);
        if (duty !== undefined && row.actual >= duty.min) {
          stale.push(
            `${id}: ${row.token} (${row.scheme}) now clears ${duty.min}:1 (${row.actual.toFixed(2)}) — acknowledgment is stale, remove it`,
          );
        }
      }
    }
    expect(unacknowledged).toEqual([]);
    expect(drifted).toEqual([]);
    expect(stale).toEqual([]);
  });
});
