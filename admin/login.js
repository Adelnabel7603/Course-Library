import { supabase } from "../services/supabase.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");

if (!supabase) {
  message.textContent = "أكمل إعداد رابط Supabase ومفتاح anon في ملف config.js.";
  message.hidden = false;
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = true;
  });
} else {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    message.textContent = sessionError.message;
    message.hidden = false;
  }
  if (sessionData?.session) window.location.replace("./dashboard.html");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.hidden = true;

    try {
      const values = new FormData(form);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.get("email"),
        password: values.get("password"),
      });
      if (error) throw error;

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin) {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب غير مخوّل لإدارة المكتبة.");
      }
      window.location.replace("./dashboard.html");
    } catch (error) {
      message.textContent = error.message || "تعذّر تسجيل الدخول.";
      message.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}
