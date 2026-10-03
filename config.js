export const supabaseConfig = {
  url: "https://megmfomragunbfxtyglj.supabase.co",
  anonKey: "sb_publishable_Welmuzn8v-lTFXQ5ViWRKQ_qRMLmfCx",
  vapidPublicKey: "",
};

export const isSupabaseConfigured =
  /^https:\/\//i.test(supabaseConfig.url) &&
  supabaseConfig.anonKey.length > 30 &&
  !supabaseConfig.anonKey.includes("YOUR_");
