// ============================================
// Tamagotchi Pet Class
// Encapsulated state with validation, clamped stats,
// explicit dependencies, and a documented state machine.
// ============================================

const PET_CONST = {
  STAT_MAX: 100,
  STAT_DEFAULT: 80,
  STAT_MIN: 0,

  FEED_AMOUNT: 25,
  PLAY_HAPPY_BOOST: 20,
  PLAY_ENERGY_COST: 10,
  PLAY_HUNGER_COST: 5,
  CLEAN_AMOUNT: 30,
  PET_HAPPY_BOOST: 5,

  SICK_HYGIENE_THRESHOLD: 30,
  SICK_RECOVERY_HYGIENE: 50,
  AUTO_SLEEP_ENERGY: 15,
  SLEEP_ENERGY_RECOVERY: 2,

  STAGE_TIMES: { egg: 120, baby: 300, child: 600, teen: 900 },

  VARIANT_EXCELLENT: 80,
  VARIANT_GOOD: 50,

  POOP_CHANCE: 0.0005,
  MAX_POOPS: 3,

  STAGES: ['egg', 'baby', 'child', 'teen', 'adult'],
  VALID_STATES: ['idle', 'happy', 'eating', 'playing', 'sleeping', 'sad', 'dead'],
  PERSONALITIES: ['quirky', 'cute', 'funny', 'absurd', 'unhinged', 'sardonic'],
  NAME_POOL: ['Mochi', 'Pudding', 'Bloop', 'Pixel', 'Neko'],

  PERSONALITY_EMOJIS: { quirky: '✨', cute: '💕', funny: '😂', absurd: '🌀', unhinged: '⚡', sardonic: '😏' }
};

// Valid state transitions. Terminal: dead.
const STATE_TRANSITIONS = {
  idle: ['happy', 'eating', 'playing', 'sleeping', 'sad', 'dead'],
  happy: ['idle', 'eating', 'playing', 'sleeping', 'sad', 'dead'],
  eating: ['idle', 'happy', 'playing', 'sleeping', 'sad', 'dead'],
  playing: ['idle', 'happy', 'eating', 'sleeping', 'sad', 'dead'],
  sleeping: ['idle', 'dead'],
  sad: ['idle', 'happy', 'eating', 'playing', 'sleeping', 'dead'],
  dead: ['dead']
};

/**
 * Pet — the core domain model.
 *
 * State machine (valid transitions):
 *   idle/happy/eating/playing/sad  →  sleeping  (toggleSleep, exhaustion)
 *   sleeping  →  idle  (toggleSleep, wake)
 *   any (alive)  →  dead  (health ≤ 0)
 *   dead  →  dead  (terminal)
 *
 * Stats are always clamped to [0, 100]. External code cannot write
 * invalid values because _stats is private and only mutated through
 * validated methods.
 */
class Pet {
  /**
   * @param {object|null} data — serialized pet data or null for a new pet
   * @param {Function|null} quoteFn — optional getQuote(personality, category) function
   */
  constructor(data = null, quoteFn = null) {
    this._stats = { hunger: 0, happiness: 0, energy: 0, hygiene: 0 };
    this._quoteFn = typeof quoteFn === 'function' ? quoteFn : null;

    const d = this._sanitize(data);

    this.name = d.name;
    this.stage = d.stage;
    this.variant = d.variant;
    this.bornAt = d.bornAt;
    this.personality = d.personality;
    this.state = d.state;
    this.isSick = d.isSick;
    this.poops = d.poops;
    this.stageHistory = d.stageHistory;
    this.stateTimer = d.stateTimer;
    this.evolutionTimer = d.evolutionTimer;

    // Apply sanitized stats through the setter so they get clamped
    Object.keys(this._stats).forEach(k => this._setStat(k, d.stats[k]));

    console.log(`[Pet] Created: ${this.name} (${this.stage}, ${this.variant}, ${this.personality})`);
  }

  // ---------- Private: validation & helpers ----------

  /**
   * Sanitize untrusted input (e.g. from save files, localStorage).
   * Any missing or invalid field falls back to a safe default.
   */
  _sanitize(raw) {
    const safe = (val, fallback) => (val !== undefined && val !== null) ? val : fallback;
    const inList = (val, list, fallback) => list.includes(val) ? val : fallback;
    const clamp = (val) => Math.max(PET_CONST.STAT_MIN, Math.min(PET_CONST.STAT_MAX, Number(val) || 0));

    const inputStats = raw?.stats || {};
    const stats = {
      hunger: clamp(safe(inputStats.hunger, PET_CONST.STAT_DEFAULT)),
      happiness: clamp(safe(inputStats.happiness, PET_CONST.STAT_DEFAULT)),
      energy: clamp(safe(inputStats.energy, PET_CONST.STAT_DEFAULT)),
      hygiene: clamp(safe(inputStats.hygiene, PET_CONST.STAT_DEFAULT))
    };

    return {
      name: String(safe(raw?.name, this._generateName())).slice(0, 20) || 'Pet',
      stage: inList(safe(raw?.stage, 'egg'), [...PET_CONST.STAGES, 'dead'], 'egg'),
      variant: inList(safe(raw?.variant, 'normal'), ['normal', 'good', 'excellent', 'poor'], 'normal'),
      personality: inList(safe(raw?.personality, this._generatePersonality()), PET_CONST.PERSONALITIES, 'quirky'),
      bornAt: Number(safe(raw?.bornAt, Date.now())) || Date.now(),
      stats,
      state: inList(safe(raw?.state, 'idle'), PET_CONST.VALID_STATES, 'idle'),
      isSick: Boolean(raw?.isSick),
      poops: Array.isArray(raw?.poops) ? raw.poops.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number') : [],
      stageHistory: (raw?.stageHistory && typeof raw.stageHistory === 'object') ? raw.stageHistory : {},
      stateTimer: Math.max(0, Number(raw?.stateTimer) || 0),
      evolutionTimer: Math.max(0, Number(raw?.evolutionTimer) || 0)
    };
  }

  /** @returns {boolean} true if this pet's data is internally consistent */
  isValid() {
    const validStage = PET_CONST.STAGES.includes(this.stage) || this.stage === 'dead';
    return (
      validStage &&
      PET_CONST.VALID_STATES.includes(this.state) &&
      PET_CONST.PERSONALITIES.includes(this.personality) &&
      Object.values(this._stats).every(v => v >= PET_CONST.STAT_MIN && v <= PET_CONST.STAT_MAX) &&
      typeof this.bornAt === 'number' &&
      Array.isArray(this.poops) && this.poops.length <= PET_CONST.MAX_POOPS
    );
  }

  /** Clamp a stat to [0, 100] and store it */
  _setStat(key, value) {
    this._stats[key] = Math.max(PET_CONST.STAT_MIN, Math.min(PET_CONST.STAT_MAX, Number(value) || 0));
  }

  /** Decay a stat by amount, clamped to min */
  _decay(key, amount = 1) {
    this._setStat(key, this._stats[key] - amount);
  }

  /** Only allow state transitions that are valid in the state machine */
  _setState(newState) {
    if (!PET_CONST.VALID_STATES.includes(newState)) {
      console.warn(`[Pet] Invalid state rejected: "${newState}"`);
      return;
    }

    if (this.state === newState || STATE_TRANSITIONS[this.state]?.includes(newState)) {
      this.state = newState;
    } else {
      console.warn(`[Pet] State transition rejected: ${this.state} → ${newState}`);
    }
  }

  _generateName() {
    const pool = PET_CONST.NAME_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _generatePersonality() {
    const pool = PET_CONST.PERSONALITIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- Public getters ----------

  /** Read-only access to stats — external code can read but not write */
  get stats() {
    return Object.freeze({ ...this._stats });
  }

  get isSleeping() {
    return this.state === 'sleeping';
  }

  get health() {
    const s = this._stats;
    return Math.floor((s.hunger + s.happiness + s.energy + s.hygiene) / 4);
  }

  get isAlive() {
    return this.health > PET_CONST.STAT_MIN && this.stage !== 'dead';
  }

  get age() {
    return Math.floor((Date.now() - this.bornAt) / 1000);
  }

  get ageText() {
    const h = Math.floor(this.age / 3600);
    const m = Math.floor((this.age % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ---------- Display helpers (no Feature Envy) ----------

  displayStage() {
    return this.stage.charAt(0).toUpperCase() + this.stage.slice(1);
  }

  displayHealthColor() {
    const h = this.health;
    if (h > 60) return '#4CAF50';
    if (h > 30) return '#FF9800';
    return '#E53935';
  }

  displayPersonalityEmoji() {
    return PET_CONST.PERSONALITY_EMOJIS[this.personality] || '';
  }

  // ---------- Quotes ----------

  getQuote(category) {
    return this._quoteFn ? this._quoteFn(this.personality, category) : null;
  }

  // ---------- Actions ----------

  canFeed() {
    return this.isAlive && !this.isSleeping && this._stats.hunger < PET_CONST.STAT_MAX;
  }

  canPlay() {
    return this.isAlive && !this.isSleeping && this._stats.energy >= PET_CONST.PLAY_ENERGY_COST && this._stats.happiness < PET_CONST.STAT_MAX;
  }

  canClean() {
    return this.isAlive && !this.isSleeping;
  }

  canPet() {
    return this.isAlive && !this.isSleeping;
  }

  canToggleSleep() {
    return this.isAlive;
  }

  feed() {
    if (!this.canFeed()) return false;
    this._setStat('hunger', this._stats.hunger + PET_CONST.FEED_AMOUNT);
    this._setState('eating');
    this.stateTimer = 3;
    console.log(`[Pet] ${this.name} ate. Hunger: ${this._stats.hunger}`);
    return true;
  }

  play() {
    if (!this.canPlay()) return false;
    this._setStat('happiness', this._stats.happiness + PET_CONST.PLAY_HAPPY_BOOST);
    this._decay('energy', PET_CONST.PLAY_ENERGY_COST);
    this._decay('hunger', PET_CONST.PLAY_HUNGER_COST);
    this._setState('playing');
    this.stateTimer = 4;
    console.log(`[Pet] ${this.name} is playing. Happy: ${this._stats.happiness}`);
    return true;
  }

  clean() {
    if (!this.canClean()) return false;
    this._setStat('hygiene', this._stats.hygiene + PET_CONST.CLEAN_AMOUNT);
    const removed = this.poops.length;
    this.poops = [];
    if (this.isSick && this._stats.hygiene > PET_CONST.SICK_RECOVERY_HYGIENE) {
      this.isSick = false;
      console.log(`[Pet] ${this.name} recovered from sickness`);
    }
    this._setState('happy');
    this.stateTimer = 2;
    console.log(`[Pet] ${this.name} cleaned. Hygiene: ${this._stats.hygiene} (-${removed} poops)`);
    return true;
  }

  toggleSleep() {
    if (!this.canToggleSleep()) return false;
    if (this.isSleeping) {
      this._setState('idle');
    } else {
      this._setState('sleeping');
    }
    console.log(`[Pet] ${this.name} ${this.isSleeping ? 'fell asleep' : 'woke up'}`);
    return true;
  }

  pet() {
    if (!this.canPet()) return false;
    this._setStat('happiness', this._stats.happiness + PET_CONST.PET_HAPPY_BOOST);
    this._setState('happy');
    this.stateTimer = 2;
    console.log(`[Pet] ${this.name} feels loved. Happy: ${this._stats.happiness}`);
    return true;
  }

  // ---------- Tick update ----------

  decayStats() {
    if (!this.isAlive) return;

    if (this.isSleeping) {
      this._setStat('energy', this._stats.energy + PET_CONST.SLEEP_ENERGY_RECOVERY);
      return;
    }

    this._decay('hunger');
    this._decay('happiness');
    this._decay('energy');
    this._decay('hygiene');

    if (this._stats.hygiene < PET_CONST.SICK_HYGIENE_THRESHOLD && !this.isSick) {
      this.isSick = true;
      console.log(`[Pet] ${this.name} got sick (hygiene too low)`);
    }

    if (this.isSick) {
      this._decay('hunger');
      this._decay('happiness');
    }

    if (this._stats.energy < PET_CONST.AUTO_SLEEP_ENERGY) {
      this._setState('sleeping');
      console.log(`[Pet] ${this.name} fell asleep from exhaustion`);
    }
  }

  update(dt) {
    if (!this.isAlive) {
      this.stage = 'dead';
      this._setState('dead');
      return;
    }

    this.evolutionTimer += dt;

    if (this.stage !== 'adult' && this.stage !== 'dead') {
      const timeNeeded = PET_CONST.STAGE_TIMES[this.stage] || Infinity;
      if (this.evolutionTimer > timeNeeded) {
        this.evolve();
      }
    }

    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this._setState(this.isSleeping ? 'sleeping' : 'idle');
      }
    }

    if (this.stage !== 'egg' && Math.random() < PET_CONST.POOP_CHANCE && this.poops.length < PET_CONST.MAX_POOPS) {
      this.poops.push({ x: 0.2 + Math.random() * 0.6, y: 0.75 + Math.random() * 0.15 });
      console.log(`[Pet] ${this.name} made a mess (${this.poops.length} poops)`);
    }
  }

  evolve() {
    const idx = PET_CONST.STAGES.indexOf(this.stage);
    if (idx < 0 || idx >= PET_CONST.STAGES.length - 1) return;

    const avgStat = Object.values(this._stats).reduce((a, b) => a + b, 0) / 4;
    this.stageHistory[this.stage] = avgStat;

    this.stage = PET_CONST.STAGES[idx + 1];
    this.evolutionTimer = 0;
    this._setState('happy');
    this.stateTimer = 5;

    if (avgStat >= PET_CONST.VARIANT_EXCELLENT) this.variant = 'excellent';
    else if (avgStat >= PET_CONST.VARIANT_GOOD) this.variant = 'good';
    else this.variant = 'poor';

    console.log(`[Pet] Evolved to ${this.stage}! (${this.variant}, avg ${avgStat.toFixed(1)})`);
  }

  // ---------- Serialization ----------

  serialize() {
    return {
      name: this.name,
      stage: this.stage,
      variant: this.variant,
      personality: this.personality,
      bornAt: this.bornAt,
      stats: { ...this._stats },
      state: this.state,
      isSick: this.isSick,
      poops: [...this.poops],
      stageHistory: { ...this.stageHistory },
      stateTimer: this.stateTimer,
      evolutionTimer: this.evolutionTimer
    };
  }

  static deserialize(data, quoteFn = null) {
    return new Pet(data, quoteFn);
  }
}

// Conditional export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pet, PET_CONST };
}
