// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "./constants.mjs";
import { getConfiguration } from "./settings.mjs";

export function registerBuiltInCurrencyAdapters(registry) {
  registry.registerCurrencyAdapter({
    id: "record-only",
    label: "GAG.Currency.RecordOnly",
    async getBalance() { return Number.POSITIVE_INFINITY; },
    async canAfford() { return true; },
    async deduct() { return { success: true, deducted: false, recordedOnly: true }; }
  }, { replace: true });

  registry.registerCurrencyAdapter({
    id: "dnd5e",
    label: "GAG.Currency.Dnd5e",
    async getBalance(actor, currency) {
      const config = getConfiguration();
      const denomination = config.currency.dnd5eDenomination;
      if (!denomination) throw new Error(game.i18n.localize("GAG.Errors.CurrencyDenominationMissing"));
      const value = foundry.utils.getProperty(actor, `system.currency.${denomination}`);
      return Number(value) || 0;
    },
    async canAfford(actor, amount, currency) {
      return (await this.getBalance(actor, currency)) >= Number(amount || 0);
    },
    async deduct(actor, amount, currency, options = {}) {
      const config = getConfiguration();
      const denomination = config.currency.dnd5eDenomination;
      if (!denomination) throw new Error(game.i18n.localize("GAG.Errors.CurrencyDenominationMissing"));
      const current = await this.getBalance(actor, currency);
      const cost = Number(amount || 0);
      if (current < cost) return { success: false, reason: "insufficient", balance: current };
      await actor.update({ [`system.currency.${denomination}`]: current - cost }, { garbAndGrime: true, ...options });
      return { success: true, deducted: true, balance: current - cost };
    }
  }, { replace: true });

  registry.registerCurrencyAdapter({
    id: "actor-flag-wallet",
    label: "GAG.Currency.ActorFlagWallet",
    async getBalance(actor, currency) {
      const path = getConfiguration().currency.flagPath || `flags.${MODULE_ID}.wallet`;
      const wallet = foundry.utils.getProperty(actor, path) ?? {};
      return Number(wallet[currency]) || 0;
    },
    async canAfford(actor, amount, currency) {
      return (await this.getBalance(actor, currency)) >= Number(amount || 0);
    },
    async deduct(actor, amount, currency, options = {}) {
      const path = getConfiguration().currency.flagPath || `flags.${MODULE_ID}.wallet`;
      const current = await this.getBalance(actor, currency);
      const cost = Number(amount || 0);
      if (current < cost) return { success: false, reason: "insufficient", balance: current };
      await actor.update({ [`${path}.${currency}`]: current - cost }, { garbAndGrime: true, ...options });
      return { success: true, deducted: true, balance: current - cost };
    }
  }, { replace: true });
}
