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
6. Publish the project files to the GitHub Pages site using HTTPS, keeping the folder structure intact. Open `<your-site-url>/admin/login.html` and sign in. The dashboard checks the administrator allowlist and database policies protect every write operation.
7. On the dashboard, select the existing `legacy-pdfs` folder and click **رفع الملفات الحالية** to copy all 14 existing PDFs into persistent storage and add their current categories and metadata to the database.

The public library loads active categories and published files from Supabase and listens for category/file changes. The storage bucket is private; visitors receive temporary signed links only for published file and cover records. Storage uploads are limited to 50 MB per file by the provided schema. The dashboard supports supported documents and image cover files; available MIME types and the size limit can be adjusted in `database/schema.sql`.

Do not delete `legacy-pdfs`: it is the original copy of the current files and is also the recovery copy for the migration.
