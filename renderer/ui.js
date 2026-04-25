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
  constructor(pet, actions = {}) {
    this.pet = pet;
    this._actions = actions;
    this._quoteFn = actions.quoteFn || null;

    this.quoteTimer = null;
    this.quoteCooldowns = {};
    this._cooldownIntervals = new Set();
    this._quoteCooldownTimeouts = new Set();
    this._miscTimeouts = new Set();
    this._disposed = false;
    this._statColors = readStatColorsFromCSS();
    this._lastLogLength = -1;
    this._lastLogTail = 0;
    this._lastLogRenderTime = 0;
    this._companionClickTimer = null;
    this._companionClickHandler = null;
    this._companionDblClickHandler = null;
    this._companionContextHandler = null;

    this.setupButtons();
    this.setupStatBars();
    this.renderActivityLog();
    console.log('[UI] Controller initialized');
  }

  destroy() {
    if (this._disposed) return;
    this.setCompanionMode(false);
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

    this.removeCompanionListeners();
    this.removeRestartButton();

    console.log('[UI] Controller destroyed');
  }

  setupButtons() {
    const actions = {
      'btn-feed':  () => this._actions.onFeed(),
      'btn-play':  () => this._actions.onPlay(),
      'btn-clean': () => this._actions.onClean(),
      'btn-sleep': () => this._actions.onSleep(),
      'btn-pet':   () => this._actions.onPet()
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

        const wasSleeping = this.pet.isSleeping;
        const result = action();
        if (!result) return;

        const meta = this._getActionMeta(id, wasSleeping);
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

  _getActionMeta(id, wasSleeping) {
    const sleeping = wasSleeping !== undefined ? wasSleeping : this.pet.isSleeping;
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

  _getBtnLabel(btn) {
    return btn.querySelector('.btn-label');
  }

  triggerCooldown(btn, seconds) {
    btn.classList.add('cooldown', 'disabled');
    let remaining = seconds;
    const label = this._getBtnLabel(btn);
    const currentText = label ? label.textContent : btn.textContent;
    const originalText = btn.dataset.originalText || currentText;

    if (!btn.dataset.originalText) {
      btn.dataset.originalText = originalText;
    }

    const displayText = `${originalText} (${remaining})`;
    if (label) label.textContent = displayText;
    else btn.textContent = displayText;

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        this._cooldownIntervals.delete(timer);
        btn.classList.remove('cooldown', 'disabled');
        const finalText = btn.id === 'btn-sleep'
          ? (this.pet.isSleeping ? 'WAKE' : 'SLEEP')
          : btn.dataset.originalText;
        if (label) label.textContent = finalText;
        else btn.textContent = finalText;
        btn.dataset.originalText = finalText;
      } else {
        const updateText = `${btn.dataset.originalText} (${remaining})`;
        if (label) label.textContent = updateText;
        else btn.textContent = updateText;
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

    if (ageEl) ageEl.textContent = `Age: ${PetPresenter.displayAge(this.pet.age)}`;
    if (stageEl) {
      const variantText = this.pet.variant !== 'normal' ? ` (${this.pet.variant})` : '';
      stageEl.textContent = `${PetPresenter.displayStage(this.pet.stage)}${variantText} ${PetPresenter.displayPersonalityEmoji(this.pet.personality)}`;
    }
    if (healthEl) {
      healthEl.innerHTML = `<span style="color:${PetPresenter.displayHealthColor(this.pet.health)}">&#9829;</span> ${this.pet.health}`;
    }

    const sleepBtn = document.getElementById('btn-sleep');
    if (sleepBtn && !sleepBtn.classList.contains('cooldown')) {
      const newText = this.pet.isSleeping ? 'WAKE' : 'SLEEP';
      const sleepLabel = this._getBtnLabel(sleepBtn);
      if (sleepLabel) sleepLabel.textContent = newText;
      else sleepBtn.textContent = newText;
      sleepBtn.dataset.originalText = newText;
    }

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.classList.toggle('disabled', !this.pet.isAlive);
    });

    this.renderActivityLog();
  }

  renderActivityLog() {
    const container = document.getElementById('activity-log-entries');
    if (!container) return;

    const log = Array.isArray(this.pet.activityLog) ? this.pet.activityLog : [];
    const tail = log.length ? log[log.length - 1].t : 0;
    const now = Date.now();
    if (log.length === this._lastLogLength && tail === this._lastLogTail && now - this._lastLogRenderTime < 1000) return;

    this._lastLogLength = log.length;
    this._lastLogTail = tail;
    this._lastLogRenderTime = now;

    while (container.firstChild) container.removeChild(container.firstChild);

    const recent = log.slice(-30).reverse();
    for (const entry of recent) {
      const row = document.createElement('div');
      row.className = `activity-log-entry kind-${entry.kind || 'info'}`;

      const time = document.createElement('span');
      time.className = 'activity-log-time';
      time.textContent = this._formatLogTime(entry.t);

      const msg = document.createElement('span');
      msg.className = 'activity-log-msg';
      msg.textContent = entry.msg;

      row.appendChild(time);
      row.appendChild(msg);
      container.appendChild(row);
    }
  }

  _formatLogTime(t) {
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
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

    const quote = this._quoteFn
      ? this._quoteFn(this.pet.personality, category)
      : null;
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

  setCompanionMode(enabled) {
    const container = document.querySelector('.game-container');
    const canvas = document.getElementById('pet-canvas');
    if (!container) return;

    if (enabled) {
      container.classList.add('companion-mode');
      if (canvas) {
        canvas.width = 160;
        canvas.height = 160;
      }
    } else {
      container.classList.remove('companion-mode');
      if (canvas) {
        canvas.width = 320;
        canvas.height = 240;
      }
      this.update();
    }

    document.body.classList.toggle('companion-body', enabled);
  }

  addCompanionListeners(handlers) {
    const canvas = document.getElementById('pet-canvas');
    if (!canvas) return;

    this._companionClickHandler = () => {
      if (this._companionClickTimer) {
        clearTimeout(this._companionClickTimer);
        this._companionClickTimer = null;
      }
      this._companionClickTimer = setTimeout(() => {
        this._companionClickTimer = null;
        if (handlers.onClick) handlers.onClick();
      }, 250);
    };

    this._companionDblClickHandler = () => {
      if (this._companionClickTimer) {
        clearTimeout(this._companionClickTimer);
        this._companionClickTimer = null;
      }
      if (handlers.onDblClick) handlers.onDblClick();
    };

    this._companionContextHandler = (e) => {
      e.preventDefault();
      if (handlers.onContextMenu) handlers.onContextMenu();
    };

    canvas.addEventListener('click', this._companionClickHandler);
    canvas.addEventListener('dblclick', this._companionDblClickHandler);
    canvas.addEventListener('contextmenu', this._companionContextHandler);
    canvas.style.cursor = 'pointer';
  }

  removeCompanionListeners() {
    const canvas = document.getElementById('pet-canvas');
    if (!canvas) return;

    if (this._companionClickHandler) {
      canvas.removeEventListener('click', this._companionClickHandler);
      this._companionClickHandler = null;
    }
    if (this._companionDblClickHandler) {
      canvas.removeEventListener('dblclick', this._companionDblClickHandler);
      this._companionDblClickHandler = null;
    }
    if (this._companionContextHandler) {
      canvas.removeEventListener('contextmenu', this._companionContextHandler);
      this._companionContextHandler = null;
    }
    if (this._companionClickTimer) {
      clearTimeout(this._companionClickTimer);
      this._companionClickTimer = null;
    }
    canvas.style.cursor = '';
  }

  createRestartButton(onClick) {
    if (document.getElementById('restart-btn')) return;
    const container = document.querySelector('.game-container');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id = 'restart-btn';
    btn.textContent = 'New Pet';
    btn.className = 'action-btn btn-pet';
    btn.style.cssText = 'position:absolute;left:50%;top:58%;transform:translateX(-50%);z-index:200;font-size:10px;padding:12px 20px;';
    btn.addEventListener('click', onClick);
    container.appendChild(btn);
  }

  removeRestartButton() {
    const btn = document.getElementById('restart-btn');
    if (btn) btn.remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UI, UI_CONST };
}
