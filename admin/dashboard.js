import { supabase } from "../services/supabase.js";
import { legacyCategories, legacyFiles } from "../services/legacy-catalog.js";
import { supabaseConfig } from "../config.js";

const client = supabase;
const message = document.querySelector("#dashboard-message");
const toast = document.querySelector("#admin-toast");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const categoryCount = document.querySelector("#category-count");
const fileForm = document.querySelector("#file-form");
const fileSearch = document.querySelector("#file-search");
const fileTableBody = document.querySelector("#file-table-body");
const fileCount = document.querySelector("#file-count");
const uploadInput = document.querySelector("#file-input");
const fileSelection = document.querySelector("#file-selection");
const coverInput = fileForm.elements.cover;
const coverFileName = document.querySelector("#cover-file-name");
const uploadProgress = document.querySelector("#upload-progress");
const uploadStatus = document.querySelector("#upload-status");
const migrationInput = document.querySelector("#legacy-files");
const migrationProgress = document.querySelector("#migration-progress");
const migrationButton = document.querySelector("#migration-button");
let categories = [];
let files = [];
let toastTimeout;
let tusClientPromise;

const maxFileSize = 1024 ** 3;
const maxCoverSize = 50 * 1024 ** 2;
const resumableUploadThreshold = 6 * 1024 ** 2;

const uploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const mimeTypesByExtension = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

function getUploadMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase();
  return mimeTypesByExtension[extension] || "application/octet-stream";
}

function notify(text, error = false) {
  toast.textContent = text;
  toast.classList.toggle("error", error);
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function formatFileSize(bytes) {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
}

function updateFileSelection() {
  const selected = [...uploadInput.files];
  fileSelection.replaceChildren(...selected.map((file, index) => {
    const item = document.createElement("li");
    const detail = document.createElement("span");
    detail.className = "file-selection-detail";
    const name = document.createElement("strong");
    name.textContent = file.name;
    const size = document.createElement("small");
    size.textContent = formatFileSize(file.size);
    detail.append(name, size);
    const remove = document.createElement("button");
    remove.className = "remove-selected-file";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `إزالة ${file.name}`);
    remove.addEventListener("click", () => {
      const transfer = new DataTransfer();
      [...uploadInput.files].forEach((selectedFile, selectedIndex) => {
        if (selectedIndex !== index) transfer.items.add(selectedFile);
      });
      uploadInput.files = transfer.files;
      updateFileSelection();
    });
    item.append(detail, remove);
    return item;
  }));

  coverInput.disabled = selected.length > 1;
  if (selected.length > 1 && coverInput.files.length) {
    coverInput.value = "";
    coverFileName.textContent = "تُستخدم مع ملف واحد فقط";
  }
  if (selected.length === 1 && !fileForm.elements.name.value.trim()) {
    fileForm.elements.name.value = selected[0].name.replace(/\.[^.]+$/, "");
  }
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
  categoryCount.textContent = String(categories.length);
  categoryList.replaceChildren(
    ...categories.map((category, index) => {
      const row = document.createElement("article");
      row.className = "category-row";
      const info = document.createElement("div");
      info.className = "category-info";
      const name = document.createElement("strong");
      name.className = "category-name";
      name.textContent = category.name_ar;
      const status = document.createElement("span");
      status.className = `category-status${category.is_coming_soon ? " is-coming-soon" : ""}`;
      status.textContent = category.is_coming_soon ? "قريبًا" : category.is_active ? "نشط" : "مخفي";
      info.append(name, status);
      const actions = document.createElement("div");
      actions.className = "category-actions";
      const edit = document.createElement("button");
      edit.className = "secondary-button small-button";
      edit.textContent = "تعديل";
      edit.addEventListener("click", () => editCategory(category));
      const up = document.createElement("button");
      up.className = "secondary-button small-button order-button";
      up.textContent = "↑";
      up.setAttribute("aria-label", `تحريك تصنيف ${category.name_ar} للأعلى`);
      up.disabled = index === 0;
      up.addEventListener("click", () => moveCategory(category, -1));
      const down = document.createElement("button");
      down.className = "secondary-button small-button order-button";
      down.textContent = "↓";
      down.setAttribute("aria-label", `تحريك تصنيف ${category.name_ar} للأسفل`);
      down.disabled = index === categories.length - 1;
      down.addEventListener("click", () => moveCategory(category, 1));
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
      actions.append(up, down, edit, toggle, remove);
      row.append(info, actions);
      return row;
    }),
  );
}

async function moveCategory(category, direction) {
  const ordered = [...categories].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.id === category.id);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ordered.length) return;
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  try {
    for (const [position, item] of ordered.entries()) {
      assertSuccess(await client.from("categories").update({ position }).eq("id", item.id));
    }
    await loadData();
    notify("تم تحديث ترتيب التصنيفات.");
  } catch (error) {
    notify(error.message, true);
  }
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
  const orderedFiles = [...files].sort((a, b) =>
    a.position - b.position || new Date(b.created_at) - new Date(a.created_at),
  );
  const visibleFiles = orderedFiles.filter((file) =>
    `${file.name} ${file.description} ${file.categories?.name_ar || ""}`
      .toLocaleLowerCase()
      .includes(query),
  );
  fileCount.textContent = `${visibleFiles.length} من ${files.length} ملف`;
  fileTableBody.replaceChildren(...visibleFiles.map((file) => {
    const row = document.createElement("tr");
    const cells = [
      ["الملف", file.name],
      ["التصنيف", file.categories?.name_ar || "—"],
      ["تاريخ الإضافة", new Date(file.created_at).toLocaleDateString("ar")],
      ["التنزيلات", String(file.downloads)],
      ["الحالة", file.is_published ? "منشور" : "مخفي"],
    ];
    for (const [label, value] of cells) {
      const cell = document.createElement("td");
      cell.dataset.label = label;
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
    const index = orderedFiles.findIndex((item) => item.id === file.id);
    up.disabled = index === 0;
    up.addEventListener("click", () => moveFile(file, -1));
    const down = document.createElement("button");
    down.className = "secondary-button small-button";
    down.textContent = "↓";
    down.setAttribute("aria-label", `تحريك ${file.name} للأسفل`);
    down.disabled = index === orderedFiles.length - 1;
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
  const ordered = [...files].sort((a, b) =>
    a.position - b.position || new Date(b.created_at) - new Date(a.created_at),
  );
  const index = ordered.findIndex((item) => item.id === file.id);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ordered.length) return;
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  try {
    for (const [position, item] of ordered.entries()) {
      assertSuccess(await client.from("files").update({ position }).eq("id", item.id));
    }
    await loadData();
    notify("تم تحديث ترتيب الملفات.");
  } catch (error) { notify(error.message, true); }
}

async function uploadAsset(file, prefix, onProgress = () => {}) {
  const extension = file.name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() || "";
  const path = `${prefix}/${crypto.randomUUID()}${extension}`;
  const contentType = getUploadMimeType(file);
  if (file.size > resumableUploadThreshold) {
    tusClientPromise ||= import("https://esm.sh/tus-js-client@4");
    const { Upload } = await tusClientPromise;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("انتهت جلسة الإدارة. سجّل الدخول مجددًا ثم أعد الرفع.");
    const endpoint = new URL("/storage/v1/upload/resumable", supabaseConfig.url).href;
    await new Promise((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint,
        chunkSize: resumableUploadThreshold,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          apikey: supabaseConfig.anonKey,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: "library-files",
          objectName: path,
          contentType,
          cacheControl: "3600",
        },
        onError: reject,
        onProgress: (uploadedBytes) => onProgress(uploadedBytes),
        onSuccess: resolve,
      });
      upload.start();
    });
    return path;
  }

  assertSuccess(await client.storage.from("library-files").upload(path, file, {
    contentType,
    upsert: false,
  }));
  onProgress(file.size);
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
  resetFileForm();
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
  coverInput.disabled = false;
  coverFileName.textContent = "تُستخدم مع ملف واحد فقط";
  uploadProgress.hidden = true;
  uploadStatus.hidden = true;
  document.querySelector("#file-form-heading").textContent = "إضافة ملف";
  document.querySelector("#cancel-edit").hidden = true;
  renderCategoryOptions();
  updateFileSelection();
}

document.querySelector("#cancel-edit").addEventListener("click", resetFileForm);
uploadInput.addEventListener("change", updateFileSelection);
coverInput.addEventListener("change", () => {
  coverFileName.textContent = coverInput.files[0]?.name || "تُستخدم مع ملف واحد فقط";
});

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
    const newFiles = [...uploadInput.files];
    const newCover = coverInput.files[0];
    if (!existing && newFiles.length === 0) {
      throw new Error("اختر ملفًا واحدًا على الأقل للرفع.");
    }
    if (existing && newFiles.length > 1) {
      throw new Error("اختر ملفًا واحدًا فقط عند تعديل ملف موجود.");
    }
    const oversizedFile = newFiles.find((file) => file.size > maxFileSize);
    if (oversizedFile) {
      throw new Error(`حجم «${oversizedFile.name}» أكبر من الحد المسموح (1 GB).`);
    }
    const unsupportedFile = newFiles.find((file) => !uploadMimeTypes.has(getUploadMimeType(file)));
    if (unsupportedFile) {
      throw new Error(`نوع الملف «${unsupportedFile.name}» غير مدعوم.`);
    }
    if (newCover?.size > maxCoverSize) {
      throw new Error("حجم صورة الغلاف أكبر من الحد المسموح (50 MB).");
    }
    if (newCover && !getUploadMimeType(newCover).startsWith("image/")) {
      throw new Error("اختر صورة صحيحة للغلاف.");
    }
    let objectPath = existing?.object_path;
    let coverPath = existing?.cover_path;
    let mimeType = existing?.mime_type;
    let sizeBytes = existing?.size_bytes;
    const uploadedFilePaths = [];
    const uploads = [...newFiles, ...(newCover?.size ? [newCover] : [])];
    const uploadSize = uploads.reduce((total, file) => total + file.size, 0);
    let completedBytes = 0;
    uploadProgress.hidden = uploads.length === 0;
    uploadProgress.max = Math.max(uploadSize, 1);
    uploadProgress.value = 0;
    uploadStatus.hidden = uploads.length === 0;
    if (uploads.length) uploadStatus.textContent = `جارٍ رفع 0 من ${uploads.length}...`;
    for (const [index, newFile] of newFiles.entries()) {
      uploadStatus.textContent = `جارٍ رفع ${newFile.name}...`;
      const path = await uploadAsset(newFile, "documents", (uploadedBytes) => {
        uploadProgress.value = completedBytes + uploadedBytes;
        const percent = newFile.size
          ? Math.floor((uploadedBytes / newFile.size) * 100)
          : 100;
        uploadStatus.textContent = `جارٍ رفع ${newFile.name} · ${percent}%`;
      });
      uploadedFilePaths.push(path);
      uploadedPaths.push(path);
      completedBytes += newFile.size;
      uploadProgress.value = completedBytes;
      if (index === 0) {
        objectPath = path;
        mimeType = getUploadMimeType(newFile);
        sizeBytes = newFile.size;
      }
    }
    if (newCover?.size) {
      uploadStatus.textContent = `جارٍ رفع ${newCover.name}...`;
      coverPath = await uploadAsset(newCover, "covers", (uploadedBytes) => {
        uploadProgress.value = completedBytes + uploadedBytes;
        const percent = Math.floor((uploadedBytes / newCover.size) * 100);
        uploadStatus.textContent = `جارٍ رفع صورة الغلاف · ${percent}%`;
      });
      uploadedPaths.push(coverPath);
      completedBytes += newCover.size;
      uploadProgress.value = completedBytes;
    }
    const baseRecord = {
      description: values.get("description").trim(),
      category_id: values.get("category_id"),
      position: Number(values.get("position")) || 0,
      is_published: values.has("is_published"),
    };
    const result = existing
      ? await client.from("files").update({
          ...baseRecord,
          name: values.get("name").trim() || existing.name,
          object_path: objectPath,
          cover_path: coverPath || null,
          mime_type: mimeType,
          size_bytes: sizeBytes,
        }).eq("id", existing.id)
      : await client.from("files").insert(newFiles.map((file, index) => ({
          ...baseRecord,
          name: newFiles.length === 1 && values.get("name").trim()
            ? values.get("name").trim()
            : file.name.replace(/\.[^.]+$/, ""),
          object_path: uploadedFilePaths[index],
          cover_path: newFiles.length === 1 ? coverPath || null : null,
          mime_type: getUploadMimeType(file),
          size_bytes: file.size,
          position: baseRecord.position + index,
        })));
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
    const successMessage = existing
      ? "تم تحديث الملف."
      : newFiles.length === 1
        ? "تمت إضافة الملف."
        : `تمت إضافة ${newFiles.length} ملفات.`;
    notify(cleanupWarning || successMessage, Boolean(cleanupWarning));
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
    uploadProgress.hidden = true;
    uploadStatus.hidden = true;
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
          mime_type: getUploadMimeType(file),
          size_bytes: file.size,
        }).eq("id", existing.id));
      } else {
        assertSuccess(await client.from("files").insert({
          name: legacy.name.replace(/\.pdf$/i, ""),
          description: "",
          category_id: categoryIds.get(legacy.category),
          object_path: path,
          mime_type: getUploadMimeType(file),
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

    updateFileSelection();
  }
}
