import { supabase } from "../integrations/supabase/client";

/**
 * Row Level Security on this database only grants read access to the
 * `authenticated` role, not `anon` - so a plain anon-key request returns
 * zero rows. Apple Sign-In is deferred until race day actually needs to
 * know who someone is, so until then this uses Supabase's anonymous
 * sign-in: it creates a session with no real identity attached, just
 * enough to satisfy `to authenticated` RLS policies.
 *
 * This can be upgraded to a real Apple Sign-In identity later
 * (supabase.auth.linkIdentity) without restructuring anything that reads
 * from the anonymous session in the meantime.
 *
 * Safe to call on every screen mount - it no-ops if a session already
 * exists.
 */
export async function ensureSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
