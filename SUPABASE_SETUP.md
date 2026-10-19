# Supabase setup

The existing public library remains available from its bundled files until the Supabase project is configured. No service-role key or password belongs in the browser.

1. Create a Supabase project.
2. Run `database/schema.sql` in the Supabase SQL Editor. For an existing database, apply `database/notifications-migration.sql` if needed, then `database/library-enhancements-migration.sql` and `database/semester-library-migration.sql`. Run `database/library-2gb-upload-migration.sql` and `database/library-admin-audit-migration.sql` after those migrations; they set the bucket-level file limit and add read-only admin audit history without changing existing file records or paths.
3. In **Authentication → Users**, create the administrator account. Copy its user UUID.
4. In the SQL Editor, register that account as the first administrator:

   ```sql
   insert into public.admins (user_id)
   values ('PASTE_THE_AUTH_USER_UUID_HERE');
   ```

5. Copy the project's Project URL and publishable (or legacy anon/public) key into `config.js`. These are intended for browser use with the provided RLS policies; never use or publish a secret or `service_role` key.
6. Publish website updates through the configured hosting project. The current production URL is `https://course-library-alpha.vercel.app/`. Use the deployed HTTPS address or a local web server such as VS Code Live Server; do not open `index.html` directly as a `file://` URL, because browsers block JavaScript modules there and the controls will not work. Open `<your-site-url>/admin/login.html` and sign in. The dashboard checks the administrator allowlist and database policies protect every write operation.
7. On the dashboard, select the existing `legacy-pdfs` folder and click **رفع الملفات الحالية** to copy all 14 existing PDFs into persistent storage and add their current categories and metadata to the database.

The public library loads active categories, published files, and notifications from Supabase and listens for changes. New categories can optionally be placed inside an existing category; child categories appear nested under their parent and can be expanded or collapsed. The **الكل** view groups files into expandable category sections. Run `database/schema.sql` in the Supabase SQL Editor for a new database. For an existing database, apply `database/notifications-migration.sql` if not already applied, then `database/library-enhancements-migration.sql` and `database/semester-library-migration.sql`, followed by `database/library-2gb-upload-migration.sql` and `database/library-admin-audit-migration.sql`. These migrations do not alter existing file records or object paths. The library-files storage bucket is private; visitors receive temporary signed links only for published files, covers, and attachments of active notifications. Notification images remain limited to 10 MB each; library files and notification attachments are configured for up to 2 GiB per file, and cover images remain limited to 50 MB. The dashboard supports multiple file uploads with per-file details. Files over 6 MB use resumable uploads with progress, cancellation, and retry support. The bucket limit does not override a lower Supabase plan/project upload cap or storage quota; verify the project's Storage settings and plan before relying on 2 GiB uploads. The dashboard's registered storage total is not a quota/remaining-space value. User counts are not shown because the project's current library schema does not expose a secure Auth user-count API.

For existing databases, run `database/homepage-sections-migration.sql` after the existing database migrations to enable administrator-controlled homepage group ordering and visibility. Run `database/calendar-reminders-migration.sql` after `database/notifications-migration.sql` to add public timetable events and private student reminders.

### Notifications

The bell keeps up to 50 recent announcements and new-file notices in the library. New files published from the dashboard create a notice automatically and receive a “new” badge until another set of files is published. Announcements are written in the dashboard's **إعلان أو تعليمات للزوار** form and can include an image plus multiple downloadable/openable file attachments. Existing announcements and their attachments can be edited. New notices play a short chime while the site is open after the visitor has interacted with the page. Device notifications are optional and require the visitor's permission; they can arrive while the installed app or browser is closed. Background notification sound follows the device/browser notification settings; the web platform does not allow a site to force a custom sound.

To configure device notifications:

1. Generate a VAPID key pair on a trusted computer with `npx web-push generate-vapid-keys`. Keep the private key secret; never put it in `config.js` or commit it.
2. Set the public key as `vapidPublicKey` in `config.js`.
3. Install and authenticate the Supabase CLI, then update only the origin-related server secrets. `APP_ORIGIN` must be the exact browser origin with no path or trailing slash; the current production origin is `https://course-library-alpha.vercel.app`. `SITE_URL` is the full site URL and must have the same origin. The functions intentionally allow only this one origin:

   ```sh
   supabase secrets set --project-ref megmfomragunbfxtyglj APP_ORIGIN=https://course-library-alpha.vercel.app SITE_URL=https://course-library-alpha.vercel.app/
   ```

   This leaves existing VAPID secrets unchanged. If VAPID has not been configured yet, set `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` separately using the subject and matching key pair generated in step 1; never replace an existing pair just to fix the origin. If the site is served from a different production hostname, use that exact origin and URL instead. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Do not copy the service-role key into browser code.
4. Deploy both Edge Functions from the project root:

   ```sh
   supabase functions deploy register-push
   supabase functions deploy send-push-notification
   ```

5. For an existing database, run `database/notifications-migration.sql` if it has not been applied, followed by `database/library-enhancements-migration.sql`, in the Supabase SQL Editor. Publish the website update, then visitors open the bell and choose **تفعيل إشعارات الجهاز**. They must allow notifications on each browser/device. iOS requires a supported iOS version and the site added to the Home Screen. People who do not opt in still see new notices in the bell the next time they visit.

### Calendar and student reminders

Apply `database/calendar-reminders-migration.sql` after `database/notifications-migration.sql`. It creates the public timetable table, account-owned reminders, delivery de-duplication, and the private server RPC used by the scheduled sender.

In Supabase **Authentication → Providers**, enable Email sign-ups and set the production site URL and redirect URL to the existing `https://course-library-alpha.vercel.app/` origin. Students create accounts from the planner; no student data is stored in browser local storage.

In the administration dashboard, open **الجداول الدراسية**, download the CSV template, and import `.csv`, `.xlsx`, or `.xls`. The first worksheet is read. `lecture` and `section` rows use `weekday`, `starts_on`, and `ends_on` for a weekly recurrence; `exam` rows use `event_date`. Use 24-hour `start_time`/`end_time` values, the `Africa/Cairo` campus timezone, and the `location` field for the hall or room. Export the existing schedule before editing it so its `event_id` values can be retained on re-import.

Students can create accounts in **خطوة بخطوة**. Their personal reminders are protected by Supabase Auth and row-level security, and never appear in the public calendar. A schedule reminder is sent 15 minutes before an event; a personal reminder is sent at its selected time. Each student must sign in and enable device notifications on every browser/device that should receive push alerts. If email confirmation is enabled for Supabase Auth, students must confirm their email before signing in.

To deliver reminders while the site is closed, deploy the updated push registration function and the scheduled sender:

```sh
supabase functions deploy register-push
supabase functions deploy send-push-notification
supabase functions deploy send-scheduled-reminders
```

Generate a long random value and set it as the Edge Function secret (replace the placeholder locally):

```sh
supabase secrets set --project-ref megmfomragunbfxtyglj SCHEDULED_REMINDERS_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
```

Store the same secret and the scheduled-function URL in Supabase Vault, then enable the `pg_cron`, `pg_net`, and `supabase_vault` extensions and schedule the function once per minute in the SQL Editor:

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
   'https://megmfomragunbfxtyglj.supabase.co/functions/v1/send-scheduled-reminders',
   'calendar-reminders-url'
);
select vault.create_secret('REPLACE_WITH_THE_SCHEDULED_REMINDERS_SECRET', 'calendar-reminders-secret');

select cron.schedule(
   'calendar-push-reminders',
   '* * * * *',
   $$
      select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar-reminders-url'),
         headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'calendar-reminders-secret')
         ),
         body := '{}'::jsonb
      );
   $$
);
```

Replace the placeholder only in the SQL Editor with the secret already set for the Edge Function; do not commit it. Before re-running the cron block, remove an existing job with `select cron.unschedule(jobid) from cron.job where jobname = 'calendar-push-reminders';`.

To safely preview the administration features without contacting Supabase, open `admin/dashboard.html?preview=features` locally. Preview categories, file records, and announcements are stored in this browser's local storage only. Selected files are not uploaded and no device push is sent in preview mode; preview changes never affect the live site.

The public site can be installed from a supported browser such as Chrome and caches its interface for offline access. New deployments activate and refresh an already-open site automatically; the library data and private cloud files still require an internet connection.

Do not delete `legacy-pdfs`: it is the original copy of the current files and is also the recovery copy for the migration.
