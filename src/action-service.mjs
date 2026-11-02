import { HOOKS, MODULE_ID, PERMISSIONS, SETTINGS, SOCKET_NAME } from "./constants.mjs";
import { applyCleaningEffect, deepClone } from "./domain/state.mjs";
import { assertPermission, hasPermission } from "./permissions.mjs";
import { getConfiguration } from "./settings.mjs";
import { activeGm, label, notify, now, worldDay } from "./util.mjs";
import { postActionCard } from "./chat.mjs";
import { planSoapRequirement, itemStock } from "./soap-inventory.mjs";
import { resolveCleanlinessActor } from "./actor-resolution.mjs";

export class ActionService {
  constructor(registry, stateService, contextService, { onTransactionRecorded = null } = {}) {
    this.registry = registry;
    this.stateService = stateService;
    this.contextService = contextService;
    this.onTransactionRecorded = onTransactionRecorded;
    this.pendingTransactions = [];
    this.transactionFlushPromise = null;
    this.socketRegistered = false;
    this.missingGmWarningIssued = false;
    this.soapQueues = new Map();
  }

  registerSocketHandlers() {
    if (this.socketRegistered || !game.socket?.on) return false;
    game.socket.on(SOCKET_NAME, (payload) => {
      if (payload?.type !== "recordTransaction") return;
      void this.#handleRemoteTransaction(payload).catch((error) => {
        console.error(`[${MODULE_ID}] Failed to record a remote cleanliness transaction.`, error);
      });
    });
    this.socketRegistered = true;
    return true;
  }

  async cleanActor(actor, methodId, options = {}) {
    // Serialize concurrent soap washes on one client. Without this, two rapid
    // clicks can independently validate the same single inventory unit.
    const enforce = methodId === "soap" && getConfiguration().cleaning?.requireSoap === true
      && !(game.user.isGM && options.skipItemRequirements);
    if (!enforce) return this.#cleanActorUnlocked(actor, methodId, options);
    const key = resolveCleanlinessActor(actor)?.uuid ?? actor?.uuid;
    const previous = this.soapQueues.get(key) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(() => this.#cleanActorUnlocked(actor, methodId, options));
    this.soapQueues.set(key, operation);
    try { return await operation; }
    finally { if (this.soapQueues.get(key) === operation) this.soapQueues.delete(key); }
  }

  async #cleanActorUnlocked(actor, methodId, options = {}) {
    const method = this.registry.getCleaningMethod(methodId);
    if (!method?.enabled) throw new Error(game.i18n.format("GAG.Errors.UnknownMethod", { id: methodId }));
    if (options.costOverride) method.cost = deepClone(options.costOverride);
    this.#assertMethodAvailable(method, options);
    if (!game.user.isGM) {
      if (actor.testUserPermission(game.user, "OWNER")) assertPermission(PERMISSIONS.MODIFY_OWN_ACTIONS, { actor });
      else assertPermission(PERMISSIONS.MODIFY_OTHERS, { actor });
      if (!method.playerUsable && !options.system) throw new Error(game.i18n.localize("GAG.Errors.MethodNotPlayerUsable"));
      if ((method.cost?.amount ?? 0) > 0) assertPermission(PERMISSIONS.USE_SERVICES, { actor });
      if (methodId === "spare-clothing") assertPermission(PERMISSIONS.CHANGE_CLOTHES, { actor });
    }
    const safeOptions = this.#safeOptions(options);
    const prePayload = { actor, method: deepClone(method), options: safeOptions, user: game.user };
    if (Hooks.call(HOOKS.PRE_CLEAN, prePayload) === false) throw new Error(game.i18n.localize("GAG.Errors.ChangeVetoed"));

    // Resolve and validate all consumables before any currency is deducted.
    const requirements = await this.#resolveRequirements(actor, method, options);
    const payment = await this.#handlePayment(actor, method, options);
    if (!payment.success) {
      await this.#recordTransaction(actor, method, payment, { type: "cleaning" });
      notify("warn", payment.reason === "cancelled" ? "GAG.Notifications.PaymentCancelled" : "GAG.Notifications.PaymentFailed", {
        actor: actor.name,
        amount: method.cost.amount,
        currency: method.cost.currency
      });
      return { success: false, payment };
    }

    const consumed = await this.#consumeResolvedRequirements(requirements);
    const previous = this.stateService.getState(actor, { includeHidden: true });
    const next = await this.stateService.updateStateFromAction(actor, (state) => {
      const changedAt = now();
      const cleaned = applyCleaningEffect(state, method.effect);
      cleaned.lastCleaning = changedAt;
      if (method.effect.body && !options.preserveContaminations) cleaned.contaminations = [];
      for (const temporary of method.temporaryEffects ?? []) {
        if (temporary.id === "groomed") cleaned.groomedUntil = changedAt + Number(temporary.durationSeconds ?? 86400) * 1000;
        else cleaned.masking.push({ ...temporary, appliedAt: changedAt, expiresAt: changedAt + Number(temporary.durationSeconds ?? 0) * 1000 });
      }
      if (options.system && payment.recordedOnly && payment.paymentMode === "record") {
        cleaned.maintenanceDebt = Math.max(0, Number(cleaned.maintenanceDebt ?? 0) + Number(payment.amount ?? 0));
      }
      if (options.maintenanceDay !== undefined) cleaned.lastMaintenanceDay = Number(options.maintenanceDay);
      return cleaned;
    }, { ...safeOptions, silent: true, reason: options.reason ?? label(method) });

    await this.#recordTransaction(actor, method, payment, { type: "cleaning", consumed });
    if (options.chat !== false) {
      const permission = !options.system && !game.user.isGM ? PERMISSIONS.VIEW_CLEANING_CHAT : PERMISSIONS.VIEW_STATE_CHAT;
      await postActionCard({ actor, previous, next, method, cost: method.cost, consumed, hidden: Boolean(options.hidden), titleKey: "GAG.Chat.Cleaned", permission });
    }
    Hooks.callAll(HOOKS.CLEANED, { actor, method: deepClone(method), previous, next: deepClone(next), payment, consumed, options: safeOptions });
    notify("info", "GAG.Notifications.Cleaned", { actor: actor.name, method: label(method) });
    return { success: true, state: next, payment, consumed };
  }

  async applyMasking(actor, masking, options = {}) {
    return this.stateService.updateStateFromAction(actor, (state) => {
      const changedAt = now();
      state.masking = state.masking.filter((entry) => entry.id !== masking.id);
      state.masking.push({
        ...masking,
        appliedAt: changedAt,
        expiresAt: masking.durationSeconds ? changedAt + Number(masking.durationSeconds) * 1000 : null,
        source: options.source ?? ""
      });
      return state;
    }, options);
  }

  async processDailyMaintenance(actor, options = {}) {
    const config = getConfiguration().dailyUpkeep;
    const state = this.stateService.getState(actor, { includeHidden: true });
    if (!config.enabled || !state.autoMaintenance || state.maintenanceExempt) return { success: false, skipped: true, reason: "disabled" };
    const day = Number(options.day ?? worldDay());
    if (state.lastMaintenanceDay === day) return { success: false, skipped: true, reason: "daily-limit" };
    const baseMethod = this.registry.getCleaningMethod(config.methodId) ?? this.registry.getCleaningMethod("daily-upkeep");
    const method = deepClone(baseMethod);
    method.cost = { amount: Number(config.cost), currency: config.currency };
    const result = await this.cleanActor(actor, method.id, {
      ...options,
      system: true,
      paymentMode: config.paymentMode,
      automaticDeduction: config.automaticDeduction,
      promptBeforePayment: config.promptBeforePayment,
      enforceAvailability: config.settlementRequired,
      costOverride: method.cost,
      maintenanceDay: day,
      chat: false,
      reason: game.i18n.localize("GAG.DailyUpkeep.Reason")
    });
    Hooks.callAll(HOOKS.MAINTENANCE_PROCESSED, { actor, result, config: deepClone(config) });
    return result;
  }

  async settleMaintenanceDebt(actor, options = {}) {
    if (!game.user.isGM) {
      if (actor.testUserPermission(game.user, "OWNER")) assertPermission(PERMISSIONS.USE_SERVICES, { actor });
      else assertPermission(PERMISSIONS.MODIFY_OTHERS, { actor });
    }
    const state = this.stateService.getState(actor, { includeHidden: true });
    const amount = Math.max(0, Number(state.maintenanceDebt ?? 0));
    const configuration = getConfiguration();
    const currency = configuration.dailyUpkeep.currency || configuration.currency.defaultLabel;
    if (!amount) return { success: true, amount: 0, currency, deducted: false, reason: "no-debt" };

    let payment = { success: true, amount, currency, deducted: false, recordedOnly: true };
    if (options.deduct) {
      const adapter = this.registry.getCurrencyAdapter(configuration.currency.adapterId);
      if (!adapter) throw new Error(game.i18n.localize("GAG.Errors.CurrencyAdapterMissing"));
      if (!(await adapter.canAfford(actor, amount, currency, options))) {
        payment = { success: false, amount, currency, deducted: false, reason: "insufficient" };
      } else {
        payment = { amount, currency, ...(await adapter.deduct(actor, amount, currency, options)) };
      }
    }
    if (!payment.success) {
      notify("warn", "GAG.Notifications.PaymentFailed", { actor: actor.name, amount, currency });
      return payment;
    }

    await this.stateService.updateStateFromAction(actor, (draft) => {
      draft.maintenanceDebt = 0;
      return draft;
    }, { chat: false, silent: true, reason: game.i18n.localize("GAG.DailyUpkeep.DebtSettled") });
    await this.#recordTransaction(actor, { id: "maintenance-settlement", name: game.i18n.localize("GAG.DailyUpkeep.DebtSettlement") }, payment, { type: "maintenance-settlement" });
    notify("info", "GAG.Notifications.DebtSettled", { actor: actor.name, amount, currency });
    return payment;
  }

  #assertMethodAvailable(method, options) {
    const methodSettlementTypes = new Set((method.settlementTypes ?? []).map((entry) => String(entry).trim()).filter(Boolean));
    const settlementBound = !methodSettlementTypes.has("any");
    const enforce = options.enforceAvailability ?? (!game.user.isGM && settlementBound);
    if (!enforce || options.ignoreAvailability || !settlementBound) return;

    const profile = this.contextService?.getProfile(options.scene ?? canvas?.scene);
    if (!profile) return;

    const explicitlyAvailable = (profile.serviceAvailability ?? []).includes(method.id);
    const profileSettlementTypes = new Set([
      profile.id,
      ...(profile.settlementTypes ?? [])
    ].map((entry) => String(entry).trim()).filter(Boolean));
    const settlementTypeMatches = [...methodSettlementTypes].some((entry) => profileSettlementTypes.has(entry));
    if (explicitlyAvailable || settlementTypeMatches) return;

    throw new Error(game.i18n.format("GAG.Errors.ServiceUnavailable", { method: label(method), context: label(profile) }));
  }

  async #handlePayment(actor, method, options) {
    const configuredCost = options.costOverride ?? method.cost ?? {};
    const amount = Number(configuredCost.amount ?? 0);
    const configuration = getConfiguration();
    const currency = configuredCost.currency ?? configuration.currency.defaultLabel;
    if (options.waiveCost || amount <= 0) return { success: true, amount: 0, currency, deducted: false, waived: true, paymentMode: "waived" };
    const daily = configuration.dailyUpkeep;
    const paymentMode = options.paymentMode ?? (options.system ? daily.paymentMode : "automatic");
    const shouldDeduct = options.automaticDeduction ?? (paymentMode === "automatic" && daily.automaticDeduction);
    if (!shouldDeduct || paymentMode === "record" || paymentMode === "none") {
      return { success: true, amount, currency, deducted: false, recordedOnly: true, paymentMode };
    }
    if (options.promptBeforePayment) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("GAG.DailyUpkeep.PaymentPromptTitle") },
        content: `<p>${foundry.utils.escapeHTML(game.i18n.format("GAG.DailyUpkeep.PaymentPrompt", { actor: actor.name, amount, currency }))}</p>`
      });
      if (!confirmed) return { success: false, amount, currency, deducted: false, reason: "cancelled", paymentMode };
    }
    const adapterId = configuration.currency.adapterId;
    const adapter = this.registry.getCurrencyAdapter(adapterId);
    if (!adapter) throw new Error(game.i18n.format("GAG.Errors.CurrencyAdapterMissing", { id: adapterId }));
    const canAfford = await adapter.canAfford(actor, amount, currency, options);
    if (!canAfford) return { success: false, amount, currency, deducted: false, reason: "insufficient", paymentMode };
    return { amount, currency, paymentMode, ...(await adapter.deduct(actor, amount, currency, options)) };
  }

  async #resolveRequirements(actor, method, options) {
    const consumed = [...(Array.isArray(options.consumed) ? options.consumed : [])];
    const resolved = new Map();

    const add = (item, quantity) => {
      const amount = Math.max(0, Number(quantity ?? 0));
      if (!amount) return;
      const key = item.uuid ?? item.id;
      const existing = resolved.get(key);
      const total = amount + Number(existing?.quantity ?? 0);
      const current = itemStock(item);
      if (current < total) throw new Error(game.i18n.format("GAG.Errors.RequiredItemMissing", { item: item.name }));
      resolved.set(key, { item, quantity: total });
    };

    if (options.consumeItemUuid && Number(options.consumeItemQuantity ?? 0) > 0) {
      if (!game.user.isGM) assertPermission(PERMISSIONS.CONSUME_ITEMS, { actor });
      const item = await foundry.utils.fromUuid(options.consumeItemUuid);
      if (!item || item.actor?.uuid !== actor.uuid) throw new Error(game.i18n.localize("GAG.Errors.ItemIntegrationMissing"));
      add(item, options.consumeItemQuantity);
    }

    const soapSettings = getConfiguration().cleaning ?? {};
    const enforceSoap = method.id === "soap" && soapSettings.requireSoap === true
      && !(game.user.isGM && options.skipItemRequirements);
    const inventoryActor = resolveCleanlinessActor(actor);
    if (!options.skipItemRequirements) {
      const itemsByIntegration = new Map();
      const itemsByName = new Map();
      for (const item of inventoryActor.items ?? []) {
        const integrationId = item.getFlag(MODULE_ID, "itemIntegration");
        if (integrationId && !itemsByIntegration.has(integrationId)) itemsByIntegration.set(integrationId, item);
        const normalizedName = String(item.name ?? "").toLocaleLowerCase();
        if (normalizedName && !itemsByName.has(normalizedName)) itemsByName.set(normalizedName, item);
      }
      for (const requirement of method.itemRequirements ?? []) {
        // The configured enforced soap rule replaces any legacy optional or
        // manually edited soap requirement, avoiding double consumption.
        if (enforceSoap && requirement.integrationId === "soap") continue;
        const integration = this.registry.getItemIntegration(requirement.integrationId, { clone: false });
        let matching = itemsByIntegration.get(requirement.integrationId);
        if (!matching) {
          for (const alias of integration?.aliases ?? []) {
            matching = itemsByName.get(String(alias).toLocaleLowerCase());
            if (matching) break;
          }
        }
        if (!matching) {
          if (requirement.optional) continue;
          throw new Error(game.i18n.format("GAG.Errors.RequiredItemMissing", { item: integration?.labelKey ? game.i18n.localize(integration.labelKey) : requirement.integrationId }));
        }
        const quantity = Math.max(0, Number(requirement.quantity ?? 1));
        if (requirement.optional && itemStock(matching) < quantity) continue;
        if (quantity > 0 && !game.user.isGM) assertPermission(PERMISSIONS.CONSUME_ITEMS, { actor });
        add(matching, quantity);
      }
    }

    if (enforceSoap) {
      const plan = planSoapRequirement(inventoryActor, this.registry, {
        quantity: soapSettings.soapQuantity ?? 1,
        consume: soapSettings.consumeSoap !== false,
        reserved: [...resolved.values()]
      });
      if (!plan.success) throw new Error(game.i18n.format("GAG.Errors.RequiredItemMissing", {
        item: `${game.i18n.localize("GAG.Items.Soap")} (${plan.required})`
      }));
      if (plan.items.length && !game.user.isGM) assertPermission(PERMISSIONS.CONSUME_ITEMS, { actor: inventoryActor });
      for (const { item, quantity } of plan.items) add(item, quantity);
    }
    return { items: [...resolved.values()], consumed };
  }

  async #consumeResolvedRequirements(requirements) {
    const consumed = [...requirements.consumed];
    const updates = [];
    for (const { item, quantity } of requirements.items) {
      const current = itemStock(item);
      if (current < quantity) throw new Error(game.i18n.format("GAG.Errors.RequiredItemMissing", { item: item.name }));
      updates.push({ item, quantity, current, data: { _id: item.id, "system.quantity": Math.max(0, current - quantity) } });
    }

    const parent = updates[0]?.item?.parent ?? updates[0]?.item?.actor ?? null;
    if (updates.length > 1 && parent?.updateEmbeddedDocuments) {
      await parent.updateEmbeddedDocuments("Item", updates.map((entry) => entry.data), { garbAndGrime: true });
    } else {
      await Promise.all(updates.map((entry) => entry.item.update({ "system.quantity": entry.data["system.quantity"] }, { garbAndGrime: true })));
    }

    for (const { item, quantity } of updates) {
      const description = `${item.name} ×${quantity}`;
      if (!consumed.includes(description)) consumed.push(description);
    }
    return consumed;
  }

  async #recordTransaction(actor, method, payment, extra = {}) {
    const entry = {
      id: foundry.utils.randomID(),
      timestamp: now(),
      userId: game.user.id,
      actorUuid: actor.uuid,
      actorName: actor.name,
      methodId: method.id,
      methodName: label(method),
      amount: payment.amount ?? 0,
      currency: payment.currency ?? method.cost?.currency ?? "Mark",
      deducted: Boolean(payment.deducted),
      success: payment.success !== false,
      reason: payment.reason ?? "",
      ...extra
    };
    if (game.user.isGM) await this.#enqueueTransaction(entry);
    else this.#submitRemoteTransaction(entry);
    return entry;
  }

  #submitRemoteTransaction(entry) {
    const primary = activeGm();
    if (!primary) {
      if (!this.missingGmWarningIssued) {
        this.missingGmWarningIssued = true;
        console.warn(`[${MODULE_ID}] A player cleanliness transaction could not be persisted because no active GM is connected.`);
      }
      return false;
    }
    if (!game.socket?.emit) {
      console.error(`[${MODULE_ID}] A player cleanliness transaction could not be persisted because the Foundry socket is unavailable.`);
      return false;
    }
    game.socket.emit(SOCKET_NAME, { type: "recordTransaction", entry });
    return true;
  }

  async #handleRemoteTransaction(payload) {
    if (!game.user.isGM || !game.user.active) return false;
    const primary = activeGm();
    if (primary && primary.id !== game.user.id) return false;
    const submitted = payload?.entry;
    if (!submitted || typeof submitted !== "object") return false;

    const actor = await foundry.utils.fromUuid?.(String(submitted.actorUuid ?? ""));
    if (!actor || actor.documentName !== "Actor") return false;
    const user = game.users?.get?.(String(submitted.userId ?? ""))
      ?? [...(game.users ?? [])].find((entry) => entry.id === submitted.userId);
    if (!user || user.isGM) return false;
    const ownsActor = Boolean(actor.testUserPermission?.(user, "OWNER"));
    const permitted = ownsActor
      ? hasPermission(PERMISSIONS.MODIFY_OWN_ACTIONS, { user, actor })
      : hasPermission(PERMISSIONS.MODIFY_OTHERS, { user, actor });
    if (!permitted) return false;

    const method = submitted.methodId === "maintenance-settlement"
      ? { id: "maintenance-settlement", name: game.i18n.localize("GAG.DailyUpkeep.DebtSettlement") }
      : this.registry.getCleaningMethod(String(submitted.methodId ?? ""));
    if (!method) return false;

    const amount = Number(submitted.amount ?? 0);
    const timestamp = Number(submitted.timestamp);
    const sanitized = {
      id: String(submitted.id ?? foundry.utils.randomID()).slice(0, 128),
      timestamp: Number.isFinite(timestamp) ? timestamp : now(),
      userId: user.id,
      actorUuid: actor.uuid,
      actorName: actor.name,
      methodId: method.id,
      methodName: label(method),
      amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
      currency: String(submitted.currency ?? method.cost?.currency ?? "Mark").slice(0, 64),
      deducted: Boolean(submitted.deducted),
      success: submitted.success !== false,
      reason: String(submitted.reason ?? "").slice(0, 500),
      type: ["cleaning", "maintenance-settlement"].includes(submitted.type) ? submitted.type : "cleaning",
      consumed: Array.isArray(submitted.consumed) ? submitted.consumed.slice(0, 20).map((value) => String(value).slice(0, 200)) : []
    };
    await this.#enqueueTransaction(sanitized);
    return true;
  }

  #enqueueTransaction(entry) {
    this.pendingTransactions.push(entry);
    if (!this.transactionFlushPromise) {
      this.transactionFlushPromise = new Promise((resolve, reject) => {
        queueMicrotask(async () => {
          try {
            while (this.pendingTransactions.length) {
              const batch = this.pendingTransactions.splice(0);
              const current = game.settings.get(MODULE_ID, SETTINGS.TRANSACTION_LOG) ?? [];
              const ids = new Set(current.map((value) => value?.id).filter(Boolean));
              const uniqueBatch = [];
              for (const value of batch) {
                if (!value?.id || ids.has(value.id)) continue;
                ids.add(value.id);
                uniqueBatch.push(value);
              }
              if (!uniqueBatch.length) continue;
              await game.settings.set(MODULE_ID, SETTINGS.TRANSACTION_LOG, [...current, ...uniqueBatch].slice(-500));
              this.onTransactionRecorded?.(uniqueBatch);
            }
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            this.transactionFlushPromise = null;
          }
        });
      });
    }
    return this.transactionFlushPromise;
  }

  #safeOptions(options) {
    const clone = {};
    for (const [key, value] of Object.entries(options ?? {})) {
      if (typeof value === "function") continue;
      if (value?.documentName) clone[key] = value.uuid ?? value.id ?? null;
      else clone[key] = value;
    }
    return deepClone(clone);
  }
}
