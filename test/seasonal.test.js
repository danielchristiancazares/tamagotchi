// ============================================
// TDD Tests for Seasonal Arc Feature
// Run with: node test/seasonal.test.js
// ============================================

const { test, run, describe, assert } = require('./runner');
const { Animator, SEASON_CONFIG } = require('../renderer/animator');
const { Pet } = require('../renderer/pet');
const { CanvasRecorder } = require('./visual/recorder');
const { MockCanvas } = require('./visual/mock-canvas');

function makeRecordingAnimator(width = 320, height = 240) {
  const mockCanvas = new MockCanvas(width, height);
  const rawCtx = mockCanvas.getContext('2d');
  const recorder = new CanvasRecorder(rawCtx);

  const fakeCanvas = {
    width,
    height,
    getContext: (type) => type === '2d' ? recorder : null
  };

  const animator = new Animator('dummy', { canvas: fakeCanvas });
  animator.ctx = recorder;

  return { animator, recorder };
}

function makePet(overrides = {}) {
  return new Pet({
    name: 'TestPet',
    stage: 'child',
    state: 'idle',
    stats: { hunger: 60, happiness: 60, energy: 60, hygiene: 60 },
    bornAt: Date.now() - 60000,
    ...overrides
  });
}

function freezeDate(isoString) {
  const frozenTime = new Date(isoString).getTime();
  const originalDate = Date;
  const originalNow = Date.now;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) return new originalDate(frozenTime);
      super(...args);
    }
  };
  global.Date.now = () => frozenTime;
  return () => {
    global.Date = originalDate;
    global.Date.now = originalNow;
  };
}

function findFillStyleOps(recording, color) {
  return recording.filter(op => op.type === 'set' && op.property === 'fillStyle' && op.value === color);
}

function findFillRectOps(recording, color) {
  const results = [];
  for (let i = 0; i < recording.length; i++) {
    const op = recording[i];
    if (op.type === 'set' && op.property === 'fillStyle' && op.value === color) {
      if (i + 1 < recording.length && recording[i + 1].type === 'call' && recording[i + 1].method === 'fillRect') {
        results.push({ style: op, rect: recording[i + 1] });
      }
    }
  }
  return results;
}

// ============================================
// Season Detection
// ============================================
describe('Season Detection', () => {

  test('March (month 2) is spring', () => {
    assert.strictEqual(Animator._getSeason(2), 'spring');
  });

  test('April (month 3) is spring', () => {
    assert.strictEqual(Animator._getSeason(3), 'spring');
  });

  test('May (month 4) is spring', () => {
    assert.strictEqual(Animator._getSeason(4), 'spring');
  });

  test('June (month 5) is summer', () => {
    assert.strictEqual(Animator._getSeason(5), 'summer');
  });

  test('July (month 6) is summer', () => {
    assert.strictEqual(Animator._getSeason(6), 'summer');
  });

  test('August (month 7) is summer', () => {
    assert.strictEqual(Animator._getSeason(7), 'summer');
  });

  test('September (month 8) is fall', () => {
    assert.strictEqual(Animator._getSeason(8), 'fall');
  });

  test('October (month 9) is fall', () => {
    assert.strictEqual(Animator._getSeason(9), 'fall');
  });

  test('November (month 10) is fall', () => {
    assert.strictEqual(Animator._getSeason(10), 'fall');
  });

  test('December (month 11) is winter', () => {
    assert.strictEqual(Animator._getSeason(11), 'winter');
  });

  test('January (month 0) is winter', () => {
    assert.strictEqual(Animator._getSeason(0), 'winter');
  });

  test('February (month 1) is winter', () => {
    assert.strictEqual(Animator._getSeason(1), 'winter');
  });

});

// ============================================
// Seasonal Background Colors
// ============================================
describe('Seasonal Background Colors', () => {

  test('spring daytime background uses spring color', () => {
    const { animator, recorder } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedHour = 12;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 3;
    animator._cachedSeason = 'spring';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasSpringDay = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.spring.day).length > 0;
    assert(hasSpringDay, 'Expected spring day background color');
  });

  test('summer daytime background uses summer color', () => {
    const { animator, recorder } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedHour = 12;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 6;
    animator._cachedSeason = 'summer';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasSummerDay = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.summer.day).length > 0;
    assert(hasSummerDay, 'Expected summer day background color');
  });

  test('fall daytime background uses fall color', () => {
    const { animator, recorder } = makeRecordingAnimator();

    animator._cachedHour = 12;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 9;
    animator._cachedSeason = 'fall';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasFallDay = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.fall.day).length > 0;
    assert(hasFallDay, 'Expected fall day background color');
  });

  test('winter daytime background uses winter color', () => {
    const { animator, recorder } = makeRecordingAnimator();

    animator._cachedHour = 12;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 0;
    animator._cachedSeason = 'winter';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasWinterDay = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.winter.day).length > 0;
    assert(hasWinterDay, 'Expected winter day background color');
  });

  test('winter nighttime background uses winter night color', () => {
    const { animator, recorder } = makeRecordingAnimator();

    animator._cachedHour = 22;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 0;
    animator._cachedSeason = 'winter';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasWinterNight = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.winter.night).length > 0;
    assert(hasWinterNight, 'Expected winter night background color');
  });

  test('spring nighttime background uses spring night color', () => {
    const { animator, recorder } = makeRecordingAnimator();

    animator._cachedHour = 22;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 3;
    animator._cachedSeason = 'spring';

    animator._drawBackground(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasSpringNight = findFillRectOps(recording, SEASON_CONFIG.BG_COLORS.spring.night).length > 0;
    assert(hasSpringNight, 'Expected spring night background color');
  });

});

// ============================================
// Seasonal Particles
// ============================================
describe('Seasonal Particles', () => {

  test('_getSeasonalParticleMax returns correct values per season', () => {
    assert.strictEqual(Animator._getSeasonalParticleMax('spring'), 5);
    assert.strictEqual(Animator._getSeasonalParticleMax('summer'), 8);
    assert.strictEqual(Animator._getSeasonalParticleMax('fall'), 6);
    assert.strictEqual(Animator._getSeasonalParticleMax('winter'), 15);
  });

  test('_getSeasonalParticleMax returns 0 for null season', () => {
    assert.strictEqual(Animator._getSeasonalParticleMax(null), 0);
  });

  test('companion mode seasonal particle max is capped at 3', () => {
    const { animator } = makeRecordingAnimator();
    animator.companionMode = true;
    assert.strictEqual(Animator._getSeasonalParticleMax('winter', true), 3);
    assert.strictEqual(Animator._getSeasonalParticleMax('spring', true), 3);
  });

  test('update spawns seasonal particles over time', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedSeason = 'winter';
    animator._seasonalSpawnAccum = 0;

    const initialCount = animator.particles.length;

    for (let i = 0; i < 120; i++) {
      animator.update(pet);
    }

    const seasonalCount = animator.particles.filter(p => p.type === 'snow').length;
    assert(seasonalCount > 0, 'Expected snow particles to spawn in winter');
  });

  test('seasonal particles respect max cap', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedSeason = 'winter';
    animator._seasonalSpawnAccum = 0;

    for (let i = 0; i < 600; i++) {
      animator.update(pet);
    }

    const snowCount = animator.particles.filter(p => p.type === 'snow').length;
    assert(snowCount <= 15, `Expected at most 15 snow particles, got ${snowCount}`);
  });

  test('seasonal particles respect companion cap', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();

    animator.companionMode = true;
    animator._cachedSeason = 'winter';
    animator._seasonalSpawnAccum = 0;

    for (let i = 0; i < 600; i++) {
      animator.update(pet);
    }

    const snowCount = animator.particles.filter(p => p.type === 'snow').length;
    assert(snowCount <= 3, `Expected at most 3 snow particles in companion mode, got ${snowCount}`);
  });

  test('no seasonal particles spawn when season is null', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedSeason = null;
    animator._seasonalSpawnAccum = 0;

    for (let i = 0; i < 120; i++) {
      animator.update(pet);
    }

    const seasonalTypes = ['petal', 'golden', 'leaf', 'snow'];
    const seasonalCount = animator.particles.filter(p => seasonalTypes.includes(p.type)).length;
    assert.strictEqual(seasonalCount, 0);
  });

});

// ============================================
// Seasonal Particle Rendering
// ============================================
describe('Seasonal Particle Rendering', () => {

  test('snow particle has downward drift velocity', () => {
    const { animator } = makeRecordingAnimator();
    animator.addParticle(100, 0, 'snow');
    const p = animator.particles[animator.particles.length - 1];
    assert(p.vy > 0, 'Snow should drift downward');
    assert(Math.abs(p.vx) < 1, 'Snow should have slight horizontal drift');
  });

  test('petal particle has downward drift and sway', () => {
    const { animator } = makeRecordingAnimator();
    animator.addParticle(100, 0, 'petal');
    const p = animator.particles[animator.particles.length - 1];
    assert(p.vy > 0, 'Petal should drift downward');
    assert(p.sway !== undefined, 'Petal should have sway property');
  });

  test('leaf particle has downward drift and sway', () => {
    const { animator } = makeRecordingAnimator();
    animator.addParticle(100, 0, 'leaf');
    const p = animator.particles[animator.particles.length - 1];
    assert(p.vy > 0, 'Leaf should drift downward');
    assert(p.sway !== undefined, 'Leaf should have sway property');
  });

  test('golden particle has upward or slow drift', () => {
    const { animator } = makeRecordingAnimator();
    animator.addParticle(100, 100, 'golden');
    const p = animator.particles[animator.particles.length - 1];
    assert(p.vy <= 0.5, 'Golden particle should be near-stationary or slow');
  });

});

// ============================================
// Holiday Detection
// ============================================
describe('Holiday Detection', () => {

  test('Dec 25 is christmas', () => {
    assert.strictEqual(Animator._getHoliday(11, 25), 'christmas');
  });

  test('Dec 20 is christmas (eve period)', () => {
    assert.strictEqual(Animator._getHoliday(11, 20), 'christmas');
  });

  test('Dec 26 is not christmas', () => {
    assert.strictEqual(Animator._getHoliday(11, 26), null);
  });

  test('Oct 31 is halloween', () => {
    assert.strictEqual(Animator._getHoliday(9, 31), 'halloween');
  });

  test('Oct 30 is not halloween', () => {
    assert.strictEqual(Animator._getHoliday(9, 30), null);
  });

  test('Feb 14 is valentine', () => {
    assert.strictEqual(Animator._getHoliday(1, 14), 'valentine');
  });

  test('Feb 13 is not valentine', () => {
    assert.strictEqual(Animator._getHoliday(1, 13), null);
  });

  test('Jul 4 is independence', () => {
    assert.strictEqual(Animator._getHoliday(6, 4), 'independence');
  });

  test('Jul 3 is not independence', () => {
    assert.strictEqual(Animator._getHoliday(6, 3), null);
  });

  test('random date is null', () => {
    assert.strictEqual(Animator._getHoliday(3, 15), null);
  });

});

// ============================================
// Draw Caches Month & Season
// ============================================
describe('Draw Caches Season', () => {

  test('draw() caches _cachedMonth from Date', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();
    const restore = freezeDate('2024-04-15T12:00:00Z');

    try {
      animator.draw(pet);
      assert.strictEqual(animator._cachedMonth, 3);
      assert.strictEqual(animator._cachedSeason, 'spring');
    } finally {
      restore();
    }
  });

  test('draw() caches winter season in January', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();
    const restore = freezeDate('2024-01-15T12:00:00Z');

    try {
      animator.draw(pet);
      assert.strictEqual(animator._cachedSeason, 'winter');
    } finally {
      restore();
    }
  });

  test('draw() caches summer season in July', () => {
    const { animator } = makeRecordingAnimator();
    const pet = makePet();
    const restore = freezeDate('2024-07-15T12:00:00Z');

    try {
      animator.draw(pet);
      assert.strictEqual(animator._cachedSeason, 'summer');
    } finally {
      restore();
    }
  });

});

// ============================================
// Seasonal Sky Details
// ============================================
describe('Seasonal Sky Details', () => {

  test('winter night still draws stars', () => {
    const { animator, recorder } = makeRecordingAnimator();
    const pet = makePet();

    animator._cachedHour = 22;
    animator._cachedNow = Date.now();
    animator._cachedMonth = 0;
    animator._cachedSeason = 'winter';

    animator._drawBackground(recorder, animator.canvas);
    animator._drawSkyDetails(recorder, animator.canvas);
    const recording = recorder.getRecording();

    const hasStars = recording.some(op =>
      op.type === 'set' && op.property === 'fillStyle' && op.value === '#FFFFFF'
    );
    assert(hasStars, 'Winter night should still draw stars');
  });

});

// ============================================
// SEASON_CONFIG Export
// ============================================
describe('SEASON_CONFIG', () => {

  test('SEASON_CONFIG has BG_COLORS for all seasons', () => {
    assert(SEASON_CONFIG.BG_COLORS.spring);
    assert(SEASON_CONFIG.BG_COLORS.summer);
    assert(SEASON_CONFIG.BG_COLORS.fall);
    assert(SEASON_CONFIG.BG_COLORS.winter);
  });

  test('each season has day and night colors', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter']) {
      assert(typeof SEASON_CONFIG.BG_COLORS[season].day === 'string');
      assert(typeof SEASON_CONFIG.BG_COLORS[season].night === 'string');
    }
  });

  test('SEASON_CONFIG has PARTICLE settings for all seasons', () => {
    assert(SEASON_CONFIG.PARTICLES.spring);
    assert(SEASON_CONFIG.PARTICLES.summer);
    assert(SEASON_CONFIG.PARTICLES.fall);
    assert(SEASON_CONFIG.PARTICLES.winter);
  });

  test('each season particle config has type, rate, and max', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter']) {
      const p = SEASON_CONFIG.PARTICLES[season];
      assert(typeof p.type === 'string');
      assert(typeof p.rate === 'number');
      assert(typeof p.max === 'number');
    }
  });

});

run();
