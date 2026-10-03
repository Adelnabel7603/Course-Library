import { supabaseConfig } from "../config.js";

const configured =
  /^https:\/\//i.test(supabaseConfig.url) &&
  supabaseConfig.anonKey.length > 30 &&
  !supabaseConfig.anonKey.includes("YOUR_");

export const isSupabaseConfigured = configured;

export let supabase = null;

if (configured) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    });
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error("أضف رابط Supabase ومفتاح anon إلى config.js أولًا.");
  }
  return supabase;
}
