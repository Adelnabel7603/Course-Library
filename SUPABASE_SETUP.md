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
6. Publish updates to the GitHub Pages source branch (`main`). The existing Pages deployment publishes each push automatically; its URL (`https://adelnabel7603.github.io/Course-Library/`) stays unchanged as long as the repository name remains `Course-Library`. Use the deployed HTTPS address or a local web server such as VS Code Live Server; do not open `index.html` directly as a `file://` URL, because browsers block JavaScript modules there and the controls will not work. Open `<your-site-url>/admin/login.html` and sign in. The dashboard checks the administrator allowlist and database policies protect every write operation.
7. On the dashboard, select the existing `legacy-pdfs` folder and click **رفع الملفات الحالية** to copy all 14 existing PDFs into persistent storage and add their current categories and metadata to the database.

The public library loads active categories, published files, and notifications from Supabase and listens for changes. New categories can optionally be placed inside an existing category; child categories appear nested under their parent and can be expanded or collapsed. The **الكل** view groups files into expandable category sections. Run `database/schema.sql` in the Supabase SQL Editor for a new database. For an existing database, run `database/notifications-migration.sql` if not already applied, then run `database/library-enhancements-migration.sql`; these add notification attachments and the persistent “new” marker without changing existing records. The library-files storage bucket is private; visitors receive temporary signed links only for published files, covers, and attachments of active notifications. Notification images remain limited to 10 MB each; multiple notification attachments and library files are limited to 1 GB per file, and cover images to 50 MB. The dashboard supports multiple PDF, Office, text, image, and video files in one upload with per-file names, descriptions, categories, visibility, and optional covers. Files over 6 MB use resumable uploads, images are previewed, and videos play in the public library. The Supabase project's plan may impose a lower maximum upload size.

### Notifications

The bell keeps up to 50 recent announcements and new-file notices in the library. New files published from the dashboard create a notice automatically and receive a “new” badge until another set of files is published. Announcements are written in the dashboard's **إعلان أو تعليمات للزوار** form and can include an image plus multiple downloadable/openable file attachments. Existing announcements and their attachments can be edited. New notices play a short chime while the site is open after the visitor has interacted with the page. Device notifications are optional and require the visitor's permission; they can arrive while the installed app or browser is closed. Background notification sound follows the device/browser notification settings; the web platform does not allow a site to force a custom sound.

To configure device notifications:

1. Generate a VAPID key pair on a trusted computer with `npx web-push generate-vapid-keys`. Keep the private key secret; never put it in `config.js` or commit it.
2. Set the public key as `vapidPublicKey` in `config.js`.
3. Install and authenticate the Supabase CLI, then set server-only secrets (replace the example origin/URL with the deployed site's exact origin and base URL):

   ```sh
   supabase secrets set APP_ORIGIN=https://adelnabel7603.github.io SITE_URL=https://adelnabel7603.github.io/Course-Library/ VAPID_SUBJECT=mailto:admin@example.com VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
   ```

   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Do not copy the service-role key into browser code.
4. Deploy both Edge Functions from the project root:

   ```sh
   supabase functions deploy register-push
   supabase functions deploy send-push-notification
   ```

5. For an existing database, run `database/notifications-migration.sql` if it has not been applied, followed by `database/library-enhancements-migration.sql`, in the Supabase SQL Editor. Publish the website update, then visitors open the bell and choose **تفعيل إشعارات الجهاز**. They must allow notifications on each browser/device. iOS requires a supported iOS version and the site added to the Home Screen. People who do not opt in still see new notices in the bell the next time they visit.

To safely preview the administration features without contacting Supabase, open `admin/dashboard.html?preview=features` locally. Preview categories, file records, and announcements are stored in this browser's local storage only. Selected files are not uploaded and no device push is sent in preview mode; preview changes never affect the live site.

The public site can be installed from a supported browser such as Chrome and caches its interface for offline access. New deployments activate and refresh an already-open site automatically; the library data and private cloud files still require an internet connection.

Do not delete `legacy-pdfs`: it is the original copy of the current files and is also the recovery copy for the migration.
