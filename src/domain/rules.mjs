// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { clampLevel, normalizeState } from "./state.mjs";

const SOCIAL_SKILLS = new Set(["per", "dec", "prf"]);
const STEALTH_SKILLS = new Set(["ste"]);
const TRACKING_SKILLS = new Set(["sur"]);

const RULE_MODES = Object.freeze({
  normal: ["normal", "GAG.RollAdvice.None", 0],
  "disadvantage-social": ["disadvantage", "GAG.RollAdvice.DirtyCleanContext", 2],
  "entry-refusal-or-disadvantage": ["disadvantage", "GAG.RollAdvice.FilthyCleanContext", 3],
  "possible-disadvantage": ["possible-disadvantage", "GAG.RollAdvice.FilthyOrdinary", 2],
  "possible-disadvantage-blend": ["possible-disadvantage", "GAG.RollAdvice.TooClean", 1],
  "possible-advantage-blend": ["possible-advantage", "GAG.RollAdvice.BlendIn", 1],
  "scent-advantage": ["disadvantage", "GAG.RollAdvice.ScentTracking", 2],
  "scent-stealth-impossible": ["blocked", "GAG.RollAdvice.ScentBlocked", 3]
});

export function effectiveDirtLevel(state, contaminations = []) {
  const normalized = normalizeState(state);
  const definitions = contaminations instanceof Map
    ? contaminations
    : new Map(contaminations.map((entry) => [entry.id, entry]));
  let worst = 0;
  for (const entry of normalized.contaminations) {
    const definition = definitions.get(entry.id);
    worst = Math.max(worst, Number(entry.effectivePenalty ?? definition?.effectivePenalty ?? 0) || 0);
  }
  const currentTime = Date.now();
  const masked = normalized.masking.some((entry) => !entry.expiresAt || Number(entry.expiresAt) > currentTime);
  return clampLevel(normalized.dirtLevel + (masked ? 0 : worst));
}

function recommendation(mode, reasonKey, severity, extra = {}) {
  return { mode, reasonKey, severity, ...extra };
}

function profileRecommendation(rule, fallbackKey = "GAG.RollAdvice.None") {
  if (!rule || rule === "normal") return null;
  const [mode, reasonKey, severity] = RULE_MODES[rule] ?? ["possible-disadvantage", fallbackKey, 1];
  return recommendation(mode, reasonKey, severity, {
    configuredRule: rule,
    blocksScentStealth: mode === "blocked",
    entryMayBeRefused: rule === "entry-refusal-or-disadvantage"
  });
}

export function evaluateRoll({ state, profile, skillId, contaminations = [], enhancedSmell = false }) {
  const normalized = normalizeState(state);
  const level = effectiveDirtLevel(normalized, contaminations);
  const profileId = profile?.id ?? "ordinary";
  const result = {
    profileId,
    skillId,
    dirtLevel: normalized.dirtLevel,
    effectiveLevel: level,
    mode: "normal",
    reasonKey: "GAG.RollAdvice.None",
    severity: 0,
    blocksScentStealth: false,
    narrative: profile?.narrative ?? profile?.narrativeKey ?? ""
  };

  if (STEALTH_SKILLS.has(skillId) && enhancedSmell) {
    const configured = profileRecommendation(profile?.tracking?.[`level${level}`]);
    if (configured) return { ...result, ...configured };
    if (level >= 3) return { ...result, ...recommendation("blocked", "GAG.RollAdvice.ScentBlocked", 3, { blocksScentStealth: true }) };
    if (level >= 2) return { ...result, ...recommendation("disadvantage", "GAG.RollAdvice.ScentTracking", 2) };
  }

  if (TRACKING_SKILLS.has(skillId) && enhancedSmell && level >= 2) {
    return { ...result, ...recommendation("advantage-opponent", "GAG.RollAdvice.ScentTracking", 2) };
  }

  if (SOCIAL_SKILLS.has(skillId)) {
    const configured = profileRecommendation(profile?.social?.[`level${level}`]);
    if (configured) return { ...result, ...configured };
    if (["clean", "religious", "court"].includes(profileId)) {
      if (level >= 3) return { ...result, ...recommendation("disadvantage", "GAG.RollAdvice.FilthyCleanContext", 3, { entryMayBeRefused: true }) };
      if (level >= 2) return { ...result, ...recommendation("disadvantage", "GAG.RollAdvice.DirtyCleanContext", 2) };
      if (profileId === "court" && level >= 1) return { ...result, ...recommendation("possible-disadvantage", "GAG.RollAdvice.WornCourt", 1) };
    }
    if (profileId === "ordinary" && level >= 3) return { ...result, ...recommendation("possible-disadvantage", "GAG.RollAdvice.FilthyOrdinary", 2) };
    if (profileId === "poor-lawless") {
      if (level === 0) return { ...result, ...recommendation("possible-disadvantage", "GAG.RollAdvice.TooClean", 1) };
      if (level === 1 || level === 2) return { ...result, ...recommendation("possible-advantage", "GAG.RollAdvice.BlendIn", 1) };
    }
  }

  // Intimidation is deliberately evaluated separately and never receives a blanket dirt penalty.
  if (skillId === "itm" && level >= 3 && ["clean", "court", "religious"].includes(profileId)) {
    return { ...result, ...recommendation("possible-advantage", "GAG.RollAdvice.IntimidatingFilth", 1) };
  }

  return result;
}
