import { supabase } from "../integrations/supabase/client";

export type StartListRow = {
  runnerId: string;
  name: string;
  hostCount: number;
  basisSource: "previous_result" | "expected_time";
  basisTimeSec: number;
  startOffsetSec: number;
};

export type EditionSummary = {
  id: string;
  year: number;
  startTime: string | null;
  status: "upcoming" | "active" | "completed";
};

/** Loads the given year's edition plus its jaktstart order, joined with
 * runner names, sorted so the first starter (offset 0) comes first -
 * mirrors the "STARTORDNING" list in Main.dc.html. */
export async function fetchStartList(
  year: number
): Promise<{ edition: EditionSummary; rows: StartListRow[] } | null> {
  const { data: edition, error: editionError } = await supabase
    .from("editions")
    .select("id, year, start_time, status")
    .eq("year", year)
    .maybeSingle();

  if (editionError) throw editionError;
  if (!edition) return null;

  const { data: startList, error: startListError } = await supabase
    .from("start_list")
    .select("runner_id, basis_source, basis_time_sec, start_offset_sec, runners(name, host_count)")
    .eq("edition_id", edition.id)
    .order("start_offset_sec", { ascending: true });

  if (startListError) throw startListError;

  const rows: StartListRow[] = (startList ?? []).map((row: any) => ({
    runnerId: row.runner_id,
    name: row.runners?.name ?? "Okänd löpare",
    hostCount: row.runners?.host_count ?? 0,
    basisSource: row.basis_source,
    basisTimeSec: row.basis_time_sec,
    startOffsetSec: row.start_offset_sec,
  }));

  return {
    edition: {
      id: edition.id,
      year: edition.year,
      startTime: edition.start_time,
      status: edition.status,
    },
    rows,
  };
}
