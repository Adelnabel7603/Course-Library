export const supabaseConfig = {
  url: "https://megmfomragunbfxtyglj.supabase.co",
  anonKey: "sb_publishable_Welmuzn8v-lTFXQ5ViWRKQ_qRMLmfCx",
  vapidPublicKey: "BDkW3x-bIv4zfYNL1RabIkMTG8Xh0QM-d7MPxS9uqH8_pjQ4h9vQq-IXdfutE7C6XKUYm91MmNhn0HFFlAZP5vg",
};

export const isSupabaseConfigured =
  /^https:\/\//i.test(supabaseConfig.url) &&
  supabaseConfig.anonKey.length > 30 &&
  !supabaseConfig.anonKey.includes("YOUR_");
