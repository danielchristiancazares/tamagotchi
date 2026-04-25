// ============================================
// TDD Tests for Pet Class
// Run with: node test/pet.test.js
// ============================================

const { test, run, describe, assert } = require('./runner');
const { Pet, PET_CONST } = require('../renderer/pet');

// -- Helper: create a pet with known stats --
function makePet(overrides = {}, quoteFn = null) {
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
  }, quoteFn);
}

// -- Helper: create a pet at full stats --
function makeFullPet(overrides = {}, quoteFn = null) {
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
  }, quoteFn);
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
// Display Helpers
// ============================================
describe('Display Helpers', () => {

  test('displayStage() capitalizes stage', () => {
    const p = makePet({ stage: 'child' });
    assert.strictEqual(p.displayStage(), 'Child');
  });

  test('displayHealthColor() green when health > 60', () => {
    const p = makePet({ stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 } });
    assert.strictEqual(p.displayHealthColor(), '#4CAF50');
  });

  test('displayHealthColor() orange when health 30-60', () => {
    const p = makePet({ stats: { hunger: 40, happiness: 40, energy: 40, hygiene: 40 } });
    assert.strictEqual(p.displayHealthColor(), '#FF9800');
  });

  test('displayHealthColor() red when health <= 30', () => {
    const p = makePet({ stats: { hunger: 10, happiness: 10, energy: 10, hygiene: 10 } });
    assert.strictEqual(p.displayHealthColor(), '#E53935');
  });

  test('displayPersonalityEmoji() returns correct emoji', () => {
    const p = makePet({ personality: 'cute' });
    assert.strictEqual(p.displayPersonalityEmoji(), '💕');
  });

  test('ageText shows minutes when under 1 hour', () => {
    const p = new Pet({ bornAt: Date.now() - 5 * 60 * 1000 });
    assert(p.ageText.includes('m'));
    assert(!p.ageText.includes('h'));
  });

  test('ageText shows hours when over 1 hour', () => {
    const p = new Pet({ bornAt: Date.now() - 2 * 3600 * 1000 });
    assert(p.ageText.includes('h'));
  });

});

// ============================================
// Quotes (with explicit dependency)
// ============================================
describe('Quotes', () => {

  test('getQuote with mock function returns expected quote', () => {
    const mockQuotes = { cute: { idle: ['hello!'] } };
    const mockFn = (personality, category) => mockQuotes[personality]?.[category]?.[0] || null;
    const p = makePet({ personality: 'cute' }, mockFn);
    assert.strictEqual(p.getQuote('idle'), 'hello!');
  });

  test('getQuote with no function returns null', () => {
    const p = makePet();
    assert.strictEqual(p.getQuote('idle'), null);
  });

});

// Run all tests
run();
