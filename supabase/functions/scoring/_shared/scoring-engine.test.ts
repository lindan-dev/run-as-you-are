import { strict as assert } from 'node:assert';
import {
  parseClock,
  formatClock,
  computeExpectedTime,
  computeStartList,
  computePlacementPoints,
  computeAccuracyDeduction,
  computeSeasonAccuracyDeductions,
  computeSeasonTotal,
} from './scoring-engine.ts';

// Samma testfall som functions/scoring-engine.test.js (Node) — håller de två
// portarna ärligt i synk med varandra.

Deno.test('parseClock hanterar mm:ss', () => {
  assert.equal(parseClock('48:24'), 48 * 60 + 24);
});
Deno.test('parseClock hanterar h:mm:ss', () => {
  assert.equal(parseClock('1:03:04'), 3600 + 3 * 60 + 4);
});
Deno.test('formatClock rundtrippar mm:ss', () => {
  assert.equal(formatClock(parseClock('48:24')), '48:24');
});

Deno.test('utan kompisgissningar blir förväntad tid = självskattning', () => {
  const t = computeExpectedTime(parseClock('55:00'), []);
  assert.equal(t, parseClock('55:00'));
});
Deno.test('median gör att en skämtgissning inte drar iväg basen', () => {
  const t = computeExpectedTime(parseClock('50:00'), [
    parseClock('48:00'),
    parseClock('52:00'),
    parseClock('2:00:00'),
  ]);
  assert.equal(t, (parseClock('50:00') + parseClock('52:00')) / 2);
});

Deno.test('långsammast förra året startar först, med offset 0', () => {
  const list = computeStartList([
    { runnerId: 'a', basisTimeSec: parseClock('55:00'), basisSource: 'previousResult' },
    { runnerId: 'b', basisTimeSec: parseClock('48:00'), basisSource: 'previousResult' },
    { runnerId: 'c', basisTimeSec: parseClock('50:00'), basisSource: 'previousResult' },
  ]);
  assert.deepEqual(list.map((e) => e.runnerId), ['a', 'c', 'b']);
  assert.equal(list[0].startOffsetSec, 0);
});

Deno.test('NI/DNR ger sista plats + 2, DNC ger sista plats + 4', () => {
  const points = computePlacementPoints([
    { runnerId: 'a', placering: 1 },
    { runnerId: 'b', placering: 2 },
    { runnerId: 'c', placering: 3 },
    { runnerId: 'd', status: 'NI' },
    { runnerId: 'e', status: 'DNR' },
    { runnerId: 'f', status: 'DNC' },
  ]);
  assert.equal(points.a, 1);
  assert.equal(points.d, 5);
  assert.equal(points.e, 5);
  assert.equal(points.f, 7);
});

Deno.test('gissning inom 1 minut ger 2p avdrag, inom 5 ger 1p, mer ger 0', () => {
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('50:45')), 2);
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('54:30')), 1);
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('58:00')), 0);
});

Deno.test('helhetsexempel: samma facit som Node-versionen', () => {
  const actual = { daniel: parseClock('44:57'), ny_lopare: parseClock('58:20') };
  const predictions = [
    { guesserId: 'daniel', targetRunnerId: 'daniel', guessSec: parseClock('45:30') },
    { guesserId: 'andreas', targetRunnerId: 'daniel', guessSec: parseClock('49:00') },
    { guesserId: 'ny_lopare', targetRunnerId: 'ny_lopare', guessSec: parseClock('50:00') },
  ];
  const deductions = computeSeasonAccuracyDeductions(predictions, actual);
  assert.equal(deductions.daniel, 2);
  assert.equal(deductions.andreas, 1);
  assert.equal(deductions.ny_lopare, 0);

  const placement = computePlacementPoints([
    { runnerId: 'daniel', placering: 1 },
    { runnerId: 'ny_lopare', placering: 2 },
    { runnerId: 'andreas', status: 'DNC' },
  ]);

  const total = computeSeasonTotal(placement, deductions);
  assert.equal(total.daniel, -1);
  assert.equal(total.ny_lopare, 2);
  assert.equal(total.andreas, 5);
});
