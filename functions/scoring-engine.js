/**
 * Run As You Are — poäng- & startordningsmotor
 * ------------------------------------------------
 * Ren logik, utan Firebase-beroenden, så den kan enhetstestas fritt och
 * sedan klistras rakt in i en Cloud Function (t.ex. onCall eller en
 * Firestore-trigger som körs när ett lopp avslutas).
 *
 * Tider representeras alltid i sekunder (number) internt. Använd
 * parseClock()/formatClock() i kanterna (UI, import) för mm:ss.
 *
 * Regler implementerade härifrån, spec:et som skickades 2026-08-24:
 *  1. Startordning: omvänd jaktstart baserat på föregående års måltider,
 *     eller — om löparen saknar giltigt föregående-årsresultat — på en
 *     "förväntad sluttid" som räknas fram ur självskattning + andras gissningar.
 *  2. Placeringspoäng: lägre är bättre (golf-stil), med straff för
 *     NI / DNR / DNC enligt tabellens befintliga regler.
 *  3. Träffsäkerhetsavdrag: den som gissar rätt (självskattning ELLER
 *     gissning om någon annan) får ett poängavdrag i sin säsongstotal,
 *     skalat efter hur träffsäker gissningen var. Gäller lika oavsett
 *     vem som gissat — ingen anledning att skatta fel med flit.
 */

'use strict';

// ---------------------------------------------------------------------------
// Tidshjälp
// ---------------------------------------------------------------------------

/** "48:24" eller "1:03:04" -> sekunder */
function parseClock(str) {
  const parts = str.split(':').map(Number);
  if (parts.some(Number.isNaN)) throw new Error(`Ogiltig tid: "${str}"`);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

/** sekunder -> "48:24" (eller "1:03:04" om >= 1h) */
function formatClock(totalSeconds) {
  const sign = totalSeconds < 0 ? '-' : '';
  const s = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${sign}${h}:${pad(m)}:${pad(sec)}` : `${sign}${m}:${pad(sec)}`;
}

// ---------------------------------------------------------------------------
// 1. Förväntad sluttid — gissningsspelet
// ---------------------------------------------------------------------------

/**
 * Slår ihop självskattning + gissningar från gänget till en "förväntad
 * sluttid" för en löpare som saknar giltigt resultat från föregående år
 * (ny deltagare, eller hoppade av förra loppet).
 *
 * Vi använder MEDIAN snarare än medelvärde: ett skämtgissning från en
 * kompis ("2 timmar!") ska inte kunna dra iväg basen för startordningen.
 * Om du hellre vill ha medelvärde, byt ut computeMedian mot ett
 * medelvärde här — resten av motorn bryr sig bara om att den får ett tal.
 *
 * @param {number} selfEstimateSec  löparens egen skattning (sekunder)
 * @param {number[]} peerGuessesSec  övriga deltagares gissningar (sekunder)
 * @returns {number} förväntad sluttid i sekunder
 */
function computeExpectedTime(selfEstimateSec, peerGuessesSec = []) {
  if (typeof selfEstimateSec !== 'number' || Number.isNaN(selfEstimateSec)) {
    throw new Error('Självskattning saknas — kan inte räkna fram förväntad sluttid.');
  }
  const all = [selfEstimateSec, ...peerGuessesSec].filter(
    (v) => typeof v === 'number' && !Number.isNaN(v)
  );
  return computeMedian(all);
}

function computeMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// 2. Startordning — omvänd jaktstart
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StartBasisEntry
 * @property {string} runnerId
 * @property {number} basisTimeSec   föregående års tid, ELLER förväntad
 *                                    sluttid (från computeExpectedTime) om
 *                                    löparen saknar giltigt föregående år.
 * @property {'previousResult'|'expectedTime'} basisSource   för spårbarhet i UI:t
 */

/**
 * Räknar ut jaktstartens startordning och gap.
 * Den med längst basisTid (långsammast förra året / väntas bli långsammast)
 * startar FÖRST, med offset 0. Alla andra startar senare med exakt det gap
 * som skilde dem åt förra året (eller väntas skilja dem åt) — springer alla
 * i samma takt som basisTiden antyder kommer de i mål samtidigt.
 *
 * @param {StartBasisEntry[]} entries
 * @returns {Array<{runnerId: string, basisTimeSec: number, basisSource: string, startOffsetSec: number}>}
 *          sorterad i faktisk startordning (offset 0 = startar först)
 */
function computeStartList(entries) {
  if (entries.length === 0) return [];
  const maxTime = Math.max(...entries.map((e) => e.basisTimeSec));
  return entries
    .map((e) => ({ ...e, startOffsetSec: maxTime - e.basisTimeSec }))
    .sort((a, b) => a.startOffsetSec - b.startOffsetSec);
}

// ---------------------------------------------------------------------------
// 3. Placeringspoäng (befintlig regel, kodifierad)
// ---------------------------------------------------------------------------

const STATUS_PENALTY = {
  // "sista plats" = antal startande DEN säsongen (räknas i callern, se nedan)
  NI: 2,  // Not Invited
  DNR: 2, // Did Not Run
  DNC: 4, // Did Not Come
};

/**
 * @param {Array<{runnerId: string, placering?: number, status?: 'NI'|'DNR'|'DNC'}>} yearResults
 *        placering sätts för de som sprang; status sätts för de som inte gjorde det.
 * @returns {Record<string, number>} runnerId -> poäng för DETTA år
 */
function computePlacementPoints(yearResults) {
  const finishers = yearResults.filter((r) => r.placering != null);
  const lastPlace = finishers.length > 0
    ? Math.max(...finishers.map((r) => r.placering))
    : yearResults.length; // om ingen sprang alls, faller tillbaka på antal deltagare

  const points = {};
  for (const r of yearResults) {
    if (r.placering != null) {
      points[r.runnerId] = r.placering;
    } else if (r.status && STATUS_PENALTY[r.status] != null) {
      points[r.runnerId] = lastPlace + STATUS_PENALTY[r.status];
    } else {
      throw new Error(`Löpare ${r.runnerId} saknar både placering och status.`);
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// 4. Träffsäkerhetsavdrag — belönar att gissa rätt (med eller utan flit)
// ---------------------------------------------------------------------------

/**
 * RÄTTAD 2026-08-24: det här är ett AVDRAG från säsongstotalen (poäng är
 * golf-poäng, lägre är bättre), inte ett tillägg. Ju träffsäkrare gissningen,
 * ju större avdrag — så den som gissar rätt belönas, och den som "skattar
 * fel med flit" för att t.ex. få en snällare startposition har ingenting
 * att vinna på det.
 *
 * Trappsteg enligt spec: ≤1 min fel → 2p avdrag, ≤5 min fel → 1p avdrag,
 * mer fel än det → inget avdrag alls (varken bonus eller straff).
 */
const ACCURACY_DEDUCTION_TIERS = [
  { maxErrorSec: 60, deduction: 2 },
  { maxErrorSec: 5 * 60, deduction: 1 },
  { maxErrorSec: Infinity, deduction: 0 },
];

/**
 * @param {number} guessSec    gissad sluttid (sekunder) — självskattning ELLER
 *                              en kompis gissning, hanteras identiskt
 * @param {number} actualSec   faktisk sluttid (sekunder)
 * @returns {number} poängavdrag från gissarens säsongstotal (0, 1 eller 2)
 */
function computeAccuracyDeduction(guessSec, actualSec) {
  const errorSec = Math.abs(guessSec - actualSec);
  const tier = ACCURACY_DEDUCTION_TIERS.find((t) => errorSec <= t.maxErrorSec);
  return tier.deduction;
}

/**
 * Summerar träffsäkerhetsavdrag per gissare för ett helt lopp.
 * @param {Array<{guesserId: string, targetRunnerId: string, guessSec: number}>} predictions
 * @param {Record<string, number>} actualTimesByRunnerId  faktiska sluttider (sekunder), NI/DNR/DNC-löpare har inget facit och hoppas över
 * @returns {Record<string, number>} guesserId -> summerat poängavdrag
 */
function computeSeasonAccuracyDeductions(predictions, actualTimesByRunnerId) {
  const totals = {};
  for (const p of predictions) {
    const actual = actualTimesByRunnerId[p.targetRunnerId];
    if (actual == null) continue; // löparen kom inte i mål — inget facit att döma gissningen mot
    const deduction = computeAccuracyDeduction(p.guessSec, actual);
    totals[p.guesserId] = (totals[p.guesserId] || 0) + deduction;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// 5. Säsongstotal — allt ihopräknat
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, number>} placementPoints         från computePlacementPoints
 * @param {Record<string, number>} accuracyDeductions       från computeSeasonAccuracyDeductions
 * @returns {Record<string, number>} runnerId -> total poäng för säsongen
 */
function computeSeasonTotal(placementPoints, accuracyDeductions) {
  const total = { ...placementPoints };
  for (const [runnerId, deduction] of Object.entries(accuracyDeductions)) {
    total[runnerId] = (total[runnerId] || 0) - deduction;
  }
  return total;
}

module.exports = {
  parseClock,
  formatClock,
  computeExpectedTime,
  computeMedian,
  computeStartList,
  computePlacementPoints,
  computeAccuracyDeduction,
  computeSeasonAccuracyDeductions,
  computeSeasonTotal,
  ACCURACY_DEDUCTION_TIERS,
  STATUS_PENALTY,
};
