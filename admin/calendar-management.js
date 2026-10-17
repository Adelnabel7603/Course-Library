const fieldAliases = {
  event_id: ["event_id", "eventid", "id", "معرف الموعد"],
  type: ["type", "event_type", "eventtype", "النوع", "نوع الموعد"],
  title: ["title", "العنوان", "اسم الموعد"],
  course: ["course", "course_name", "coursename", "subject", "المادة", "اسم المادة"],
  group: ["group", "group_name", "groupname", "المجموعة", "الفرقة"],
  location: ["location", "location_name", "locationname", "room", "hall", "القاعة", "المدرج", "المكان"],
  weekday: ["weekday", "day", "اليوم"],
  starts_on: ["starts_on", "start_date", "startdate", "بداية التكرار", "من تاريخ"],
  ends_on: ["ends_on", "end_date", "enddate", "نهاية التكرار", "إلى تاريخ"],
  event_date: ["event_date", "date", "exam_date", "eventdate", "التاريخ", "تاريخ الامتحان"],
  start_time: ["start_time", "starttime", "from", "وقت البداية", "من الساعة"],
  end_time: ["end_time", "endtime", "to", "وقت النهاية", "إلى الساعة"],
};

const normalize = (value) => String(value ?? "")
  .trim()
  .toLocaleLowerCase()
  .replace(/[أإآ]/g, "ا")
  .replace(/[\s_-]+/g, "");

function getField(row, field) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalize(key), value]));
  return fieldAliases[field]
    .map((alias) => values.get(normalize(alias)))
    .find((value) => value !== undefined && value !== null && String(value).trim() !== "") ?? "";
}

function formatExcelDate(value, spreadsheet) {
  const parts = spreadsheet.SSF.parse_date_code(value);
  if (!parts) return "";
  return [parts.y, String(parts.m).padStart(2, "0"), String(parts.d).padStart(2, "0")].join("-");
}

function parseDate(value, spreadsheet) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }
  if (typeof value === "number") return formatExcelDate(value, spreadsheet);
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

function parseTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round((value - Math.floor(value)) * 1440);
    return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?\s*(am|pm)?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (minutes > 59 || hours > 23 || (!match[3] && hours > 23)) return "";
  if (match[3]) {
    if (hours < 1 || hours > 12) return "";
    if (match[3].toLowerCase() === "pm" && hours < 12) hours += 12;
    if (match[3].toLowerCase() === "am" && hours === 12) hours = 0;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseCsv(text) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const firstLine = normalizedText.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    if (quoted && character === '"' && normalizedText[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && normalizedText[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

function parseEventType(value) {
  const type = normalize(value);
  if (["lecture", "محاضرة", "محاضره"].includes(type)) return "lecture";
  if (["section", "tutorial", "سكشن", "سيكشن"].includes(type)) return "section";
  if (["exam", "امتحان", "اختبار"].includes(type)) return "exam";
  return "";
}

function parseWeekday(value) {
  const day = normalize(value);
  const dayNumbers = new Map([
    ["monday", 1], ["mon", 1], ["الاثنين", 1],
    ["tuesday", 2], ["tue", 2], ["الثلاثاء", 2],
    ["wednesday", 3], ["wed", 3], ["الاربعاء", 3],
    ["thursday", 4], ["thu", 4], ["الخميس", 4],
    ["friday", 5], ["fri", 5], ["الجمعة", 5],
    ["saturday", 6], ["sat", 6], ["السبت", 6],
    ["sunday", 7], ["sun", 7], ["الاحد", 7],
  ]);
  if (/^[1-7]$/.test(day)) return Number(day);
  return dayNumbers.get(day) || 0;
}

function createSourceKey(event) {
  const recurrence = event.event_type === "exam"
    ? event.event_date
    : `${event.weekday}|${event.starts_on}|${event.start_time}`;
  return [event.event_type, event.course_name, event.group_name, recurrence]
    .map((value) => normalize(value))
    .join("|");
}

function parseEventRow(row, spreadsheet, rowNumber) {
  const eventType = parseEventType(getField(row, "type"));
  const title = String(getField(row, "title") || getField(row, "course")).trim();
  const courseName = String(getField(row, "course") || title).trim();
  const groupName = String(getField(row, "group")).trim();
  const locationName = String(getField(row, "location")).trim();
  const startTime = parseTime(getField(row, "start_time"));
  const endTime = parseTime(getField(row, "end_time"));
  const eventId = String(getField(row, "event_id") || "").trim();
  if (!eventType || !title || !courseName || !locationName || !startTime || !endTime || startTime >= endTime) {
    throw new Error(`السطر ${rowNumber}: راجع النوع والعنوان والمادة والمكان والوقت.`);
  }
  if (eventId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
    throw new Error(`السطر ${rowNumber}: معرّف الموعد غير صالح.`);
  }

  const event = {
    event_type: eventType,
    title,
    course_name: courseName,
    group_name: groupName,
    location_name: locationName,
    start_time: startTime,
    end_time: endTime,
    is_active: true,
  };
  if (eventType === "exam") {
    event.event_date = parseDate(getField(row, "event_date"), spreadsheet);
    event.weekday = null;
    event.starts_on = null;
    event.ends_on = null;
    if (!event.event_date) throw new Error(`السطر ${rowNumber}: أضف تاريخ الامتحان بصيغة YYYY-MM-DD.`);
  } else {
    event.weekday = parseWeekday(getField(row, "weekday"));
    event.starts_on = parseDate(getField(row, "starts_on"), spreadsheet);
    event.ends_on = parseDate(getField(row, "ends_on"), spreadsheet);
    event.event_date = null;
    if (!event.weekday || !event.starts_on || !event.ends_on || event.ends_on < event.starts_on) {
      throw new Error(`السطر ${rowNumber}: أضف اليوم وفترة التكرار الأسبوعي الصحيحة.`);
    }
  }
  event.source_key = createSourceKey(event);
  if (eventId) event.id = eventId;
  return event;
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows, filename) {
  const columns = ["event_id", "type", "title", "course", "group", "location", "weekday", "starts_on", "ends_on", "event_date", "start_time", "end_time"];
  const content = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const typeNames = { lecture: "محاضرة", section: "سكشن", exam: "امتحان" };
const weekdayNames = ["", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

export async function initializeCalendarManagement({ client, localFeaturePreview, notify }) {
  const form = document.querySelector("#calendar-import-form");
  if (!form) return;
  const fileInput = document.querySelector("#calendar-import-file-input");
  const templateButton = document.querySelector("#calendar-template-button");
  const exportButton = document.querySelector("#calendar-export-button");
  const status = document.querySelector("#calendar-import-status");
  const list = document.querySelector("#calendar-event-list");
  const count = document.querySelector("#calendar-events-count");
  const previewStorageKey = "course-library-feature-preview-calendar-events";
  let events = [];

  const showStatus = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle("error", isError);
    status.hidden = !text;
  };

  function renderEvents() {
    const ordered = [...events].sort((first, second) =>
      first.event_type.localeCompare(second.event_type) ||
      String(first.starts_on || first.event_date || "").localeCompare(String(second.starts_on || second.event_date || "")) ||
      (first.weekday || 0) - (second.weekday || 0) ||
      first.start_time.localeCompare(second.start_time));
    count.textContent = `${ordered.length} موعد`;
    list.replaceChildren(...ordered.map((event) => {
      const item = document.createElement("li");
      item.className = "calendar-admin-event";
      const details = document.createElement("div");
      details.className = "calendar-admin-event-details";
      const title = document.createElement("strong");
      title.textContent = event.title;
      const type = document.createElement("span");
      type.className = `calendar-admin-event-type is-${event.event_type}`;
      type.textContent = typeNames[event.event_type] || event.event_type;
      const metadata = document.createElement("small");
      const date = event.event_type === "exam"
        ? event.event_date
        : `${weekdayNames[event.weekday]} · ${event.starts_on} – ${event.ends_on}`;
      metadata.textContent = `${event.course_name}${event.group_name ? ` · ${event.group_name}` : ""} · ${date} · ${event.start_time}–${event.end_time} · ${event.location_name}`;
      details.append(title, type, metadata);
      const remove = document.createElement("button");
      remove.className = "danger-button small-button";
      remove.type = "button";
      remove.textContent = "حذف";
      remove.setAttribute("aria-label", `حذف ${event.title}`);
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try {
          if (localFeaturePreview) {
            events = events.filter((item) => item.id !== event.id);
            localStorage.setItem(previewStorageKey, JSON.stringify(events));
          } else {
            const { error } = await client.from("calendar_events").delete().eq("id", event.id);
            if (error) throw error;
            events = events.filter((item) => item.id !== event.id);
          }
          renderEvents();
        } catch (error) {
          notify(error.message || "تعذر حذف الموعد.", true);
          remove.disabled = false;
        }
      });
      item.append(details, remove);
      return item;
    }));
  }

  async function loadEvents() {
    if (localFeaturePreview) {
      try {
        const stored = JSON.parse(localStorage.getItem(previewStorageKey) || "[]");
        events = Array.isArray(stored) ? stored : [];
      } catch {
        events = [];
      }
      renderEvents();
      return;
    }
    const { data, error } = await client.from("calendar_events").select("*");
    if (error) throw error;
    events = data || [];
    renderEvents();
  }

  templateButton.addEventListener("click", () => {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    const nextWednesday = new Date(nextMonday);
    nextWednesday.setDate(nextMonday.getDate() + 2);
    const examDate = new Date(nextMonday);
    examDate.setDate(nextMonday.getDate() + 28);
    const toIsoDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const dates = { monday: toIsoDate(nextMonday), wednesday: toIsoDate(nextWednesday), end: toIsoDate(examDate) };
    downloadCsv([
      { type: "lecture", title: "محاضرة تجريبية", course: "الإدارة المالية", group: "", location: "مدرج 3", weekday: "الاثنين", starts_on: dates.monday, ends_on: dates.end, event_date: "", start_time: "09:00", end_time: "10:30" },
      { type: "section", title: "سكشن تجريبي", course: "الإدارة المالية", group: "مجموعة 1", location: "قاعة 204", weekday: "الأربعاء", starts_on: dates.wednesday, ends_on: dates.end, event_date: "", start_time: "11:00", end_time: "12:00" },
      { type: "exam", title: "امتحان تجريبي", course: "الإدارة المالية", group: "", location: "مدرج 2", weekday: "", starts_on: "", ends_on: "", event_date: dates.end, start_time: "10:00", end_time: "12:00" },
    ], "course-library-calendar-template.csv");
  });

  exportButton.addEventListener("click", () => {
    downloadCsv(events.map((event) => ({
      event_id: event.id,
      type: event.event_type,
      title: event.title,
      course: event.course_name,
      group: event.group_name,
      location: event.location_name,
      weekday: event.weekday ? weekdayNames[event.weekday] : "",
      starts_on: event.starts_on || "",
      ends_on: event.ends_on || "",
      event_date: event.event_date || "",
      start_time: String(event.start_time).slice(0, 5),
      end_time: String(event.end_time).slice(0, 5),
    })), "course-library-calendar.csv");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) return;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus("جارٍ قراءة الجدول...");
    try {
      let spreadsheet = { SSF: { parse_date_code: () => null } };
      let rows;
      if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
        rows = parseCsv(await file.text());
      } else {
        spreadsheet = await import("https://esm.sh/xlsx@0.18.5");
        const workbook = spreadsheet.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("الملف لا يحتوي على ورقة بيانات.");
        rows = spreadsheet.utils.sheet_to_json(sheet, { defval: "", raw: true })
          .filter((row) => Object.values(row).some((value) => String(value).trim()));
      }
      if (!rows.length) throw new Error("لم أجد مواعيد في الورقة الأولى.");
      const parsed = rows.map((row, index) => parseEventRow(row, spreadsheet, index + 2));
      const byIdentity = new Map();
      for (const record of parsed) byIdentity.set(record.id || record.source_key, record);
      const records = [...byIdentity.values()];

      if (localFeaturePreview) {
        const existing = new Map(events.map((record) => [record.id, record]));
        const bySource = new Map(events.map((record) => [record.source_key, record]));
        for (const record of records) {
          const existingRecord = record.id ? existing.get(record.id) : bySource.get(record.source_key);
          const next = { ...existingRecord, ...record, id: record.id || existingRecord?.id || crypto.randomUUID() };
          existing.set(next.id, next);
        }
        events = [...existing.values()];
        localStorage.setItem(previewStorageKey, JSON.stringify(events));
      } else {
        const updates = records.filter((record) => record.id);
        const inserts = records.filter((record) => !record.id);
        for (const { id, ...record } of updates) {
          const { error } = await client.from("calendar_events").update(record).eq("id", id);
          if (error) throw error;
        }
        if (inserts.length) {
          const { error } = await client.from("calendar_events").upsert(inserts, { onConflict: "source_key" });
          if (error) throw error;
        }
        await loadEvents();
      }
      renderEvents();
      fileInput.value = "";
      showStatus(`تم استيراد ${records.length} موعدًا.`);
    } catch (error) {
      showStatus(error.message || "تعذر استيراد الملف.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  await loadEvents();
}
