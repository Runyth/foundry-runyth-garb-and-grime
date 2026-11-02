import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_CONFIGURATION } from '../src/defaults.mjs';
import { TokenLabelService } from '../src/integrations/token-labels.mjs';

class Container {
  constructor() {
    this.children = [];
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
  }
  addChild(object) {
    object.parent?.removeChild?.(object);
    this.children.push(object);
    object.parent = this;
    return object;
  }
  removeChild(object) {
    this.children = this.children.filter((child) => child !== object);
    object.parent = null;
  }
  destroy({ children = false } = {}) {
    if (children) for (const child of [...this.children]) child.destroy?.({ children: true });
    this.parent?.removeChild?.(this);
    this.destroyed = true;
  }
}
class Graphics extends Container {
  clear() { this.drawn = []; return this; }
  roundRect(x, y, width, height, radius) {
    this.drawn.push({ kind: 'rectangle', width, height, radius });
    return this;
  }
  fill(options) { this.drawn.push({ kind: 'fill', ...options }); return this; }
  stroke(options) { this.drawn.push({ kind: 'stroke', ...options }); return this; }
}
class PreciseText extends Container {
  static getTextStyle() {
    // Inherited Foundry canvas defaults must not impose large shadows or strokes.
    return { fontSize: 36, strokeThickness: 4, dropShadow: true, padding: 5 };
  }
  constructor(text, style) {
    super();
    assert.equal(typeof text, 'string', 'Foundry V13 requires a string-first PreciseText constructor');
    this.text = text;
    this.anchor = { set() {} };
    this.style = style;
  }
  set style(value) {
    // PIXI may invalidate glyph metrics only when the style object is assigned.
    this._style = value;
    this.height = Number(value.fontSize);
    this.width = this.text.length * this.height * 0.6;
  }
  get style() { return this._style; }
}
function mergeObject(left, right) {
  function merge(dest, src) {
    for (const [key, value] of Object.entries(src ?? {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) dest[key] = merge(dest[key] ?? {}, value);
      else dest[key] = structuredClone(value);
    }
    return dest;
  }
  return merge(structuredClone(left), right);
}
function setup() {
  const world = structuredClone(DEFAULT_CONFIGURATION);
  world.tokenLabels.visibilityMode = 'always';
  const settings = new Map([
    ['runyth-garb-and-grime.configuration', world],
    ['runyth-garb-and-grime.tokenLabelsVisible', false],
    ['runyth-garb-and-grime.tokenLabelViewerMode', 'inherit'],
    ['runyth-garb-and-grime.tokenLabelViewerPosition', 'inherit']
  ]);
  globalThis.game = {
    user: { isGM: true, id: 'gm', role: 4 },
    settings: { get: (module, key) => settings.get(`${module}.${key}`) },
    i18n: { localize: (key) => key.split('.').slice(-1)[0] }
  };
  globalThis.PIXI = { Container, Graphics };
  globalThis.CONFIG = { Canvas: { groups: { interface: { zIndexScrollingText: 10 } } } };
  globalThis.canvas = { interface: new Container(), tokens: { placeables: [] } };
  globalThis.foundry = {
    canvas: { containers: { PreciseText } },
    utils: { deepClone: structuredClone, mergeObject }
  };
  const service = new TokenLabelService({ getState: () => ({ dirtLevel: 2, body: { level: 2 }, clothing: { level: 1 } }) });
  return { settings, world, service };
}
function token(id, actor = { id: 'actor1', uuid: 'Actor.actor1', name: 'Ada', type: 'character' }) {
  const document = {
    documentName: 'Token', id, uuid: `Scene.scene1.Token.${id}`,
    x: 100, y: 200, actor,
    getFlag: () => undefined
  };
  const value = {
    document, actor, isVisible: true, alpha: 1, w: 100, h: 100,
    position: { x: 100, y: 200 }
  };
  document.object = value;
  return value;
}
function rectangle(label) { return label.gagBackground.drawn.find(({ kind }) => kind === 'rectangle'); }

test('10–13px fonts scale the actual glyphs AND popup geometry without a hidden 18px floor', () => {
  const { settings, world, service } = setup();
  const current = token('one');
  canvas.tokens.placeables = [current];
  service.refreshToken(current);
  const label = canvas.interface.children[0].children[0];
  assert.equal(label.gagText.style.fontSize, 18);
  assert.equal(rectangle(label).height, 24);
  const previousStyle = label.gagText.style;
  const previousY = label.y;

  world.tokenLabels.fontSize = 12;
  world.tokenLabels.paddingX = 2;
  world.tokenLabels.paddingY = 1;
  world.tokenLabels.offset = 2;
  settings.set('runyth-garb-and-grime.configuration', structuredClone(world));
  service.refreshToken(current);
  assert.notEqual(label.gagText.style, previousStyle, 'assign fresh style to invalidate PIXI metrics');
  assert.equal(label.gagText.style.fontSize, 12);
  assert.equal(label.gagText.style.strokeThickness, 0, 'no inherited fixed-size canvas outline');
  assert.equal(label.gagText.style.dropShadow, false, 'no inherited fixed-size canvas shadow');
  assert.equal(label.gagText.style.padding, 0);
  assert.equal(rectangle(label).height, 14, 'popup shrinks with font below 14');
  assert.ok(label.y > previousY, 'placement tracks reduced popup half-height');
  assert.equal(label.y, 200 - 2 - 7);

  world.tokenLabels.fontSize = 10;
  settings.set('runyth-garb-and-grime.configuration', structuredClone(world));
  service.refreshToken(current);
  assert.equal(label.gagText.style.fontSize, 10);
  assert.equal(rectangle(label).height, 12);
  assert.equal(label.y, 200 - 2 - 6);
  assert.equal(canvas.interface.children[0].children.length, 1, 'updating style does not duplicate labels');
});

test('new tokens of the same Actor receive saved font, style, format, opacity and placement, including zero opacity', () => {
  const { settings, world, service } = setup();
  const first = token('first');
  canvas.tokens.placeables.push(first);
  service.refreshToken(first);
  world.tokenLabels = {
    ...world.tokenLabels,
    fontSize: 11, fontColor: '#19ab53', backgroundColor: '#123456',
    backgroundOpacity: 0, paddingX: 2, paddingY: 1,
    offset: 2, format: 'level', position: 'below'
  };
  settings.set('runyth-garb-and-grime.configuration', structuredClone(world));
  service.refreshAll();

  const second = token('second', first.actor);
  canvas.tokens.placeables.push(second);
  service.refreshToken(second);
  const [firstLabel, secondLabel] = canvas.interface.children[0].children;
  for (const label of [firstLabel, secondLabel]) {
    assert.equal(label.gagText.text, '2');
    assert.equal(label.gagText.style.fontSize, 11);
    assert.equal(label.gagText.style.fill, '#19ab53');
    assert.equal(rectangle(label).height, 13);
    assert.equal(rectangle(label).width, 11 * 0.6 + 4);
    assert.deepEqual(label.gagBackground.drawn.find(({ kind }) => kind === 'fill'), { kind: 'fill', color: 0x123456, alpha: 0 });
    assert.equal(label.y, 200 + 100 + 2 + 6.5);
  }
});

test('replacement Token with the same UUID uses current styling; late destruction of old object cannot remove it', () => {
  const { world, settings, service } = setup();
  const previous = token('same');
  service.refreshToken(previous);
  const oldLabel = canvas.interface.children[0].children[0];
  world.tokenLabels.fontSize = 10;
  settings.set('runyth-garb-and-grime.configuration', structuredClone(world));
  const replacement = token('same', previous.actor);
  service.refreshToken(replacement);
  const replacementLabel = canvas.interface.children[0].children[0];
  assert.equal(canvas.interface.children[0].children.length, 1);
  assert.notEqual(replacementLabel, oldLabel);
  assert.equal(oldLabel.destroyed, true);
  assert.equal(replacementLabel.gagText.style.fontSize, 10);
  service.removeTokenLabel(previous);
  assert.equal(replacementLabel.destroyed, undefined);
  assert.equal(service.labels.size, 1);
  service.removeTokenLabel(replacement);
  assert.equal(service.labels.size, 0);
});

test('all three Sheets & HUD toggles have distinct translated native hover tooltips', () => {
  const template = fs.readFileSync(new URL('../templates/settings-hub.hbs', import.meta.url), 'utf8');
  const en = JSON.parse(fs.readFileSync(new URL('../lang/en.json', import.meta.url), 'utf8'));
  const de = JSON.parse(fs.readFileSync(new URL('../lang/de.json', import.meta.url), 'utf8'));
  for (const [field, key] of [
    ['sceneControls.enabled', 'SceneControlsHint'],
    ['effects.enabled', 'ActiveEffectsHint'],
    ['effects.includeContaminations', 'ContaminationEffectsHint']
  ]) {
    assert.match(template, new RegExp(`<label class="gag-checkbox" title="\\{\\{localize 'GAG.SettingsHub.Sheets.${key}'\\}\\}".*?name="${field.replaceAll('.', '\\.')}"`));
    assert.ok(en.GAG.SettingsHub.Sheets[key].length > 35);
    assert.ok(de.GAG.SettingsHub.Sheets[key].length > 35);
  }
});

test('Foundry drawToken and updateSetting hooks use saved configuration on a newly drawn Token', () => {
  const { world, settings, service } = setup();
  const handlers = new Map();
  const frames = [];
  game.keybindings = { register: () => {} };
  globalThis.CONST = { KEYBINDING_PRECEDENCE: { NORMAL: 0 } };
  globalThis.Hooks = { on(event, callback) { handlers.set(event, callback); } };
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  try {
    service.registerHooks();
    assert.equal(typeof handlers.get('drawToken'), 'function');
    assert.equal(typeof handlers.get('updateSetting'), 'function');
    const first = token('start');
    canvas.tokens.placeables.push(first);
    handlers.get('drawToken')(first);
    frames.shift()();
    assert.equal(service.labels.size, 1);
    assert.equal([...service.labels.values()][0].gagText.style.fontSize, 18);

    world.tokenLabels.fontSize = 10;
    world.tokenLabels.paddingY = 1;
    world.tokenLabels.backgroundOpacity = 0.25;
    settings.set('runyth-garb-and-grime.configuration', structuredClone(world));
    handlers.get('updateSetting')({ key: 'runyth-garb-and-grime.configuration' });
    frames.shift()();
    assert.equal([...service.labels.values()][0].gagText.style.fontSize, 10);

    const next = token('later', first.actor);
    canvas.tokens.placeables.push(next);
    handlers.get('drawToken')(next);
    frames.shift()();
    assert.equal(service.labels.size, 2);
    for (const label of service.labels.values()) {
      assert.equal(label.gagText.style.fontSize, 10);
      assert.equal(rectangle(label).height, 12);
      assert.equal(label.gagBackground.drawn.find(({ kind }) => kind === 'fill').alpha, 0.25);
    }
  } finally {
    delete globalThis.requestAnimationFrame;
    delete globalThis.Hooks;
    delete globalThis.CONST;
  }
});
