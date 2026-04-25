// ============================================
// Tamagotchi UI Controller
// Handles DOM manipulation, stat bars, buttons,
// cooldowns, notifications, quote bubbles.
// Completely decoupled from Game — only knows Pet + Animator.
// ============================================

const UI_CONST = {
  STAT_SEGMENTS: 10,
  COOLDOWN_FEED: 10,
  COOLDOWN_PLAY: 15,
  COOLDOWN_CLEAN: 8,
  COOLDOWN_SLEEP: 5,
  COOLDOWN_PET: 3,
  NOTIFICATION_DURATION: 2000,
  NOTIFICATION_FADE: 500,
  QUOTE_DISPLAY_MS: 4000,
  QUOTE_FADE_MS: 300,
  PRESSED_ANIMATION_MS: 150,
  IDLE_QUOTE_MIN: 20,
  IDLE_QUOTE_MAX: 50,
  QUOTE_COOLDOWN_IDLE: 3000,
  QUOTE_COOLDOWN_ACTION: 1000,
  QUOTE_COOLDOWN_POOP: 8000,
  QUOTE_COOLDOWN_SICK: 10000,
  QUOTE_COOLDOWN_HUNGRY: 8000
};

const STAT_KEYS = ['hunger', 'happiness', 'energy', 'hygiene'];

/** Read stat colors from CSS custom properties (--stat-*). Single source of truth. */
function readStatColorsFromCSS() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return {};
  }
  const style = getComputedStyle(document.documentElement);
  const colors = {};
  for (const key of STAT_KEYS) {
    colors[key] = style.getPropertyValue(`--stat-${key}`).trim();
  }
  return colors;
}

class UI {
  /**
   * @param {Pet} pet — the pet instance to display
   * @param {Animator|null} animator — optional animator for visual effects
   */
  constructor(pet, animator = null) {
    this.pet = pet;
    this.animator = animator;

    this.quoteTimer = null;
    this.quoteCooldowns = {}; // { category: true/false }
    this._cooldownIntervals = new Set();
    this._quoteCooldownTimeouts = new Set();
    this._miscTimeouts = new Set();
    this._disposed = false;
    this._statColors = readStatColorsFromCSS();

    this.setupButtons();
    this.setupStatBars();
    console.log('[UI] Controller initialized');
  }

  /** Cancel all intervals/timeouts this UI owns. Safe to call twice. */
  destroy() {
    if (this._disposed) return;
    this._disposed = true;

    this._cooldownIntervals.forEach(id => clearInterval(id));
    this._cooldownIntervals.clear();

    this._quoteCooldownTimeouts.forEach(id => clearTimeout(id));
    this._quoteCooldownTimeouts.clear();

    this._miscTimeouts.forEach(id => clearTimeout(id));
    this._miscTimeouts.clear();

    if (this.quoteTimer) {
      clearTimeout(this.quoteTimer);
      this.quoteTimer = null;
    }

    console.log('[UI] Controller destroyed');
  }

  setupButtons() {
    const actions = {
      'btn-feed':  () => this.pet.feed(),
      'btn-play':  () => this.pet.play(),
      'btn-clean': () => this.pet.clean(),
      'btn-sleep': () => this.pet.toggleSleep(),
      'btn-pet':   () => {
        const result = this.pet.pet();
        if (result && this.animator) this.animator.spawnHearts(3);
        return result;
      }
    };

    Object.entries(actions).forEach(([id, action]) => {
      const btn = document.getElementById(id);
      if (!btn) {
        console.warn(`[UI] Button #${id} not found`);
        return;
      }

      btn.addEventListener('click', () => {
        if (btn.classList.contains('cooldown')) return;
        if (!this.pet.isAlive) return;
        if (this.pet.isSleeping && id !== 'btn-sleep') {
          this.showNotification(`${this.pet.name} is sleeping!`);
          return;
        }

        const result = action();
        if (!result) return;

        const meta = this._getActionMeta(id);
        if (!meta) return;

        btn.classList.add('pressed');
        const pressedId = setTimeout(() => {
          btn.classList.remove('pressed');
          this._miscTimeouts.delete(pressedId);
        }, UI_CONST.PRESSED_ANIMATION_MS);
        this._miscTimeouts.add(pressedId);

        this.showNotification(`${this.pet.name} ${meta.verb}`);
        if (meta.quote) this.showQuote(meta.quote, UI_CONST.QUOTE_COOLDOWN_ACTION);
        this.triggerCooldown(btn, meta.cooldown);
        this.update();
      });
    });
  }

  _getActionMeta(id) {
    const sleeping = this.pet.isSleeping;
    switch (id) {
      case 'btn-feed':  return { verb: 'ate happily!', quote: 'feed',  cooldown: UI_CONST.COOLDOWN_FEED };
      case 'btn-play':  return { verb: 'is playing!',  quote: 'play',  cooldown: UI_CONST.COOLDOWN_PLAY };
      case 'btn-clean': return { verb: 'feels clean!', quote: 'clean', cooldown: UI_CONST.COOLDOWN_CLEAN };
      case 'btn-sleep': return {
        verb: sleeping ? 'woke up!' : 'went to sleep!',
        quote: sleeping ? 'wake' : 'sleep',
        cooldown: UI_CONST.COOLDOWN_SLEEP
      };
      case 'btn-pet':   return { verb: 'feels loved!', quote: 'pet',   cooldown: UI_CONST.COOLDOWN_PET };
      default: return null;
    }
  }

  triggerCooldown(btn, seconds) {
    btn.classList.add('cooldown', 'disabled');
    let remaining = seconds;
    const originalText = btn.dataset.originalText || btn.textContent;

    if (!btn.dataset.originalText) {
      btn.dataset.originalText = originalText;
    }

    btn.textContent = `${originalText} (${remaining})`;

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        this._cooldownIntervals.delete(timer);
        btn.classList.remove('cooldown', 'disabled');
        const finalText = btn.id === 'btn-sleep'
          ? (this.pet.isSleeping ? 'WAKE' : 'SLEEP')
          : btn.dataset.originalText;
        btn.textContent = finalText;
        btn.dataset.originalText = finalText;
      } else {
        btn.textContent = `${btn.dataset.originalText} (${remaining})`;
      }
    }, 1000);
    this._cooldownIntervals.add(timer);
  }

  setupStatBars() {
    STAT_KEYS.forEach(stat => {
      const container = document.getElementById(`stat-${stat}`);
      if (!container) {
        console.warn(`[UI] Stat bar #stat-${stat} not found`);
        return;
      }
      while (container.firstChild) container.removeChild(container.firstChild);
      for (let i = 0; i < UI_CONST.STAT_SEGMENTS; i++) {
        const seg = document.createElement('div');
        seg.className = 'stat-segment';
        seg.dataset.index = i;
        container.appendChild(seg);
      }
    });
  }

  update() {
    STAT_KEYS.forEach(stat => {
      const container = document.getElementById(`stat-${stat}`);
      if (!container) return;

      const filled = Math.ceil(this.pet.stats[stat] / UI_CONST.STAT_SEGMENTS);
      const color = this._statColors[stat];

      Array.from(container.children).forEach((seg, i) => {
        seg.style.backgroundColor = i < filled ? color : 'transparent';
        seg.style.opacity = i < filled ? '1' : '0.15';
      });
    });

    const ageEl = document.getElementById('info-age');
    const stageEl = document.getElementById('info-stage');
    const healthEl = document.getElementById('info-health');

    if (ageEl) ageEl.textContent = `Age: ${this.pet.ageText}`;
    if (stageEl) {
      const variantText = this.pet.variant !== 'normal' ? ` (${this.pet.variant})` : '';
      stageEl.textContent = `${this.pet.displayStage()}${variantText} ${this.pet.displayPersonalityEmoji()}`;
    }
    if (healthEl) {
      healthEl.innerHTML = `<span style="color:${this.pet.displayHealthColor()}">&#9829;</span> ${this.pet.health}`;
    }

    const sleepBtn = document.getElementById('btn-sleep');
    if (sleepBtn && !sleepBtn.classList.contains('cooldown')) {
      const newText = this.pet.isSleeping ? 'WAKE' : 'SLEEP';
      sleepBtn.textContent = newText;
      sleepBtn.dataset.originalText = newText;
    }

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.classList.toggle('disabled', !this.pet.isAlive);
    });
  }

  showNotification(text) {
    const container = document.getElementById('notifications');
    if (!container) return;

    const existing = Array.from(container.children);
    if (existing.some(n => n.textContent === text)) return;

    const note = document.createElement('div');
    note.className = 'notification';
    note.textContent = text;
    container.appendChild(note);

    const fadeId = setTimeout(() => {
      this._miscTimeouts.delete(fadeId);
      note.classList.add('fade-out');
      const removeId = setTimeout(() => {
        this._miscTimeouts.delete(removeId);
        if (note.parentNode) note.remove();
      }, UI_CONST.NOTIFICATION_FADE);
      this._miscTimeouts.add(removeId);
    }, UI_CONST.NOTIFICATION_DURATION);
    this._miscTimeouts.add(fadeId);

    console.log(`[UI] Notification: ${text}`);
  }

  showQuoteBubble(text, personality) {
    if (!text) return;
    const bubble = document.getElementById('quote-bubble');
    const quoteText = document.getElementById('quote-text');
    if (!bubble || !quoteText) return;

    if (this.quoteTimer) clearTimeout(this.quoteTimer);

    bubble.className = 'quote-bubble';
    quoteText.textContent = text;
    bubble.classList.add(`personality-${personality}`);

    bubble.style.display = 'block';
    requestAnimationFrame(() => bubble.classList.add('visible'));

    this.quoteTimer = setTimeout(() => {
      this.quoteTimer = null;
      bubble.classList.remove('visible');
      const hideId = setTimeout(() => {
        this._miscTimeouts.delete(hideId);
        bubble.style.display = 'none';
      }, UI_CONST.QUOTE_FADE_MS);
      this._miscTimeouts.add(hideId);
    }, UI_CONST.QUOTE_DISPLAY_MS);

    console.log(`[UI] Quote (${personality}): ${text}`);
  }

  showQuote(category, cooldownMs = 2000) {
    if (this.quoteCooldowns[category]) return;
    if (category !== 'idle' && this.quoteCooldowns['idle']) return;

    const quote = this.pet.getQuote(category);
    if (!quote) return;

    this.showQuoteBubble(quote, this.pet.personality);
    this.quoteCooldowns[category] = true;
    const id = setTimeout(() => {
      this._quoteCooldownTimeouts.delete(id);
      this.quoteCooldowns[category] = false;
    }, cooldownMs);
    this._quoteCooldownTimeouts.add(id);
  }

  clearNotifications() {
    const container = document.getElementById('notifications');
    if (container) container.innerHTML = '';
  }
}
