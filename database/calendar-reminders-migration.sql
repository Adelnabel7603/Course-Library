create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  event_type text not null check (event_type in ('lecture', 'section', 'exam')),
  title text not null check (length(trim(title)) > 0),
  course_name text not null check (length(trim(course_name)) > 0),
  group_name text not null default '',
  location_name text not null check (length(trim(location_name)) > 0),
  weekday smallint,
  starts_on date,
  ends_on date,
  event_date date,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  check (
    (event_type in ('lecture', 'section') and weekday between 1 and 7
      and weekday is not null and starts_on is not null and ends_on is not null
      and ends_on >= starts_on and event_date is null)
    or
    (event_type = 'exam' and weekday is null and starts_on is null
      and ends_on is null and event_date is not null)
  )
);

create index if not exists calendar_events_active_date_idx
  on public.calendar_events (is_active, event_date, starts_on, weekday);

do $$
begin
  alter publication supabase_realtime add table public.calendar_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

create table if not exists public.student_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists student_reminders_pending_idx
  on public.student_reminders (remind_at) where sent_at is null;

create table if not exists public.calendar_reminder_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  occurrence_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, occurrence_at)
);

alter table public.push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id) where user_id is not null;

alter table public.calendar_events enable row level security;
alter table public.student_reminders enable row level security;
alter table public.calendar_reminder_deliveries enable row level security;

 grant select on public.calendar_events to anon, authenticated;
grant insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.student_reminders to authenticated;
grant all on public.calendar_events, public.student_reminders, public.calendar_reminder_deliveries to service_role;
revoke all on public.calendar_reminder_deliveries from anon, authenticated;

 drop policy if exists "Public can read active calendar events" on public.calendar_events;
create policy "Public can read active calendar events" on public.calendar_events
  for select to anon, authenticated using (is_active or public.is_library_admin());
drop policy if exists "Admins can manage calendar events" on public.calendar_events;
create policy "Admins can manage calendar events" on public.calendar_events
  for all to authenticated using (public.is_library_admin())
  with check (public.is_library_admin());

drop policy if exists "Students manage their own reminders" on public.student_reminders;
create policy "Students manage their own reminders" on public.student_reminders
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.claim_due_calendar_pushes()
returns table (
  user_id uuid,
  reminder_type text,
  reminder_id uuid,
  event_id uuid,
  title text,
  body text,
  event_type text,
  course_name text,
  location_name text,
  occurrence_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  local_now timestamp without time zone := now() at time zone 'Africa/Cairo';
begin
  return query
  with due_events as (
    select
      event.id,
      (local_now::date + event.start_time) at time zone 'Africa/Cairo' as occurrence_at
    from public.calendar_events as event
    where event.is_active
      and local_now < local_now::date + event.start_time
      and local_now::date + event.start_time <= local_now + interval '15 minutes'
      and (
        (event.event_type = 'exam' and event.event_date = local_now::date)
        or
        (event.event_type in ('lecture', 'section')
          and event.weekday = extract(isodow from local_now::date)::smallint
          and local_now::date between event.starts_on and event.ends_on)
      )
  ), due_user_events as (
    select distinct subscription.user_id, due_events.id as event_id, due_events.occurrence_at
    from due_events
    join public.push_subscriptions as subscription on subscription.user_id is not null
    where not exists (
      select 1 from public.calendar_reminder_deliveries as delivery
      where delivery.user_id = subscription.user_id
        and delivery.event_id = due_events.id
        and delivery.occurrence_at = due_events.occurrence_at
    )
  ), due_personal as (
    select reminder.user_id, reminder.id, reminder.title, reminder.body, reminder.remind_at
    from public.student_reminders as reminder
    where reminder.sent_at is null
      and reminder.remind_at <= now()
      and exists (
        select 1 from public.push_subscriptions as subscription
        where subscription.user_id = reminder.user_id
      )
  )
  select
    due_user_events.user_id,
    'calendar'::text,
    null::uuid,
    event.id,
    event.title,
    '',
    event.event_type,
    event.course_name,
    event.location_name,
    due_user_events.occurrence_at
  from due_user_events
  join public.calendar_events as event on event.id = due_user_events.event_id
  union all
  select
    due_personal.user_id,
    'personal'::text,
    due_personal.id,
    null::uuid,
    due_personal.title,
    due_personal.body,
    null::text,
    null::text,
    null::text,
    due_personal.remind_at
  from due_personal;
end;
$$;

revoke all on function public.claim_due_calendar_pushes() from public, anon, authenticated;
grant execute on function public.claim_due_calendar_pushes() to service_role;
