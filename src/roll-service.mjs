import { HOOKS, PERMISSIONS } from "./constants.mjs";
import { evaluateRoll } from "./domain/rules.mjs";
import { hasPermission } from "./permissions.mjs";
import { getConfiguration } from "./settings.mjs";

const RECOMMENDED_ADVANTAGE = new Set(["advantage"]);
const RECOMMENDED_DISADVANTAGE = new Set(["disadvantage"]);

export class RollService {
  #recent = new Map();

  constructor(registry, stateService, contextService) {
    this.registry = registry;
    this.stateService = stateService;
    this.contextService = contextService;
  }

  evaluateRollContext(actor, rollType, options = {}) {
    const {
      state: preparedState,
      profile: preparedProfile,
      contaminations: preparedContaminations,
      emitHook = true,
      ...publicOptions
    } = options;
    const includeHidden = game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor });
    const state = preparedState ?? this.stateService.getState(actor, { includeHidden });
    const profile = preparedProfile ?? this.contextService.getProfile(options.scene ?? canvas?.scene);
    const result = evaluateRoll({
      state,
      profile,
      skillId: rollType,
      contaminations: preparedContaminations ?? this.registry.listContaminations({ clone: false }),
      enhancedSmell: Boolean(options.enhancedSmell)
    });
    if (emitHook) Hooks.callAll(HOOKS.ROLL_EVALUATED, { actor, rollType, options: publicOptions, result });
    return result;
  }

  async promptRollContext(actor, rollType, options = {}) {
    const result = options.result ?? this.evaluateRollContext(actor, rollType, options);
    const reason = game.i18n.format(result.reasonKey, { actor: actor.name });
    const recommendation = this.#recommendationLabel(result.mode);
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("GAG.RollChoice.Title") },
      position: { width: 560 },
      content: `<div class="garb-and-grime gag-roll-choice"><p><strong>${foundry.utils.escapeHTML(reason)}</strong></p><p>${foundry.utils.escapeHTML(game.i18n.format("GAG.RollChoice.Recommendation", { mode: recommendation }))}</p><p class="hint">${foundry.utils.escapeHTML(game.i18n.localize("GAG.RollChoice.Explanation"))}</p></div>`,
      modal: true,
      rejectClose: false,
      buttons: [
        {
          action: "advantage",
          label: "GAG.RollChoice.Advantage",
          icon: "fa-solid fa-angles-up",
          default: RECOMMENDED_ADVANTAGE.has(result.mode)
        },
        {
          action: "normal",
          label: "GAG.RollChoice.Normal",
          icon: "fa-solid fa-minus",
          default: !RECOMMENDED_ADVANTAGE.has(result.mode) && !RECOMMENDED_DISADVANTAGE.has(result.mode)
        },
        {
          action: "disadvantage",
          label: "GAG.RollChoice.Disadvantage",
          icon: "fa-solid fa-angles-down",
          default: RECOMMENDED_DISADVANTAGE.has(result.mode)
        },
        {
          action: "ignore",
          label: "GAG.RollChoice.Ignore",
          icon: "fa-solid fa-eye-slash"
        }
      ]
    });

    if (!choice) return { choice: null, result, rolls: null };
    const rolls = await this.#rerollWithChoice(actor, rollType, choice, options);
    return { choice, result, rolls };
  }

  registerHooks() {
    Hooks.on("dnd5e.preRollSkillV2", (config, dialog, message) => {
      const settings = getConfiguration().rolls;
      const actor = config?.subject;
      const skillId = config?.skill;
      if (!settings.enabled || !actor || !skillId || !settings.skills.includes(skillId)) return;
      if (config.garbAndGrime?.resolved) return;

      const result = this.evaluateRollContext(actor, skillId, {
        enhancedSmell: Boolean(config.garbAndGrime?.enhancedSmell)
      });
      if (result.mode === "normal") return;
      this.#notify(actor, skillId, result, settings);

      if (settings.mode === "automatic") {
        this.#applyRecommendation(config, result);
        return;
      }
      if (settings.mode !== "prompt" || !game.user.isGM) return;

      void this.promptRollContext(actor, skillId, {
        result,
        originalConfig: config,
        originalDialog: dialog,
        originalMessage: message,
        enhancedSmell: Boolean(config.garbAndGrime?.enhancedSmell)
      }).catch((error) => {
        console.error(`${game.modules.get("runyth-garb-and-grime")?.title ?? "Runyth Garb & Grime"} | Roll prompt failed`, error);
        ui.notifications.error(game.i18n.localize("GAG.Errors.Unexpected"));
      });
      return false;
    });
  }

  #notify(actor, skillId, result, settings) {
    const key = `${actor.uuid}:${skillId}:${result.profileId}:${result.mode}`;
    const now = Date.now();
    const expiry = this.#recent.get(key) ?? 0;
    if (expiry > now) return;
    this.#recent.set(key, now + Number(settings.dedupeSeconds ?? 10) * 1000);
    for (const [entry, until] of this.#recent) if (until <= now) this.#recent.delete(entry);
    const text = game.i18n.format(result.reasonKey, { actor: actor.name });
    if (game.user.isGM && settings.notifyGm) ui.notifications.info(text);
    else if (!game.user.isGM && settings.notifyPlayers) ui.notifications.info(text);
  }

  #applyRecommendation(config, result) {
    if (RECOMMENDED_ADVANTAGE.has(result.mode)) config.advantage = true;
    if (RECOMMENDED_DISADVANTAGE.has(result.mode)) config.disadvantage = true;
  }

  async #rerollWithChoice(actor, skillId, choice, options) {
    const original = options.originalConfig ?? {};
    const config = { ...original, skill: skillId };
    delete config.subject;
    delete config.hookNames;
    config.rolls = original.rolls?.map((roll) => foundry.utils.deepClone(roll));
    config.garbAndGrime = {
      ...(original.garbAndGrime ?? {}),
      resolved: true,
      choice
    };

    if (choice === "advantage") {
      config.advantage = true;
      config.disadvantage = false;
    } else if (choice === "normal") {
      config.advantage = false;
      config.disadvantage = false;
    } else if (choice === "disadvantage") {
      config.advantage = false;
      config.disadvantage = true;
    }

    const dialog = { ...(options.originalDialog ?? {}) };
    if (dialog.options) dialog.options = { ...dialog.options };
    const message = { ...(options.originalMessage ?? {}) };
    if (message.data) message.data = foundry.utils.deepClone(message.data);
    return actor.rollSkill(config, dialog, message);
  }

  #recommendationLabel(mode) {
    if (RECOMMENDED_ADVANTAGE.has(mode)) return game.i18n.localize("GAG.RollChoice.Advantage");
    if (RECOMMENDED_DISADVANTAGE.has(mode)) return game.i18n.localize("GAG.RollChoice.Disadvantage");
    if (mode === "blocked") return game.i18n.localize("GAG.RollChoice.Blocked");
    if (mode === "possible-advantage") return game.i18n.localize("GAG.RollChoice.PossibleAdvantage");
    if (mode === "possible-disadvantage") return game.i18n.localize("GAG.RollChoice.PossibleDisadvantage");
    if (mode === "advantage-opponent") return game.i18n.localize("GAG.RollChoice.AdvantageOpponent");
    return game.i18n.localize("GAG.RollChoice.Normal");
  }
}
