'use strict';

const assert = require('node:assert/strict');
const {
  parseClock,
  formatClock,
  computeExpectedTime,
  computeStartList,
  computePlacementPoints,
  computeAccuracyDeduction,
  computeSeasonAccuracyDeductions,
  computeSeasonTotal,
} = require('./scoring-engine');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('parseClock / formatClock');
test('parseClock hanterar mm:ss', () => {
  assert.equal(parseClock('48:24'), 48 * 60 + 24);
});
test('parseClock hanterar h:mm:ss', () => {
  assert.equal(parseClock('1:03:04'), 3600 + 3 * 60 + 4);
});
test('formatClock rundtrippar mm:ss', () => {
  assert.equal(formatClock(parseClock('48:24')), '48:24');
});
test('formatClock rundtrippar h:mm:ss', () => {
  assert.equal(formatClock(parseClock('1:03:04')), '1:03:04');
});

console.log('\ncomputeExpectedTime (gissningsspelet)');
test('utan kompisgissningar blir förväntad tid = självskattning', () => {
  const t = computeExpectedTime(parseClock('55:00'), []);
  assert.equal(t, parseClock('55:00'));
});
test('median gör att en skämtgissning inte drar iväg basen', () => {
  // Ny deltagare skattar 50:00 själv. Tre polare gissar 48:00, 52:00 och,
  // som skämt, 2:00:00. Medelvärde hade blivit orimligt — median ska inte.
  const t = computeExpectedTime(parseClock('50:00'), [
    parseClock('48:00'),
    parseClock('52:00'),
    parseClock('2:00:00'),
  ]);
  // sorterat: 48:00, 50:00, 52:00, 2:00:00 -> median av 4 värden = medel(50:00,52:00)
  assert.equal(t, (parseClock('50:00') + parseClock('52:00')) / 2);
});

console.log('\ncomputeStartList (omvänd jaktstart)');
test('långsammast förra året startar först, med offset 0', () => {
  const list = computeStartList([
    { runnerId: 'a', basisTimeSec: parseClock('55:00'), basisSource: 'previousResult' },
    { runnerId: 'b', basisTimeSec: parseClock('48:00'), basisSource: 'previousResult' },
    { runnerId: 'c', basisTimeSec: parseClock('50:00'), basisSource: 'previousResult' },
  ]);
  assert.deepEqual(list.map((e) => e.runnerId), ['a', 'c', 'b']);
  assert.equal(list[0].startOffsetSec, 0);
});
test('gapet mellan två löpare matchar exakt förra årets måltidsgap', () => {
  const list = computeStartList([
    { runnerId: 'slow', basisTimeSec: parseClock('60:00'), basisSource: 'previousResult' },
    { runnerId: 'fast', basisTimeSec: parseClock('45:00'), basisSource: 'previousResult' },
  ]);
  const slow = list.find((e) => e.runnerId === 'slow');
  const fast = list.find((e) => e.runnerId === 'fast');
  assert.equal(fast.startOffsetSec - slow.startOffsetSec, parseClock('15:00'));
});
test('ny deltagare utan förra året får starta på sin förväntade sluttid', () => {
  const expected = computeExpectedTime(parseClock('58:00'), [parseClock('56:00')]);
  const list = computeStartList([
    { runnerId: 'veteran', basisTimeSec: parseClock('50:00'), basisSource: 'previousResult' },
    { runnerId: 'ny', basisTimeSec: expected, basisSource: 'expectedTime' },
  ]);
  assert.equal(list.find((e) => e.runnerId === 'ny').basisSource, 'expectedTime');
  // nykomlingen (förväntad ~57:00) ska starta långt före veteranen (50:00)
  assert.ok(
    list.findIndex((e) => e.runnerId === 'ny') < list.findIndex((e) => e.runnerId === 'veteran')
  );
});

console.log('\ncomputePlacementPoints (NI / DNR / DNC)');
test('NI/DNR ger sista plats + 2, DNC ger sista plats + 4', () => {
  const points = computePlacementPoints([
    { runnerId: 'a', placering: 1 },
    { runnerId: 'b', placering: 2 },
    { runnerId: 'c', placering: 3 },
    { runnerId: 'd', status: 'NI' },
    { runnerId: 'e', status: 'DNR' },
    { runnerId: 'f', status: 'DNC' },
  ]);
  assert.equal(points.a, 1);
  assert.equal(points.d, 3 + 2); // NI
  assert.equal(points.e, 3 + 2); // DNR
  assert.equal(points.f, 3 + 4); // DNC
});

console.log('\ncomputeAccuracyDeduction (träffsäkerhetsavdrag)');
test('gissning inom 1 minut ger 2p avdrag', () => {
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('50:45')), 2);
});
test('gissning inom 5 minuter (men >1 min) ger 1p avdrag', () => {
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('54:30')), 1);
});
test('gissning >5 minuter fel ger inget avdrag', () => {
  assert.equal(computeAccuracyDeduction(parseClock('50:00'), parseClock('58:00')), 0);
});
test('reglerna gäller identiskt för självskattning och kompisgissning', () => {
  const selfGuess = computeAccuracyDeduction(parseClock('50:00'), parseClock('54:00'));
  const peerGuess = computeAccuracyDeduction(parseClock('50:00'), parseClock('54:00'));
  assert.equal(selfGuess, peerGuess);
});

console.log('\ncomputeSeasonAccuracyDeductions + computeSeasonTotal (helhet)');
test('ett helt räkneexempel för en årgång', () => {
  const actual = {
    daniel: parseClock('44:57'),
    ny_lopare: parseClock('58:20'),
  };
  const predictions = [
    // Daniel skattar sig själv nästan perfekt
    { guesserId: 'daniel', targetRunnerId: 'daniel', guessSec: parseClock('45:30') }, // 33s fel -> 2p avdrag
    // En kompis gissar hyfsat på Daniel, inom 5 min men inte inom 1
    { guesserId: 'andreas', targetRunnerId: 'daniel', guessSec: parseClock('49:00') }, // 4:03 fel -> 1p avdrag
    // Den nya löparens egen skattning från onboardingen, för långt off för avdrag
    { guesserId: 'ny_lopare', targetRunnerId: 'ny_lopare', guessSec: parseClock('50:00') }, // 8:20 fel -> 0p avdrag
  ];

  const deductions = computeSeasonAccuracyDeductions(predictions, actual);
  assert.equal(deductions.daniel, 2);
  assert.equal(deductions.andreas, 1);
  assert.equal(deductions.ny_lopare, 0); // 0p avdrag, men gissningen registreras ändå

  const placement = computePlacementPoints([
    { runnerId: 'daniel', placering: 1 },
    { runnerId: 'ny_lopare', placering: 2 },
    { runnerId: 'andreas', status: 'DNC' }, // andreas kom inte, men gissade ändå på Daniel i förväg
  ]);

  const total = computeSeasonTotal(placement, deductions);
  assert.equal(total.daniel, 1 - 2); // placering 1, minus 2p avdrag för prickskott
  assert.equal(total.ny_lopare, 2); // placering 2, inget avdrag
  assert.equal(total.andreas, (2 + 4) - 1); // DNC (sista=2 platser +4) minus 1p avdrag
});

console.log(`\n${passed} test klara${process.exitCode ? ', men minst ett FAIL ovan' : ' — alla gröna'}.`);
