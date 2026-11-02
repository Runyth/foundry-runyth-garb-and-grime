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

test("bulk token and actor adjustment entry points are present", () => {
  const manager = read("src/apps/manager.mjs");
  const template = read("templates/manager.hbs");
  const scene = read("src/integrations/scene-controls.mjs");
  const sidebar = read("src/integrations/sidebar.mjs");
  assert.match(template, /data-bulk-action="adjust" data-amount="1"/);
  assert.match(template, /data-bulk-action="adjust" data-amount="-1"/);
  assert.match(template, /data-gag-select-actor/);
  assert.match(template, /data-action="bulkActorAdjust" data-amount="1"/);
  assert.match(template, /data-action="bulkActorAdjust" data-amount="-1"/);
  assert.match(manager, /onBulkActorAdjust/);
  assert.match(scene, /action: "decrease"/);
  assert.match(sidebar, /data-gag-directory-adjust="1"/);
  assert.match(sidebar, /data-gag-directory-adjust="-1"/);
});

test("sheet status is inserted before Foundry core window controls", () => {
  const sheets = read("src/integrations/actor-sheets.mjs");
  const css = read("styles/runyth-garb-and-grime.css");
  assert.match(sheets, /insertBeforeWindowControls\(header, button\)/);
  assert.match(sheets, /\[data-action='toggleControls'\]/);
  assert.match(sheets, /\[data-action='close'\]/);
  assert.doesNotMatch(sheets, /root\.querySelector\(\"\.window-content\"\)/);
  assert.match(css, /Keep the cleanliness status left of Foundry's ellipsis and close controls/);
  assert.match(css, /\.gag-sheet-header > \.window-controls/);
});
