import { DEFAULT_STATE } from "../defaults.mjs";
import { SCHEMA_VERSION } from "../constants.mjs";

export function deepClone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

export function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(3, Math.max(0, Math.trunc(numeric)));
}

function normalizePart(part, fallbackLevel) {
  const level = clampLevel(part?.level ?? fallbackLevel);
  return { level, clean: level === 0 };
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, 4000) : fallback;
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  return null;
}

function normalizeEntries(entries, max = 100) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(-max).filter((entry) => entry && typeof entry === "object").map((entry) => deepClone(entry));
}

export function normalizeState(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const dirtLevel = clampLevel(source.dirtLevel ?? Math.max(source.body?.level ?? 0, source.clothing?.level ?? 0));
  const body = normalizePart(source.body, dirtLevel);
  const clothing = normalizePart(source.clothing, dirtLevel);
  const normalized = {
    schema: SCHEMA_VERSION,
    dirtLevel: clampLevel(Math.max(dirtLevel, body.level, clothing.level)),
    body,
    clothing,
    contaminations: normalizeEntries(source.contaminations, 30),
    lastIncrease: normalizeDate(source.lastIncrease),
    lastCleaning: normalizeDate(source.lastCleaning),
    lastChange: normalizeDate(source.lastChange),
    lastChangeReason: normalizeString(source.lastChangeReason),
    autoMaintenance: Boolean(source.autoMaintenance),
    maintenanceExempt: Boolean(source.maintenanceExempt),
    maintenanceDebt: Math.max(0, Number(source.maintenanceDebt) || 0),
    masking: normalizeEntries(source.masking, 20),
    groomedUntil: normalizeDate(source.groomedUntil),
    gmNotes: normalizeString(source.gmNotes),
    lastDailyGainDay: Number.isFinite(Number(source.lastDailyGainDay)) ? Number(source.lastDailyGainDay) : null,
    lastMaintenanceDay: Number.isFinite(Number(source.lastMaintenanceDay)) ? Number(source.lastMaintenanceDay) : null,
    transactionLog: normalizeEntries(source.transactionLog, 100)
  };
  normalized.dirtLevel = deriveDirtLevel(normalized);
  return normalized;
}

export function deriveDirtLevel(state) {
  return clampLevel(Math.max(state?.body?.level ?? state?.dirtLevel ?? 0, state?.clothing?.level ?? state?.dirtLevel ?? 0));
}

export function isClean(state) {
  const normalized = normalizeState(state);
  return normalized.dirtLevel === 0 && normalized.body.clean && normalized.clothing.clean && normalized.contaminations.length === 0;
}

export function adjustStateDirt(state, amount, { body = true, clothing = true } = {}) {
  const next = normalizeState(state);
  const numericAmount = Math.trunc(Number(amount) || 0);
  if (body) next.body.level = clampLevel(next.body.level + numericAmount);
  if (clothing) next.clothing.level = clampLevel(next.clothing.level + numericAmount);
  next.body.clean = next.body.level === 0;
  next.clothing.clean = next.clothing.level === 0;
  next.dirtLevel = deriveDirtLevel(next);
  return next;
}

export function setStateDirt(state, level, { body = true, clothing = true } = {}) {
  const next = normalizeState(state);
  const target = clampLevel(level);
  if (body) next.body = { level: target, clean: target === 0 };
  if (clothing) next.clothing = { level: target, clean: target === 0 };
  next.dirtLevel = deriveDirtLevel(next);
  return next;
}

export function applyCleaningEffect(state, effect) {
  const next = normalizeState(state);
  const body = effect?.body !== false;
  const clothing = effect?.clothing !== false;
  if (effect?.mode === "reduce") return adjustStateDirt(next, -Math.abs(Number(effect.amount) || 1), { body, clothing });
  return setStateDirt(next, effect?.level ?? 0, { body, clothing });
}

export function getDefaultState() {
  return normalizeState(DEFAULT_STATE);
}
