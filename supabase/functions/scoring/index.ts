/**
 * Edge Function: scoring
 * ------------------------------------------------------------------------
 * Tunn HTTP-wrapper runt _shared/scoring-engine.ts. All faktisk uträkning
 * (startordning, placeringspoäng, gissningsavdrag) ligger i den
 * beroendefria, testade filen — den här filen bara läser/skriver Postgres
 * runt den.
 *
 * OBEPRÖVAD MOT EN RIKTIG SUPABASE-DATABAS ännu — själva räknelogiken är
 * testad (9 gröna Deno-tester + 15 gröna Node-tester, samma facit), men
 * denna handler behöver en riktig `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
 * för att provköras. `service_role`-nyckeln kringgår RLS med flit — den
 * ska ALDRIG delas till appen, bara leva som secret här.
 *
 * Deploy: `supabase functions deploy scoring`
 * Anropa: POST /functions/v1/scoring  { "action": "compute-start-list" | "score-edition", "editionId": "..." }
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  computeExpectedTime,
  computeStartList,
  computePlacementPoints,
  computeSeasonAccuracyDeductions,
  type StartBasisEntry,
  type YearResult,
} from './_shared/scoring-engine.ts';

// Ingen genererad Database-typ än (kräver ett riktigt projekt att köra
// `supabase gen types typescript` mot). `any` här, byt till
// `SupabaseClient<Database>` när ni har genererat den, så får ni fullt
// typade tabellnamn/kolumner på köpet.
type AnySupabaseClient = SupabaseClient<any, any, any>;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  try {
    const { action, editionId } = await req.json();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'compute-start-list') {
      return await computeAndStoreStartList(supabase, editionId);
    }
    if (action === 'score-edition') {
      return await scoreEditionAndStore(supabase, editionId);
    }
    return jsonResponse({ error: `Okänd action: ${action}` }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

/**
 * Bygger startordningen för en upplaga: föregående års faktiska tid om den
 * finns, annars förväntad sluttid ur gissningsspelet. Skriver till start_list.
 */
async function computeAndStoreStartList(supabase: AnySupabaseClient, editionId: string) {
  const { data: edition } = await supabase.from('editions').select('*').eq('id', editionId).single();
  if (!edition) return jsonResponse({ error: 'Okänd edition' }, 404);

  const { data: prevEdition } = await supabase
    .from('editions')
    .select('id')
    .eq('year', edition.year - 1)
    .maybeSingle();

  const { data: runners } = await supabase.from('runners').select('*');
  if (!runners) return jsonResponse({ error: 'Inga löpare' }, 500);

  const entries: StartBasisEntry[] = [];
  for (const runner of runners) {
    const prevResult = prevEdition
      ? (await supabase
          .from('results')
          .select('finish_time_sec')
          .eq('edition_id', prevEdition.id)
          .eq('runner_id', runner.id)
          .maybeSingle()).data
      : null;

    if (prevResult?.finish_time_sec) {
      entries.push({
        runnerId: runner.id,
        basisTimeSec: prevResult.finish_time_sec,
        basisSource: 'previousResult',
      });
      continue;
    }

    // Inget giltigt föregående år — använd gissningsspelets förväntade sluttid.
    const { data: predictions } = await supabase
      .from('predictions')
      .select('guess_sec, is_self')
      .eq('edition_id', editionId)
      .eq('target_runner_id', runner.id);

    const selfGuess = predictions?.find((p) => p.is_self)?.guess_sec ?? runner.self_estimate_10k_sec;
    const peerGuesses = (predictions ?? []).filter((p) => !p.is_self).map((p) => p.guess_sec);
    if (!selfGuess) continue; // ingen bas alls för den här löparen — hoppa över tills onboarding är klar

    entries.push({
      runnerId: runner.id,
      basisTimeSec: computeExpectedTime(selfGuess, peerGuesses),
      basisSource: 'expectedTime',
    });
  }

  const startList = computeStartList(entries);

  await supabase.from('start_list').delete().eq('edition_id', editionId);
  const { error } = await supabase.from('start_list').insert(
    startList.map((e) => ({
      edition_id: editionId,
      runner_id: e.runnerId,
      basis_source: e.basisSource === 'previousResult' ? 'previous_result' : 'expected_time',
      basis_time_sec: e.basisTimeSec,
      start_offset_sec: e.startOffsetSec,
    }))
  );
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ startList });
}

/**
 * Räknar placeringspoäng + gissningsavdrag för en avslutad upplaga och
 * skriver in prediction_deduction på varje gissares results-rad.
 */
async function scoreEditionAndStore(supabase: AnySupabaseClient, editionId: string) {
  const { data: results } = await supabase.from('results').select('*').eq('edition_id', editionId);
  if (!results) return jsonResponse({ error: 'Inga resultat för den här upplagan' }, 404);

  const yearResults: YearResult[] = results.map((r) => ({
    runnerId: r.runner_id,
    placering: r.placering ?? undefined,
    status: r.status ?? undefined,
  }));
  const placementPoints = computePlacementPoints(yearResults);

  const { data: predictions } = await supabase
    .from('predictions')
    .select('guesser_runner_id, target_runner_id, guess_sec')
    .eq('edition_id', editionId);

  const actualTimes: Record<string, number> = {};
  for (const r of results) {
    if (r.finish_time_sec) actualTimes[r.runner_id] = r.finish_time_sec;
  }

  const deductions = computeSeasonAccuracyDeductions(
    (predictions ?? []).map((p) => ({
      guesserId: p.guesser_runner_id,
      targetRunnerId: p.target_runner_id,
      guessSec: p.guess_sec,
    })),
    actualTimes
  );

  for (const r of results) {
    const { error } = await supabase
      .from('results')
      .update({ prediction_deduction: deductions[r.runner_id] ?? 0 })
      .eq('id', r.id);
    if (error) return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ placementPoints, deductions });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
