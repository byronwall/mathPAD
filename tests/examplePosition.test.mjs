import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeExampleRows } from '../.test-build/examplePosition.js';

test('places examples below the toolbar while preserving row spacing', () => {
  const rows = [{ x: 110, y: 150 }, { x: 110, y: 190 }];
  assert.deepEqual(placeExampleRows(rows, 240, 1280), [{ x: 110, y: 240 }, { x: 110, y: 280 }]);
  assert.deepEqual(placeExampleRows(rows, 320, 390), [{ x: 12, y: 320 }, { x: 12, y: 408 }]);
  assert.deepEqual(rows, [{ x: 110, y: 150 }, { x: 110, y: 190 }]);
});
