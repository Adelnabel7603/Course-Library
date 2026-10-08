import { legacyCategories, legacyFiles } from "../services/legacy-catalog.js";
import { supabaseConfig } from "../config.js";

const localFeaturePreview =
  window.location.protocol === "file:" &&
  new URLSearchParams(window.location.search).get("preview") === "features";
const { supabase: client } = localFeaturePreview
  ? { supabase: null }
  : await import("../services/supabase.js");
const message = document.querySelector("#dashboard-message");
const toast = document.querySelector("#admin-toast");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const categoryCount = document.querySelector("#category-count");
const fileForm = document.querySelector("#file-form");
const notificationForm = document.querySelector("#notification-form");
const adminNotificationList = document.querySelector("#admin-notification-list");
const notificationImageInput = document.querySelector("#notification-image");
const notificationImagePreviewWrap = document.querySelector("#notification-image-preview-wrap");
const notificationImagePreview = document.querySelector("#notification-image-preview");
const notificationImageName = document.querySelector("#notification-image-name");
const notificationAttachmentsInput = document.querySelector("#notification-attachments");
const notificationAttachmentSelection = document.querySelector("#notification-attachment-selection");
const notificationExistingAttachments = document.querySelector("#notification-existing-attachments");
const notificationRemoveImage = document.querySelector("#notification-remove-image");
const notificationUploadProgress = document.querySelector("#notification-upload-progress");
const notificationUploadStatus = document.querySelector("#notification-upload-status");
const fileSearch = document.querySelector("#file-search");
const fileTableBody = document.querySelector("#file-table-body");
const fileCount = document.querySelector("#file-count");
const uploadInput = document.querySelector("#file-input");
const fileSelection = document.querySelector("#file-selection");
const uploadEditors = document.querySelector("#upload-editors");
const coverInput = fileForm.elements.cover;
const coverFileName = document.querySelector("#cover-file-name");
const uploadProgress = document.querySelector("#upload-progress");
const uploadStatus = document.querySelector("#upload-status");
const migrationInput = document.querySelector("#legacy-files");
const migrationProgress = document.querySelector("#migration-progress");
const migrationButton = document.querySelector("#migration-button");
let categories = [];
let files = [];
let notifications = [];
let toastTimeout;
let tusClientPromise;
let notificationPreviewUrl;
let editingNotification = null;
let removeCurrentNotificationImage = false;
const removedNotificationAttachmentPaths = new Set();
const uploadDrafts = new Map();

const maxFileSize = 1024 ** 3;
const maxCoverSize = 50 * 1024 ** 2;
const maxNotificationImageSize = 10 * 1024 ** 2;
const resumableUploadThreshold = 6 * 1024 ** 2;
const notificationImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const uploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
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
  ".zip": "application/zip",
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

function updateNotificationAttachmentSelection() {
  notificationAttachmentSelection.replaceChildren(
    ...[...notificationAttachmentsInput.files].map((file, index) => {
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
        [...notificationAttachmentsInput.files].forEach((selectedFile, selectedIndex) => {
          if (selectedIndex !== index) transfer.items.add(selectedFile);
        });
        notificationAttachmentsInput.files = transfer.files;
        updateNotificationAttachmentSelection();
      });
      item.append(detail, remove);
      return item;
    }),
  );
}

function renderExistingNotificationAttachments() {
  const attachments = editingNotification?.attachments || [];
  notificationExistingAttachments.replaceChildren(...attachments
    .filter((attachment) => !removedNotificationAttachmentPaths.has(attachment.object_path))
    .map((attachment) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${attachment.name} · ${formatFileSize(attachment.size_bytes || 0)}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-selected-file";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `إزالة ${attachment.name}`);
      remove.addEventListener("click", () => {
        removedNotificationAttachmentPaths.add(attachment.object_path);
        renderExistingNotificationAttachments();
      });
      item.append(name, remove);
      return item;
    }));
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
  const isBatchUpload = selected.length > 0 && !fileForm.elements.id.value;
  for (const file of selected) {
    if (!uploadDrafts.has(file)) {
      uploadDrafts.set(file, {
        name: selected.length === 1 && fileForm.elements.name.value.trim()
          ? fileForm.elements.name.value.trim()
          : file.name.replace(/\.[^.]+$/, ""),
        description: fileForm.elements.description.value.trim(),
        categoryId: fileForm.elements.category_id.value,
        isPublished: fileForm.elements.is_published.checked,
        cover: null,
      });
    }
  }
  for (const file of uploadDrafts.keys()) {
    if (!selected.includes(file)) uploadDrafts.delete(file);
  }
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
  document.querySelectorAll(".file-default-field, .cover-picker").forEach((field) => {
    field.hidden = isBatchUpload;
  });
  uploadEditors.hidden = !isBatchUpload;
  uploadEditors.replaceChildren(...(isBatchUpload
    ? selected.map((file, index) => createUploadEditor(file, index))
    : []));
}

function assertSuccess({ data, error }) {
  if (error) throw error;
  return data;
}

async function sendPushAlerts(rows) {
  if (!rows.length) return "";
  if (!supabaseConfig.vapidPublicKey) {
    return "تم حفظ الإشعار في الجرس، لكن تنبيهات الأجهزة لم تُفعّل بعد. أضف مفتاح VAPID العام وانشر دوال Supabase.";
  }
  const results = await Promise.allSettled(rows.map(({ id }) =>
    client.functions.invoke("send-push-notification", {
      body: { notificationId: id },
    }),
  ));
  const errors = new Set();
  for (const result of results) {
    if (result.status === "rejected") {
      errors.add(result.reason?.message || "تعذر إرسال تنبيه الجهاز.");
    } else if (result.value.error) {
      errors.add(result.value.error.message || "تعذر إرسال تنبيه الجهاز.");
    } else if (result.value.data?.failed) {
      errors.add(`تعذر إرسال التنبيه إلى ${result.value.data.failed} جهاز.`);
    }
  }
  return errors.size
    ? `تعذر إرسال تنبيه الأجهزة (${[...errors].join("؛ ")}). الإشعار محفوظ في الجرس.`
    : "";
}

async function publishFileNotifications(fileRows) {
  const notificationRows = assertSuccess(await client.from("notifications")
    .insert(fileRows.filter((file) => file.is_published).map((file) => ({
      title: `ملف جديد: ${file.name}`,
      body: file.description || `أُضيف إلى تصنيف ${categories.find(
        (category) => category.id === file.category_id,
      )?.name_ar || ""}.`,
      type: "file",
      file_id: file.id,
    })))
    .select("id"));
  return sendPushAlerts(notificationRows);
}

function renderAdminNotifications() {
  adminNotificationList.replaceChildren(...notifications.map((item) => {
    const row = document.createElement("li");
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const body = document.createElement("p");
    body.textContent = item.body;
    const imageUrl = item.image_url || (
      item.image_path
        ? client.storage.from("notification-images").getPublicUrl(item.image_path).data.publicUrl
        : ""
    );
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title;
      image.loading = "lazy";
      details.append(image);
    }
    if (item.attachments?.length) {
      const attachmentList = document.createElement("ul");
      attachmentList.className = "admin-notification-attachments";
      for (const attachment of item.attachments) {
        const attachmentItem = document.createElement("li");
        attachmentItem.textContent =
          `${attachment.name} · ${formatFileSize(attachment.size_bytes || 0)}`;
        attachmentList.append(attachmentItem);
      }
      details.append(attachmentList);
    }
    const created = document.createElement("time");
    created.dateTime = item.created_at;
    created.textContent = new Date(item.created_at).toLocaleString("ar");
    details.append(title, body, created);
    const edit = document.createElement("button");
    edit.className = "secondary-button small-button";
    edit.type = "button";
    edit.textContent = "تعديل";
    edit.addEventListener("click", () => editNotification(item));
    row.append(details, edit);
    return row;
  }));
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
  if (localFeaturePreview) {
    const saved = localStorage.getItem("course-library-feature-preview");
    categories = saved
      ? JSON.parse(saved)
      : legacyCategories.map((category, index) => ({
          ...category,
          id: `local-category-${index}`,
          parent_id: null,
          is_active: true,
        }));
    const savedFiles = localStorage.getItem("course-library-feature-preview-files");
    files = savedFiles
      ? JSON.parse(savedFiles).map((file) => ({
          ...file,
          categories: categories.find((category) => category.id === file.category_id),
        }))
      : [];
    const savedNotifications = localStorage.getItem("course-library-feature-preview-notifications");
    notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
    renderCategories();
    renderParentCategoryOptions();
    renderCategoryOptions();
    renderFiles();
    renderAdminNotifications();
    return;
  }
  const [categoryData, fileData, notificationData] = await Promise.all([
    client.from("categories").select("*").order("position"),
    client.from("files").select("*, categories(id, name_ar, name_en, parent_id)").order("position").order("created_at", { ascending: false }),
    client.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  categories = assertSuccess(categoryData);
  files = assertSuccess(fileData);
  notifications = assertSuccess(notificationData);
  renderCategories();
  renderParentCategoryOptions();
  renderCategoryOptions();
  renderFiles();
  renderAdminNotifications();
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
      name.textContent = categoryPath(category);
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
      actions.hidden = localFeaturePreview;
      row.append(info, actions);
      return row;
    }),
  );
}

function categoryPath(category) {
  const parts = [category.name_ar];
  let parent = categories.find((item) => item.id === category.parent_id);
  while (parent) {
    parts.unshift(parent.name_ar);
    parent = categories.find((item) => item.id === parent.parent_id);
  }
  return parts.join(" / ");
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
    if (imagePath && !notificationSaved) {
      const { error: cleanupError } = await client.storage
        .from("notification-images")
        .remove([imagePath]);
      if (cleanupError) console.error("Could not remove the unused notification image.", cleanupError);
    }
    notify(error.message, true);
  }
}

function renderCategoryOptions(selectedId = "") {
  const options = categories.map((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${categoryPath(category)}${category.is_coming_soon ? " — قريبًا" : ""}`;
    option.selected = category.id === selectedId;
    return option;
  });
  fileForm.elements.category_id.replaceChildren(...options);
}

function renderParentCategoryOptions() {
  const options = [new Option("بدون تصنيف أب (رئيسي)", "")];
  for (const category of categories) {
    options.push(new Option(categoryPath(category), category.id));
  }
  categoryForm.elements.parent_id.replaceChildren(...options);
}

function createUploadEditor(file, index) {
  const draft = uploadDrafts.get(file);
  const editor = document.createElement("fieldset");
  editor.className = "upload-editor";
  const legend = document.createElement("legend");
  legend.textContent = `تفاصيل ${file.type === "text/plain" ? "النص" : `الملف ${index + 1}`}`;

  const nameField = document.createElement("label");
  nameField.textContent = "الاسم";
  const nameInput = document.createElement("input");
  nameInput.maxLength = 180;
  nameInput.required = true;
  nameInput.value = draft.name;
  nameInput.addEventListener("input", () => { draft.name = nameInput.value; });
  nameField.append(nameInput);

  const categoryField = document.createElement("label");
  categoryField.textContent = "التصنيف";
  const categorySelect = document.createElement("select");
  categorySelect.required = true;
  categorySelect.replaceChildren(...categories.map((category) => {
    const option = new Option(categoryPath(category), category.id);
    option.selected = category.id === draft.categoryId;
    return option;
  }));
  categorySelect.addEventListener("change", () => { draft.categoryId = categorySelect.value; });
  categoryField.append(categorySelect);

  const descriptionField = document.createElement("label");
  descriptionField.className = "wide";
  descriptionField.textContent = file.type === "text/plain" ? "ملخص التعليمات" : "الوصف";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.rows = 2;
  descriptionInput.value = draft.description;
  descriptionInput.addEventListener("input", () => { draft.description = descriptionInput.value; });
  descriptionField.append(descriptionInput);

  const coverField = document.createElement("label");
  coverField.className = "upload-editor-cover";
  coverField.textContent = draft.cover?.name || "صورة غلاف لهذا الملف (اختياري)";
  const coverInputForFile = document.createElement("input");
  coverInputForFile.type = "file";
  coverInputForFile.accept = "image/png,image/jpeg,image/webp,image/gif";
  coverInputForFile.addEventListener("change", () => {
    draft.cover = coverInputForFile.files[0] || null;
    coverField.firstChild.textContent =
      draft.cover?.name || "صورة غلاف لهذا الملف (اختياري)";
  });
  coverField.append(coverInputForFile);

  const publishedField = document.createElement("label");
  publishedField.className = "check-label";
  const publishedInput = document.createElement("input");
  publishedInput.type = "checkbox";
  publishedInput.checked = draft.isPublished;
  publishedInput.addEventListener("change", () => {
    draft.isPublished = publishedInput.checked;
  });
  publishedField.append(publishedInput, document.createTextNode(" ظاهر للزوار"));

  editor.append(legend, nameField, categoryField, descriptionField, coverField, publishedField);
  return editor;
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
      ["التصنيف", file.categories
        ? categoryPath(categories.find((category) => category.id === file.category_id) || file.categories)
        : "—"],
      ["تاريخ الإضافة", new Date(file.created_at).toLocaleDateString("ar")],
      ["التنزيلات", String(file.downloads)],
      ["الحالة", `${file.is_published ? "منشور" : "مخفي"}${file.is_new ? " · جديد" : ""}`],
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
        if (localFeaturePreview) {
          const isPublishing = !file.is_published;
          files = files.map((item) => item.id === file.id
            ? {
                ...item,
                is_published: !item.is_published,
                is_new: isPublishing,
              }
            : item);
          if (isPublishing) {
            files = files.map((item) => item.id === file.id
              ? item
              : { ...item, is_new: false });
            notifications = [{
              id: crypto.randomUUID(),
              title: `ملف جديد: ${file.name}`,
              body: file.description || "",
              type: "file",
              file_id: file.id,
              created_at: new Date().toISOString(),
            }, ...notifications];
            localStorage.setItem(
              "course-library-feature-preview-notifications",
              JSON.stringify(notifications),
            );
          }
          localStorage.setItem("course-library-feature-preview-files", JSON.stringify(files));
          await loadData();
          return;
        }
        const isPublishing = !file.is_published;
        if (isPublishing) {
          assertSuccess(await client.from("files")
            .update({ is_new: false })
            .eq("is_new", true));
        }
        const publishedFile = assertSuccess(await client.from("files")
          .update({
            is_published: isPublishing,
            is_new: isPublishing,
          })
          .eq("id", file.id)
          .select("id, name, description, category_id, is_published")
          .single());
        let notificationWarning = "";
        if (publishedFile.is_published) {
          try {
            notificationWarning = await publishFileNotifications([publishedFile]);
          } catch (error) {
            notificationWarning = `تعذر نشر إشعار الملف في الجرس: ${error.message}`;
          }
        }
        await loadData();
        notify(notificationWarning || "تم تحديث حالة الملف.", Boolean(notificationWarning));
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
    if (localFeaturePreview) {
      const moved = [...ordered];
      for (const [position, item] of moved.entries()) item.position = position;
      files = moved;
      localStorage.setItem("course-library-feature-preview-files", JSON.stringify(files));
      await loadData();
      return;
    }
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

async function uploadNotificationImage(file) {
  const extension = file.name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0].toLowerCase() || "";
  const path = `${crypto.randomUUID()}/${crypto.randomUUID()}${extension}`;
  const { data, error } = await client.storage.from("notification-images").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    if (
      error.statusCode === "404" ||
      /bucket.*not found|not found.*bucket/i.test(error.message)
    ) {
      throw new Error("صورة الإشعار تحتاج تشغيل database/notifications-migration.sql أولًا.");
    }
    throw error;
  }
  return data.path;
}

function clearNotificationImagePreview() {
  if (
    notificationPreviewUrl &&
    !notifications.some((item) => item.image_url === notificationPreviewUrl)
  ) URL.revokeObjectURL(notificationPreviewUrl);
  notificationPreviewUrl = null;
  notificationImagePreview.removeAttribute("src");
  notificationImagePreviewWrap.hidden = true;
  notificationImageName.textContent = "";
}

notificationImageInput.addEventListener("change", () => {
  clearNotificationImagePreview();
  const file = notificationImageInput.files[0];
  if (!file) return;
  if (!notificationImageMimeTypes.has(file.type)) {
    clearNotificationImagePreview();
    notificationImageInput.value = "";
    notify("اختر صورة بصيغة PNG أو JPG أو WebP أو GIF.", true);
    return;
  }
  if (file.size > maxNotificationImageSize) {
    clearNotificationImagePreview();
    notificationImageInput.value = "";
    notify("يجب ألا يتجاوز حجم صورة الإشعار 10 MB.", true);
    return;
  }
  notificationPreviewUrl = URL.createObjectURL(file);
  notificationImagePreview.src = notificationPreviewUrl;
  notificationImageName.textContent = file.name;
  notificationImagePreviewWrap.hidden = false;
});

notificationAttachmentsInput.addEventListener("change", updateNotificationAttachmentSelection);
notificationRemoveImage.addEventListener("click", () => {
  removeCurrentNotificationImage = true;
  notificationImageInput.value = "";
  clearNotificationImagePreview();
  notificationRemoveImage.hidden = true;
});

function resetNotificationForm() {
  notificationForm.reset();
  editingNotification = null;
  removeCurrentNotificationImage = false;
  removedNotificationAttachmentPaths.clear();
  notificationRemoveImage.hidden = true;
  notificationExistingAttachments.replaceChildren();
  notificationAttachmentSelection.replaceChildren();
  notificationUploadProgress.hidden = true;
  notificationUploadStatus.hidden = true;
  notificationForm.querySelector('[type="submit"]').textContent = "نشر الإشعار";
  document.querySelector("#cancel-notification-edit").hidden = true;
  clearNotificationImagePreview();
}

function editNotification(item) {
  editingNotification = item;
  removeCurrentNotificationImage = false;
  removedNotificationAttachmentPaths.clear();
  notificationForm.elements.id.value = item.id;
  notificationForm.elements.title.value = item.title;
  notificationForm.elements.body.value = item.body || "";
  notificationForm.querySelector('[type="submit"]').textContent = "حفظ التعديلات";
  document.querySelector("#cancel-notification-edit").hidden = false;
  if (item.image_url || item.image_path) {
    notificationImagePreview.src = item.image_url ||
      client.storage.from("notification-images").getPublicUrl(item.image_path).data.publicUrl;
    notificationImageName.textContent = "الصورة الحالية";
    notificationImagePreviewWrap.hidden = false;
    notificationRemoveImage.hidden = false;
  }
  renderExistingNotificationAttachments();
  notificationForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(categoryForm);
  try {
    if (localFeaturePreview) {
      const nameAr = values.get("name_ar").trim();
      if (categories.some((category) => category.name_ar === nameAr)) {
        throw new Error("اسم التصنيف موجود بالفعل في المعاينة.");
      }
      const parentId = values.get("parent_id") || null;
      categories.push({
        id: crypto.randomUUID(),
        name_ar: nameAr,
        name_en: values.get("name_en").trim(),
        parent_id: parentId,
        is_active: true,
        is_coming_soon: values.has("is_coming_soon"),
        position: categories.filter((category) => category.parent_id === parentId).length,
      });
      localStorage.setItem("course-library-feature-preview", JSON.stringify(categories));
      categoryForm.reset();
      await loadData();
      notify("تمت الإضافة في المعاينة المحلية فقط؛ لم يتغير الموقع أو قاعدة البيانات.");
      return;
    }
    assertSuccess(await client.from("categories").insert({
      name_ar: values.get("name_ar").trim(),
      name_en: values.get("name_en").trim(),
      parent_id: values.get("parent_id") || null,
      is_coming_soon: values.has("is_coming_soon"),
      position: categories.filter((category) =>
        category.parent_id === (values.get("parent_id") || null),
      ).length,
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
      if (localFeaturePreview) {
        category.name_ar = nameAr.trim();
        category.name_en = nameEn.trim();
        localStorage.setItem("course-library-feature-preview", JSON.stringify(categories));
        await loadData();
        return;
      }
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
  uploadDrafts.clear();
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
    const isBatchUpload = newFiles.length > 0 && !existing;
    const entries = isBatchUpload
      ? newFiles.map((file) => ({ file, draft: uploadDrafts.get(file) }))
      : [];
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
    if (localFeaturePreview && existing && newFiles.length === 0) {
      const isPublishing = !existing.is_published && values.has("is_published");
      files = files.map((file) => file.id === existing.id
        ? {
            ...file,
            name: values.get("name").trim() || existing.name,
            description: values.get("description").trim(),
            category_id: values.get("category_id"),
            categories: categories.find((category) => category.id === values.get("category_id")),
            position: Number(values.get("position")) || 0,
            is_published: values.has("is_published"),
            is_new: values.has("is_published") && (isPublishing || file.is_new),
          }
        : file);
      if (isPublishing) {
        files = files.map((file) => file.id === existing.id
          ? file
          : { ...file, is_new: false });
      }
      localStorage.setItem("course-library-feature-preview-files", JSON.stringify(files));
      resetFileForm();
      await loadData();
      notify("تم تعديل بيانات الملف في المعاينة المحلية فقط.");
      return;
    }
    const invalidEntry = entries.find(({ draft }) =>
      !draft?.name.trim() || !draft.categoryId ||
      !categories.some((category) => category.id === draft.categoryId),
    );
    if (invalidEntry) {
      throw new Error(`أكمل اسم وتصنيف «${invalidEntry.file.name}».`);
    }
    const oversizedBatchCover = entries.find(({ draft }) =>
      draft.cover?.size > maxCoverSize,
    );
    if (oversizedBatchCover) {
      throw new Error(`حجم غلاف «${oversizedBatchCover.file.name}» أكبر من 50 MB.`);
    }
    const invalidBatchCover = entries.find(({ draft }) =>
      draft.cover && !getUploadMimeType(draft.cover).startsWith("image/"),
    );
    if (invalidBatchCover) throw new Error("اختر صورة صحيحة لكل غلاف.");
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
    const uploadedCoverPaths = [];
    if (localFeaturePreview) {
      const previewRecords = [];
      for (const [index, file] of newFiles.entries()) {
        const draft = isBatchUpload
          ? entries[index].draft
          : {
              name: values.get("name").trim() || file.name.replace(/\.[^.]+$/, ""),
              description: values.get("description").trim(),
              categoryId: values.get("category_id"),
              isPublished: values.has("is_published"),
            };
        previewRecords.push({
          id: crypto.randomUUID(),
          name: draft.name,
          description: draft.description,
          category_id: draft.categoryId,
          categories: categories.find((category) => category.id === draft.categoryId),
          object_path: file.name,
          cover_path: isBatchUpload ? entries[index].draft.cover?.name || null : null,
          mime_type: getUploadMimeType(file),
          size_bytes: file.size,
          position: (Number(values.get("position")) || 0) + index,
          downloads: 0,
          is_published: draft.isPublished,
          is_new: draft.isPublished,
          created_at: new Date().toISOString(),
        });
      }
      if (previewRecords.some((file) => file.is_new)) {
        files = files.map((file) => ({ ...file, is_new: false }));
      }
      files = [...previewRecords, ...files];
      const previewNotifications = previewRecords
        .filter((file) => file.is_published)
        .map((file) => ({
          id: crypto.randomUUID(),
          title: `ملف جديد: ${file.name}`,
          body: file.description || `أُضيف إلى تصنيف ${file.categories?.name_ar || ""}.`,
          type: "file",
          file_id: file.id,
          created_at: file.created_at,
        }));
      notifications = [...previewNotifications, ...notifications];
      localStorage.setItem("course-library-feature-preview-files", JSON.stringify(files));
      localStorage.setItem(
        "course-library-feature-preview-notifications",
        JSON.stringify(notifications),
      );
      resetFileForm();
      await loadData();
      notify(`تمت إضافة ${previewRecords.length} عنصر للمعاينة المحلية فقط؛ لم يُرفع أي ملف أو إشعار للأجهزة.`);
      return;
    }
    const uploads = [
      ...entries.flatMap(({ file, draft }) => [file, ...(draft.cover ? [draft.cover] : [])]),
      ...(!isBatchUpload ? newFiles : []),
      ...(newCover?.size ? [newCover] : []),
    ];
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
      uploadedPaths.push(path);
      uploadedFilePaths.push(path);
      completedBytes += newFile.size;
      uploadProgress.value = completedBytes;
      if (isBatchUpload && entries[index].draft.cover) {
        const batchCover = entries[index].draft.cover;
        const batchCoverPath = await uploadAsset(batchCover, "covers", (uploadedBytes) => {
          uploadProgress.value = completedBytes + uploadedBytes;
          uploadStatus.textContent = `جارٍ رفع غلاف ${newFile.name} · ${Math.floor(
            (uploadedBytes / batchCover.size) * 100,
          )}%`;
        });
        uploadedPaths.push(batchCoverPath);
        uploadedCoverPaths.push(batchCoverPath);
        completedBytes += batchCover.size;
        uploadProgress.value = completedBytes;
      } else if (isBatchUpload) {
        uploadedCoverPaths.push(null);
      }
      if (index === 0 && existing) {
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
    const isPublishingExisting = existing &&
      !existing.is_published && baseRecord.is_published;
    const hasNewPublishedFiles = !existing && (isBatchUpload
      ? entries.some(({ draft }) => draft.isPublished)
      : baseRecord.is_published);
    if (isPublishingExisting || hasNewPublishedFiles) {
      assertSuccess(await client.from("files")
        .update({ is_new: false })
        .eq("is_new", true));
    }
    const result = existing
      ? await client.from("files").update({
          ...baseRecord,
          is_new: baseRecord.is_published &&
            (isPublishingExisting || existing.is_new),
          name: values.get("name").trim() || existing.name,
          object_path: objectPath,
          cover_path: coverPath || null,
          mime_type: mimeType,
          size_bytes: sizeBytes,
        }).eq("id", existing.id)
        .select("id, name, description, category_id, is_published")
        .single()
      : await client.from("files").insert(newFiles.map((file, index) => ({
          ...(isBatchUpload ? {
            description: entries[index].draft.description,
            category_id: entries[index].draft.categoryId,
            is_published: entries[index].draft.isPublished,
          } : baseRecord),
          name: isBatchUpload
            ? entries[index].draft.name.trim()
            : newFiles.length === 1 && values.get("name").trim()
              ? values.get("name").trim()
              : file.name.replace(/\.[^.]+$/, ""),
          object_path: uploadedFilePaths[index],
          cover_path: isBatchUpload
            ? uploadedCoverPaths[index]
            : newFiles.length === 1 ? coverPath || null : null,
          mime_type: getUploadMimeType(file),
          size_bytes: file.size,
          is_new: isBatchUpload
            ? entries[index].draft.isPublished
            : baseRecord.is_published,
          position: baseRecord.position + index,
        })))
        .select("id, name, description, category_id, is_published");
    const savedRows = assertSuccess(result);
    saved = true;
    const newlyPublishedFiles = existing
      ? (!existing.is_published && savedRows.is_published ? [savedRows] : [])
      : savedRows.filter((file) => file.is_published);
    let notificationWarning = "";
    if (newlyPublishedFiles.length) {
      try {
        notificationWarning = await publishFileNotifications(newlyPublishedFiles);
      } catch (error) {
        notificationWarning = `تعذر نشر إشعار الملف في الجرس: ${error.message}`;
      }
    }
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
    const finalMessage = [successMessage, notificationWarning]
      .filter(Boolean)
      .join(" ");
    notify(cleanupWarning || finalMessage, Boolean(cleanupWarning || notificationWarning));
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

document.querySelector("#cancel-notification-edit")
  .addEventListener("click", resetNotificationForm);

notificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = notificationForm.querySelector('[type="submit"]');
  const values = new FormData(notificationForm);
  const title = values.get("title").trim();
  const body = values.get("body").trim();
  const selectedAttachments = [...notificationAttachmentsInput.files];
  const imageFile = notificationImageInput.files[0];
  const isEditing = Boolean(editingNotification);
  if (!title || !body) {
    notify("أدخل عنوان الإشعار ونصه أو التعليق على الصورة.", true);
    return;
  }
  if (imageFile && (
    !notificationImageMimeTypes.has(imageFile.type) ||
    imageFile.size > maxNotificationImageSize
  )) {
    notify("تحقق من صيغة صورة الإشعار وحجمها (حتى 10 MB).", true);
    return;
  }
  const oversizedAttachment = selectedAttachments.find((file) => file.size > maxFileSize);
  if (oversizedAttachment) {
    notify(`حجم «${oversizedAttachment.name}» أكبر من الحد المسموح (1 GB).`, true);
    return;
  }
  const unsupportedAttachment = selectedAttachments.find((file) =>
    !uploadMimeTypes.has(getUploadMimeType(file)),
  );
  if (unsupportedAttachment) {
    notify(`نوع الملف «${unsupportedAttachment.name}» غير مدعوم.`, true);
    return;
  }
  submit.disabled = true;
  let imagePath = null;
  const uploadedAttachmentPaths = [];
  let notificationSaved = false;
  let notificationCleanupWarning = "";
  try {
    if (localFeaturePreview) {
      const imageUrl = imageFile ? notificationPreviewUrl : null;
      if (isEditing) {
        notifications = notifications.map((item) => item.id === editingNotification.id
          ? {
              ...item,
              title,
              body,
              image_url: imageUrl || (removeCurrentNotificationImage ? null : item.image_url || null),
              attachments: [
                ...(item.attachments || []).filter((attachment) =>
                  !removedNotificationAttachmentPaths.has(attachment.object_path)),
                ...selectedAttachments.map((file) => ({
                  object_path: `preview:${crypto.randomUUID()}`,
                  name: file.name,
                  size_bytes: file.size,
                })),
              ],
            }
          : item);
      } else {
        notifications = [{
          id: crypto.randomUUID(),
          title,
          body,
          type: "announcement",
          file_id: null,
          image_url: imageUrl,
          attachments: selectedAttachments.map((file) => ({
            object_path: `preview:${crypto.randomUUID()}`,
            name: file.name,
            size_bytes: file.size,
          })),
          created_at: new Date().toISOString(),
        }, ...notifications];
      }
      localStorage.setItem(
        "course-library-feature-preview-notifications",
        JSON.stringify(notifications.map(({ image_url, ...item }) => item)),
      );
      resetNotificationForm();
      renderAdminNotifications();
      notify(isEditing
        ? "تم تعديل الإعلان في المعاينة المحلية فقط."
        : "تم حفظ الإعلان في المعاينة المحلية فقط؛ لم يُرسل أي تنبيه للأجهزة.");
      return;
    }
    if (imageFile) imagePath = await uploadNotificationImage(imageFile);
    let completedBytes = 0;
    const attachmentTotal = selectedAttachments.reduce((total, file) => total + file.size, 0);
    notificationUploadProgress.hidden = selectedAttachments.length === 0;
    notificationUploadProgress.max = Math.max(attachmentTotal, 1);
    notificationUploadProgress.value = 0;
    notificationUploadStatus.hidden = selectedAttachments.length === 0;
    for (const file of selectedAttachments) {
      notificationUploadStatus.textContent = `جارٍ رفع ${file.name}...`;
      const objectPath = await uploadAsset(file, "notification-attachments", (uploadedBytes) => {
        notificationUploadProgress.value = completedBytes + uploadedBytes;
        notificationUploadStatus.textContent =
          `جارٍ رفع ${file.name} · ${Math.floor((uploadedBytes / file.size) * 100)}%`;
      });
      uploadedAttachmentPaths.push(objectPath);
      completedBytes += file.size;
      notificationUploadProgress.value = completedBytes;
    }
    const retainedAttachments = (editingNotification?.attachments || [])
      .filter((attachment) => !removedNotificationAttachmentPaths.has(attachment.object_path));
    const attachments = [
      ...retainedAttachments,
      ...selectedAttachments.map((file, index) => ({
        object_path: uploadedAttachmentPaths[index],
        name: file.name,
        mime_type: getUploadMimeType(file),
        size_bytes: file.size,
      })),
    ];
    const notificationValues = {
      title,
      body,
      attachments,
      ...(imagePath
        ? { image_path: imagePath }
        : isEditing && (removeCurrentNotificationImage || editingNotification.image_path)
          ? { image_path: removeCurrentNotificationImage ? null : editingNotification.image_path }
          : {}),
      ...(!isEditing ? { type: "announcement" } : {}),
    };
    const notificationQuery = isEditing
      ? client.from("notifications").update(notificationValues).eq("id", editingNotification.id)
      : client.from("notifications").insert(notificationValues);
    const notification = assertSuccess(await notificationQuery
      .select("id, title, body, type, file_id, image_path, attachments, created_at")
      .single());
    notificationSaved = true;
    const obsoletePaths = [
      ...(removeCurrentNotificationImage && editingNotification?.image_path
        ? [editingNotification.image_path]
        : imagePath && editingNotification?.image_path
          ? [editingNotification.image_path]
          : []),
      ...(editingNotification?.attachments || [])
        .filter((attachment) => removedNotificationAttachmentPaths.has(attachment.object_path))
        .map((attachment) => attachment.object_path),
    ];
    if (obsoletePaths.length) {
      const { error } = await client.storage.from("library-files").remove(
        obsoletePaths.filter((path) => path !== editingNotification?.image_path),
      );
      if (error) notificationCleanupWarning =
        `تم الحفظ لكن تعذر حذف بعض المرفقات القديمة: ${error.message}`;
    }
    if (removeCurrentNotificationImage && editingNotification?.image_path) {
      const { error } = await client.storage.from("notification-images")
        .remove([editingNotification.image_path]);
      if (error) notificationCleanupWarning =
        `تم الحفظ لكن تعذر حذف الصورة القديمة: ${error.message}`;
    } else if (imagePath && editingNotification?.image_path) {
      const { error } = await client.storage.from("notification-images")
        .remove([editingNotification.image_path]);
      if (error) notificationCleanupWarning =
        `تم الحفظ لكن تعذر حذف الصورة القديمة: ${error.message}`;
    }
    const pushWarning = isEditing ? "" : await sendPushAlerts([notification]);
    resetNotificationForm();
    await loadData();
    notify(notificationCleanupWarning || pushWarning || (isEditing
      ? "تم حفظ تعديلات الإشعار."
      : "تم نشر الإعلان في جرس الإشعارات للزوار."),
      Boolean(notificationCleanupWarning || pushWarning));
  } catch (error) {
    if (!notificationSaved && uploadedAttachmentPaths.length) {
      const { error: cleanupError } = await client.storage
        .from("library-files").remove(uploadedAttachmentPaths);
      if (cleanupError) {
        error.message = `${error.message} وتعذر تنظيف المرفقات المرفوعة مؤقتًا: ${cleanupError.message}`;
      }
    }
    if (imagePath && !notificationSaved) {
      const { error: cleanupError } = await client.storage
        .from("notification-images")
        .remove([imagePath]);
      if (cleanupError) {
        console.error("Could not remove the unused notification image.", cleanupError);
      }
    }
    const message = error.code === "PGRST204" || error.code === "42703"
      ? "شغّل database/notifications-migration.sql ثم database/library-enhancements-migration.sql لتحديث حقول الإشعارات."
      : error.message;
    notify(message, true);
  } finally {
    notificationUploadProgress.hidden = true;
    notificationUploadStatus.hidden = true;
    submit.disabled = false;
  }
});

async function deleteFile(file) {
  if (!window.confirm(`حذف «${file.name}» نهائيًا؟`)) return;
  try {
    if (localFeaturePreview) {
      files = files.filter((item) => item.id !== file.id);
      localStorage.setItem("course-library-feature-preview-files", JSON.stringify(files));
      await loadData();
      return;
    }
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
if (localFeaturePreview) {
  document.querySelector("#admin-email").textContent = "معاينة محلية آمنة";
  document.querySelector("#dashboard-message").textContent =
    "معاينة محلية معزولة: التصنيفات والبيانات التجريبية محفوظة في هذا المتصفح فقط. لن يتصل هذا الوضع بقاعدة بيانات الموقع أو يرفع ملفات.";
  document.querySelector("#dashboard-message").hidden = false;
  document.querySelectorAll(".dashboard > .panel").forEach((panel, index) => {
    panel.hidden = ![1, 2, 3, 4].includes(index);
  });
  document.querySelector("#logout-button").hidden = true;
  await loadData();
} else if (!client) {
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

  updateFileSelection();
}
