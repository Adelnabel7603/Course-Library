import { legacyFiles, legacyCategories } from "./services/legacy-catalog.js";
import {
  getPublicLibrary,
  registerPushSubscription,
  recordDownload,
  subscribeToLibrary,
} from "./services/library.js";
import { isSupabaseConfigured, supabaseConfig } from "./config.js";
import { initializeStudentCalendar } from "./services/student-calendar.js";

const files = legacyFiles;

const translations = {
  ar: {
    brand: "مكتبة المقررات",
    updateAvailable: "تم تحديث التطبيق. حدّث الصفحة لتشغيل النسخة الجديدة.",
    refreshApp: "تحديث الآن",
    notifications: "الإشعارات",
    markRead: "تحديد كمقروءة",
    enableNotifications: "تفعيل إشعارات الجهاز",
    favorites: "المفضلة",
    recentFiles: "آخر ما فتحته",
    studyPlanner: "خطة المذاكرة",
    yourLibrary: "مساحتك",
    continueLearning: "متابعة",
    buildYourRoutine: "خطوة بخطوة",
    localPlannerNote: "محفوظة على هذا الجهاز",
    noFavorites: "أضف ملفاتك المهمة إلى المفضلة لتصل إليها هنا.",
    noRecentFiles: "ستظهر الملفات التي تفتحها هنا.",
    addFavorite: "أضف إلى المفضلة",
    removeFavorite: "إزالة من المفضلة",
    browseCourses: "تصفّح المواد",
    startPlanning: "خطط لمذاكرتك",
    subjects: "مادة",
    navCourses: "المواد",
    navFavorites: "المفضلة",
    navStudy: "المذاكرة",
    navMore: "المزيد",
    taskName: "المهمة",
    taskPlaceholder: "مثال: مراجعة المحاضرة الثالثة",
    subjectOptional: "المادة (اختياري)",
    dueDate: "الموعد",
    taskPriority: "الأولوية",
    priorityLow: "منخفضة",
    priorityNormal: "عادية",
    priorityHigh: "عالية",
    addTask: "أضف مهمة",
    upcomingTasks: "المهام القادمة",
    noTasks: "أضف مهمة صغيرة لتبدأ خطتك.",
    focusSession: "جلسة تركيز",
    focusTimer: "مؤقت المذاكرة",
    durationLabel: "مدة الجلسة",
    durationHours: "ساعة",
    durationMinutes: "دقيقة",
    durationHoursInput: "الساعات",
    durationMinutesInput: "الدقائق",
    durationRangeError: "اختر مدة من دقيقة واحدة إلى 23 ساعة و59 دقيقة.",
    durationSaveError: "تعذر حفظ المدة على هذا الجهاز.",
    timerStart: "ابدأ",
    timerResume: "استأنف",
    timerPause: "إيقاف مؤقت",
    timerReset: "إنهاء الجلسة",
    studyMinutes: "دقائق مسجلة",
    taskComplete: "مكتملة",
    deleteTask: "حذف المهمة",
    tasksSummary: (done, remaining) => `${done} مكتملة · ${remaining} متبقية`,
    sessionSaved: "تم تسجيل وقت المذاكرة.",
    sessionComplete: "اكتملت جلسة التركيز.",
    newArrivals: "أضيفت مؤخرًا",
    latestFiles: "أحدث الملفات",
    recordedUsage: "تنزيلات مسجلة",
    popularFiles: "الأكثر تنزيلًا",
    pdfNewTab: "فتح في تبويب جديد",
    pdfLoading: "جارٍ فتح الملف…",
    fullscreen: "ملء الشاشة",
    closeViewer: "إغلاق العارض",
    noNotifications: "لا توجد إشعارات جديدة.",
    unreadCount: (count) => `${count} غير مقروء`,
    pushEnabled: "إشعارات الجهاز مفعّلة",
    pushEnableSuccess: "تم تفعيل إشعارات الجهاز.",
    pushPermissionDenied: "لم تسمح بإشعارات الجهاز.",
    pushConnectionFailed: "تعذر الاتصال بخدمة الإشعارات. تحقّق من أن APP_ORIGIN في Supabase يطابق عنوان الموقع.",
    pushUnavailable: "تعذر تفعيل إشعارات الجهاز على هذا المتصفح.",
    pushSetupMissing: "إشعارات الجهاز غير مهيأة بعد؛ ستظهر التحديثات في الجرس.",
    admin: "الإدارة",
    install: "تثبيت التطبيق",
    installSuccess: "تم تثبيت التطبيق.",
    installUnavailable: "افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق.",
    share: "مشاركة",
    darkMode: "الوضع الليلي",
    lightMode: "الوضع النهاري",
    language: "English",
    eyebrow: "ملفات المحاضرات والمراجعة",
    headline: "خطوتك الدراسية التالية تبدأ من هنا.",
    description: "موادك وملفاتك وخطة مذاكرتك، مرتبة لتصل إلى ما تحتاجه بسرعة.",
    pdfFiles: "ملف",
    navHome: "الرئيسية",
    navSearch: "بحث",
    navFiles: "الملفات",
    navCategories: "تصنيفات",
    quickNavigation: "التنقل السريع",
    changeLanguage: "تغيير اللغة",
    scrollCategoriesLeft: "تمرير التصنيفات إلى اليسار",
    scrollCategoriesRight: "تمرير التصنيفات إلى اليمين",
    installIOS: "اضغط «مشاركة» في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية».",
    all: "الكل",
    searchPlaceholder: "ابحث عن مادة أو ملف...",
    selectCategoryPrompt: "اختر بطاقة مادة لعرض ملفاتها.",
    noMatchingCategories: "لا توجد مواد أو ملفات مطابقة للبحث.",
    noCategoryFiles: "لا توجد ملفات في هذا التصنيف حاليًا.",
    filesHeading: "الملفات",
    count: (count) => `${count} ملف`,
    open: "فتح",
    download: "تنزيل",
    newFile: "جديد",
    attachments: "الملفات المرفقة",
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
    updateAvailable: "The app was updated. Refresh to load the new version.",
    refreshApp: "Refresh now",
    notifications: "Notifications",
    markRead: "Mark all as read",
    enableNotifications: "Enable device notifications",
    favorites: "Favorites",
    recentFiles: "Recently opened",
    studyPlanner: "Study plan",
    yourLibrary: "Your space",
    continueLearning: "Continue",
    buildYourRoutine: "One step at a time",
    localPlannerNote: "Saved on this device",
    noFavorites: "Save important files here for quick access.",
    noRecentFiles: "Files you open will appear here.",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    browseCourses: "Browse courses",
    startPlanning: "Plan a study session",
    subjects: "subjects",
    navCourses: "Courses",
    navFavorites: "Saved",
    navStudy: "Study",
    navMore: "More",
    taskName: "Task",
    taskPlaceholder: "For example: Review lecture three",
    subjectOptional: "Subject (optional)",
    dueDate: "Due date",
    taskPriority: "Priority",
    priorityLow: "Low",
    priorityNormal: "Normal",
    priorityHigh: "High",
    addTask: "Add task",
    upcomingTasks: "Upcoming tasks",
    noTasks: "Add a small task to start your plan.",
    focusSession: "Focus session",
    focusTimer: "Study timer",
    durationLabel: "Session length",
    durationHours: "hours",
    durationMinutes: "minutes",
    durationHoursInput: "Hours",
    durationMinutesInput: "Minutes",
    durationRangeError: "Choose a duration from 1 minute to 23 hours and 59 minutes.",
    durationSaveError: "Could not save the duration on this device.",
    timerStart: "Start",
    timerResume: "Resume",
    timerPause: "Pause",
    timerReset: "End session",
    studyMinutes: "Minutes recorded",
    taskComplete: "Completed",
    deleteTask: "Delete task",
    tasksSummary: (done, remaining) => `${done} complete · ${remaining} remaining`,
    sessionSaved: "Study time recorded.",
    sessionComplete: "Focus session complete.",
    newArrivals: "New arrivals",
    latestFiles: "Latest files",
    recordedUsage: "Recorded downloads",
    popularFiles: "Most downloaded",
    pdfNewTab: "Open in new tab",
    pdfLoading: "Opening file…",
    fullscreen: "Fullscreen",
    closeViewer: "Close viewer",
    noNotifications: "No new notifications.",
    unreadCount: (count) => `${count} unread`,
    pushEnabled: "Device notifications are enabled",
    pushEnableSuccess: "Device notifications enabled.",
    pushPermissionDenied: "Device notifications were not allowed.",
    pushConnectionFailed: "Could not reach the notification service. Check that Supabase APP_ORIGIN exactly matches this site's origin.",
    pushUnavailable: "Device notifications are unavailable in this browser.",
    pushSetupMissing: "Device notifications are not configured yet; updates will appear in the bell.",
    admin: "Admin",
    install: "Install app",
    installSuccess: "The app has been installed.",
    installUnavailable: "Open your browser menu and choose “Install app” or “Add to Home Screen”.",
    share: "Share",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    language: "العربية",
    eyebrow: "Lecture notes and revision files",
    headline: "Your next study step starts here.",
    description: "Courses, files, and a study plan, organized around what you need next.",
    pdfFiles: "files",
    navHome: "Home",
    navSearch: "Search",
    navFiles: "Files",
    navCategories: "Categories",
    quickNavigation: "Quick navigation",
    changeLanguage: "Change language",
    scrollCategoriesLeft: "Scroll categories left",
    scrollCategoriesRight: "Scroll categories right",
    installIOS: "In Safari, tap Share, then choose “Add to Home Screen”.",
    all: "All",
    searchPlaceholder: "Search courses or files...",
    selectCategoryPrompt: "Select a course card to view its files.",
    noMatchingCategories: "No courses or files match your search.",
    noCategoryFiles: "There are no files in this category yet.",
    filesHeading: "Files",
    count: (count) => `${count} files`,
    open: "Open",
    download: "Download",
    newFile: "New",
    attachments: "Attachments",
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
const semesterHome = document.querySelector("#semester-home");
const semesterGrid = document.querySelector("#semester-grid");
const termContent = document.querySelector("#term-content");
const libraryBreadcrumbs = document.querySelector("#library-breadcrumbs");
const categoryCards = document.querySelector("#category-cards");
const libraryLoadError = document.querySelector("#library-load-error");
const libraryRetry = document.querySelector("#library-retry");
const categoryScrollLeft = document.querySelector("#category-scroll-left");
const categoryScrollRight = document.querySelector("#category-scroll-right");
const fileGrid = document.querySelector("#file-grid");
const searchInput = document.querySelector("#search-input");
const favoritesList = document.querySelector("#favorites-list");
const favoritesCount = document.querySelector("#favorites-count");
const favoritesEmpty = document.querySelector("#favorites-empty");
const recentList = document.querySelector("#recent-list");
const recentCount = document.querySelector("#recent-count");
const recentEmpty = document.querySelector("#recent-empty");
const latestPanel = document.querySelector("#latest-files");
const latestList = document.querySelector("#latest-list");
const latestCount = document.querySelector("#latest-count");
const popularPanel = document.querySelector("#popular-files");
const popularList = document.querySelector("#popular-list");
const popularCount = document.querySelector("#popular-count");
const studyTaskForm = document.querySelector("#study-task-form");
const studyTaskList = document.querySelector("#study-task-list");
const studyTaskEmpty = document.querySelector("#study-empty");
const studyCategorySelect = document.querySelector("#study-category");
const studySummary = document.querySelector("#study-summary");
const studyTimerDisplay = document.querySelector("#study-timer-display");
const studyDurationHoursInput = document.querySelector("#study-duration-hours");
const studyDurationMinutesInput = document.querySelector("#study-duration-minutes");
const studyTimerStatus = document.querySelector("#study-timer-status");
const studySessionTotal = document.querySelector("#study-session-total");
const timerStartButton = document.querySelector("#timer-start");
const timerPauseButton = document.querySelector("#timer-pause");
const timerResetButton = document.querySelector("#timer-reset");
const mobileNavigation = document.querySelector("#mobile-navigation");
const mobileNavIndicator = document.querySelector("#mobile-nav-indicator");
const moreMenuButton = document.querySelector("#more-menu-button");
const mobileMoreMenu = document.querySelector("#mobile-more-menu");
const resultCount = document.querySelector("#result-count");
const totalCount = document.querySelector("#total-count");
const footerCount = document.querySelector("#footer-count");
const emptyState = document.querySelector("#empty-state");
const themeButton = document.querySelector("#theme-button");
const themeIcon = document.querySelector("#theme-icon");
const languageButton = document.querySelector("#language-button");
const notificationButton = document.querySelector("#notification-button");
const notificationPanel = document.querySelector("#notification-panel");
const notificationBadge = document.querySelector("#notification-badge");
const notificationCount = document.querySelector("#notification-count");
const notificationList = document.querySelector("#notification-list");
const notificationEmpty = document.querySelector("#notification-empty");
const markNotificationsRead = document.querySelector("#mark-notifications-read");
const enablePushButton = document.querySelector("#enable-push-button");
const shareButton = document.querySelector("#share-button");
const pdfViewer = document.querySelector("#pdf-viewer");
const pdfViewerTitle = document.querySelector("#pdf-viewer-title");
const pdfViewerFrame = document.querySelector("#pdf-viewer-frame");
const pdfViewerLoading = document.querySelector("#pdf-viewer-loading");
const pdfViewerOpenOriginal = document.querySelector("#pdf-viewer-open-original");
const pdfViewerDownload = document.querySelector("#pdf-viewer-download");
const pdfViewerFullscreen = document.querySelector("#pdf-viewer-fullscreen");
const pdfViewerClose = document.querySelector("#pdf-viewer-close");
const installButton = document.querySelector("#install-button");
const toast = document.querySelector("#toast");
const appUpdatePrompt = document.querySelector("#app-update-prompt");
const refreshAppButton = document.querySelector("#refresh-app-button");
const downloadProgress = document.querySelector("#download-progress");
const downloadProgressTitle = document.querySelector("#download-progress-title");
const downloadProgressDetail = document.querySelector("#download-progress-detail");
const downloadProgressPercent = document.querySelector("#download-progress-percent");
const downloadProgressBar = document.querySelector("#download-progress-bar");
const downloadCancelButton = document.querySelector("#download-cancel");
const siteUrl = new URL("./", window.location.href).href;

let activeCategory = "all";
let activeSemester = null;
let semesters = [];
const firstSemesterId = "8c13f5b1-98bf-47a1-b076-ef58c0a10001";
let language = "ar";
let toastTimeout;
let mobileMoreMenuCloseTimeout;
let installPrompt;
let activeDownload;
let notifications = [];
let notificationAudioContext;
let notificationsLoaded = false;
const expandedCategoryIds = new Set();
const collapsedFileGroupIds = new Set();
const localFeaturePreview = window.location.protocol === "file:" &&
  new URLSearchParams(window.location.search).get("preview") === "features";
const notificationReadKey = "course-library-read-notifications-v1";
const readNotificationIds = new Set(loadReadNotificationIds());
const favoriteStorageKey = "course-library-favorites-v1";
const recentStorageKey = "course-library-recent-v1";
const studyTaskStorageKey = "course-library-study-tasks-v1";
const studySessionStorageKey = "course-library-study-sessions-v1";
const studyDurationStorageKey = "course-library-study-duration-minutes-v1";
const defaultStudyDurationMinutes = 25;
const favoriteFileIds = new Set(loadStoredArray(favoriteStorageKey));
let recentFileIds = loadStoredArray(recentStorageKey);
let studyTasks = loadStoredArray(studyTaskStorageKey);
let studySessions = loadStoredArray(studySessionStorageKey);
let focusDurationSeconds = loadStudyDurationMinutes() * 60;
let studyElapsedSeconds = 0;
let studySegmentStartedAt = 0;
let studyTimerInterval;
let activeNavigationSection = "top";
const defaultHomepageSections = [
  { id: "personal", position: 0, is_visible: true },
  { id: "discovery", position: 1, is_visible: true },
  { id: "planner", position: 2, is_visible: true },
  { id: "library", position: 3, is_visible: true },
];
let homepageSections = defaultHomepageSections;

let categories = legacyCategories.map((category) => ({
  ...category,
  key: category.name_ar,
  available: !category.is_coming_soon,
}));
let availableFiles = files;
let cloudLibraryEnabled = false;

function loadReadNotificationIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(notificationReadKey) || "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveReadNotificationIds() {
  try {
    localStorage.setItem(notificationReadKey, JSON.stringify([...readNotificationIds]));
  } catch {
    return;
  }
}

function loadStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function loadStudyDurationMinutes() {
  try {
    const minutes = Number(localStorage.getItem(studyDurationStorageKey));
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1439
      ? minutes
      : defaultStudyDurationMinutes;
  } catch {
    return defaultStudyDurationMinutes;
  }
}

function saveStoredArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function getFileIdentity(file) {
  return file.id || `legacy:${file.category_id || file.category || "file"}:${file.name}`;
}

function getCategoryIdentity(category) {
  return category.id || `legacy:${category.key || category.name_ar}`;
}

function normalizeSearch(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase(language === "ar" ? "ar" : "en")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, "")
    .trim();
}

function createPersonalFileRow(file) {
  const row = document.createElement("li");
  row.className = "personal-file-row";

  const link = document.createElement("a");
  link.className = "personal-file-link";
  link.href = cloudLibraryEnabled ? file.url : fileUrl(file.name);
  link.target = "_blank";
  link.rel = "noopener";
  link.addEventListener("click", () => rememberRecentlyOpened(file));

  const title = document.createElement("strong");
  title.textContent = cloudLibraryEnabled ? file.name : file.name.replace(/\.pdf$/i, "");
  const category = document.createElement("span");
  category.textContent = cloudLibraryEnabled
    ? getCategoryLabel(file.categories || { name_ar: file.category, name_en: file.categoryNameEn })
    : currentText().categories[file.category] || file.category;
  link.append(title, category);

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "personal-favorite-toggle";
  favoriteButton.type = "button";
  const isFavorite = favoriteFileIds.has(getFileIdentity(file));
  favoriteButton.textContent = isFavorite ? "★" : "☆";
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.setAttribute(
    "aria-label",
    isFavorite ? currentText().removeFavorite : currentText().addFavorite,
  );
  favoriteButton.addEventListener("click", () => toggleFavorite(file));

  row.append(link, favoriteButton);
  return row;
}

function rememberRecentlyOpened(file) {
  const fileIdentity = getFileIdentity(file);
  recentFileIds = [fileIdentity, ...recentFileIds.filter((id) => id !== fileIdentity)].slice(0, 12);
  saveStoredArray(recentStorageKey, recentFileIds);
  renderPersonalSections();
}

function toggleFavorite(file) {
  const fileIdentity = getFileIdentity(file);
  if (favoriteFileIds.has(fileIdentity)) {
    favoriteFileIds.delete(fileIdentity);
  } else {
    favoriteFileIds.add(fileIdentity);
  }
  saveStoredArray(favoriteStorageKey, [...favoriteFileIds]);
  renderFiles();
}

function renderPersonalSections() {
  const filesById = new Map(availableFiles.map((file) => [getFileIdentity(file), file]));
  const favoriteFiles = [...favoriteFileIds]
    .map((id) => filesById.get(id))
    .filter(Boolean);
  const recentFiles = recentFileIds
    .map((id) => filesById.get(id))
    .filter(Boolean);

  favoritesCount.textContent = String(favoriteFiles.length);
  recentCount.textContent = String(recentFiles.length);
  favoritesEmpty.hidden = favoriteFiles.length > 0;
  recentEmpty.hidden = recentFiles.length > 0;
  favoritesList.replaceChildren(...favoriteFiles.map(createPersonalFileRow));
  recentList.replaceChildren(...recentFiles.map(createPersonalFileRow));
  renderCuratedSections();
}

function renderCuratedSections() {
  const latestFiles = availableFiles
    .filter((file) => Number.isFinite(Date.parse(file.created_at)))
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
    .slice(0, 4);
  const popularFiles = availableFiles
    .filter((file) => Number(file.downloads) > 0)
    .sort((first, second) => Number(second.downloads) - Number(first.downloads))
    .slice(0, 4);

  latestPanel.hidden = latestFiles.length === 0;
  latestCount.textContent = String(latestFiles.length);
  latestList.replaceChildren(...latestFiles.map(createPersonalFileRow));
  popularPanel.hidden = popularFiles.length === 0;
  popularCount.textContent = String(popularFiles.length);
  popularList.replaceChildren(...popularFiles.map(createPersonalFileRow));
}

function applyHomepageSections(settings = homepageSections) {
  const main = document.querySelector(".main-content");
  const sectionElements = new Map([
    ["personal", document.querySelector(".personal-grid:not(.curated-grid)")],
    ["discovery", document.querySelector(".curated-grid")],
    ["planner", document.querySelector("#planner")],
    ["library", document.querySelector("#library")],
  ]);
  const configured = new Map(settings.map((section) => [section.id, section]));
  const orderedSections = defaultHomepageSections
    .map((section, fallbackIndex) => ({
      ...section,
      ...(configured.get(section.id) || {}),
      fallbackIndex,
    }))
    .sort((first, second) => first.position - second.position || first.fallbackIndex - second.fallbackIndex);

  for (const section of orderedSections) {
    const element = sectionElements.get(section.id);
    element.hidden = section.is_visible === false;
    main.append(element);
  }

  const visibility = {
    personal: !sectionElements.get("personal").hidden,
    planner: !sectionElements.get("planner").hidden,
    library: !sectionElements.get("library").hidden,
  };
  document.querySelectorAll('[data-nav-target="favorites"], .desktop-section-nav [data-nav-section="favorites"]')
    .forEach((element) => { element.hidden = !visibility.personal; });
  document.querySelectorAll('[data-nav-target="planner"], .desktop-section-nav [data-nav-section="planner"], .hero-actions a[href="#planner"]')
    .forEach((element) => { element.hidden = !visibility.planner; });
  document.querySelectorAll('[data-nav-target="library"], .desktop-section-nav [data-nav-section="library"], .hero-actions a[href="#library"]')
    .forEach((element) => { element.hidden = !visibility.library; });
  if (
    (activeNavigationSection === "favorites" && !visibility.personal) ||
    (activeNavigationSection === "planner" && !visibility.planner) ||
    (activeNavigationSection === "library" && !visibility.library)
  ) setActiveNavigation("top");
}

function isPdfFile(file) {
  return file.mime_type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function showPdfViewer(file) {
  const sourceUrl = cloudLibraryEnabled ? file.url : fileUrl(file.name);
  if (!sourceUrl) {
    showToast(currentText().downloadFailed);
    return;
  }
  pdfViewerTitle.textContent = file.name.replace(/\.pdf$/i, "");
  pdfViewerOpenOriginal.href = sourceUrl;
  pdfViewerDownload.href = cloudLibraryEnabled ? file.downloadUrl : fileUrl(file.name);
  pdfViewerDownload.download = getDownloadName(file);
  pdfViewerFullscreen.setAttribute("aria-label", currentText().fullscreen);
  pdfViewerFullscreen.title = currentText().fullscreen;
  pdfViewerClose.setAttribute("aria-label", currentText().closeViewer);
  pdfViewerClose.title = currentText().closeViewer;
  pdfViewerLoading.hidden = false;
  pdfViewerFrame.title = `${currentText().open}: ${file.name}`;
  pdfViewerFrame.src = sourceUrl;
  rememberRecentlyOpened(file);
  if (typeof pdfViewer.showModal === "function") pdfViewer.showModal();
  else window.open(sourceUrl, "_blank", "noopener");
}

function renderStudyPlanner() {
  const selectedCategory = studyCategorySelect.value;
  studyCategorySelect.replaceChildren(new Option(currentText().all, ""));
  for (const category of categories.filter((item) => item.available)) {
    studyCategorySelect.append(new Option(
      language === "en" && category.name_en ? category.name_en : textCategoryName(category),
      getCategoryIdentity(category),
    ));
  }
  if ([...studyCategorySelect.options].some((option) => option.value === selectedCategory)) {
    studyCategorySelect.value = selectedCategory;
  }

  const priorityOrder = { high: 0, normal: 1, low: 2 };
  const orderedTasks = [...studyTasks].sort((first, second) => {
    if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
    const priorityDifference = (priorityOrder[first.priority] ?? 1) - (priorityOrder[second.priority] ?? 1);
    if (priorityDifference) return priorityDifference;
    return (first.dueDate || "9999-12-31").localeCompare(second.dueDate || "9999-12-31");
  });
  studyTaskList.replaceChildren(...orderedTasks.map((task) => {
    const item = document.createElement("li");
    item.className = `study-task${task.completed ? " is-complete" : ""}`;

    const label = document.createElement("label");
    label.className = "study-task-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute("aria-label", `${currentText().taskComplete}: ${task.title}`);
    checkbox.addEventListener("change", () => {
      studyTasks = studyTasks.map((storedTask) => storedTask.id === task.id
        ? { ...storedTask, completed: checkbox.checked }
        : storedTask);
      saveStoredArray(studyTaskStorageKey, studyTasks);
      renderStudyPlanner();
    });
    const title = document.createElement("span");
    title.textContent = task.title;
    label.append(checkbox, title);
    item.append(label);

    const category = categories.find((entry) => getCategoryIdentity(entry) === task.categoryId);
    if (category || task.dueDate || task.priority) {
      const detail = document.createElement("span");
      detail.className = "study-task-detail";
      const priority = document.createElement("span");
      const priorityValue = task.priority || "normal";
      priority.className = `task-priority is-${priorityValue}`;
      priority.textContent = currentText()[
        priorityValue === "high" ? "priorityHigh" : priorityValue === "low" ? "priorityLow" : "priorityNormal"
      ];
      detail.append(priority);
      if (category) {
        detail.textContent = language === "en" && category.name_en
          ? category.name_en
          : textCategoryName(category);
      }
      if (task.dueDate) {
        const dueDate = new Date(`${task.dueDate}T00:00:00`);
        const time = document.createElement("time");
        time.dateTime = task.dueDate;
        time.textContent = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
          dateStyle: "medium",
        }).format(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!task.completed && dueDate < today) time.classList.add("is-overdue");
        detail.append(time);
      }
      item.append(detail);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "study-task-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `${currentText().deleteTask}: ${task.title}`);
    deleteButton.addEventListener("click", () => {
      studyTasks = studyTasks.filter((storedTask) => storedTask.id !== task.id);
      saveStoredArray(studyTaskStorageKey, studyTasks);
      renderStudyPlanner();
    });
    item.append(deleteButton);
    return item;
  }));

  const completedTasks = studyTasks.filter((task) => task.completed).length;
  studySummary.textContent = currentText().tasksSummary(
    completedTasks,
    studyTasks.length - completedTasks,
  );
  studyTaskEmpty.hidden = studyTasks.length > 0;
  const totalStudySeconds = studySessions.reduce((total, session) => total + session.seconds, 0);
  studySessionTotal.textContent = String(Math.floor(totalStudySeconds / 60));
  updateStudyTimerDisplay();
}

function currentTimerElapsedSeconds() {
  const activeSeconds = studySegmentStartedAt
    ? Math.floor((Date.now() - studySegmentStartedAt) / 1000)
    : 0;
  return studyElapsedSeconds + activeSeconds;
}

function updateStudyTimerDisplay() {
  const durationMinutes = Math.round(focusDurationSeconds / 60);
  studyDurationHoursInput.value = String(Math.floor(durationMinutes / 60));
  studyDurationMinutesInput.value = String(durationMinutes % 60);
  const durationLocked = Boolean(studySegmentStartedAt || studyElapsedSeconds);
  studyDurationHoursInput.disabled = durationLocked;
  studyDurationMinutesInput.disabled = durationLocked;
  const remainingSeconds = Math.max(0, focusDurationSeconds - currentTimerElapsedSeconds());
  const totalMinutes = Math.floor(remainingSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  studyTimerDisplay.textContent = hours
    ? `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`
    : `${minutes}:${seconds}`;
  timerPauseButton.disabled = !studySegmentStartedAt;
  timerResetButton.disabled = currentTimerElapsedSeconds() === 0;
  timerStartButton.textContent = currentTimerElapsedSeconds() > 0
    ? currentText().timerResume
    : currentText().timerStart;
}

function saveStudyDuration() {
  const hours = Number(studyDurationHoursInput.value);
  const minutes = Number(studyDurationMinutesInput.value);
  const totalMinutes = hours * 60 + minutes;
  if (
    !Number.isInteger(hours) || hours < 0 || hours > 23 ||
    !Number.isInteger(minutes) || minutes < 0 || minutes > 59 ||
    totalMinutes < 1 || totalMinutes > 1439
  ) {
    showStudyTimerStatus(currentText().durationRangeError);
    updateStudyTimerDisplay();
    return;
  }

  focusDurationSeconds = totalMinutes * 60;
  try {
    localStorage.setItem(studyDurationStorageKey, String(totalMinutes));
    showStudyTimerStatus();
  } catch {
    showStudyTimerStatus(currentText().durationSaveError);
  }
  updateStudyTimerDisplay();
}

function showStudyTimerStatus(message = "") {
  studyTimerStatus.textContent = message;
  studyTimerStatus.hidden = !message;
}

function recordStudySession(seconds) {
  const duration = Math.max(0, Math.floor(seconds));
  if (!duration) return;
  studySessions = [{ id: `session-${Date.now()}`, seconds: duration, createdAt: new Date().toISOString() },
    ...studySessions].slice(0, 100);
  saveStoredArray(studySessionStorageKey, studySessions);
  renderStudyPlanner();
}

function startStudyTimer() {
  if (studySegmentStartedAt) return;
  studySegmentStartedAt = Date.now();
  studyTimerInterval = window.setInterval(() => {
    if (currentTimerElapsedSeconds() >= focusDurationSeconds) {
      const segmentSeconds = Math.max(0, focusDurationSeconds - studyElapsedSeconds);
      window.clearInterval(studyTimerInterval);
      studyTimerInterval = undefined;
      studySegmentStartedAt = 0;
      recordStudySession(segmentSeconds);
      studyElapsedSeconds = 0;
      updateStudyTimerDisplay();
      showStudyTimerStatus();
      showToast(currentText().sessionComplete);
      return;
    }
    updateStudyTimerDisplay();
  }, 1000);
  updateStudyTimerDisplay();
}

function pauseStudyTimer() {
  if (!studySegmentStartedAt) return;
  const segmentSeconds = Math.floor((Date.now() - studySegmentStartedAt) / 1000);
  studyElapsedSeconds += segmentSeconds;
  studySegmentStartedAt = 0;
  window.clearInterval(studyTimerInterval);
  studyTimerInterval = undefined;
  recordStudySession(segmentSeconds);
  updateStudyTimerDisplay();
  showStudyTimerStatus(currentText().sessionSaved);
}

function resetStudyTimer() {
  if (studySegmentStartedAt) {
    const segmentSeconds = Math.floor((Date.now() - studySegmentStartedAt) / 1000);
    window.clearInterval(studyTimerInterval);
    studyTimerInterval = undefined;
    studySegmentStartedAt = 0;
    recordStudySession(segmentSeconds);
    showStudyTimerStatus(currentText().sessionSaved);
  }
  studyElapsedSeconds = 0;
  updateStudyTimerDisplay();
}

function createLocalId(prefix) {
  const uniquePart = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uniquePart}`;
}

function setActiveNavigation(sectionId) {
  activeNavigationSection = sectionId;
  const mobileButtons = [...mobileNavigation.querySelectorAll("[data-nav-target]")];
  for (const button of mobileButtons) {
    const isActive = button.dataset.navTarget === sectionId;
    if (isActive) button.setAttribute("aria-current", "location");
    else button.removeAttribute("aria-current");
  }
  document.querySelectorAll(".desktop-section-nav [data-nav-section]").forEach((link) => {
    if (link.dataset.navSection === sectionId) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });

  const activeButton = mobileButtons.find((button) => button.dataset.navTarget === sectionId);
  if (!activeButton) return;
  const navBounds = mobileNavigation.getBoundingClientRect();
  const buttonBounds = activeButton.getBoundingClientRect();
  const indicatorWidth = Math.min(6, buttonBounds.width * 0.56);
  const indicatorOffset = buttonBounds.left - navBounds.left + buttonBounds.width / 2 - indicatorWidth / 2;
  mobileNavIndicator.style.width = `${indicatorWidth}px`;
  mobileNavIndicator.style.transform = `translateX(${indicatorOffset}px)`;
}

function closeMobileMoreMenu() {
  moreMenuButton.setAttribute("aria-expanded", "false");
  mobileMoreMenu.classList.remove("is-open");
  window.clearTimeout(mobileMoreMenuCloseTimeout);
  if (mobileMoreMenu.hidden) return;
  mobileMoreMenuCloseTimeout = window.setTimeout(() => {
    if (moreMenuButton.getAttribute("aria-expanded") === "false") {
      mobileMoreMenu.hidden = true;
    }
  }, 180);
}

function positionMobileMoreMenu() {
  const buttonBounds = moreMenuButton.getBoundingClientRect();
  const menuWidth = Math.min(280, window.innerWidth - 28);
  const margin = 14;
  const left = Math.max(
    margin,
    Math.min(
      buttonBounds.left + buttonBounds.width / 2 - menuWidth / 2,
      window.innerWidth - menuWidth - margin,
    ),
  );
  mobileMoreMenu.style.left = `${left}px`;
  mobileMoreMenu.style.right = "auto";
  mobileMoreMenu.style.bottom = `${window.innerHeight - buttonBounds.top + 10}px`;
  mobileMoreMenu.style.setProperty(
    "--more-pointer-left",
    `${buttonBounds.left + buttonBounds.width / 2 - left}px`,
  );
}

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

  searchInput.placeholder = currentText().searchPlaceholder;
  searchInput.setAttribute(
    "aria-label",
    currentText().searchPlaceholder.replace(/\.\.\.$/, ""),
  );
  document.querySelectorAll("[data-placeholder]").forEach((element) => {
    const placeholder = currentText()[element.dataset.placeholder];
    if (placeholder) element.placeholder = placeholder;
  });
  renderCategories();
  renderFiles();
  renderNotifications();
  renderStudyPlanner();
  applyHomepageSections();
  setActiveNavigation(activeNavigationSection);
}

function renderNotifications() {
  const unread = notifications.filter((notification) =>
    !readNotificationIds.has(notification.id));
  notificationBadge.hidden = unread.length === 0;
  notificationBadge.textContent = unread.length > 99 ? "99+" : String(unread.length);
  notificationBadge.setAttribute("aria-label", currentText().unreadCount(unread.length));
  notificationCount.textContent = currentText().unreadCount(unread.length);
  markNotificationsRead.disabled = unread.length === 0;
  notificationEmpty.hidden = notifications.length > 0;
  notificationList.replaceChildren(...notifications.map((notification) => {
    const item = document.createElement("li");
    const content = document.createElement("div");
    content.className = `notification-item${readNotificationIds.has(notification.id) ? "" : " is-unread"}`;
    content.dataset.notificationId = notification.id;
    const openButton = document.createElement("button");
    openButton.className = "notification-item-open";
    openButton.type = "button";
    const title = document.createElement("span");
    title.className = "notification-item-title";
    title.textContent = notification.title;
    openButton.append(title);
    openButton.addEventListener("click", () => openNotification(notification));
    content.append(openButton);
    if (notification.body) {
      const body = document.createElement("span");
      body.className = "notification-item-body";
      body.textContent = notification.body;
      content.append(body);
    }
    if (notification.imageUrl) {
      const image = document.createElement("img");
      image.className = "notification-item-image";
      image.src = notification.imageUrl;
      image.alt = notification.title;
      image.loading = "lazy";
      content.append(image);
    }
    if (notification.attachments?.length) {
      const attachmentList = document.createElement("ul");
      attachmentList.className = "notification-attachments";
      for (const attachment of notification.attachments) {
        if (!attachment.url) continue;
        const attachmentItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = attachment.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = attachment.name;
        attachmentItem.append(link);
        attachmentList.append(attachmentItem);
      }
      if (attachmentList.childElementCount) {
        const label = document.createElement("span");
        label.className = "notification-attachments-label";
        label.textContent = currentText().attachments;
        content.append(label, attachmentList);
      }
    }
    const time = document.createElement("time");
    time.dateTime = notification.created_at;
    time.textContent = new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(notification.created_at));
    content.append(time);
    item.append(content);
    return item;
  }));
  updatePushButton();
}

async function updatePushButton() {
  const pushSupported = "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(supabaseConfig.vapidPublicKey);
  enablePushButton.hidden = !pushSupported;
  enablePushButton.disabled = false;
  if (!pushSupported) return;
  if (Notification.permission === "denied") {
    enablePushButton.hidden = true;
    return;
  }
  if (Notification.permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        enablePushButton.textContent = currentText().pushEnabled;
        enablePushButton.disabled = true;
        return;
      }
    } catch (error) {
      showToast(error.message || currentText().pushUnavailable);
    }
  }
  enablePushButton.textContent = currentText().enableNotifications;
}

function markNotificationRead(notificationId) {
  readNotificationIds.add(notificationId);
  saveReadNotificationIds();
  renderNotifications();
}

function openNotification(notification) {
  markNotificationRead(notification.id);
  const file = availableFiles.find((item) => item.id === notification.file_id);
  if (!file) return;
  activeCategory = file.category_id;
  let parentId = categories.find((category) => category.id === activeCategory)?.parent_id;
  while (parentId) {
    expandedCategoryIds.add(parentId);
    parentId = categories.find((category) => category.id === parentId)?.parent_id;
  }
  searchInput.value = "";
  renderCategories();
  renderFiles();
  document.querySelector("#library").scrollIntoView({ behavior: "smooth" });
  window.setTimeout(() => {
    document.querySelector(`[data-file-id="${CSS.escape(file.id)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function toggleNotificationPanel(forceOpen) {
  const shouldOpen = forceOpen ?? notificationPanel.hidden;
  notificationPanel.hidden = !shouldOpen;
  notificationButton.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    positionNotificationArrow();
    updatePushButton();
  }
}

function positionNotificationArrow() {
  if (notificationPanel.hidden) return;
  const buttonBounds = notificationButton.getBoundingClientRect();
  const arrowCenter = buttonBounds.left + buttonBounds.width / 2 - notificationPanel.offsetLeft;
  const arrowLeft = Math.min(
    notificationPanel.offsetWidth - 18,
    Math.max(18, arrowCenter),
  );
  notificationPanel.style.setProperty("--notification-arrow-left", `${arrowLeft}px`);
}

window.addEventListener("resize", positionNotificationArrow);

function decodeVapidPublicKey(key) {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function categoriesForSemester(semesterId) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories.filter((category) => {
    let current = category;
    const visited = new Set();
    while (current?.parent_id && !visited.has(current.id)) {
      visited.add(current.id);
      current = byId.get(current.parent_id);
    }
    return current?.semester_id === semesterId;
  });
}

function countCategoryFiles(categoryId) {
  const ids = getCategoryTreeIds(categoryId);
  return new Set(availableFiles
    .filter((file) => ids.has(file.category_id))
    .map((file) => file.id)).size;
}

function getCategoryTreeIds(categoryId) {
  const ids = new Set([categoryId]);
  let found;
  do {
    found = false;
    for (const category of categories) {
      if (ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        found = true;
      }
    }
  } while (found);
  return ids;
}

function renderSemesters() {
  semesterGrid.replaceChildren(...[...semesters]
    .filter((semester) => semester.status !== "hidden")
    .sort((first, second) => first.position - second.position)
    .map((semester) => {
      const card = document.createElement("button");
      const comingSoon = semester.status === "coming_soon";
      const semesterCategories = categoriesForSemester(semester.id);
      const categoryIds = new Set(semesterCategories.map((category) => category.id));
      const fileCount = new Set(availableFiles
        .filter((file) => categoryIds.has(file.category_id))
        .map((file) => file.id)).size;
      card.type = "button";
      card.className = `semester-card${comingSoon ? " is-coming-soon" : ""}`;
      card.disabled = comingSoon;
      card.setAttribute("aria-label", `${semester.name}${comingSoon ? "، قريبًا" : ""}`);
      const icon = document.createElement("span");
      icon.className = "semester-icon";
      icon.textContent = semester.icon || "📚";
      icon.setAttribute("aria-hidden", "true");
      const content = document.createElement("span");
      content.className = "semester-card-content";
      const status = document.createElement("span");
      status.className = "semester-status";
      status.textContent = semester.display_text || (comingSoon ? currentText().comingSoon : "متاح الآن");
      const title = document.createElement("strong");
      title.textContent = semester.name;
      const description = document.createElement("span");
      description.className = "semester-description";
      description.textContent = semester.description || "";
      const stats = document.createElement("span");
      stats.className = "semester-stats";
      const subjectCount = semester.id === firstSemesterId
        ? 6
        : semester.subject_count || semesterCategories.filter((category) =>
          !category.parent_id).length;
      stats.textContent = `${fileCount} ملف · ${subjectCount} مواد`;
      content.append(status, title, description, stats);
      const arrow = document.createElement("span");
      arrow.className = "semester-arrow";
      arrow.textContent = "←";
      arrow.setAttribute("aria-hidden", "true");
      card.append(icon, content, arrow);
      if (!comingSoon) {
        card.addEventListener("click", () => {
          activeSemester = semester;
          activeCategory = "all";
          semesterHome.hidden = true;
          termContent.hidden = false;
          searchInput.value = "";
          renderCategoryBrowser();
          renderFiles();
        });
      }
      return card;
    }));
}

function renderCategoryBrowser() {
  const inSemester = categoriesForSemester(activeSemester?.id);
  const current = categories.find((category) => category.id === activeCategory);
  const query = normalizeSearch(searchInput.value);
  const parentIds = current ? [current.id] : [null];
  const children = inSemester.filter((category) =>
    parentIds.includes(category.parent_id || null))
    .filter((category) => {
      if (!query || normalizeSearch(
        `${category.name_ar} ${category.name_en || ""} ${category.description || ""}`,
      ).includes(query)) return true;
      const categoryIds = getCategoryTreeIds(category.id);
      return availableFiles.some((file) => categoryIds.has(file.category_id) &&
        normalizeSearch(
          `${file.name} ${file.description || ""} ${getCategoryLabel(file.categories || {
            name_ar: file.category,
            name_en: file.categoryNameEn,
          })}`,
        ).includes(query));
    })
    .sort((first, second) => first.position - second.position);

  const crumbs = [];
  const home = document.createElement("button");
  home.type = "button";
  home.textContent = "الرئيسية";
  home.addEventListener("click", () => {
    activeSemester = null;
    activeCategory = "all";
    semesterHome.hidden = false;
    termContent.hidden = true;
    renderFiles();
  });
  crumbs.push(home, document.createTextNode("‹ "));
  const semesterCrumb = document.createElement("button");
  semesterCrumb.type = "button";
  semesterCrumb.textContent = activeSemester?.name || "الترم الأول";
  semesterCrumb.addEventListener("click", () => {
    activeCategory = "all";
    renderCategoryBrowser();
    renderFiles();
  });
  crumbs.push(semesterCrumb);
  const lineage = [];
  let ancestor = current;
  const visitedAncestors = new Set();
  while (ancestor && !visitedAncestors.has(ancestor.id)) {
    visitedAncestors.add(ancestor.id);
    lineage.unshift(ancestor);
    ancestor = categories.find((category) => category.id === ancestor.parent_id);
  }
  for (const category of lineage) {
    crumbs.push(document.createTextNode(" ‹ "));
    const crumb = document.createElement("button");
    crumb.type = "button";
    crumb.textContent = category.name_ar;
    crumb.addEventListener("click", () => {
      activeCategory = category.id;
      renderCategoryBrowser();
      renderFiles();
    });
    crumbs.push(crumb);
  }
  libraryBreadcrumbs.replaceChildren(...crumbs);

  categoryCards.replaceChildren(...children.map((category) => {
    const card = document.createElement("button");
    card.type = "button";
    const comingSoon = category.is_coming_soon;
    const descriptionText = category.description?.trim() || "";
    card.className = `category-card${comingSoon ? " is-coming-soon" : ""}${descriptionText ? " has-description" : ""}`;
    card.disabled = comingSoon;
    if (!comingSoon) {
      card.addEventListener("click", () => {
        activeCategory = category.id;
        renderCategoryBrowser();
        renderFiles();
      });
    }
    const icon = document.createElement("span");
    icon.className = "category-card-icon";
    icon.setAttribute("aria-hidden", "true");
    const customIcon = category.icon?.trim();
    if (customIcon && !["📁", "folder", "default"].includes(customIcon.toLowerCase())) {
      icon.textContent = customIcon;
      icon.classList.add("has-custom-icon");
    } else {
      const searchableName = `${category.key || ""} ${category.name_ar || ""} ${category.name_en || ""}`.toLowerCase();
      const iconThemes = [
        { theme: "exam", match: /امتحان|اختبار|exam|test|quiz/ },
        { theme: "lecture", match: /محاضر|lecture|lesson/ },
        { theme: "section", match: /سكشن|section|tutorial/ },
        { theme: "tax", match: /ضرائب|ضريبة|tax/ },
        { theme: "finance", match: /مالية|اقتصاد|مال|finance|financial|econom/ },
        { theme: "calculator", match: /محاسب|تكلفة|تكاليف|حساب|account|cost|calcul/ },
        { theme: "business", match: /منشآت|اعمال|business|enterprise/ },
        { theme: "library", match: /مكتبة|سنتر|سناتر|مركز|كتاب|library|center|centre|book/ },
        { theme: "document", match: /ملخص|مذكرة|ورق|مراجعة|document|summary|note|review/ },
      ];
      const theme = iconThemes.find((item) => item.match.test(searchableName))?.theme || "folder";
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
      icon.dataset.theme = theme;
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${iconPaths[theme]}</svg>`;
    }
    const name = document.createElement("strong");
    name.textContent = category.name_ar;
    const count = document.createElement("span");
    count.className = "category-card-count";
    count.textContent = comingSoon ? currentText().comingSoon : `${countCategoryFiles(category.id)} ملف`;
    const arrow = document.createElement("span");
    arrow.className = "category-card-arrow";
    arrow.textContent = "←";
    arrow.setAttribute("aria-hidden", "true");
    card.append(icon, name);
    if (descriptionText) {
      const description = document.createElement("span");
      description.className = "category-card-description";
      description.textContent = descriptionText;
      card.append(description);
    }
    card.append(count, arrow);
    return card;
  }));
  categoryCards.hidden = children.length === 0;
  renderCategories();
}

function renderCategories() {
  const text = currentText();
  const byParent = new Map();
  for (const category of categories) {
    const parentId = category.parent_id || "";
    const siblings = byParent.get(parentId) || [];
    siblings.push(category);
    byParent.set(parentId, siblings);
  }

  function makeCategoryNode(category) {
    const children = byParent.get(category.id) || [];
    const node = document.createElement("div");
    node.className = `category-tree-node${children.length ? " has-children" : ""}`;
    const button = document.createElement("button");
    const key = category.id || category.key;
    button.className = "category-button";
    button.type = "button";
    button.disabled = !category.available;
    button.setAttribute("aria-pressed", String(activeCategory === key));
    const name = document.createElement("span");
    name.textContent = language === "en" && category.name_en
      ? category.name_en
      : textCategoryName(category);
    button.append(name);
    if (!category.available) {
      const status = document.createElement("span");
      status.className = "coming-soon";
      status.textContent = text.comingSoon;
      button.append(status);
    } else {
      button.addEventListener("click", () => {
        activeCategory = key;
        if (activeSemester) renderCategoryBrowser();
        else renderCategories();
        renderFiles();
      });
    }
    node.append(button);

    if (children.length) {
      const expanded = expandedCategoryIds.has(category.id);
      const toggle = document.createElement("button");
      toggle.className = "category-expand-button";
      toggle.type = "button";
      toggle.textContent = expanded ? "⌄" : "›";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute(
        "aria-label",
        `${expanded ? "إخفاء" : "إظهار"} تصنيفات ${textCategoryName(category)}`,
      );
      toggle.addEventListener("click", () => {
        if (expandedCategoryIds.has(category.id)) {
          expandedCategoryIds.delete(category.id);
        } else {
          expandedCategoryIds.add(category.id);
        }
        renderCategories();
      });
      node.append(toggle);
      if (expanded) {
        const childList = document.createElement("div");
        childList.className = "category-tree-children";
        childList.append(...children.map(makeCategoryNode));
        node.append(childList);
      }
    }
    return node;
  }

  const allButton = document.createElement("button");
  allButton.className = "category-button";
  allButton.type = "button";
  allButton.textContent = text.all;
  allButton.setAttribute("aria-pressed", String(activeCategory === "all"));
  allButton.addEventListener("click", () => {
    activeCategory = "all";
    if (activeSemester) renderCategoryBrowser();
    else renderCategories();
    renderFiles();
  });
  const roots = byParent.get("") || [];
  categoryList.replaceChildren(allButton, ...roots.map(makeCategoryNode));
  updateCategoryScrollControls();
}

function getCategoryLabel(category) {
  const names = [];
  let current = category;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(
      language === "en" && current.name_en
        ? current.name_en
        : textCategoryName(current),
    );
    current = categories.find((item) => item.id === current.parent_id);
  }
  return names.join(" / ");
}

function textCategoryName(category) {
  return currentText().categories[category.key] || category.name_ar || category.key;
}

function updateCategoryScrollControls() {
  const rail = categoryList.getBoundingClientRect();
  const items = [...categoryList.children];
  const visibleItems = items.filter((item) => {
    const rect = item.getBoundingClientRect();
    return rect.right > rail.left + 1 && rect.left < rail.right - 1;
  });
  const leftmost = visibleItems.reduce((left, item) =>
    !left || item.getBoundingClientRect().left < left.getBoundingClientRect().left
      ? item
      : left, null);
  const rightmost = visibleItems.reduce((right, item) =>
    !right || item.getBoundingClientRect().right > right.getBoundingClientRect().right
      ? item
      : right, null);
  const hasHiddenLeft = items.some((item) => item.getBoundingClientRect().right <= rail.left + 1);
  const hasHiddenRight = items.some((item) => item.getBoundingClientRect().left >= rail.right - 1);

  const hasOverflow = hasHiddenLeft || hasHiddenRight;
  categoryScrollLeft.hidden = !hasOverflow;
  categoryScrollRight.hidden = !hasOverflow;
  categoryScrollLeft.disabled = !hasHiddenLeft;
  categoryScrollRight.disabled = !hasHiddenRight;
  categoryScrollLeft.classList.toggle("is-active", Boolean(leftmost && hasHiddenLeft));
  categoryScrollRight.classList.toggle("is-active", Boolean(rightmost && hasHiddenRight));
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
  const query = normalizeSearch(searchInput.value);
  const isSelectingCategory = Boolean(activeSemester) && activeCategory === "all";
  const visibleCategoryIds = activeCategory !== "all"
    ? getCategoryTreeIds(activeCategory)
    : activeSemester
      ? new Set(categoriesForSemester(activeSemester.id).map((category) => category.id))
      : null;
  const visibleFiles = availableFiles.filter((file) => {
    if (isSelectingCategory) return false;
    const matchesCategory = !visibleCategoryIds ||
      visibleCategoryIds.has(file.category_id);
    const categoryName = cloudLibraryEnabled
      ? getCategoryLabel(file.categories || { name_ar: file.category, name_en: file.categoryNameEn })
      : text.categories[file.category] || file.category;
    const matchesSearch = normalizeSearch(
      `${file.name} ${file.description || ""} ${categoryName} ${file.mime_type || ""}`,
    ).includes(query);
    return matchesCategory && matchesSearch;
  });
  function createFileCard(file) {
    const card = document.createElement("article");
    card.className = "file-card";
    card.dataset.fileId = getFileIdentity(file);

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
    if (file.is_new) {
      const badge = document.createElement("span");
      badge.className = "file-new-badge";
      badge.textContent = text.newFile;
      title.append(" ", badge);
    }
    const category = document.createElement("span");
    category.className = "file-category";
    category.textContent = cloudLibraryEnabled
      ? getCategoryLabel(file.categories || {
        name_ar: file.category,
        name_en: file.categoryNameEn,
      })
      : text.categories[file.category] || file.category;
    const metadata = document.createElement("span");
    metadata.className = "file-meta";
    const extension = file.name.match(/\.[^.]+$/)?.[0].slice(1).toUpperCase();
    const fileType = extension || (mimeType.startsWith("application/")
      ? mimeType.split("/")[1].split(".").pop().toUpperCase()
      : mimeType.split("/")[0].toUpperCase());
    metadata.textContent = [
      fileType,
      Number(file.size_bytes) > 0 ? formatLibraryFileSize(file.size_bytes) : "",
    ].filter(Boolean).join(" · ");
    details.append(title, category, metadata);
    const favoriteButton = document.createElement("button");
    favoriteButton.className = "file-favorite-button";
    favoriteButton.type = "button";
    const isFavorite = favoriteFileIds.has(getFileIdentity(file));
    favoriteButton.textContent = isFavorite ? "★" : "☆";
    favoriteButton.setAttribute("aria-pressed", String(isFavorite));
    favoriteButton.setAttribute(
      "aria-label",
      isFavorite ? text.removeFavorite : text.addFavorite,
    );
    favoriteButton.addEventListener("click", () => toggleFavorite(file));
    top.append(icon, details, favoriteButton);

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
    openLink.href = cloudLibraryEnabled ? file.url : fileUrl(file.name);
    openLink.target = "_blank";
    openLink.rel = "noopener";
    openLink.textContent = `↗ ${text.open}`;
    openLink.setAttribute("aria-label", `${text.open}: ${file.name}`);
    openLink.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (isPdfFile(file)) {
        event.preventDefault();
        showPdfViewer(file);
        return;
      }
      rememberRecentlyOpened(file);
    });

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
  }

  function createFileCategoryGroup(category, filesByCategory) {
    const directFiles = filesByCategory.get(category.id) || [];
    const childCategories = categories.filter((item) => item.parent_id === category.id);
    const children = childCategories
      .map((child) => createFileCategoryGroup(child, filesByCategory))
      .filter(Boolean);
    const total = directFiles.length + children.reduce(
      (count, child) => count + Number(child.dataset.fileCount),
      0,
    );
    if (!total) return null;

    const section = document.createElement("section");
    section.className = "file-category-group";
    section.dataset.fileCount = String(total);
    const collapsed = collapsedFileGroupIds.has(category.id);
    const heading = document.createElement("button");
    heading.className = "file-category-toggle";
    heading.type = "button";
    heading.setAttribute("aria-expanded", String(!collapsed));
    const label = document.createElement("span");
    label.textContent = language === "en" && category.name_en
      ? category.name_en
      : textCategoryName(category);
    const count = document.createElement("span");
    count.className = "file-category-count";
    count.textContent = String(total);
    const arrow = document.createElement("span");
    arrow.className = "file-category-arrow";
    arrow.textContent = collapsed ? "›" : "⌄";
    heading.append(label, count, arrow);
    heading.addEventListener("click", () => {
      if (collapsedFileGroupIds.has(category.id)) {
        collapsedFileGroupIds.delete(category.id);
      } else {
        collapsedFileGroupIds.add(category.id);
      }
      renderFiles();
    });
    section.append(heading);

    if (!collapsed) {
      const contents = document.createElement("div");
      contents.className = "file-category-contents";
      if (directFiles.length) {
        const cards = document.createElement("div");
        cards.className = "category-file-grid";
        cards.append(...directFiles.map(createFileCard));
        contents.append(cards);
      }
      contents.append(...children);
      section.append(contents);
    }
    return section;
  }

  if (activeCategory === "all" && cloudLibraryEnabled) {
    const filesByCategory = new Map();
    for (const file of visibleFiles) {
      const categoryFiles = filesByCategory.get(file.category_id) || [];
      categoryFiles.push(file);
      filesByCategory.set(file.category_id, categoryFiles);
    }
    const groups = categories
      .filter((category) => !category.parent_id)
      .map((category) => createFileCategoryGroup(category, filesByCategory))
      .filter(Boolean);
    fileGrid.replaceChildren(...groups);
  } else {
    fileGrid.replaceChildren(...visibleFiles.map(createFileCard));
  }

  totalCount.textContent = String(availableFiles.length);
  resultCount.textContent = text.count(visibleFiles.length);
  footerCount.textContent = text.count(availableFiles.length);
  emptyState.textContent = isSelectingCategory
    ? query && !categoryCards.childElementCount
      ? text.noMatchingCategories
      : text.selectCategoryPrompt
    : !query && activeCategory !== "all"
      ? text.noCategoryFiles
      : text.empty;
  emptyState.hidden = visibleFiles.length > 0;
  fileGrid.hidden = visibleFiles.length === 0;
  renderPersonalSections();
}

function formatLibraryFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["بايت", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const formatted = new Intl.NumberFormat(language === "ar" ? "ar" : "en", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size / 1024 ** unitIndex);
  return `${formatted} ${units[unitIndex]}`;
}

async function loadCloudLibrary() {
  libraryLoadError.hidden = true;
  libraryRetry.hidden = true;
  if (!semesterGrid.childElementCount && !semesters.length) {
    semesterGrid.replaceChildren(...Array.from({ length: 2 }, () => {
      const skeleton = document.createElement("div");
      skeleton.className = "semester-skeleton";
      skeleton.setAttribute("aria-hidden", "true");
      return skeleton;
    }));
  }
  const library = await getPublicLibrary();
  const previousIds = new Set(notifications.map((notification) => notification.id));
  const newNotifications = notificationsLoaded
    ? library.notifications.filter((notification) => !previousIds.has(notification.id))
    : [];
  categories = library.categories.map((category) => ({
    ...category,
    key: category.name_ar,
    available: !category.is_coming_soon,
  }));
  semesters = library.semesters;
  homepageSections = library.homepageSections.length
    ? library.homepageSections
    : defaultHomepageSections;
  availableFiles = library.files;
  notifications = library.notifications;
  notificationsLoaded = true;
  cloudLibraryEnabled = true;
  renderSemesters();
  const requestedCategoryId = new URLSearchParams(window.location.search).get("category");
  const requestedSemesterId = new URLSearchParams(window.location.search).get("semester");
  if (requestedCategoryId) {
    const requestedCategory = categories.find((category) => category.id === requestedCategoryId);
    let root = requestedCategory;
    while (root?.parent_id) {
      root = categories.find((category) => category.id === root.parent_id);
    }
    const requestedSemester = semesters.find((semester) =>
      semester.id === (requestedSemesterId || root?.semester_id) &&
      semester.status === "active");
    if (requestedCategory && requestedSemester) {
      activeSemester = requestedSemester;
      activeCategory = requestedCategory.id;
      semesterHome.hidden = true;
      termContent.hidden = false;
    }
  }
  if (newNotifications.length && document.visibilityState === "visible") {
    playNotificationSound();
  }
  if (
    activeCategory !== "all" &&
    !categories.some((category) => category.id === activeCategory)
  ) {
    activeCategory = "all";
  }
  renderCategories();
  if (activeSemester && !semesters.some((semester) => semester.id === activeSemester.id)) {
    activeSemester = null;
    activeCategory = "all";
    semesterHome.hidden = false;
    termContent.hidden = true;
  }
  if (activeSemester) renderCategoryBrowser();
  renderFiles();
  renderNotifications();
  renderStudyPlanner();
  applyHomepageSections();
}

libraryRetry.addEventListener("click", () => {
  loadCloudLibrary().catch((error) => {
    showLibraryError(error);
  });
});

function showLibraryError(error) {
  semesterGrid.replaceChildren();
  libraryLoadError.textContent = libraryErrorMessage(error);
  libraryLoadError.hidden = false;
  libraryRetry.hidden = false;
}

function libraryErrorMessage(error) {
  if (["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code)) {
    return "قاعدة بيانات الفصول غير مهيأة بعد. شغّل database/semester-library-migration.sql في Supabase ثم أعد المحاولة.";
  }
  return `تعذر تحميل المكتبة: ${error.message}`;
}

function unlockNotificationSound() {
  if (!("AudioContext" in window)) return;
  notificationAudioContext ||= new AudioContext();
  if (notificationAudioContext.state === "suspended") {
    notificationAudioContext.resume().catch((error) => {
      console.warn("Notification sound could not be enabled by this browser.", error);
    });
  }
}

function playNotificationSound() {
  if (!notificationAudioContext || notificationAudioContext.state !== "running") return;
  const context = notificationAudioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.setValueAtTime(1174.66, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
  gain.gain.setValueAtTime(0.12, now + 0.13);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.33);
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

studyTaskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(studyTaskForm);
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  studyTasks.unshift({
    id: createLocalId("task"),
    title,
    categoryId: String(formData.get("category_id") || ""),
    dueDate: String(formData.get("due_date") || ""),
    priority: String(formData.get("priority") || "normal"),
    completed: false,
    createdAt: new Date().toISOString(),
  });
  saveStoredArray(studyTaskStorageKey, studyTasks);
  studyTaskForm.reset();
  renderStudyPlanner();
});

timerStartButton.addEventListener("click", startStudyTimer);
timerPauseButton.addEventListener("click", pauseStudyTimer);
timerResetButton.addEventListener("click", resetStudyTimer);
studyDurationHoursInput.addEventListener("change", saveStudyDuration);
studyDurationMinutesInput.addEventListener("change", saveStudyDuration);

mobileNavigation.querySelectorAll("[data-nav-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const section = document.getElementById(button.dataset.navTarget);
    if (!section) return;
    setActiveNavigation(button.dataset.navTarget);
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  });
});

moreMenuButton.addEventListener("click", () => {
  const isOpening = moreMenuButton.getAttribute("aria-expanded") !== "true";
  if (!isOpening) {
    closeMobileMoreMenu();
    return;
  }
  window.clearTimeout(mobileMoreMenuCloseTimeout);
  positionMobileMoreMenu();
  mobileMoreMenu.hidden = false;
  moreMenuButton.setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => mobileMoreMenu.classList.add("is-open"));
});

mobileMoreMenu.addEventListener("click", (event) => {
  const item = event.target.closest("a, button");
  if (!item) return;
  const action = item.dataset.moreAction;
  closeMobileMoreMenu();
  if (!action) return;
  if (action === "notifications") notificationButton.click();
  if (action === "theme") themeButton.click();
  if (action === "language") languageButton.click();
  if (action === "install") installButton.click();
});

document.addEventListener("click", (event) => {
  if (!event.composedPath().includes(mobileMoreMenu) &&
      !event.composedPath().includes(moreMenuButton)) closeMobileMoreMenu();
});

if ("IntersectionObserver" in window) {
  const navigationObserver = new IntersectionObserver((entries) => {
    const visibleSections = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
    if (visibleSections.length) setActiveNavigation(visibleSections[0].target.id);
  }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.45] });
  ["top", "library", "favorites", "planner"].forEach((id) => {
    const section = document.getElementById(id);
    if (section) navigationObserver.observe(section);
  });
}

window.addEventListener("resize", () => setActiveNavigation(activeNavigationSection));
searchInput.addEventListener("input", () => {
  if (activeSemester) renderCategoryBrowser();
  renderFiles();
});
pdfViewerFrame.addEventListener("load", () => { pdfViewerLoading.hidden = true; });
pdfViewerClose.addEventListener("click", () => pdfViewer.close());
pdfViewer.addEventListener("click", (event) => {
  if (event.target === pdfViewer) pdfViewer.close();
});
pdfViewer.addEventListener("close", () => {
  pdfViewerFrame.src = "about:blank";
  pdfViewerLoading.hidden = false;
});
pdfViewerFullscreen.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (pdfViewer.requestFullscreen) {
    pdfViewer.requestFullscreen().catch(() => showToast(currentText().downloadFailed));
  }
});
languageButton.addEventListener("click", () =>
  setLanguage(language === "ar" ? "en" : "ar"),
);
notificationButton.addEventListener("click", () => {
  unlockNotificationSound();
  toggleNotificationPanel();
});
refreshAppButton.addEventListener("click", () => window.location.reload());
markNotificationsRead.addEventListener("click", () => {
  notifications.forEach(({ id }) => readNotificationIds.add(id));
  saveReadNotificationIds();
  renderNotifications();
});
enablePushButton.addEventListener("click", async () => {
  unlockNotificationSound();
  if (!supabaseConfig.vapidPublicKey) {
    showToast(currentText().pushSetupMissing);
    return;
  }
  if (!("Notification" in window) || !("PushManager" in window)) {
    showToast(currentText().pushUnavailable);
    return;
  }
  enablePushButton.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast(currentText().pushPermissionDenied);
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() ||
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidPublicKey(supabaseConfig.vapidPublicKey),
      });
      document.addEventListener("pointerdown", unlockNotificationSound, { once: true });
      document.addEventListener("keydown", unlockNotificationSound, { once: true });
    await registerPushSubscription(subscription.toJSON());
    enablePushButton.textContent = currentText().pushEnabled;
    showToast(currentText().pushEnableSuccess);
  } catch (error) {
    enablePushButton.disabled = false;
    showToast(error.name === "FunctionsFetchError"
      ? currentText().pushConnectionFailed
      : error.message || currentText().pushUnavailable);
  }
});
document.addEventListener("click", (event) => {
  const path = event.composedPath();
  if (
    !path.includes(notificationPanel) &&
    !path.includes(notificationButton)
  ) toggleNotificationPanel(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleNotificationPanel(false);
    closeMobileMoreMenu();
  }
});
categoryScrollLeft.addEventListener("click", () => scrollCategoryRail("left"));
categoryScrollRight.addEventListener("click", () => scrollCategoryRail("right"));
categoryList.addEventListener("scroll", updateCategoryScrollControls, { passive: true });
window.addEventListener("resize", updateCategoryScrollControls);
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

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    showToast(isIOS ? currentText().installIOS : currentText().installUnavailable);
    return;
  }
  try {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") showToast(currentText().installSuccess);
    installPrompt = null;
    installButton.hidden = true;
  } catch (error) {
    showToast(error.message || currentText().installUnavailable);
  }
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
});

window.matchMedia("(display-mode: standalone)").addEventListener("change", (event) => {
  installButton.hidden = event.matches;
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

if (localFeaturePreview) {
  try {
    const savedNotifications = localStorage.getItem(
      "course-library-feature-preview-notifications",
    );
    notifications = savedNotifications
      ? JSON.parse(savedNotifications)
      : [{
          id: "local-preview-notification",
          title: "ملف جديد: تعليمات المراجعة النهائية",
          body: "أضيفت تعليمات المراجعة. اضغط على هذا الإشعار للرجوع إليه.",
          type: "announcement",
          file_id: null,
          created_at: new Date().toISOString(),
        }];
    renderNotifications();
  } catch (error) {
    showToast(error.message || "تعذر تحميل إشعارات المعاينة المحلية.");
  }
} else if (isSupabaseConfigured) {
  loadCloudLibrary()
    .then(async () => {
      const requestedNotificationId = new URLSearchParams(window.location.search)
        .get("notification");
      if (requestedNotificationId) {
        toggleNotificationPanel(true);
        window.setTimeout(() => {
          document.querySelector(
            `[data-notification-id="${CSS.escape(requestedNotificationId)}"]`,
          )?.scrollIntoView({ block: "center" });
        }, 0);
      }
      await subscribeToLibrary(() => {
        loadCloudLibrary().catch((error) => {
          showToast(error.message || "تعذر تحديث المكتبة.");
        });
      });
    })
    .catch((error) => {
      showLibraryError(error);
      showToast(error.message || "تعذر تحميل المكتبة من قاعدة البيانات.");
    });
}

  void initializeStudentCalendar({ preview: localFeaturePreview, notify: showToast });
