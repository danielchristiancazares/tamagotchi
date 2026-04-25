// ============================================
// Mock Canvas + Mock CanvasRenderingContext2D
// Minimal implementation for headless Node.js testing.
// Provides enough API surface for Animator to run without errors.
// ============================================

class MockCanvasRenderingContext2D {
  constructor(width, height) {
    this.canvas = { width, height };
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.globalAlpha = 1.0;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.imageSmoothingEnabled = true;
    this._pathStarted = false;
  }

  fillRect(x, y, w, h) {}
  strokeRect(x, y, w, h) {}
  clearRect(x, y, w, h) {}
  fillText(text, x, y, maxWidth) {}
  strokeText(text, x, y, maxWidth) {}
  beginPath() { this._pathStarted = true; }
  closePath() {}
  moveTo(x, y) {}
  lineTo(x, y) {}
  arc(x, y, radius, startAngle, endAngle, anticlockwise) {}
  quadraticCurveTo(cpx, cpy, x, y) {}
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {}
  ellipse(x, y, rx, ry, rotation, startAngle, endAngle, anticlockwise) {}
  fill(fillRule) {}
  stroke() {}
  clip(fillRule) {}
  setTransform(a, b, c, d, e, f) {}
  resetTransform() {}
  save() {}
  restore() {}
}

class MockCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._ctx = new MockCanvasRenderingContext2D(width, height);
  }

  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
}

module.exports = { MockCanvas, MockCanvasRenderingContext2D };
