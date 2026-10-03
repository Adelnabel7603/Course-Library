import { legacyFiles, legacyCategories } from "./services/legacy-catalog.js";
import { isSupabaseConfigured } from "./services/supabase.js";
import {
  getPublicLibrary,
  recordDownload,
  subscribeToLibrary,
} from "./services/library.js";

const files = legacyFiles;

const translations = {
  ar: {
    brand: "مكتبة المقررات",
    admin: "الإدارة",
    install: "تثبيت التطبيق",
    installing: "جارٍ التثبيت...",
    installAccepted: "وافق المتصفح على التثبيت، جارٍ إكماله...",
    installCancelled: "تم إلغاء التثبيت.",
    installSuccess: "تم تثبيت التطبيق.",
    installUnavailable: "افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق.",
    installIOS: "اضغط «مشاركة» في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية».",
    share: "مشاركة",
    darkMode: "الوضع الليلي",
    lightMode: "الوضع النهاري",
    language: "English",
    eyebrow: "ملفات المحاضرات والمراجعة",
    headline: "كل مادتك، في مكان واحد.",
    description: "تصفّح الملفات وافتحها أو نزّلها بسهولة.",
    pdfFiles: "ملف PDF",
    navHome: "الرئيسية",
    navSearch: "بحث",
    navFiles: "الملفات",
    navCategories: "تصنيفات",
    quickNavigation: "التنقل السريع",
    changeLanguage: "تغيير اللغة",
    scrollCategoriesLeft: "تمرير التصنيفات إلى اليسار",
    scrollCategoriesRight: "تمرير التصنيفات إلى اليمين",
    all: "الكل",
    searchPlaceholder: "ابحث باسم الملف...",
    filesHeading: "الملفات",
    count: (count) => `${count} ملف`,
    open: "فتح",
    download: "تنزيل",
    downloading: "جارٍ تنزيل الملف",
    downloadComplete: "اكتمل التنزيل",
    downloadFailed: "تعذر تنزيل الملف",
    downloadCancelled: "تم إلغاء التنزيل",
    cancelDownload: "إلغاء التنزيل",
    downloadProgress: (received, total) => `${received} من ${total}`,
    downloadStarting: "جارٍ الاتصال بالملف...",
    empty: "لا توجد ملفات تطابق بحثك.",
    comingSoon: "قريبًا",
    shareSuccess: "تم نسخ رابط الموقع.",
    shareError: "تعذرت مشاركة الرابط. انسخه من شريط العنوان.",
    categories: {
      المالية: "المالية",
      المراجعة: "المراجعة",
      السناتر: "السناتر",
      المنشآت: "المنشآت",
      الضرائب: "الضرائب",
      التكاليف: "التكاليف",
    },
  },
  en: {
    brand: "Course Library",
    admin: "Admin",
    install: "Install app",
    installing: "Installing...",
    installAccepted: "Installation accepted. Finishing up...",
    installCancelled: "Installation cancelled.",
    installSuccess: "The app has been installed.",
    installUnavailable: "Open your browser menu and choose “Install app” or “Add to Home Screen”.",
    installIOS: "In Safari, tap Share, then choose “Add to Home Screen”.",
    share: "Share",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    language: "العربية",
    eyebrow: "Lecture notes and revision files",
    headline: "All your courses, in one place.",
    description: "Browse, open, and download your files with ease.",
    pdfFiles: "PDF files",
    navHome: "Home",
    navSearch: "Search",
    navFiles: "Files",
    navCategories: "Categories",
    quickNavigation: "Quick navigation",
    changeLanguage: "Change language",
    scrollCategoriesLeft: "Scroll categories left",
    scrollCategoriesRight: "Scroll categories right",
    all: "All",
    searchPlaceholder: "Search files...",
    filesHeading: "Files",
    count: (count) => `${count} files`,
    open: "Open",
    download: "Download",
    downloading: "Downloading file",
    downloadComplete: "Download complete",
    downloadFailed: "Download failed",
    downloadCancelled: "Download cancelled",
    cancelDownload: "Cancel download",
    downloadProgress: (received, total) => `${received} of ${total}`,
    downloadStarting: "Connecting to file...",
    empty: "No files match your search.",
    comingSoon: "Coming soon",
    shareSuccess: "Website link copied.",
    shareError: "Could not share the link. Copy it from the address bar.",
    categories: {
      المالية: "Finance",
      المراجعة: "Revision",
      السناتر: "Centers",
      المنشآت: "Businesses",
      الضرائب: "Tax",
      التكاليف: "Cost accounting",
    },
  },
};

const categoryList = document.querySelector("#category-list");
const categoryScrollLeft = document.querySelector("#category-scroll-left");
const categoryScrollRight = document.querySelector("#category-scroll-right");
const fileGrid = document.querySelector("#file-grid");
const searchInput = document.querySelector("#search-input");
const resultCount = document.querySelector("#result-count");
const totalCount = document.querySelector("#total-count");
const footerCount = document.querySelector("#footer-count");
const emptyState = document.querySelector("#empty-state");
const themeButton = document.querySelector("#theme-button");
const themeIcon = document.querySelector("#theme-icon");
const languageButton = document.querySelector("#language-button");
const shareButton = document.querySelector("#share-button");
const installButton = document.querySelector("#install-button");
const installProgress = document.querySelector("#install-progress");
const toast = document.querySelector("#toast");
const downloadProgress = document.querySelector("#download-progress");
const downloadProgressTitle = document.querySelector("#download-progress-title");
const downloadProgressDetail = document.querySelector("#download-progress-detail");
const downloadProgressPercent = document.querySelector("#download-progress-percent");
const downloadProgressBar = document.querySelector("#download-progress-bar");
const downloadCancelButton = document.querySelector("#download-cancel");
const siteUrl = new URL("./", window.location.href).href;

let activeCategory = "all";
let language = "ar";
let toastTimeout;
let installPrompt;
let installCompletionTimeout;
let activeDownload;

let categories = legacyCategories.map((category) => ({
  ...category,
  key: category.name_ar,
  available: !category.is_coming_soon,
}));
let availableFiles = files;
let cloudLibraryEnabled = false;

function currentText() {
  return translations[language];
}

function setLanguage(nextLanguage) {
  language = nextLanguage;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-text]").forEach((element) => {
    const key = element.dataset.text;
    if (key === "darkMode") {
      element.textContent = document.body.classList.contains("dark")
        ? currentText().lightMode
        : currentText().darkMode;
    } else {
      element.textContent = currentText()[key];
    }
  });

  document.querySelectorAll("[data-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", currentText()[element.dataset.ariaLabel]);
  });
  installButton.setAttribute(
    "aria-label",
    installButton.disabled ? currentText().installing : currentText().install,
  );

  searchInput.placeholder = currentText().searchPlaceholder;
  searchInput.setAttribute(
    "aria-label",
    currentText().searchPlaceholder.replace(/\.\.\.$/, ""),
  );
  renderCategories();
  renderFiles();
}

function renderCategories() {
  const text = currentText();
  const categoryButtons = [
    { key: "all", label: text.all, available: true },
    ...categories.map((category) => ({
      key: category.id || category.key,
      label: language === "en" && category.name_en
        ? category.name_en
        : text.categories[category.key] || category.name_ar || category.key,
      available: category.available,
    })),
  ];

  categoryList.replaceChildren(
    ...categoryButtons.map(({ key, label, available }) => {
      const button = document.createElement("button");
      button.className = "category-button";
      button.type = "button";
      button.disabled = !available;
      button.setAttribute("aria-pressed", String(activeCategory === key));
      const name = document.createElement("span");
      name.textContent = label;
      button.append(name);
      if (!available) {
        const status = document.createElement("span");
        status.className = "coming-soon";
        status.textContent = currentText().comingSoon;
        button.append(status);
      } else {
        button.addEventListener("click", () => {
          activeCategory = key;
          renderCategories();
          renderFiles();
        });
      }
      return button;
    }),
  );
  updateCategoryScrollControls();
}

function updateCategoryScrollControls() {
  const rail = categoryList.getBoundingClientRect();
  const items = [...categoryList.children];
  const hasHiddenLeft = items.some((item) =>
    item.getBoundingClientRect().right <= rail.left + 1);
  const hasHiddenRight = items.some((item) =>
    item.getBoundingClientRect().left >= rail.right - 1);
  const hasOverflow = hasHiddenLeft || hasHiddenRight;

  categoryScrollLeft.hidden = !hasOverflow;
  categoryScrollRight.hidden = !hasOverflow;
  categoryScrollLeft.disabled = !hasHiddenLeft;
  categoryScrollRight.disabled = !hasHiddenRight;
}

function scrollCategoryRail(direction) {
  const rail = categoryList.getBoundingClientRect();
  const items = [...categoryList.children]
    .map((item) => ({ item, rect: item.getBoundingClientRect() }))
    .sort((first, second) => first.rect.left - second.rect.left);
  const visibleItems = items.filter(({ rect }) =>
    rect.right > rail.left + 1 && rect.left < rail.right - 1);
  if (!visibleItems.length) return;

  const edgeItem = direction === "left"
    ? visibleItems[0].item
    : visibleItems[visibleItems.length - 1].item;
  const edgeIndex = items.findIndex(({ item }) => item === edgeItem);
  const nextIndex = edgeIndex + (direction === "left" ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= items.length) return;

  items[nextIndex].item.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center",
  });
}

function fileUrl(fileName) {
  if (typeof fileName === "string") {
    return `legacy-pdfs/${fileName.split("/").map(encodeURIComponent).join("/")}`;
  }
  return fileName.url;
}

function renderFiles() {
  const text = currentText();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleFiles = availableFiles.filter((file) => {
    const matchesCategory =
      activeCategory === "all" ||
      (cloudLibraryEnabled
        ? file.category_id === activeCategory
        : file.category === activeCategory);
    const matchesSearch = `${file.name} ${file.description || ""}`
      .toLocaleLowerCase()
      .includes(query);
    return matchesCategory && matchesSearch;
  });

  fileGrid.replaceChildren(
    ...visibleFiles.map((file) => {
      const card = document.createElement("article");
      card.className = "file-card";

      const top = document.createElement("div");
      top.className = "file-card-top";

      const icon = document.createElement("span");
      const mimeType = file.mime_type || "";
      const typeLabel = mimeType.startsWith("image/")
        ? "IMG"
        : mimeType.startsWith("video/")
          ? "VIDEO"
          : mimeType === "application/pdf" || !mimeType
            ? "PDF"
            : "FILE";
      icon.className = `pdf-icon${mimeType.startsWith("video/") ? " video-icon" : ""}`;
      icon.textContent = typeLabel;
      icon.setAttribute("aria-hidden", "true");

      const details = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = cloudLibraryEnabled
        ? file.name
        : file.name.replace(/\.pdf$/i, "");
      const category = document.createElement("span");
      category.className = "file-category";
      category.textContent = cloudLibraryEnabled
        ? (language === "en" && file.categoryNameEn
          ? file.categoryNameEn
          : file.category)
        : text.categories[file.category] || file.category;
      details.append(title, category);
      top.append(icon, details);

      if (mimeType.startsWith("image/")) {
        const image = document.createElement("img");
        image.className = "file-preview image-preview";
        image.src = file.url;
        image.alt = file.name;
        image.loading = "lazy";
        card.append(image);
      } else if (mimeType.startsWith("video/")) {
        const video = document.createElement("video");
        video.className = "file-preview video-preview";
        video.src = file.url;
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        video.setAttribute("aria-label", file.name);
        if (file.coverUrl) video.poster = file.coverUrl;
        card.append(video);
      } else if (file.coverUrl) {
        const cover = document.createElement("img");
        cover.className = "file-cover";
        cover.src = file.coverUrl;
        cover.alt = "";
        cover.loading = "lazy";
        card.append(cover);
      }
      if (file.description) {
        const description = document.createElement("p");
        description.className = "file-description";
        description.textContent = file.description;
        card.append(description);
      }

      const actions = document.createElement("div");
      actions.className = "file-actions";
      const openLink = document.createElement("a");
      openLink.className = "file-action primary";
      openLink.href = fileUrl(file.name);
      if (cloudLibraryEnabled) openLink.href = file.url;
      openLink.target = "_blank";
      openLink.rel = "noopener";
      openLink.textContent = `↗ ${text.open}`;
      openLink.setAttribute("aria-label", `${text.open}: ${file.name}`);

      const downloadLink = document.createElement("a");
      downloadLink.className = "file-action";
      downloadLink.href = cloudLibraryEnabled ? file.downloadUrl : fileUrl(file.name);
      downloadLink.download = getDownloadName(file);
      downloadLink.addEventListener("click", (event) => {
        event.preventDefault();
        downloadFile(file, downloadLink.href);
      });
      downloadLink.textContent = `↓ ${text.download}`;
      downloadLink.setAttribute("aria-label", `${text.download}: ${file.name}`);
      actions.append(openLink, downloadLink);

      card.append(top, actions);
      return card;
    }),
  );

  totalCount.textContent = String(availableFiles.length);
  resultCount.textContent = text.count(visibleFiles.length);
  footerCount.textContent = text.count(availableFiles.length);
  emptyState.textContent = text.empty;
  emptyState.hidden = visibleFiles.length > 0;
  fileGrid.hidden = visibleFiles.length === 0;
}

async function loadCloudLibrary() {
  const library = await getPublicLibrary();
  categories = library.categories.map((category) => ({
    ...category,
    key: category.name_ar,
    available: !category.is_coming_soon,
  }));
  availableFiles = library.files;
  cloudLibraryEnabled = true;
  if (
    activeCategory !== "all" &&
    !categories.some((category) => category.id === activeCategory)
  ) {
    activeCategory = "all";
  }
  renderCategories();
  renderFiles();
}

function setDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  themeIcon.setAttribute(
    "d",
    enabled
      ? "M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
      : "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z",
  );
  themeButton.setAttribute(
    "aria-label",
    enabled ? currentText().lightMode : currentText().darkMode,
  );
  const label = themeButton.querySelector('[data-text="darkMode"]');
  label.textContent = enabled ? currentText().lightMode : currentText().darkMode;
  try {
    localStorage.setItem("course-library-theme", enabled ? "dark" : "light");
  } catch {
    // The theme remains usable for this page even when storage is unavailable.
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3800);
}

function getDownloadName(file) {
  if (file.mime_type === "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return `${file.name}.pdf`;
  }
  return file.name;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** unitIndex);
  return `${amount.toFixed(unitIndex === 0 || amount >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateDownloadProgress(download, received, total) {
  if (activeDownload !== download) return;
  downloadProgressBar.classList.toggle("indeterminate", !total);
  downloadProgressBar.value = total ? Math.min((received / total) * 100, 100) : 0;
  downloadProgressPercent.textContent = total
    ? `${Math.min(Math.round((received / total) * 100), 100)}%`
    : "…";
  downloadProgressDetail.textContent = total
    ? currentText().downloadProgress(formatBytes(received), formatBytes(total))
    : `${formatBytes(received)} · ${currentText().downloadStarting}`;
}

function finishDownload(download, title, detail = "") {
  if (activeDownload !== download) return;
  downloadProgress.classList.toggle("is-complete", title === currentText().downloadComplete);
  downloadProgress.classList.toggle("is-error", title === currentText().downloadFailed);
  downloadProgressTitle.textContent = title;
  downloadProgressDetail.textContent = detail;
  downloadProgressBar.classList.remove("indeterminate");
  if (title === currentText().downloadComplete) {
    downloadProgressBar.value = 100;
    downloadProgressPercent.textContent = "100%";
    downloadCancelButton.hidden = true;
    window.setTimeout(() => {
      if (activeDownload === download) {
        downloadProgress.hidden = true;
        activeDownload = null;
      }
    }, 3200);
  } else {
    downloadProgressPercent.textContent = "";
    downloadCancelButton.hidden = true;
    window.setTimeout(() => {
      if (activeDownload === download) {
        downloadProgress.hidden = true;
        activeDownload = null;
      }
    }, 4600);
  }
}

async function downloadFile(file, url) {
  activeDownload?.controller.abort();
  const download = { controller: new AbortController() };
  activeDownload = download;
  downloadProgress.hidden = false;
  downloadProgress.classList.remove("is-complete", "is-error");
  downloadProgressTitle.textContent = `${currentText().downloading}: ${getDownloadName(file)}`;
  downloadProgressDetail.textContent = currentText().downloadStarting;
  downloadProgressPercent.textContent = "0%";
  downloadProgressBar.classList.remove("indeterminate");
  downloadProgressBar.value = 0;
  downloadCancelButton.hidden = false;
  downloadCancelButton.setAttribute("aria-label", currentText().cancelDownload);

  try {
    const response = await fetch(url, { signal: download.controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const total = Number(response.headers.get("content-length")) || file.size_bytes || 0;
    let blob;
    if (!response.body?.getReader) {
      blob = await response.blob();
      updateDownloadProgress(download, blob.size, total || blob.size);
    } else {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        updateDownloadProgress(download, received, total);
      }
      blob = new Blob(chunks, {
        type: response.headers.get("content-type") || file.mime_type || "application/octet-stream",
      });
    }

    if (activeDownload !== download) return;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = getDownloadName(file);
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    finishDownload(download, currentText().downloadComplete, formatBytes(blob.size));
    if (cloudLibraryEnabled) {
      recordDownload(file.id).catch((error) => {
        showToast(error.message || currentText().downloadFailed);
      });
    }
  } catch (error) {
    if (activeDownload !== download) return;
    if (error.name === "AbortError") {
      finishDownload(download, currentText().downloadCancelled);
      return;
    }
    finishDownload(download, currentText().downloadFailed, error.message);
  }
}

searchInput.addEventListener("input", renderFiles);
document.querySelectorAll(".mobile-toolbar [data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.scroll);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (target === searchInput) searchInput.focus({ preventScroll: true });
    }
  });
});
categoryScrollLeft.addEventListener("click", () => scrollCategoryRail("left"));
categoryScrollRight.addEventListener("click", () => scrollCategoryRail("right"));
categoryList.addEventListener("scroll", updateCategoryScrollControls, { passive: true });
window.addEventListener("resize", updateCategoryScrollControls);
languageButton.addEventListener("click", () =>
  setLanguage(language === "ar" ? "en" : "ar"),
);
themeButton.addEventListener("click", () =>
  setDarkMode(!document.body.classList.contains("dark")),
);
shareButton.addEventListener("click", async () => {
  try {
    if (navigator.share) {
      await navigator.share({ title: document.title, url: siteUrl });
      return;
    }
    await navigator.clipboard.writeText(siteUrl);
    showToast(currentText().shareSuccess);
  } catch (error) {
    if (error.name === "AbortError") return;
    showToast(currentText().shareError);
  }
});

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

installButton.hidden = isStandaloneApp();

function setInstallLoading(isLoading) {
  installButton.classList.toggle("is-installing", isLoading);
  installButton.disabled = isLoading;
  installButton.setAttribute("aria-busy", String(isLoading));
  installButton.setAttribute(
    "aria-label",
    isLoading ? currentText().installing : currentText().install,
  );
  installProgress.hidden = !isLoading;
}

function clearInstallCompletionTimeout() {
  window.clearTimeout(installCompletionTimeout);
  installCompletionTimeout = undefined;
}

function installInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS ? currentText().installIOS : currentText().installUnavailable;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    showToast(installInstructions());
    return;
  }

  const promptEvent = installPrompt;
  installPrompt = null;
  setInstallLoading(true);

  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      showToast(currentText().installAccepted);
      installCompletionTimeout = window.setTimeout(() => {
        setInstallLoading(false);
        if (isStandaloneApp()) {
          installButton.hidden = true;
          showToast(currentText().installSuccess);
          return;
        }
        showToast(installInstructions());
      }, 10000);
      return;
    }

    setInstallLoading(false);
    showToast(currentText().installCancelled);
  } catch (error) {
    setInstallLoading(false);
    showToast(error.message || currentText().installUnavailable);
  }
});

window.addEventListener("appinstalled", () => {
  clearInstallCompletionTimeout();
  installPrompt = null;
  setInstallLoading(false);
  installButton.hidden = true;
  showToast(currentText().installSuccess);
});

window.matchMedia("(display-mode: standalone)").addEventListener("change", (event) => {
  installButton.hidden = event.matches;
  if (event.matches) {
    clearInstallCompletionTimeout();
    setInstallLoading(false);
  }
});

downloadCancelButton.addEventListener("click", () => {
  activeDownload?.controller.abort();
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) {
      window.location.reload();
      return;
    }
    hadController = true;
  });
  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      const checkForUpdate = () => {
        if (document.visibilityState === "visible") {
          registration.update().then(() => {
            updateErrorReported = false;
          }).catch((error) => {
            if (!updateErrorReported) {
              showToast(error.message || "تعذر التحقق من تحديث الموقع.");
              updateErrorReported = true;
            }
          });
        }
      };
      let updateErrorReported = false;
      window.setInterval(checkForUpdate, 60_000);
      document.addEventListener("visibilitychange", checkForUpdate);
    })
    .catch((error) => {
      showToast(error.message || "تعذر تفعيل وضع التطبيق.");
    });
}

try {
  setDarkMode(localStorage.getItem("course-library-theme") === "dark");
} catch {
  setDarkMode(false);
}
setLanguage("ar");

if (isSupabaseConfigured) {
  loadCloudLibrary()
    .then(() => {
      subscribeToLibrary(() => {
        loadCloudLibrary().catch((error) => {
          showToast(error.message || "تعذر تحديث المكتبة.");
        });
      });
    })
    .catch((error) => {
      showToast(error.message || "تعذر تحميل المكتبة من قاعدة البيانات.");
    });
}
