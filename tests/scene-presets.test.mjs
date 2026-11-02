import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_ENVIRONMENT_PROFILES } from "../garb-and-grime/src/defaults.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, "../garb-and-grime");
const read = (name) => fs.readFileSync(path.join(moduleRoot, name), "utf8");

const expectedRatings = {
  clean: ["expected", "accepted", "disliked", "hated"],
  ordinary: ["accepted", "expected", "tolerated", "disliked"],
  "poor-lawless": ["hated", "tolerated", "expected", "accepted"],
  wilderness: ["disliked", "accepted", "expected", "tolerated"],
  military: ["accepted", "expected", "accepted", "disliked"],
  religious: ["expected", "tolerated", "disliked", "hated"],
  court: ["expected", "disliked", "hated", "hated"],
  sewer: ["hated", "disliked", "accepted", "expected"],
  swamp: ["disliked", "tolerated", "expected", "accepted"],
  battlefield: ["hated", "disliked", "tolerated", "expected"]
};

test("every bundled Scene preset has an explicit, distinct four-level acceptance gradient", () => {
  const actual = Object.fromEntries(DEFAULT_ENVIRONMENT_PROFILES.map((profile) => [profile.id, profile.levelRatings]));
  assert.deepEqual(actual, expectedRatings);
  assert.equal(new Set(Object.values(actual).map(JSON.stringify)).size, DEFAULT_ENVIRONMENT_PROFILES.length);
});

test("settings UI never defaults a missing preset rating to Expected for all four levels", () => {
  const source = read("src/apps/settings-hub.mjs");
  const template = read("templates/settings-hub.hbs");
  assert.match(source, /ratingsForProfileEditor/);
  assert.match(source, /DEFAULT_PROFILE_BY_ID/);
  assert.match(source, /deriveLevelRatings/);
  assert.doesNotMatch(source, /profile\.levelRatings\?\.\[level\]\s*\?\?\s*"expected"/);
  assert.match(source, /value\.levelRatingsSource\s*=\s*"custom"/);
  assert.match(template, /gag-profile-rating-preview/);
  assert.match(template, /GAG\.SettingsHub\.Contexts\.PresetPreview/);
});

test("profile-rating migration repairs legacy all-Expected and duplicated preset defaults without overwriting explicit custom ratings", async () => {
  const storedProfiles = [
    { id: "ordinary", name: "Ordinary", expected: { min: 0, max: 2 }, levelRatings: ["expected", "expected", "expected", "expected"] },
    { id: "swamp", name: "Swamp", expected: { min: 2, max: 3 }, levelRatings: ["hated", "disliked", "accepted", "expected"] },
    { id: "clean", name: "Custom clean", expected: { min: 0, max: 1 }, levelRatings: ["expected", "expected", "expected", "expected"], levelRatingsSource: "custom" },
    { id: "custom-market", name: "Market", expected: { min: 0, max: 3 }, levelRatings: ["expected", "expected", "expected", "expected"] }
  ];
  const values = new Map([
    ["garb-and-grime.profileRatingsVersion", 0],
    ["garb-and-grime.environmentProfiles", structuredClone(storedProfiles)]
  ]);
  globalThis.game = {
    user: { isGM: true },
    settings: {
      get: (moduleId, key) => values.get(`${moduleId}.${key}`),
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    }
  };
  globalThis.foundry = { utils: { deepClone: structuredClone } };

  const { migrateProfileRatings } = await import(`../garb-and-grime/src/migration.mjs?preset=${Date.now()}`);
  const result = await migrateProfileRatings();
  assert.deepEqual(result, { migrated: 2, changed: true });
  const migrated = values.get("garb-and-grime.environmentProfiles");
  assert.deepEqual(migrated[0].levelRatings, expectedRatings.ordinary);
  assert.equal(migrated[0].levelRatingsSource, "preset");
  assert.deepEqual(migrated[1].levelRatings, expectedRatings.swamp);
  assert.equal(migrated[1].levelRatingsSource, "preset");
  assert.deepEqual(migrated[2].levelRatings, ["expected", "expected", "expected", "expected"]);
  assert.equal(migrated[2].levelRatingsSource, "custom");
  assert.deepEqual(migrated[3].levelRatings, ["expected", "expected", "expected", "expected"]);
  assert.equal(values.get("garb-and-grime.profileRatingsVersion"), 1);
});

test("registry supplies canonical bundled ratings when an older built-in profile lacks levelRatings", async () => {
  const { DefinitionRegistry } = await import(`../garb-and-grime/src/registry.mjs?preset-registry=${Date.now()}`);
  const registry = new DefinitionRegistry();
  registry.replaceWorldDefinitions({
    profiles: [{ id: "ordinary", name: "Ordinary", expected: { min: 0, max: 2 } }]
  });
  assert.deepEqual(registry.getEnvironmentProfile("ordinary").levelRatings, expectedRatings.ordinary);
});
