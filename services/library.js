import { requireSupabase } from "./supabase.js";

export async function getPublicLibrary() {
  const client = requireSupabase();
  const [{ data: categories, error: categoriesError }, { data: files, error: filesError }] =
    await Promise.all([
      client.from("categories").select("*").order("position"),
      client
        .from("files")
        .select("*, categories(id, name_ar, name_en, parent_id, is_coming_soon)")
        .eq("is_published", true)
        .order("position")
        .order("created_at", { ascending: false }),
    ]);

  if (categoriesError) throw categoriesError;
  if (filesError) throw filesError;

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryChainIsVisible = (category, hideComingSoon) => {
    let current = category;
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      if (!current.is_active || (hideComingSoon && current.is_coming_soon)) return false;
      visited.add(current.id);
      if (!current.parent_id) return true;
      current = categoriesById.get(current.parent_id);
    }
    return false;
  };
  const publicCategories = categories.filter((category) =>
    categoryChainIsVisible(category, false));
  const visibleCategories = publicCategories.filter((category) =>
    categoryChainIsVisible(category, true));
  const categoryIds = new Set(visibleCategories.map((category) => category.id));
  const visibleFiles = files.filter((file) => categoryIds.has(file.category_id));
  const paths = [...new Set(visibleFiles.flatMap((file) =>
    [file.object_path, file.cover_path].filter(Boolean),
  ))];
  const signedUrls = new Map();
  if (paths.length) {
    const { data, error } = await client.storage
      .from("library-files")
      .createSignedUrls(paths, 1800);
    if (error) throw error;
    for (const item of data) {
      if (item.error) throw new Error(item.error);
      signedUrls.set(item.path, item.signedUrl);
    }
  }
  return {
    categories: publicCategories,
    files: visibleFiles.map((file) => ({
      ...file,
      category: file.categories.name_ar,
      categoryNameEn: file.categories.name_en,
      url: signedUrls.get(file.object_path),
      downloadUrl: createDownloadUrl(signedUrls.get(file.object_path), file.name),
      coverUrl: file.cover_path ? signedUrls.get(file.cover_path) : null,
    })),
  };
}

export async function getPublicNotifications() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("notifications")
    .select("id, title, body, type, file_id, image_path, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return data.map((notification) => ({
    ...notification,
    imageUrl: notification.image_path
      ? client.storage.from("notification-images")
        .getPublicUrl(notification.image_path).data.publicUrl
      : null,
  }));
}

function createDownloadUrl(signedUrl, fileName) {
  if (!signedUrl) return signedUrl;
  const url = new URL(signedUrl);
  url.searchParams.set("download", fileName);
  return url.href;
}

export function subscribeToLibrary(onChange) {
  const client = requireSupabase();
  return client
    .channel("public-library")
    .on("postgres_changes", { event: "*", schema: "public", table: "files" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, onChange)
    .subscribe();
}

export async function registerPushSubscription(subscription) {
  const { data, error } = await requireSupabase().functions.invoke("register-push", {
    body: { subscription },
  });
  if (error) throw error;
  return data;
}

export async function recordDownload(fileId) {
  const { error } = await requireSupabase().rpc("increment_file_downloads", {
    file_id: fileId,
  });
  if (error) throw error;
}
