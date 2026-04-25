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

  DEFAULT_X: 0.5,
  DEFAULT_Y: 0.55,
  MOVE_SPEED: 0.12,
  ARRIVAL_RADIUS: 0.03,
  WANDER_X_MIN: 0.18,
  WANDER_X_MAX: 0.82,
  WANDER_Y_MIN: 0.50,
  WANDER_Y_MAX: 0.62,

  WANDER_IDLE_DURATION: 5,
  EAT_DURATION: 4,
  PLAY_DURATION: 4,
  GROOM_DURATION: 3,
  AUTO_FEED_AMOUNT: 32,
  AUTO_PLAY_HAPPY: 30,
  AUTO_GROOM_AMOUNT: 32,
  AUTO_SLEEP_TARGET_ENERGY: 80,

  GOAL_THRESH_HUNGER: 50,
  GOAL_THRESH_ENERGY: 30,
  GOAL_THRESH_HAPPY: 40,
  GOAL_THRESH_HYGIENE: 50,

  GOAL_TYPES: ['wander', 'seek_food', 'seek_sleep', 'seek_toy', 'groom'],

  ANTIC_TYPES: ['tail_chase', 'stare', 'dance', 'sit'],
  ANTIC_CHANCE: 0.02,
  ANTIC_DURATION_MIN: 3,
  ANTIC_DURATION_MAX: 5,
  DREAM_HEALTH_HIGH: 70,
  DREAM_HEALTH_LOW: 40,
  STAT_HISTORY_LENGTH: 10,

  HOBBIES: ['painting', 'gardening', 'rock_stacking', 'singing'],
  HOBBY_XP_PER_PRACTICE: 10,
  HOBBY_PRACTICE_CHANCE: 0.01,
  HOBBY_MAX_LEVEL: 10,
  HOBBY_LEVEL_THRESHOLDS: [0, 30, 60, 100, 150, 210, 280, 360, 450, 550, 660],
  PERSONALITY_HOBBY_BIAS: {
    quirky: 'rock_stacking',
    cute: 'gardening',
    funny: 'singing',
    absurd: 'painting',
    unhinged: 'singing',
    sardonic: 'rock_stacking'
  },

  STATIONS: {
    food: { x: 0.85, y: 0.55 },
    bed:  { x: 0.15, y: 0.55 },
    toy:  { x: 0.50, y: 0.60 }
  },

  LOG_MAX_ENTRIES: 50
};

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
  constructor(data = null) {
    this._stats = { hunger: 0, happiness: 0, energy: 0, hygiene: 0 };

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
    this.position = d.position;
    this.facing = d.facing;
    this.currentGoal = d.currentGoal;
    this.activityLog = d.activityLog;

    this.statHistory = d.statHistory;
    this.dreamState = d.dreamState;
    this.currentAntic = d.currentAntic;
    this.anticTimer = d.anticTimer;
    this._anticAngle = d._anticAngle;
    this.hobbies = d.hobbies;

    Object.keys(this._stats).forEach(k => this._setStat(k, d.stats[k]));
  }

  /**
   * Sanitize untrusted input (e.g. from save files, localStorage).
   * Any missing or invalid field falls back to a safe default.
   */
  _sanitize(data) {
    const raw = data || {};
    const safe = (val, fallback) => (val !== undefined && val !== null) ? val : fallback;
    const inList = (val, list, fallback) => list.includes(val) ? val : fallback;
    const clamp = (val) => Math.max(PET_CONST.STAT_MIN, Math.min(PET_CONST.STAT_MAX, Number(val) || 0));
    const clamp01 = (val) => Math.max(0, Math.min(1, Number(val) || 0));

    const inputStats = raw.stats || {};
    const stats = {
      hunger: clamp(safe(inputStats.hunger, PET_CONST.STAT_DEFAULT)),
      happiness: clamp(safe(inputStats.happiness, PET_CONST.STAT_DEFAULT)),
      energy: clamp(safe(inputStats.energy, PET_CONST.STAT_DEFAULT)),
      hygiene: clamp(safe(inputStats.hygiene, PET_CONST.STAT_DEFAULT))
    };

    const inputPos = raw.position;
    const position = (inputPos && typeof inputPos.x === 'number' && typeof inputPos.y === 'number')
      ? { x: clamp01(inputPos.x), y: clamp01(inputPos.y) }
      : { x: PET_CONST.DEFAULT_X, y: PET_CONST.DEFAULT_Y };

    const goal = this._sanitizeGoal(raw.currentGoal);

    const log = Array.isArray(raw.activityLog)
      ? raw.activityLog
          .filter(e => e && typeof e.msg === 'string')
          .map(e => ({ t: Number(e.t) || Date.now(), msg: String(e.msg).slice(0, 80), kind: String(e.kind || 'info').slice(0, 16) }))
          .slice(-PET_CONST.LOG_MAX_ENTRIES)
      : [];

    return {
      name: String(safe(raw.name, this._generateName())).slice(0, 20),
      stage: inList(safe(raw.stage, 'egg'), [...PET_CONST.STAGES, 'dead'], 'egg'),
      variant: inList(safe(raw.variant, 'normal'), ['normal', 'good', 'excellent', 'poor'], 'normal'),
      personality: inList(safe(raw.personality, this._generatePersonality()), PET_CONST.PERSONALITIES, 'quirky'),
      bornAt: Number(safe(raw.bornAt, Date.now())) || Date.now(),
      stats,
      state: inList(safe(raw.state, 'idle'), PET_CONST.VALID_STATES, 'idle'),
      isSick: Boolean(raw.isSick),
      poops: Array.isArray(raw.poops) ? raw.poops.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number') : [],
      stageHistory: (raw.stageHistory && typeof raw.stageHistory === 'object' && !Array.isArray(raw.stageHistory)) ? raw.stageHistory : {},
      stateTimer: Math.max(0, Number(raw.stateTimer) || 0),
      evolutionTimer: Math.max(0, Number(raw.evolutionTimer) || 0),
      position,
      facing: raw.facing === 'left' ? 'left' : 'right',
      currentGoal: goal,
      activityLog: log,
      statHistory: Array.isArray(raw.statHistory) ? raw.statHistory.slice(-PET_CONST.STAT_HISTORY_LENGTH) : [],
      dreamState: ['normal', 'happy', 'nightmare'].includes(raw.dreamState) ? raw.dreamState : 'normal',
      currentAntic: PET_CONST.ANTIC_TYPES.includes(raw.currentAntic) ? raw.currentAntic : null,
      anticTimer: Math.max(0, Number(raw.anticTimer) || 0),
      _anticAngle: Number(raw._anticAngle) || 0,
      hobbies: this._sanitizeHobbies(raw.hobbies)
    };
  }

  _sanitizeHobbies(raw) {
    const defaults = () => {
      const obj = {};
      for (const h of PET_CONST.HOBBIES) obj[h] = { level: 1, xp: 0 };
      return obj;
    };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults();
    const out = {};
    for (const h of PET_CONST.HOBBIES) {
      const entry = raw[h];
      const level = Math.max(1, Math.min(PET_CONST.HOBBY_MAX_LEVEL, Number(entry && entry.level) || 1));
      const maxXp = PET_CONST.HOBBY_LEVEL_THRESHOLDS[PET_CONST.HOBBY_MAX_LEVEL];
      const xp = Math.max(0, Math.min(maxXp, Number(entry && entry.xp) || 0));
      out[h] = { level, xp };
    }
    return out;
  }

  _sanitizeGoal(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!PET_CONST.GOAL_TYPES.includes(raw.type)) return null;
    const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
    return {
      type: raw.type,
      targetX: clamp01(raw.targetX),
      targetY: clamp01(raw.targetY),
      actionStarted: Boolean(raw.actionStarted),
      actionTimer: Math.max(0, Number(raw.actionTimer) || 0)
    };
  }

  isValid() {
    const validStage = PET_CONST.STAGES.includes(this.stage) || this.stage === 'dead';
    const validHobbies = PET_CONST.HOBBIES.every(h => {
      const entry = this.hobbies[h];
      return entry &&
        typeof entry.level === 'number' &&
        entry.level >= 1 && entry.level <= PET_CONST.HOBBY_MAX_LEVEL &&
        typeof entry.xp === 'number' && entry.xp >= 0;
    });
    return (
      validStage &&
      PET_CONST.VALID_STATES.includes(this.state) &&
      PET_CONST.PERSONALITIES.includes(this.personality) &&
      Object.values(this._stats).every(v => v >= PET_CONST.STAT_MIN && v <= PET_CONST.STAT_MAX) &&
      typeof this.bornAt === 'number' &&
      Array.isArray(this.poops) && this.poops.length <= PET_CONST.MAX_POOPS &&
      validHobbies &&
      Object.keys(this.hobbies).length === PET_CONST.HOBBIES.length
    );
  }

  _setStat(key, value) {
    this._stats[key] = Math.max(PET_CONST.STAT_MIN, Math.min(PET_CONST.STAT_MAX, Number(value) || 0));
  }

  _decay(key, amount = 1) {
    this._setStat(key, this._stats[key] - amount);
  }

  _setState(newState) {
    if (this.state === newState || STATE_TRANSITIONS[this.state].includes(newState)) {
      this.state = newState;
    }
  }

  _log(msg, kind = 'info') {
    if (!msg) return;
    this.activityLog.push({ t: Date.now(), msg: String(msg).slice(0, 80), kind });
    if (this.activityLog.length > PET_CONST.LOG_MAX_ENTRIES) {
      this.activityLog.splice(0, this.activityLog.length - PET_CONST.LOG_MAX_ENTRIES);
    }
  }

  _think() {
    if (!this.isAlive || this.stage === 'egg' || this.isSleeping) return;
    if (this.currentGoal || this.currentAntic) return;
    if (!['idle', 'happy', 'sad'].includes(this.state)) return;

    const s = this._stats;
    const candidates = [];

    if (s.hunger < PET_CONST.GOAL_THRESH_HUNGER) {
      candidates.push({ type: 'seek_food', priority: 100 - s.hunger });
    }
    if (s.energy < PET_CONST.GOAL_THRESH_ENERGY) {
      candidates.push({ type: 'seek_sleep', priority: 100 - s.energy + 20 });
    }
    if (s.happiness < PET_CONST.GOAL_THRESH_HAPPY) {
      candidates.push({ type: 'seek_toy', priority: 100 - s.happiness });
    }
    if (s.hygiene < PET_CONST.GOAL_THRESH_HYGIENE) {
      candidates.push({ type: 'groom', priority: 100 - s.hygiene });
    }

    if (candidates.length === 0) {
      candidates.push({ type: 'wander', priority: 1 });
    }

    candidates.sort((a, b) => b.priority - a.priority);
    this._startGoal(candidates[0].type);
  }

  _startGoal(type) {
    const stations = PET_CONST.STATIONS;
    let targetX = this.position.x, targetY = this.position.y;

    if (type === 'seek_food') { targetX = stations.food.x; targetY = stations.food.y; }
    else if (type === 'seek_sleep') { targetX = stations.bed.x; targetY = stations.bed.y; }
    else if (type === 'seek_toy') { targetX = stations.toy.x; targetY = stations.toy.y; }
    else if (type === 'groom') {}
    else if (type === 'wander') {
      targetX = PET_CONST.WANDER_X_MIN + Math.random() * (PET_CONST.WANDER_X_MAX - PET_CONST.WANDER_X_MIN);
      targetY = PET_CONST.WANDER_Y_MIN + Math.random() * (PET_CONST.WANDER_Y_MAX - PET_CONST.WANDER_Y_MIN);
    }

    this.currentGoal = { type, targetX, targetY, actionStarted: false, actionTimer: 0 };

    if (targetX < this.position.x - 0.005) this.facing = 'left';
    else if (targetX > this.position.x + 0.005) this.facing = 'right';
  }

  /**
   * Per-frame movement & goal progress (60Hz). Decoupled from update(dt)
   * which still runs at 1Hz for stat decay and timers.
   */
  step(dt) {
    if (!this.isAlive) return;

    if (this.currentAntic) {
      this._anticAngle += dt * 2;
      if (this.currentAntic === 'tail_chase') {
        this.position.x += Math.cos(this._anticAngle) * 0.003;
        this.position.y += Math.sin(this._anticAngle) * 0.003;
        this.position.x = Math.max(0.1, Math.min(0.9, this.position.x));
        this.position.y = Math.max(0.4, Math.min(0.7, this.position.y));
      } else if (this.currentAntic === 'dance') {
        this.position.x += Math.sin(this._anticAngle * 2) * 0.002;
        this.position.x = Math.max(0.1, Math.min(0.9, this.position.x));
      }
      return;
    }

    if (!this.currentGoal) return;
    if (!['idle', 'happy', 'sad', 'eating', 'playing', 'sleeping'].includes(this.state)) return;

    const goal = this.currentGoal;

    if (!goal.actionStarted) {
      const dx = goal.targetX - this.position.x;
      const dy = goal.targetY - this.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= PET_CONST.ARRIVAL_RADIUS) {
        this._onArrival();
      } else {
        const step = PET_CONST.MOVE_SPEED * dt;
        if (step >= dist) {
          this.position.x = goal.targetX;
          this.position.y = goal.targetY;
        } else {
          this.position.x += (dx / dist) * step;
          this.position.y += (dy / dist) * step;
        }
        this.facing = dx < 0 ? 'left' : dx > 0 ? 'right' : this.facing;
      }
    } else {
      goal.actionTimer -= dt;
      if (goal.type === 'seek_sleep') {
        if (this._stats.energy >= PET_CONST.AUTO_SLEEP_TARGET_ENERGY) {
          this._completeGoal();
        }
      } else if (goal.actionTimer <= 0) {
        this._completeGoal();
      }
    }
  }

  _onArrival() {
    const goal = this.currentGoal;
    if (!goal) return;
    goal.actionStarted = true;

    switch (goal.type) {
      case 'seek_food':
        this._setState('eating');
        goal.actionTimer = PET_CONST.EAT_DURATION;
        this.stateTimer = PET_CONST.EAT_DURATION;
        this._setStat('hunger', this._stats.hunger + PET_CONST.AUTO_FEED_AMOUNT);
        this._log(`${this.name} ate from the bowl`, 'auto');
        break;
      case 'seek_sleep':
        this._setState('sleeping');
        this._log(`${this.name} curled up for a nap`, 'auto');
        break;
      case 'seek_toy':
        this._setState('playing');
        goal.actionTimer = PET_CONST.PLAY_DURATION;
        this.stateTimer = PET_CONST.PLAY_DURATION;
        this._setStat('happiness', this._stats.happiness + PET_CONST.AUTO_PLAY_HAPPY);
        this._log(`${this.name} played with the ball`, 'auto');
        break;
      case 'groom':
        this._setState('happy');
        goal.actionTimer = PET_CONST.GROOM_DURATION;
        this.stateTimer = PET_CONST.GROOM_DURATION;
        this._setStat('hygiene', this._stats.hygiene + PET_CONST.AUTO_GROOM_AMOUNT);
        this._log(`${this.name} groomed itself`, 'auto');
        break;
      case 'wander':
        goal.actionTimer = PET_CONST.WANDER_IDLE_DURATION;
        this._log(`${this.name} wandered around`, 'auto');
        break;
    }
  }

  _completeGoal() {
    const goal = this.currentGoal;
    if (!goal) return;
    if (goal.type === 'seek_sleep' && this.isSleeping) {
      this._setState('idle');
      this._log(`${this.name} woke up refreshed`, 'auto');
    }
    this.currentGoal = null;
  }

  _interruptGoal() {
    this.currentGoal = null;
  }

  _generateName() {
    const pool = PET_CONST.NAME_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _generatePersonality() {
    const pool = PET_CONST.PERSONALITIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

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

  canFeed() {
    return this.isAlive && !this.isSleeping && this._stats.hunger < PET_CONST.STAT_MAX;
  }

  canPlay() {
    return this.isAlive && !this.isSleeping && this._stats.energy >= PET_CONST.PLAY_ENERGY_COST && this._stats.happiness < PET_CONST.STAT_MAX;
  }

  canClean() {
    return this.isAlive && !this.isSleeping && (this._stats.hygiene < PET_CONST.STAT_MAX || this.poops.length > 0);
  }

  canPet() {
    return this.isAlive && !this.isSleeping;
  }

  canToggleSleep() {
    return this.isAlive;
  }

  feed() {
    if (!this.canFeed()) return false;
    this._interruptGoal();
    this._setStat('hunger', this._stats.hunger + PET_CONST.FEED_AMOUNT);
    this._setState('eating');
    this.stateTimer = 3;
    this._log(`you fed ${this.name}`, 'user');
    return true;
  }

  play() {
    if (!this.canPlay()) return false;
    this._interruptGoal();
    this._setStat('happiness', this._stats.happiness + PET_CONST.PLAY_HAPPY_BOOST);
    this._decay('energy', PET_CONST.PLAY_ENERGY_COST);
    this._decay('hunger', PET_CONST.PLAY_HUNGER_COST);
    this._setState('playing');
    this.stateTimer = 4;
    this._log(`you played with ${this.name}`, 'user');
    return true;
  }

  clean() {
    if (!this.canClean()) return false;
    this._interruptGoal();
    this._setStat('hygiene', this._stats.hygiene + PET_CONST.CLEAN_AMOUNT);
    const removed = this.poops.length;
    this.poops = [];
    if (this.isSick && this._stats.hygiene > PET_CONST.SICK_RECOVERY_HYGIENE) {
      this.isSick = false;
      this._log(`${this.name} recovered from sickness`, 'event');
    }
    this._setState('happy');
    this.stateTimer = 2;
    this._log(`you cleaned up`, 'user');
    return true;
  }

  toggleSleep() {
    if (!this.canToggleSleep()) return false;
    this._interruptGoal();
    if (this.isSleeping) {
      this._setState('idle');
      this._log(`you woke ${this.name} up`, 'user');
    } else {
      this._setState('sleeping');
      this._log(`you put ${this.name} to sleep`, 'user');
    }
    return true;
  }

  pet() {
    if (!this.canPet()) return false;
    this._interruptGoal();
    this._setStat('happiness', this._stats.happiness + PET_CONST.PET_HAPPY_BOOST);
    this._setState('happy');
    this.stateTimer = 2;
    this._log(`you pet ${this.name}`, 'user');
    return true;
  }

  decayStats() {
    if (!this.isAlive) return;
    if (this.stage === 'egg') return;

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
      this._log(`${this.name} got sick`, 'event');
    }

    if (this.isSick) {
      this._decay('hunger');
      this._decay('happiness');
    }

    if (this._stats.energy < PET_CONST.AUTO_SLEEP_ENERGY && !this.isSleeping) {
      this._setState('sleeping');
      this._startGoal('seek_sleep');
      this._log(`${this.name} collapsed from exhaustion`, 'event');
    }
  }

  update(dt) {
    if (!this.isAlive) {
      this.stage = 'dead';
      this._setState('dead');
      this.currentAntic = null;
      this.anticTimer = 0;
      return;
    }

    this._updateStatHistory();
    this._updateDreamState();

    if (this.currentAntic) {
      this.anticTimer -= dt;
      if (this.anticTimer <= 0) {
        this.currentAntic = null;
        this.anticTimer = 0;
      }
    }

    this._updateAntics();
    this._updateHobbies();

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
      this._log(`${this.name} made a mess`, 'event');
    }

    if (this._stats.happiness < 15 && !this.isSleeping && ['idle', 'happy'].includes(this.state)) {
      this._setState('sad');
    }
    if (this.state === 'sad' && this._stats.happiness >= 25) {
      this._setState('idle');
    }
    if (this.currentAntic && !['idle', 'happy'].includes(this.state)) {
      this.currentAntic = null;
      this.anticTimer = 0;
    }

    this._think();
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

    this._log(`${this.name} evolved into ${this.stage}!`, 'event');
  }

  _updateStatHistory() {
    const avg = Object.values(this._stats).reduce((a, b) => a + b, 0) / 4;
    this.statHistory.push(avg);
    if (this.statHistory.length > PET_CONST.STAT_HISTORY_LENGTH) {
      this.statHistory.shift();
    }
  }

  _updateDreamState() {
    if (!this.isSleeping) {
      this.dreamState = 'normal';
      return;
    }
    if (this.statHistory.length === 0) {
      this.dreamState = 'normal';
      return;
    }
    const avg = this.statHistory.reduce((a, b) => a + b, 0) / this.statHistory.length;
    if (avg >= PET_CONST.DREAM_HEALTH_HIGH) this.dreamState = 'happy';
    else if (avg <= PET_CONST.DREAM_HEALTH_LOW) this.dreamState = 'nightmare';
    else this.dreamState = 'normal';
  }

  _updateAntics() {
    if (!this.isAlive || this.stage === 'egg' || this.isSleeping || this.currentGoal || this.currentAntic) return;
    if (!['idle', 'happy'].includes(this.state)) return;
    if (Math.random() < PET_CONST.ANTIC_CHANCE) {
      const type = PET_CONST.ANTIC_TYPES[Math.floor(Math.random() * PET_CONST.ANTIC_TYPES.length)];
      this._startAntic(type);
    }
  }

  _startAntic(type) {
    this.currentAntic = type;
    this.anticTimer = PET_CONST.ANTIC_DURATION_MIN + Math.random() * (PET_CONST.ANTIC_DURATION_MAX - PET_CONST.ANTIC_DURATION_MIN);
    this._anticAngle = Math.random() * Math.PI * 2;
    const desc = type === 'tail_chase' ? 'chasing its tail'
      : type === 'stare' ? 'staring into space'
      : type === 'dance' ? 'doing a little dance'
      : 'sitting comfortably';
    this._log(`${this.name} is ${desc}`, 'auto');
  }

  _getPersonalityHobby() {
    return PET_CONST.PERSONALITY_HOBBY_BIAS[this.personality];
  }

  _practiceHobby(hobbyName) {
    if (!PET_CONST.HOBBIES.includes(hobbyName)) return;
    const hobby = this.hobbies[hobbyName];
    if (hobby.level >= PET_CONST.HOBBY_MAX_LEVEL) return;

    hobby.xp += PET_CONST.HOBBY_XP_PER_PRACTICE;
    const nextThreshold = PET_CONST.HOBBY_LEVEL_THRESHOLDS[hobby.level];
    if (hobby.xp >= nextThreshold && hobby.level < PET_CONST.HOBBY_MAX_LEVEL) {
      hobby.level += 1;
      this._log(`${this.name} practiced ${hobbyName} and reached Lv.${hobby.level}!`, 'event');
    } else {
      this._log(`${this.name} practiced ${hobbyName}`, 'auto');
    }
  }

  _updateHobbies() {
    if (!this.isAlive || this.stage === 'egg' || this.isSleeping || this.currentGoal || this.currentAntic) return;
    if (!['idle', 'happy'].includes(this.state)) return;
    if (Math.random() < PET_CONST.HOBBY_PRACTICE_CHANCE) {
      const biased = this._getPersonalityHobby();
      const hobby = Math.random() < 0.6 ? biased : PET_CONST.HOBBIES[Math.floor(Math.random() * PET_CONST.HOBBIES.length)];
      this._practiceHobby(hobby);
    }
  }

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
      evolutionTimer: this.evolutionTimer,
      position: { ...this.position },
      facing: this.facing,
      currentGoal: this.currentGoal ? { ...this.currentGoal } : null,
      activityLog: this.activityLog.slice(-PET_CONST.LOG_MAX_ENTRIES),
      statHistory: [...this.statHistory],
      dreamState: this.dreamState,
      currentAntic: this.currentAntic,
      anticTimer: this.anticTimer,
      _anticAngle: this._anticAngle,
      hobbies: JSON.parse(JSON.stringify(this.hobbies))
    };
  }

  static deserialize(data) {
    return new Pet(data);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pet, PET_CONST };
}
