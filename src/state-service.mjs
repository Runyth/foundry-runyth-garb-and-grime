import { FLAGS, HOOKS, MODULE_ID, PERMISSIONS } from "./constants.mjs";
import { adjustStateDirt, clampLevel, deepClone, normalizeState, setStateDirt } from "./domain/state.mjs";
import { canModifyActor, hasPermission } from "./permissions.mjs";

const ACTION_AUTHORIZATION = Symbol("garb-and-grime-action-authorization");
import { mapWithConcurrency, now, uniqueActors } from "./util.mjs";
import { postActionCard } from "./chat.mjs";
import { syncEffects } from "./effects.mjs";
import { resolveCleanlinessActor } from "./actor-resolution.mjs";

export class StateService {
  constructor(registry) {
    this.registry = registry;
  }

  async updateStateFromAction(actor, mutator, options = {}) {
    return this.updateState(actor, mutator, { ...options, [ACTION_AUTHORIZATION]: true });
  }

  getInternalState(actor) {
    return normalizeState(resolveCleanlinessActor(actor)?.getFlag?.(MODULE_ID, FLAGS.STATE));
  }

  getState(actor, { includeHidden = game.user.isGM } = {}) {
    const state = this.getInternalState(actor);
    const canViewHidden = game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor });
    if (includeHidden && canViewHidden) return state;
    return this.#sanitizeState(state);
  }

  /**
   * Read only the primitive state needed by large Actor-directory views.
   * This avoids normalizing and deep-cloning full transaction/masking data for
   * every Actor merely to filter and sort the Manager.
   */
  getDirectorySummary(actor, { includeHidden = game.user.isGM } = {}) {
    const stored = resolveCleanlinessActor(actor)?.getFlag?.(MODULE_ID, FLAGS.STATE);
    const source = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;
    if (!source) {
      return {
        dirtLevel: 0,
        bodyLevel: 0,
        clothingLevel: 0,
        contaminations: [],
        autoMaintenance: false,
        lastChange: null,
        lastChangeReason: ""
      };
    }

    const baseLevel = clampLevel(source.dirtLevel ?? Math.max(source.body?.level ?? 0, source.clothing?.level ?? 0));
    const bodyLevel = clampLevel(source.body?.level ?? baseLevel);
    const clothingLevel = clampLevel(source.clothing?.level ?? baseLevel);
    const dirtLevel = clampLevel(Math.max(baseLevel, bodyLevel, clothingLevel));
    const canViewHidden = game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor });
    const contaminations = Array.isArray(source.contaminations)
      ? source.contaminations.slice(-30).filter((entry) => entry && typeof entry === "object" && (includeHidden && canViewHidden || !entry.hidden))
      : [];
    const lastChange = source.lastChange === null || source.lastChange === undefined || source.lastChange === ""
      ? null
      : (typeof source.lastChange === "number" && Number.isFinite(source.lastChange)) || (typeof source.lastChange === "string" && !Number.isNaN(Date.parse(source.lastChange)))
        ? source.lastChange
        : null;
    return {
      dirtLevel,
      bodyLevel,
      clothingLevel,
      contaminations,
      autoMaintenance: Boolean(source.autoMaintenance),
      lastChange,
      lastChangeReason: typeof source.lastChangeReason === "string" ? source.lastChangeReason.slice(0, 4000) : ""
    };
  }

  async updateState(actor, mutator, options = {}) {
    if (!actor) throw new Error(game.i18n.localize("GAG.Errors.ActorMissing"));
    const actionAuthorized = options[ACTION_AUTHORIZATION] === true;
    const manualAuthorized = hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor });
    if (!game.user.isGM && !actionAuthorized && !manualAuthorized) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    if (!game.user.isGM && !canModifyActor(actor)) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    const sourceActor = resolveCleanlinessActor(actor);
    if (!game.user.isGM && sourceActor !== actor && !canModifyActor(sourceActor)) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    const previous = this.getInternalState(sourceActor);
    const draft = deepClone(previous);
    const result = await mutator(draft);
    const next = normalizeState(result ?? draft);
    next.lastChange = now();
    if (options.reason !== undefined) next.lastChangeReason = String(options.reason ?? "").slice(0, 4000);
    const canViewHidden = game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor });
    const visiblePrevious = canViewHidden ? deepClone(previous) : this.#sanitizeState(previous);
    const visibleNext = canViewHidden ? deepClone(next) : this.#sanitizeState(next);
    const payload = { actor, previous: visiblePrevious, next: visibleNext, options: deepClone(options), user: game.user };
    if (Hooks.call(HOOKS.PRE_STATE_CHANGE, payload) === false) throw new Error(game.i18n.localize("GAG.Errors.ChangeVetoed"));
    await sourceActor.setFlag(MODULE_ID, FLAGS.STATE, next);
    if (effectsRelevantStateChanged(previous, next)) await syncEffects(sourceActor, next, this.registry);
    Hooks.callAll(HOOKS.STATE_CHANGED, { ...payload, next: deepClone(visibleNext) });
    if (!options.silent && options.chat !== false) await postActionCard({ actor, previous: visiblePrevious, next: visibleNext, reason: options.reason ?? "", hidden: Boolean(options.hidden) });
    return deepClone(visibleNext);
  }

  async setDirtLevel(actor, level, options = {}) {
    return this.updateState(actor, (state) => {
      const next = setStateDirt(state, clampLevel(level), { body: options.body !== false, clothing: options.clothing !== false });
      if (next.dirtLevel > state.dirtLevel) next.lastIncrease = now();
      if (next.dirtLevel < state.dirtLevel) next.lastCleaning = now();
      return next;
    }, options);
  }

  async adjustDirt(actor, amount, options = {}) {
    return this.updateState(actor, (state) => {
      const next = adjustStateDirt(state, amount, { body: options.body !== false, clothing: options.clothing !== false });
      if (Number(amount) > 0) next.lastIncrease = now();
      if (Number(amount) < 0) next.lastCleaning = now();
      if (options.dailyDay !== undefined) next.lastDailyGainDay = options.dailyDay;
      return next;
    }, options);
  }

  async setBodyCleanliness(actor, value, options = {}) {
    return this.updateState(actor, (state) => {
      state.body.level = typeof value === "boolean" ? (value ? 0 : Math.max(1, state.dirtLevel)) : clampLevel(value);
      state.body.clean = state.body.level === 0;
      state.dirtLevel = Math.max(state.body.level, state.clothing.level);
      return state;
    }, options);
  }

  async setClothingCleanliness(actor, value, options = {}) {
    return this.updateState(actor, (state) => {
      state.clothing.level = typeof value === "boolean" ? (value ? 0 : Math.max(1, state.dirtLevel)) : clampLevel(value);
      state.clothing.clean = state.clothing.level === 0;
      state.dirtLevel = Math.max(state.body.level, state.clothing.level);
      return state;
    }, options);
  }

  async applyContamination(actor, contaminationId, options = {}) {
    const definition = this.registry.getContamination(contaminationId, { clone: false });
    if (!definition) throw new Error(game.i18n.format("GAG.Errors.UnknownContamination", { id: contaminationId }));
    const current = this.getInternalState(actor);
    const existingContamination = current.contaminations.find((entry) => entry.id === contaminationId);
    const hidden = Boolean(options.hidden ?? existingContamination?.hidden ?? definition.hiddenByDefault);
    const effectiveOptions = { ...options, hidden };
    const payload = { actor, contamination: definition, options: effectiveOptions, user: game.user };
    if (Hooks.call(HOOKS.PRE_CONTAMINATION, payload) === false) throw new Error(game.i18n.localize("GAG.Errors.ChangeVetoed"));
    const next = await this.updateState(actor, (state) => {
      const changedAt = now();
      const existing = state.contaminations.find((entry) => entry.id === contaminationId);
      if (existing) {
        existing.appliedAt = changedAt;
        existing.source = options.source ?? existing.source ?? "";
        existing.hidden = hidden;
      } else {
        state.contaminations.push({
          id: contaminationId,
          appliedAt: changedAt,
          source: String(options.source ?? ""),
          hidden,
          effectivePenalty: options.effectivePenalty ?? definition.effectivePenalty ?? 0
        });
      }
      if (options.increase) {
        const raised = adjustStateDirt(state, options.increase);
        Object.assign(state, raised);
      }
      state.lastIncrease = changedAt;
      return state;
    }, { ...effectiveOptions, reason: options.reason ?? (definition.nameKey ? game.i18n.localize(definition.nameKey) : definition.name) });
    Hooks.callAll(HOOKS.CONTAMINATION_APPLIED, { ...payload, state: deepClone(next) });
    return next;
  }

  async removeContamination(actor, contaminationId, options = {}) {
    return this.updateState(actor, (state) => {
      state.contaminations = state.contaminations.filter((entry) => entry.id !== contaminationId);
      return state;
    }, options);
  }

  async setAutomaticMaintenance(actor, enabled, options = {}) {
    return this.updateStateFromAction(actor, (state) => {
      state.autoMaintenance = Boolean(enabled);
      return state;
    }, { ...options, chat: false });
  }

  async setNotes(actor, notes, options = {}) {
    return this.updateState(actor, (state) => {
      state.gmNotes = String(notes ?? "").slice(0, 4000);
      return state;
    }, { ...options, hidden: true, chat: false });
  }

  #sanitizeState(state) {
    const publicState = deepClone(state);
    publicState.gmNotes = "";
    publicState.contaminations = publicState.contaminations.filter((entry) => !entry.hidden);
    return publicState;
  }

  async migrateActor(actor) {
    const raw = actor.getFlag(MODULE_ID, FLAGS.STATE);
    if (raw === undefined) return { migrated: false, reason: "unused" };
    const normalized = normalizeState(raw);
    if (JSON.stringify(raw) === JSON.stringify(normalized)) return { migrated: false, reason: "current" };
    await actor.setFlag(MODULE_ID, FLAGS.STATE, normalized);
    return { migrated: true };
  }

  async refreshEffects(actor) {
    if (!actor?.documentName || actor.documentName !== "Actor") return false;
    await syncEffects(actor, this.getInternalState(actor), this.registry);
    return true;
  }

  async refreshAllEffects(actors = null) {
    const candidates = actors ?? [
      ...(game.actors ?? []),
      ...((globalThis.canvas?.tokens?.placeables ?? []).map((token) => token.actor))
    ];
    const outcomes = await mapWithConcurrency(uniqueActors(candidates), async (actor) => {
      try {
        await this.refreshEffects(actor);
        return true;
      } catch (error) {
        console.error(`[${MODULE_ID}] Failed to synchronize Active Effects for ${actor.uuid}.`, error);
        return false;
      }
    });
    return {
      refreshed: outcomes.filter(Boolean).length,
      failed: outcomes.filter((success) => !success).length
    };
  }
}

function effectsRelevantStateChanged(previous, next) {
  if (previous.dirtLevel !== next.dirtLevel) return true;
  if (previous.body.clean !== next.body.clean || previous.clothing.clean !== next.clothing.clean) return true;
  if (previous.groomedUntil !== next.groomedUntil) return true;
  return effectContaminationSignature(previous.contaminations) !== effectContaminationSignature(next.contaminations);
}

function effectContaminationSignature(entries) {
  return (entries ?? []).filter((entry) => !entry.hidden).map((entry) => entry.id).sort().join("|");
}
