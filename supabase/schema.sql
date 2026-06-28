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
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'blocked', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_stream (
  event_id uuid primary key default gen_random_uuid(),
  client_id text not null references public.client_brains(client_id) on delete cascade,
  type text not null check (type in ('execution', 'chat', 'update', 'task_execution', 'state_update')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

alter table public.task_queue drop constraint if exists task_queue_status_check;
alter table public.task_queue
  add constraint task_queue_status_check
  check (status in ('pending', 'running', 'done', 'blocked', 'failed'));

alter table public.event_stream drop constraint if exists event_stream_type_check;
alter table public.event_stream
  add constraint event_stream_type_check
  check (type in ('execution', 'chat', 'update', 'task_execution', 'state_update'));

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
