// ============================================
// TDD: Game (companion restart + setMode wiring)
// Run with: node test/game.test.js
// ============================================

const { test, run, describe, assert } = require('./runner');
const { Pet, PET_CONST } = require('../renderer/pet');
const { getQuote } = require('../renderer/quotes');
const { PetPresenter } = require('../renderer/pet-presenter');

class MockAnimator {
  constructor() {
    this.companionMode = false;
  }
  clearPendingTimeouts() {}
  reset() {}
}

class MockUI {
  constructor() {
    this.setCompanionModeCalls = [];
    this.addCompanionListenerCalls = 0;
    this.removeCompanionListenerCalls = 0;
  }
  setCompanionMode(v) {
    this.setCompanionModeCalls.push(v);
  }
  removeCompanionListeners() {
    this.removeCompanionListenerCalls += 1;
  }
  addCompanionListeners() {
    this.addCompanionListenerCalls += 1;
  }
  update() {}
  showQuote() {}
  showQuoteBubble() {}
  createRestartButton() {}
  showNotification() {}
  showHobbyNotification() {}
  renderHobbyPanel() {}
  renderActivityLog() {}
  destroy() {}
}

function installBrowserTimers() {
  if (typeof global.requestAnimationFrame === 'undefined') {
    global.requestAnimationFrame = (cb) => {
      setTimeout(() => cb(performance.now()), 0);
      return 1;
    };
  }
  if (typeof global.cancelAnimationFrame === 'undefined') {
    global.cancelAnimationFrame = () => {};
  }
  if (typeof global.performance === 'undefined') {
    global.performance = { now: () => 0 };
  }
}

function makeGame() {
  installBrowserTimers();
  global.Pet = Pet;
  global.PET_CONST = PET_CONST;
  global.getQuote = getQuote;
  global.PetPresenter = PetPresenter;
  global.Animator = MockAnimator;
  global.UI = MockUI;
  const { Game } = require('../renderer/game');
  return new Game({
    saveGame: async () => ({ success: true }),
    loadGame: async () => null,
    setCompanionMode: null,
    onBeforeQuit: () => () => {},
    notifyQuitSaveDone: () => {},
    getInitialMode: () => 'normal'
  });
}

describe('Game — companion + restart (TDD)', () => {
  test('restart() reapplies companion listeners when mode is companion', () => {
    const g = makeGame();
    g.animator = new MockAnimator();
    g.pet = new Pet();
    g.mode = 'companion';
    g.ui = new MockUI();
    g.restart();
    const ui = g.ui;
    assert.strictEqual(
      g.mode,
      'companion',
      'Game.mode should still be companion after restart'
    );
    assert(
      ui.setCompanionModeCalls.includes(true),
      'new UI should receive setCompanionMode(true) when restarting in companion'
    );
    assert.ok(
      ui.addCompanionListenerCalls >= 1,
      'addCompanionListeners should be called after restart in companion'
    );
    assert(
      g.animator.companionMode === true,
      'animator.companionMode should match companion after restart'
    );
  });

  test('restart() does not wire companion when mode is normal', () => {
    const g = makeGame();
    g.animator = new MockAnimator();
    g.pet = new Pet();
    g.mode = 'normal';
    g.ui = new MockUI();
    g.restart();
    const ui = g.ui;
    assert(
      !ui.setCompanionModeCalls.includes(true),
      'in normal mode, setCompanionMode(true) should not be used'
    );
    assert.strictEqual(ui.addCompanionListenerCalls, 0);
    assert.strictEqual(g.animator.companionMode, false);
  });
});

run();

module.exports = { makeGame, MockUI, MockAnimator };
