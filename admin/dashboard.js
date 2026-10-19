import { legacyCategories, legacyFiles } from "../services/legacy-catalog.js";
import { supabaseConfig } from "../config.js";
import { initializeCalendarManagement } from "./calendar-management.js";
import { runUploadQueue, uploadObjectWithXhr } from "./upload-transport.js";

const isLocalPreviewHost = window.location.protocol === "file:" ||
  (window.location.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
const localFeaturePreview = isLocalPreviewHost &&
  new URLSearchParams(window.location.search).get("preview") === "features";
const { supabase: client } = localFeaturePreview
  ? { supabase: null }
  : await import("../services/supabase.js");
const message = document.querySelector("#dashboard-message");
const toast = document.querySelector("#admin-toast");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const categoryCount = document.querySelector("#category-count");
const categoryPreviewCard = document.querySelector("#category-preview-card");
const categoryPreviewIcon = document.querySelector("#category-preview-icon");
const categoryPreviewName = document.querySelector("#category-preview-name");
const categoryPreviewDescription = document.querySelector("#category-preview-description");
const categoryPreviewCount = document.querySelector("#category-preview-count");
const categoryPreviewStatus = document.querySelector("#category-preview-status");
const semesterAdminList = document.querySelector("#semester-admin-list");
const semesterManagementNote = document.querySelector("#semester-management-note");
const cancelCategoryEdit = document.querySelector("#cancel-category-edit");
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
const fileSelectVisible = document.querySelector("#file-select-visible");
const fileSelectionCount = document.querySelector("#file-selection-count");
const editSelectedFiles = document.querySelector("#edit-selected-files");
const fileEditQueueStatus = document.querySelector("#file-edit-queue-status");
const adminThemeButton = document.querySelector("#admin-theme-button");
const overviewCategoryCount = document.querySelector("#overview-category-count");
const overviewFileCount = document.querySelector("#overview-file-count");
const overviewNotificationCount = document.querySelector("#overview-notification-count");
const overviewDownloadCount = document.querySelector("#overview-download-count");
const overviewUserCount = document.querySelector("#overview-user-count");
const overviewStorageSize = document.querySelector("#overview-storage-size");
const overviewDataNote = document.querySelector("#overview-data-note");
const overviewRecentFiles = document.querySelector("#overview-recent-files");
const overviewRecentActions = document.querySelector("#overview-recent-actions");
const homepageSectionList = document.querySelector("#homepage-section-list");
const homepageSectionNote = document.querySelector("#homepage-section-note");
const uploadInput = document.querySelector("#file-input");
const fileSelection = document.querySelector("#file-selection");
const uploadEditors = document.querySelector("#upload-editors");
const coverInput = fileForm.elements.cover;
const coverFileName = document.querySelector("#cover-file-name");
const uploadProgress = document.querySelector("#upload-progress");
const uploadStatus = document.querySelector("#upload-status");
const uploadFileStatuses = document.querySelector("#upload-file-statuses");
const cancelCurrentUploads = document.querySelector("#cancel-current-uploads");
const migrationInput = document.querySelector("#legacy-files");
const migrationProgress = document.querySelector("#migration-progress");
const migrationButton = document.querySelector("#migration-button");
let categories = [];
let semesters = [];
let files = [];
let notifications = [];
let recentAdminActions = null;
let optionalOverviewWarnings = [];
const defaultHomepageSections = [
  { id: "personal", position: 0, is_visible: true },
  { id: "discovery", position: 1, is_visible: true },
  { id: "planner", position: 2, is_visible: true },
  { id: "library", position: 3, is_visible: true },
];
let homepageSections = defaultHomepageSections.map((section) => ({ ...section }));
let homepageSectionSettingsAvailable = true;
let toastTimeout;
let tusClientPromise;
let fileUploadBatch = null;
let isUploadBatchRunning = false;
let selectedFileIds = new Set();
let fileEditQueue = null;
let fileEditQueueIndex = -1;
let uploadBatchAbortController = null;
let notificationPreviewUrl;
let editingNotification = null;
let removeCurrentNotificationImage = false;
const removedNotificationAttachmentPaths = new Set();
const uploadDrafts = new Map();
const firstSemesterId = "8c13f5b1-98bf-47a1-b076-ef58c0a10001";
const previewSemesters = [
  { id: "local-semester-1", name: "الترم الأول", description: "", icon: "📚", display_text: "", status: "active", subject_count: 6, position: 0 },
  { id: "local-semester-2", name: "الترم الثاني", description: "", icon: "🎓", display_text: "قريبًا", status: "coming_soon", subject_count: 0, position: 1 },
];

const maxFileSize = 2 * 1024 ** 3;
const maxCoverSize = 50 * 1024 ** 2;
const maxNotificationImageSize = 10 * 1024 ** 2;
const resumableUploadThreshold = 6 * 1024 ** 2;
const uploadConcurrency = 3;
const notificationImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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
  const reportedType = String(file.type || "").toLowerCase();
  if (reportedType && !["application/octet-stream", "binary/octet-stream"].includes(reportedType)) {
    return reportedType;
  }
  const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase();
  return mimeTypesByExtension[extension] || reportedType || "application/octet-stream";
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

function setAdminTheme(enabled) {
  document.body.classList.toggle("dark", enabled);
  adminThemeButton.textContent = enabled ? "الوضع الفاتح" : "الوضع الداكن";
  adminThemeButton.setAttribute("aria-pressed", String(enabled));
  try {
    localStorage.setItem("course-library-admin-theme-v1", enabled ? "dark" : "light");
  } catch {
    return;
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
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

function dashboardErrorMessage(error) {
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code)) {
    return "قاعدة البيانات تحتاج إلى تحديث الفصول والتصنيفات. شغّل database/semester-library-migration.sql في Supabase ثم أعد تحميل لوحة الإدارة.";
  }
  return error.message;
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
    const remove = document.createElement("button");
    remove.className = "danger-button small-button";
    remove.type = "button";
    remove.textContent = "حذف";
    remove.addEventListener("click", () => { void deleteNotification(item); });
    const actions = document.createElement("div");
    actions.className = "admin-notification-actions";
    actions.append(edit, remove);
    row.append(details, actions);
    return row;
  }));
  renderOverview();
}

async function deleteNotification(item) {
  if (!window.confirm(`حذف الإشعار «${item.title}»؟`)) return;
  if (localFeaturePreview) {
    notifications = notifications.filter((notification) => notification.id !== item.id);
    try {
      localStorage.setItem("course-library-feature-preview-notifications", JSON.stringify(notifications));
      await loadData();
      notify("تم حذف الإشعار من المعاينة المحلية فقط.");
    } catch (error) { notify(error.message, true); }
    return;
  }

  try {
    assertSuccess(await client.from("notifications").delete().eq("id", item.id));
    await loadData();

    const { data: remainingNotifications, error: referencesError } = await client
      .from("notifications")
      .select("image_path, attachments");
    if (referencesError) {
      notify("تم حذف الإشعار، لكن تعذر التحقق من المرفقات القديمة لتنظيفها.", true);
      return;
    }
    const { data: libraryFiles, error: fileReferencesError } = await client
      .from("files")
      .select("object_path, cover_path");
    if (fileReferencesError) {
      notify("تم حذف الإشعار، لكن تعذر التحقق من مراجع الملفات لتنظيف المرفقات بأمان.", true);
      return;
    }

    const usedImagePaths = new Set(remainingNotifications.map((notification) => notification.image_path).filter(Boolean));
    const usedAttachmentPaths = new Set(remainingNotifications.flatMap((notification) =>
      (Array.isArray(notification.attachments) ? notification.attachments : [])
        .map((attachment) => attachment.object_path)
        .filter(Boolean),
    ));
    const usedLibraryPaths = new Set(libraryFiles.flatMap((file) =>
      [file.object_path, file.cover_path].filter(Boolean),
    ));
    const imagePath = item.image_path && !usedImagePaths.has(item.image_path)
      ? item.image_path
      : null;
    const attachmentPaths = (Array.isArray(item.attachments) ? item.attachments : [])
      .map((attachment) => attachment.object_path)
      .filter((path) => path && !usedAttachmentPaths.has(path) && !usedLibraryPaths.has(path));
    let cleanupWarning = "";
    if (attachmentPaths.length) {
      const { error } = await client.storage.from("library-files").remove(attachmentPaths);
      if (error) cleanupWarning = `تم حذف الإشعار لكن تعذر حذف بعض مرفقاته: ${error.message}`;
    }
    if (imagePath) {
      const { error } = await client.storage.from("notification-images").remove([imagePath]);
      if (error) cleanupWarning = `تم حذف الإشعار لكن تعذر حذف صورته: ${error.message}`;
    }
    notify(cleanupWarning || "تم حذف الإشعار ومرفقاته غير المستخدمة.", Boolean(cleanupWarning));
  } catch (error) { notify(error.message, true); }
}

function renderOverview() {
  overviewCategoryCount.textContent = String(categories.filter((category) =>
    category.is_active && !category.is_coming_soon).length);
  overviewFileCount.textContent = String(files.filter((file) => file.is_published).length);
  overviewNotificationCount.textContent = String(notifications.filter((item) => item.is_active).length);
  overviewDownloadCount.textContent = String(files.reduce(
    (total, file) => total + (Number(file.downloads) || 0),
    0,
  ));
  overviewUserCount.textContent = "غير متاح";
  overviewStorageSize.textContent = formatFileSize(files.reduce(
    (total, file) => total + (Number(file.size_bytes) || 0),
    0,
  ));
  overviewDataNote.hidden = optionalOverviewWarnings.length === 0;
  overviewDataNote.textContent = optionalOverviewWarnings.join(" ");

  const recentFiles = [...files]
    .sort((first, second) =>
      new Date(second.updated_at || second.created_at) -
      new Date(first.updated_at || first.created_at),
    )
    .slice(0, 5);
  overviewRecentFiles.replaceChildren(...(recentFiles.length
    ? recentFiles.map((file) => {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = file.name;
        const date = document.createElement("time");
        const changedAt = file.updated_at || file.created_at;
        date.dateTime = changedAt;
        date.textContent = `آخر تحديث: ${new Date(changedAt).toLocaleString("ar")}`;
        item.append(name, date);
        return item;
      })
    : [createOverviewEmptyState("لا توجد ملفات مسجلة بعد.")]));

  overviewRecentActions.replaceChildren(...(recentAdminActions?.length
    ? recentAdminActions.map((action) => {
        const actionLabels = { INSERT: "إضافة", UPDATE: "تعديل", DELETE: "حذف" };
        const targetLabels = {
          categories: "تصنيف",
          files: "ملف",
          notifications: "إشعار",
          semesters: "فصل دراسي",
        };
        const item = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = `${actionLabels[action.action] || action.action} ${targetLabels[action.target_type] || action.target_type}`;
        const date = document.createElement("time");
        date.dateTime = action.created_at;
        const actor = action.admin_id
          ? `مسؤول ${action.admin_id.slice(0, 8)}`
          : "مسؤول سابق";
        date.textContent = `${actor} · ${new Date(action.created_at).toLocaleString("ar")}`;
        item.append(label, date);
        return item;
      })
    : [createOverviewEmptyState(
        recentAdminActions === null
          ? "السجل غير متاح؛ شغّل database/library-admin-audit-migration.sql."
          : "لا توجد عمليات إدارية مسجلة.",
      )]));
}

function createOverviewEmptyState(text) {
  const item = document.createElement("li");
  item.className = "overview-empty-state";
  item.textContent = text;
  return item;
}

function renderHomepageSections() {
  const labels = {
    personal: "المفضلة وآخر الملفات",
    discovery: "الأحدث والأكثر تنزيلًا",
    planner: "خطة المذاكرة",
    library: "المواد والملفات",
  };
  const orderedSections = [...homepageSections].sort((first, second) => first.position - second.position);
  homepageSectionNote.hidden = !localFeaturePreview && homepageSectionSettingsAvailable;
  homepageSectionNote.textContent = localFeaturePreview
    ? "معاينة محلية: لن تتغير إعدادات الموقع المنشور."
    : "شغّل database/homepage-sections-migration.sql لتفعيل الحفظ الدائم لهذه الإعدادات.";

  homepageSectionList.replaceChildren(...orderedSections.map((section, index) => {
    const row = document.createElement("li");
    row.className = "homepage-section-row";
    const details = document.createElement("div");
    details.className = "homepage-section-details";
    const title = document.createElement("strong");
    title.textContent = labels[section.id] || section.id;
    const position = document.createElement("small");
    position.textContent = `${index + 1}`;
    details.append(title, position);

    const visibilityLabel = document.createElement("label");
    visibilityLabel.className = "homepage-section-visibility";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = section.is_visible;
    checkbox.disabled = !homepageSectionSettingsAvailable && !localFeaturePreview;
    checkbox.setAttribute("aria-label", `إظهار ${labels[section.id] || section.id}`);
    checkbox.addEventListener("change", () => {
      const updated = orderedSections.map((item) => item.id === section.id
        ? { ...item, is_visible: checkbox.checked }
        : item);
      void saveHomepageSections(updated);
    });
    visibilityLabel.append(checkbox, document.createTextNode("ظاهر"));

    const actions = document.createElement("div");
    actions.className = "homepage-section-actions";
    for (const [direction, label] of [[-1, "تحريك لأعلى"], [1, "تحريك لأسفل"]]) {
      const button = document.createElement("button");
      button.className = "secondary-button small-button order-button";
      button.type = "button";
      button.textContent = direction < 0 ? "↑" : "↓";
      button.disabled = (!homepageSectionSettingsAvailable && !localFeaturePreview) ||
        index + direction < 0 || index + direction >= orderedSections.length;
      button.setAttribute("aria-label", `${label}: ${labels[section.id] || section.id}`);
      button.addEventListener("click", () => {
        const moved = [...orderedSections];
        [moved[index], moved[index + direction]] = [moved[index + direction], moved[index]];
        void saveHomepageSections(moved);
      });
      actions.append(button);
    }
    row.append(details, visibilityLabel, actions);
    return row;
  }));
}

async function saveHomepageSections(sections) {
  const orderedSections = sections.map((section, position) => ({ ...section, position }));
  if (localFeaturePreview) {
    try {
      localStorage.setItem("course-library-feature-preview-homepage-sections", JSON.stringify(orderedSections));
      homepageSections = orderedSections;
      renderHomepageSections();
      notify("تم حفظ الترتيب في هذه المعاينة المحلية فقط.");
    } catch (error) { notify(error.message, true); }
    return;
  }
  if (!homepageSectionSettingsAvailable) return;
  try {
    assertSuccess(await client.from("homepage_sections").upsert(
      orderedSections.map((section) => ({
        id: section.id,
        position: section.position,
        is_visible: section.is_visible,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    ));
    await loadData();
    notify("تم حفظ ترتيب أقسام الصفحة الرئيسية.");
  } catch (error) { notify(error.message, true); }
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
          semester_id: previewSemesters[0].id,
          description: "",
          icon: "📁",
          is_active: true,
        }));
    semesters = JSON.parse(localStorage.getItem("course-library-feature-preview-semesters") || "null") ||
      previewSemesters.map((semester) => ({ ...semester }));
    const savedFiles = localStorage.getItem("course-library-feature-preview-files");
    files = savedFiles
      ? JSON.parse(savedFiles).map((file) => ({
          ...file,
          categories: categories.find((category) => category.id === file.category_id),
        }))
      : [];
    const savedNotifications = localStorage.getItem("course-library-feature-preview-notifications");
    notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
    recentAdminActions = null;
    optionalOverviewWarnings = [
      "هذه معاينة محلية وليست بيانات قاعدة البيانات. عدد المستخدمين غير متاح لهذا المشروع.",
    ];
    const savedSections = localStorage.getItem("course-library-feature-preview-homepage-sections");
    homepageSections = savedSections ? JSON.parse(savedSections) : defaultHomepageSections.map((section) => ({ ...section }));
    homepageSectionSettingsAvailable = true;
    renderCategories();
    renderSemesters();
    renderParentCategoryOptions();
    renderCategoryOptions();
    renderFiles();
    renderAdminNotifications();
    renderHomepageSections();
    return;
  }
  const [
    semesterData,
    categoryData,
    fileData,
    notificationData,
    homepageSectionData,
    auditLogData,
  ] = await Promise.all([
    client.from("semesters").select("*").order("position"),
    client.from("categories").select("*").order("position"),
    client.from("files").select("*, categories(id, name_ar, name_en, parent_id)").order("position").order("created_at", { ascending: false }),
    client.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
    client.from("homepage_sections").select("id, position, is_visible").order("position"),
    client.from("library_admin_audit_logs")
      .select("admin_id, action, target_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  semesters = assertSuccess(semesterData);
  categories = assertSuccess(categoryData);
  files = assertSuccess(fileData);
  notifications = assertSuccess(notificationData);
  optionalOverviewWarnings = [
    "عدد المستخدمين غير متاح؛ قاعدة البيانات الحالية لا توفر واجهة إدارية آمنة لعد حسابات Auth.",
  ];
  if (auditLogData.error) {
    if (["42P01", "PGRST205"].includes(auditLogData.error.code)) {
      recentAdminActions = null;
      optionalOverviewWarnings.push(
        "سجل العمليات يحتاج تطبيق database/library-admin-audit-migration.sql.",
      );
    } else {
      recentAdminActions = null;
      optionalOverviewWarnings.push(
        `تعذر جلب سجل العمليات: ${auditLogData.error.message}`,
      );
    }
  } else {
    recentAdminActions = auditLogData.data;
  }
  if (homepageSectionData.error) {
    if (!["42P01", "PGRST205"].includes(homepageSectionData.error.code)) {
      throw homepageSectionData.error;
    }
    homepageSectionSettingsAvailable = false;
    homepageSections = defaultHomepageSections.map((section) => ({ ...section }));
  } else {
    homepageSectionSettingsAvailable = true;
    homepageSections = homepageSectionData.data.length
      ? homepageSectionData.data
      : defaultHomepageSections.map((section) => ({ ...section }));
  }
  renderCategories();
  renderSemesters();
  renderParentCategoryOptions();
  renderCategoryOptions();
  renderFiles();
  renderAdminNotifications();
  renderHomepageSections();
}

function renderCategories() {
  categoryCount.textContent = String(categories.length);
  renderOverview();
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
      const fileTotal = document.createElement("small");
      fileTotal.className = "category-admin-file-count";
      fileTotal.textContent = `${countCategoryFiles(category.id)} ملف تابع`;
      info.append(name, status, fileTotal);
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
      toggle.textContent = category.is_active ? "إخفاء" : "إظهار";
      toggle.setAttribute("aria-label", `${category.is_active ? "إخفاء" : "إظهار"} ${category.name_ar}`);
      toggle.addEventListener("click", async () => {
        try {
          assertSuccess(await client.from("categories").update({
            is_active: !category.is_active,
          }).eq("id", category.id));
          await loadData();
        } catch (error) { notify(error.message, true); }
      });
      const review = document.createElement("a");
      review.className = "secondary-button small-button";
      review.textContent = "معاينة";
      const root = getRootCategory(category);
      if (root?.semester_id) {
        review.href = `../?semester=${encodeURIComponent(root.semester_id)}&category=${encodeURIComponent(category.id)}#library`;
        review.target = "_blank";
        review.rel = "noopener";
      } else {
        review.href = "../#library";
      }
      const remove = document.createElement("button");
      remove.className = "danger-button small-button";
      remove.textContent = "حذف";
      remove.addEventListener("click", async () => {
        const childCount = categories.filter((item) => item.parent_id === category.id).length;
        const directFileCount = files.filter((item) => item.category_id === category.id).length;
        if (childCount || directFileCount) {
          const contents = [
            childCount ? `${childCount} تصنيف فرعي` : "",
            directFileCount ? `${directFileCount} ملف مرتبط` : "",
          ].filter(Boolean).join(" و");
          notify(`لا يمكن حذف «${category.name_ar}» لأنه يحتوي على ${contents}. أخفِه بدلًا من ذلك أو انقل محتواه أولًا.`, true);
          return;
        }
        if (!window.confirm(`حذف التصنيف الفارغ «${category.name_ar}» نهائيًا؟ يمكنك إخفاؤه بدل الحذف.`)) return;
        try {
          assertSuccess(await client.from("categories").delete().eq("id", category.id));
          await loadData();
        } catch (error) {
          notify(`تعذر حذف التصنيف. انقل ملفاته أولًا إن وُجدت. ${error.message}`, true);
        }
      });
      actions.append(up, down, edit, review, toggle, remove);
      actions.hidden = localFeaturePreview;
      row.append(info, actions);
      return row;
    }),
  );
  renderCategoryCardPreview();
}

function countCategoryFiles(categoryId) {
  const descendants = new Set([categoryId]);
  let changed;
  do {
    changed = false;
    for (const category of categories) {
      if (descendants.has(category.parent_id) && !descendants.has(category.id)) {
        descendants.add(category.id);
        changed = true;
      }
    }
  } while (changed);
  return new Set(files.filter((file) => file.is_published && descendants.has(file.category_id))
    .map((file) => file.id)).size;
}

function renderCategoryCardPreview() {
  const name = categoryForm.elements.name_ar.value.trim() || "اسم التصنيف";
  const description = categoryForm.elements.description.value.trim();
  const iconValue = categoryForm.elements.icon.value.trim() || "📁";
  const status = categoryForm.elements.category_status.value;
  const editingCategoryId = categoryForm.elements.id.value;
  const fileCount = editingCategoryId ? countCategoryFiles(editingCategoryId) : 0;

  categoryPreviewName.textContent = name;
  categoryPreviewDescription.textContent = description;
  categoryPreviewDescription.hidden = !description;
  categoryPreviewCount.textContent = `${fileCount} ملف`;
  categoryPreviewStatus.textContent = status === "coming_soon"
    ? "قريبًا"
    : status === "hidden" ? "مخفي" : "متاح الآن";
  categoryPreviewCard.classList.toggle("is-coming-soon", status === "coming_soon");
  categoryPreviewCard.classList.toggle("is-hidden", status === "hidden");
  categoryPreviewIcon.replaceChildren();
  categoryPreviewIcon.classList.remove("has-custom-icon");

  if (iconValue && !["📁", "folder", "default"].includes(iconValue.toLowerCase())) {
    categoryPreviewIcon.textContent = iconValue;
    categoryPreviewIcon.classList.add("has-custom-icon");
    delete categoryPreviewIcon.dataset.theme;
    return;
  }

  const searchableName = `${categoryForm.elements.name_ar.value} ${categoryForm.elements.name_en.value}`.toLowerCase();
  const iconThemes = [
    ["exam", /امتحان|اختبار|exam|test|quiz/],
    ["lecture", /محاضر|lecture|lesson/],
    ["section", /سكشن|section|tutorial/],
    ["tax", /ضرائب|ضريبة|tax/],
    ["finance", /مالية|اقتصاد|مال|finance|financial|econom/],
    ["calculator", /محاسب|تكلفة|تكاليف|حساب|account|cost|calcul/],
    ["business", /منشآت|اعمال|business|enterprise/],
    ["library", /مكتبة|سنتر|سناتر|مركز|كتاب|library|center|centre|book/],
    ["document", /ملخص|مذكرة|ورق|مراجعة|document|summary|note|review/],
  ];
  const theme = iconThemes.find(([, pattern]) => pattern.test(searchableName))?.[0] || "folder";
  const iconPaths = {
    exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 11l1.8 1.8 4-4M8.5 17h7"/>',
    lecture: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="m10 9 5 2-5 2zM8 20h8m-4-3.5V20"/>',
    section: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19zM16 5.5a3 3 0 0 1 0 5.8m1.5 2.2a4.5 4.5 0 0 1 3 4.2V19"/>',
    tax: '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z"/><path d="M14 3.5V8h4M9 12h6m-6 4h2m2 0h2"/>',
    finance: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.7-.7-1.7-1-3-1-1.8 0-3 .9-3 2.2 0 3.2 6 1.3 6 4.4 0 1.3-1.2 2.3-3.2 2.3-1.5 0-2.7-.5-3.5-1.3M12 5.5v13"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/>',
    business: '<path d="M3 21h18M5 21V6l7-3 7 3v15M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>',
    library: '<path d="M4 19.5V5.8a2 2 0 0 1 2-2h13v15.7H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 1 2-2h13"/><path d="M8 7h7M8 10h7"/>',
    document: '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z"/><path d="M14 3.5V8h4M9 12h6m-6 4h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>',
  };
  categoryPreviewIcon.dataset.theme = theme;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = iconPaths[theme];
  categoryPreviewIcon.append(svg);
}

categoryForm.addEventListener("input", renderCategoryCardPreview);
categoryForm.addEventListener("change", renderCategoryCardPreview);

function renderSemesters() {
  semesterAdminList.replaceChildren(...[...semesters]
    .sort((first, second) => first.position - second.position)
    .map((semester, index) => {
      const form = document.createElement("form");
      form.className = "semester-admin-row";
      const heading = document.createElement("div");
      heading.className = "semester-admin-heading";
      const title = document.createElement("strong");
      title.textContent = semester.name;
      const total = document.createElement("span");
      const linked = categories.filter((category) =>
        getRootCategory(category)?.semester_id === semester.id);
      const ids = new Set(linked.map((category) => category.id));
      const fileCount = new Set(files.filter((file) => file.is_published && ids.has(file.category_id))
        .map((file) => file.id)).size;
      const subjectCount = semester.id === firstSemesterId
        ? 6
        : semester.subject_count || linked.filter((category) => !category.parent_id).length;
      total.textContent = `${fileCount} ملف · ${subjectCount} مواد`;
      heading.append(title, total);
      const name = document.createElement("label");
      name.textContent = "الاسم";
      const nameInput = document.createElement("input");
      nameInput.name = "name";
      nameInput.required = true;
      nameInput.value = semester.name;
      name.append(nameInput);
      const description = document.createElement("label");
      description.textContent = "الوصف";
      const descriptionInput = document.createElement("textarea");
      descriptionInput.name = "description";
      descriptionInput.rows = 2;
      descriptionInput.value = semester.description || "";
      description.append(descriptionInput);
      const icon = document.createElement("label");
      icon.textContent = "الأيقونة";
      const iconInput = document.createElement("input");
      iconInput.name = "icon";
      iconInput.maxLength = 8;
      iconInput.value = semester.icon || "📚";
      icon.append(iconInput);
      const badge = document.createElement("label");
      badge.textContent = "النص الظاهر على البطاقة";
      const badgeInput = document.createElement("input");
      badgeInput.name = "display_text";
      badgeInput.maxLength = 60;
      badgeInput.value = semester.display_text || "";
      badge.append(badgeInput);
      const statusField = document.createElement("label");
      statusField.textContent = "الحالة";
      const statusSelect = document.createElement("select");
      statusSelect.name = "status";
      for (const [value, label] of [["active", "متاح"], ["coming_soon", "قريبًا"], ["hidden", "مخفي"]]) {
        statusSelect.add(new Option(label, value, false, semester.status === value));
      }
      statusField.append(statusSelect);
      const preview = document.createElement("div");
      preview.className = `semester-card semester-admin-preview${semester.status === "coming_soon" ? " is-coming-soon" : ""}`;
      preview.setAttribute("role", "img");
      preview.setAttribute("aria-live", "polite");
      const previewIcon = document.createElement("span");
      previewIcon.className = "semester-icon";
      previewIcon.setAttribute("aria-hidden", "true");
      const previewContent = document.createElement("span");
      previewContent.className = "semester-card-content";
      const previewStatus = document.createElement("span");
      previewStatus.className = "semester-status";
      const previewTitle = document.createElement("strong");
      const previewDescription = document.createElement("span");
      previewDescription.className = "semester-description";
      const previewStats = document.createElement("span");
      previewStats.className = "semester-stats";
      const previewArrow = document.createElement("span");
      previewArrow.className = "semester-arrow";
      previewArrow.setAttribute("aria-hidden", "true");
      previewArrow.textContent = "←";
      previewContent.append(previewStatus, previewTitle, previewDescription, previewStats);
      preview.append(previewIcon, previewContent, previewArrow);
      const updatePreview = () => {
        const comingSoon = statusSelect.value === "coming_soon";
        preview.classList.toggle("is-coming-soon", comingSoon);
        previewStatus.textContent = statusSelect.value === "hidden"
          ? "مخفي"
          : badgeInput.value.trim() || (comingSoon ? "قريبًا" : "متاح الآن");
        previewTitle.textContent = nameInput.value.trim() || "اسم الترم";
        previewDescription.textContent = descriptionInput.value.trim();
        previewIcon.textContent = iconInput.value.trim() || "📚";
        previewStats.textContent = `${fileCount} ملف · ${subjectCount} مواد`;
        preview.setAttribute(
          "aria-label",
          `${previewTitle.textContent}، ${previewStatus.textContent}، ${previewStats.textContent}`,
        );
      };
      for (const field of [nameInput, descriptionInput, iconInput, badgeInput, statusSelect]) {
        field.addEventListener("input", updatePreview);
        field.addEventListener("change", updatePreview);
      }
      updatePreview();
      const actions = document.createElement("div");
      actions.className = "semester-admin-actions";
      for (const direction of [-1, 1]) {
        const move = document.createElement("button");
        move.type = "button";
        move.className = "secondary-button small-button";
        move.textContent = direction < 0 ? "↑" : "↓";
        move.disabled = index + direction < 0 || index + direction >= semesters.length;
        move.setAttribute("aria-label", `${direction < 0 ? "تقديم" : "تأخير"} ${semester.name}`);
        move.addEventListener("click", () => { void moveSemester(semester, direction); });
        actions.append(move);
      }
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "primary-button";
      save.textContent = "حفظ";
      actions.append(save);
      form.append(heading, preview, name, description, icon, badge, statusField, actions);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const update = {
          name: values.get("name").trim(),
          description: values.get("description").trim(),
          icon: values.get("icon").trim() || "📚",
          display_text: values.get("display_text").trim(),
          status: values.get("status"),
        };
        try {
          if (localFeaturePreview) {
            Object.assign(semester, update);
            localStorage.setItem("course-library-feature-preview-semesters", JSON.stringify(semesters));
          } else {
            assertSuccess(await client.from("semesters").update(update).eq("id", semester.id));
          }
          await loadData();
          notify("تم حفظ إعدادات الفصل الدراسي.");
        } catch (error) { notify(error.message, true); }
      });
      return form;
    }));
  semesterManagementNote.hidden = localFeaturePreview || semesters.length > 0;
  semesterManagementNote.textContent = "شغّل database/semester-library-migration.sql لإعداد تخزين الفصول الدراسيّة.";
}

function getRootCategory(category) {
  let root = category;
  const visited = new Set();
  while (root?.parent_id && !visited.has(root.id)) {
    visited.add(root.id);
    root = categories.find((item) => item.id === root.parent_id);
  }
  return root;
}

async function moveSemester(semester, direction) {
  const ordered = [...semesters].sort((first, second) => first.position - second.position);
  const index = ordered.findIndex((item) => item.id === semester.id);
  const next = index + direction;
  if (next < 0 || next >= ordered.length) return;
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  try {
    if (localFeaturePreview) {
      ordered.forEach((item, position) => { item.position = position; });
      localStorage.setItem("course-library-feature-preview-semesters", JSON.stringify(ordered));
    } else {
      for (const [position, item] of ordered.entries()) {
        assertSuccess(await client.from("semesters").update({ position }).eq("id", item.id));
      }
    }
    await loadData();
  } catch (error) { notify(error.message, true); }
}

function categoryPath(category) {
  const parts = [category.name_ar];
  let parent = categories.find((item) => item.id === category.parent_id);
  const visited = new Set([category.id]);
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);
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
  const semesterOptions = semesters.map((semester) =>
    new Option(semester.name, semester.id));
  categoryForm.elements.semester_id.replaceChildren(...semesterOptions);
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

function fileCategoryLabel(file) {
  const category = categories.find((item) => item.id === file.category_id) || file.categories;
  return category ? categoryPath(category) : "بلا تصنيف";
}

function renderFiles() {
  const query = fileSearch.value.trim().toLocaleLowerCase();
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const orderedFiles = [...files].sort((a, b) =>
    (categoryOrder.get(a.category_id) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(b.category_id) ?? Number.MAX_SAFE_INTEGER) ||
    a.position - b.position || new Date(b.created_at) - new Date(a.created_at),
  );
  const visibleFiles = orderedFiles.filter((file) =>
    `${file.name} ${file.description} ${fileCategoryLabel(file)}`
      .toLocaleLowerCase()
      .includes(query),
  );
  fileCount.textContent = `${visibleFiles.length} من ${files.length} ملف`;
  renderOverview();
  updateFileSelectionControls(visibleFiles);
  const visibleGroups = new Map();
  for (const file of visibleFiles) {
    const categoryId = file.category_id || "__uncategorized";
    const group = visibleGroups.get(categoryId) || [];
    group.push(file);
    visibleGroups.set(categoryId, group);
  }
  const renderedRows = [];
  let previousCategoryId;
  visibleFiles.forEach((file) => {
    const categoryId = file.category_id || "__uncategorized";
    const groupFiles = visibleGroups.get(categoryId);
    if (categoryId !== previousCategoryId) {
      const heading = document.createElement("tr");
      heading.className = "file-category-heading";
      const headingCell = document.createElement("td");
      headingCell.colSpan = 7;
      const summary = document.createElement("div");
      summary.className = "file-category-summary";
      const name = document.createElement("strong");
      name.textContent = fileCategoryLabel(file);
      const count = document.createElement("span");
      count.className = "file-category-count";
      count.textContent = `${groupFiles.length} ملف`;
      summary.append(name, count);
      headingCell.append(summary);
      heading.append(headingCell);
      renderedRows.push(heading);
      previousCategoryId = categoryId;
    }
    const row = document.createElement("tr");
    const selectionCell = document.createElement("td");
    selectionCell.className = "file-select-cell";
    const selection = document.createElement("input");
    selection.type = "checkbox";
    selection.checked = selectedFileIds.has(file.id);
    selection.disabled = Boolean(fileEditQueue);
    selection.setAttribute("aria-label", `تحديد ${file.name} للتعديل`);
    selection.addEventListener("change", () => {
      if (selection.checked) selectedFileIds.add(file.id);
      else selectedFileIds.delete(file.id);
      updateFileSelectionControls(visibleFiles);
    });
    selectionCell.append(selection);
    row.append(selectionCell);
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
      if (label === "التصنيف") cell.className = "file-category-value";
      cell.textContent = value;
      row.append(cell);
    }
    const actions = document.createElement("td");
    actions.className = "table-actions";
    const edit = document.createElement("button");
    edit.className = "secondary-button small-button";
    edit.textContent = "تعديل";
    edit.disabled = Boolean(fileEditQueue);
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
    const index = groupFiles.findIndex((item) => item.id === file.id);
    up.disabled = index === 0;
    up.addEventListener("click", () => moveFile(file, -1));
    const down = document.createElement("button");
    down.className = "secondary-button small-button";
    down.textContent = "↓";
    down.setAttribute("aria-label", `تحريك ${file.name} للأسفل`);
    down.disabled = index === groupFiles.length - 1;
    down.addEventListener("click", () => moveFile(file, 1));
    const remove = document.createElement("button");
    remove.className = "danger-button small-button";
    remove.textContent = "حذف";
    remove.addEventListener("click", () => deleteFile(file));
    actions.append(edit, toggle, up, down, remove);
    row.append(actions);
    renderedRows.push(row);
  });
  fileTableBody.replaceChildren(...renderedRows);
}

function updateFileSelectionControls(visibleFiles = []) {
  const visibleSelectedCount = visibleFiles
    .filter((file) => selectedFileIds.has(file.id)).length;
  fileSelectVisible.checked = visibleFiles.length > 0 &&
    visibleSelectedCount === visibleFiles.length;
  fileSelectVisible.indeterminate = visibleSelectedCount > 0 &&
    visibleSelectedCount < visibleFiles.length;
  fileSelectVisible.disabled = Boolean(fileEditQueue) || visibleFiles.length === 0;
  fileSelectionCount.textContent = selectedFileIds.size
    ? `تم تحديد ${selectedFileIds.size} ملف`
    : "لم يتم تحديد ملفات";
  editSelectedFiles.disabled = Boolean(fileEditQueue) || selectedFileIds.size === 0 ||
    Boolean(fileUploadBatch?.running) || isUploadBatchRunning;
  editSelectedFiles.textContent = fileEditQueue
    ? "التعديل المتتابع جارٍ"
    : "تعديل المحدد";
}

function startSelectedFileEdit() {
  if (fileEditQueue || selectedFileIds.size === 0) return;
  if (fileUploadBatch?.running || isUploadBatchRunning) {
    notify("انتظر انتهاء رفع الملفات قبل بدء التعديل المتتابع.", true);
    return;
  }
  const orderedFiles = [...files].sort((a, b) =>
    a.position - b.position || new Date(b.created_at) - new Date(a.created_at),
  );
  fileEditQueue = orderedFiles
    .filter((file) => selectedFileIds.has(file.id))
    .map((file) => file.id);
  if (!fileEditQueue.length) {
    selectedFileIds.clear();
    updateFileSelectionControls();
    notify("لم تعد الملفات المحددة متاحة.", true);
    return;
  }
  fileEditQueueIndex = 0;
  renderFiles();
  showFileEditQueueItem();
}

function showFileEditQueueItem() {
  const fileId = fileEditQueue?.[fileEditQueueIndex];
  const file = files.find((item) => item.id === fileId);
  if (!file) return;
  fileEditQueueStatus.hidden = false;
  fileEditQueueStatus.textContent =
    `تعديل الملف ${fileEditQueueIndex + 1} من ${fileEditQueue.length}: ${file.name}. احفظه للانتقال إلى الملف التالي.`;
  editFile(file);
}

function advanceFileEditQueue(savedFileId, isLocalPreview = false) {
  if (!fileEditQueue || fileEditQueue[fileEditQueueIndex] !== savedFileId) return false;
  const savedFile = files.find((item) => item.id === savedFileId);
  fileEditQueueIndex += 1;
  while (fileEditQueueIndex < fileEditQueue.length &&
    !files.some((item) => item.id === fileEditQueue[fileEditQueueIndex])) {
    fileEditQueueIndex += 1;
  }
  if (fileEditQueueIndex < fileEditQueue.length) {
    showFileEditQueueItem();
    notify(isLocalPreview
      ? `تم حفظ «${savedFile?.name || "الملف"}» في المعاينة المحلية. يمكنك الآن تعديل الملف التالي.`
      : `تم حفظ «${savedFile?.name || "الملف"}». يمكنك الآن تعديل الملف التالي.`);
    return true;
  }
  fileEditQueue = null;
  fileEditQueueIndex = -1;
  selectedFileIds.clear();
  fileEditQueueStatus.hidden = true;
  updateFileSelectionControls();
  renderFiles();
  notify(isLocalPreview
    ? "تم حفظ بيانات جميع الملفات المحددة في المعاينة المحلية فقط."
    : "تم حفظ جميع الملفات المحددة.");
  return true;
}

async function moveFile(file, direction) {
  const ordered = files.filter((item) => item.category_id === file.category_id).sort((a, b) =>
    a.position - b.position || new Date(b.created_at) - new Date(a.created_at),
  );
  const index = ordered.findIndex((item) => item.id === file.id);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ordered.length) return;
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  try {
    if (localFeaturePreview) {
      const positions = new Map(ordered.map((item, position) => [item.id, position]));
      files = files.map((item) => positions.has(item.id)
        ? { ...item, position: positions.get(item.id) }
        : item);
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

async function uploadAsset(file, prefix, onProgress = () => {}, options = {}) {
  const { signal, objectPath: savedPath, upsert = false } = options;
  const extension = file.name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() || "";
  const path = savedPath || `${prefix}/${crypto.randomUUID()}${extension}`;
  const contentType = getUploadMimeType(file);
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("انتهت جلسة الإدارة. سجّل الدخول مجددًا ثم أعد الرفع.");

  if (file.size > resumableUploadThreshold) {
    const Upload = await loadTusUpload();
    const endpoint = new URL("/storage/v1/upload/resumable", supabaseConfig.url).href;
    await new Promise((resolve, reject) => {
      let settled = false;
      let upload;
      const cleanup = () => signal?.removeEventListener("abort", abort);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const abort = () => {
        void upload?.abort(true).catch(() => {});
        finish(reject, new DOMException("تم إلغاء الرفع.", "AbortError"));
      };
      upload = new Upload(file, {
        endpoint,
        chunkSize: resumableUploadThreshold,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          apikey: supabaseConfig.anonKey,
          "x-upsert": String(upsert),
        },
        metadata: {
          bucketName: "library-files",
          objectName: path,
          contentType,
        },
        onError: (uploadError) => finish(reject, uploadError),
        onProgress: (uploadedBytes) => onProgress(uploadedBytes, file.size),
        onSuccess: () => {
          onProgress(file.size, file.size);
          finish(resolve, path);
        },
      });
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      upload.start();
    });
    return path;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await uploadObjectWithXhr({
        supabaseUrl: supabaseConfig.url,
        bucket: "library-files",
        objectPath: path,
        file,
        contentType,
        accessToken: data.session.access_token,
        anonKey: supabaseConfig.anonKey,
        upsert: upsert || attempt > 0,
        signal,
        onProgress,
      });
    } catch (uploadError) {
      if (signal?.aborted || !uploadError.retryable || attempt === 2) throw uploadError;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw new Error("تعذر رفع الملف بعد عدة محاولات.");
}

async function loadTusUpload() {
  if (window.tus?.Upload) return window.tus.Upload;
  tusClientPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js";
    script.async = true;
    script.onload = () => {
      if (window.tus?.Upload) resolve(window.tus.Upload);
      else reject(new Error("تعذر تهيئة الرفع المجزّأ. أعد المحاولة."));
    };
    script.onerror = () => reject(new Error("تعذر تحميل مكوّن الرفع المجزّأ. تحقق من الاتصال وحاول مجددًا."));
    document.head.append(script);
  });
  try {
    return await tusClientPromise;
  } catch (error) {
    tusClientPromise = null;
    throw error;
  }
}

function createUploadObjectPath(file, prefix) {
  const extension = file.name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() || "";
  return `${prefix}/${crypto.randomUUID()}${extension}`;
}

function safeUploadError(error) {
  if (error?.name === "AbortError") return "أُوقف هذا الرفع.";
  return String(error?.message || "تعذر رفع الملف.")
    .replace(/\b(?:bearer|token|apikey|service.role)\b\s*[:=]?\s*\S+/gi, "بيانات اعتماد")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
}

function renderUploadFileStatus(entry) {
  if (!entry.elements) {
    const item = document.createElement("li");
    item.className = "upload-file-status";
    const name = document.createElement("strong");
    name.className = "upload-file-status-name";
    name.textContent = entry.file.name;
    const state = document.createElement("span");
    state.className = "upload-file-status-state";
    const progress = document.createElement("progress");
    progress.max = 100;
    progress.setAttribute("aria-label", `تقدم رفع ${entry.file.name}`);
    const error = document.createElement("p");
    error.className = "upload-file-status-error";
    item.append(name, state, progress, error);
    uploadFileStatuses.append(item);
    entry.elements = { item, state, progress, error };
  }

  const labels = {
    waiting: "في الانتظار",
    uploading: "جارٍ الرفع",
    completed: "اكتمل",
    failed: "فشل",
  };
  const percent = Math.floor(entry.progress || 0);
  entry.elements.item.dataset.state = entry.status;
  entry.elements.state.textContent = entry.status === "uploading"
    ? `${labels[entry.status]} · ${percent}%`
    : labels[entry.status];
  entry.elements.progress.value = percent;
  entry.elements.progress.hidden = entry.status === "waiting";
  entry.elements.error.textContent = entry.error || "";
  entry.elements.error.hidden = !entry.error;
}

function setUploadEntryProgress(batch, entry, bytes) {
  const nextBytes = Math.max(0, Math.min(entry.totalBytes, bytes));
  batch.transferredBytes += nextBytes - entry.progressBytes;
  entry.progressBytes = nextBytes;
  entry.progress = entry.totalBytes ? (nextBytes / entry.totalBytes) * 100 : 100;
  renderUploadFileStatus(entry);
  uploadProgress.value = Math.max(0, batch.transferredBytes);
}

function renderUploadBatch(batch) {
  for (const entry of batch.entries) renderUploadFileStatus(entry);
  uploadProgress.max = Math.max(1, batch.totalBytes);
  uploadProgress.value = Math.max(0, batch.transferredBytes);
  uploadProgress.hidden = false;
  uploadStatus.hidden = false;
  const completed = batch.entries.filter((entry) => entry.saved).length;
  uploadStatus.textContent = batch.running
    ? `جارٍ رفع ${batch.entries.length} ملفات · تم حفظ ${completed}`
    : `تم حفظ ${completed} من ${batch.entries.length} ملف`;

  const submit = fileForm.querySelector('[type="submit"]');
  const cancelEdit = document.querySelector("#cancel-edit");
  const incomplete = batch.entries.some((entry) => !entry.saved);
  submit.textContent = incomplete && !batch.running
    ? "إعادة محاولة الملفات غير المكتملة"
    : "حفظ الملف";
  cancelEdit.textContent = incomplete ? "إنهاء الدفعة" : "إلغاء التعديل";
  cancelEdit.hidden = !incomplete || batch.running;
  cancelCurrentUploads.hidden = !batch.running;
  uploadInput.disabled = incomplete;
  uploadEditors.querySelectorAll('input[type="file"]').forEach((input) => {
    input.disabled = incomplete;
  });
  fileSelection.querySelectorAll("button").forEach((button) => {
    button.disabled = incomplete;
  });
}

function createFileUploadBatch(entries, basePosition) {
  uploadFileStatuses.replaceChildren();
  const batchEntries = entries.map(({ file, draft }, index) => {
    const coverSize = draft.cover?.size || 0;
    return {
      index,
      file,
      draft,
      objectPath: null,
      coverPath: null,
      documentUploaded: false,
      coverUploaded: false,
      documentAttempts: 0,
      coverAttempts: 0,
      saved: false,
      status: "waiting",
      error: "",
      progress: 0,
      progressBytes: 0,
      totalBytes: file.size + coverSize,
      elements: null,
    };
  });
  const batch = {
    entries: batchEntries,
    basePosition,
    totalBytes: batchEntries.reduce((total, entry) => total + entry.totalBytes, 0),
    transferredBytes: 0,
    running: false,
    controller: null,
  };
  fileUploadBatch = batch;
  return batch;
}

function fileRecordForUploadEntry(entry, basePosition) {
  return {
    name: entry.draft.name.trim(),
    description: entry.draft.description,
    category_id: entry.draft.categoryId,
    object_path: entry.objectPath,
    cover_path: entry.coverPath,
    mime_type: getUploadMimeType(entry.file),
    size_bytes: entry.file.size,
    is_published: entry.draft.isPublished,
    is_new: entry.draft.isPublished,
    position: basePosition + entry.index,
  };
}

async function processFileUploadBatch(batch) {
  if (batch.running || isUploadBatchRunning) return;
  batch.running = true;
  isUploadBatchRunning = true;
  batch.controller = new AbortController();
  uploadBatchAbortController = batch.controller;
  const signal = batch.controller.signal;
  const readyToSave = [];
  let notificationWarning = "";
  renderUploadBatch(batch);

  try {
    const pendingUploads = batch.entries.filter((entry) =>
      !entry.saved && (!entry.documentUploaded || (entry.draft.cover && !entry.coverUploaded)),
    );
    await runUploadQueue(pendingUploads, async (entry) => {
      const cover = entry.draft.cover;
      const uploadedBytes = (entry.documentUploaded ? entry.file.size : 0) +
        (entry.coverUploaded ? cover?.size || 0 : 0);
      setUploadEntryProgress(batch, entry, uploadedBytes);

      if (!entry.objectPath) entry.objectPath = createUploadObjectPath(entry.file, "documents");
      if (!entry.documentUploaded) {
        entry.documentAttempts += 1;
        await uploadAsset(entry.file, "documents", (bytesUploaded) => {
          setUploadEntryProgress(batch, entry, bytesUploaded + (entry.coverUploaded ? cover?.size || 0 : 0));
        }, {
          signal,
          objectPath: entry.objectPath,
          upsert: entry.documentAttempts > 1,
        });
        entry.documentUploaded = true;
        setUploadEntryProgress(batch, entry, entry.file.size + (entry.coverUploaded ? cover?.size || 0 : 0));
      }

      if (cover && !entry.coverUploaded) {
        if (!entry.coverPath) entry.coverPath = createUploadObjectPath(cover, "covers");
        entry.coverAttempts += 1;
        await uploadAsset(cover, "covers", (bytesUploaded) => {
          setUploadEntryProgress(batch, entry, (entry.documentUploaded ? entry.file.size : 0) + bytesUploaded);
        }, {
          signal,
          objectPath: entry.coverPath,
          upsert: entry.coverAttempts > 1,
        });
        entry.coverUploaded = true;
        setUploadEntryProgress(batch, entry, entry.totalBytes);
      }
    }, uploadConcurrency, {
      signal,
      onChange: (entry) => renderUploadFileStatus(entry),
    });

    for (const entry of batch.entries) {
      if (!entry.saved && entry.status === "failed") {
        const uploadedBytes = (entry.documentUploaded ? entry.file.size : 0) +
          (entry.coverUploaded ? entry.draft.cover?.size || 0 : 0);
        setUploadEntryProgress(batch, entry, uploadedBytes);
      }
    }

    readyToSave.push(...batch.entries.filter((entry) =>
      !entry.saved && entry.documentUploaded && (!entry.draft.cover || entry.coverUploaded),
    ));
    if (readyToSave.length) {
      try {
        const paths = readyToSave.map((entry) => entry.objectPath);
        const existingRows = assertSuccess(await client.from("files")
          .select("id, name, description, category_id, is_published, object_path")
          .in("object_path", paths));
        const knownPaths = new Set(existingRows.map((row) => row.object_path));
        const missingEntries = readyToSave.filter((entry) => !knownPaths.has(entry.objectPath));
        let insertedRows = [];
        if (missingEntries.some((entry) => entry.draft.isPublished)) {
          assertSuccess(await client.from("files").update({ is_new: false }).eq("is_new", true));
        }
        if (missingEntries.length) {
          insertedRows = assertSuccess(await client.from("files")
            .insert(missingEntries.map((entry) => fileRecordForUploadEntry(entry, batch.basePosition)))
            .select("id, name, description, category_id, is_published, object_path"));
        }
        const rowsByPath = new Map([...existingRows, ...insertedRows].map((row) => [row.object_path, row]));
        for (const entry of readyToSave) {
          if (!rowsByPath.has(entry.objectPath)) {
            entry.status = "failed";
            entry.error = "تم رفع الملف لكن تعذر تأكيد حفظ بياناته. أعد المحاولة.";
            continue;
          }
          entry.saved = true;
          entry.status = "completed";
          entry.error = "";
          setUploadEntryProgress(batch, entry, entry.totalBytes);
        }
        if (insertedRows.some((row) => row.is_published)) {
          try {
            notificationWarning = await publishFileNotifications(insertedRows.filter((row) => row.is_published));
          } catch (error) {
            notificationWarning = `تعذر نشر إشعار بعض الملفات: ${safeUploadError(error)}`;
          }
        }
        await loadData();
      } catch (error) {
        for (const entry of readyToSave) {
          if (entry.saved) continue;
          entry.status = "failed";
          entry.error = `تم رفع الملف لكن تعذر حفظ بياناته: ${safeUploadError(error)}`;
        }
      }
    }

    const unsavedEntries = batch.entries.filter((entry) => !entry.saved);
    if (!unsavedEntries.length) {
      const count = batch.entries.length;
      batch.running = false;
      isUploadBatchRunning = false;
      uploadBatchAbortController = null;
      batch.controller = null;
      resetFileForm();
      notify(notificationWarning || `تم رفع وحفظ ${count} ملفًا بنجاح.`, Boolean(notificationWarning));
      return;
    }

    const failedCount = unsavedEntries.length;
    const message = signal.aborted
      ? `أُوقف الرفع. تم حفظ الملفات المكتملة، وبقي ${failedCount} ملف لإكماله أو إعادة محاولته.`
      : `تم حفظ الملفات المكتملة، وتعثر ${failedCount}. أعد المحاولة من الزر؛ ستُعاد الملفات غير المكتملة فقط.`;
    notify(notificationWarning ? `${message} ${notificationWarning}` : message, true);
  } catch (error) {
    for (const entry of batch.entries) {
      if (!entry.saved && entry.status === "uploading") {
        entry.status = "failed";
        entry.error = safeUploadError(error);
      }
    }
    notify(`تعذر إكمال دفعة الرفع: ${safeUploadError(error)}`, true);
  } finally {
    batch.running = false;
    isUploadBatchRunning = false;
    uploadBatchAbortController = null;
    batch.controller = null;
    if (fileUploadBatch === batch) renderUploadBatch(batch);
  }
}

async function uploadNotificationImage(file) {
  const extension = file.name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0].toLowerCase() || "";
  const path = `${crypto.randomUUID()}/${crypto.randomUUID()}${extension}`;
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) throw new Error("انتهت جلسة الإدارة. سجّل الدخول مجددًا ثم أعد الرفع.");
  try {
    await uploadObjectWithXhr({
      supabaseUrl: supabaseConfig.url,
      bucket: "notification-images",
      objectPath: path,
      file,
      contentType: file.type,
      accessToken: session.session.access_token,
      anonKey: supabaseConfig.anonKey,
    });
  } catch (error) {
    if (
      /bucket.*not found|not found.*bucket/i.test(error.message || "")
    ) {
      throw new Error("صورة الإشعار تحتاج تشغيل database/notifications-migration.sql أولًا.");
    }
    throw error;
  }
  return path;
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
    const id = values.get("id");
    const parentId = values.get("parent_id") || null;
    const status = values.get("category_status");
    const rootParent = parentId
      ? getRootCategory(categories.find((category) => category.id === parentId))
      : null;
    if (id) {
      let parent = categories.find((category) => category.id === parentId);
      const visited = new Set();
      while (parent) {
        if (parent.id === id) throw new Error("لا يمكن نقل التصنيف داخل نفسه أو داخل تصنيف فرعي منه.");
        if (visited.has(parent.id)) throw new Error("تعذر نقل التصنيف بسبب وجود حلقة في شجرة التصنيفات.");
        visited.add(parent.id);
        parent = categories.find((category) => category.id === parent.parent_id);
      }
    }
    const updates = {
      name_ar: values.get("name_ar").trim(),
      name_en: values.get("name_en").trim(),
      parent_id: parentId,
      semester_id: parentId ? rootParent?.semester_id || null : values.get("semester_id") || null,
      description: values.get("description").trim(),
      icon: values.get("icon").trim() || "📁",
      is_active: status !== "hidden",
      is_coming_soon: status === "coming_soon",
    };
    if (localFeaturePreview) {
      if (categories.some((category) => category.name_ar === updates.name_ar && category.id !== id)) {
        throw new Error("اسم التصنيف موجود بالفعل في المعاينة.");
      }
      if (id) {
        Object.assign(categories.find((category) => category.id === id), updates);
      } else {
        categories.push({
          ...updates,
          id: crypto.randomUUID(),
          position: categories.filter((category) => category.parent_id === parentId).length,
        });
      }
      localStorage.setItem("course-library-feature-preview", JSON.stringify(categories));
      categoryForm.reset();
      resetCategoryForm();
      await loadData();
      notify(`تم حفظ التصنيف في المعاينة المحلية فقط؛ لم يتغير الموقع أو قاعدة البيانات.`);
      return;
    }
    if (id) {
      assertSuccess(await client.from("categories").update(updates).eq("id", id));
    } else {
      assertSuccess(await client.from("categories").insert({
        ...updates,
        position: categories.filter((category) => category.parent_id === parentId).length,
      }));
    }
    categoryForm.reset();
    resetCategoryForm();
    await loadData();
    notify(id ? "تم تحديث التصنيف." : "تمت إضافة التصنيف.");
  } catch (error) { notify(error.message, true); }
});

function editCategory(category) {
  categoryForm.elements.id.value = category.id;
  categoryForm.elements.name_ar.value = category.name_ar;
  categoryForm.elements.name_en.value = category.name_en || "";
  categoryForm.elements.description.value = category.description || "";
  categoryForm.elements.icon.value = category.icon || "📁";
  categoryForm.elements.parent_id.value = category.parent_id || "";
  categoryForm.elements.category_status.value = category.is_coming_soon
    ? "coming_soon"
    : category.is_active ? "active" : "hidden";
  categoryForm.elements.semester_id.value = getRootCategory(category)?.semester_id || "";
  document.querySelector(".category-submit").textContent = "حفظ التعديلات";
  cancelCategoryEdit.hidden = false;
  renderParentCategoryOptions();
  categoryForm.elements.parent_id.value = category.parent_id || "";
  categoryForm.elements.semester_id.value = getRootCategory(category)?.semester_id || "";
  renderCategoryCardPreview();
  categoryForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetCategoryForm() {
  categoryForm.elements.id.value = "";
  document.querySelector(".category-submit").textContent = "＋ إضافة التصنيف";
  cancelCategoryEdit.hidden = true;
  renderParentCategoryOptions();
  renderCategoryCardPreview();
}

cancelCategoryEdit.addEventListener("click", () => {
  categoryForm.reset();
  resetCategoryForm();
});

function editFile(file) {
  if (fileUploadBatch?.running) return;
  resetFileForm();
  fileForm.elements.id.value = file.id;
  fileForm.elements.name.value = file.name;
  fileForm.elements.description.value = file.description || "";
  fileForm.elements.position.value = file.position;
  fileForm.elements.is_published.checked = file.is_published;
  renderCategoryOptions(file.category_id);
  document.querySelector("#file-form-heading").textContent = "تعديل الملف";
  document.querySelector("#cancel-edit").textContent = fileEditQueue
    ? "إنهاء التعديل المتتابع"
    : "إلغاء التعديل";
  document.querySelector("#cancel-edit").hidden = false;
  fileForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetFileForm() {
  if (fileUploadBatch?.running) return;
  fileForm.reset();
  fileUploadBatch = null;
  uploadBatchAbortController = null;
  uploadDrafts.clear();
  uploadInput.disabled = false;
  cancelCurrentUploads.hidden = true;
  uploadFileStatuses.replaceChildren();
  fileForm.elements.id.value = "";
  fileForm.elements.position.value = "0";
  fileForm.elements.is_published.checked = true;
  coverInput.disabled = false;
  coverFileName.textContent = "تُستخدم مع ملف واحد فقط";
  uploadProgress.hidden = true;
  uploadStatus.hidden = true;
  document.querySelector("#file-form-heading").textContent = "إضافة ملف";
  document.querySelector("#cancel-edit").textContent = "إلغاء التعديل";
  document.querySelector("#cancel-edit").hidden = true;
  renderCategoryOptions();
  updateFileSelection();
}

document.querySelector("#cancel-edit").addEventListener("click", () => {
  if (fileEditQueue) {
    if (!window.confirm("إنهاء التعديل المتتابع؟ ستبقى التغييرات غير المحفوظة في هذا الملف دون حفظ.")) {
      return;
    }
    fileEditQueue = null;
    fileEditQueueIndex = -1;
    fileEditQueueStatus.hidden = true;
    updateFileSelectionControls();
  }
  resetFileForm();
  renderFiles();
});
fileSelectVisible.addEventListener("change", () => {
  const query = fileSearch.value.trim().toLocaleLowerCase();
  const visibleFiles = files.filter((file) =>
    `${file.name} ${file.description} ${fileCategoryLabel(file)}`
      .toLocaleLowerCase()
      .includes(query),
  );
  for (const file of visibleFiles) {
    if (fileSelectVisible.checked) selectedFileIds.add(file.id);
    else selectedFileIds.delete(file.id);
  }
  updateFileSelectionControls(visibleFiles);
  renderFiles();
});
editSelectedFiles.addEventListener("click", startSelectedFileEdit);
uploadInput.addEventListener("change", updateFileSelection);
cancelCurrentUploads.addEventListener("click", () => uploadBatchAbortController?.abort());
coverInput.addEventListener("change", () => {
  coverFileName.textContent = coverInput.files[0]?.name || "تُستخدم مع ملف واحد فقط";
});

fileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isUploadBatchRunning) return;
  const submit = fileForm.querySelector('[type="submit"]');
  const cancelEdit = document.querySelector("#cancel-edit");
  submit.disabled = true;
  cancelEdit.disabled = true;
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
    const emptyFile = newFiles.find((file) => file.size === 0);
    if (emptyFile) throw new Error(`الملف «${emptyFile.name}» فارغ ولا يمكن رفعه.`);
    const oversizedFile = newFiles.find((file) => file.size > maxFileSize);
    if (oversizedFile) {
      throw new Error(`حجم «${oversizedFile.name}» أكبر من الحد المحدد (2 GiB). قد يفرض مشروع Supabase حدًا أقل.`);
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
      if (advanceFileEditQueue(existing.id, true)) return;
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
    const emptyBatchCover = entries.find(({ draft }) => draft.cover?.size === 0);
    if (emptyBatchCover) throw new Error(`صورة غلاف «${emptyBatchCover.file.name}» فارغة.`);
    if (newCover?.size === 0) throw new Error("صورة الغلاف فارغة.");
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
    if (isBatchUpload) {
      if (fileUploadBatch) {
        const sameSelection = fileUploadBatch.entries.length === newFiles.length &&
          fileUploadBatch.entries.every((entry, index) => entry.file === newFiles[index]);
        if (!sameSelection) throw new Error("أنه الدفعة الحالية أو أعد محاولتها قبل اختيار ملفات أخرى.");
      } else {
        fileUploadBatch = createFileUploadBatch(entries, Number(values.get("position")) || 0);
      }
      await processFileUploadBatch(fileUploadBatch);
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
    if (existing && advanceFileEditQueue(existing.id)) {
      const warning = [cleanupWarning, notificationWarning].filter(Boolean).join(" ");
      if (warning) notify(warning, true);
      return;
    }
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
    if (fileUploadBatch) renderUploadBatch(fileUploadBatch);
    else {
      uploadProgress.hidden = true;
      uploadStatus.hidden = true;
      uploadFileStatuses.replaceChildren();
    }
    submit.disabled = false;
    cancelEdit.disabled = false;
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
    notify(`حجم «${oversizedAttachment.name}» أكبر من الحد المحدد (2 GiB). قد يفرض مشروع Supabase حدًا أقل.`, true);
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
adminThemeButton.addEventListener("click", () => {
  setAdminTheme(!document.body.classList.contains("dark"));
});

try {
  setAdminTheme(localStorage.getItem("course-library-admin-theme-v1") === "dark");
} catch {
  setAdminTheme(false);
}

const adminNavigation = document.querySelector(".dashboard-sidebar");
const adminNavigationArrows = document.querySelectorAll(".dashboard-sidebar-arrow");

function updateAdminNavigationArrows() {
  const navigationBounds = adminNavigation.getBoundingClientRect();
  const links = [...adminNavigation.querySelectorAll("a")];
  const canScrollLeft = links.some((link) => link.getBoundingClientRect().left < navigationBounds.left - 1);
  const canScrollRight = links.some((link) => link.getBoundingClientRect().right > navigationBounds.right + 1);
  adminNavigationArrows.forEach((button) => {
    button.disabled = button.dataset.scrollDirection === "left" ? !canScrollLeft : !canScrollRight;
  });
}

function setCurrentAdminLink(activeLink) {
  const currentLink = adminNavigation.querySelector('a[aria-current="location"]');
  if (currentLink === activeLink) return;
  adminNavigation.querySelectorAll("a").forEach((link) => link.removeAttribute("aria-current"));
  activeLink.setAttribute("aria-current", "location");
  activeLink.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "nearest",
    inline: "center",
  });
  window.requestAnimationFrame(updateAdminNavigationArrows);
}

adminNavigation.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (!link) return;
  setCurrentAdminLink(link);
});

adminNavigationArrows.forEach((button) => {
  button.addEventListener("click", () => {
    const distance = Math.max(160, adminNavigation.clientWidth * 0.72);
    const left = button.dataset.scrollDirection === "left" ? -distance : distance;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    adminNavigation.scrollBy({ left, behavior });
  });
});

adminNavigation.addEventListener("scroll", updateAdminNavigationArrows, { passive: true });
window.addEventListener("resize", updateAdminNavigationArrows);
updateAdminNavigationArrows();

if ("IntersectionObserver" in window) {
  const adminSectionObserver = new IntersectionObserver((entries) => {
    const visibleSections = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
    if (!visibleSections.length) return;
    const activeHref = `#${visibleSections[0].target.id}`;
    const activeLink = [...adminNavigation.querySelectorAll("a")]
      .find((link) => link.getAttribute("href") === activeHref);
    if (activeLink) setCurrentAdminLink(activeLink);
  }, { rootMargin: "-16% 0px -72% 0px", threshold: [0, 0.2, 0.5] });
  document.querySelectorAll(".admin-overview, .dashboard-content > .panel").forEach((section) => {
    adminSectionObserver.observe(section);
  });
}

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
  const previewPanels = new Set([
    "homepage-sections-panel",
    "semester-management-panel",
    "calendar-events-panel",
    "categories-panel",
    "file-form-panel",
    "notifications-panel",
    "files-panel",
  ]);
  document.querySelectorAll(".dashboard-content > .panel").forEach((panel) => {
    panel.hidden = !previewPanels.has(panel.id);
  });
  document.querySelector("#logout-button").hidden = true;
  await loadData();
  await initializeCalendarManagement({ client, localFeaturePreview, notify });
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
      await initializeCalendarManagement({ client, localFeaturePreview, notify });
    } catch (error) {
      message.textContent = dashboardErrorMessage(error);
      message.hidden = false;
    }
  }

  updateFileSelection();
}
