import { localizedError } from "../localization.mjs";
import { SCENE_LEVEL_RATINGS } from "../constants.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export function validateId(value, fieldKey = "GAG.Validation.Fields.Id") {
  if (!ID_PATTERN.test(String(value ?? ""))) {
    throw localizedError("GAG.Validation.IdPattern", { field: translateField(fieldKey), pattern: String(ID_PATTERN) });
  }
  return value;
}

export function validateMethod(definition) {
  if (!definition || typeof definition !== "object") throw localizedError("GAG.Validation.MethodObject");
  validateId(definition.id, "GAG.Validation.Fields.MethodId");
  if (!definition.nameKey && !definition.name) throw localizedError("GAG.Validation.MethodName", { id: definition.id });
  if (!["set", "reduce"].includes(definition.effect?.mode)) throw localizedError("GAG.Validation.MethodEffect", { id: definition.id });
  const cost = Number(definition.cost?.amount ?? 0);
  if (!Number.isFinite(cost) || cost < 0) throw localizedError("GAG.Validation.MethodCost", { id: definition.id });
  return true;
}

export function validateContamination(definition) {
  if (!definition || typeof definition !== "object") throw localizedError("GAG.Validation.ContaminationObject");
  validateId(definition.id, "GAG.Validation.Fields.ContaminationId");
  if (!definition.nameKey && !definition.name) throw localizedError("GAG.Validation.ContaminationName", { id: definition.id });
  return true;
}

export function validateProfile(definition) {
  if (!definition || typeof definition !== "object") throw localizedError("GAG.Validation.ProfileObject");
  validateId(definition.id, "GAG.Validation.Fields.ProfileId");
  if (!definition.nameKey && !definition.name) throw localizedError("GAG.Validation.ProfileName", { id: definition.id });
  if (definition.levelRatings !== undefined && (!Array.isArray(definition.levelRatings)
    || definition.levelRatings.length !== 4
    || definition.levelRatings.some((entry) => !SCENE_LEVEL_RATINGS.includes(entry)))) {
    throw localizedError("GAG.Validation.ProfileRatings", { id: definition.id });
  }
  for (const field of ["settlementTypes", "serviceAvailability", "automaticContamination"]) {
    if (definition[field] !== undefined && (!Array.isArray(definition[field]) || definition[field].some((entry) => typeof entry !== "string" || !entry.trim()))) {
      throw localizedError("GAG.Validation.ProfileField", { id: definition.id, field });
    }
  }
  return true;
}

export function validateItemIntegration(definition) {
  if (!definition || typeof definition !== "object") throw localizedError("GAG.Validation.ItemObject");
  validateId(definition.id, "GAG.Validation.Fields.ItemId");
  if (!definition.methodId && !definition.masking) throw localizedError("GAG.Validation.ItemAction", { id: definition.id });
  return true;
}

function translateField(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}
