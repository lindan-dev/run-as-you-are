// Pattern matches fiftytwoormore's src/integrations/supabase/client.ts:
// AsyncStorage instead of browser localStorage, everything else identical.
//
// This anon key is meant to be public and embedded in client apps - it is
// NOT the service_role key, which must never appear here. RLS policies on
// the database are what actually restrict what this key can read/write.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vuywjjluzjcgjdjrttdh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1eXdqamx1empjZ2pkanJ0dGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODc5ODUsImV4cCI6MjEwMzE2Mzk4NX0.RstLN_5_03K9fwHjCGlMfTbaCXq_R1RbwJoNb2uBYRM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // no browser URL to parse magic links from
  },
});
