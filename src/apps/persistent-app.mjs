// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID, SETTINGS } from "../constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let windowStateWriteQueue = Promise.resolve();

export class PersistentApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["runyth-garb-and-grime", "gag-window"],
    position: { width: 900, height: 680 },
    window: { resizable: true }
  };

  get windowKey() {
    return this.constructor.name;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    const all = game.settings.get(MODULE_ID, SETTINGS.WINDOW_STATE) ?? {};
    const saved = all[this.windowKey];
    if (!saved) return;
    this._gagLastSavedPosition = positionSignature(saved);
    const maxWidth = Math.max(360, window.innerWidth - 24);
    const maxHeight = Math.max(320, window.innerHeight - 24);
    const width = Math.min(maxWidth, Math.max(360, Number(saved.width) || this.position.width));
    const height = Math.min(maxHeight, Math.max(320, Number(saved.height) || this.position.height));
    const left = Math.min(Math.max(12, Number(saved.left) || 12), Math.max(12, window.innerWidth - width - 12));
    const top = Math.min(Math.max(12, Number(saved.top) || 12), Math.max(12, window.innerHeight - height - 12));
    this.setPosition({ width, height, left, top });
  }

  _onPosition(position) {
    super._onPosition(position);
    clearTimeout(this._gagPositionTimer);
    this._gagPositionTimer = setTimeout(() => this.#savePosition(position), 200);
  }

  async _onClose(options) {
    clearTimeout(this._gagPositionTimer);
    await this.#savePosition(this.position);
    return super._onClose(options);
  }

  async #savePosition(position) {
    if (!game?.settings) return;
    const values = [position.width, position.height, position.left, position.top];
    if (!values.every((value) => Number.isFinite(Number(value)))) return;
    const next = {
      width: Number(position.width),
      height: Number(position.height),
      left: Number(position.left),
      top: Number(position.top)
    };
    const signature = positionSignature(next);
    if (signature === this._gagLastSavedPosition) return;
    this._gagLastSavedPosition = signature;
    windowStateWriteQueue = windowStateWriteQueue.then(async () => {
      const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.WINDOW_STATE) ?? {});
      all[this.windowKey] = next;
      await game.settings.set(MODULE_ID, SETTINGS.WINDOW_STATE, all);
    }).catch((error) => {
      this._gagLastSavedPosition = null;
      console.error(`[${MODULE_ID}] Failed to save window position.`, error);
    });
    await windowStateWriteQueue;
  }
}

function positionSignature(position) {
  return [position.width, position.height, position.left, position.top].map(Number).join("|");
}
