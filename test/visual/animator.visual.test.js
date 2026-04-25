// ============================================
// Visual Regression Tests for Animator
// Tests that pet rendering produces the exact same draw operations
// across different states, stages, and variants.
//
// Run:  node test/visual/animator.visual.test.js
// Update baselines:  UPDATE_BASELINES=1 node test/visual/animator.visual.test.js
// ============================================

const fs = require('fs');
const path = require('path');
const { test, run, describe, assert } = require('../runner');
const { Pet } = require('../../renderer/pet');
const { Animator } = require('../../renderer/animator');
const { CanvasRecorder } = require('./recorder');
const { MockCanvas } = require('./mock-canvas');

const BASELINE_DIR = path.join(__dirname, 'baselines');
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === '1';

/**
 * Helper: create an Animator wired to a recording mock canvas.
 * The mock canvas has no real pixels, but the recording captures
 * every drawing operation for comparison.
 */
function makeRecordingAnimator(width = 320, height = 240) {
  const mockCanvas = new MockCanvas(width, height);
  const rawCtx = mockCanvas.getContext('2d');
  const recorder = new CanvasRecorder(rawCtx);

  // Animator expects a real canvas element with getContext('2d')
  // We'll create a fake DOM element that delegates to our mock
  const fakeCanvas = {
    width,
    height,
    getContext: (type) => type === '2d' ? recorder : null
  };

  // Manually wire the Animator to use our fake canvas
  // (normally it does document.getElementById, but we bypass that)
  const animator = new Animator('dummy');
  animator.canvas = fakeCanvas;
  animator.ctx = recorder;

  return { animator, recorder };
}

/**
 * Create a pet in a specific visual configuration for testing.
 */
function makeVisualPet(config) {
  return new Pet({
    name: 'VisualPet',
    stage: config.stage || 'child',
    variant: config.variant || 'normal',
    state: config.state || 'idle',
    personality: config.personality || 'quirky',
    stats: {
      hunger: config.hunger ?? 60,
      happiness: config.happiness ?? 60,
      energy: config.energy ?? 60,
      hygiene: config.hygiene ?? 60
    },
    isSick: config.isSick || false,
    bornAt: Date.now() - 60000
  });
}

/**
 * Render a pet and return the recording.
 * Handles time-dependent rendering by pinning Date.now().
 */
function renderScene(config) {
  const { animator, recorder } = makeRecordingAnimator();
  const pet = makeVisualPet(config);

  // Pin time for deterministic rendering (noon, Jan 1 2024)
  const frozenTime = new Date('2024-01-01T12:00:00Z').getTime();
  const originalNow = Date.now;
  const originalDate = Date;
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) return new originalDate(frozenTime);
      super(...args);
    }
  };
  global.Date.now = () => frozenTime;

  // Pre-set cached values that Animator would normally compute in update()
  animator._cachedHour = 12;
  animator._cachedNow = frozenTime;

  try {
    animator.draw(pet);
  } finally {
    global.Date = originalDate;
    global.Date.now = originalNow;
  }

  return { recording: recorder.getRecording(), pet };
}

/**
 * Compare a recording against its baseline file.
 * Returns { passed: boolean, diffs: array, baselinePath: string }.
 */
function checkBaseline(testName, recording) {
  const baselinePath = path.join(BASELINE_DIR, `${testName}.json`);
  const actualJSON = JSON.stringify(recording, null, 2);

  // Generate/update baseline
  if (UPDATE_BASELINES) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.writeFileSync(baselinePath, actualJSON, 'utf-8');
    console.log(`  [baseline updated] ${baselinePath}`);
    return { passed: true, diffs: [], baselinePath };
  }

  // No baseline exists yet
  if (!fs.existsSync(baselinePath)) {
    return {
      passed: false,
      diffs: [{ msg: `No baseline found at ${baselinePath}. Run with UPDATE_BASELINES=1 to create.` }],
      baselinePath
    };
  }

  // Load and compare
  const baselineJSON = fs.readFileSync(baselinePath, 'utf-8');
  const baseline = JSON.parse(baselineJSON);

  // Direct array comparison
  const diffs = [];
  const maxLen = Math.max(recording.length, baseline.length);

  for (let i = 0; i < maxLen; i++) {
    const a = recording[i];
    const b = baseline[i];

    if (!a) { diffs.push({ index: i, expected: null, actual: b, msg: 'extra operation' }); continue; }
    if (!b) { diffs.push({ index: i, expected: a, actual: null, msg: 'missing operation' }); continue; }

    if (a.type !== b.type || a.method !== b.method || a.property !== b.property) {
      diffs.push({ index: i, expected: a, actual: b, msg: 'different operation type' });
      continue;
    }

    const aArgs = JSON.stringify(a.args || a.value);
    const bArgs = JSON.stringify(b.args || b.value);
    if (aArgs !== bArgs) {
      diffs.push({ index: i, expected: a, actual: b, msg: 'different arguments' });
    }
  }

  return { passed: diffs.length === 0, diffs, baselinePath };
}

// ============================================
// Visual Test Cases
// ============================================

describe('Animator Visual Regression', () => {

  test('egg idle renders correctly', () => {
    const { recording } = renderScene({ stage: 'egg', state: 'idle' });
    const result = checkBaseline('egg_idle', recording);
    if (!result.passed) {
      const details = result.diffs.slice(0, 3).map(d => `  op[${d.index}]: ${d.msg}`).join('\n');
      assert.fail(`Visual mismatch in egg_idle (${result.diffs.length} diffs)\n${details}`);
    }
  });

  test('baby happy renders correctly', () => {
    const { recording } = renderScene({ stage: 'baby', state: 'happy' });
    const result = checkBaseline('baby_happy', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in baby_happy (${result.diffs.length} diffs)`);
    }
  });

  test('child eating renders correctly', () => {
    const { recording } = renderScene({ stage: 'child', state: 'eating' });
    const result = checkBaseline('child_eating', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in child_eating (${result.diffs.length} diffs)`);
    }
  });

  test('child sad renders correctly', () => {
    const { recording } = renderScene({ stage: 'child', state: 'sad' });
    const result = checkBaseline('child_sad', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in child_sad (${result.diffs.length} diffs)`);
    }
  });

  test('teen playing renders correctly', () => {
    const { recording } = renderScene({ stage: 'teen', state: 'playing' });
    const result = checkBaseline('teen_playing', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in teen_playing (${result.diffs.length} diffs)`);
    }
  });

  test('adult excellent renders correctly', () => {
    const { recording } = renderScene({ stage: 'adult', variant: 'excellent', state: 'idle' });
    const result = checkBaseline('adult_excellent', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in adult_excellent (${result.diffs.length} diffs)`);
    }
  });

  test('adult poor renders correctly', () => {
    const { recording } = renderScene({ stage: 'adult', variant: 'poor', state: 'idle' });
    const result = checkBaseline('adult_poor', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in adult_poor (${result.diffs.length} diffs)`);
    }
  });

  test('sleeping renders correctly', () => {
    const { recording } = renderScene({ stage: 'child', state: 'sleeping' });
    const result = checkBaseline('child_sleeping', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in child_sleeping (${result.diffs.length} diffs)`);
    }
  });

  test('sick renders correctly', () => {
    const { recording } = renderScene({ stage: 'child', state: 'idle', isSick: true });
    const result = checkBaseline('child_sick', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in child_sick (${result.diffs.length} diffs)`);
    }
  });

  test('dead renders correctly', () => {
    const { recording } = renderScene({ stage: 'dead', state: 'dead' });
    const result = checkBaseline('dead', recording);
    if (!result.passed) {
      assert.fail(`Visual mismatch in dead (${result.diffs.length} diffs)`);
    }
  });

});

// Run
run();
