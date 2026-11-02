import { PERMISSIONS } from "./constants.mjs";
import { getPermissionsSetting } from "./settings.mjs";

export function hasPermission(permission, { user = game.user, actor = null } = {}) {
  if (!user) return false;
  if (user.isGM) return true;
  const config = getPermissionsSetting();
  const explicit = config.userOverrides?.[user.id]?.[permission];
  if (typeof explicit === "boolean") {
    if (!explicit) return false;
    return actor ? canReachActor(permission, actor, user) : true;
  }
  const minimum = Number(config.roleMinimums?.[permission] ?? 4);
  // Values above the highest Foundry role disable the permission for non-GMs.
  if (minimum > 4) return false;
  if (Number(user.role) < minimum) return false;
  return actor ? canReachActor(permission, actor, user) : true;
}

function canReachActor(permission, actor, user) {
  if ([PERMISSIONS.MODIFY_OTHERS, PERMISSIONS.VIEW_PARTY, PERMISSIONS.VIEW_GM_DETAILS, PERMISSIONS.VIEW_CLEANING_CHAT, PERMISSIONS.VIEW_STATE_CHAT].includes(permission)) return true;
  return Boolean(actor?.testUserPermission?.(user, "OWNER"));
}

export function canViewActor(actor) {
  if (!actor) return false;
  if (game.user.isGM) return true;
  return hasPermission(PERMISSIONS.VIEW_OWN, { actor }) || hasPermission(PERMISSIONS.VIEW_PARTY);
}

export function canModifyActor(actor) {
  if (!actor) return false;
  if (game.user.isGM) return true;
  if (actor.testUserPermission(game.user, "OWNER")) return hasPermission(PERMISSIONS.MODIFY_OWN_ACTIONS, { actor });
  return hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor });
}

export function assertPermission(permission, options = {}) {
  if (!hasPermission(permission, options)) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
}
