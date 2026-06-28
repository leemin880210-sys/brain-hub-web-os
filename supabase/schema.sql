create extension if not exists pgcrypto;

create table if not exists public.projects (
  project_id text primary key,
  name text not null,
  mode text not null check (mode in ('operation_system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_brains (
  client_id text primary key,
  project_id text not null references public.projects(project_id) on delete cascade,
  name text not null,
  status text not null check (status in ('account_ops', 'operation_ops', 'evolution_ops')),
  current_task text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_queue (
  task_id uuid primary key default gen_random_uuid(),
  client_id text not null references public.client_brains(client_id) on delete cascade,
  action text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_stream (
  event_id uuid primary key default gen_random_uuid(),
  client_id text not null references public.client_brains(client_id) on delete cascade,
  type text not null check (type in ('execution', 'chat', 'update')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists idx_client_brains_project_id on public.client_brains(project_id);
create index if not exists idx_task_queue_client_status on public.task_queue(client_id, status, created_at);
create index if not exists idx_event_stream_client_timestamp on public.event_stream(client_id, timestamp desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_client_brains_updated_at on public.client_brains;
create trigger set_client_brains_updated_at
before update on public.client_brains
for each row execute function public.set_updated_at();

drop trigger if exists set_task_queue_updated_at on public.task_queue;
create trigger set_task_queue_updated_at
before update on public.task_queue
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.client_brains enable row level security;
alter table public.task_queue enable row level security;
alter table public.event_stream enable row level security;

insert into public.projects (project_id, name, mode)
values ('douyin_operation_system', 'Douyin Operation System', 'operation_system')
on conflict (project_id) do update set
  name = excluded.name,
  mode = excluded.mode;

insert into public.client_brains (client_id, project_id, name, status, current_task)
values
  ('A001', 'douyin_operation_system', 'Craft Beer Bar', 'operation_ops', ''),
  ('A002', 'douyin_operation_system', 'Restaurant', 'operation_ops', '')
on conflict (client_id) do update set
  project_id = excluded.project_id,
  name = excluded.name,
  status = excluded.status;
