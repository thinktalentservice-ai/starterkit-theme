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
import { contrastRatio, fitContrast } from "../color/contrast";
import { hexToOklch, hexToTriple } from "../color/oklch";
import { PRESETS } from "../presets/index";
import { SHARED_DARK_DUTIES } from "../presets/obsidian";
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
    /* Every `|dark|` `--on-mint` entry that stood here is gone, and beacon's
       `--mint-dark` one has now moved twice, 3.09 -> 4.44 -> 5.41: `darkFloor`
       lifts the dark ramp and `darkTarget` lifts it further, and a brighter mint
       is a better backdrop for a near-black ink. It stays on the ledger only
       because beacon's bar is 7, not 4.5. The LIGHT rows are untouched through
       both changes, which is the check working — the light ramp is built from
       the unlifted seed and nothing about it moved. */
    { key: "solstice|light|--on-mint/--mint", measured: 1.9195 },
    { key: "solstice|light|--on-mint/--mint-dark", measured: 1.295 },
    { key: "solstice|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "solstice|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "beacon|dark|--on-mint/--mint-dark", measured: 5.4111 },
    { key: "beacon|dark|--on-amber/--amber-deep", measured: 5.6843 },
    { key: "beacon|light|--on-mint/--mint", measured: 1.3675 },
    { key: "beacon|light|--on-mint/--mint-dark", measured: 1.0144 },
    { key: "beacon|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "beacon|light|--on-amber/--amber-deep", measured: 3.6062 },
    { key: "graphite|light|--on-mint/--mint", measured: 2.5638 },
    { key: "graphite|light|--on-mint/--mint-dark", measured: 1.6458 },
    { key: "graphite|light|--on-amber/--amber-brand", measured: 3.6062 },
    { key: "graphite|light|--on-amber/--amber-deep", measured: 3.6062 },
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

  it("every solid-fill stop clears its floor against the ink actually chosen for it, in BOTH schemes", () => {
    /* The floors declared by `fillFloor` in obsidian.ts. Restated here rather
       than imported on purpose: a test that reads the same constant as the code
       asserts only that a number equals itself. These are the numbers a reviewer
       agreed to, and moving one has to be a deliberate edit in two places. */
    const FLOORS: ReadonlyArray<readonly [string, string, number]> = [
      ["--brand-fill", "--brand-fill-ink", 8.5],
      ["--brand-fill-end", "--brand-fill-ink", 5.5],
      ["--amber-fill", "--amber-fill-ink", 4.5],
      ["--amber-fill-end", "--amber-fill-ink", 4.5],
      ["--cobalt-fill", "--cobalt-fill-ink", 4.5],
      ["--cobalt-fill-end", "--cobalt-fill-ink", 4.5],
    ];
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        for (const [fill, inkTok, min] of FLOORS) {
          const actual = contrastRatio(map.get(fill)!, map.get(inkTok)!);
          if (actual < min) {
            problems.push(`${id}|${scheme}|${fill}: ${actual.toFixed(2)} < ${min}`);
          }
        }
      }
    }
    /* No ledger. A shortfall here is not a preset a person tuned badly, it is
       `lift` failing to do the one thing it exists for — and `fitContrast`
       reports `ok: false` rather than throwing, so without this assertion an
       unreachable floor renders as a dim button and nothing says a word. */
    expect(problems).toEqual([]);
  });

  it("solid-fill stops are scheme-invariant — the fill is the same colour in light as in dark", () => {
    /* The whole premise of the split: a fill does not darken in light mode, so
       a filled button looks identical either way. If one of these ever differs,
       `from: "dark"` was dropped somewhere and light mode is quietly rendering
       the searched text colour again — the exact regression this replaced. */
    const FILLS = [
      "--brand-fill", "--brand-fill-end", "--brand-fill-ink",
      "--amber-fill", "--amber-fill-end", "--amber-fill-ink",
      "--cobalt-fill", "--cobalt-fill-end", "--cobalt-fill-ink",
    ];
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const token of FILLS) {
        const d = brand.dark.get(token);
        const l = brand.light.get(token);
        if (d !== l) problems.push(`${id}|${token}: dark ${d} !== light ${l}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("the dark brand ladder is strictly ordered — a searched slot never collapses onto its neighbours", () => {
    /* THE defect `darkFloor` exists for, and nothing else in this file saw it.
       `--mint` carries an `enforce: "search"` duty in dark for every preset but
       the incumbent; the search walks toward light and runs to the ramp's BOUND,
       index 0 — where `--mint-soft` already sits. Measured before the fix,
       meridian/solstice/beacon rendered `-soft`, `-text` and `--mint` as ONE hex.

       Every duty check passed while that was true, which is the point: equal
       values clear a floor exactly as well as distinct ones. Only ordering
       catches it. Strict `>`, not `>=` — the failure mode is equality. */
    const LADDERS: ReadonlyArray<readonly string[]> = [
      ["--mint-soft", "--mint-text", "--mint", "--mint-dark"],
      ["--electric-light", "--electric-text", "--electric", "--electric-deep"],
      ["--amber-soft", "--amber-text", "--amber-brand", "--amber-deep"],
      ["--cobalt-soft", "--cobalt-text", "--cobalt-light", "--cobalt", "--cobalt-deep"],
    ];
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const surface = brand.dark.get("--surface")!;
      for (const ladder of LADDERS) {
        for (let i = 1; i < ladder.length; i++) {
          const above = contrastRatio(brand.dark.get(ladder[i - 1]!)!, surface);
          const below = contrastRatio(brand.dark.get(ladder[i]!)!, surface);
          if (!(above > below)) {
            problems.push(
              `${id}|dark ${ladder[i - 1]} (${above.toFixed(2)}) must out-contrast ${ladder[i]} (${below.toFixed(2)})`,
            );
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("every family with a darkFloor clears it at its MAIN slot, and the incumbent is a byte-identical no-op", () => {
    /* Restated, not imported, for the same reason as the fill floors above. */
    const FLOORS: ReadonlyArray<readonly [string, string, number]> = [
      ["mint", "--mint", 8.0],
      ["electric", "--electric", 4.4],
      ["cyan", "--cyan", 6.65],
    ];
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const surface = brand.dark.get("--surface")!;
      for (const [famId, main, min] of FLOORS) {
        expect(preset.families[famId]?.darkFloor, `${id} ${famId} must declare a darkFloor`).toBe(min);
        const actual = contrastRatio(brand.dark.get(main)!, surface);
        if (actual < min) problems.push(`${id}|dark|${main}: ${actual.toFixed(2)} < ${min}`);
        /* The floors are read off the incumbent's own measured ratios, rounded
           DOWN, precisely so its seeds clear them untouched. If one is ever
           raised to the measured value itself, `fitContrast` re-quantises and
           obsidian's `#b3d335` becomes `#b3d436` — a diff on the one preset that
           must never move. This is that guarantee, asserted rather than trusted. */
        if (id === "obsidian" && brand.dark.get(main) !== preset.families[famId]!.seed.toLowerCase()) {
          problems.push(`obsidian|${main}: ${brand.dark.get(main)} !== seed ${preset.families[famId]!.seed}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("every preset declares the shared dark duties — a duty nobody wrote cannot be reported", () => {
    /* Obsidian declared `--electric` in dark; the other five declared nothing in
       dark beyond their own three reseeded families. So meridian (4.44),
       solstice (4.42) and beacon (4.42) all missed 4.5:1 on
       `palette.secondary.main` with `warnings` EMPTY — the identical failure
       obsidian had acknowledged in writing at 4.41.

       `warnings` being empty is exactly what this cannot detect on its own,
       which is why the assertion is about the DUTY LIST and not about the
       output: a preset that forgets the spread is silent, and silence is
       indistinguishable from passing. */
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      for (const shared of SHARED_DARK_DUTIES) {
        const covered = (preset.duties ?? []).some(
          (d) =>
            d.token === shared.token &&
            d.against === shared.against &&
            d.min >= shared.min &&
            (d.scheme === "dark" || d.scheme === "both"),
        );
        if (!covered) problems.push(`${id} does not declare the shared dark duty for ${shared.token}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("darkTarget reaches parity or stops ON its chroma budget — never somewhere arbitrary, never below the floor", () => {
    /* The floor above is a hard invariant. This one is not: a hue sRGB cannot
       carry brightly stops short of the target on purpose, so "did it hit the
       target" is the wrong question and the ledger shape used elsewhere in this
       file would be the wrong answer — it would record whatever came out.

       The real claim is that a shortfall is CAUSED BY THE BUDGET. So every
       family either reaches its target, or its rendered chroma sits on the
       budget line — within one ray step of `(1 - retention)` times the chroma at
       the floor. Anything between those two states means the climb stopped for a
       reason nobody declared.

       The floor comparison is the regression guard. Measuring the budget from
       the SEED instead of from the floor shipped once and walked meridian
       BACKWARDS, 8.05 -> 5.06 — a guard that made the brand darker than no guard
       at all. A target can never leave a family worse than its floor. */
    const RAY_STEP = 0.006; // one emittable step in OKLCH chroma, measured
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      const surface = brand.dark.get("--surface")!;
      for (const [famId, family] of Object.entries(preset.families)) {
        const { darkFloor, darkTarget, darkChromaRetention: retention } = family;
        if (darkFloor === undefined || darkTarget === undefined) continue;
        const main = `--${famId}`;
        const rendered = brand.dark.get(main)!;
        const actual = contrastRatio(rendered, surface);

        if (actual + 0.01 < darkFloor) {
          problems.push(`${id}|${main}: ${actual.toFixed(2)} is BELOW its floor ${darkFloor}`);
          continue;
        }
        if (actual + 0.05 >= darkTarget) continue; // reached parity

        if (retention === undefined) {
          problems.push(`${id}|${main}: ${actual.toFixed(2)} < target ${darkTarget} with no budget to explain it`);
          continue;
        }
        const atFloor = fitContrast(family.seed, [{ against: surface, min: darkFloor }], "lighten").hex;
        const budget = hexToOklch(atFloor).c * (1 - retention);
        const spent = hexToOklch(rendered).c;
        if (Math.abs(spent - budget) > RAY_STEP) {
          problems.push(
            `${id}|${main}: stopped at ${actual.toFixed(2)} with chroma ${spent.toFixed(4)}, ` +
              `but its budget is ${budget.toFixed(4)} — it did not stop ON the budget`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("darkFloor moves the DARK ramp only — light-scheme family slots are identical with the floors stripped", () => {
    /* `darkFloor` lifts a seed, and a seed feeds `buildRamp`. If the two schemes
       ever share one ramp again, light mode silently gets a washed-out brand on
       white — the same failure `lightShift: 2` produced when the incumbent's own
       answer was applied to a client hue. Compare against a floorless twin
       rather than a snapshot, so this keeps meaning something when a seed moves. */
    const problems: string[] = [];
    for (const [id, preset] of PRESET_ENTRIES) {
      const families = Object.fromEntries(
        Object.entries(preset.families).map(([famId, f]) => {
          /* The target and its budget come out too. Both are inert without a
             floor, but a twin that still carries half the machinery is not a
             control. */
          const { darkFloor: _f, darkTarget: _t, darkChromaRetention: _c, ...rest } = f;
          return [famId, rest];
        }),
      );
      const floorless = resolveBrand({ ...preset, families });
      const withFloors = resolveBrand(preset);
      for (const [token, hex] of withFloors.light) {
        /* Scheme-invariant tokens legitimately differ: they pin `from: "dark"`,
           so a lifted dark ramp reaches them in BOTH schemes by design.

           DERIVED from the floorless twin, not a name pattern. The old
           `token.includes("-fill")` also exempted `--brand-fill-end`,
           `--amber-fill`, every `*-fill-ink` — nine tokens — so a lift leaking
           into any of them read as expected behaviour, and any future token
           merely NAMED `*-fill` would inherit the exemption without anyone
           deciding it should. Asking the twin "is this token scheme-invariant
           before any floor exists?" is the actual property the exemption means,
           and it stays correct when the fill set changes. */
        if (floorless.light.get(token) === floorless.dark.get(token)) continue;
        if (floorless.light.get(token) !== hex) {
          problems.push(`${id}|light ${token}: floorless ${floorless.light.get(token)} !== ${hex}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  /* Was three entries — meridian/solstice/beacon dark, all ~0.058. Every one of
     them was the collapse: `--mint` searched to index 0 and `darkFollow` dragged
     `--mint-dark` up behind it until the pair nearly converged. With the dark
     ramp built from a lifted seed the search no longer advances, the pair sits
     at its designed spacing, and a ledger entry that now passes fails this
     check in the other direction. */
  const DELTA_L_SHORTFALLS: ReadonlyArray<{ key: string; measured: number }> = [];

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
