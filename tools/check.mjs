// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(sourceRoot, ".");

function collect(directory, suffix) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...collect(absolute, suffix));
    else if (entry.name.endsWith(suffix)) result.push(absolute);
  }
  return result.sort();
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: sourceRoot, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

JSON.parse(fs.readFileSync(path.join(moduleRoot, "module.json"), "utf8"));
JSON.parse(fs.readFileSync(path.join(moduleRoot, "lang/de.json"), "utf8"));
JSON.parse(fs.readFileSync(path.join(moduleRoot, "lang/en.json"), "utf8"));

for (const file of collect(moduleRoot, ".mjs")) run(process.execPath, ["--check", file]);
run(process.execPath, ["--test", ...collect(path.join(sourceRoot, "tests"), ".test.mjs")]);

console.log("Runyth Garb & Grime validation completed successfully.");
