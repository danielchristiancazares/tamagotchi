// ============================================
// Canvas 2D Context Recorder
// Wraps a CanvasRenderingContext2D and records every drawing call.
// Produces a deterministic, comparable trace for visual regression testing.
// Zero dependencies — uses only Node.js built-ins.
// ============================================

/**
 * Deep clone arguments for recording. Handles nested objects, arrays,
 * and special values like undefined/null.
 */
function cloneArg(arg) {
  if (arg === undefined) return { __type: 'undefined' };
  if (arg === null) return null;
  if (typeof arg === 'number') {
    if (Number.isNaN(arg)) return { __type: 'NaN' };
    if (arg === Infinity) return { __type: 'Infinity' };
    if (arg === -Infinity) return { __type: '-Infinity' };
    // Round floats to 2 decimal places for stable comparison
    return Math.round(arg * 100) / 100;
  }
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'boolean') return arg;
  if (arg instanceof Array) return arg.map(cloneArg);
  if (typeof arg === 'object') {
    const cloned = {};
    for (const key of Object.keys(arg).sort()) {
      cloned[key] = cloneArg(arg[key]);
    }
    return cloned;
  }
  return String(arg);
}

/**
 * Wrap a Canvas 2D context to record all drawing operations.
 * The wrapped context still functions normally (draws to a real or mock canvas),
 * but also appends to a recording array.
 */
class CanvasRecorder {
  constructor(ctx) {
    this._ctx = ctx;
    this._recording = [];
    this._wrapMethods();
  }

  _wrapMethods() {
    // List of Canvas 2D methods we care about for visual regression
    const methods = [
      'fillRect', 'strokeRect', 'clearRect',
      'fillText', 'strokeText',
      'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc',
      'quadraticCurveTo', 'bezierCurveTo', 'ellipse',
      'fill', 'stroke', 'clip',
      'setTransform', 'resetTransform', 'save', 'restore',
    ];

    // Property setters we care about
    const properties = [
      'fillStyle', 'strokeStyle', 'globalAlpha',
      'font', 'textAlign', 'textBaseline',
      'lineWidth', 'lineCap', 'lineJoin',
      'imageSmoothingEnabled'
    ];

    for (const name of methods) {
      if (typeof this._ctx[name] === 'function') {
        const original = this._ctx[name].bind(this._ctx);
        this[name] = (...args) => {
          const record = { type: 'call', method: name, args: args.map(cloneArg) };
          this._recording.push(record);
          return original(...args);
        };
      }
    }

    // Create getters/setters for tracked properties
    const propertyStorage = {};
    for (const prop of properties) {
      Object.defineProperty(this, prop, {
        get: () => propertyStorage[prop] !== undefined ? propertyStorage[prop] : this._ctx[prop],
        set: (val) => {
          propertyStorage[prop] = val;
          this._recording.push({ type: 'set', property: prop, value: cloneArg(val) });
          this._ctx[prop] = val;
        }
      });
    }
  }

  /** Return the raw underlying context (for methods we didn't wrap) */
  get raw() {
    return this._ctx;
  }

  /** Get the recording as an array of operations */
  getRecording() {
    return this._recording;
  }

  /** Serialize to a stable JSON string (sorted, formatted) */
  serialize() {
    return JSON.stringify(this._recording, null, 2);
  }

  /** Compare this recording against another, return diff list */
  compare(other) {
    const diffs = [];
    const maxLen = Math.max(this._recording.length, other.length);

    for (let i = 0; i < maxLen; i++) {
      const a = this._recording[i];
      const b = other[i];

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

    return diffs;
  }
}

module.exports = { CanvasRecorder, cloneArg };
