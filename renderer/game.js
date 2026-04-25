const GAME_CONST = {
  TICK_INTERVAL: 1000,
  SAVE_INTERVAL: 30,
  DT_CAP: 0.1,
  DEATH_OVERLAY_DELAY: 4000,
  WELCOME_QUOTE_DELAY: 800,
  EVENT_POOP_INTERVAL: 20,
  EVENT_SICK_INTERVAL: 25,
  EVENT_HUNGRY_INTERVAL: 30,
  CRITICAL_WARN_INTERVAL: 30
};

class Game {
  constructor({
    saveGame = async () => ({ success: false }),
    loadGame = async () => null,
    setCompanionMode = null,
    onBeforeQuit = () => () => {},
    notifyQuitSaveDone = () => {},
    getInitialMode = () => 'normal'
  } = {}) {
    this._saveGame = saveGame;
    this._loadGame = loadGame;
    this._setCompanionMode = setCompanionMode;
    this._onBeforeQuit = onBeforeQuit;
    this._notifyQuitSaveDone = notifyQuitSaveDone;
    this._getInitialMode = getInitialMode;

    this._tickId = null;
    this._rAFId = null;
    this._timeouts = [];
    this._beforeQuitUnsub = null;

    this._getQuote = (typeof getQuote === 'function') ? getQuote : () => null;

    this.pet = new Pet();
    this.animator = null;
    this.ui = null;
    this.mode = 'normal';
    this.isRunning = true;
    this.hasShownDeath = false;

    this._resetAccumulators();

    console.log('[Game] Controller created');
  }

  _resetAccumulators() {
    this.lastTime = 0;
    this.saveAccumulator = 0;
    this.idleQuoteAccumulator = 0;
    this.tickCount = 0;
    this.nextIdleQuoteAt = this._randomIdleInterval();
    this.lastPoopQuoteAt = -Infinity;
    this.lastSickQuoteAt = -Infinity;
    this.lastHungryQuoteAt = -Infinity;
    this.lastCriticalWarnAt = -Infinity;
  }

  _randomIdleInterval() {
    const base = 20 + Math.floor(Math.random() * 30);
    return this.mode === 'companion' ? base * 3 : base;
  }

  _trackTimeout(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timeouts.push(id);
    return id;
  }

  _buildUIActions() {
    return {
      onFeed: () => this.pet.feed(),
      onPlay: () => this.pet.play(),
      onClean: () => this.pet.clean(),
      onSleep: () => this.pet.toggleSleep(),
      onPet: () => {
        const result = this.pet.pet();
        if (result && this.animator) this.animator.spawnHearts(3, this.pet);
        return result;
      },
      quoteFn: (personality, category) => this._getQuote(personality, category)
    };
  }

  _companionCanvasHandlers() {
    return {
      onClick: () => {
        if (!this.pet.isAlive) return;
        const result = this.pet.pet();
        if (result && this.animator) this.animator.spawnHearts(3, this.pet);
        if (result && this.ui) {
          this.ui.showQuote('pet', 1000);
        }
      },
      onDblClick: () => this.setMode('normal'),
      onContextMenu: () => this.setMode('normal')
    };
  }

  async init() {
    console.log('[Game] Initializing...');

    this.animator = new Animator('pet-canvas', { stations: PET_CONST.STATIONS });
    await this._tryLoadSave();

    this.ui = new UI(this.pet, this._buildUIActions());

    this._registerQuitHandler();

    this.ui.update();
    this._startLoops();

    if (this.pet.age < 5) {
      this._trackTimeout(() => this.ui.showQuote('idle', 500), GAME_CONST.WELCOME_QUOTE_DELAY);
    }

    const initialMode = this._getInitialMode();
    if (initialMode === 'companion') {
      this.setMode('companion');
    }

    console.log('[Game] Initialization complete');
  }

  async setMode(newMode) {
    if (newMode === this.mode) return;
    const oldMode = this.mode;
    this.mode = newMode;
    const isCompanion = newMode === 'companion';

    console.log(`[Game] Mode: ${oldMode} → ${newMode}`);

    if (this.ui) this.ui.setCompanionMode(isCompanion);
    if (this.animator) this.animator.companionMode = isCompanion;

    this.ui.removeCompanionListeners();
    if (isCompanion) {
      this.ui.addCompanionListeners(this._companionCanvasHandlers());
    }

    this.nextIdleQuoteAt = this._randomIdleInterval();

    if (this._setCompanionMode) {
      try {
        await this.saveGame();
      } catch (e) {
        console.warn('[Game] Pre-swap save failed:', e.message);
      }
      this._setCompanionMode(isCompanion);
    }
  }

  destroy() {
    console.log('[Game] Destroying...');
    this.isRunning = false;

    if (this._tickId) {
      clearInterval(this._tickId);
      this._tickId = null;
    }
    if (this._rAFId) {
      cancelAnimationFrame(this._rAFId);
      this._rAFId = null;
    }
    this._timeouts.forEach(id => clearTimeout(id));
    this._timeouts = [];

    if (this.ui && typeof this.ui.destroy === 'function') {
      this.ui.destroy();
    }
    if (this.animator && typeof this.animator.clearPendingTimeouts === 'function') {
      this.animator.clearPendingTimeouts();
    }

    if (this._beforeQuitUnsub) {
      this._beforeQuitUnsub();
      this._beforeQuitUnsub = null;
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.remove();

    console.log('[Game] Destroyed');
  }

  restart() {
    console.log('[Game] Restarting...');
    this.destroy();

    this.pet = new Pet();
    this.hasShownDeath = false;
    this.isRunning = true;
    this._resetAccumulators();

    if (this.animator && typeof this.animator.reset === 'function') {
      this.animator.reset();
    }

    this.ui = new UI(this.pet, this._buildUIActions());
    const isCompanion = this.mode === 'companion';
    this.ui.setCompanionMode(isCompanion);
    if (this.animator) this.animator.companionMode = isCompanion;
    this.ui.removeCompanionListeners();
    if (isCompanion) {
      this.ui.addCompanionListeners(this._companionCanvasHandlers());
    }
    this.nextIdleQuoteAt = this._randomIdleInterval();
    this.ui.update();
    this._registerQuitHandler();
    this._startLoops();

    console.log('[Game] Restarted with new pet');
  }

  _registerQuitHandler() {
    this._beforeQuitUnsub = this._onBeforeQuit(async () => {
      try {
        await this.saveGame();
      } finally {
        this._notifyQuitSaveDone();
      }
    });
  }

  async _tryLoadSave() {
    try {
      const saved = await this._loadGame();
      if (saved && saved.pet) {
        const loaded = Pet.deserialize(saved.pet);
        if (loaded.isValid()) {
          this.pet = loaded;
          console.log(`[Game] Loaded save: ${this.pet.name} (${this.pet.stage})`);
        } else {
          console.warn('[Game] Save data invalid, starting fresh');
        }
      }
    } catch (e) {
      console.log('[Game] Load error (expected in browser):', e.message);
    }
  }

  _startLoops() {
    this._rAFId = requestAnimationFrame((t) => this._gameLoop(t));
    this._tickId = setInterval(() => this._tick(), GAME_CONST.TICK_INTERVAL);
    console.log('[Game] Loops started');
  }

  _tick() {
    if (!this.isRunning) return;

    this.pet.decayStats();

    const prevStage = this.pet.stage;
    this.pet.update(1);

    if (this.animator) this.animator.update(this.pet);

    if (this.pet.stage !== prevStage && this.pet.stage !== 'dead' && this.ui) {
      this.ui.showQuote('evolve', 500);
    }

    if (this.ui) {
      if (this.ui.pet !== this.pet) this.ui.pet = this.pet;
      this.ui.update();
    }

    this.idleQuoteAccumulator += 1;
    this.tickCount += 1;
    if (this.idleQuoteAccumulator >= this.nextIdleQuoteAt) {
      this.idleQuoteAccumulator = 0;
      this.nextIdleQuoteAt = this._randomIdleInterval();
      if (this.ui && !this.pet.isSleeping && this.pet.isAlive) {
        this.ui.showQuote('idle', 3000);
      }
    }

    if (this.mode !== 'companion') {
      this._checkEventQuotes();
      this._checkCriticalStates();
    }

    if (!this.pet.isAlive && !this.hasShownDeath) {
      this.hasShownDeath = true;
      this.isRunning = false;
      if (this.ui) {
        const deathQuote = this._getQuote ? this._getQuote(this.pet.personality, 'death') : null;
        if (deathQuote) this.ui.showQuoteBubble(deathQuote, this.pet.personality);
      }
      console.log(`[Game] ${this.pet.name} died at ${PetPresenter.displayAge(this.pet.age)}`);
      this._trackTimeout(() => {
        if (this.animator) this.animator.drawGameOver(this.pet);
        if (this.ui) this.ui.createRestartButton(() => this.restart());
      }, GAME_CONST.DEATH_OVERLAY_DELAY);
    }
  }

  _snapshotHobbyLevels() {
    const snap = {};
    for (const [k, v] of Object.entries(this.pet.hobbies)) snap[k] = v.level;
    return snap;
  }

  _checkHobbyLevelUps(prev) {
    if (!this.ui || !this.pet.isAlive) return;
    for (const [key, data] of Object.entries(this.pet.hobbies)) {
      if (data.level > (prev[key] || 1)) {
        this.ui.showHobbyNotification(key, data.level);
        this.ui.showQuote('hobby', 6000);
      }
    }
  }

  _checkEventQuotes() {
    if (!this.ui || !this.pet.isAlive) return;
    const now = this.tickCount;

    if (this.pet.poops.length > 0 && now - this.lastPoopQuoteAt >= GAME_CONST.EVENT_POOP_INTERVAL) {
      this.ui.showQuote('poop', 8000);
      this.lastPoopQuoteAt = now;
    }
    if (this.pet.isSick && now - this.lastSickQuoteAt >= GAME_CONST.EVENT_SICK_INTERVAL) {
      this.ui.showQuote('sick', 10000);
      this.lastSickQuoteAt = now;
    }
    if (this.pet.stats.hunger < 15 && now - this.lastHungryQuoteAt >= GAME_CONST.EVENT_HUNGRY_INTERVAL) {
      this.ui.showQuote('hungry', 8000);
      this.lastHungryQuoteAt = now;
    }
  }

  _checkCriticalStates() {
    if (!this.ui || !this.pet.isAlive) return;

    if (this.tickCount - this.lastCriticalWarnAt < GAME_CONST.CRITICAL_WARN_INTERVAL) return;
    this.lastCriticalWarnAt = this.tickCount;

    let warned = false;
    const check = (stat, label) => {
      if (this.pet.stats[stat] < 20) {
        this.ui.showNotification(`${this.pet.name} is ${label}!`);
        warned = true;
      }
    };

    check('hunger', 'hungry');
    check('happiness', 'sad');
    check('energy', 'tired');
    check('hygiene', 'dirty');
    if (this.pet.isSick) {
      this.ui.showNotification(`${this.pet.name} is sick!`);
      warned = true;
    }

    if (!warned) this.lastCriticalWarnAt = -Infinity;
  }

  _gameLoop(timestamp) {
    if (!this.isRunning || !this._rAFId) {
      this._rAFId = null;
      return;
    }

    if (this.lastTime === 0) this.lastTime = timestamp;

    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const cappedDt = Math.min(dt, GAME_CONST.DT_CAP);

    if (this.pet && typeof this.pet.step === 'function') {
      this.pet.step(cappedDt);
    }

    if (this.animator) {
      this.animator.draw(this.pet);
    }

    if (this.isRunning) {
      this.saveAccumulator += cappedDt;
      if (this.saveAccumulator > GAME_CONST.SAVE_INTERVAL) {
        this.saveAccumulator = 0;
        this.saveGame();
      }
      this._rAFId = requestAnimationFrame((t) => this._gameLoop(t));
    }
  }

  async saveGame() {
    try {
      const result = await this._saveGame({ pet: this.pet.serialize() });
      if (result.success) {
        console.log('[Game] Saved');
      } else {
        console.warn('[Game] Save failed:', result.error);
      }
    } catch (e) {
      console.error('[Game] Save error:', e.message);
    }
  }

}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    const electron = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {};
    const services = {
      getInitialMode: () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'companion' ? 'companion' : 'normal';
      },
      saveGame: (data) => (electron.saveGame ? electron.saveGame(data) : undefined),
      loadGame: () => (electron.loadGame ? electron.loadGame() : undefined),
      onBeforeQuit: (fn) => {
        const unsub = electron.onBeforeQuit ? electron.onBeforeQuit(fn) : undefined;
        return typeof unsub === 'function' ? unsub : () => {};
      },
      notifyQuitSaveDone: () => (electron.notifyQuitSaveDone ? electron.notifyQuitSaveDone() : undefined)
    };
    if (electron.setCompanionMode) {
      services.setCompanionMode = (mode) => electron.setCompanionMode(mode);
    }

    window.game = new Game(services);
    window.game.init();

    const companionBtn = document.getElementById('btn-companion');
    if (companionBtn) {
      companionBtn.addEventListener('click', () => {
        window.game.setMode(window.game.mode === 'normal' ? 'companion' : 'normal');
      });
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Game, GAME_CONST };
}
