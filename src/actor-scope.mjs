// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
function parentFolderId(folder) {
  return folder?.folder?.id ?? folder?.folder ?? folder?.parent?.id ?? folder?.parent ?? null;
}

function actorFolderId(actor) {
  return actor?.folder?.id ?? actor?.folder ?? null;
}

function userCharacterActorId(user) {
  const linked = user?.character;
  if (linked?.documentName === "Actor") return linked.id;
  if (typeof linked === "string") return linked;
  return user?._source?.character ?? null;
}

export function playerLinkedCharacterActorIds({ actors = game.actors ?? [], users = game.users ?? [] } = {}) {
  const actorList = [...actors];
  const playerUsers = [...users].filter((user) => user && !user.isGM);
  if (!playerUsers.length || !actorList.length) return new Set();

  const actorById = new Map(actorList.map((actor) => [actor.id, actor]));
  const linkedIds = new Set();

  // Foundry's User.character link is the strongest signal that an Actor is the
  // user's selected/default PC. The underlying source can be an Actor id while
  // the prepared client accessor may be the Actor document itself.
  for (const user of playerUsers) {
    const actor = actorById.get(userCharacterActorId(user));
    if (actor?.type === "character") linkedIds.add(actor.id);
  }

  // A PC may be shared or assigned through Actor ownership without becoming a
  // user's default character. Treat OWNER-level player access as an additional
  // authoritative player-character signal, but only for character Actors so
  // pets/NPCs do not bypass the GM's dashboard scope accidentally.
  for (const actor of actorList) {
    if (actor?.type !== "character" || linkedIds.has(actor.id)) continue;
    if (playerUsers.some((user) => actor.testUserPermission?.(user, "OWNER"))) linkedIds.add(actor.id);
  }

  return linkedIds;
}

export function buildActorFolderOptions({ folders = game.folders ?? [], includeRoot = true, rootLabel = null } = {}) {
  const actorFolders = [...folders].filter((folder) => folder?.type === "Actor");
  const byId = new Map(actorFolders.map((folder) => [folder.id, folder]));
  const options = actorFolders.map((folder) => {
    const ancestorIds = [];
    const names = [folder.name];
    let parentId = parentFolderId(folder);
    const seen = new Set([folder.id]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      ancestorIds.unshift(parentId);
      const parent = byId.get(parentId) ?? game.folders?.get?.(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parentFolderId(parent);
    }
    const label = names.join(" / ");
    return {
      id: folder.id,
      name: folder.name,
      label,
      searchText: label.toLocaleLowerCase(),
      depth: ancestorIds.length,
      ancestorIds
    };
  });
  options.sort((a, b) => a.label.localeCompare(b.label));
  if (includeRoot) {
    options.unshift({
      id: "root",
      name: rootLabel ?? game.i18n.localize("GAG.Manager.RootFolder"),
      label: rootLabel ?? game.i18n.localize("GAG.Manager.RootFolder"),
      searchText: (rootLabel ?? game.i18n.localize("GAG.Manager.RootFolder")).toLocaleLowerCase(),
      depth: 0,
      ancestorIds: []
    });
  }
  return options;
}

export function actorFolderPath(actor, folderOptions = null) {
  const folderId = actorFolderId(actor);
  if (!folderId) return game.i18n.localize("GAG.Manager.RootFolder");
  const match = folderOptions?.find?.((entry) => entry.id === folderId);
  if (match) return match.label;

  const names = [];
  let folder = actor?.folder?.documentName === "Folder" ? actor.folder : game.folders?.get?.(folderId);
  const seen = new Set();
  while (folder && !seen.has(folder.id)) {
    seen.add(folder.id);
    names.unshift(folder.name);
    const parentId = parentFolderId(folder);
    folder = parentId ? game.folders?.get?.(parentId) : null;
  }
  return names.join(" / ") || game.i18n.localize("GAG.Manager.RootFolder");
}

export function compileActorScopeRegex(pattern) {
  const source = String(pattern ?? "").trim();
  if (!source) return { source: "", regex: null, error: null };
  try {
    return { source, regex: new RegExp(source, "iu"), error: null };
  } catch (error) {
    return { source, regex: null, error };
  }
}

export function buildDashboardActorScope(general = {}, folderOptions = []) {
  const configuredFolderIds = Array.isArray(general.dashboardActorFolderIds)
    ? [...new Set(general.dashboardActorFolderIds.map((entry) => String(entry)).filter(Boolean))]
    : [];
  const folderIds = new Set(folderOptions.map((entry) => entry.id));
  const selectedFolderIds = configuredFolderIds.filter((id) => folderIds.has(id) && id !== "root");
  const includeSubfolders = general.dashboardActorIncludeSubfolders !== false;
  let allowedFolderIds = null;
  if (selectedFolderIds.length) {
    allowedFolderIds = new Set(selectedFolderIds);
    if (includeSubfolders) {
      const selected = new Set(selectedFolderIds);
      for (const option of folderOptions) {
        if (option.ancestorIds?.some((ancestorId) => selected.has(ancestorId))) allowedFolderIds.add(option.id);
      }
    }
  }

  const compiled = compileActorScopeRegex(general.dashboardActorRegex);
  const folderPathById = new Map(folderOptions.map((entry) => [entry.id, entry.label]));
  const rootLabel = game.i18n.localize("GAG.Manager.RootFolder");
  return {
    active: Boolean(allowedFolderIds || compiled.regex),
    folderActive: Boolean(allowedFolderIds),
    regexActive: Boolean(compiled.regex),
    regexSource: compiled.source,
    regexError: compiled.error,
    selectedFolderIds,
    includeSubfolders,
    matches(actor) {
      const folderId = actorFolderId(actor);
      if (allowedFolderIds && (!folderId || !allowedFolderIds.has(folderId))) return false;
      if (!compiled.regex) return true;
      const folderPath = folderId ? (folderPathById.get(folderId) ?? "") : rootLabel;
      return compiled.regex.test(`${actor?.name ?? ""}\n${actor?.type ?? ""}\n${folderPath}`);
    }
  };
}
