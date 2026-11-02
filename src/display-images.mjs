import { MODULE_ID } from "./constants.mjs";

export const ACTOR_FALLBACK_IMAGE = `modules/${MODULE_ID}/assets/icons/actor-fallback.svg`;

const failedSources = new Set();
const warnedIssues = new Set();
const MAX_FAILED_SOURCES = 512;
const MAX_WARNED_ISSUES = 128;

const LEGACY_MODULE_SUCCESSORS = Object.freeze({});

function normalizedSource(value) {
  return String(value ?? "").trim().replace(/\\/g, "/");
}

export function moduleIdFromAssetSource(value) {
  const source = normalizedSource(value);
  if (!source) return null;
  let pathname = source;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(source)) pathname = new URL(source).pathname;
  } catch {
    pathname = source;
  }
  const match = pathname.match(/(?:^|\/)modules\/([^/?#]+)\//iu);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

function moduleExists(moduleId) {
  if (!moduleId) return true;
  return Boolean(globalThis.game?.modules?.get?.(moduleId));
}

function inspectSource(value) {
  const source = normalizedSource(value);
  if (!source) return { usable: false, source, issue: { kind: "empty" } };
  if (failedSources.has(source)) return { usable: false, source, issue: { kind: "load-failed", source, moduleId: moduleIdFromAssetSource(source) } };
  const moduleId = moduleIdFromAssetSource(source);
  if (moduleId && !moduleExists(moduleId)) {
    return {
      usable: false,
      source,
      issue: {
        kind: "module-unavailable",
        source,
        moduleId,
        successorId: LEGACY_MODULE_SUCCESSORS[moduleId] ?? null,
        successorAvailable: Boolean(LEGACY_MODULE_SUCCESSORS[moduleId] && moduleExists(LEGACY_MODULE_SUCCESSORS[moduleId]))
      }
    };
  }
  return { usable: true, source, issue: null };
}

export function resolveActorDisplayImage(actor) {
  const primary = inspectSource(actor?.img);
  if (primary.usable) {
    return { src: primary.source, requestedSrc: primary.source, fallback: false, issue: null, sourceKind: "actor" };
  }

  const token = inspectSource(actor?.prototypeToken?.texture?.src);
  if (token.usable) {
    return {
      src: token.source,
      requestedSrc: primary.source,
      fallback: false,
      issue: primary.issue,
      sourceKind: "token"
    };
  }

  return {
    src: ACTOR_FALLBACK_IMAGE,
    requestedSrc: primary.source || token.source,
    fallback: true,
    issue: primary.issue?.kind !== "empty" ? primary.issue : token.issue,
    sourceKind: "fallback"
  };
}

function localized(key, data, fallback) {
  try {
    const value = globalThis.game?.i18n?.format?.(key, data);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function issueKey(issue) {
  if (!issue) return null;
  if (issue.kind === "module-unavailable") return `module-unavailable:${issue.moduleId}`;
  if (issue.kind === "load-failed") return `load-failed:${issue.moduleId ?? issue.source}`;
  return null;
}

export function reportActorImageIssues(entries) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    const issue = entry?.imageIssue ?? entry?.issue ?? null;
    const key = issueKey(issue);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { issue, count: 0, actors: [], sources: [] });
    const group = groups.get(key);
    group.count += 1;
    if (entry?.name && group.actors.length < 5) group.actors.push(entry.name);
    if (issue.source && group.sources.length < 3 && !group.sources.includes(issue.source)) group.sources.push(issue.source);
  }

  for (const [key, group] of groups) {
    if (warnedIssues.has(key)) continue;
    addBounded(warnedIssues, key, MAX_WARNED_ISSUES);
    const { issue, count } = group;
    if (issue.kind === "module-unavailable") {
      const successor = issue.successorAvailable
        ? localized(
            "GAG.Images.SuccessorAvailable",
            { successor: issue.successorId },
            ` The successor module "${issue.successorId}" is installed, but Runyth Garb & Grime does not guess renamed file paths.`
          )
        : "";
      const message = localized(
        "GAG.Images.UnavailableModuleWarning",
        { count, module: issue.moduleId, successor },
        `Actor portrait fallback: ${count} Actor(s) reference the unavailable module "${issue.moduleId}". Runyth Garb & Grime suppressed those image requests to prevent repeated HTTP 404s and used safe fallback artwork.${successor}`
      );
      console.warn(`[${MODULE_ID}] ${message}`, { actors: group.actors, sources: group.sources });
      continue;
    }
    const message = localized(
      "GAG.Images.LoadFailedWarning",
      { count, source: issue.source ?? "" },
      "Actor portrait fallback: an image failed to load. Runyth Garb & Grime cached the failure for this session and will use safe fallback artwork on subsequent renders."
    );
    console.warn(`[${MODULE_ID}] ${message}`, { actors: group.actors, sources: group.sources });
  }
}

export function markActorImageFailed(source) {
  const normalized = normalizedSource(source);
  if (normalized && normalized !== ACTOR_FALLBACK_IMAGE) addBounded(failedSources, normalized, MAX_FAILED_SOURCES);
}

export function installActorImageFallback(root, { signal } = {}) {
  if (!(root instanceof HTMLElement)) return;
  root.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches("img[data-gag-actor-image]")) return;
    const failed = normalizedSource(image.dataset.gagActorImageSource || image.currentSrc || image.src);
    if (!failed || failed === ACTOR_FALLBACK_IMAGE || image.dataset.gagActorImageFallback === "true") return;
    markActorImageFailed(failed);
    const issue = { kind: "load-failed", source: failed, moduleId: moduleIdFromAssetSource(failed) };
    reportActorImageIssues([{ name: image.dataset.gagActorName ?? "", issue }]);
    image.dataset.gagActorImageFallback = "true";
    image.src = ACTOR_FALLBACK_IMAGE;
  }, { capture: true, signal });
}

function addBounded(set, value, limit) {
  if (set.has(value)) return;
  set.add(value);
  while (set.size > limit) set.delete(set.values().next().value);
}
