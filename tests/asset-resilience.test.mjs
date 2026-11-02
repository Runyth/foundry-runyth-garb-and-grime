// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";

function installGame(moduleIds = []) {
  const modules = new Map(moduleIds.map((id) => [id, { id }]));
  globalThis.game = {
    modules,
    i18n: {
      format(key, data = {}) {
        const templates = {
          "GAG.Images.SuccessorAvailable": ` The successor module "${data.successor}" is installed, but Runyth Garb & Grime will not guess renamed file paths.`,
          "GAG.Images.UnavailableModuleWarning": `Actor portrait fallback: ${data.count} Actor(s) reference the unavailable module "${data.module}". Runyth Garb & Grime suppressed those image requests to prevent repeated HTTP 404s and used safe fallback artwork.${data.successor}`,
          "GAG.Images.LoadFailedWarning": "Actor portrait fallback: an image failed to load. Runyth Garb & Grime cached the failure for this browser session and will use safe fallback artwork on subsequent renders."
        };
        return templates[key] ?? key;
      }
    }
  };
}

test("dashboard suppresses actor portrait URLs owned by unavailable modules before HTML rendering", async () => {
  installGame(["runyth-garb-and-grime", "active-package"]);
  const images = await import(`../src/display-images.mjs?suppress=${Date.now()}`);

  const staleOnly = images.resolveActorDisplayImage({
    img: "modules/retired-package/assets/portraits/aveline.webp",
    prototypeToken: { texture: { src: "modules/retired-package/assets/tokens/aveline.webp" } }
  });
  assert.equal(staleOnly.src, "modules/runyth-garb-and-grime/assets/icons/actor-fallback.svg");
  assert.equal(staleOnly.fallback, true);
  assert.equal(staleOnly.issue.kind, "module-unavailable");
  assert.equal(staleOnly.issue.moduleId, "retired-package");
  assert.equal(staleOnly.issue.successorAvailable, false);

  const tokenFallback = images.resolveActorDisplayImage({
    img: "modules/retired-package/assets/portraits/beren.webp",
    prototypeToken: { texture: { src: "icons/svg/mystery-man.svg" } }
  });
  assert.equal(tokenFallback.src, "icons/svg/mystery-man.svg");
  assert.equal(tokenFallback.fallback, false);
  assert.equal(tokenFallback.issue.kind, "module-unavailable");

  const activeModule = images.resolveActorDisplayImage({ img: "modules/active-package/assets/portraits/example.webp" });
  assert.equal(activeModule.src, "modules/active-package/assets/portraits/example.webp");
  assert.equal(activeModule.fallback, false);
});

test("runtime image failures are cached and module diagnostics warn once instead of on every rerender", async () => {
  installGame(["runyth-garb-and-grime", "active-package"]);
  const images = await import(`../src/display-images.mjs?cache=${Date.now()}`);
  const source = "modules/active-package/assets/missing.webp";
  assert.equal(images.resolveActorDisplayImage({ img: source }).src, source);
  images.markActorImageFailed(source);
  assert.equal(images.resolveActorDisplayImage({ img: source }).src, "modules/runyth-garb-and-grime/assets/icons/actor-fallback.svg");

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const issue = { kind: "module-unavailable", source: "modules/retired-package/portrait.webp", moduleId: "retired-package", successorId: null, successorAvailable: false };
    const entries = [{ name: "One", issue }, { name: "Two", issue }];
    images.reportActorImageIssues(entries);
    images.reportActorImageIssues(entries);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /^\[runyth-garb-and-grime\]/);
  assert.match(String(warnings[0][0]), /2 Actor\(s\)/);
});

test("manager and actor panel never insert raw Actor document portrait paths directly", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const manager = fs.readFileSync(path.join(root, "src/apps/manager.mjs"), "utf8");
  const panel = fs.readFileSync(path.join(root, "src/apps/actor-panel.mjs"), "utf8");
  const managerTemplate = fs.readFileSync(path.join(root, "templates/manager.hbs"), "utf8");
  const panelTemplate = fs.readFileSync(path.join(root, "templates/actor-panel.hbs"), "utf8");

  assert.match(manager, /resolveActorDisplayImage\(row\.actor\)/);
  assert.match(panel, /resolveActorDisplayImage\(actor\)/);
  assert.doesNotMatch(manager, /img:\s*actor\.img/);
  assert.match(managerTemplate, /data-gag-actor-image/);
  assert.match(panelTemplate, /data-gag-actor-image/);
});
