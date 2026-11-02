import { FLAGS, HOOKS, MODULE_ID, PERMISSIONS, SCENE_LEVEL_RATINGS } from "./constants.mjs";
import { assertPermission } from "./permissions.mjs";
import { deepClone } from "./domain/state.mjs";

const LEVELS = Object.freeze([0, 1, 2, 3]);
const DEFAULT_PROFILE_ID = "ordinary";

export class SceneContextError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "GarbAndGrimeSceneContextError";
    this.code = code;
  }
}

export class ContextService {
  constructor(registry) {
    this.registry = registry;
  }

  getSceneContextStatus(scene = canvas?.scene) {
    const profiles = this.#profiles();
    const registryReady = profiles.length > 0;
    const defaultProfileId = this.#defaultProfileId(profiles);
    if (!scene || typeof scene.getFlag !== "function") {
      return {
        status: "no-scene",
        registryReady,
        storedProfileId: null,
        staleProfileId: null,
        stored: null,
        context: this.#contextFromStored(null, defaultProfileId)
      };
    }

    const stored = scene.getFlag(MODULE_ID, FLAGS.SCENE_CONTEXT);
    const storedProfileId = normalizeProfileId(stored?.id);
    const profile = storedProfileId ? this.registry?.getEnvironmentProfile?.(storedProfileId, { clone: false }) : null;
    const status = !storedProfileId ? "unset" : profile ? "valid" : "stale";
    const effectiveId = profile ? storedProfileId : defaultProfileId;
    return {
      status,
      registryReady,
      storedProfileId,
      staleProfileId: status === "stale" ? storedProfileId : null,
      stored: stored && typeof stored === "object" ? deepClone(stored) : null,
      context: this.#contextFromStored(stored, effectiveId)
    };
  }

  getSceneContext(scene = canvas?.scene) {
    return this.getSceneContextStatus(scene).context;
  }

  getProfile(scene = canvas?.scene) {
    const context = this.getSceneContext(scene);
    const profile = this.registry?.getEnvironmentProfile?.(context.id, { clone: false })
      ?? this.registry?.getEnvironmentProfile?.(DEFAULT_PROFILE_ID, { clone: false })
      ?? this.#profiles()[0]
      ?? null;
    if (!profile) return null;
    return foundry.utils.mergeObject(profile, context.overrides ?? {}, {
      inplace: false,
      insertKeys: true,
      overwrite: true
    });
  }

  getLevelRatings(scene = canvas?.scene) {
    const context = this.getSceneContext(scene);
    if (context.levelRatings) return deepClone(context.levelRatings);
    const profile = this.getProfile(scene);
    return normalizeLevelRatings(profile?.levelRatings) ?? deriveLevelRatings(profile?.expected);
  }

  getLevelRatingRows(scene = canvas?.scene) {
    const ratings = this.getLevelRatings(scene);
    return LEVELS.map((level) => ({ level, rating: ratings[level] }));
  }

  async setSceneContext(scene, contextId, options = {}) {
    assertPermission(PERMISSIONS.CONFIGURE_CONTEXTS);
    this.#assertSceneDocument(scene);
    const profiles = this.#profiles();
    if (!profiles.length) {
      throw new SceneContextError(
        "registry-unavailable",
        game.i18n.localize("GAG.Errors.SceneProfileRegistryUnavailable")
      );
    }

    const selectedId = normalizeProfileId(contextId);
    if (!selectedId) {
      throw new SceneContextError(
        "selection-missing",
        game.i18n.localize("GAG.Errors.SceneProfileRequired")
      );
    }
    const profile = this.registry?.getEnvironmentProfile?.(selectedId, { clone: false });
    if (!profile) {
      throw new SceneContextError(
        "profile-unknown",
        game.i18n.format("GAG.Errors.UnknownProfile", { id: selectedId })
      );
    }

    const status = this.getSceneContextStatus(scene);
    const previous = status.context;
    const stored = status.stored && typeof status.stored === "object" ? status.stored : {};
    const next = {
      ...deepClone(stored),
      id: selectedId,
      overrides: options.overrides !== undefined
        ? deepClone(options.overrides ?? {})
        : selectedId === status.storedProfileId
          ? deepClone(previous.overrides ?? {})
          : {},
      levelRatings: options.useProfileDefaults === false
        ? (normalizeLevelRatings(options.levelRatings) ?? deriveLevelRatings(profile.expected))
        : null,
      updatedAt: Date.now(),
      updatedBy: game.user.id
    };

    try {
      await scene.setFlag(MODULE_ID, FLAGS.SCENE_CONTEXT, next);
    } catch (error) {
      throw new SceneContextError(
        "persistence-failed",
        game.i18n.format("GAG.Errors.SceneContextPersistenceFailed", { scene: scene.name ?? scene.id ?? "?" }),
        { cause: error }
      );
    }
    Hooks.callAll(HOOKS.CONTEXT_CHANGED, {
      scene,
      previous,
      next: deepClone(next),
      profile,
      options: deepClone(options)
    });
    return deepClone(next);
  }

  async setSceneLevelRatings(scene, levelRatings, options = {}) {
    assertPermission(PERMISSIONS.CONFIGURE_CONTEXTS);
    this.#assertSceneDocument(scene);
    const previous = this.getSceneContext(scene);
    const next = {
      ...previous,
      levelRatings: options.useProfileDefaults ? null : normalizeLevelRatings(levelRatings),
      updatedAt: Date.now(),
      updatedBy: game.user.id
    };
    if (!options.useProfileDefaults && !next.levelRatings) {
      throw new SceneContextError("ratings-invalid", game.i18n.localize("GAG.Errors.InvalidSceneRatings"));
    }
    try {
      await scene.setFlag(MODULE_ID, FLAGS.SCENE_CONTEXT, next);
    } catch (error) {
      throw new SceneContextError(
        "persistence-failed",
        game.i18n.format("GAG.Errors.SceneContextPersistenceFailed", { scene: scene.name ?? scene.id ?? "?" }),
        { cause: error }
      );
    }
    const profile = this.getProfile(scene);
    Hooks.callAll(HOOKS.CONTEXT_CHANGED, {
      scene,
      previous,
      next: deepClone(next),
      profile,
      options: deepClone(options)
    });
    return deepClone(next);
  }

  #profiles() {
    if (!this.registry || typeof this.registry.getEnvironmentProfile !== "function") return [];
    try {
      if (typeof this.registry.listEnvironmentProfiles === "function") {
        return this.registry.listEnvironmentProfiles({ clone: false }) ?? [];
      }
      const fallback = this.registry.getEnvironmentProfile(DEFAULT_PROFILE_ID, { clone: false });
      return fallback ? [fallback] : [];
    } catch {
      return [];
    }
  }

  #defaultProfileId(profiles = this.#profiles()) {
    if (this.registry?.getEnvironmentProfile?.(DEFAULT_PROFILE_ID, { clone: false })) return DEFAULT_PROFILE_ID;
    return normalizeProfileId(profiles[0]?.id) ?? DEFAULT_PROFILE_ID;
  }

  #contextFromStored(stored, id) {
    return {
      id: id ?? DEFAULT_PROFILE_ID,
      overrides: stored?.overrides ?? {},
      levelRatings: normalizeLevelRatings(stored?.levelRatings),
      updatedAt: stored?.updatedAt ?? null,
      updatedBy: stored?.updatedBy ?? null
    };
  }

  #assertSceneDocument(scene) {
    if (!scene || typeof scene.getFlag !== "function" || typeof scene.setFlag !== "function") {
      throw new SceneContextError(
        "scene-invalid",
        game.i18n.localize("GAG.Errors.SceneContextInvalidScene")
      );
    }
  }
}

function normalizeProfileId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export function normalizeLevelRatings(value) {
  if (!Array.isArray(value) || value.length !== LEVELS.length) return null;
  const normalized = value.map((entry) => String(entry ?? "").trim().toLowerCase());
  return normalized.every((entry) => SCENE_LEVEL_RATINGS.includes(entry)) ? normalized : null;
}

export function deriveLevelRatings(expected = {}) {
  const min = Math.max(0, Math.min(3, Number(expected?.min) || 0));
  const max = Math.max(min, Math.min(3, Number(expected?.max) || min));
  return LEVELS.map((level) => {
    if (level >= min && level <= max) return "expected";
    const distance = level < min ? min - level : level - max;
    if (distance === 1) return "accepted";
    if (distance === 2) return "disliked";
    return "hated";
  });
}
