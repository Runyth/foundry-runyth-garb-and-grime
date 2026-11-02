import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../garb-and-grime");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function flatten(value, prefix = "", target = {}) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, target);
    else target[full] = child;
  }
  return target;
}

test("module localization uses Foundry package languages without a competing override", () => {
  const manifest = JSON.parse(read("module.json"));
  assert.deepEqual(manifest.languages.map(({ lang, path }) => ({ lang, path })), [
    { lang: "de", path: "lang/de.json" },
    { lang: "en", path: "lang/en.json" }
  ]);
  const production = collectProductionSource();
  assert.doesNotMatch(production, /game\.i18n\.setLanguage\s*\(/);
  assert.doesNotMatch(production, /register\([^\n]*language/i);
  assert.doesNotMatch(read("src/defaults.mjs"), /\blanguage\s*:/i);
});

test("global module settings explain the active Foundry language", () => {
  const source = read("src/apps/settings-hub.mjs");
  const template = read("templates/settings-hub.hbs");
  assert.match(source, /getLocalizationStatus/);
  assert.match(template, /GAG\.SettingsHub\.General\.LocalizationTitle/);
  assert.match(template, /localization\.currentName/);
  assert.match(template, /localization\.availableLanguages/);
  assert.doesNotMatch(template, /<select[^>]+language/i);
});

test("built-in display definitions use localization keys", () => {
  const defaults = read("src/defaults.mjs");
  assert.doesNotMatch(defaults, /DEFAULT_CLEANING_METHODS[\s\S]*?\bname:\s*["']/);
  assert.doesNotMatch(defaults, /DEFAULT_CONTAMINATIONS[\s\S]*?\bname:\s*["']/);
  assert.match(defaults, /nameKey:\s*"GAG\.Methods\./);
  assert.match(defaults, /nameKey:\s*"GAG\.Contamination\./);
  assert.match(defaults, /nameKey:\s*"GAG\.Profiles\./);
});

test("runtime validation and registry errors are localized", async () => {
  globalThis.game = {
    i18n: {
      format(key, data = {}) { return `DE:${key}:${JSON.stringify(data)}`; },
      localize(key) { return `DE:${key}`; }
    }
  };
  const { validateMethod } = await import(`../garb-and-grime/src/domain/validation.mjs?localization=${Date.now()}`);
  assert.throws(() => validateMethod(null), /DE:GAG\.Validation\.MethodObject/);

  const validation = read("src/domain/validation.mjs");
  const registry = read("src/registry.mjs");
  assert.doesNotMatch(validation, /Cleaning method must|Contamination must|Environment profile must|Item integration must/);
  assert.doesNotMatch(registry, /Currency adapter must|already registered\./);
  assert.match(validation, /localizedError/);
  assert.match(registry, /localizedError/);
});

test("all bundled localization values are non-empty and key-compatible", () => {
  const de = flatten(JSON.parse(read("lang/de.json")));
  const en = flatten(JSON.parse(read("lang/en.json")));
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(de)) assert.ok(String(value).trim(), `Empty German value: ${key}`);
  for (const [key, value] of Object.entries(en)) assert.ok(String(value).trim(), `Empty English value: ${key}`);
});

function collectProductionSource() {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(mjs|hbs)$/.test(entry.name)) files.push(absolute);
    }
  };
  walk(root);
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}
