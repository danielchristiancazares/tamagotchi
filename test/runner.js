// ============================================
// Minimal Test Runner (no external dependencies)
// Uses Node.js built-in assert module.
// ============================================

const assert = require('assert');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  console.log(`Running ${tests.length} tests...\n`);

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${name}`);
      console.log(`    ${err.message}`);
      if (err.stack && !err.message.includes(err.stack.split('\n')[0])) {
        const line = err.stack.split('\n').find(l => l.includes('at '));
        if (line) console.log(`    ${line.trim()}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

function describe(label, fn) {
  console.log(`\n${label}`);
  fn();
}

module.exports = { test, run, describe, assert };
