import { supabaseConfig } from "../config.js";
import { registerPushSubscription } from "./library.js";

const previewCalendarKey = "course-library-feature-preview-calendar-events";
const reminderTranslations = {
  ar: {
    calendarKicker: "جدولك الدراسي",
    calendarTitle: "المحاضرات والسكاشن والامتحانات",
    calendarAll: "الكل",
    calendarLectures: "محاضرات",
    calendarSections: "سكاشن",
    calendarExams: "امتحانات",
    privateArea: "مساحتك الخاصة",
    personalReminders: "تذكيراتك الشخصية",
    privateAccountNote: "مرتبطة بحسابك",
    studentEmail: "البريد الإلكتروني",
    studentPassword: "كلمة المرور",
    createStudentAccount: "إنشاء حساب جديد",
    enableReminderPush: "تفعيل تنبيهات المواعيد",
    reminderTitle: "عنوان التذكير",
    reminderDetails: "تفاصيل (اختياري)",
    reminderTime: "موعد التنبيه",
    addReminder: "إضافة تذكير",
    previousWeek: "الأسبوع السابق",
    nextWeek: "الأسبوع التالي",
    filterEvents: "تصفية المواعيد",
    signOut: "تسجيل الخروج",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء الحساب",
    noEvents: "لا توجد مواعيد",
    calendarLoadFailed: "تعذر تحميل التقويم. تأكد من تطبيق ترحيل الجداول في قاعدة البيانات.",
    supabaseRequired: "حسابات الطلاب والتذكيرات تحتاج إعداد قاعدة البيانات.",
    createAccountSuccess: "تم إنشاء الحساب. راجع بريدك لتأكيده قبل تسجيل الدخول.",
    pushEnabled: "التنبيهات مفعّلة على هذا الجهاز.",
    pushNotConfigured: "إشعارات الجهاز غير مهيأة. أضف مفتاح VAPID العام إلى إعدادات الموقع.",
    pushDenied: "إذن الإشعارات مرفوض من إعدادات المتصفح.",
    pushUnavailable: "إشعارات الجهاز غير متاحة في هذا المتصفح.",
    pushSuccess: "تم تفعيل تنبيهات المواعيد لهذا الحساب.",
    signInForReminders: "سجل الدخول لحفظ تذكيراتك وإرسالها بشكل خاص.",
    noReminders: "لا توجد تذكيرات شخصية.",
    reminderSaved: "تم حفظ التذكير.",
    reminderDeleted: "تم حذف التذكير.",
    reminderPast: "اختر موعدًا قادمًا للتذكير.",
    remindersLoadFailed: "تعذر تحميل تذكيرات الحساب.",
    remindersSaveFailed: "تعذر حفظ التذكير.",
    eventTypes: { lecture: "محاضرة", section: "سكشن", exam: "امتحان" },
    weekdays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  },
  en: {
    calendarKicker: "YOUR STUDY SCHEDULE",
    calendarTitle: "Lectures, sections and exams",
    calendarAll: "All",
    calendarLectures: "Lectures",
    calendarSections: "Sections",
    calendarExams: "Exams",
    privateArea: "PRIVATE SPACE",
    personalReminders: "Your reminders",
    privateAccountNote: "Private to your account",
    studentEmail: "Email address",
    studentPassword: "Password",
    createStudentAccount: "Create a new account",
    enableReminderPush: "Enable schedule alerts",
    reminderTitle: "Reminder title",
    reminderDetails: "Details (optional)",
    reminderTime: "Reminder time",
    addReminder: "Add reminder",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    filterEvents: "Filter calendar events",
    signOut: "Sign out",
    signIn: "Sign in",
    signUp: "Create account",
    noEvents: "No events",
    calendarLoadFailed: "Could not load the calendar. Apply the calendar database migration first.",
    supabaseRequired: "Student accounts and reminders require the database to be configured.",
    createAccountSuccess: "Account created. Check your email to confirm it before signing in.",
    pushEnabled: "Alerts are enabled on this device.",
    pushNotConfigured: "Device notifications are not configured. Add the public VAPID key to the site settings.",
    pushDenied: "Notification permission is blocked in browser settings.",
    pushUnavailable: "Device notifications are unavailable in this browser.",
    pushSuccess: "Schedule alerts are enabled for this account.",
    signInForReminders: "Sign in to save private reminders and receive alerts.",
    noReminders: "No personal reminders.",
    reminderSaved: "Reminder saved.",
    reminderDeleted: "Reminder deleted.",
    reminderPast: "Choose a future reminder time.",
    remindersLoadFailed: "Could not load account reminders.",
    remindersSaveFailed: "Could not save the reminder.",
    eventTypes: { lecture: "Lecture", section: "Section", exam: "Exam" },
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
};

const decodeVapidKey = (key) => {
  const padded = key + "=".repeat((4 - key.length % 4) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};

const toDateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const dateFromKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export async function initializeStudentCalendar({ preview = false, notify = () => {} } = {}) {
  const root = document.querySelector("#study-calendar");
  if (!root) return;
  const { supabase } = preview ? { supabase: null } : await import("./supabase.js");
  const calendarGrid = root.querySelector("#calendar-grid");
  const calendarLabel = root.querySelector("#calendar-week-label");
  const calendarStatus = root.querySelector("#calendar-status");
  const guestPanel = root.querySelector("#student-auth-form");
  const sessionPanel = root.querySelector("#student-session-panel");
  const authStatus = root.querySelector("#student-auth-status");
  const authSubmit = root.querySelector("#student-auth-submit");
  const signupMode = root.querySelector("#student-signup-mode");
  const emailField = guestPanel.elements.email;
  const passwordField = guestPanel.elements.password;
  const accountEmail = root.querySelector("#student-account-email");
  const signOutButton = root.querySelector("#student-sign-out");
  const pushButton = root.querySelector("#student-enable-push");
  const pushStatus = root.querySelector("#student-push-status");
  const reminderForm = root.querySelector("#student-reminder-form");
  const reminderList = root.querySelector("#student-reminder-list");
  const filterButtons = [...root.querySelectorAll("[data-calendar-filter]")];
  let events = [];
  let reminders = [];
  let currentSession = null;
  let weekOffset = 0;
  let eventFilter = "all";
  let lastAccountId = null;

  const language = () => document.documentElement.lang === "en" ? "en" : "ar";
  const text = (key) => reminderTranslations[language()][key];
  const locale = () => language() === "en" ? "en-US" : "ar-EG";

  function translateControls() {
    const dictionary = reminderTranslations[language()];
    root.querySelectorAll("[data-calendar-text]").forEach((element) => {
      const value = dictionary[element.dataset.calendarText];
      if (typeof value === "string") element.textContent = value;
    });
    root.querySelectorAll("[data-calendar-aria]").forEach((element) => {
      const value = dictionary[element.dataset.calendarAria];
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });
    updateAuthButton();
    renderCalendar();
    renderReminders();
  }

  function updateAuthButton() {
    authSubmit.textContent = signupMode.checked ? text("signUp") : text("signIn");
  }

  function setStatus(message, error = false) {
    calendarStatus.textContent = message;
    calendarStatus.classList.toggle("is-error", error);
    calendarStatus.hidden = !message;
  }

  function mondayForWeek(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
    return monday;
  }

  function eventMatchesDay(event, date, dateKey) {
    if (event.event_type === "exam") return event.event_date === dateKey;
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    return Number(event.weekday) === weekday &&
      dateKey >= event.starts_on && dateKey <= event.ends_on;
  }

  function renderCalendar() {
    const weekStart = mondayForWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const dateFormat = new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric" });
    calendarLabel.textContent = `${dateFormat.format(weekStart)} – ${dateFormat.format(weekEnd)}`;
    const today = toDateKey(new Date());
    calendarGrid.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateKey = toDateKey(date);
      const day = document.createElement("article");
      day.className = `calendar-day${dateKey === today ? " is-today" : ""}`;
      const heading = document.createElement("div");
      heading.className = "calendar-day-heading";
      const weekday = document.createElement("span");
      weekday.textContent = reminderTranslations[language()].weekdays[date.getDay()];
      const dayTime = document.createElement("time");
      dayTime.dateTime = dateKey;
      dayTime.textContent = new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(date);
      heading.append(weekday, dayTime);
      const list = document.createElement("ul");
      list.className = "calendar-event-list";
      const dayEvents = events
        .filter((event) => eventFilter === "all" || event.event_type === eventFilter)
        .filter((event) => eventMatchesDay(event, date, dateKey))
        .sort((first, second) => String(first.start_time).localeCompare(String(second.start_time)));
      for (const event of dayEvents) {
        const item = document.createElement("li");
        item.className = `calendar-event is-${event.event_type}`;
        const time = document.createElement("time");
        time.dateTime = `${dateKey}T${String(event.start_time).slice(0, 5)}`;
        time.textContent = `${String(event.start_time).slice(0, 5)}–${String(event.end_time).slice(0, 5)}`;
        const title = document.createElement("strong");
        title.textContent = event.title;
        const course = document.createElement("span");
        course.textContent = `${reminderTranslations[language()].eventTypes[event.event_type]} · ${event.course_name}`;
        const location = document.createElement("span");
        location.textContent = `${event.location_name}${event.group_name ? ` · ${event.group_name}` : ""}`;
        item.append(time, title, course, location);
        list.append(item);
      }
      if (!dayEvents.length) {
        const empty = document.createElement("li");
        empty.className = "calendar-day-empty";
        empty.textContent = text("noEvents");
        list.append(empty);
      }
      day.append(heading, list);
      return day;
    }));
  }

  function formatReminderDate(value) {
    return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function renderReminders() {
    if (!currentSession) {
      reminderList.replaceChildren();
      return;
    }
    reminderList.replaceChildren(...reminders.map((reminder) => {
      const item = document.createElement("li");
      item.className = "student-reminder-item";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = reminder.title;
      const time = document.createElement("time");
      time.dateTime = reminder.remind_at;
      time.textContent = formatReminderDate(reminder.remind_at);
      details.append(title, time);
      if (reminder.body) {
        const body = document.createElement("span");
        body.textContent = reminder.body;
        details.append(body);
      }
      const remove = document.createElement("button");
      remove.className = "study-task-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${language() === "en" ? "Delete reminder" : "حذف التذكير"}: ${reminder.title}`);
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        const { error } = await supabase.from("student_reminders").delete().eq("id", reminder.id);
        if (error) {
          remove.disabled = false;
          notify(error.message || text("remindersSaveFailed"));
          return;
        }
        reminders = reminders.filter((item) => item.id !== reminder.id);
        renderReminders();
        notify(text("reminderDeleted"));
      });
      item.append(details, remove);
      return item;
    }));
    if (!reminders.length) {
      const empty = document.createElement("li");
      empty.className = "calendar-day-empty";
      empty.textContent = text("noReminders");
      reminderList.append(empty);
    }
  }

  async function loadCalendar() {
    if (preview) {
      try {
        const stored = JSON.parse(localStorage.getItem(previewCalendarKey) || "[]");
        events = Array.isArray(stored) ? stored.filter((event) => event.is_active !== false) : [];
      } catch {
        events = [];
      }
      renderCalendar();
      return;
    }
    if (!supabase) {
      setStatus(text("supabaseRequired"), true);
      renderCalendar();
      return;
    }
    const { data, error } = await supabase.from("calendar_events").select("*").eq("is_active", true);
    if (error) {
      events = [];
      renderCalendar();
      setStatus(text("calendarLoadFailed"), true);
      return;
    }
    events = data || [];
    setStatus("");
    renderCalendar();
  }

  async function loadReminders() {
    if (!currentSession || !supabase) return;
    const { data, error } = await supabase.from("student_reminders")
      .select("id, title, body, remind_at, sent_at")
      .eq("user_id", currentSession.user.id)
      .order("remind_at");
    if (error) {
      pushStatus.textContent = text("remindersLoadFailed");
      reminders = [];
    } else {
      reminders = data || [];
    }
    renderReminders();
  }

  function setPushMessage(message) {
    pushStatus.textContent = message;
  }

  async function getCurrentSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? registration.pushManager.getSubscription() : null;
  }

  async function associateCurrentSubscription() {
    if (!currentSession || !supabase || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const subscription = await getCurrentSubscription();
      if (subscription) await registerPushSubscription(subscription.toJSON());
    } catch (error) {
      setPushMessage(error.message || text("pushUnavailable"));
    }
  }

  async function setSession(session) {
    const nextId = session?.user?.id || null;
    const changed = nextId !== lastAccountId;
    lastAccountId = nextId;
    currentSession = session;
    guestPanel.hidden = Boolean(session);
    sessionPanel.hidden = !session;
    if (!session) {
      reminders = [];
      renderReminders();
      return;
    }
    accountEmail.textContent = session.user.email || "";
    if (changed) {
      await Promise.all([loadReminders(), associateCurrentSubscription()]);
    }
  }

  function setAuthMessage(message, error = false) {
    authStatus.textContent = message;
    authStatus.classList.toggle("is-error", error);
    authStatus.hidden = !message;
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      eventFilter = button.dataset.calendarFilter;
      filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderCalendar();
    });
  });
  root.querySelector("#calendar-previous-week").addEventListener("click", () => {
    weekOffset -= 1;
    renderCalendar();
  });
  root.querySelector("#calendar-next-week").addEventListener("click", () => {
    weekOffset += 1;
    renderCalendar();
  });
  signupMode.addEventListener("change", updateAuthButton);

  guestPanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) {
      setAuthMessage(text("supabaseRequired"), true);
      return;
    }
    authSubmit.disabled = true;
    setAuthMessage("");
    try {
      const email = String(emailField.value || "").trim();
      const password = String(passwordField.value || "");
      if (signupMode.checked) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (error) throw error;
        if (data.session) {
          await setSession(data.session);
          setAuthMessage(language() === "en" ? "Account created." : "تم إنشاء الحساب.");
        } else {
          setAuthMessage(text("createAccountSuccess"));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await setSession(data.session);
        setAuthMessage("");
      }
    } catch (error) {
      setAuthMessage(error.message || text("remindersLoadFailed"), true);
    } finally {
      authSubmit.disabled = false;
    }
  });

  pushButton.addEventListener("click", async () => {
    if (!currentSession) return;
    if (!supabaseConfig.vapidPublicKey) {
      setPushMessage(text("pushNotConfigured"));
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushMessage(text("pushUnavailable"));
      return;
    }
    if (Notification.permission === "denied") {
      setPushMessage(text("pushDenied"));
      return;
    }
    pushButton.disabled = true;
    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        setPushMessage(text("pushDenied"));
        return;
      }
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(supabaseConfig.vapidPublicKey),
        });
      await registerPushSubscription(subscription.toJSON());
      setPushMessage(text("pushSuccess"));
    } catch (error) {
      setPushMessage(error.message || text("pushUnavailable"));
    } finally {
      pushButton.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      const subscription = await getCurrentSubscription();
      if (subscription) {
        const { error } = await supabase.functions.invoke("register-push", {
          body: { unsubscribe: true, endpoint: subscription.endpoint },
        });
        if (error) throw error;
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await setSession(null);
    } catch (error) {
      setPushMessage(error.message || "تعذر تسجيل الخروج بأمان.");
    } finally {
      signOutButton.disabled = false;
    }
  });

  reminderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession) return;
    const values = new FormData(reminderForm);
    const title = String(values.get("title") || "").trim();
    const remindAt = new Date(String(values.get("remind_at") || ""));
    if (!title || !Number.isFinite(remindAt.getTime()) || remindAt <= new Date()) {
      pushStatus.textContent = text("reminderPast");
      return;
    }
    const submit = reminderForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const { data, error } = await supabase.from("student_reminders").insert({
        user_id: currentSession.user.id,
        title,
        body: String(values.get("body") || "").trim(),
        remind_at: remindAt.toISOString(),
      }).select("id, title, body, remind_at, sent_at").single();
      if (error) throw error;
      reminders = [...reminders, data].sort((first, second) => first.remind_at.localeCompare(second.remind_at));
      reminderForm.reset();
      renderReminders();
      notify(text("reminderSaved"));
    } catch (error) {
      pushStatus.textContent = error.message || text("remindersSaveFailed");
    } finally {
      submit.disabled = false;
    }
  });

  if (preview) {
    guestPanel.hidden = true;
    sessionPanel.hidden = true;
    setStatus(language() === "en" ? "Student accounts require the live site." : "حسابات الطلاب متاحة على الموقع المنشور.");
    await loadCalendar();
  } else if (supabase) {
    await loadCalendar();
    const { data: authData } = await supabase.auth.getSession();
    await setSession(authData.session);
    supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void setSession(session); }, 0);
    });
    supabase.channel("study-calendar-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => {
        void loadCalendar();
      })
      .subscribe();
    window.addEventListener("focus", () => { void loadCalendar(); });
  } else {
    guestPanel.hidden = true;
    sessionPanel.hidden = true;
    setStatus(text("supabaseRequired"), true);
  }

  translateControls();
  const languageObserver = new MutationObserver(translateControls);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
}
