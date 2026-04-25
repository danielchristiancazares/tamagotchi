// ============================================
// TDD Tests for Pet Class
// Run with: node test/pet.test.js
// ============================================

const { test, run, describe, assert } = require('./runner');
const { Pet, PET_CONST } = require('../renderer/pet');
const { PetPresenter } = require('../renderer/pet-presenter');
const { getQuote } = require('../renderer/quotes');

// -- Helper: create a pet with known stats --
function makePet(overrides = {}) {
  return new Pet({
    name: 'TestPet',
    stage: 'child',
    state: 'idle',
    stats: {
      hunger: 50,
      happiness: 50,
      energy: 50,
      hygiene: 50,
      ...overrides.stats
    },
    bornAt: Date.now() - 5000,
    ...overrides
  });
}

// -- Helper: create a pet at full stats --
function makeFullPet(overrides = {}) {
  return new Pet({
    name: 'FullPet',
    stage: 'child',
    state: 'idle',
    stats: {
      hunger: 100,
      happiness: 100,
      energy: 100,
      hygiene: 100,
      ...overrides.stats
    },
    bornAt: Date.now() - 5000,
    ...overrides
  });
}

// ============================================
// Constructor & Defaults
// ============================================
describe('Constructor & Defaults', () => {

  test('default pet has correct initial stats', () => {
    const p = new Pet();
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_DEFAULT);
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_DEFAULT);
    assert.strictEqual(p.stats.energy, PET_CONST.STAT_DEFAULT);
    assert.strictEqual(p.stats.hygiene, PET_CONST.STAT_DEFAULT);
  });

  test('default pet starts as egg stage', () => {
    const p = new Pet();
    assert.strictEqual(p.stage, 'egg');
    assert.strictEqual(p.state, 'idle');
  });

  test('default pet is alive', () => {
    const p = new Pet();
    assert(p.isAlive);
    assert.strictEqual(p.health, PET_CONST.STAT_DEFAULT);
  });

  test('default pet has a valid personality', () => {
    const p = new Pet();
    assert(PET_CONST.PERSONALITIES.includes(p.personality));
  });

  test('isValid() returns true for a new pet', () => {
    const p = new Pet();
    assert(p.isValid());
  });

  test('constructed pet with data has correct stats', () => {
    const p = makePet({ stats: { hunger: 10, happiness: 20, energy: 30, hygiene: 40 } });
    assert.strictEqual(p.stats.hunger, 10);
    assert.strictEqual(p.stats.happiness, 20);
    assert.strictEqual(p.stats.energy, 30);
    assert.strictEqual(p.stats.hygiene, 40);
  });

  test('pet with sleeping state has isSleeping true', () => {
    const p = makePet({ state: 'sleeping' });
    assert(p.isSleeping);
  });

  test('pet with idle state has isSleeping false', () => {
    const p = makePet({ state: 'idle' });
    assert(!p.isSleeping);
  });

});

// ============================================
// Stat Clamping
// ============================================
describe('Stat Clamping', () => {

  test('stats cannot exceed STAT_MAX via constructor', () => {
    const p = makePet({ stats: { hunger: 999, happiness: 999, energy: 999, hygiene: 999 } });
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_MAX);
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_MAX);
    assert.strictEqual(p.stats.energy, PET_CONST.STAT_MAX);
    assert.strictEqual(p.stats.hygiene, PET_CONST.STAT_MAX);
  });

  test('stats cannot go below STAT_MIN via constructor', () => {
    const p = makePet({ stats: { hunger: -50, happiness: -50, energy: -50, hygiene: -50 } });
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.energy, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.hygiene, PET_CONST.STAT_MIN);
  });

  test('stats are clamped when feeding beyond max', () => {
    const p = makeFullPet();
    p.feed();
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_MAX);
  });

  test('stats are clamped when petting beyond max', () => {
    const p = makeFullPet();
    p.pet();
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_MAX);
  });

  test('stats are clamped when cleaning beyond max', () => {
    const p = makeFullPet({ stats: { hygiene: 90 } });
    p.clean();
    assert.strictEqual(p.stats.hygiene, PET_CONST.STAT_MAX);
  });

  test('decay does not go below STAT_MIN', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    p.decayStats();
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.energy, PET_CONST.STAT_MIN);
    assert.strictEqual(p.stats.hygiene, PET_CONST.STAT_MIN);
  });

  test('sleeping energy recovery is capped at STAT_MAX', () => {
    const p = makeFullPet({ state: 'sleeping' });
    p.decayStats();
    assert.strictEqual(p.stats.energy, PET_CONST.STAT_MAX);
  });

});

// ============================================
// State Machine Transitions
// ============================================
describe('State Machine Transitions', () => {

  test('idle → eating is allowed', () => {
    const p = makePet();
    p._setState('eating');
    assert.strictEqual(p.state, 'eating');
  });

  test('eating → idle is allowed', () => {
    const p = makePet({ state: 'eating' });
    p._setState('idle');
    assert.strictEqual(p.state, 'idle');
  });

  test('idle → sleeping is allowed', () => {
    const p = makePet();
    p._setState('sleeping');
    assert.strictEqual(p.state, 'sleeping');
  });

  test('sleeping → idle is allowed', () => {
    const p = makePet({ state: 'sleeping' });
    p._setState('idle');
    assert.strictEqual(p.state, 'idle');
  });

  test('dead → eating is REJECTED', () => {
    const p = makePet({ state: 'dead' });
    p._setState('eating');
    assert.strictEqual(p.state, 'dead');
  });

  test('invalid state string is REJECTED', () => {
    const p = makePet();
    p._setState('dancing');
    assert.strictEqual(p.state, 'idle');
  });

  test('eating → playing is allowed', () => {
    const p = makePet({ state: 'eating' });
    p._setState('playing');
    assert.strictEqual(p.state, 'playing');
  });

  test('sad → happy is allowed', () => {
    const p = makePet({ state: 'sad' });
    p._setState('happy');
    assert.strictEqual(p.state, 'happy');
  });

});

// ============================================
// Actions & Guard Methods
// ============================================
describe('Actions & Guard Methods', () => {

  test('feed() increases hunger by FEED_AMOUNT', () => {
    const p = makePet({ stats: { hunger: 50 } });
    p.feed();
    assert.strictEqual(p.stats.hunger, 50 + PET_CONST.FEED_AMOUNT);
  });

  test('feed() sets state to eating', () => {
    const p = makePet();
    p.feed();
    assert.strictEqual(p.state, 'eating');
  });

  test('feed() returns true on success', () => {
    const p = makePet();
    assert.strictEqual(p.feed(), true);
  });

  test('feed() returns false when at max hunger', () => {
    const p = makeFullPet();
    assert.strictEqual(p.feed(), false);
  });

  test('feed() returns false when sleeping', () => {
    const p = makePet({ state: 'sleeping' });
    assert.strictEqual(p.feed(), false);
  });

  test('canFeed() is false when at max hunger', () => {
    const p = makeFullPet();
    assert.strictEqual(p.canFeed(), false);
  });

  test('play() increases happiness and costs energy', () => {
    const p = makePet({ stats: { happiness: 50, energy: 50 } });
    p.play();
    assert.strictEqual(p.stats.happiness, 50 + PET_CONST.PLAY_HAPPY_BOOST);
    assert.strictEqual(p.stats.energy, 50 - PET_CONST.PLAY_ENERGY_COST);
  });

  test('play() costs hunger', () => {
    const p = makePet({ stats: { hunger: 50, energy: 50 } });
    p.play();
    assert.strictEqual(p.stats.hunger, 50 - PET_CONST.PLAY_HUNGER_COST);
  });

  test('play() returns false when energy too low', () => {
    const p = makePet({ stats: { energy: PET_CONST.PLAY_ENERGY_COST - 1 } });
    assert.strictEqual(p.play(), false);
  });

  test('canPlay() is false when energy too low', () => {
    const p = makePet({ stats: { energy: 5 } });
    assert.strictEqual(p.canPlay(), false);
  });

  test('clean() increases hygiene and removes poops', () => {
    const p = makePet({ stats: { hygiene: 20 }, poops: [{ x: 0.5, y: 0.5 }] });
    p.clean();
    assert.strictEqual(p.stats.hygiene, 20 + PET_CONST.CLEAN_AMOUNT);
    assert.strictEqual(p.poops.length, 0);
  });

  test('clean() cures sickness when hygiene above threshold', () => {
    const p = makePet({ stats: { hygiene: 30 }, isSick: true });
    p.clean();
    assert.strictEqual(p.isSick, false);
  });

  test('clean() returns false when sleeping', () => {
    const p = makePet({ state: 'sleeping' });
    assert.strictEqual(p.clean(), false);
  });

  test('pet() increases happiness', () => {
    const p = makePet({ stats: { happiness: 50 } });
    p.pet();
    assert.strictEqual(p.stats.happiness, 50 + PET_CONST.PET_HAPPY_BOOST);
  });

  test('pet() returns false when sleeping', () => {
    const p = makePet({ state: 'sleeping' });
    assert.strictEqual(p.pet(), false);
  });

  test('toggleSleep() toggles between sleeping and idle', () => {
    const p = makePet();
    assert.strictEqual(p.state, 'idle');
    p.toggleSleep();
    assert.strictEqual(p.state, 'sleeping');
    p.toggleSleep();
    assert.strictEqual(p.state, 'idle');
  });

  test('toggleSleep() returns false when dead', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    assert.strictEqual(p.canToggleSleep(), false);
    assert.strictEqual(p.toggleSleep(), false);
  });

});

// ============================================
// Health & Death
// ============================================
describe('Health & Death', () => {

  test('health is average of all stats', () => {
    const p = makePet({ stats: { hunger: 40, happiness: 60, energy: 80, hygiene: 20 } });
    assert.strictEqual(p.health, 50);
  });

  test('pet dies when all stats hit 0', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    p.update(1);
    assert(!p.isAlive);
    assert.strictEqual(p.stage, 'dead');
  });

  test('decayStats does nothing when dead', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    p.decayStats();
    assert.strictEqual(p.stats.hunger, 0);
  });

  test('update() forces dead state when health is 0', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 }, stage: 'child' });
    p.update(1);
    assert.strictEqual(p.state, 'dead');
    assert.strictEqual(p.stage, 'dead');
  });

  test('actions are rejected when dead', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    assert.strictEqual(p.canFeed(), false);
    assert.strictEqual(p.canPlay(), false);
    assert.strictEqual(p.canClean(), false);
    assert.strictEqual(p.canPet(), false);
  });

});

// ============================================
// Decay & Tick Logic
// ============================================
describe('Decay & Tick Logic', () => {

  test('decayStats reduces all awake stats by 1', () => {
    const p = makePet({ stats: { hunger: 50, happiness: 50, energy: 50, hygiene: 50 } });
    p.decayStats();
    assert.strictEqual(p.stats.hunger, 49);
    assert.strictEqual(p.stats.happiness, 49);
    assert.strictEqual(p.stats.energy, 49);
    assert.strictEqual(p.stats.hygiene, 49);
  });

  test('sleeping pet gains energy instead of decaying', () => {
    const p = makePet({ state: 'sleeping', stats: { hunger: 50, happiness: 50, energy: 50, hygiene: 50 } });
    p.decayStats();
    assert.strictEqual(p.stats.energy, 52);
    assert.strictEqual(p.stats.hunger, 50);
    assert.strictEqual(p.stats.happiness, 50);
    assert.strictEqual(p.stats.hygiene, 50);
  });

  test('sick pet loses hunger and happiness faster', () => {
    const p = makePet({ stats: { hunger: 50, happiness: 50, energy: 50, hygiene: 50 }, isSick: true });
    p.decayStats();
    assert.strictEqual(p.stats.hunger, 48);
    assert.strictEqual(p.stats.happiness, 48);
  });

  test('low hygiene triggers sickness', () => {
    const p = makePet({ stats: { hygiene: 25 } });
    p.decayStats();
    assert(p.isSick);
  });

  test('low energy triggers auto-sleep', () => {
    const p = makePet({ stats: { energy: 10 } });
    p.decayStats();
    assert.strictEqual(p.state, 'sleeping');
  });

  test('stateTimer counts down in update()', () => {
    const p = makePet({ state: 'eating' });
    p.stateTimer = 2;
    p.update(1);
    assert.strictEqual(p.stateTimer, 1);
    p.update(1);
    assert.strictEqual(p.stateTimer, 0);
  });

  test('stateTimer reaching 0 returns to idle', () => {
    const p = makePet({ state: 'eating' });
    p.stateTimer = 1;
    p.update(2);
    assert.strictEqual(p.state, 'idle');
  });

  test('evolutionTimer increases in update()', () => {
    const p = makePet({ stage: 'child', evolutionTimer: 0 });
    p.update(5);
    assert.strictEqual(p.evolutionTimer, 5);
  });

});

// ============================================
// Evolution
// ============================================
describe('Evolution', () => {

  test('pet evolves after enough time', () => {
    const p = makePet({ stage: 'egg', evolutionTimer: 0, stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 } });
    p.update(PET_CONST.STAGE_TIMES.egg + 1);
    assert.strictEqual(p.stage, 'baby');
  });

  test('evolved pet gets excellent variant with high stats', () => {
    const p = makePet({ stage: 'egg', stats: { hunger: 90, happiness: 90, energy: 90, hygiene: 90 } });
    p.update(PET_CONST.STAGE_TIMES.egg + 1);
    assert.strictEqual(p.variant, 'excellent');
  });

  test('evolved pet gets poor variant with low stats', () => {
    const p = makePet({ stage: 'egg', stats: { hunger: 40, happiness: 40, energy: 40, hygiene: 40 } });
    p.update(PET_CONST.STAGE_TIMES.egg + 1);
    assert.strictEqual(p.variant, 'poor');
  });

  test('evolved pet resets evolutionTimer', () => {
    const p = makePet({ stage: 'egg', evolutionTimer: 999 });
    p.update(PET_CONST.STAGE_TIMES.egg + 1);
    assert.strictEqual(p.evolutionTimer, 0);
  });

  test('adult pet does not evolve further', () => {
    const p = makePet({ stage: 'adult', evolutionTimer: 0 });
    p.update(99999);
    assert.strictEqual(p.stage, 'adult');
  });

  test('evolution records stage history', () => {
    const p = makePet({ stage: 'egg', stats: { hunger: 60, happiness: 60, energy: 60, hygiene: 60 } });
    p.update(PET_CONST.STAGE_TIMES.egg + 1);
    assert(p.stageHistory.hasOwnProperty('egg'));
  });

});

// ============================================
// Serialization & Deserialization
// ============================================
describe('Serialization', () => {

  test('serialize returns correct data structure', () => {
    const p = makePet({ name: 'SerializeMe', stage: 'child' });
    const data = p.serialize();
    assert.strictEqual(data.name, 'SerializeMe');
    assert.strictEqual(data.stage, 'child');
    assert.deepStrictEqual(data.stats, { hunger: 50, happiness: 50, energy: 50, hygiene: 50 });
    assert(Array.isArray(data.poops));
    assert(typeof data.bornAt === 'number');
  });

  test('serialize stats are a copy, not reference', () => {
    const p = makePet();
    const data = p.serialize();
    const originalHunger = p.stats.hunger;
    data.stats.hunger = 999;
    assert.strictEqual(p.stats.hunger, originalHunger);
  });

  test('deserialize restores pet correctly', () => {
    const original = makePet({ name: 'Roundtrip', stats: { hunger: 42 } });
    const data = original.serialize();
    const restored = Pet.deserialize(data);
    assert.strictEqual(restored.name, 'Roundtrip');
    assert.strictEqual(restored.stats.hunger, 42);
    assert.strictEqual(restored.stage, original.stage);
  });

  test('deserialized pet is valid', () => {
    const original = makePet();
    const restored = Pet.deserialize(original.serialize());
    assert(restored.isValid());
  });

});

// ============================================
// Input Validation (Sanitization)
// ============================================
describe('Input Validation', () => {

  test('invalid stage falls back to egg', () => {
    const p = new Pet({ stage: 'godzilla' });
    assert.strictEqual(p.stage, 'egg');
  });

  test('invalid personality falls back to quirky', () => {
    const p = new Pet({ personality: 'evil' });
    assert.strictEqual(p.personality, 'quirky');
  });

  test('missing stats fall back to defaults', () => {
    const p = new Pet({ stats: null });
    assert.strictEqual(p.stats.hunger, PET_CONST.STAT_DEFAULT);
  });

  test('string stats are coerced to numbers', () => {
    const p = new Pet({ stats: { hunger: '60', happiness: '70' } });
    assert.strictEqual(p.stats.hunger, 60);
    assert.strictEqual(p.stats.happiness, 70);
  });

  test('NaN stats fall back to 0', () => {
    const p = new Pet({ stats: { hunger: NaN, happiness: undefined } });
    assert.strictEqual(p.stats.hunger, 0);
    assert.strictEqual(p.stats.happiness, PET_CONST.STAT_DEFAULT);
  });

  test('name is truncated to 20 chars', () => {
    const longName = 'A'.repeat(50);
    const p = new Pet({ name: longName });
    assert.strictEqual(p.name.length, 20);
  });

  test('null name falls back to generated name', () => {
    const p = new Pet({ name: null });
    assert(p.name.length > 0);
  });

  test('invalid poops are filtered out', () => {
    const p = new Pet({ poops: [{ x: 0.5, y: 0.5 }, null, 'bad', { x: 'a', y: 0.5 }] });
    assert.strictEqual(p.poops.length, 1);
  });

  test('isValid() is false with impossible stats', () => {
    const p = new Pet();
    // Manually corrupt a private field
    p._stats.hunger = 200;
    assert(!p.isValid());
  });

});

// ============================================
// Display Helpers (PetPresenter)
// ============================================
describe('Display Helpers (PetPresenter)', () => {

  test('displayStage() capitalizes stage', () => {
    assert.strictEqual(PetPresenter.displayStage('child'), 'Child');
  });

  test('displayStage() handles all valid pet stages', () => {
    const stages = ['egg', 'baby', 'child', 'teen', 'adult'];
    for (const s of stages) {
      const result = PetPresenter.displayStage(s);
      assert.strictEqual(result[0], s[0].toUpperCase(), `displayStage('${s}') should capitalize first letter`);
      assert.strictEqual(result.slice(1), s.slice(1), `displayStage('${s}') should preserve rest`);
    }
  });

  test('displayHealthColor() green when health > 60', () => {
    assert.strictEqual(PetPresenter.displayHealthColor(80), '#4CAF50');
  });

  test('displayHealthColor() orange when health 30-60', () => {
    assert.strictEqual(PetPresenter.displayHealthColor(40), '#FF9800');
  });

  test('displayHealthColor() red when health <= 30', () => {
    assert.strictEqual(PetPresenter.displayHealthColor(10), '#E53935');
  });

  test('displayPersonalityEmoji() returns correct emoji', () => {
    assert.strictEqual(PetPresenter.displayPersonalityEmoji('cute'), '💕');
  });

  test('displayPersonalityEmoji() returns empty for unknown', () => {
    assert.strictEqual(PetPresenter.displayPersonalityEmoji('unknown'), '');
  });

  test('displayAge() shows minutes when under 1 hour', () => {
    assert.strictEqual(PetPresenter.displayAge(300), '5m');
  });

  test('displayAge() shows hours and minutes when over 1 hour', () => {
    assert.strictEqual(PetPresenter.displayAge(7500), '2h 5m');
  });

  test('displayMoodRingColor() reflects lowest stat: hunger', () => {
    const stats = { hunger: 10, happiness: 50, energy: 50, hygiene: 50 };
    assert.strictEqual(PetPresenter.displayMoodRingColor(stats), '#FF8C42');
  });

  test('displayMoodRingColor() reflects lowest stat: happiness', () => {
    const stats = { hunger: 50, happiness: 10, energy: 50, hygiene: 50 };
    assert.strictEqual(PetPresenter.displayMoodRingColor(stats), '#FF6B9D');
  });

  test('displayMoodRingColor() reflects lowest stat: energy', () => {
    const stats = { hunger: 50, happiness: 50, energy: 10, hygiene: 50 };
    assert.strictEqual(PetPresenter.displayMoodRingColor(stats), '#4ECDC4');
  });

  test('displayMoodRingColor() reflects lowest stat: hygiene', () => {
    const stats = { hunger: 50, happiness: 50, energy: 50, hygiene: 10 };
    assert.strictEqual(PetPresenter.displayMoodRingColor(stats), '#45B7A0');
  });

});

// ============================================
// Quotes (resolved by caller, not Pet)
// ============================================
describe('Quotes', () => {

  test('getQuote is a callable function from quotes module', () => {
    assert.strictEqual(typeof getQuote, 'function');
    const q = getQuote('quirky', 'idle');
    assert(typeof q === 'string' && q.length > 0);
  });

});

// ============================================
// Dreams
// ============================================
describe('Dreams', () => {

  test('new pet starts with normal dream state', () => {
    const p = makePet({ state: 'sleeping' });
    assert.strictEqual(p.dreamState, 'normal');
  });

  test('happy dreams when stat history average is high', () => {
    const p = makePet({ state: 'sleeping', stats: { hunger: 90, happiness: 90, energy: 90, hygiene: 90 } });
    for (let i = 0; i < PET_CONST.STAT_HISTORY_LENGTH; i++) p.update(1);
    assert.strictEqual(p.dreamState, 'happy');
  });

  test('nightmares when stat history average is low', () => {
    const p = makePet({ state: 'sleeping', stats: { hunger: 20, happiness: 20, energy: 20, hygiene: 20 } });
    for (let i = 0; i < PET_CONST.STAT_HISTORY_LENGTH; i++) p.update(1);
    assert.strictEqual(p.dreamState, 'nightmare');
  });

  test('dream state resets to normal when awake', () => {
    const p = makePet({ state: 'sleeping', stats: { hunger: 20, happiness: 20, energy: 20, hygiene: 20 } });
    for (let i = 0; i < PET_CONST.STAT_HISTORY_LENGTH; i++) p.update(1);
    assert.strictEqual(p.dreamState, 'nightmare');
    p._setState('idle');
    p.update(1);
    assert.strictEqual(p.dreamState, 'normal');
  });

  test('dream state is not happy with borderline average', () => {
    const p = makePet({ state: 'sleeping', stats: { hunger: 60, happiness: 60, energy: 60, hygiene: 60 } });
    for (let i = 0; i < PET_CONST.STAT_HISTORY_LENGTH; i++) p.update(1);
    assert.notStrictEqual(p.dreamState, 'happy');
  });

});

// ============================================
// Stat History
// ============================================
describe('Stat History', () => {

  test('statHistory accumulates on each update', () => {
    const p = makePet();
    assert.strictEqual(p.statHistory.length, 0);
    p.update(1);
    assert.strictEqual(p.statHistory.length, 1);
    p.update(1);
    assert.strictEqual(p.statHistory.length, 2);
  });

  test('statHistory is capped to STAT_HISTORY_LENGTH', () => {
    const p = makePet();
    const len = PET_CONST.STAT_HISTORY_LENGTH;
    for (let i = 0; i < len + 5; i++) p.update(1);
    assert.strictEqual(p.statHistory.length, len);
  });

});

// ============================================
// Pet Antics
// ============================================
describe('Pet Antics', () => {

  test('new pet has no current antic', () => {
    const p = makePet();
    assert.strictEqual(p.currentAntic, null);
    assert.strictEqual(p.anticTimer, 0);
  });

  test('antics do not start when sleeping', () => {
    const p = makePet({ state: 'sleeping' });
    for (let i = 0; i < 200; i++) p.update(1);
    assert.strictEqual(p.currentAntic, null);
  });

  test('antics do not start when currentGoal is set', () => {
    const p = makePet();
    p.currentGoal = { type: 'wander', targetX: 0.5, targetY: 0.5, actionStarted: false, actionTimer: 0 };
    for (let i = 0; i < 200; i++) p.update(1);
    assert.strictEqual(p.currentAntic, null);
  });

  test('antic is cleared when state changes to sad', () => {
    const p = makePet({ stats: { hunger: 50, happiness: 10, energy: 50, hygiene: 50 } });
    p.currentAntic = 'dance';
    p.anticTimer = 5;
    p._setState('sad');
    p.update(1);
    assert.strictEqual(p.currentAntic, null);
    assert.strictEqual(p.anticTimer, 0);
  });

  test('antics are cleared on death', () => {
    const p = makePet({ stats: { hunger: 0, happiness: 0, energy: 0, hygiene: 0 } });
    p.currentAntic = 'stare';
    p.anticTimer = 5;
    p.update(1);
    assert.strictEqual(p.currentAntic, null);
    assert.strictEqual(p.anticTimer, 0);
  });

  test('antic timer counts down and clears when expired', () => {
    const p = makePet();
    p.currentAntic = 'dance';
    p.anticTimer = 3;
    p.update(1);
    assert.strictEqual(p.currentAntic, 'dance');
    assert.strictEqual(p.anticTimer, 2);
    p.update(1);
    assert.strictEqual(p.currentAntic, 'dance');
    assert.strictEqual(p.anticTimer, 1);
    p.update(1);
    assert.strictEqual(p.currentAntic, null);
    assert.strictEqual(p.anticTimer, 0);
  });

  test('think does not start goals during active antic', () => {
    const p = makePet({ stats: { hunger: 50, happiness: 50, energy: 50, hygiene: 50 } });
    p.currentAntic = 'sit';
    p.anticTimer = 5;
    p.update(1);
    assert.strictEqual(p.currentAntic, 'sit');
    assert.strictEqual(p.currentGoal, null);
  });

});

// ============================================
// Serialization of New Mechanics
// ============================================
describe('Serialization of New Mechanics', () => {

  test('serialize includes statHistory', () => {
    const p = makePet();
    p.update(1);
    const data = p.serialize();
    assert(Array.isArray(data.statHistory));
    assert(data.statHistory.length >= 1);
  });

  test('serialize includes dreamState', () => {
    const p = makePet({ state: 'sleeping' });
    const data = p.serialize();
    assert.strictEqual(data.dreamState, 'normal');
  });

  test('serialize includes antic fields', () => {
    const p = makePet();
    p.currentAntic = 'dance';
    p.anticTimer = 4;
    const data = p.serialize();
    assert.strictEqual(data.currentAntic, 'dance');
    assert.strictEqual(data.anticTimer, 4);
  });

  test('deserialize restores dreamState', () => {
    const original = makePet({ state: 'sleeping' });
    original.dreamState = 'happy';
    const restored = Pet.deserialize(original.serialize());
    assert.strictEqual(restored.dreamState, 'happy');
  });

  test('deserialize restores antic state', () => {
    const original = makePet();
    original.currentAntic = 'tail_chase';
    original.anticTimer = 3.5;
    original._anticAngle = 1.2;
    const restored = Pet.deserialize(original.serialize());
    assert.strictEqual(restored.currentAntic, 'tail_chase');
    assert.strictEqual(restored.anticTimer, 3.5);
    assert.strictEqual(restored._anticAngle, 1.2);
  });

  test('deserialize defaults dreamState to normal when missing', () => {
    const data = makePet().serialize();
    delete data.dreamState;
    const restored = Pet.deserialize(data);
    assert.strictEqual(restored.dreamState, 'normal');
  });

  test('deserialize defaults currentAntic to null when invalid', () => {
    const data = makePet().serialize();
    data.currentAntic = 'flap_arms';
    const restored = Pet.deserialize(data);
    assert.strictEqual(restored.currentAntic, null);
  });

  test('deserialize defaults statHistory to empty array when missing', () => {
    const data = makePet().serialize();
    delete data.statHistory;
    const restored = Pet.deserialize(data);
    assert.deepStrictEqual(restored.statHistory, []);
  });

  test('deserialize clamps anticTimer to non-negative', () => {
    const data = makePet().serialize();
    data.anticTimer = -5;
    const restored = Pet.deserialize(data);
    assert.strictEqual(restored.anticTimer, 0);
  });

});

// ============================================
// Hobby / Skill Discovery
// ============================================
describe('Hobby / Skill Discovery', () => {

  test('default pet has all hobbies initialized at level 1 with 0 xp', () => {
    const p = new Pet();
    assert.strictEqual(typeof p.hobbies, 'object');
    assert.strictEqual(Object.keys(p.hobbies).length, PET_CONST.HOBBIES.length);
    for (const h of PET_CONST.HOBBIES) {
      assert.strictEqual(p.hobbies[h].level, 1);
      assert.strictEqual(p.hobbies[h].xp, 0);
    }
  });

  test('practiceHobby increases xp by HOBBY_XP_PER_PRACTICE', () => {
    const p = makePet();
    p._practiceHobby('painting');
    assert.strictEqual(p.hobbies.painting.xp, PET_CONST.HOBBY_XP_PER_PRACTICE);
  });

  test('practiceHobby levels up when xp reaches threshold', () => {
    const p = makePet();
    p.hobbies.painting.xp = PET_CONST.HOBBY_LEVEL_THRESHOLDS[1] - PET_CONST.HOBBY_XP_PER_PRACTICE;
    p.hobbies.painting.level = 1;
    p._practiceHobby('painting');
    assert.strictEqual(p.hobbies.painting.level, 2);
  });

  test('practiceHobby does not level up twice on single practice', () => {
    const p = makePet();
    p.hobbies.painting.xp = PET_CONST.HOBBY_LEVEL_THRESHOLDS[1] - 1;
    p.hobbies.painting.level = 1;
    p._practiceHobby('painting');
    assert.strictEqual(p.hobbies.painting.level, 2);
    // xp should be exactly at threshold, not beyond enough for another level
    assert(p.hobbies.painting.xp < PET_CONST.HOBBY_LEVEL_THRESHOLDS[2]);
  });

  test('practiceHobby caps level at HOBBY_MAX_LEVEL', () => {
    const p = makePet();
    p.hobbies.painting.level = PET_CONST.HOBBY_MAX_LEVEL;
    p.hobbies.painting.xp = PET_CONST.HOBBY_LEVEL_THRESHOLDS[PET_CONST.HOBBY_MAX_LEVEL];
    p._practiceHobby('painting');
    assert.strictEqual(p.hobbies.painting.level, PET_CONST.HOBBY_MAX_LEVEL);
  });

  test('practiceHobby logs a level-up event', () => {
    const p = makePet();
    p.hobbies.painting.xp = PET_CONST.HOBBY_LEVEL_THRESHOLDS[1] - PET_CONST.HOBBY_XP_PER_PRACTICE;
    p.hobbies.painting.level = 1;
    p._practiceHobby('painting');
    const levelUpLog = p.activityLog.find(e => e.msg.includes('painting') && e.msg.includes('Lv.2'));
    assert(levelUpLog, 'expected activity log to contain painting Lv.2 level-up message');
  });

  test('_getPersonalityHobby returns correct bias', () => {
    const p = makePet({ personality: 'quirky' });
    assert.strictEqual(p._getPersonalityHobby(), 'rock_stacking');
    const p2 = makePet({ personality: 'cute' });
    assert.strictEqual(p2._getPersonalityHobby(), 'gardening');
    const p3 = makePet({ personality: 'funny' });
    assert.strictEqual(p3._getPersonalityHobby(), 'singing');
    const p4 = makePet({ personality: 'absurd' });
    assert.strictEqual(p4._getPersonalityHobby(), 'painting');
  });

  test('hobbies are included in serialize output', () => {
    const p = makePet();
    p._practiceHobby('gardening');
    const data = p.serialize();
    assert.strictEqual(typeof data.hobbies, 'object');
    assert.strictEqual(data.hobbies.gardening.level, 1);
    assert.strictEqual(data.hobbies.gardening.xp, PET_CONST.HOBBY_XP_PER_PRACTICE);
  });

  test('hobbies are restored by deserialize', () => {
    const original = makePet();
    original._practiceHobby('singing');
    original._practiceHobby('singing');
    const restored = Pet.deserialize(original.serialize());
    assert.strictEqual(restored.hobbies.singing.level, 1);
    assert.strictEqual(restored.hobbies.singing.xp, PET_CONST.HOBBY_XP_PER_PRACTICE * 2);
  });

  test('deserialize defaults missing hobbies to level 1 xp 0', () => {
    const data = makePet().serialize();
    delete data.hobbies;
    const restored = Pet.deserialize(data);
    for (const h of PET_CONST.HOBBIES) {
      assert.strictEqual(restored.hobbies[h].level, 1);
      assert.strictEqual(restored.hobbies[h].xp, 0);
    }
  });

  test('isValid rejects hobby objects with invalid names', () => {
    const p = makePet();
    p.hobbies['invalid_hobby'] = { level: 1, xp: 0 };
    assert.strictEqual(p.isValid(), false);
  });

  test('isValid rejects hobby level above HOBBY_MAX_LEVEL', () => {
    const p = makePet();
    p.hobbies.painting.level = PET_CONST.HOBBY_MAX_LEVEL + 1;
    assert.strictEqual(p.isValid(), false);
  });

  test('isValid rejects negative hobby xp', () => {
    const p = makePet();
    p.hobbies.painting.xp = -10;
    assert.strictEqual(p.isValid(), false);
  });

  test('update may trigger hobby practice when conditions met', () => {
    const p = makePet({ stats: { hunger: 100, happiness: 100, energy: 100, hygiene: 100 } });
    // Force hobby practice by overriding chance check inside _updateHobbies
    let practiced = false;
    const originalUpdate = p._updateHobbies.bind(p);
    p._updateHobbies = () => {
      p._practiceHobby('painting');
      practiced = true;
    };
    p.update(1);
    assert(practiced, 'expected _updateHobbies to be called during update');
  });

});

// ============================================
// Hobby Quotes
// ============================================
describe('Hobby Quotes', () => {

  test('getQuote returns a string for hobby category for all personalities', () => {
    for (const p of PET_CONST.PERSONALITIES) {
      const q = getQuote(p, 'hobby');
      assert(typeof q === 'string' && q.length > 0, `expected hobby quote for ${p}, got ${q}`);
    }
  });

  test('getQuote hobby quote is personality-appropriate', () => {
    const cuteQ = getQuote('cute', 'hobby');
    const sardonicQ = getQuote('sardonic', 'hobby');
    assert(cuteQ.includes('!') || cuteQ.includes('heart') || cuteQ.includes('glitter') || cuteQ.includes('architect') || cuteQ.includes('candy') || cuteQ.includes('cloud'));
    assert(sardonicQ.includes('.') || sardonicQ.includes('beige') || sardonicQ.includes('entropy') || sardonicQ.includes('exciting'));
  });

});

// ============================================
// Quote Injection Pattern (Clean Architecture boundary)
// ============================================
describe('Quote Injection (Game → UI boundary)', () => {

  test('quoteFn callback returns quote when personality+category valid', () => {
    const quoteFn = (personality, category) => getQuote(personality, category);
    const result = quoteFn('quirky', 'feed');
    assert(typeof result === 'string' && result.length > 0);
  });

  test('quoteFn callback returns null when personality missing', () => {
    const quoteFn = (personality, category) => getQuote(personality, category);
    assert.strictEqual(quoteFn('nonexistent', 'idle'), null);
  });

  test('quoteFn callback returns null when category missing', () => {
    const quoteFn = (personality, category) => getQuote(personality, category);
    assert.strictEqual(quoteFn('quirky', 'nonexistent'), null);
  });

  test('null-safe quoteFn pattern returns null when getQuote absent', () => {
    const _getQuote = null;
    const quoteFn = (personality, category) => _getQuote ? _getQuote(personality, category) : null;
    assert.strictEqual(quoteFn('quirky', 'feed'), null);
  });

  test('null-safe _quoteFn pattern used in UI.showQuote', () => {
    const _quoteFn = (personality, category) => getQuote(personality, category);
    const check = (fn) => fn ? fn('quirky', 'feed') : null;
    assert(typeof check(_quoteFn) === 'string');
    assert.strictEqual(check(null), null);
  });

  test('captured getQuote behaves identically to direct getQuote for all personalities', () => {
    const _getQuote = getQuote;
    for (const p of PET_CONST.PERSONALITIES) {
      for (const cat of ['idle', 'feed', 'play', 'clean', 'sleep', 'pet', 'death', 'hobby']) {
        const direct = getQuote(p, cat);
        const captured = _getQuote(p, cat);
        assert(typeof direct === typeof captured, `type mismatch for ${p}/${cat}`);
        assert((direct === null) === (captured === null), `null mismatch for ${p}/${cat}`);
      }
    }
  });

  test('death quote returns string for all personalities', () => {
    for (const p of PET_CONST.PERSONALITIES) {
      const q = getQuote(p, 'death');
      assert(typeof q === 'string' && q.length > 0, `expected death quote for ${p}`);
    }
  });

});

// Run all tests
run();
