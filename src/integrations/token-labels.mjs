import { resolveTokenCleanlinessActor } from "../actor-resolution.mjs";
import { FLAGS, HOOKS, MODULE_ID, PERMISSIONS, SETTINGS } from "../constants.mjs";
import { canViewActor, hasPermission } from "../permissions.mjs";
import { getConfiguration } from "../settings.mjs";
import { mapWithConcurrency } from "../util.mjs";
import { playerLinkedCharacterActorIds } from "../actor-scope.mjs";

export const TOKEN_LABEL_MODES = Object.freeze(["inherit", "show", "hide"]);
export const TOKEN_LABEL_POSITIONS = Object.freeze(["inherit", "above", "below", "left", "right"]);
export const TOKEN_LABEL_VISIBILITY_MODES = Object.freeze(["manual", "always", "controlled", "hovered", "controlled-or-hovered"]);
export const TOKEN_LABEL_VIEWER_MODES = Object.freeze(["inherit", "manual", "always", "controlled", "hovered", "controlled-or-hovered", "hidden"]);
export const TOKEN_LABEL_PLAYER_SCOPES = Object.freeze(["disabled", "owned", "characters", "all"]);
export const TOKEN_LABEL_ACTOR_SCOPES = Object.freeze(["supported", "characters"]);
export const TOKEN_LABEL_SHORTCUT_SCOPES = Object.freeze(["scene-pcs", "selected-pcs", "scene-eligible", "selected-eligible"]);

const LABEL_PROPERTY = Symbol.for(`${MODULE_ID}.tokenCleanlinessLabel`);
const LAYER_NAME = `${MODULE_ID}.tokenCleanlinessLabels`;
const LEVEL_COLORS = Object.freeze(["#4ed17a", "#f0ca4d", "#ff963f", "#ff5151"]);
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_BACKGROUND_COLOR = "#111318";

/**
 * Render localized cleanliness labels in a dedicated interface-layer container.
 *
 * Actor flags remain the sole source of cleanliness state. Token flags store
 * only display and position overrides. The separate interface container keeps
 * labels above every Token without mutating Foundry's own Token nameplates.
 */
export class TokenLabelService {
  constructor(stateService) {
    this.stateService = stateService;
    this.registered = false;
    this.layer = null;
    this.labels = new Map();
    this.pendingTokenRefreshes = new Map();
    this.refreshAllPending = false;
    this.framePending = false;
    this.frameTicket = 0;
    // Per-client, in-memory shortcuts never modify Token documents or other users.
    this.shortcutSceneId = null;
    this.shortcutOverrides = new Map();
  }

  registerHooks() {
    if (this.registered) return;
    this.registered = true;

    game.keybindings.register(MODULE_ID, "toggleTokenCleanlinessLabels", {
      name: "GAG.Keybindings.ToggleTokenLabels.Name",
      hint: "GAG.Keybindings.ToggleTokenLabels.Hint",
      editable: [{ key: "KeyG", modifiers: ["SHIFT", "ALT"] }],
      restricted: false,
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
      onDown: () => {
        if (getConfiguration().tokenLabels.shortcutEnabled === false) return false;
        try {
          this.toggleSceneTokenLabels({ notify: true });
        } catch (error) {
          console.error(`[${MODULE_ID}] Token-label keybinding failed.`, error);
          ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
        }
        return true;
      }
    });

    Hooks.on("canvasReady", () => {
      this.syncShortcutScene();
      this.scheduleRefreshAll();
    });
    Hooks.on("canvasTearDown", () => this.destroyLayer());
    Hooks.on("drawToken", (token) => this.scheduleTokenRefresh(token, { full: true }));
    Hooks.on("refreshToken", (token) => this.scheduleTokenRefresh(token, { full: false }));
    // A hover transition can reveal a label that has been hidden since an
    // Actor update. Re-hydrate its text, not merely its screen position.
    Hooks.on("hoverToken", (token) => this.scheduleTokenRefresh(token, { full: true }));
    Hooks.on("controlToken", (token) => this.scheduleTokenRefresh(token, { full: false }));
    Hooks.on("updateToken", (tokenDocument, changes = {}) => {
      const moduleFlagsChanged = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
      const visibilityChanged = ["hidden", "alpha", "actorId", "actorLink"].some((key) => Object.hasOwn(changes, key));
      const positionChanged = ["x", "y", "width", "height", "scale", "rotation", "elevation"].some((key) => Object.hasOwn(changes, key));
      if (moduleFlagsChanged || visibilityChanged) this.scheduleTokenRefresh(tokenDocument?.object, { full: true });
      else if (positionChanged) this.scheduleTokenRefresh(tokenDocument?.object, { full: false });
    });
    Hooks.on("deleteToken", (tokenDocument) => {
      // Token deletion is authoritative; unlike destroyToken this is not just
      // an old canvas object being replaced with the same document UUID.
      this.shortcutOverrides.delete(tokenKey(tokenDocument));
      this.removeTokenLabel(tokenDocument);
    });
    Hooks.on("destroyToken", (token) => this.removeTokenLabel(token));
    // Foundry may represent setFlag changes as an expanded flags object or
    // flattened dotted keys, depending on the originating update path.
    Hooks.on("updateActor", (actor, changes = {}) => {
      const flags = changes?.flags;
      const changed = Boolean(flags && Object.hasOwn(flags, MODULE_ID))
        || Object.keys(changes ?? {}).some((key) => key === `flags.${MODULE_ID}` || key.startsWith(`flags.${MODULE_ID}.`));
      if (changed) this.scheduleActorRefresh(actor);
    });
    // A local state mutation should repaint before any unrelated hover event;
    // remote clients receive the authoritative updateActor event above.
    Hooks.on(HOOKS.STATE_CHANGED, ({ actor }) => this.scheduleActorRefresh(actor));
    Hooks.on("updateSetting", (setting) => {
      const key = String(setting?.key ?? setting?._source?.key ?? "");
      if (key === `${MODULE_ID}.${SETTINGS.CONFIG}` || key === `${MODULE_ID}.${SETTINGS.PERMISSIONS}` || key === `${MODULE_ID}.${SETTINGS.TOKEN_LABELS_VISIBLE}` || key === `${MODULE_ID}.${SETTINGS.TOKEN_LABEL_VIEW_MODE}` || key === `${MODULE_ID}.${SETTINGS.TOKEN_LABEL_VIEW_POSITION}`) {
        this.scheduleRefreshAll();
      }
    });
  }

  isGlobalVisible() {
    return Boolean(game.settings.get(MODULE_ID, SETTINGS.TOKEN_LABELS_VISIBLE));
  }

  canUseViewerControls() {
    const configuration = getConfiguration();
    return game.user.isGM || (hasPermission(PERMISSIONS.VIEW_TOKEN_LABELS, { user: game.user }) && effectivePlayerScope(configuration.tokenLabels) !== "disabled");
  }

  getViewerMode() {
    if (game.user.isGM) return "inherit";
    const mode = String(game.settings.get(MODULE_ID, SETTINGS.TOKEN_LABEL_VIEW_MODE) ?? "inherit");
    return TOKEN_LABEL_VIEWER_MODES.includes(mode) ? mode : "inherit";
  }

  async setViewerMode(mode, { notify = false } = {}) {
    if (!this.canUseViewerControls()) throw new Error(game.i18n.localize("GAG.TokenLabels.PermissionDenied"));
    if (!TOKEN_LABEL_VIEWER_MODES.includes(mode)) throw new Error(game.i18n.localize("GAG.TokenLabels.InvalidViewerMode"));
    if (game.user.isGM && mode !== "inherit") throw new Error(game.i18n.localize("GAG.TokenLabels.GmViewerModeHint"));
    await game.settings.set(MODULE_ID, SETTINGS.TOKEN_LABEL_VIEW_MODE, mode);
    this.shortcutOverrides.clear();
    this.scheduleRefreshAll();
    ui.controls?.render?.();
    if (notify) ui.notifications.info(game.i18n.format("GAG.TokenLabels.ViewerModeSet", { mode: game.i18n.localize(`GAG.TokenLabels.ViewerMode.${mode}`) }));
    return mode;
  }

  getViewerPosition() {
    if (game.user.isGM) return "inherit";
    const position = String(game.settings.get(MODULE_ID, SETTINGS.TOKEN_LABEL_VIEW_POSITION) ?? "inherit");
    return TOKEN_LABEL_POSITIONS.includes(position) ? position : "inherit";
  }

  async setViewerPosition(position, { notify = false } = {}) {
    if (!this.canUseViewerControls()) throw new Error(game.i18n.localize("GAG.TokenLabels.PermissionDenied"));
    if (!TOKEN_LABEL_POSITIONS.includes(position)) throw new Error(game.i18n.localize("GAG.TokenLabels.InvalidPosition"));
    if (game.user.isGM && position !== "inherit") throw new Error(game.i18n.localize("GAG.TokenLabels.GmViewerModeHint"));
    await game.settings.set(MODULE_ID, SETTINGS.TOKEN_LABEL_VIEW_POSITION, position);
    this.scheduleRefreshAll();
    if (notify) ui.notifications.info(game.i18n.format("GAG.TokenLabels.ViewerPositionSet", { position: game.i18n.localize(`GAG.TokenLabels.Position.${position}`) }));
    return position;
  }

  getEffectiveViewerMode(configuration = getConfiguration()) {
    if (game.user.isGM) return effectiveVisibilityMode(configuration.tokenLabels);
    if (!this.canUseViewerControls()) return "hidden";
    const preference = this.getViewerMode();
    return preference === "inherit" ? effectiveVisibilityMode(configuration.tokenLabels) : preference;
  }

  async setGlobalVisibility(visible, { notify = false } = {}) {
    const configuration = getConfiguration();
    if (!configuration.tokenLabels.enabled) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.DisabledWarning"));
      return false;
    }
    if (this.getEffectiveViewerMode(configuration) !== "manual") {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.ManualToggleUnavailable"));
      return this.isGlobalVisible();
    }
    if (!game.user.isGM && !canCurrentUserSeeAnyLabels(configuration)) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.PermissionDenied"));
      return false;
    }
    const value = Boolean(visible);
    await game.settings.set(MODULE_ID, SETTINGS.TOKEN_LABELS_VISIBLE, value);
    this.scheduleRefreshAll();
    ui.controls?.render?.();
    if (notify) ui.notifications.info(game.i18n.localize(value ? "GAG.TokenLabels.AllShown" : "GAG.TokenLabels.AllHidden"));
    return value;
  }

  async toggleGlobalVisibility(options = {}) {
    return this.setGlobalVisibility(!this.isGlobalVisible(), options);
  }

  /** Keep transient shortcuts within one scene even when the canvas is redrawn. */
  syncShortcutScene() {
    const sceneId = canvas?.scene?.id ?? null;
    if (this.shortcutSceneId !== sceneId) {
      this.shortcutSceneId = sceneId;
      this.shortcutOverrides.clear();
    }
  }

  /**
   * Set local visibility only for the requested scene Tokens. No GM Token
   * flags, world settings or chat messages are changed. The shortcut has the
   * same authorization and GM-hide constraints as normal label rendering.
   */
  toggleSceneTokenLabels({ notify = false } = {}) {
    const configuration = getConfiguration();
    if (configuration.tokenLabels.shortcutEnabled === false) return 0;
    if (!configuration.tokenLabels.enabled) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.DisabledWarning"));
      return 0;
    }
    if (!this.canUseViewerControls()) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.PermissionDenied"));
      return 0;
    }
    if (this.getEffectiveViewerMode(configuration) === "hidden") {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.ShortcutHiddenPreference"));
      return 0;
    }
    if (!canvas?.ready || !canvas?.scene || !canvas?.tokens) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.ShortcutNoScene"));
      return 0;
    }
    this.syncShortcutScene();
    const requestedScope = configuration.tokenLabels.shortcutScope;
    const scope = TOKEN_LABEL_SHORTCUT_SCOPES.includes(requestedScope) ? requestedScope : "scene-pcs";
    const selected = scope.startsWith("selected-");
    const candidates = selected ? (canvas.tokens.controlled ?? []) : (canvas.tokens.placeables ?? []);
    if (selected && candidates.length === 0) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
      return 0;
    }
    const pcOnly = scope.endsWith("-pcs");
    const playerLinked = pcOnly ? playerLinkedCharacterActorIds({
      actors: [...new Map((canvas.tokens.placeables ?? []).filter((token) => token.actor?.id).map((token) => [token.actor.id, token.actor])).values()],
      users: game.users ?? []
    }) : null;
    const targets = candidates.filter((token) => {
      if (!token?.document?.id || !token.actor || !token.isVisible) return false;
      if (pcOnly && (token.actor.type !== "character" || !playerLinked.has(token.actor.id))) return false;
      if (!actorMatchesScope(token.actor, configuration)) return false;
      if (!canViewerSeeTokenLabel(token, configuration)) return false;
      if (this.getTokenMode(token) === "hide") return false;
      return true;
    });
    if (!targets.length) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.TokenLabels.ShortcutNoEligibleTokens"));
      return 0;
    }
    // Mixed states converge to all shown; fully shown groups converge to hidden.
    const visible = this.isGlobalVisible();
    const show = !targets.every((token) => this.shouldDisplay(token, configuration, visible));
    for (const token of targets) this.shortcutOverrides.set(tokenKey(token), show);
    this.scheduleRefreshAll();
    if (notify) ui.notifications.info(game.i18n.format(
      show ? "GAG.TokenLabels.ShortcutShown" : "GAG.TokenLabels.ShortcutHidden",
      { count: targets.length }
    ));
    return targets.length;
  }

  getTokenMode(token) {
    const document = resolveTokenDocument(token);
    const mode = document?.getFlag?.(MODULE_ID, FLAGS.TOKEN_LABEL_MODE);
    return TOKEN_LABEL_MODES.includes(mode) ? mode : "inherit";
  }

  async setTokenMode(token, mode, { notify = false } = {}) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    if (!TOKEN_LABEL_MODES.includes(mode)) throw new Error(game.i18n.localize("GAG.TokenLabels.InvalidMode"));
    const document = resolveTokenDocument(token);
    if (!document?.setFlag) throw new Error(game.i18n.localize("GAG.Errors.TokenMissing"));
    if (mode === "inherit") await document.unsetFlag(MODULE_ID, FLAGS.TOKEN_LABEL_MODE);
    else await document.setFlag(MODULE_ID, FLAGS.TOKEN_LABEL_MODE, mode);
    this.refreshToken(document.object ?? token);
    if (notify) {
      const tokenName = document.name ?? document.actor?.name ?? game.i18n.localize("GAG.Common.UnknownActor");
      ui.notifications.info(game.i18n.format("GAG.TokenLabels.ModeSet", {
        token: tokenName,
        mode: game.i18n.localize(`GAG.TokenLabels.Modes.${mode}`)
      }));
    }
    return mode;
  }

  async setSelectedTokenMode(mode, { notify = true } = {}) {
    const tokens = canvas?.tokens?.controlled ?? [];
    if (!tokens.length) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
      return 0;
    }
    await mapWithConcurrency(tokens, (token) => this.setTokenMode(token, mode));
    if (notify) {
      ui.notifications.info(game.i18n.format("GAG.TokenLabels.SelectedModeSet", {
        count: tokens.length,
        mode: game.i18n.localize(`GAG.TokenLabels.Modes.${mode}`)
      }));
    }
    return tokens.length;
  }

  getTokenPosition(token) {
    const document = resolveTokenDocument(token);
    const position = document?.getFlag?.(MODULE_ID, FLAGS.TOKEN_LABEL_POSITION);
    return TOKEN_LABEL_POSITIONS.includes(position) ? position : "inherit";
  }

  async setTokenPosition(token, position, { notify = false } = {}) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    if (!TOKEN_LABEL_POSITIONS.includes(position)) throw new Error(game.i18n.localize("GAG.TokenLabels.InvalidPosition"));
    const document = resolveTokenDocument(token);
    if (!document?.setFlag) throw new Error(game.i18n.localize("GAG.Errors.TokenMissing"));
    if (position === "inherit") await document.unsetFlag(MODULE_ID, FLAGS.TOKEN_LABEL_POSITION);
    else await document.setFlag(MODULE_ID, FLAGS.TOKEN_LABEL_POSITION, position);
    this.refreshToken(document.object ?? token);
    if (notify) {
      const tokenName = document.name ?? document.actor?.name ?? game.i18n.localize("GAG.Common.UnknownActor");
      ui.notifications.info(game.i18n.format("GAG.TokenLabels.PositionSet", {
        token: tokenName,
        position: game.i18n.localize(`GAG.TokenLabels.Position.${position}`)
      }));
    }
    return position;
  }

  async setSelectedTokenPosition(position, { notify = true } = {}) {
    const tokens = canvas?.tokens?.controlled ?? [];
    if (!tokens.length) {
      if (notify) ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
      return 0;
    }
    await mapWithConcurrency(tokens, (token) => this.setTokenPosition(token, position));
    if (notify) {
      ui.notifications.info(game.i18n.format("GAG.TokenLabels.SelectedPositionSet", {
        count: tokens.length,
        position: game.i18n.localize(`GAG.TokenLabels.Position.${position}`)
      }));
    }
    return tokens.length;
  }

  scheduleRefreshAll() {
    this.refreshAllPending = true;
    this.#scheduleFrame();
  }

  scheduleActorRefresh(actor) {
    if (!actor) return;
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.document?.actorId === actor.id || token.actor?.uuid === actor.uuid || token.actor?.id === actor.id) this.scheduleTokenRefresh(token, { full: true });
    }
  }

  scheduleTokenRefresh(token, { full = true } = {}) {
    const object = resolveTokenObject(token);
    if (!object?.actor) return;
    const key = tokenKey(object);
    const pending = this.pendingTokenRefreshes.get(key);
    this.pendingTokenRefreshes.set(key, { token: object, full: Boolean(full || pending?.full) });
    this.#scheduleFrame();
  }

  #scheduleFrame() {
    if (this.framePending) return;
    this.framePending = true;
    const ticket = ++this.frameTicket;
    const callback = () => {
      if (ticket !== this.frameTicket) return;
      this.framePending = false;
      if (this.refreshAllPending) {
        this.refreshAllPending = false;
        this.pendingTokenRefreshes.clear();
        this.refreshAll();
        return;
      }
      const pending = [...this.pendingTokenRefreshes.values()];
      this.pendingTokenRefreshes.clear();
      const configuration = getConfiguration();
      const globalVisible = this.isGlobalVisible();
      for (const entry of pending) {
        if (entry.full) this.refreshToken(entry.token, { configuration, globalVisible });
        else this.refreshTokenPosition(entry.token, { configuration, globalVisible });
      }
    };
    if (typeof globalThis.requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  refreshAll() {
    const tokens = canvas?.tokens?.placeables ?? [];
    const activeKeys = new Set();
    const configuration = getConfiguration();
    const globalVisible = this.isGlobalVisible();
    for (const token of tokens) {
      activeKeys.add(tokenKey(token));
      this.refreshToken(token, { configuration, globalVisible });
    }
    for (const [key, label] of this.labels) {
      if (activeKeys.has(key)) continue;
      if (label.gagTokenObject?.[LABEL_PROPERTY] === label) delete label.gagTokenObject[LABEL_PROPERTY];
      destroyDisplayObject(label);
      this.labels.delete(key);
    }
  }

  refreshActor(actor) {
    if (!actor) return;
    const configuration = getConfiguration();
    const globalVisible = this.isGlobalVisible();
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.document?.actorId === actor.id || token.actor?.uuid === actor.uuid || token.actor?.id === actor.id) this.refreshToken(token, { configuration, globalVisible });
    }
  }

  refreshToken(token, { configuration = getConfiguration(), globalVisible = this.isGlobalVisible() } = {}) {
    const object = resolveTokenObject(token);
    if (!object?.actor) return;

    const key = tokenKey(object);
    const visible = this.shouldDisplay(object, configuration, globalVisible);
    let label = this.labels.get(key) ?? object[LABEL_PROPERTY];
    // A Token can be recreated with the same document UUID while its old
    // canvas object is still being destroyed. Never reuse the old display
    // object's owner or let its late destroy hook remove the replacement.
    if (label && label.gagTokenObject && label.gagTokenObject !== object) {
      const oldObject = label.gagTokenObject;
      if (oldObject[LABEL_PROPERTY] === label) delete oldObject[LABEL_PROPERTY];
      destroyDisplayObject(label);
      this.labels.delete(key);
      label = null;
    }
    if (!visible) {
      if (label) label.visible = false;
      return;
    }

    const layer = this.ensureLayer();
    if (!layer?.addChild) return;
    const state = this.stateService.getState(resolveTokenCleanlinessActor(object));
    const text = formatLabel(state, configuration.tokenLabels);
    if (!label || label.destroyed) {
      label = createLabel(text, state.dirtLevel, configuration.tokenLabels);
      this.labels.set(key, label);
      object[LABEL_PROPERTY] = label;
      label.gagTokenObject = object;
      layer.addChild(label);
    } else {
      updateLabel(label, text, state.dirtLevel, configuration.tokenLabels);
      if (label.parent !== layer) layer.addChild(label);
    }

    this.#positionVisibleLabel(object, label, configuration);
  }

  refreshTokenPosition(token, { configuration = getConfiguration(), globalVisible = this.isGlobalVisible() } = {}) {
    const object = resolveTokenObject(token);
    if (!object?.actor) return;
    const key = tokenKey(object);
    const label = this.labels.get(key) ?? object[LABEL_PROPERTY];
    if (!label || label.destroyed || (label.gagTokenObject && label.gagTokenObject !== object)) {
      this.refreshToken(object, { configuration, globalVisible });
      return;
    }
    if (!this.shouldDisplay(object, configuration, globalVisible)) {
      label.visible = false;
      return;
    }
    // Hidden labels are cached for performance, but their text may predate a
    // cleanliness change. Always refresh their full content when revealed.
    if (!label.visible) {
      this.refreshToken(object, { configuration, globalVisible });
      return;
    }
    this.#positionVisibleLabel(object, label, configuration);
  }

  #positionVisibleLabel(object, label, configuration) {
    const tokenPosition = this.getTokenPosition(object);
    const viewerPosition = this.getViewerPosition();
    const effectivePosition = !game.user.isGM && viewerPosition !== "inherit"
      ? viewerPosition
      : tokenPosition === "inherit" ? configuration.tokenLabels.position : tokenPosition;
    positionLabel(object, label, configuration.tokenLabels, effectivePosition);
    label.visible = true;
    label.alpha = Number.isFinite(Number(object.alpha)) ? Number(object.alpha) : 1;
  }

  removeTokenLabel(token) {
    const key = tokenKey(token);
    const object = resolveTokenObject(token);
    const label = this.labels.get(key) ?? object?.[LABEL_PROPERTY];
    if (!label) return;
    // A delayed destroyToken for an obsolete canvas object must not erase a
    // replacement Token's label with the same document UUID.
    if (object && label.gagTokenObject && object !== label.gagTokenObject) return;
    destroyDisplayObject(label);
    this.labels.delete(key);
    if (object && object[LABEL_PROPERTY] === label) delete object[LABEL_PROPERTY];
  }

  destroyLayer() {
    this.pendingTokenRefreshes.clear();
    this.refreshAllPending = false;
    this.frameTicket += 1;
    this.framePending = false;
    for (const label of this.labels.values()) {
      if (label.gagTokenObject?.[LABEL_PROPERTY] === label) delete label.gagTokenObject[LABEL_PROPERTY];
      destroyDisplayObject(label);
    }
    this.labels.clear();
    destroyDisplayObject(this.layer);
    this.layer = null;
  }

  ensureLayer() {
    const parent = canvas?.interface;
    if (!parent?.addChild) return null;
    if (this.layer && !this.layer.destroyed && this.layer.parent === parent) return this.layer;

    const ContainerClass = globalThis.PIXI?.Container;
    if (!ContainerClass) return null;
    const layer = new ContainerClass();
    layer.label = LAYER_NAME;
    layer.name = LAYER_NAME;
    layer.eventMode = "none";
    layer.interactive = false;
    layer.interactiveChildren = false;
    layer.sortableChildren = true;
    const scrollingTextZ = Number(globalThis.CONFIG?.Canvas?.groups?.interface?.zIndexScrollingText ?? 0);
    layer.zIndex = Math.max(10_000, scrollingTextZ + 1_000);
    parent.sortableChildren = true;
    parent.addChild(layer);
    this.layer = layer;
    return layer;
  }

  shouldDisplay(token, configuration = getConfiguration(), globalVisible = this.isGlobalVisible()) {
    this.syncShortcutScene();
    if (configuration.tokenLabels.shortcutEnabled === false && this.shortcutOverrides.size) this.shortcutOverrides.clear();
    if (!configuration.tokenLabels.enabled || !token?.isVisible || !token.actor) return false;
    if (!actorMatchesScope(token.actor, configuration)) return false;
    if (!canViewerSeeTokenLabel(token, configuration)) return false;

    const tokenMode = this.getTokenMode(token);
    if (tokenMode === "hide") return false;

    const viewerPreference = this.getViewerMode();
    const viewerMode = this.getEffectiveViewerMode(configuration);
    if (viewerMode === "hidden") return false;

    const shortcutOverride = this.shortcutOverrides.get(tokenKey(token));
    if (typeof shortcutOverride === "boolean") return shortcutOverride;

    // Preserve the GM-authored per-Token "Always show" override when the
    // viewer follows the world defaults. An authorized player who selected a
    // personal display mode keeps control of their own view.
    if (tokenMode === "show" && (game.user.isGM || viewerPreference === "inherit")) return true;

    switch (viewerMode) {
      case "always": return true;
      case "controlled": return Boolean(token.controlled);
      case "hovered": return Boolean(token.hover);
      case "controlled-or-hovered": return Boolean(token.controlled || token.hover);
      default: return globalVisible;
    }
  }
}

export function registerTokenLabelIntegration(service) {
  service.registerHooks();
  return service;
}

function resolveTokenObject(value) {
  if (!value) return null;
  if (value.document?.documentName === "Token") return value;
  if (value.documentName === "Token") return value.object ?? null;
  return value.object?.document?.documentName === "Token" ? value.object : null;
}

function resolveTokenDocument(value) {
  const object = resolveTokenObject(value);
  if (object?.document?.documentName === "Token") return object.document;
  return value?.documentName === "Token" ? value : null;
}

function tokenKey(value) {
  const document = resolveTokenDocument(value);
  return document?.uuid ?? document?.id ?? resolveTokenObject(value) ?? value;
}

function effectiveVisibilityMode(options = {}) {
  return TOKEN_LABEL_VISIBILITY_MODES.includes(options.visibilityMode) ? options.visibilityMode : "manual";
}

function effectivePlayerScope(options = {}) {
  if (options.playerScope === "disabled") return "characters";
  if (TOKEN_LABEL_PLAYER_SCOPES.includes(options.playerScope)) return options.playerScope;
  if (options.audience === "owners") return "owned";
  if (options.audience === "everyone") return "all";
  return "disabled";
}

function actorMatchesScope(actor, configuration) {
  if (!actor?.type) return true;
  const scope = TOKEN_LABEL_ACTOR_SCOPES.includes(configuration.tokenLabels?.actorScope)
    ? configuration.tokenLabels.actorScope
    : "supported";
  if (scope === "characters") return actor?.type === "character";
  const supported = configuration.general?.supportedActorTypes;
  return !Array.isArray(supported) || !supported.length || supported.includes(actor?.type);
}

function canCurrentUserSeeAnyLabels(configuration) {
  if (game.user.isGM) return true;
  return hasPermission(PERMISSIONS.VIEW_TOKEN_LABELS, { user: game.user });
}

function canViewerSeeTokenLabel(token, configuration) {
  if (game.user.isGM) return true;
  if (!hasPermission(PERMISSIONS.VIEW_TOKEN_LABELS, { user: game.user })) return false;
  const scope = effectivePlayerScope(configuration.tokenLabels);
  if (scope === "disabled") return false;
  if (scope === "owned") return Boolean(token.actor?.testUserPermission?.(game.user, "OWNER") ?? token.actor?.isOwner);
  if (scope === "characters") return token.actor?.type === "character";
  if (scope === "all") return true;
  return canViewActor(token.actor);
}

export function formatLabel(state, options) {
  const level = Number(state?.dirtLevel ?? 0);
  const name = game.i18n.localize(`GAG.Levels.${level}.Name`);
  if (options.format === "level") return String(level);
  if (options.format === "name") return name;
  if (options.format === "detailed") {
    return `${level} · ${name} · ${game.i18n.localize("GAG.Common.BodyShort")}${state.body.level}/${game.i18n.localize("GAG.Common.ClothingShort")}${state.clothing.level}`;
  }
  return `${level} · ${name}`;
}

function createLabel(text, dirtLevel, options) {
  const ContainerClass = globalThis.PIXI?.Container;
  const GraphicsClass = globalThis.PIXI?.Graphics;
  const TextClass = foundry.canvas.containers.PreciseText;
  const container = new ContainerClass();
  const background = new GraphicsClass();
  const style = createTextStyle(TextClass, options);

  // Foundry V13 PreciseText uses the string-first PIXI.Text constructor.
  // Passing a PIXI v8-style {text, style} object can be accepted as the text
  // value and stringify to "[object Object]" instead of throwing.
  const textObject = new TextClass(String(text ?? ""), style);
  textObject.anchor?.set?.(0.5, 0.5);
  textObject.eventMode = "none";
  textObject.interactive = false;
  textObject.interactiveChildren = false;
  textObject.roundPixels = true;

  background.eventMode = "none";
  background.interactive = false;
  container.eventMode = "none";
  container.interactive = false;
  container.interactiveChildren = false;
  container.roundPixels = true;
  container.gagBackground = background;
  container.gagText = textObject;
  container.addChild(background);
  container.addChild(textObject);
  redrawBackground(container, dirtLevel, options);
  container.gagTextValue = text;
  container.gagStyleSignature = labelStyleSignature(options);
  container.gagDirtLevel = dirtLevel;
  return container;
}

function updateLabel(label, text, dirtLevel, options) {
  const textObject = label.gagText;
  if (!textObject) return;
  const styleSignature = labelStyleSignature(options);
  const textChanged = label.gagTextValue !== text;
  const styleChanged = label.gagStyleSignature !== styleSignature;
  const levelChanged = label.gagDirtLevel !== dirtLevel;
  if (textChanged) textObject.text = text;
  // Assign a fresh style. Mutating an existing PIXI.TextStyle in place can
  // leave cached glyph geometry/textures stale on some Foundry/PIXI builds.
  // Assignment triggers the text object's supported style invalidation path.
  if (styleChanged) textObject.style = createTextStyle(textObject.constructor, options);
  if (textChanged || styleChanged || levelChanged) redrawBackground(label, dirtLevel, options);
  label.gagTextValue = text;
  label.gagStyleSignature = styleSignature;
  label.gagDirtLevel = dirtLevel;
}

function labelStyleSignature(options) {
  return [
    boundedNumber(options.fontSize, 18, 10, 48),
    normalizeHexColor(options.fontColor, DEFAULT_TEXT_COLOR),
    normalizeHexColor(options.backgroundColor, DEFAULT_BACKGROUND_COLOR),
    boundedNumber(options.backgroundOpacity, 0.92, 0, 1),
    boundedNumber(options.paddingX, 6, 2, 24),
    boundedNumber(options.paddingY, 3, 1, 16)
  ].join("|");
}

function createTextStyle(TextClass, options) {
  // Keep an individual TextStyle per label. Foundry canvas defaults may
  // include a shadow or stroke sized for large Token nameplates; those fixed
  // effects visually defeat small (10–13 px) cleanliness text sizes.
  const style = TextClass.getTextStyle();
  style.fontSize = boundedNumber(options.fontSize, 18, 10, 48);
  style.fontWeight = "bold";
  style.fill = normalizeHexColor(options.fontColor, DEFAULT_TEXT_COLOR);
  style.align = "center";
  style.strokeThickness = 0;
  style.dropShadow = false;
  style.padding = 0;
  return style;
}

function boundedNumber(value, fallback, min, max) {
  const number = value == null || value === "" ? Number.NaN : Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

function redrawBackground(label, dirtLevel, options) {
  const background = label.gagBackground;
  const textObject = label.gagText;
  if (!background || !textObject) return;

  const paddingX = boundedNumber(options.paddingX, 6, 2, 24);
  const paddingY = boundedNumber(options.paddingY, 3, 1, 16);
  // Do not impose a fixed 18px minimum height: it masks reductions below
  // ~14px font sizes, especially at small padding. Let real glyph metrics
  // drive both the background rectangle and Token placement.
  const width = Math.max(1, Number(textObject.width ?? 0) + (paddingX * 2));
  const height = Math.max(1, Number(textObject.height ?? boundedNumber(options.fontSize, 18, 10, 48)) + (paddingY * 2));
  const radius = Math.min(6, height / 3);
  const backgroundColor = hexToNumber(normalizeHexColor(options.backgroundColor, DEFAULT_BACKGROUND_COLOR));
  const backgroundOpacity = boundedNumber(options.backgroundOpacity, 0.92, 0, 1);
  const borderColor = hexToNumber(LEVEL_COLORS[dirtLevel] ?? LEVEL_COLORS[0]);

  background.clear?.();
  if (typeof background.roundRect === "function" && typeof background.fill === "function") {
    background.roundRect(-width / 2, -height / 2, width, height, radius);
    background.fill({ color: backgroundColor, alpha: backgroundOpacity });
    background.stroke?.({ color: borderColor, alpha: 1, width: 1.5 });
  } else {
    background.lineStyle?.(1.5, borderColor, 1);
    background.beginFill?.(backgroundColor, backgroundOpacity);
    background.drawRoundedRect?.(-width / 2, -height / 2, width, height, radius);
    background.endFill?.();
  }
  label.gagBounds = { width, height };
}

function positionLabel(token, label, options, position = options.position) {
  const gap = boundedNumber(options.offset, 8, 2, 40);
  const bounds = label.gagBounds ?? { width: Number(label.width ?? 24), height: Number(label.height ?? boundedNumber(options.fontSize, 18, 10, 48)) };
  const halfTextHeight = Number(bounds.height) / 2;
  const halfTextWidth = Number(bounds.width) / 2;
  const x = Number(token.position?.x ?? token.x ?? token.document?.x ?? 0);
  const y = Number(token.position?.y ?? token.y ?? token.document?.y ?? 0);
  switch (position) {
    case "below":
      label.position.set(x + (token.w / 2), y + token.h + gap + halfTextHeight);
      break;
    case "left":
      label.position.set(x - gap - halfTextWidth, y + (token.h / 2));
      break;
    case "right":
      label.position.set(x + token.w + gap + halfTextWidth, y + (token.h / 2));
      break;
    default:
      label.position.set(x + (token.w / 2), y - gap - halfTextHeight);
      break;
  }
}

function normalizeHexColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function hexToNumber(value) {
  return Number.parseInt(String(value).slice(1), 16);
}

function destroyDisplayObject(displayObject) {
  if (!displayObject || displayObject.destroyed) return;
  displayObject.destroy?.({ children: true });
}
