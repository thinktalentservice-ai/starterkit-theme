/* schema.json regression test.
 *
 * This does NOT run schema.json through a JSON Schema validator — this package
 * has no such dependency in node_modules (checked package.json / the lockfile)
 * and adding one (e.g. ajv) is not justified by two structural assertions. What
 * IS asserted, and the one thing in schema.json that can silently go stale, is
 * that its `preset` enum stays in sync with the real PRESET_IDS array: a static
 * JSON file has no way to import a TypeScript const, so nothing but a test
 * catches the two drifting apart when a preset is added or removed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { PRESET_IDS } from "./presets/index";

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "schema.json");

describe("schema.json", () => {
  it("parses as JSON without throwing", () => {
    expect(() => JSON.parse(readFileSync(SCHEMA_PATH, "utf8"))).not.toThrow();
  });

  it("preset.enum matches PRESET_IDS exactly", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    expect(schema.properties.preset.enum).toEqual([...PRESET_IDS]);
  });
});
