import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(sourceRoot, "garb-and-grime");
const read = (relativePath) => fs.readFileSync(path.join(moduleRoot, relativePath), "utf8");

function setupFolders() {
  const root = { id: "pc", name: "Player Characters", type: "Actor", folder: null };
  const child = { id: "party-a", name: "Party A", type: "Actor", folder: "pc" };
  const npc = { id: "npcs", name: "NPCs", type: "Actor", folder: null };
  const folders = [root, child, npc];
  globalThis.game = {
    folders: Object.assign(folders, { get: (id) => folders.find((entry) => entry.id === id) }),
    i18n: { localize: (key) => key }
  };
  return folders;
}

test("dashboard Actor folder scope includes descendants only when requested", async () => {
  const folders = setupFolders();
  const scopeModule = await import(`../garb-and-grime/src/actor-scope.mjs?folders=${Date.now()}`);
  const options = scopeModule.buildActorFolderOptions({ folders });
  const actors = {
    parent: { name: "Alice", type: "character", folder: "pc" },
    child: { name: "Borin", type: "character", folder: "party-a" },
    npc: { name: "Guard", type: "npc", folder: "npcs" },
    root: { name: "Loose", type: "character", folder: null }
  };

  const exact = scopeModule.buildDashboardActorScope({ dashboardActorFolderIds: ["pc"], dashboardActorIncludeSubfolders: false }, options);
  assert.equal(exact.matches(actors.parent), true);
  assert.equal(exact.matches(actors.child), false);
  assert.equal(exact.matches(actors.npc), false);

  const recursive = scopeModule.buildDashboardActorScope({ dashboardActorFolderIds: ["pc"], dashboardActorIncludeSubfolders: true }, options);
  assert.equal(recursive.matches(actors.parent), true);
  assert.equal(recursive.matches(actors.child), true);
  assert.equal(recursive.matches(actors.npc), false);
  assert.equal(recursive.matches(actors.root), false);
});

test("dashboard Actor regex matches names, types, and full folder paths", async () => {
  const folders = setupFolders();
  const scopeModule = await import(`../garb-and-grime/src/actor-scope.mjs?regex=${Date.now()}`);
  const options = scopeModule.buildActorFolderOptions({ folders });

  const byName = scopeModule.buildDashboardActorScope({ dashboardActorRegex: "^alice" }, options);
  assert.equal(byName.matches({ name: "Alice Stone", type: "character", folder: "pc" }), true);
  assert.equal(byName.matches({ name: "Borin", type: "character", folder: "party-a" }), false);

  const byPath = scopeModule.buildDashboardActorScope({ dashboardActorRegex: "player characters\\s*/\\s*party a" }, options);
  assert.equal(byPath.matches({ name: "Borin", type: "character", folder: "party-a" }), true);

  const byType = scopeModule.buildDashboardActorScope({ dashboardActorRegex: "npc" }, options);
  assert.equal(byType.matches({ name: "Guard", type: "npc", folder: "npcs" }), true);
});

test("empty or stale folder scope remains safely nonrestrictive", async () => {
  const folders = setupFolders();
  const scopeModule = await import(`../garb-and-grime/src/actor-scope.mjs?stale=${Date.now()}`);
  const options = scopeModule.buildActorFolderOptions({ folders });
  const actor = { name: "Alice", type: "character", folder: "pc" };

  assert.equal(scopeModule.buildDashboardActorScope({}, options).matches(actor), true);
  const stale = scopeModule.buildDashboardActorScope({ dashboardActorFolderIds: ["deleted-folder"] }, options);
  assert.equal(stale.active, false);
  assert.equal(stale.matches(actor), true);
});

test("invalid global regex is detectable and does not crash Actor scope", async () => {
  const folders = setupFolders();
  const scopeModule = await import(`../garb-and-grime/src/actor-scope.mjs?invalid=${Date.now()}`);
  const options = scopeModule.buildActorFolderOptions({ folders });
  const compiled = scopeModule.compileActorScopeRegex("[");
  assert.ok(compiled.error);
  const scope = scopeModule.buildDashboardActorScope({ dashboardActorRegex: "[" }, options);
  assert.ok(scope.regexError);
  assert.equal(scope.matches({ name: "Alice", type: "character", folder: "pc" }), true);
});

test("global scope is applied before expensive Actor directory indexing", () => {
  const manager = read("src/apps/manager.mjs");
  const settingsHub = read("src/apps/settings-hub.mjs");
  const template = read("templates/settings-hub.hbs");
  const defaults = read("src/defaults.mjs");

  assert.match(manager, /const actorScope = needsActors \? buildDashboardActorScope/);
  assert.match(manager, /playerLinkedCharacterActorIds/);
  assert.match(manager, /const actors = actorScope\?\.active/);
  assert.ok(manager.indexOf("actorScope.matches(actor)") < manager.indexOf("actors.map((actor) =>"), "scope must run before Actor index construction");
  assert.match(settingsHub, /compileActorScopeRegex/);
  assert.match(settingsHub, /data-gag-actor-scope-folder/);
  assert.match(template, /data-gag-actor-scope-folder-search/);
  assert.match(template, /selectVisibleActorScopeFolders/);
  assert.match(defaults, /dashboardActorRegex:\s*""/);
  assert.match(defaults, /dashboardActorFolderIds:\s*\[\]/);
  assert.match(defaults, /dashboardActorIncludeSubfolders:\s*true/);
});


test("player-linked character Actors bypass a restrictive manual dashboard scope", async () => {
  const folders = setupFolders();
  const scopeModule = await import(`../garb-and-grime/src/actor-scope.mjs?player-links=${Date.now()}`);
  const options = scopeModule.buildActorFolderOptions({ folders });

  const actors = Array.from({ length: 6 }, (_, index) => ({
    id: `pc-${index + 1}`,
    uuid: `Actor.pc-${index + 1}`,
    name: `PC ${index + 1}`,
    type: "character",
    folder: index < 5 ? "pc" : "npcs",
    testUserPermission(user, level) {
      return level === "OWNER" && this.ownerIds?.has(user.id);
    },
    ownerIds: new Set()
  }));
  const users = actors.slice(0, 5).map((actor, index) => ({
    id: `player-${index + 1}`,
    isGM: false,
    character: actor.id
  }));

  const restrictive = scopeModule.buildDashboardActorScope({
    dashboardActorFolderIds: ["pc"],
    dashboardActorIncludeSubfolders: true
  }, options);
  const firstLinks = scopeModule.playerLinkedCharacterActorIds({ actors, users });
  const firstVisible = actors.filter((actor) => restrictive.matches(actor) || firstLinks.has(actor.id));
  assert.equal(firstVisible.length, 5, "the unassigned sixth Actor begins outside the manual scope");

  users.push({ id: "player-6", isGM: false, character: actors[5].id });
  const afterAssignment = scopeModule.playerLinkedCharacterActorIds({ actors, users });
  const expandedVisible = actors.filter((actor) => restrictive.matches(actor) || afterAssignment.has(actor.id));
  assert.equal(expandedVisible.length, 6, "adding a sixth player/default character must expand the dashboard immediately");
  assert.equal(afterAssignment.has(actors[5].id), true);

  users[5].character = null;
  actors[5].ownerIds.add(users[0].id);
  const afterSharedOwnership = scopeModule.playerLinkedCharacterActorIds({ actors, users });
  assert.equal(afterSharedOwnership.has(actors[5].id), true, "OWNER assignment to an existing player must also identify a character as player-linked");
});

test("user-character changes invalidate the open dashboard eligibility cache", () => {
  const main = read("scripts/main.mjs");
  assert.match(main, /Hooks\.on\("createUser"/);
  assert.match(main, /Hooks\.on\("updateUser"/);
  assert.match(main, /Hooks\.on\("deleteUser"/);
  assert.match(main, /\["character", "role"\]/);
  assert.match(main, /refreshManager\(\{ invalidateActors: true \}\)/);
});
