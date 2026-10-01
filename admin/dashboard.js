import { supabase } from "../services/supabase.js";
import { legacyCategories, legacyFiles } from "../services/legacy-catalog.js";

const client = supabase;
const message = document.querySelector("#dashboard-message");
const toast = document.querySelector("#admin-toast");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const fileForm = document.querySelector("#file-form");
const fileSearch = document.querySelector("#file-search");
const fileTableBody = document.querySelector("#file-table-body");
const fileCount = document.querySelector("#file-count");
const migrationInput = document.querySelector("#legacy-files");
const migrationProgress = document.querySelector("#migration-progress");
const migrationButton = document.querySelector("#migration-button");
let categories = [];
let files = [];
let toastTimeout;

function notify(text, error = false) {
  toast.textContent = text;
  toast.classList.toggle("error", error);
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function assertSuccess({ data, error }) {
  if (error) throw error;
  return data;
}

async function requireAdmin() {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    window.location.replace("./login.html");
    return null;
  }
  const admin = assertSuccess(await client
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle());
  if (!admin) {
    await client.auth.signOut();
    window.location.replace("./login.html");
    return null;
  }
  document.querySelector("#admin-email").textContent = data.user.email;
  return data.user;
}

async function loadData() {
  const [categoryData, fileData] = await Promise.all([
    client.from("categories").select("*").order("position"),
    client.from("files").select("*, categories(id, name_ar, name_en)").order("position").order("created_at", { ascending: false }),
  ]);
  categories = assertSuccess(categoryData);
  files = assertSuccess(fileData);
  renderCategories();
  renderCategoryOptions();
  renderFiles();
}

function renderCategories() {
  categoryList.replaceChildren(
    ...categories.map((category) => {
      const row = document.createElement("div");
      row.className = "category-row";
      const name = document.createElement("strong");
      name.textContent = category.name_ar;
      const status = document.createElement("span");
      status.className = "muted";
      status.textContent = category.is_coming_soon ? "قريبًا" : category.is_active ? "نشط" : "مخفي";
      const edit = document.createElement("button");
      edit.className = "secondary-button small-button";
      edit.textContent = "تعديل";
      edit.addEventListener("click", () => editCategory(category));
      const toggle = document.createElement("button");
      toggle.className = "secondary-button small-button";
      toggle.textContent = category.is_coming_soon
        ? "إزالة قريبًا"
        : "إضافة قريبًا";
      toggle.setAttribute(
        "aria-label",
        `${category.is_coming_soon ? "إزالة علامة قريبًا عن" : "إضافة علامة قريبًا إلى"} ${category.name_ar}`,
      );
      toggle.addEventListener("click", async () => {
        try {
          assertSuccess(await client.from("categories").update({
            is_coming_soon: !category.is_coming_soon,
          }).eq("id", category.id));
          await loadData();
        } catch (error) { notify(error.message, true); }
      });
      const remove = document.createElement("button");
      remove.className = "danger-button small-button";
      remove.textContent = "حذف";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`حذف تصنيف «${category.name_ar}»؟`)) return;
        try {
          assertSuccess(await client.from("categories").delete().eq("id", category.id));
          await loadData();
        } catch (error) {
          notify(`تعذر حذف التصنيف. انقل ملفاته أولًا إن وُجدت. ${error.message}`, true);
        }
      });
      row.append(name, status, edit, toggle, remove);
      return row;
    }),
  );
}

function renderCategoryOptions(selectedId = "") {
  const options = categories.map((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.name_ar}${category.is_coming_soon ? " — قريبًا" : ""}`;
    option.selected = category.id === selectedId;
    return option;
  });
  fileForm.elements.category_id.replaceChildren(...options);
}

function renderFiles() {
  const query = fileSearch.value.trim().toLocaleLowerCase();
  const visibleFiles = files.filter((file) =>
    `${file.name} ${file.description} ${file.categories?.name_ar || ""}`
      .toLocaleLowerCase()
      .includes(query),
  );
  fileCount.textContent = `${visibleFiles.length} من ${files.length} ملف`;
  fileTableBody.replaceChildren(...visibleFiles.map((file, index) => {
    const row = document.createElement("tr");
    const cells = [
      file.name,
      file.categories?.name_ar || "—",
      new Date(file.created_at).toLocaleDateString("ar"),
      String(file.downloads),
      file.is_published ? "منشور" : "مخفي",
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const actions = document.createElement("td");
    actions.className = "table-actions";
    const edit = document.createElement("button");
    edit.className = "secondary-button small-button";
    edit.textContent = "تعديل";
    edit.addEventListener("click", () => editFile(file));
    const toggle = document.createElement("button");
    toggle.className = "secondary-button small-button";
    toggle.textContent = file.is_published ? "إخفاء" : "إظهار";
    toggle.addEventListener("click", async () => {
      try {
        assertSuccess(await client.from("files").update({ is_published: !file.is_published }).eq("id", file.id));
        await loadData();
      } catch (error) { notify(error.message, true); }
    });
    const up = document.createElement("button");
    up.className = "secondary-button small-button";
    up.textContent = "↑";
    up.setAttribute("aria-label", `تحريك ${file.name} للأعلى`);
    up.disabled = index === 0;
    up.addEventListener("click", () => moveFile(file, -1));
    const down = document.createElement("button");
    down.className = "secondary-button small-button";
    down.textContent = "↓";
    down.setAttribute("aria-label", `تحريك ${file.name} للأسفل`);
    down.disabled = index === visibleFiles.length - 1;
    down.addEventListener("click", () => moveFile(file, 1));
    const remove = document.createElement("button");
    remove.className = "danger-button small-button";
    remove.textContent = "حذف";
    remove.addEventListener("click", () => deleteFile(file));
    actions.append(edit, toggle, up, down, remove);
    row.append(actions);
    return row;
  }));
}

async function moveFile(file, direction) {
  const ordered = [...files].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.id === file.id);
  const next = ordered[index + direction];
  if (!next) return;
  try {
    assertSuccess(await client.from("files").update({ position: next.position }).eq("id", file.id));
    assertSuccess(await client.from("files").update({ position: file.position }).eq("id", next.id));
    await loadData();
  } catch (error) { notify(error.message, true); }
}

async function uploadAsset(file, prefix) {
  const path = `${prefix}/${crypto.randomUUID()}${file.name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() || ""}`;
  assertSuccess(await client.storage.from("library-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  }));
  return path;
}

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(categoryForm);
  try {
    assertSuccess(await client.from("categories").insert({
      name_ar: values.get("name_ar").trim(),
      name_en: values.get("name_en").trim(),
      is_coming_soon: values.has("is_coming_soon"),
      position: categories.length,
    }));
    categoryForm.reset();
    await loadData();
    notify("تمت إضافة التصنيف.");
  } catch (error) { notify(error.message, true); }
});

function editCategory(category) {
  const nameAr = window.prompt("اسم التصنيف بالعربية:", category.name_ar);
  if (nameAr === null) return;
  const nameEn = window.prompt("الاسم بالإنجليزية:", category.name_en || "");
  if (nameEn === null) return;
  void (async () => {
    try {
      assertSuccess(await client.from("categories").update({
        name_ar: nameAr.trim(),
        name_en: nameEn.trim(),
      }).eq("id", category.id));
      await loadData();
      notify("تم تحديث التصنيف.");
    } catch (error) { notify(error.message, true); }
  })();
}

function editFile(file) {
  fileForm.elements.id.value = file.id;
  fileForm.elements.name.value = file.name;
  fileForm.elements.description.value = file.description || "";
  fileForm.elements.position.value = file.position;
  fileForm.elements.is_published.checked = file.is_published;
  renderCategoryOptions(file.category_id);
  document.querySelector("#file-form-heading").textContent = "تعديل الملف";
  document.querySelector("#cancel-edit").hidden = false;
  fileForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetFileForm() {
  fileForm.reset();
  fileForm.elements.id.value = "";
  fileForm.elements.position.value = "0";
  fileForm.elements.is_published.checked = true;
  document.querySelector("#file-form-heading").textContent = "إضافة ملف";
  document.querySelector("#cancel-edit").hidden = true;
  renderCategoryOptions();
}

document.querySelector("#cancel-edit").addEventListener("click", resetFileForm);

fileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = fileForm.querySelector('[type="submit"]');
  submit.disabled = true;
  const values = new FormData(fileForm);
  const id = values.get("id");
  const existing = files.find((file) => file.id === id);
  let uploadedPaths = [];
  let saved = false;
  let cleanupWarning = "";
  try {
    const newFile = values.get("file");
    const newCover = values.get("cover");
    if (!existing && (!newFile || newFile.size === 0)) {
      throw new Error("اختر ملفًا للرفع.");
    }
    let objectPath = existing?.object_path;
    let coverPath = existing?.cover_path;
    let mimeType = existing?.mime_type;
    let sizeBytes = existing?.size_bytes;
    if (newFile?.size) {
      objectPath = await uploadAsset(newFile, "documents");
      uploadedPaths.push(objectPath);
      mimeType = newFile.type || "application/octet-stream";
      sizeBytes = newFile.size;
    }
    if (newCover?.size) {
      coverPath = await uploadAsset(newCover, "covers");
      uploadedPaths.push(coverPath);
    }
    const record = {
      name: values.get("name").trim(),
      description: values.get("description").trim(),
      category_id: values.get("category_id"),
      object_path: objectPath,
      cover_path: coverPath || null,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      position: Number(values.get("position")) || 0,
      is_published: values.has("is_published"),
    };
    const result = existing
      ? await client.from("files").update(record).eq("id", existing.id)
      : await client.from("files").insert(record);
    assertSuccess(result);
    saved = true;
    const obsoletePaths = existing
      ? [
          existing.object_path !== objectPath ? existing.object_path : null,
          existing.cover_path !== coverPath ? existing.cover_path : null,
        ].filter(Boolean)
      : [];
    if (obsoletePaths.length) {
      const { error } = await client.storage.from("library-files").remove(obsoletePaths);
      if (error) cleanupWarning = `تم حفظ الملف لكن تعذر حذف النسخة القديمة: ${error.message}`;
    }
    resetFileForm();
    await loadData();
    notify(cleanupWarning || "تم حفظ الملف.", Boolean(cleanupWarning));
  } catch (error) {
    if (!saved && uploadedPaths.length) {
      const { error: cleanupError } = await client.storage.from("library-files").remove(uploadedPaths);
      if (cleanupError) {
        error.message = `${error.message} وتعذر تنظيف الملفات المرفوعة مؤقتًا: ${cleanupError.message}`;
      }
    }
    if (saved) {
      resetFileForm();
      await loadData();
    }
    notify(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

async function deleteFile(file) {
  if (!window.confirm(`حذف «${file.name}» نهائيًا؟`)) return;
  try {
    assertSuccess(await client.from("files").delete().eq("id", file.id));
    const paths = [file.object_path, file.cover_path].filter(Boolean);
    const { error } = await client.storage.from("library-files").remove(paths);
    if (error) throw error;
    await loadData();
    notify("تم حذف الملف.");
  } catch (error) { notify(error.message, true); }
}

fileSearch.addEventListener("input", renderFiles);
document.querySelector("#logout-button").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();
  if (error) throw error;
  window.location.replace("./login.html");
});

migrationButton.addEventListener("click", async () => {
  const selected = new Map([...migrationInput.files].map((file) => [file.name, file]));
  const missing = legacyFiles.filter((file) => !selected.has(file.name));
  if (missing.length) {
    notify(`المجلد المختار لا يحتوي على كل الملفات. الملف الناقص: ${missing[0].name}`, true);
    return;
  }
  migrationButton.disabled = true;
  migrationProgress.hidden = false;
  migrationProgress.max = legacyFiles.length;
  migrationProgress.value = 0;
  try {
    const categoryIds = new Map(categories.map((category) => [category.name_ar, category.id]));
    for (const [index, legacy] of legacyFiles.entries()) {
      const file = selected.get(legacy.name);
      const existing = files.find((row) => row.name === legacy.name);
      let path = existing?.object_path;
      if (!path) path = await uploadAsset(file, "documents");
      if (existing) {
        assertSuccess(await client.from("files").update({
          category_id: categoryIds.get(legacy.category),
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
        }).eq("id", existing.id));
      } else {
        assertSuccess(await client.from("files").insert({
          name: legacy.name.replace(/\.pdf$/i, ""),
          description: "",
          category_id: categoryIds.get(legacy.category),
          object_path: path,
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
          is_published: true,
          position: index,
        }));
      }
      migrationProgress.value = index + 1;
    }
    await loadData();
    notify("اكتمل ترحيل الملفات الأربعة عشر.");
  } catch (error) { notify(error.message, true); }
  finally { migrationButton.disabled = false; }
});

document.querySelector("#logout-button").disabled = true;
if (!client) {
  message.textContent = "أكمل إعداد رابط Supabase ومفتاح anon في ملف config.js.";
  message.hidden = false;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = true;
  });
} else {
  const user = await requireAdmin();
  if (user) {
    document.querySelector("#logout-button").disabled = false;
    try {
      await loadData();
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
    }
  }
}
