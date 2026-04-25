// ============================================
// Tamagotchi Main Game Controller
// Orchestrates pet logic, rendering, UI, save/load.
// All intervals and listeners are tracked for clean disposal.
// ============================================

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
  constructor() {
    this._tickId = null;
    this._rAFId = null;
    this._timeouts = [];
    this._beforeQuitUnsub = null;

    this.pet = new Pet(null, getQuote);
    this.animator = null;
    this.ui = null;

    this._resetAccumulators();

    this.isRunning = true;
    this.hasShownDeath = false;

    console.log('[Game] Controller created');
  }

  _resetAccumulators() {
    this.lastTime = 0;
    this.saveAccumulator = 0;
    this.idleQuoteAccumulator = 0;
    this.nextIdleQuoteAt = this._randomIdleInterval();
    this.lastPoopQuoteAt = -Infinity;
    this.lastSickQuoteAt = -Infinity;
    this.lastHungryQuoteAt = -Infinity;
    this.lastCriticalWarnAt = -Infinity;
  }

  _randomIdleInterval() {
    return 20 + Math.floor(Math.random() * 30);
  }

  _trackTimeout(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timeouts.push(id);
    return id;
  }

  async init() {
    console.log('[Game] Initializing...');

    this.animator = new Animator('pet-canvas');
    await this._tryLoadSave();

    this.ui = new UI(this.pet, this.animator);

    this._registerQuitHandler();

    this.ui.update();
    this._startLoops();

    if (this.pet.age < 5) {
      this._trackTimeout(() => this.ui.showQuote('idle', 500), GAME_CONST.WELCOME_QUOTE_DELAY);
    }

    console.log('[Game] Initialization complete');
  }

  /** Gracefully stop all loops, listeners, and timers */
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

    console.log('[Game] Destroyed');
  }

  /** In-memory restart: new pet, fresh UI, no page reload */
  restart() {
    console.log('[Game] Restarting...');
    this.destroy();

    // Remove the restart button if it exists
    const btn = document.getElementById('restart-btn');
    if (btn) btn.remove();

    this.pet = new Pet(null, getQuote);
    this.hasShownDeath = false;
    this.isRunning = true;
    this._resetAccumulators();

    this.ui = new UI(this.pet, this.animator);
    this.ui.update();
    this._registerQuitHandler();
    this._startLoops();

    console.log('[Game] Restarted with new pet');
  }

  _registerQuitHandler() {
    if (window.electronAPI && window.electronAPI.onBeforeQuit) {
      this._beforeQuitUnsub = window.electronAPI.onBeforeQuit(async () => {
        try {
          await this.saveGame();
        } finally {
          if (window.electronAPI.notifyQuitSaveDone) {
            window.electronAPI.notifyQuitSaveDone();
          }
        }
      });
    }
  }

  async _tryLoadSave() {
    try {
      if (window.electronAPI && window.electronAPI.loadGame) {
        const saved = await window.electronAPI.loadGame();
        if (saved && saved.pet) {
          const loaded = Pet.deserialize(saved.pet, getQuote);
          if (loaded.isValid()) {
            this.pet = loaded;
            console.log(`[Game] Loaded save: ${this.pet.name} (${this.pet.stage})`);
          } else {
            console.warn('[Game] Save data invalid, starting fresh');
          }
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
    if (this.idleQuoteAccumulator >= this.nextIdleQuoteAt) {
      this.idleQuoteAccumulator = 0;
      this.nextIdleQuoteAt = this._randomIdleInterval();
      if (this.ui && !this.pet.isSleeping && this.pet.isAlive) {
        this.ui.showQuote('idle', 3000);
      }
    }

    this._checkEventQuotes();
    this._checkCriticalStates();

    if (!this.pet.isAlive && !this.hasShownDeath) {
      this.hasShownDeath = true;
      this.isRunning = false;
      if (this.ui) {
        const deathQuote = this.pet.getQuote('death');
        if (deathQuote) this.ui.showQuoteBubble(deathQuote, this.pet.personality);
      }
      console.log(`[Game] ${this.pet.name} died at ${this.pet.ageText}`);
      this._trackTimeout(() => this._showGameOver(), GAME_CONST.DEATH_OVERLAY_DELAY);
    }
  }

  _checkEventQuotes() {
    if (!this.ui || !this.pet.isAlive) return;
    const now = this.idleQuoteAccumulator;

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

    if (this.idleQuoteAccumulator - this.lastCriticalWarnAt < GAME_CONST.CRITICAL_WARN_INTERVAL) return;
    this.lastCriticalWarnAt = this.idleQuoteAccumulator;

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

    if (this.animator) {
      this.animator.draw(this.pet);
    }

    if (this.isRunning) {
      this.saveAccumulator += cappedDt;
      if (this.saveAccumulator > GAME_CONST.SAVE_INTERVAL) {
        this.saveAccumulator = 0;
        this.saveGame();
      }
    }

    this._rAFId = requestAnimationFrame((t) => this._gameLoop(t));
  }

  async saveGame() {
    try {
      if (window.electronAPI && window.electronAPI.saveGame) {
        const result = await window.electronAPI.saveGame({ pet: this.pet.serialize() });
        if (result && result.success) {
          console.log('[Game] Saved');
        } else {
          console.warn('[Game] Save failed:', result?.error);
        }
      }
    } catch (e) {
      console.error('[Game] Save error:', e.message);
    }
  }

  _showGameOver() {
    const canvas = document.getElementById('pet-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#E53935';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#FFF8F0';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`${this.pet.name} lived ${this.pet.ageText}`, canvas.width / 2, canvas.height / 2 + 5);
    ctx.fillText(`Reached: ${this.pet.displayStage()}`, canvas.width / 2, canvas.height / 2 + 25);

    this._createRestartButton();
  }

  _createRestartButton() {
    if (document.getElementById('restart-btn')) return;

    const container = document.querySelector('.game-container');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id = 'restart-btn';
    btn.textContent = 'New Pet';
    btn.className = 'action-btn btn-pet';
    btn.style.cssText = 'position:absolute;left:50%;top:58%;transform:translateX(-50%);z-index:200;font-size:10px;padding:12px 20px;';
    btn.onclick = () => this.restart();

    container.appendChild(btn);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
  window.game.init();
});
