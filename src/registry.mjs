// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  DEFAULT_CLEANING_METHODS,
  DEFAULT_CONTAMINATIONS,
  DEFAULT_ENVIRONMENT_PROFILES,
  DEFAULT_ITEM_INTEGRATIONS
} from "./defaults.mjs";
import { deepClone } from "./domain/state.mjs";
import { validateContamination, validateItemIntegration, validateMethod, validateProfile } from "./domain/validation.mjs";
import { localizedError } from "./localization.mjs";

const DEFAULT_PROFILES_BY_ID = new Map(DEFAULT_ENVIRONMENT_PROFILES.map((profile) => [profile.id, profile]));

function prepareWorldProfile(definition) {
  const preset = DEFAULT_PROFILES_BY_ID.get(definition?.id);
  if (!preset || (Array.isArray(definition?.levelRatings) && definition.levelRatings.length === 4)) return definition;
  return { ...definition, levelRatings: deepClone(preset.levelRatings) };
}

export class DefinitionRegistry {
  #methods = new Map();
  #contaminations = new Map();
  #profiles = new Map();
  #items = new Map();
  #currencies = new Map();

  constructor() {
    this.resetDefinitions();
  }

  resetDefinitions() {
    const extensions = {
      methods: [...this.#methods.values()].filter((entry) => entry.source === "extension"),
      contaminations: [...this.#contaminations.values()].filter((entry) => entry.source === "extension"),
      profiles: [...this.#profiles.values()].filter((entry) => entry.source === "extension"),
      items: [...this.#items.values()].filter((entry) => entry.source === "extension")
    };
    this.#methods.clear();
    this.#contaminations.clear();
    this.#profiles.clear();
    this.#items.clear();
    for (const value of DEFAULT_CLEANING_METHODS) this.registerCleaningMethod(value, { replace: true, source: "core" });
    for (const value of DEFAULT_CONTAMINATIONS) this.registerContamination(value, { replace: true, source: "core" });
    for (const value of DEFAULT_ENVIRONMENT_PROFILES) this.registerEnvironmentProfile(value, { replace: true, source: "core" });
    for (const value of DEFAULT_ITEM_INTEGRATIONS) this.registerItemIntegration(value, { replace: true, source: "core" });
    for (const value of extensions.methods) this.registerCleaningMethod(value, { replace: true, source: "extension" });
    for (const value of extensions.contaminations) this.registerContamination(value, { replace: true, source: "extension" });
    for (const value of extensions.profiles) this.registerEnvironmentProfile(value, { replace: true, source: "extension" });
    for (const value of extensions.items) this.registerItemIntegration(value, { replace: true, source: "extension" });
  }

  #register(map, definition, validator, { replace = false, source = "extension" } = {}) {
    validator(definition);
    if (map.has(definition.id) && !replace) throw localizedError("GAG.Validation.DefinitionDuplicate", { id: definition.id });
    const normalized = deepClone({ ...definition, source });
    map.set(definition.id, normalized);
    return deepClone(normalized);
  }

  registerCleaningMethod(definition, options) { return this.#register(this.#methods, definition, validateMethod, options); }
  registerContamination(definition, options) { return this.#register(this.#contaminations, definition, validateContamination, options); }
  registerEnvironmentProfile(definition, options) { return this.#register(this.#profiles, definition, validateProfile, options); }
  registerItemIntegration(definition, options) { return this.#register(this.#items, definition, validateItemIntegration, options); }

  registerCurrencyAdapter(adapter, { replace = false } = {}) {
    if (!adapter || typeof adapter !== "object") throw localizedError("GAG.Validation.CurrencyAdapterObject");
    if (!adapter.id || typeof adapter.id !== "string") throw localizedError("GAG.Validation.CurrencyAdapterId");
    for (const method of ["getBalance", "canAfford", "deduct"]) {
      if (typeof adapter[method] !== "function") throw localizedError("GAG.Validation.CurrencyAdapterMethod", { id: adapter.id, method });
    }
    if (this.#currencies.has(adapter.id) && !replace) throw localizedError("GAG.Validation.CurrencyAdapterDuplicate", { id: adapter.id });
    this.#currencies.set(adapter.id, adapter);
    return adapter;
  }

  getCleaningMethod(id, { clone = true } = {}) { return this.#read(this.#methods.get(id), clone); }
  getContamination(id, { clone = true } = {}) { return this.#read(this.#contaminations.get(id), clone); }
  getEnvironmentProfile(id, { clone = true } = {}) { return this.#read(this.#profiles.get(id), clone); }
  getItemIntegration(id, { clone = true } = {}) { return this.#read(this.#items.get(id), clone); }
  getCurrencyAdapter(id) { return this.#currencies.get(id) ?? null; }
  listCleaningMethods({ clone = true } = {}) { return this.#list(this.#methods, clone); }
  listContaminations({ clone = true } = {}) { return this.#list(this.#contaminations, clone); }
  listEnvironmentProfiles({ clone = true } = {}) { return this.#list(this.#profiles, clone); }
  listItemIntegrations({ clone = true } = {}) { return this.#list(this.#items, clone); }
  listCurrencyAdapters() { return [...this.#currencies.values()].map((adapter) => ({ id: adapter.id, label: adapter.label ?? adapter.id })); }

  #read(value, clone) {
    if (!value) return null;
    return clone ? deepClone(value) : value;
  }

  #list(map, clone) {
    const values = [...map.values()];
    return clone ? values.map(deepClone) : values;
  }

  replaceWorldDefinitions({ methods = [], contaminations = [], profiles = [] } = {}) {
    for (const definition of methods) this.registerCleaningMethod(definition, { replace: true, source: "world" });
    for (const definition of contaminations) this.registerContamination(definition, { replace: true, source: "world" });
    for (const definition of profiles) this.registerEnvironmentProfile(prepareWorldProfile(definition), { replace: true, source: "world" });
  }
}
