// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
/**
 * Character Tokens can be unlinked synthetic Actors in Foundry V13. Their
 * ActorDelta can retain an older copy of Runyth Garb & Grime flags even after the
 * world Actor changes. Unlike NPC instances, a character's cleanliness is
 * campaign-wide: use the world Actor as the one authoritative state source.
 *
 * Only resolve a known TokenDocument's base Actor; never guess a world Actor
 * by name, and never cross over for NPC or compendium/synthetic-only Actors.
 */
export function resolveCleanlinessActor(actor) {
  if (!actor || actor.type !== "character") return actor;
  const token = actor.token ?? (actor.parent?.documentName === "Token" ? actor.parent : null);
  if (!token || token.actorLink === true) return actor;
  const base = token.baseActor ?? (token.actorId ? globalThis.game?.actors?.get?.(token.actorId) : null);
  if (!base || base === actor || base.documentName !== "Actor" || base.type !== "character") return actor;
  if (token.actorId && base.id !== token.actorId) return actor;
  return base;
}

/** Resolve from a canvas Token (or TokenDocument) even if its synthetic Actor
 * does not expose the owning TokenDocument in a particular Foundry build. */
export function resolveTokenCleanlinessActor(token) {
  const document = token?.document ?? token;
  const actor = token?.actor ?? document?.actor;
  if (!actor) return null;
  if (actor.type === "character" && document?.actorLink === false) {
    const base = document.baseActor ?? (document.actorId ? globalThis.game?.actors?.get?.(document.actorId) : null);
    if (base?.documentName === "Actor" && base.type === "character"
      && (!document.actorId || base.id === document.actorId)) return base;
  }
  return resolveCleanlinessActor(actor);
}
