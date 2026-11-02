import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { getConfiguration } from "./settings.mjs";
import { activeGm, mapWithConcurrency, worldDay } from "./util.mjs";

export class AutomationService {
  constructor(stateService, actionService, contextService) {
    this.stateService = stateService;
    this.actionService = actionService;
    this.contextService = contextService;
  }

  registerHooks() {
    // Foundry Hooks do not await asynchronous callbacks. Keep the registered
    // callbacks synchronous and explicitly contain rejected Promises.
    Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
      void this.#handleLongRest(actor, result, config).catch((error) => this.#reportError("GAG.Initialization.Areas.LongRest", error));
    });

    Hooks.on("deleteCombat", (combat) => {
      void this.#handleCombatEnd(combat).catch((error) => this.#reportError("GAG.Initialization.Areas.CombatEnd", error));
    });

    Hooks.on("updateWorldTime", () => {
      void this.#handleWorldDay().catch((error) => this.#reportError("GAG.Initialization.Areas.WorldDay", error));
    });
  }

  async applyActivity(actors, type, options = {}) {
    const settings = getConfiguration().dirtGain;
    const amount = type === "extreme" ? settings.extreme : type === "quiet" ? settings.quietDay : settings.normal;
    const reasonKey = type === "extreme" ? "GAG.Automation.Extreme" : type === "quiet" ? "GAG.Automation.QuietDay" : "GAG.Automation.Activity";
    const day = worldDay();
    return mapWithConcurrency(actors, (actor) => this.#applyDailyGain(actor, amount, reasonKey, day, {
      extreme: type === "extreme",
      ...options
    }));
  }

  async applyContextExposure(actors, options = {}) {
    const profile = this.contextService.getProfile(options.scene ?? canvas?.scene);
    const amount = Number(profile?.automaticDirtGain ?? 0);
    const day = worldDay();
    return mapWithConcurrency(actors, async (actor) => {
      const result = amount
        ? await this.#applyDailyGain(actor, amount, "GAG.Automation.ContextExposure", day, { extreme: amount >= 2, source: `context:${profile.id}` })
        : { skipped: true, reason: "no-gain" };
      for (const contaminationId of profile?.automaticContamination ?? []) {
        await this.stateService.applyContamination(actor, contaminationId, {
          system: true,
          reason: game.i18n.localize("GAG.Automation.ContextExposure"),
          source: `context:${profile.id}`,
          chat: false
        });
      }
      return result;
    });
  }

  async #handleLongRest(actor, result, config) {
    if (!game.user.isGM) return;
    const settings = getConfiguration().automation;
    const isLongRest = result?.longRest === true || config?.type === "long" || result?.type === "long";
    if (!settings.longRestEnabled || !isLongRest) return;
    if (settings.longRestGain) await this.#applyDailyGain(actor, settings.longRestGain, "GAG.Automation.LongRest");
    await this.actionService.processDailyMaintenance(actor, { source: "long-rest" });
  }

  async #handleCombatEnd(combat) {
    if (!this.#isPrimaryGm()) return;
    const settings = getConfiguration().automation;
    if (!settings.combatEndEnabled || !settings.combatEndGain) return;
    const actors = [...new Map((combat?.combatants ?? []).map((combatant) => [combatant.actor?.uuid, combatant.actor]).filter(([uuid]) => uuid)).values()];
    await mapWithConcurrency(actors, (actor) => this.#applyDailyGain(actor, settings.combatEndGain, "GAG.Automation.CombatEnd"));
  }

  async #handleWorldDay() {
    if (!this.#isPrimaryGm()) return;
    const settings = getConfiguration().automation;
    if (!settings.worldDayEnabled) return;
    const day = worldDay();
    const last = game.settings.get(MODULE_ID, SETTINGS.LAST_WORLD_DAY);
    if (day <= last) return;
    await game.settings.set(MODULE_ID, SETTINGS.LAST_WORLD_DAY, day);
    const actors = game.actors.filter((entry) => entry.type === "character");
    await mapWithConcurrency(actors, async (actor) => {
      if (settings.worldDayGain) await this.#applyDailyGain(actor, settings.worldDayGain, "GAG.Automation.WorldDay", day);
      return this.actionService.processDailyMaintenance(actor, { source: "world-day" });
    });
  }

  #isPrimaryGm() {
    if (!game.user.isGM || !game.user.active) return false;
    const primary = activeGm();
    return !primary || primary.id === game.user.id;
  }

  #reportError(areaKey, error) {
    const area = game.i18n.localize(areaKey);
    console.error(`[${MODULE_ID}] Automation failed during ${area}.`, error);
    ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
  }

  async #applyDailyGain(actor, amount, reasonKey, day = worldDay(), options = {}) {
    const settings = getConfiguration().automation;
    const state = this.stateService.getState(actor, { includeHidden: true });
    const bypassDailyLimit = options.extreme && settings.extremeBypassesDailyLimit;
    if (settings.oncePerDay && !bypassDailyLimit && state.lastDailyGainDay === day) return { skipped: true, reason: "daily-limit" };
    return this.stateService.adjustDirt(actor, amount, {
      system: true,
      dailyDay: day,
      reason: game.i18n.localize(reasonKey),
      source: options.source ?? "automation",
      chat: false
    });
  }
}
