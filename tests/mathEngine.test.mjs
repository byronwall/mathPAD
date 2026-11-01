import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorksheet } from '../.test-build/mathEngine.js';

const row = (assign, expr, outUnits = '') => ({ id: '', assign, expr, outUnits });

test('stress example converts square centimeters to MPa', () => {
  const results = evaluateWorksheet([
    row('F', '12000N'), row('A', '45cm^2'), row('', 'F/A', 'MPa')
  ]);
  assert.deepEqual(results.map(r => r.ok), [true, true, true]);
  assert.equal(results[2].valueText, '2.666667');
});

test('failed assignments cannot fall back to a unit or an older value', () => {
  const results = evaluateWorksheet([
    row('A', '5m^2'), row('A', '45bad^2'), row('', '12000N/A', 'MPa')
  ]);
  assert.equal(results[1].ok, false);
  assert.match(results[2].error, /Assignment "A" is invalid/);
  const cleared = evaluateWorksheet([
    row('A', '5m^2'), row('A', ''), row('', '12000N/A', 'MPa')
  ]);
  assert.match(cleared[2].error, /Assignment "A" is invalid/);
});

test('output conversions check dimensions and ignore worksheet variable names', () => {
  const results = evaluateWorksheet([
    row('A', '5m^2'), row('', '2m', 's'), row('', '2A', 'A')
  ]);
  assert.match(results[1].error, /Output units must match/);
  assert.match(results[2].error, /Output units must match/);
  const current = evaluateWorksheet([row('A', '5m^2'), row('', '2C/s', 'A')]);
  assert.equal(current[1].valueText, '2');
});
