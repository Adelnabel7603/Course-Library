# Semester library setup

The semester overview and category browser can read existing library records immediately. To persist semester and category management changes in Supabase, apply [`database/semester-library-migration.sql`](./database/semester-library-migration.sql) in the existing project's SQL Editor.

The migration creates the semester table, adds category descriptions and icons, and associates existing root categories with the first semester. It does not modify file records or storage paths.
