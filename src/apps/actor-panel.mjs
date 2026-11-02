import { MODULE_ID, PERMISSIONS } from "../constants.mjs";
import { canModifyActor, hasPermission } from "../permissions.mjs";
import { label, scheduleApplicationRender } from "../util.mjs";
import { PersistentApplication } from "./persistent-app.mjs";
import { installActorImageFallback, reportActorImageIssues, resolveActorDisplayImage } from "../display-images.mjs";

let services;
export function configureActorPanelServices(value) { services = value; }

export class ActorCleanlinessPanel extends PersistentApplication {
  static DEFAULT_OPTIONS = {
    id: "garb-and-grime-actor-panel",
    classes: ["runyth-garb-and-grime", "gag-window", "gag-actor-panel"],
    position: { width: 720, height: 700 },
    window: { icon: "fa-solid fa-shirt", title: "GAG.ActorPanel.Title", resizable: true },
    actions: {
      clean: ActorCleanlinessPanel.onClean,
      adjust: ActorCleanlinessPanel.onAdjust,
      applyContamination: ActorCleanlinessPanel.onApplyContamination,
      removeContamination: ActorCleanlinessPanel.onRemoveContamination,
      saveState: ActorCleanlinessPanel.onSaveState,
      toggleMaintenance: ActorCleanlinessPanel.onToggleMaintenance,
      reset: ActorCleanlinessPanel.onReset,
      evaluate: ActorCleanlinessPanel.onEvaluate,
      settleDebt: ActorCleanlinessPanel.onSettleDebt
    }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/actor-panel.hbs` } };

  constructor(options = {}) {
    const actorKey = String(options.actor?.uuid ?? options.actor?.id ?? "actor").replace(/[^A-Za-z0-9_-]/g, "-");
    super({ ...options, id: `${MODULE_ID}-actor-panel-${actorKey}` });
    this.actor = options.actor;
  }

  get windowKey() { return `ActorCleanlinessPanel`; }

  async _prepareContext() {
    const actor = this.actor;
    const state = services.stateService.getState(actor, { includeHidden: game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor }) });
    const canModify = canModifyActor(actor);
    const canManuallyEdit = game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor });
    const displayImage = resolveActorDisplayImage(actor);
    reportActorImageIssues([{ name: actor.name, issue: displayImage.issue }]);
    return {
      actor: { uuid: actor.uuid, name: actor.name, img: displayImage.src, imageSource: displayImage.requestedSrc, imageFallback: displayImage.fallback, type: actor.type },
      state,
      dirtLevels: [0, 1, 2, 3].map((level) => ({ level, label: game.i18n.localize(`GAG.Levels.${level}.Name`), selectedBody: state.body.level === level, selectedClothing: state.clothing.level === level })),
      methods: services.registry.listCleaningMethods().filter((method) => method.enabled && (game.user.isGM || method.playerUsable)).map((method) => ({ ...method, label: label(method), description: method.descriptionKey ? game.i18n.localize(method.descriptionKey) : method.description ?? "", costLabel: `${method.cost.amount} ${method.cost.currency}`, timeLabel: `${method.time.value} ${game.i18n.localize(`GAG.Time.${method.time.unit}`)}` })),
      contaminations: services.registry.listContaminations().map((definition) => ({ ...definition, label: label(definition) })),
      activeContaminations: state.contaminations.map((entry) => {
        const definition = services.registry.getContamination(entry.id, { clone: false });
        return { ...entry, label: definition ? label(definition) : entry.id, hiddenLabel: entry.hidden ? game.i18n.localize("GAG.Common.Hidden") : "" };
      }),
      canModify,
      canManuallyEdit,
      canApplyContamination: game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS),
      canViewGm: game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS),
      levelLabel: game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Name`),
      profileLabel: label(services.contextService.getProfile(canvas?.scene)),
      evaluation: services.rollService.evaluateRollContext(actor, "per"),
      maintenanceDebtLabel: `${state.maintenanceDebt ?? 0} ${services.getConfiguration?.().dailyUpkeep?.currency ?? game.i18n.localize("GAG.Currency.Mark")}`,
      hasMaintenanceDebt: Number(state.maintenanceDebt ?? 0) > 0,
      canDeductDebt: services.registry.getCurrencyAdapter(services.getConfiguration?.().currency?.adapterId ?? "record-only")?.id !== "record-only"
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._gagImageListeners?.abort();
    this._gagImageListeners = new AbortController();
    installActorImageFallback(this.element, { signal: this._gagImageListeners.signal });
  }

  async _onClose(options) {
    this._gagImageListeners?.abort();
    return super._onClose(options);
  }

  static async onClean(event, target) {
    try {
      await services.actionService.cleanActor(this.actor, target.dataset.methodId);
      scheduleApplicationRender(this);
    } catch (error) {
      console.error(`[${MODULE_ID}] Actor cleanliness action failed.`, error);
      ui.notifications.error(error.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
    }
  }

  static async onAdjust(event, target) {
    if (!game.user.isGM && !hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor: this.actor })) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    await services.stateService.adjustDirt(this.actor, Number(target.dataset.amount), { reason: game.i18n.localize("GAG.Actions.ManualAdjustment") });
    scheduleApplicationRender(this);
  }

  static async onApplyContamination() {
    const select = this.element.querySelector("[name=contaminationId]");
    const hidden = this.element.querySelector("[name=contaminationHidden]")?.checked;
    if (!select?.value) return;
    await services.stateService.applyContamination(this.actor, select.value, { hidden, reason: game.i18n.localize("GAG.Actions.ApplyContamination") });
    scheduleApplicationRender(this);
  }

  static async onRemoveContamination(event, target) {
    await services.stateService.removeContamination(this.actor, target.dataset.contaminationId, { reason: game.i18n.localize("GAG.Actions.RemoveContamination") });
    scheduleApplicationRender(this);
  }

  static async onSaveState() {
    if (!game.user.isGM && !hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor: this.actor })) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    const form = this.element.querySelector("form[data-gag-state-form]");
    if (!form) return;
    const data = new FormData(form);
    await services.stateService.updateState(this.actor, (state) => {
      state.body.level = Number(data.get("bodyLevel"));
      state.body.clean = state.body.level === 0;
      state.clothing.level = Number(data.get("clothingLevel"));
      state.clothing.clean = state.clothing.level === 0;
      state.dirtLevel = Math.max(state.body.level, state.clothing.level);
      state.gmNotes = game.user.isGM ? String(data.get("gmNotes") ?? "").slice(0, 4000) : state.gmNotes;
      return state;
    }, { reason: String(data.get("reason") ?? ""), hidden: true, chat: false });
    ui.notifications.info(game.i18n.localize("GAG.Notifications.Saved"));
    scheduleApplicationRender(this);
  }

  static async onToggleMaintenance() {
    const state = services.stateService.getState(this.actor, { includeHidden: true });
    await services.stateService.setAutomaticMaintenance(this.actor, !state.autoMaintenance, { reason: game.i18n.localize("GAG.Actions.ToggleMaintenance") });
    scheduleApplicationRender(this);
  }

  static async onReset() {
    if (!game.user.isGM && !hasPermission(PERMISSIONS.MODIFY_OTHERS, { actor: this.actor })) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("GAG.Confirm.ResetTitle") },
      content: `<p>${foundry.utils.escapeHTML(game.i18n.localize("GAG.Confirm.ResetText"))}</p>`,
      yes: { default: true }
    });
    if (!confirmed) return;
    await services.stateService.setDirtLevel(this.actor, 0, { reason: game.i18n.localize("GAG.Actions.Reset") });
    await services.stateService.updateState(this.actor, (state) => {
      state.contaminations = [];
      state.masking = [];
      state.groomedUntil = null;
      return state;
    }, { chat: false, reason: game.i18n.localize("GAG.Actions.Reset") });
    scheduleApplicationRender(this);
  }

  static async onSettleDebt(event, target) {
    try {
      await services.actionService.settleMaintenanceDebt(this.actor, { deduct: target.dataset.deduct === "true" });
      scheduleApplicationRender(this);
    } catch (error) {
      console.error(`[${MODULE_ID}] Actor cleanliness action failed.`, error);
      ui.notifications.error(error.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
    }
  }

  static async onEvaluate(event, target) {
    const options = { enhancedSmell: target.dataset.enhancedSmell === "true" };
    if (game.user.isGM) {
      await services.rollService.promptRollContext(this.actor, target.dataset.skillId, options);
      return;
    }
    const result = services.rollService.evaluateRollContext(this.actor, target.dataset.skillId, options);
    ui.notifications.info(game.i18n.format(result.reasonKey, { actor: this.actor.name }));
  }
}
