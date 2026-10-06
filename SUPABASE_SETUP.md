# Supabase setup

The existing public library remains available from its bundled files until the Supabase project is configured. No service-role key or password belongs in the browser.

1. Create a Supabase project.
2. Run `database/schema.sql` in the Supabase SQL Editor.
3. In **Authentication → Users**, create the administrator account. Copy its user UUID.
4. In the SQL Editor, register that account as the first administrator:

   ```sql
   insert into public.admins (user_id)
   values ('PASTE_THE_AUTH_USER_UUID_HERE');
   ```

5. Copy the project's Project URL and publishable (or legacy anon/public) key into `config.js`. These are intended for browser use with the provided RLS policies; never use or publish a secret or `service_role` key.
6. Publish updates to the GitHub Pages source branch (`main`). The existing Pages deployment publishes each push automatically; its URL (`https://adelnabel7603.github.io/Course-Library/`) stays unchanged as long as the repository name remains `Course-Library`. Open `<your-site-url>/admin/login.html` and sign in. The dashboard checks the administrator allowlist and database policies protect every write operation.
7. On the dashboard, select the existing `legacy-pdfs` folder and click **رفع الملفات الحالية** to copy all 14 existing PDFs into persistent storage and add their current categories and metadata to the database.

The public library loads active categories, published files, and notifications from Supabase and listens for category, file, and notification changes. The library storage bucket is private; visitors receive temporary signed links only for published file and cover records. Notification images use a separate public bucket and are limited to 10 MB. Library files are limited to 1 GB per file and cover images to 50 MB. The dashboard supports multiple PDF, Office, text, image, and video files in one upload; files over 6 MB use resumable uploads, images are previewed, and videos play in the public library. To apply the file-size limit and MIME types on an existing project, run the updated `database/schema.sql` in the Supabase SQL Editor. The Supabase project's plan may impose a lower maximum upload size.

Categories can be nested by choosing a parent when creating them. Selecting a parent category in the public library includes files in its child categories. When uploading multiple files together, each file has its own name, description, category, publication status, and optional cover image.

### Notifications

Admins can publish text announcements or attach an image with a caption from the dashboard. Visitors see announcements in the bell; a short chime can play while the site is open after the visitor interacts with the page. Device notifications require the visitor's permission. Background notification sound follows device/browser settings and cannot be forced by a website.

For an existing project, run `database/notifications-migration.sql` once in the Supabase SQL Editor; it also adds the parent-category relationship needed by nested categories. Keep the VAPID private key server-side only. Set `APP_ORIGIN`, `SITE_URL`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` as Supabase Edge Function secrets; Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Put only the public VAPID key in `config.js`.

Deploy `register-push` and `send-push-notification` from this repository with the Supabase CLI. `supabase/config.toml` disables gateway JWT verification for the public subscription-registration endpoint; the function validates the site origin and subscription data. Keep JWT verification enabled for `send-push-notification`; the function also checks the authenticated user against the `admins` table before sending. If deploying through the Supabase dashboard, set **Verify JWT with legacy secret** OFF for `register-push` and ON for `send-push-notification`. Visitors can then open the bell and choose **تفعيل إشعارات الجهاز**; iOS requires the site to be added to the Home Screen.

The public site can be installed from a supported browser such as Chrome and caches its interface for offline access. New deployments are activated automatically when a visitor refreshes the page; the library data and private cloud files still require an internet connection.

Do not delete `legacy-pdfs`: it is the original copy of the current files and is also the recovery copy for the migration.
