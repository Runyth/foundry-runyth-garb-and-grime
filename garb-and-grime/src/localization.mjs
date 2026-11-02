import { MODULE_ID } from "./constants.mjs";

/**
 * Localize a module string while remaining safe in isolated validation tests
 * where Foundry's global game object is not available yet.
 */
export function translate(key, data = {}) {
  const i18n = globalThis.game?.i18n;
  if (typeof i18n?.format === "function") return i18n.format(key, data);
  if (typeof i18n?.localize === "function" && !Object.keys(data).length) return i18n.localize(key);
  return key;
}

export function localizedError(key, data = {}) {
  return new Error(translate(key, data));
}

/**
 * Describe the Foundry-managed localization currently active for this client.
 * Garb & Grime intentionally does not maintain a competing language setting.
 */
export function getLocalizationStatus() {
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  const declaredLanguages = module?.languages ?? module?._source?.languages;
  const languages = Array.isArray(declaredLanguages) && declaredLanguages.length
    ? declaredLanguages
    : [
        { lang: "de", name: "Deutsch" },
        { lang: "en", name: "English" }
      ];
  const currentCode = globalThis.game?.i18n?.lang ?? "en";
  const supported = globalThis.CONFIG?.supportedLanguages ?? {};
  const supportedEntry = supported[currentCode];
  const supportedName = typeof supportedEntry === "string"
    ? supportedEntry
    : supportedEntry?.name ?? supportedEntry?.label;
  const currentName = supportedName ?? languages.find((entry) => entry.lang === currentCode)?.name ?? currentCode;
  const availableNames = languages.map((entry) => entry.name).filter(Boolean);
  const formatter = globalThis.game?.i18n?.getListFormatter?.({ style: "long", type: "conjunction" });
  return {
    currentCode,
    currentName,
    availableLanguages: formatter?.format?.(availableNames) ?? availableNames.join(", ")
  };
}
