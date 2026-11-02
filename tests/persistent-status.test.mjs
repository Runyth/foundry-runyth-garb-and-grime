// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, "..");
const read = (name) => fs.readFileSync(path.join(moduleRoot, name), "utf8");

async function runLegacyMigration({ audience, permissionMinimum }) {
  const values = new Map([
    ["runyth-garb-and-grime.tokenLabelsVersion", 0],
    ["runyth-garb-and-grime.configuration", { tokenLabels: { enabled: true, audience } }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: permissionMinimum == null ? {} : { viewTokenLabels: permissionMinimum }, userOverrides: {} }]
  ]);
  globalThis.game = {
    user: { isGM: true },
    settings: {
      get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    }
  };
  const { migrateTokenLabelSettings } = await import(`../src/migration.mjs?token-label-migration=${audience}-${Date.now()}-${Math.random()}`);
  const result = await migrateTokenLabelSettings();
  return { values, result };
}

test("token-label migration preserves legacy audience while new GM-only worlds deny players by default", async () => {
  const gmOnly = await runLegacyMigration({ audience: "gm" });
  const gmConfig = gmOnly.values.get("runyth-garb-and-grime.configuration");
  const gmPermissions = gmOnly.values.get("runyth-garb-and-grime.permissions");
  assert.equal(gmConfig.tokenLabels.visibilityMode, "manual");
  assert.equal(gmConfig.tokenLabels.playerScope, "characters");
  assert.equal(gmConfig.tokenLabels.actorScope, "supported");
  assert.equal(gmPermissions.roleMinimums.viewTokenLabels, 5);
  assert.equal(gmOnly.values.get("runyth-garb-and-grime.tokenLabelsVersion"), 3);

  const everyone = await runLegacyMigration({ audience: "everyone" });
  assert.equal(everyone.values.get("runyth-garb-and-grime.configuration").tokenLabels.playerScope, "all");
  assert.equal(everyone.values.get("runyth-garb-and-grime.permissions").roleMinimums.viewTokenLabels, 1, "legacy player visibility is preserved");
});

test("persistent status settings use the authoritative Permissions tab and Foundry-like display behaviours", () => {
  const defaults = read("src/defaults.mjs");
  const constants = read("src/constants.mjs");
  const labels = read("src/integrations/token-labels.mjs");
  const settings = read("src/apps/settings-hub.mjs");
  const template = read("templates/settings-hub.hbs");

  assert.match(constants, /VIEW_TOKEN_LABELS:\s*"viewTokenLabels"/);
  assert.match(defaults, /\[PERMISSIONS\.VIEW_TOKEN_LABELS\]:\s*5/);
  assert.match(defaults, /visibilityMode:\s*"manual"/);
  assert.match(defaults, /playerScope:\s*"characters"/);
  assert.match(labels, /"always",\s*"controlled",\s*"hovered",\s*"controlled-or-hovered"/);
  assert.match(labels, /hasPermission\(PERMISSIONS\.VIEW_TOKEN_LABELS/);
  assert.match(labels, /Hooks\.on\("hoverToken"/);
  assert.match(labels, /Hooks\.on\("controlToken"/);
  assert.doesNotMatch(settings, /saveTokenLabelViewerOverrides/);
  assert.match(constants, /TOKEN_LABEL_VIEW_MODE:\s*"tokenLabelViewerMode"/);
  assert.match(constants, /TOKEN_LABEL_VIEW_POSITION:\s*"tokenLabelViewerPosition"/);
  assert.match(settings, /effectsChanged/);
  assert.doesNotMatch(template, /tokenLabelViewer/);
  assert.match(template, /data-permissions-form/);
  assert.match(template, /tokenLabels\.playerScope/);
  assert.match(template, /tokenLabels\.visibilityMode/);
  assert.doesNotMatch(template, /value="disabled"[^>]*configuration\.tokenLabels\.playerScope/);
  const sceneControls = read("src/integrations/scene-controls.mjs");
  assert.match(sceneControls, /garb-and-grime-token-label-preferences/);
  assert.match(sceneControls, /canUseViewerControls/);
});

test("token-label migration removes legacy disabled player scope so Permissions remains authoritative", async () => {
  const values = new Map([
    ["runyth-garb-and-grime.tokenLabelsVersion", 1],
    ["runyth-garb-and-grime.configuration", { tokenLabels: { enabled: true, visibilityMode: "manual", actorScope: "supported", playerScope: "disabled" } }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: { viewTokenLabels: 1 }, userOverrides: {} }]
  ]);
  globalThis.game = {
    user: { isGM: true },
    settings: {
      get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    }
  };
  const { migrateTokenLabelSettings } = await import(`../src/migration.mjs?token-label-scope-migration=${Date.now()}-${Math.random()}`);
  const result = await migrateTokenLabelSettings();
  assert.equal(result.changed, true);
  assert.equal(values.get("runyth-garb-and-grime.configuration").tokenLabels.playerScope, "characters");
  assert.equal(values.get("runyth-garb-and-grime.permissions").roleMinimums.viewTokenLabels, 1, "existing permission grant remains authoritative");
  assert.equal(values.get("runyth-garb-and-grime.tokenLabelsVersion"), 3);
});


test("token-label v3 migration compacts only the untouched legacy visual defaults", async () => {
  const oldDefaults = {
    enabled: true,
    visibilityMode: "manual",
    actorScope: "supported",
    playerScope: "characters",
    fontSize: 22,
    offset: 10,
    fontColor: "#ffffff",
    backgroundColor: "#111318",
    backgroundOpacity: 0.92,
    paddingX: 8,
    paddingY: 4
  };
  const values = new Map([
    ["runyth-garb-and-grime.tokenLabelsVersion", 2],
    ["runyth-garb-and-grime.configuration", { tokenLabels: structuredClone(oldDefaults) }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: { viewTokenLabels: 5 }, userOverrides: {} }]
  ]);
  globalThis.game = {
    user: { isGM: true },
    settings: {
      get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    }
  };
  const migration = await import(`../src/migration.mjs?token-label-v3=${Date.now()}-${Math.random()}`);
  const result = await migration.migrateTokenLabelSettings();
  const labels = values.get("runyth-garb-and-grime.configuration").tokenLabels;
  assert.equal(result.changed, true);
  assert.equal(labels.fontSize, 18);
  assert.equal(labels.offset, 8);
  assert.equal(labels.paddingX, 6);
  assert.equal(labels.paddingY, 3);
  assert.equal(values.get("runyth-garb-and-grime.tokenLabelsVersion"), 3);

  values.set("runyth-garb-and-grime.tokenLabelsVersion", 2);
  values.set("runyth-garb-and-grime.configuration", { tokenLabels: { ...structuredClone(oldDefaults), fontSize: 15, paddingX: 5 } });
  const customMigration = await import(`../src/migration.mjs?token-label-v3-custom=${Date.now()}-${Math.random()}`);
  await customMigration.migrateTokenLabelSettings();
  const custom = values.get("runyth-garb-and-grime.configuration").tokenLabels;
  assert.equal(custom.fontSize, 15, "custom font size is preserved");
  assert.equal(custom.paddingX, 5, "custom padding is preserved");
});
