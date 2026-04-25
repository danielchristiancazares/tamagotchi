// ============================================
// TDD: UI — companion layout teardown on destroy
// Run with: node test/ui.test.js
// ============================================

const { test, run, describe, assert } = require('./runner');
const { Pet, PET_CONST } = require('../renderer/pet');
const { getQuote } = require('../renderer/quotes');
const { PetPresenter } = require('../renderer/pet-presenter');

/**
 * @returns {{ document: object, containerCompanion: () => boolean, bodyWasCompanion: () => boolean, canvas: { width: number, height: number } }}
 */
function installDomStubs() {
  let bodyCompanion = false;
  let containerHasCompanion = false;
  const canvas = { width: 320, height: 240, addEventListener() {}, style: {} };
  const gameContainer = {
    classList: {
      add(c) {
        if (c === 'companion-mode') containerHasCompanion = true;
      },
      remove(c) {
        if (c === 'companion-mode') containerHasCompanion = false;
      }
    }
  };
  const makeChildListContainer = () => {
    const children = [];
    return {
      get firstChild() {
        return children[0] || null;
      },
      removeChild(ch) {
        const i = children.indexOf(ch);
        if (i >= 0) children.splice(i, 1);
      },
      appendChild(ch) {
        children.push(ch);
      },
      get children() {
        return children;
      }
    };
  };
  const makeButton = (id) => {
    const label = { textContent: 'X' };
    return {
      id,
      classList: { contains: () => false, add() {}, remove() {}, toggle: () => {} },
      addEventListener() {},
      textContent: '',
      dataset: {},
      querySelector(sel) {
        return sel === '.btn-label' ? label : null;
      }
    };
  };
  const bodyEl = {
    classList: {
      toggle: (c, on) => {
        if (c === 'companion-body') bodyCompanion = on;
      }
    }
  };
  const byId = {
    'btn-feed': makeButton('btn-feed'),
    'btn-play': makeButton('btn-play'),
    'btn-clean': makeButton('btn-clean'),
    'btn-sleep': makeButton('btn-sleep'),
    'btn-pet': makeButton('btn-pet'),
    'btn-hobbies': { addEventListener() {}, removeEventListener() {} },
    'hobby-panel': { style: { display: 'none' } },
    'stat-hunger': makeChildListContainer(),
    'stat-happiness': makeChildListContainer(),
    'stat-energy': makeChildListContainer(),
    'stat-hygiene': makeChildListContainer(),
    'activity-log-entries': makeChildListContainer(),
    'info-age': { textContent: '' },
    'info-stage': { textContent: '' },
    'info-health': { innerHTML: '' },
    notifications: { children: [] },
    'quote-bubble': { className: '', classList: { add: () => {} }, style: { display: 'none' } },
    'quote-text': { textContent: '' },
    'pet-canvas': canvas
  };
  global.document = {
    documentElement: { style: {} },
    body: bodyEl,
    createElement() {
      return {
        className: '',
        style: {},
        dataset: {},
        classList: { add() {} }
      };
    },
    querySelector(sel) {
      if (sel === '.game-container') return gameContainer;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return byId[id] || null;
    }
  };
  global.getComputedStyle = () => ({
    getPropertyValue: (name) => (name && name.includes('stat-') ? '#00ff00' : '')
  });

  return {
    document: global.document,
    containerCompanion: () => containerHasCompanion,
    bodyWasCompanion: () => bodyCompanion,
    canvas
  };
}

function installGlobals() {
  global.PET_CONST = PET_CONST;
  global.PetPresenter = PetPresenter;
  global.getQuote = getQuote;
}

describe('UI — destroy and companion', () => {
  test('destroy() leaves layout in non-companion state after companion was active', () => {
    installGlobals();
    const { containerCompanion, bodyWasCompanion, canvas } = installDomStubs();
    const { UI } = require('../renderer/ui');
    const pet = new Pet();
    const ui = new UI(pet, { quoteFn: (p, c) => getQuote(p, c) });
    assert.strictEqual(containerCompanion(), false, 'precondition: not companion before toggle');
    ui.setCompanionMode(true);
    assert.strictEqual(containerCompanion(), true, 'setCompanionMode(true) should mark container');
    assert.strictEqual(canvas.width, 160, 'companion should resize canvas width');
    ui.destroy();
    assert.strictEqual(containerCompanion(), false, 'destroy should clear companion container');
    assert.strictEqual(bodyWasCompanion(), false, 'destroy should clear companion-body');
    assert.strictEqual(canvas.width, 320, 'destroy should restore default canvas size');
  });
});

run();
