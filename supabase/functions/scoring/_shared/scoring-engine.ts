/**
 * Run As You Are — poäng- & startordningsmotor (Deno/Edge Function-version)
 * ------------------------------------------------------------------------
 * Rak ESM-port av functions/scoring-engine.js — samma logik, samma
 * testfall (se scoring-engine.test.ts), bara import/export-syntaxen
 * ändrad för att köras i en Supabase Edge Function (Deno).
 *
 * Håll den här filen och den Node-körbara `functions/scoring-engine.js`
 * i synk manuellt tills vidare. De är avsiktligt små och beroendefria —
 * risken för glapp är låg, men säg till om det blir jobbigt och vi slår
 * ihop dem till en byggsteg istället.
 */

// ---------------------------------------------------------------------------
// Tidshjälp
// ---------------------------------------------------------------------------

/** "48:24" eller "1:03:04" -> sekunder */
export function parseClock(str: string): number {
  const parts = str.split(':').map(Number);
  if (parts.some(Number.isNaN)) throw new Error(`Ogiltig tid: "${str}"`);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

/** sekunder -> "48:24" (eller "1:03:04" om >= 1h) */
export function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const s = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${sign}${h}:${pad(m)}:${pad(sec)}` : `${sign}${m}:${pad(sec)}`;
}

// ---------------------------------------------------------------------------
// 1. Förväntad sluttid — gissningsspelet
// ---------------------------------------------------------------------------

export function computeExpectedTime(selfEstimateSec: number, peerGuessesSec: number[] = []): number {
  if (typeof selfEstimateSec !== 'number' || Number.isNaN(selfEstimateSec)) {
    throw new Error('Självskattning saknas — kan inte räkna fram förväntad sluttid.');
  }
  const all = [selfEstimateSec, ...peerGuessesSec].filter(
    (v) => typeof v === 'number' && !Number.isNaN(v)
  );
  return computeMedian(all);
}

export function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// 2. Startordning — omvänd jaktstart
// ---------------------------------------------------------------------------

export interface StartBasisEntry {
  runnerId: string;
  basisTimeSec: number;
  basisSource: 'previousResult' | 'expectedTime';
}

export interface StartListEntry extends StartBasisEntry {
  startOffsetSec: number;
}

export function computeStartList(entries: StartBasisEntry[]): StartListEntry[] {
  if (entries.length === 0) return [];
  const maxTime = Math.max(...entries.map((e) => e.basisTimeSec));
  return entries
    .map((e) => ({ ...e, startOffsetSec: maxTime - e.basisTimeSec }))
    .sort((a, b) => a.startOffsetSec - b.startOffsetSec);
}

// ---------------------------------------------------------------------------
// 3. Placeringspoäng (befintlig regel, kodifierad)
// ---------------------------------------------------------------------------

export type StatusCode = 'NI' | 'DNR' | 'DNC';

export const STATUS_PENALTY: Record<StatusCode, number> = {
  NI: 2,
  DNR: 2,
  DNC: 4,
};

export interface YearResult {
  runnerId: string;
  placering?: number;
  status?: StatusCode;
}

export function computePlacementPoints(yearResults: YearResult[]): Record<string, number> {
  const finishers = yearResults.filter((r) => r.placering != null);
  const lastPlace = finishers.length > 0
    ? Math.max(...finishers.map((r) => r.placering as number))
    : yearResults.length;

  const points: Record<string, number> = {};
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

export const ACCURACY_DEDUCTION_TIERS = [
  { maxErrorSec: 60, deduction: 2 },
  { maxErrorSec: 5 * 60, deduction: 1 },
  { maxErrorSec: Infinity, deduction: 0 },
];

export function computeAccuracyDeduction(guessSec: number, actualSec: number): number {
  const errorSec = Math.abs(guessSec - actualSec);
  const tier = ACCURACY_DEDUCTION_TIERS.find((t) => errorSec <= t.maxErrorSec)!;
  return tier.deduction;
}

export interface Prediction {
  guesserId: string;
  targetRunnerId: string;
  guessSec: number;
}

export function computeSeasonAccuracyDeductions(
  predictions: Prediction[],
  actualTimesByRunnerId: Record<string, number>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of predictions) {
    const actual = actualTimesByRunnerId[p.targetRunnerId];
    if (actual == null) continue;
    const deduction = computeAccuracyDeduction(p.guessSec, actual);
    totals[p.guesserId] = (totals[p.guesserId] || 0) + deduction;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// 5. Säsongstotal — allt ihopräknat
// ---------------------------------------------------------------------------

export function computeSeasonTotal(
  placementPoints: Record<string, number>,
  accuracyDeductions: Record<string, number>
): Record<string, number> {
  const total: Record<string, number> = { ...placementPoints };
  for (const [runnerId, deduction] of Object.entries(accuracyDeductions)) {
    total[runnerId] = (total[runnerId] || 0) - deduction;
  }
  return total;
}
