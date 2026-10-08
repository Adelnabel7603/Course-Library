async function getClient() {
  const { requireSupabase } = await import("./supabase.js");
  return requireSupabase();
}

export async function getPublicLibrary() {
  const client = await getClient();
  const [
    { data: categories, error: categoriesError },
    { data: files, error: filesError },
    notificationsWithImage,
  ] = await Promise.all([
      client.from("categories").select("id, name_ar, name_en, parent_id, is_active, is_coming_soon, position").eq("is_active", true).order("position"),
      client
        .from("files")
        .select("*, categories(id, name_ar, name_en, parent_id, is_coming_soon)")
        .eq("is_published", true)
        .order("position")
        .order("created_at", { ascending: false }),
      client
        .from("notifications")
        .select("id, title, body, type, file_id, image_path, attachments, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (categoriesError) throw categoriesError;
  if (filesError) throw filesError;

  let notifications = notificationsWithImage.data;
  if (notificationsWithImage.error) {
    if (notificationsWithImage.error.code !== "42703") {
      throw notificationsWithImage.error;
    }
    const legacyNotificationsWithImage = await client
      .from("notifications")
      .select("id, title, body, type, file_id, image_path, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!legacyNotificationsWithImage.error) {
      notifications = legacyNotificationsWithImage.data.map((notification) => ({
        ...notification,
        attachments: [],
      }));
    } else if (legacyNotificationsWithImage.error.code === "42703") {
      const legacyNotifications = await client
        .from("notifications")
        .select("id, title, body, type, file_id, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacyNotifications.error) throw legacyNotifications.error;
      notifications = legacyNotifications.data.map((notification) => ({
        ...notification,
        image_path: null,
        attachments: [],
      }));
    } else {
      throw legacyNotificationsWithImage.error;
    }
  }

  const visibleCategories = categories.filter((category) => !category.is_coming_soon);
  const categoryIds = new Set(visibleCategories.map((category) => category.id));
  const visibleFiles = files.filter((file) => categoryIds.has(file.category_id));
  const attachmentPaths = notifications.flatMap((notification) =>
    (Array.isArray(notification.attachments) ? notification.attachments : [])
      .map((attachment) => attachment.object_path)
      .filter(Boolean),
  );
  const paths = [...new Set([
    ...visibleFiles.flatMap((file) => [file.object_path, file.cover_path].filter(Boolean)),
    ...attachmentPaths,
  ])];
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
  const notificationImageUrls = new Map(
    notifications
      .filter((notification) => notification.image_path)
      .map((notification) => [
        notification.image_path,
        client.storage.from("notification-images")
          .getPublicUrl(notification.image_path).data.publicUrl,
      ]),
  );
  return {
    categories,
    notifications: notifications.map((notification) => ({
      ...notification,
      imageUrl: notification.image_path
        ? notificationImageUrls.get(notification.image_path)
        : null,
      attachments: (Array.isArray(notification.attachments)
        ? notification.attachments
        : []).map((attachment) => ({
          ...attachment,
          url: signedUrls.get(attachment.object_path),
          downloadUrl: createDownloadUrl(
            signedUrls.get(attachment.object_path),
            attachment.name,
          ),
        })),
    })),
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

function createDownloadUrl(signedUrl, fileName) {
  if (!signedUrl) return signedUrl;
  const url = new URL(signedUrl);
  url.searchParams.set("download", fileName);
  return url.href;
}

export async function subscribeToLibrary(onChange) {
  const client = await getClient();
  return client
    .channel("public-library")
    .on("postgres_changes", { event: "*", schema: "public", table: "files" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, onChange)
    .subscribe();
}

export async function registerPushSubscription(subscription) {
  const client = await getClient();
  const { data, error } = await client.functions.invoke("register-push", {
    body: { subscription },
  });
  if (error) throw error;
  return data;
}

export async function recordDownload(fileId) {
  const client = await getClient();
  const { error } = await client.rpc("increment_file_downloads", {
    file_id: fileId,
  });
  if (error) throw error;
}
