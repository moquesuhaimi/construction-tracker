-- Construction Tracker: Supabase schema
-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

-- 1. Profiles ----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  company text not null default '',
  role text not null default '',
  profile_image text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  -- Link this new user to any project they were pre-invited to by email
  update public.project_members
  set user_id = new.id
  where email = new.email and user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Projects ------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  total_budget numeric not null default 0,
  start_date date,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- 3. Project members (team) ----------------------------------------------
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  can_view_cash_position boolean not null default false,
  added_at timestamptz not null default now(),
  unique (project_id, email)
);

alter table public.project_members enable row level security;

-- Helper: does the current user have access to a project (owner or member)?
create or replace function public.has_project_access(p_project_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = auth.uid()
  );
$$;

-- Projects policies
create policy "See projects you own or are a member of"
  on public.projects for select
  to authenticated
  using (owner_id = auth.uid() or public.has_project_access(id));

create policy "Create projects as yourself"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Only the owner can edit a project"
  on public.projects for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Only the owner can delete a project"
  on public.projects for delete
  to authenticated
  using (owner_id = auth.uid());

-- Project members policies
create policy "Members list visible to owner and members"
  on public.project_members for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "Only the owner can add team members"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_owner(project_id));

create policy "Only the owner can remove team members"
  on public.project_members for delete
  to authenticated
  using (public.is_project_owner(project_id));

create policy "Only the owner can update team member access"
  on public.project_members for update
  to authenticated
  using (public.is_project_owner(project_id));

-- 4. Expenses --------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric not null,
  date date not null,
  receipt text,
  receipt_image text,
  has_receipt_image boolean generated always as (receipt_image is not null) stored,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "See expenses for projects you can access"
  on public.expenses for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "Add your own expenses to projects you can access"
  on public.expenses for insert
  to authenticated
  with check (user_id = auth.uid() and public.has_project_access(project_id));

create policy "Edit your own expenses, or any expense if you own the project"
  on public.expenses for update
  to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

create policy "Delete your own expenses, or any expense if you own the project"
  on public.expenses for delete
  to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

-- 5. Cash advances (petty cash / float given to a team member) ------------
-- These are NOT expenses. They track money handed to someone so they can
-- buy things for the project. The actual purchase they make gets logged as
-- a normal expense; the advance just lets the owner see how much float is
-- still outstanding with that person.
create table if not exists public.cash_advances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  given_by uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cash_advances enable row level security;

create policy "Owner and recipient can see cash advances"
  on public.cash_advances for select
  to authenticated
  using (
    public.is_project_owner(project_id) or recipient_id = auth.uid()
  );

create policy "Only the owner can record cash advances"
  on public.cash_advances for insert
  to authenticated
  with check (public.is_project_owner(project_id) and given_by = auth.uid());

create policy "Only the owner can edit cash advances"
  on public.cash_advances for update
  to authenticated
  using (public.is_project_owner(project_id));

create policy "Only the owner can delete cash advances"
  on public.cash_advances for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- 6. Cash advance "read" tracking (for in-app notifications) ---------------
-- A separate table so the recipient can mark an advance as seen without
-- needing update rights on the advance ledger itself.
create table if not exists public.cash_advance_reads (
  advance_id uuid primary key references public.cash_advances (id) on delete cascade,
  read_at timestamptz not null default now()
);

alter table public.cash_advance_reads enable row level security;

create policy "Recipient can mark their own advance as read"
  on public.cash_advance_reads for insert
  to authenticated
  with check (
    exists (
      select 1 from public.cash_advances a
      where a.id = advance_id and a.recipient_id = auth.uid()
    )
  );

create policy "Recipient and owner can see read status"
  on public.cash_advance_reads for select
  to authenticated
  using (
    exists (
      select 1 from public.cash_advances a
      where a.id = advance_id and (a.recipient_id = auth.uid() or public.is_project_owner(a.project_id))
    )
  );

-- 7. Progress payments (cash actually received from the client) -----------
-- The project's "budget" is the contract value, which is not the same as
-- cash on hand - clients pay in stages. This table tracks each payment
-- received so the owner can see real cash position, not just budget usage.
create table if not exists public.progress_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  amount numeric not null,
  date date not null default current_date,
  description text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.progress_payments enable row level security;

create policy "Owner and granted members can see progress payments"
  on public.progress_payments for select
  to authenticated
  using (
    public.is_project_owner(project_id)
    or exists (
      select 1 from public.project_members m
      where m.project_id = progress_payments.project_id
        and m.user_id = auth.uid()
        and m.can_view_cash_position = true
    )
  );

create policy "Only the owner can record progress payments"
  on public.progress_payments for insert
  to authenticated
  with check (public.is_project_owner(project_id) and created_by = auth.uid());

create policy "Only the owner can edit progress payments"
  on public.progress_payments for update
  to authenticated
  using (public.is_project_owner(project_id));

create policy "Only the owner can delete progress payments"
  on public.progress_payments for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- 8. Helpful indexes ---------------------------------------------------------
create index if not exists idx_expenses_project_id on public.expenses (project_id);
create index if not exists idx_expenses_user_id on public.expenses (user_id);
create index if not exists idx_project_members_project_id on public.project_members (project_id);
create index if not exists idx_project_members_email on public.project_members (email);
create index if not exists idx_cash_advances_project_id on public.cash_advances (project_id);
create index if not exists idx_cash_advances_recipient_id on public.cash_advances (recipient_id);
create index if not exists idx_progress_payments_project_id on public.progress_payments (project_id);

notify pgrst, 'reload schema';
