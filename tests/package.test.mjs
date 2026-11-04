// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const manifest = JSON.parse(read("module.json"));

function flatten(value, prefix = "", target = {}) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, target);
    else target[full] = child;
  }
  return target;
}

test("manifest declares the stable identity and compatibility", () => {
  assert.equal(manifest.id, "runyth-garb-and-grime");
  assert.equal(manifest.version, "1.3.4");
  assert.equal(manifest.compatibility.minimum, "13");
  assert.equal(manifest.relationships.systems[0].id, "dnd5e");
  assert.deepEqual(manifest.esmodules, ["scripts/main.mjs"]);
  assert.equal(manifest.socket, true, "player transactions require the package-specific module socket namespace");
});

test("every manifest path exists", () => {
  const references = [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map((entry) => entry.path), manifest.license];
  for (const reference of references) assert.equal(fs.existsSync(path.join(root, reference)), true, reference);
});

test("German and English localization keys match", () => {
  const de = flatten(JSON.parse(read("lang/de.json")));
  const en = flatten(JSON.parse(read("lang/en.json")));
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("all literal module localization references exist", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(mjs|hbs)$/.test(entry.name)) files.push(absolute);
    }
  };
  for (const part of ["src", "scripts", "styles", "templates", "lang"]) walk(path.join(root, part));
  const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const references = [...text.matchAll(/["'](GAG\.[A-Za-z0-9_.-]+)["']/g)].map((match) => match[1]);
  const de = flatten(JSON.parse(read("lang/de.json")));
  const en = flatten(JSON.parse(read("lang/en.json")));
  for (const key of references.filter((entry) => !entry.endsWith("."))) {
    assert.ok(de[key], `Missing de key ${key}`);
    assert.ok(en[key], `Missing en key ${key}`);
  }
});

test("the exact German read-aloud rules are bundled", () => {
  const de = JSON.parse(read("lang/de.json")).GAG.Rules;
  assert.equal(de.Title1, "Saubere Kleidung macht einen Unterschied");
  assert.match(de.Text1, /Schlamm an den Stiefeln/);
  assert.equal(de.Title2, "Kleidung waschen");
  assert.match(de.Text2, /Ein Bett allein macht weder euch noch eure Kleidung sauber/);
  assert.equal(de.Title3, "Wo Schmutz besonders zählt");
  assert.match(de.Text3, /Tiere und manche Monster/);
});

test("requested public API surface and permanent launchers are present", () => {
  const main = read("scripts/main.mjs");
  for (const name of [
    "getState", "setDirtLevel", "adjustDirt", "setBodyCleanliness", "setClothingCleanliness",
    "applyContamination", "removeContamination", "cleanActor", "registerCleaningMethod",
    "registerContamination", "registerEnvironmentProfile", "registerItemIntegration",
    "registerCurrencyAdapter", "getSceneContext", "setSceneContext", "getSceneLevelRatings", "setSceneLevelRatings", "evaluateRollContext",
    "openManager", "openActorPanel", "openSceneGuide", "toggleSceneGuide", "setTokenLabelMode", "setSelectedTokenLabelMode",
    "setTokenLabelPosition", "setSelectedTokenLabelPosition", "toggleTokenLabels", "setTokenLabelsVisible", "refreshTokenLabels", "getVersion"
  ]) assert.match(main, new RegExp(`\\b${name}\\b`), name);
  const settings = read("src/settings.mjs");
  const sidebar = read("src/integrations/sidebar.mjs");
  const tokenHud = read("src/integrations/token-hud.mjs");
  const actorSheets = read("src/integrations/actor-sheets.mjs");
  assert.match(settings, /registerMenu[\s\S]*openManager/);
  assert.match(settings, /registerMenu[\s\S]*configurationHub/);
  assert.match(sidebar, /renderActorDirectory/);
  assert.match(sidebar, /renderSettings/);
  assert.match(sidebar, /data-gag-settings-sidebar-launcher/);
  assert.match(read("src/integrations/scene-controls.mjs"), /getSceneControlButtons/);
  assert.match(tokenHud, /renderTokenHUD/);
  assert.doesNotMatch(tokenHud, /renderApplicationV2/);
  assert.match(actorSheets, /renderActorSheetV2/);
  assert.match(actorSheets, /tidy5e-sheet\.renderActorSheet/);
  assert.match(actorSheets, /data-tidy-sheet-part=\"actor-name\"/);
  assert.match(actorSheets, /data-tidy-sheet-part=\"name-container\"/);
  assert.doesNotMatch(actorSheets, /getHeaderControlsApplicationV2/);
  assert.doesNotMatch(actorSheets, /getApplicationV1HeaderButtons/);
  assert.doesNotMatch(actorSheets, /renderApplicationV[12]/);
});

test("bootstrap waits for Foundry init before accessing the module record", () => {
  const main = read("scripts/main.mjs");
  const initIndex = main.indexOf('Hooks.once("init"');
  const moduleAccessIndex = main.indexOf("game?.modules?.get(MODULE_ID)");
  assert.ok(initIndex >= 0);
  assert.ok(moduleAccessIndex > initIndex, "module API exposure must happen inside or after the init hook");
  assert.match(main, /initialize\("GAG\.Initialization\.Areas\.Settings"/);
  assert.match(main, /initialize\("GAG\.Initialization\.Areas\.ActorSheets"/);
  assert.match(main, /initialize\("GAG\.Initialization\.Areas\.TokenHud"/);
  assert.match(main, /PartialInitialization/);
});

test("all module-relative assets and templates referenced in source exist", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(mjs|hbs|css|json)$/.test(entry.name)) files.push(absolute);
    }
  };
  for (const part of ["src", "scripts", "styles", "templates", "lang"]) walk(path.join(root, part));
  const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const match of text.matchAll(/(?:modules\/runyth-garb-and-grime\/)?(assets\/[A-Za-z0-9_./-]+|templates\/[A-Za-z0-9_./-]+)/g)) {
    assert.equal(fs.existsSync(path.join(root, match[1])), true, match[1]);
  }
});

test("source avoids legacy Application/socket dependencies and uses only the Foundry module socket", () => {
  const source = fs.readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"))
    .join("\n") + read("scripts/main.mjs");
  for (const prohibited of ["extends Application ", "libWrapper", "socketlib", "renderTemplate("]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
  assert.match(read("src/apps/persistent-app.mjs"), /ApplicationV2/);
  const actions = read("src/action-service.mjs");
  assert.match(actions, /game\.socket\.emit\(SOCKET_NAME/);
  assert.match(actions, /game\.socket\.on\(SOCKET_NAME/);
});

test("ApplicationV2 tab controls use the module action rather than the reserved core action", () => {
  const managerSource = read("src/apps/manager.mjs");
  const settingsSource = read("src/apps/settings-hub.mjs");
  const managerTemplate = read("templates/manager.hbs");
  const settingsTemplate = read("templates/settings-hub.hbs");

  for (const source of [managerSource, settingsSource]) {
    assert.match(source, /switchTab:\s*[A-Za-z]+\.onSwitchTab/);
    assert.doesNotMatch(source, /\btab:\s*[A-Za-z]+\.onTab/);
  }
  for (const template of [managerTemplate, settingsTemplate]) {
    assert.match(template, /data-action="switchTab"/);
    assert.doesNotMatch(template, /data-action="tab"/);
  }
});



test("sheet and accessibility CSS is scoped to Runyth Garb & Grime-owned elements", () => {
  const css = read("styles/runyth-garb-and-grime.css");
  assert.match(css, /\.gag-sheet-header > \.window-controls/);
  assert.match(css, /\.garb-and-grime \.sr-only/);
  assert.doesNotMatch(css, /(^|\n)\.window-header > \.window-controls/);
  assert.doesNotMatch(css, /(^|\n)\.sr-only\s*\{/);
});

test("generic ApplicationV2 render fallbacks cannot augment document dialogs", () => {
  const actorSheets = read("src/integrations/actor-sheets.mjs");
  const items = read("src/integrations/items.mjs");
  const sidebar = read("src/integrations/sidebar.mjs");
  const tokenHud = read("src/integrations/token-hud.mjs");
  for (const source of [actorSheets, items, sidebar, tokenHud]) {
    assert.doesNotMatch(source, /Hooks\.on\(\"renderApplicationV2\"/);
    assert.doesNotMatch(source, /Hooks\.on\(\"renderApplicationV1\"/);
  }
});

test("token cleanliness labels use public canvas text, configurable controls, and no nameplate mutation", () => {
  const labels = read("src/integrations/token-labels.mjs");
  const controls = read("src/integrations/scene-controls.mjs");
  const hud = read("src/integrations/token-hud.mjs");
  const settings = read("templates/settings-hub.hbs");
  const defaults = read("src/defaults.mjs");

  assert.match(labels, /foundry\.canvas\.containers\.PreciseText/);
  assert.match(labels, /game\.keybindings\.register/);
  assert.match(labels, /toggleTokenCleanlinessLabels/);
  assert.match(labels, /Hooks\.on\("drawToken"/);
  assert.match(labels, /Hooks\.on\("updateActor"/);
  assert.match(labels, /Symbol\.for/);
  assert.match(labels, /canvas\?\.interface/);
  assert.match(labels, /backgroundOpacity/);
  assert.match(labels, /TOKEN_LABEL_POSITIONS/);
  assert.doesNotMatch(labels, /nameplate\.(text|visible)\s*=/);
  assert.doesNotMatch(labels, /html\.find\s*\(|(?:^|[^A-Za-z0-9_$])\$\s*\(/m);
  assert.match(controls, /garb-and-grime-token-labels/);
  assert.match(controls, /garb-and-grime-selected-labels/);
  assert.match(controls, /garb-and-grime-selected-label-position/);
  assert.match(hud, /data-action="token-label"/);
  assert.match(hud, /data-action="token-label-position"/);
  assert.match(settings, /tokenLabels\.visibilityMode/);
  assert.match(settings, /tokenLabels\.playerScope/);
  assert.doesNotMatch(settings, /tokenLabelViewer\./);
  assert.match(settings, /tokenLabels\.position/);
  assert.match(settings, /tokenLabels\.format/);
  assert.match(settings, /tokenLabels\.fontColor/);
  assert.match(settings, /tokenLabels\.backgroundColor/);
  assert.match(settings, /tokenLabels\.backgroundOpacity/);
  assert.match(defaults, /tokenLabels:\s*\{[\s\S]*enabled:\s*true[\s\S]*visibilityMode:\s*"manual"[\s\S]*playerScope:\s*"characters"/);
});

test("scoped label shortcut is exposed in Sheets & HUD and uses native editable Foundry binding", () => {
  const defaults = read("src/defaults.mjs");
  const labels = read("src/integrations/token-labels.mjs");
  const settingsTemplate = read("templates/settings-hub.hbs");
  assert.match(defaults, /shortcutEnabled:\s*true/);
  assert.match(defaults, /shortcutScope:\s*"scene-pcs"/);
  for (const id of ["scene-pcs", "selected-pcs", "scene-eligible", "selected-eligible"]) {
    assert.match(labels, new RegExp(`"${id}"`));
    assert.ok(settingsTemplate.includes(`value="${id}"`));
  }
  assert.match(settingsTemplate, /name="tokenLabels\.shortcutEnabled"/);
  assert.match(settingsTemplate, /name="tokenLabels\.shortcutScope"/);
  assert.match(labels, /game\.keybindings\.register\(MODULE_ID, "toggleTokenCleanlinessLabels"/);
  assert.match(labels, /editable:\s*\[\{ key: "KeyG", modifiers: \["SHIFT", "ALT"\] \}\]/);
  assert.doesNotMatch(labels, /document\.addEventListener\("keydown"/);
});
